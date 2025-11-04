const fs = require('fs');
const path = require('path');

function pct(n){
  const v = typeof n === 'number' ? n : 0;
  return Number.isFinite(v) ? v : 0;
}

function readCoverageSummary(){
  const p = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function computeSummary(data){
  const total = data.total || {};
  const overall = {
    statements: pct(total.statements && total.statements.pct),
    branches: pct(total.branches && total.branches.pct),
    functions: pct(total.functions && total.functions.pct),
    lines: pct(total.lines && total.lines.pct),
  };

  const files = [];
  for (const [k, v] of Object.entries(data)){
    if (k === 'total') continue;
    const ln = v.lines || {};
    const tot = ln.total || 0;
    const cov = ln.covered || 0;
    const p = ln.pct || 0;
    files.push({file: k, tot, cov, pct: p});
  }
  const nonzero = files.filter(f => f.tot > 0);
  const lowest = [...nonzero].sort((a,b) => a.pct - b.pct).slice(0, 10);
  const highest = [...nonzero].sort((a,b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.tot - b.tot;
  }).slice(0, 5);

  const buckets = {components:{tot:0,cov:0}, hooks:{tot:0,cov:0}, utils:{tot:0,cov:0}, pages:{tot:0,cov:0}};
  nonzero.forEach(f => {
    const s = f.file.replace(/\\/g, '/');
    for (const b of Object.keys(buckets)){
      if (s.includes(`/src/${b}/`)){
        buckets[b].tot += f.tot;
        buckets[b].cov += f.cov;
      }
    }
  });
  const heatmap = {};
  for (const [b, v] of Object.entries(buckets)){
    heatmap[b] = v.tot ? (v.cov / v.tot * 100) : 0;
  }

  // Quick wins: small files (<= 80 lines total) with <= 20% coverage, prefer utils/hooks/services
  const quickWins = nonzero
    .filter(f => f.tot <= 80 && f.pct <= 20)
    .sort((a,b) => a.pct - b.pct || a.tot - b.tot)
    .slice(0, 10);

  // Complex/high-value: low coverage (<= 20%) but large (>= 150 lines)
  const complexHighValue = nonzero
    .filter(f => f.tot >= 150 && f.pct <= 20)
    .sort((a,b) => a.pct - b.pct || b.tot - a.tot)
    .slice(0, 10);

  return { overall, lowest, highest, heatmap, quickWins, complexHighValue };
}

function formatSummary(sum){
  const lines = [];
  lines.push('## Coverage Summary');
  lines.push(`- Statements: ${sum.overall.statements.toFixed(2)}%`);
  lines.push(`- Branches: ${sum.overall.branches.toFixed(2)}%`);
  lines.push(`- Functions: ${sum.overall.functions.toFixed(2)}%`);
  lines.push(`- Lines: ${sum.overall.lines.toFixed(2)}%`);
  lines.push('');
  lines.push('## Top 10 Lowest Coverage');
  sum.lowest.forEach(f => lines.push(`- ${f.file} – ${f.pct.toFixed(2)}% (lines ${f.cov}/${f.tot})`));
  lines.push('');
  lines.push('## Top 5 Highest Coverage');
  sum.highest.forEach(f => lines.push(`- ${f.file} – ${f.pct.toFixed(2)}% (lines ${f.cov}/${f.tot})`));
  lines.push('');
  lines.push('## Heatmap (by folder)');
  for (const [b, v] of Object.entries(sum.heatmap)){
    lines.push(`- ${b}: ${v.toFixed(2)}%`);
  }
  lines.push('');
  lines.push('## Quick Wins');
  sum.quickWins.forEach(f => lines.push(`- ${f.file} – ${f.pct.toFixed(2)}% (small: ${f.tot} lines)`));
  lines.push('');
  lines.push('## Focus Areas (Complex/High-Value)');
  sum.complexHighValue.forEach(f => lines.push(`- ${f.file} – ${f.pct.toFixed(2)}% (large: ${f.tot} lines)`));
  return lines.join('\n');
}

(function main(){
  const data = readCoverageSummary();
  const summary = computeSummary(data);
  const text = formatSummary(summary);
  console.log(text);
})();