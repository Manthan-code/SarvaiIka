import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Share2, Check, ArrowUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActiveChat } from '@/hooks/useActiveChat';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { useAuthStore } from '@/stores/authStore';
// Removed legacy skeleton in favor of a minimal loading spinner
import { useSafeBackground } from '@/hooks/useSafeBackground';
import chatsService from '@/services/chatsService';
import ShareChatModal from '@/components/modals/ShareChatModal';
import ChatLoadingIndicator from '@/components/ui/ChatLoadingIndicator';

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuthStore();
  const { backgroundImage } = useSafeBackground();
  
  // Debug background image
  useEffect(() => {
    if (backgroundImage) {
      console.log('💬 Chat: Background image applied');
    }
  }, [backgroundImage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isNewChat, setIsNewChat] = useState(!chatId);
  const [docked, setDocked] = useState<boolean>(!!chatId);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const lastUserInputRef = useRef<string>('');
  

  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    error,
    currentChatId,
    currentChat,
    sendMessage,
    addMessage,
    switchChat,
    refreshMessages,
    clearMessages
  } = useActiveChat();

  // Streaming hook for live responses
  const {
    messages: streamMessages,
    streamingState,
    sendMessage: sendStreamMessage,
    sessionId,
    clearMessages: clearStreamMessages
  } = useStreamingChat();
  
  // Ensure we never render duplicate keys and always display string content
  const toDisplayString = useCallback((value: any): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }, []);

  const displayMessages = useMemo(() => {
    const combine = [...messages, ...streamMessages as any];
    const seen = new Set<string>();
    return combine.filter((m) => {
      const id = (m as any).id || `${(m as any).role}-${(m as any).timestamp}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [messages, streamMessages]);

  
  // Switch to chat when chatId changes
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      setIsNewChat(false);
      switchChat(chatId);
      // Clear any transient streaming messages when switching
      clearStreamMessages();
    } else if (!chatId) {
      // Clear messages and reset state for new chat
      setIsNewChat(true);
      clearMessages();
      clearStreamMessages();
      // Reset any error state
      // Note: currentChatId and currentChat will be cleared by clearMessages
    }
  }, [chatId, currentChatId, switchChat, clearMessages, clearStreamMessages]);

  // If a 404 occurs for the requested chat, treat as a new chat
  useEffect(() => {
    if (error === 'Chat not found') {
      setIsNewChat(true);
    }
  }, [error]);

  // Dock input when existing chat or any content present (including streaming);
  // undock only when truly empty new chat
  useEffect(() => {
    const hasAnyContent = (messages.length > 0)
      || ((streamMessages as any)?.length > 0)
      || !!streamingState?.isStreaming;

    if (isNewChat && !hasAnyContent) {
      setDocked(false);
    } else if (currentChatId || hasAnyContent) {
      setDocked(true);
    }
  }, [isNewChat, currentChatId, messages, streamMessages, streamingState?.isStreaming]);



  // Auto-scroll so latest message aligns at the top of the viewport
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, streamingState?.isStreaming]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 6 * 24; // ~6 lines at 24px line height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Handle clicks outside menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect to login if not authenticated
  if (!user || !session) {
    navigate('/login');
    return null;
  }

  const scrollToBottom = useCallback(() => {
    // Prefer aligning the latest message to the top for comfortable reading
    if (lastMessageRef.current) {
      try {
        lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      } catch {}
    }
    // Fallback: align sentinel near bottom to top if needed
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      } catch {}
    }
    // Final fallback: scroll container to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, []);

  // Personalized rotating slogan for new chat
  const displayName = useMemo(() => {
    const metaName = (user as any)?.user_metadata?.name;
    if (typeof metaName === 'string' && metaName.trim()) {
      return metaName.trim().split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'there';
  }, [user]);

  const baseSlogans = useMemo(
    () => [
      "What’s on the agenda today?",
      "Ready when you are.",
      "Where should we begin?",
      "What are you working on?",
    ],
    []
  );

  const slogans = useMemo(
    () => [...baseSlogans, `How can I help, ${displayName}?`],
    [baseSlogans, displayName]
  );

  const [slogan] = useState<string>(() => slogans[Math.floor(Math.random() * slogans.length)]);

  const shareMessage = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Assistant Response',
          text: text,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to copying to clipboard
      copyToClipboard(text, 'share-fallback');
    }
  };

  const shareChat = () => {
    if (!currentChatId || !currentChat) return;
    setShareOpen(true);
  };

  const deleteChat = async () => {
    if (!currentChatId) return;
    
    if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      try {
        // TODO: Implement actual delete API call
        console.log('Deleting chat:', currentChatId);
        navigate('/');
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSending || !session) return;

    const messageText = input.trim();
    setInput('');
    if (!docked) setDocked(true);
    setIsSending(true);
    lastUserInputRef.current = messageText;

    try {
      // Use streaming endpoint; pass sessionId when available
      await sendStreamMessage(messageText, currentChatId || undefined);
      // Ensure viewport follows the streaming response
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    navigate('/chat');
    setInput('');
    setIsNewChat(true);
    setDocked(false);
    clearStreamMessages();
  };

  // Helper: derive a short, meaningful title from text
  const deriveTitle = useCallback((text: string | undefined) => {
    const src = (text || '').trim();
    if (!src) return 'Untitled Chat';
    return src.replace(/\s+/g, ' ').slice(0, 48);
  }, []);

  // When backend creates a new session during streaming, navigate and set a better title
  useEffect(() => {
    if (sessionId && isNewChat) {
      navigate(`/chat/${sessionId}`, { replace: true });
      setIsNewChat(false);
      try {
        const nowIso = new Date().toISOString();
        const inferredTitle = deriveTitle(lastUserInputRef.current);
        // Optimistically update recent cache with derived title
        const { updateCachedChat } = require('@/lib/localStorageUtils');
        updateCachedChat({
          id: sessionId,
          title: inferredTitle,
          last_message_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          last_message: lastUserInputRef.current,
          unread_count: 0,
        });
        // Persist title server-side
        chatsService.updateChatSession(sessionId, { title: inferredTitle }).catch(() => {});
      } catch {}
    }
  }, [sessionId, isNewChat, navigate, deriveTitle]);

  return (
    <div 
      className="flex flex-col h-screen bg-[#fff] dark:bg-[#212121]"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <h1 className="text-lg ml-4 text-gray-800 dark:text-gray-100">
            {!isNewChat && (currentChat?.title || 'Untitled Chat')}
          </h1>
        </div>
        
        {/* Right side buttons - only show for existing chats */}
        {!isNewChat && currentChat && (
          <div className="flex items-center space-x-2">
            {/* Share button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={shareChat}
              className="h-9 px-3 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center space-x-2"
              title="Share chat"
            >
              <Share2 className="h-5 w-5" />
              <span className="text-sm">Share</span>
            </Button>
            
            {/* 3-dot dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="More options"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <DropdownMenuItem 
                  onClick={deleteChat}
                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Top spacer to vertically center input before first send */}
      <div className={`transition-[height] duration-300 ease-out ${docked ? 'h-0' : 'h-1/2'}`} />

      {/* Messages Area (expands only after docking) */}
      <div 
        ref={chatContainerRef}
        className={`transition-[height] duration-300 ease-out ${docked 
          ? 'flex-1 overflow-y-auto pb-40 custom-scrollbar scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent' 
          : 'h-0 overflow-y-hidden pb-0'} px-4 relative flex flex-col-reverse`}
      >
        {/* Overlay for better text readability when background image is present */}
        {backgroundImage && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 pointer-events-none" />
        )}
        <div className="max-w-3xl mx-auto py-6 space-y-6 relative z-10">
          {/* Error message (hide for new chat state) */}
          {error && !isNewChat && (
            <div className="flex justify-center py-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}
          

          
          <>
            <AnimatePresence>
              {displayMessages.map((message, index) => (
                <motion.div
                  key={message.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  ref={index === displayMessages.length - 1 ? lastMessageRef : undefined}
                >
                  {message.role === "user" ? (
                    // User message - right-aligned with hover copy button
                    <div className="max-w-[85%] group">
                      <div className="relative">
                        <div className="bg-blue-400 text-white rounded-3xl px-4 py-3 shadow-sm">
                          <p className="text-lg leading-relaxed whitespace-pre-wrap break-all" style={{ hyphens: 'auto', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {toDisplayString((message as any).content)}
                          </p>
                        </div>  
                        {/* Hover copy button for user messages */}
                        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => copyToClipboard(toDisplayString((message as any).content), message.id || '')}
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
                    // Assistant message - left-aligned; show copy/share only after streaming completes
                    <div className="max-w-[98%]">
                      <div className="py-2">
                        <p className="text-lg leading-relaxed whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200" style={{ hyphens: 'auto', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          {toDisplayString((message as any).content)}
                        </p>
                        {/* Copy and share appear only when the AI response is complete */}
                        {!(message as any)?.isStreaming && (message as any)?.type !== 'error' && !!toDisplayString((message as any).content)?.trim() && (
                          <div className="flex items-center space-x-2 mt-3">
                            <div className="relative group">
                              <button
                                onClick={() => copyToClipboard(toDisplayString((message as any).content), message.id || '')}
                                className="flex items-center px-2 py-1 rounded-md border border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                )}
                              </button>
                              {/* Tooltip */}
                              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                Copy
                              </span>
                            </div>
                            <div className="relative group">
                              <button
                                onClick={() => shareMessage(toDisplayString((message as any).content))}
                                className="flex items-center px-2 py-1 rounded-md border border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                              >
                                <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                              </button>
                              {/* Tooltip */}
                              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                Share
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Show loading indicator whenever sending/streaming, even with empty history */}
            {(isSending || streamingState?.isStreaming) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%]">
                  <div className="py-2">
                    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800/50 rounded-3xl px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-gray-500">Thinking...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Minimal spacer when no messages and not streaming */}
            {displayMessages.length === 0 && !(isSending || streamingState?.isStreaming) && (
              <div className="pt-4" />
            )}
          </>
          <div ref={messagesEndRef} className="scroll-mb-40" aria-hidden="true" />
        </div>
      </div>

      {/* Input Box: centered initially; sticky at bottom after first send */}
      <div className={`transition-all duration-300 ease-out ${docked ? 'sticky bottom-0 z-20 backdrop-blur-sm' : ''}`}>
        {isNewChat && (
          <div className="max-w-3xl mx-auto px-2 mb-9">
            <p className="text-center text-gray-700 dark:text-gray-200 text-2xl md:text-3xl ">{slogan}</p>
          </div>
        )}
        <div className="max-w-3xl mx-auto p-3 border border-gray-300 dark:border-gray-700/50 rounded-[32px] shadow-md bg-gray-100 dark:bg-[#303030]">
          {(isLoading || isSending || streamingState?.isStreaming) && (
            <ChatLoadingIndicator className="mb-2" />
          )}
          <form onSubmit={handleSend} className="relative flex items-end space-x-3">
            {/* "+" button with dropdown menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Add files and more"
              >
                <span className="text-gray-600 dark:text-gray-300 text-3xl">+</span>
              </button>

              {/* Dropdown menu */}
              <div
                className={`absolute bottom-12 left-0 w-52 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transform transition-all duration-200 ease-in-out ${
                  showMenu ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
                }`}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  📎 Add photos & files
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  🎨 Create Image
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Need help? Ask away…"
                className="w-full bg-gray-100 dark:bg-[#303030] custom-scrollbar pr-2 border-none outline-none resize-none rounded-3xl px-2 py-2 text-l leading-6 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-h-[6px] max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent "
                rows={1}
              />
              
              {/* Blur overlay for long text */}
              {textareaRef.current && textareaRef.current.scrollHeight > 80 && (
                <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-gray-100 dark:from-gray-800 to-transparent rounded-t-2xl"></div>
              )}
            </div>
            
            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className={`w-10 h-10 rounded-full p-0 flex items-center justify-center transition-all duration-200 ${
                input.trim()
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md"
                  : "bg-gray-300 dark:bg-[#303030] text-gray-400 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom spacer collapses after docking */}
      <div className={`transition-[height] duration-300 ease-out ${docked ? 'h-0' : 'h-1/2'}`} />

      {/* Share Modal */}
      {!isNewChat && currentChatId && (
        <ShareChatModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          chatId={currentChatId}
          chatTitle={currentChat?.title}
          messages={messages as any}
        />
      )}
    </div>
  );
}