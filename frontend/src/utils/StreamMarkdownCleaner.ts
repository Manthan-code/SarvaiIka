/*
  StreamMarkdownCleaner: incremental cleaner for streaming markdown tokens.
  - Wraps LaTeX-like math outside `$...$`/`$$...$$` with inline `$...$` (heuristic, chunk-local).
  - Removes stray `**` at start/end of line when not enclosing content (chunk-local).
  - Preserves code blocks and inline code; does not modify inside backticks.
  - Maintains minimal state across chunks to avoid buffering entire messages.
*/

export class StreamMarkdownCleaner {
  private inInlineMath = false;
  private inBlockMath = false;
  private inCodeBlock = false;
  private inInlineCode = false;

  // Track if at start of a new line within streaming context
  private atLineStart = true;

  // Small helper: test if a phrase looks like math (heuristic)
  private looksLikeMath(phrase: string): boolean {
    // Ignore trivial short tokens
    const p = phrase.trim();
    if (!p) return false;
    // Common LaTeX commands or math patterns
    const hasLatexCmd = /\\(int|sum|prod|frac|sqrt|lim|log|sin|cos|tan|alpha|beta|gamma|theta|lambda|pi|mu|sigma|phi|omega)\b/.test(p);
    const hasSuperOrSub = /[A-Za-z0-9)]\s*[\^_]\s*[A-Za-z0-9(]/.test(p);
    const hasEquality = /[A-Za-z0-9)\]]\s*(=|≤|≥|≠|≈|∼|∝|\+|−|\-|\*)\s*[A-Za-z0-9(\\]/.test(p);
    const hasGreekWord = /(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)/i.test(p);
    return hasLatexCmd || hasSuperOrSub || hasEquality || hasGreekWord;
  }

  // Normalize common LaTeX command words by prefixing a backslash when missing
  private normalizeLatexCommands(str: string): string {
    const cmds = ['frac','sqrt','int','sum','prod','lim','log','sin','cos','tan','cdot','ldots','leq','geq','neq','approx','sim','propto',
      'alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega'];
    const pattern = new RegExp(`\\b(${cmds.join('|')})\\b`, 'g');
    return str.replace(pattern, (match: string, cmd: string, offset: number, full: string) => {
      // If already prefixed with backslash, keep as is
      const prev = offset > 0 ? full[offset - 1] : '';
      if (prev === '\\') return match; // already \cmd
      return `\\${cmd}`;
    });
  }

  // Process a streaming chunk and return cleaned text
  processChunk(input: string): string {
    if (!input) return '';

    let out = '';
    // Basic scanner through the chunk
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      const next = i + 1 < input.length ? input[i + 1] : '';
      const next2 = i + 2 < input.length ? input[i + 2] : '';

      // Handle fences and code contexts first
      if (!this.inInlineMath && !this.inBlockMath) {
        // Triple backticks toggle code block
        if (!this.inInlineCode && ch === '`' && next === '`' && next2 === '`') {
          this.inCodeBlock = !this.inCodeBlock;
          out += '```';
          i += 2;
          this.atLineStart = false;
          continue;
        }
        // Inline code tick (single) only when not in code block and not part of triple fence
        if (!this.inCodeBlock && ch === '`') {
          this.inInlineCode = !this.inInlineCode;
          out += ch;
          this.atLineStart = false;
          continue;
        }
      }

      // Within code contexts, pass through unchanged, but track line starts
      if (this.inCodeBlock || this.inInlineCode) {
        out += ch;
        if (ch === '\n') this.atLineStart = true; else this.atLineStart = false;
        continue;
      }

      // Track math contexts explicitly
      if (ch === '$') {
        if (next === '$') {
          // Toggle block math
          this.inBlockMath = !this.inBlockMath;
          out += '$$';
          i += 1;
          this.atLineStart = false;
          continue;
        } else {
          // Toggle inline math
          this.inInlineMath = !this.inInlineMath;
          out += '$';
          this.atLineStart = false;
          continue;
        }
      }

      // If currently inside math contexts, pass through
      if (this.inInlineMath || this.inBlockMath) {
        // Within math, normalize command tokens when they appear without a backslash
        if (/[A-Za-z]/.test(ch)) {
          // capture contiguous word
          let word = ch;
          let k = i + 1;
          for (; k < input.length; k++) {
            const c = input[k];
            if (!/[A-Za-z]/.test(c)) break;
            word += c;
          }
          const normalized = this.normalizeLatexCommands(word);
          out += normalized;
          i = k - 1;
        } else {
          out += ch;
        }
        if (ch === '\n') this.atLineStart = true; else this.atLineStart = false;
        continue;
      }

      // Remove stray ** at line start (only if immediately followed by newline or whitespace+newline in this chunk)
      if (this.atLineStart && ch === '*' && next === '*') {
        // Peek ahead for non-whitespace before newline within chunk
        let j = i + 2;
        let sawNonSpace = false;
        let sawNewline = false;
        for (; j < input.length; j++) {
          const c = input[j];
          if (c === '\n') { sawNewline = true; break; }
          if (!/\s/.test(c)) { sawNonSpace = true; break; }
        }
        if (!sawNonSpace && sawNewline) {
          // Drop the stray '**'
          i += 1; // Skip both asterisks
          // Keep atLineStart true until we emit something non-whitespace
          continue;
        }
      }

      // Detect potential math phrases bounded within this chunk:
      if (!this.inInlineMath && !this.inBlockMath) {
        // Attempt to capture a phrase up to the next boundary (space, punctuation, or newline)
        if (/[^\s]/.test(ch)) {
          let phrase = ch;
          let k = i + 1;
          for (; k < input.length; k++) {
            const c = input[k];
            if (/[\s]|[,:;.!?\)\]\}]|\n/.test(c)) break;
            phrase += c;
          }
          if (this.looksLikeMath(phrase)) {
            const normalizedPhrase = this.normalizeLatexCommands(phrase);
            out += `$${normalizedPhrase}$`;
            i = k - 1;
            this.atLineStart = false;
            continue;
          }
        }
      }

      // Normal character emission
      out += ch;
      if (ch === '\n') {
        // Before newline, if there is stray ending '**' directly before newline, remove them
        // This check is local: if out currently ends with '**' and previous char(s) are whitespace or start-of-line in this chunk
        const tail = out.slice(-3);
        if (tail.endsWith('**\n')) {
          // Replace '**\n' with '\n'
          out = out.slice(0, -3) + '\n';
        }
        this.atLineStart = true;
      } else {
        this.atLineStart = false;
      }
    }

    return out;
  }
}

export default StreamMarkdownCleaner;