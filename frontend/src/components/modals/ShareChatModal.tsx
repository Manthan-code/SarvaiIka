import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Copy, Linkedin, Sparkles } from "lucide-react";
import chatsService from "@/services/chatsService";
import { AnimatePresence, motion } from "framer-motion";

type ChatMessage = {
  id?: string;
  role?: "user" | "assistant" | "system";
  content: string;
};

interface ShareChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatTitle?: string;
  messages?: ChatMessage[];
}

export default function ShareChatModal({
  open,
  onOpenChange,
  chatId,
  chatTitle,
  messages,
}: ShareChatModalProps) {
  const [step, setStep] = useState<"confirm" | "display">("confirm");
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("confirm");
    setShareUrl("");
    setCopied(false);
    setError(null);

  const buildPreviewMessages = (msgs: ChatMessage[]): ChatMessage[] => {
  const filtered = msgs.filter(
    m => (m.role === "user" || m.role === "assistant") && (m.content ?? "").trim().length > 0
  );

  const preview: ChatMessage[] = [];
  let totalLines = 0;
  const MAX_LINES = 6; // total visible lines (approx)
  const CHARS_PER_LINE = 80; // adjust for your UI width

  for (const m of filtered) {
    if (totalLines >= MAX_LINES) break;

    const content = (m.content ?? "");
    const estLines = Math.ceil(content.length / CHARS_PER_LINE);
    const remaining = MAX_LINES - totalLines;

    if (estLines <= remaining) {
      // whole message fits
      preview.push({ ...m, content });
      totalLines += estLines;
    } else {
      // cut message to fit remaining lines
      const cutoff = remaining * CHARS_PER_LINE;
      const previewContent = content.slice(0, cutoff).trim() + "…";
      preview.push({ ...m, content: previewContent });
      totalLines = MAX_LINES;
    }
  }

  return preview;
};




    const loadPreview = async () => {
      try {
        // Prefer passed-in messages if available
        if (messages && messages.length > 0) {
          setPreviewMessages(buildPreviewMessages(messages));
          return;
        }
        // Otherwise fetch session messages
        const resp = await chatsService.getChatSession(chatId);
        const rawMessages = (resp && (resp.messages || resp.data?.messages || resp.data?.data?.messages)) || [];
        const normalized: ChatMessage[] = Array.isArray(rawMessages) ? rawMessages : [];
        setPreviewMessages(buildPreviewMessages(normalized));
      } catch (e: any) {
        console.error("Failed to load chat preview:", e);
        setError("Failed to load chat preview");
      }
    };

    loadPreview();
  }, [open, chatId, messages]);

  const onConfirmCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await chatsService.createSharedChat(chatId);
      const url = resp?.url || `${window.location.origin}/share/${resp?.shareId || ""}`;
      setShareUrl(url);
      setStep("display");
      // Auto-copy on create
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        // Clipboard may fail, keep going
        console.warn("Clipboard write failed", e);
      }
    } catch (e: any) {
      console.error("Failed to create share link:", e);
      setError(e?.message || "Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard write failed", e);
    }
  };

  const shareToWhatsApp = () => {
    if (!shareUrl) return;
    const text = encodeURIComponent(`${chatTitle ? chatTitle + " — " : ""}${shareUrl}`);
    const url = `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToLinkedIn = () => {
    if (!shareUrl) return;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-w-2xl p-6 sm:p-8 rounded-[42px] sm:rounded-[42px] bg-white dark:bg-[#2f2f2f] text-foreground">
        <AnimatePresence mode="wait">
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">Create public link</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Anyone with the link can view the conversation you've shared. Please check for sensitive or private content. You can manage shared links anytime in Settings &gt; Data.
              </p>
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={onConfirmCreate}
                  className="w-full sm:w-auto h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                    </span>
                  ) : (
                    "Create and Copy"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "display" && (
            <motion.div
              key="display"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-7"
            >
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold tracking-tight">Shareable URL</DialogTitle>
              </DialogHeader>
              <div className="border-b-2 border-border/70 mt-2 mb-4" />

              <div className="space-y-2">
                <div className="relative border border-border rounded-xl p-4 sm:p-5 bg-muted min-h-64 sm:min-h-72">
                  <div className="space-y-3 text-sm leading-relaxed">
                    {previewMessages.length > 0 ? (
                      previewMessages.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className="max-w-[85%]">
                            <div className={`${m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"} rounded-2xl px-4 py-3 shadow-sm`}>
                              <div className="prose dark:prose-invert max-w-[80%] whitespace-pre-wrap break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No content to preview.</p>
                    )}
                    
                  </div>
                  
                  {/* Brand mark at bottom-left matching sidebar logo */}
                  <div className="absolute right-3 bottom-3 flex items-center gap-2 select-none">
                    <div className="relative w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent rounded-lg" />
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Sarva-Ika</span>
                  </div>
                  {/* Smooth CSS fade effect at the end of the preview */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-9 rounded-b-xl bg-gradient-to-t from-background to-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-2">
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleCopy}
                    className={`h-10 w-10 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
                    aria-label="Copy link"
                    type="button"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Copy className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                    )}
                  </button>
                  <span className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">Copy link</span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    onClick={shareToWhatsApp}
                    className="h-10 w-10 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Share via WhatsApp"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path fill="#25D366" d="M20.52 3.48A11.79 11.79 0 0 0 12 0C5.37 0 .09 5.28.09 11.91c0 2.1.56 4.17 1.62 5.98L0 24l6.27-1.64a11.86 11.86 0 0 0 5.74 1.46h.01c6.63 0 11.91-5.28 11.91-11.91 0-3.18-1.24-6.16-3.41-8.43Z"/>
                      <path fill="#fff" d="M17.28 14.06c-.28.79-1.57 1.47-2.19 1.53-.6.06-1.38.03-2.23-.48-.74-.44-1.7-1.57-1.96-1.89-.26-.31-.47-.68-.64-1.07-.17-.39-.04-.84.1-1.07.15-.23.33-.39.55-.5.18-.1.38-.1.58 0 .18.1.38.29.58.57.2.28.26.4.37.62.12.22.07.35-.03.5-.1.14-.15.22-.25.36-.08.13-.17.27-.07.45.1.18.44.75.95 1.21.66.6 1.22.79 1.41.88.19.09.31.08.42-.05.1-.13.47-.55.58-.74.12-.19.24-.16.4-.1.16.06 1.01.48 1.19.56.18.09.3.13.34.2.08.12.08.85-.2 1.64Z"/>
                    </svg>
                  </button>
                  <span className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">WhatsApp</span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    onClick={shareToLinkedIn}
                    className="h-10 w-10 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Share via LinkedIn"
                    type="button"
                  >
                    <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                  </button>
                  <span className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">LinkedIn</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}