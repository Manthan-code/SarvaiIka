import { useState, useEffect, useCallback, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, MoreHorizontal, Trash2, Edit, Share2 } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import chatsService from "@/services/chatsService";
import { useRecentChats, setGlobalRefreshSidebar } from "@/hooks/useRecentChats";
import type { User } from "@supabase/supabase-js";
import { createPortal } from "react-dom";
import ShareChatModal from "@/components/modals/ShareChatModal";

interface Chat {
  id: string;
  title: string;
  last_message_at: string;  // Changed from timestamp
  last_message?: string;    // Changed from lastMessage
  unread_count?: number;    // Changed from unreadCount
}

interface RecentChatsPanelProps {
  collapsed: boolean;
  user: User | null;
}

export function RecentChatsPanel({ collapsed, user }: RecentChatsPanelProps) {
  // Use the new hook instead of manual state management
  const {
    chats,
    isLoading,
    error,
    refreshChats,
    updateChat,
    removeChat
  } = useRecentChats();

  // Add this here (moved up)
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
  // Inline editing state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  // NEW: Delete confirmation modal state
  const [deleteConfirmChat, setDeleteConfirmChat] = useState<{ id: string; title: string } | null>(null);
  // Share modal state
  const [shareModalChat, setShareModalChat] = useState<{ id: string; title: string } | null>(null);

  // Click-away to commit edits
  useEffect(() => {
    if (!editingChatId) return;

    const handler = (e: MouseEvent) => {
      const inputEl = editInputRef.current;
      const target = e.target as Node | null;
      // Commit if clicking outside the input element
      if (inputEl && target && !inputEl.contains(target)) {
        commitInlineEdit();
      }
    };

    // Delay adding to avoid capturing the click that triggered rename
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler, true);
    };
  }, [editingChatId]);

  // Prevent navigation clicks on the editing row (capture-phase)
  useEffect(() => {
    if (!editingChatId) return;
    const preventNav = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href.includes(`/chat/${editingChatId}`)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', preventNav, true);
    return () => {
      document.removeEventListener('click', preventNav, true);
    };
  }, [editingChatId]);
  const navigate = useNavigate();
  const location = useLocation();

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      const el = editInputRef.current;
      const applyFocusAndSelection = () => {
        if (!el) return;
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
        try {
          const len = el.value?.length ?? 0;
          el.setSelectionRange(0, len);
        } catch {
          try { el.select(); } catch {}
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(applyFocusAndSelection));
      const t1 = setTimeout(applyFocusAndSelection, 50);
      const t2 = setTimeout(applyFocusAndSelection, 150);
      const t3 = setTimeout(applyFocusAndSelection, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [editingChatId]);

  // NEW: Escape key closes delete confirmation
  useEffect(() => {
    if (!deleteConfirmChat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirmChat(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteConfirmChat]);

  // Refresh chats when user changes
  useEffect(() => {
    if (user) {
      refreshChats();
    }
  }, [user, refreshChats]);

  // Register global sidebar refresh to allow hooks to trigger instant updates
  useEffect(() => {
    setGlobalRefreshSidebar(() => {
      refreshChats();
    });
    return () => {
      setGlobalRefreshSidebar(() => {});
    };
  }, [refreshChats]);

  // Enhanced click handler with proper state management
  const handleChatClick = (chatId: string, chatTitle: string) => {
    // Debug logging removed to reduce console noise
    /*
    console.log('🔍 [DEBUG] Recent Chat Clicked:', {
      chatId,
      chatTitle,
      timestamp: new Date().toISOString(),
      navigatingTo: `/chat/${chatId}`,
      currentUrl: window.location.pathname
    });
    */
    
    // Add small delay to ensure navigation completes before any state updates
    setTimeout(() => {
      // console.log('🔍 [DEBUG] Chat click handler completed for:', chatId);
    }, 100);
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    const safe = typeof text === 'string' ? text : String(text ?? '');
    if (safe.length <= maxLength) return safe;
    return safe.substring(0, maxLength) + '...';
  };

  // Start inline edit for a specific chat
  const startInlineEdit = (chat: Chat) => {
    // Close the dropdown first
    setOpenMenuChatId(null);
    // Defer entering edit mode so the dropdown can fully unmount and not steal focus
    setTimeout(() => {
      setEditingChatId(chat.id);
      setEditingTitle(chat.title || "");
    }, 30);
  };

  // Commit rename (optimistic update + backend persistence)
  const commitInlineEdit = async () => {
    if (!editingChatId) return;
    const chat = chats.find((c) => c.id === editingChatId);
    if (!chat) {
      setEditingChatId(null);
      setEditingTitle("");
      return;
    }

    const trimmed = editingTitle.trim();
    const previous = chat.title || "";

    // End editing if empty or unchanged
    if (trimmed.length === 0 || trimmed === previous) {
      setEditingChatId(null);
      setEditingTitle("");
      return;
    }

    // Optimistic update
    updateChat({ ...chat, title: trimmed });

    try {
      await chatsService.updateChatSession(chat.id, { title: trimmed });
      // Sync from backend to ensure consistency
      await refreshChats(true);
    } catch (err) {
      console.error('Error renaming chat:', err);
      // Rollback on failure
      updateChat({ ...chat, title: previous });
      alert('Failed to rename chat. Please try again.');
    } finally {
      setEditingChatId(null);
      setEditingTitle("");
    }
  };

  const cancelInlineEdit = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  // NEW: Confirm deletion handler
  const confirmDelete = async () => {
    if (!deleteConfirmChat) return;
    const { id } = deleteConfirmChat;
    try {
      await chatsService.deleteChatSession(id);
    } catch (err) {
      console.warn('Delete API failed or not available, removing locally. Error:', err);
    }
    removeChat(id);
    setOpenMenuChatId(null);
    await refreshChats(true);
    if (location.pathname === `/chat/${id}`) {
      navigate('/');
    }
    setDeleteConfirmChat(null);
  };

  if (isLoading) {
    return (
      <div>
        Loading chats...
      </div>
    );
  }

  if (error) {
    return (
      <div>
        Error loading chats: {error}
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div>
        {collapsed ? "No chats" : "No recent chats"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
  <div className="h-full overflow-y-auto custom-scrollbar px-2 py-2">
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton asChild>
            <div className="relative group/chat !p-0 hover:bg-transparent focus-visible:ring-0">
              
              {/* Chat Row */}
              {editingChatId === chat.id ? (
                <div
                  className={`flex w-full items-center justify-between gap-3 px-2 py-2 rounded-xl transition-all duration-200 group-hover/chat:pr-12 ${openMenuChatId === chat.id ? 'pr-12' : ''}
                     hover:bg-gray-100 dark:hover:bg-[#242424]
                     ${location.pathname === `/chat/${chat.id}` ? "bg-gray-200 dark:bg-[#212121] shadow-sm font-medium" : ""}`}
                  onMouseDown={(e) => {
                    // Prevent any default anchor-like behavior while editing
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {/* Left: Title & Last Message */}
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      {/* Inline edit input */}
                      <input
                        ref={editInputRef}
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onFocus={(e) => {
                          const el = e.currentTarget;
                          try {
                            const len = el.value?.length ?? 0;
                            el.setSelectionRange(0, len);
                          } catch {
                            try { el.select(); } catch {}
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            commitInlineEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            cancelInlineEdit();
                          }
                        }}
                        onClick={(e) => { e.stopPropagation(); }}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                        className="w-full min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-[#2a2a2a] rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {chat.last_message_at && (
                        <span className={`inline-flex items-center text-xs text-gray-400 whitespace-nowrap transition-transform duration-200 group-hover/chat:mr-0.1 ${openMenuChatId === chat.id ? 'mr-0.1' : ''}`}>
                          {formatTimestamp(chat.last_message_at)}
                        </span>
                      )}
                    </div>
                    {chat.last_message && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {truncateText(chat.last_message, 40)}
                      </span>
                    )}
                  </div>

                  {/* Right: Unread Badge */}
                  {chat.unread_count > 0 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full 
                                    bg-gradient-to-r from-blue-500 to-purple-500 text-[11px] text-white 
                                    font-semibold shadow-sm flex-shrink-0">
                      {chat.unread_count}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  to={`/chat/${chat.id}`}
                  onMouseDown={(e) => {
                    // Prevent anchor from grabbing focus or triggering navigation while editing this row
                    if (editingChatId === chat.id) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={(e) => {
                    if (editingChatId === chat.id) {
                      // Prevent navigation while editing
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    handleChatClick(chat.id, chat.title);
                  }}
                  className={({ isActive }) =>
                    `flex w-full items-center justify-between gap-3 px-2 py-2 rounded-xl transition-all duration-200 group-hover/chat:pr-12 ${openMenuChatId === chat.id ? 'pr-12' : ''}
                     hover:bg-gray-100 dark:hover:bg-[#242424]
                     ${isActive ? "bg-gray-200 dark:bg-[#212121] shadow-sm font-medium" : ""}`
                  }
                >
                  {/* Left: Title & Last Message */}
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-medium text-gray-900 dark:text-gray-100 truncate "
                        onMouseDown={(e) => {
                          // Prevent anchor focus and navigation before we enter edit mode
                          const isActiveRow = location.pathname === `/chat/${chat.id}`;
                          if (isActiveRow && editingChatId !== chat.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            startInlineEdit(chat);
                          }
                        }}
                        onDoubleClick={(e) => {
                          // Start inline edit on double-click like desktop file rename
                          e.preventDefault();
                          e.stopPropagation();
                          startInlineEdit(chat);
                        }}
                        onClick={(e) => {
                          // Fallback: if already active, allow single-click to start editing
                          const isActiveRow = location.pathname === `/chat/${chat.id}`;
                          if (isActiveRow && editingChatId !== chat.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            startInlineEdit(chat);
                          }
                        }}
                      >
                        {truncateText(chat.title, 24)}
                      </span>
                      {chat.last_message_at && (
                        <span className={`inline-flex items-center text-xs text-gray-400 whitespace-nowrap transition-transform duration-200 group-hover/chat:mr-0.1 ${openMenuChatId === chat.id ? 'mr-0.1' : ''}`}>
                          {formatTimestamp(chat.last_message_at)}
                        </span>
                      )}
                    </div>
                    {chat.last_message && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {truncateText(chat.last_message, 40)}
                      </span>
                    )}
                  </div>

                  {/* Right: Unread Badge */}
                  {chat.unread_count > 0 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full 
                                    bg-gradient-to-r from-blue-500 to-purple-500 text-[11px] text-white 
                                    font-semibold shadow-sm flex-shrink-0">
                      {chat.unread_count}
                    </div>
                  )}
                </NavLink>
              )}

              {/* 3-dot Options Dropdown */}
              <DropdownMenu
                open={openMenuChatId === chat.id}
                onOpenChange={(open) => setOpenMenuChatId(open ? chat.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    className={`absolute right-2 top-1/2 -translate-y-1/2
                                ${openMenuChatId === chat.id ? 'opacity-100' : 'opacity-0 group-hover/chat:opacity-100'}
                                transition-all duration-100
                                p-2 rounded-full
                                text-white hover:text-white
                                `}
                    aria-label="Open conversation options"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShareModalChat({ id: chat.id, title: chat.title || "" });
                      setOpenMenuChatId(null);
                    }}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Start inline editing immediately so the next click is guarded by editing state
                      startInlineEdit(chat);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Open custom delete confirmation modal
                      setDeleteConfirmChat({ id: chat.id, title: chat.title || "" });
                      // Close the dropdown menu after opening modal
                      setOpenMenuChatId(null);
                    }}
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </div>

  {/* Delete Confirmation Modal */}
  {deleteConfirmChat && createPortal(
    <div className="fixed inset-0 z-[1000]" onClick={() => setDeleteConfirmChat(null)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative z-[1001] flex min-h-full items-center justify-center p-4">
        <div className="w-[90%] max-w-md rounded-xl bg-white dark:bg-[#1f1f1f] shadow-lg border border-gray-200 dark:border-gray-700 p-5" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Chat?</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
            This will delete '{deleteConfirmChat.title}'
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
            be sure the deleted chat can't be restore in future we do not hold deleted data
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
              onClick={() => setDeleteConfirmChat(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}

  {/* Share Chat Modal */}
  {shareModalChat && (
    <ShareChatModal
      open={!!shareModalChat}
      onOpenChange={(open) => {
        if (!open) setShareModalChat(null);
      }}
      chatId={shareModalChat.id}
      chatTitle={shareModalChat.title}
    />
  )}
</div>

  );
}