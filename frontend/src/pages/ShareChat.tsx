import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Share2, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import chatsService from '@/services/chatsService';
import { ChatLoadingSkeleton } from '@/components/ui/ChatMessageSkeleton';
import { useSafeBackground } from '@/hooks/useSafeBackground';
import { useAuthStore } from '@/stores/authStore';

type SharedMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
};

export default function ShareChat() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { backgroundImage } = useSafeBackground();
  const { user, session } = useAuthStore();
  const [title, setTitle] = useState<string>('Shared Chat');
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isForking, setIsForking] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const fetchSharedChat = async () => {
      if (!shareId) return;
      setIsLoading(true);
      setError(null);
      try {
        const resp = await chatsService.getSharedChat(shareId);
        setTitle(resp.title || 'Shared Chat');
        setMessages(resp.messages || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load shared chat');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSharedChat();
  }, [shareId]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  const copyToClipboard = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, []);

  const shareMessage = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shared AI Message',
          text,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  const handleFork = async () => {
    if (!shareId) return;
    // Require authentication to fork
    if (!user || !session) {
      navigate('/login');
      return;
    }
    setIsForking(true);
    try {
      const resp = await chatsService.forkSharedChat(shareId);
      const nextUrl = resp?.url || `${window.location.origin}/chat/${resp?.chatId || ''}`;
      // Navigate to the new chat
      navigate(`/chat/${resp?.chatId}`);
      // Fallback: full redirect if needed
      // window.location.href = nextUrl;
    } catch (forkError: any) {
      console.error('Failed to fork chat:', forkError);
      setError(forkError?.message || 'Failed to fork chat');
    } finally {
      setIsForking(false);
    }
  };

  return (
    <div 
      className="flex flex-col min-h-screen w-full bg-[#fff] dark:bg-[#212121]"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Header - Sticky */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-white/95 dark:bg-[#212121] backdrop-blur-sm">
        {/* Left: Sarvaika Logo and Name */}
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent rounded-lg" />
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Sarva-Ika
          </span>
        </div>

        {/* Center: Chat Title */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate max-w-xs sm:max-w-md">
            {title}
          </h1>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center space-x-2">
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Open app"
            >
              Open App
            </Button>
          </Link>
          <Button
            variant="default"
            size="sm"
            onClick={handleFork}
            disabled={isForking}
            className="h-9 px-3 rounded-full"
            title="Fork this chat"
          >
            {isForking ? 'Forking…' : 'Fork Chat'}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto pb-10 px-4 relative custom-scrollbar scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent"
      >
        {backgroundImage && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 pointer-events-none" />
        )}
        <div className="max-w-3xl mx-auto py-6 space-y-6 relative z-10">
          {error && (
            <div className="flex justify-center py-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <ChatLoadingSkeleton />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full pt-20 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6">
                <div className="text-4xl">📄</div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                No messages in this shared chat
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                The owner didn’t include any content or it was removed.
              </p>
            </div>
          ) : (
            <>
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[85%] group">
                        <div className="relative">
                          <div className="bg-blue-400 text-white rounded-3xl px-4 py-3 shadow-sm">
                            <p className="text-lg leading-relaxed whitespace-pre-wrap break-all" style={{ hyphens: 'auto', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                              {message.content}
                            </p>
                          </div>
                          <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => copyToClipboard(message.content, message.id || '')}
                              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-4 w-4 text-green-600 transition-transform duration-200 scale-110" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%]">
                        <div className="py-2">
                          <p className="text-lg leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200" style={{ hyphens: 'auto', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {message.content}
                          </p>
                          <div className="flex items-center space-x-2 mt-3">
                            <div className="relative group">
                              <button
                                onClick={() => copyToClipboard(message.content, message.id || '')}
                                className="flex items-center px-2 py-1 rounded-md border border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                )}
                              </button>
                              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                Copy
                              </span>
                            </div>
                            <div className="relative group">
                              <button
                                onClick={() => shareMessage(message.content)}
                                className="flex items-center px-2 py-1 rounded-md border border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                              </button>
                              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                Share
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}