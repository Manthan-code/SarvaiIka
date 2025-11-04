import { useState, useEffect } from "react";
import { Search, MessageCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import chatsService from "@/services/chatsService";
import { getCachedRecentChats, setCachedRecentChats } from "@/lib/localStorageUtils";

interface Chat {
  id: string;
  title: string;
  timestamp: string;
  lastMessage?: string;
}

interface SearchChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchChatModal({ open, onOpenChange }: SearchChatModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch chats when modal opens
  useEffect(() => {
    if (open) {
      fetchChats();
    }
  }, [open]);

  // Filter chats based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats]);

  const fetchChats = async () => {
    try {
      setIsLoading(true);
      
      // First, load from localStorage for instant UI
      const cachedChats = getCachedRecentChats();
      if (cachedChats && cachedChats.length > 0) {
        const transformedCachedChats = cachedChats.map(chat => ({
          id: chat.id,
          title: chat.title || 'Untitled Chat',
          timestamp: formatTimestamp(chat.last_message_at || chat.created_at),
          lastMessage: chat.last_message || undefined
        }));
        setChats(transformedCachedChats);
        setIsLoading(false);
      }
      
      // Then sync with database in background
      const response = await chatsService.getChatSessions({ 
        limit: 50, // Get more chats for search
        _t: Date.now() 
      });
      
      let chatsData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          chatsData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          chatsData = response.data.data;
        }
      }
      
      // Update cache with fresh data
      if (chatsData.length > 0) {
        setCachedRecentChats(chatsData);
      }
      
      const transformedChats = chatsData.map(chat => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        timestamp: formatTimestamp(chat.last_message_at || chat.created_at),
        lastMessage: chat.last_message || undefined
      }));
      
      setChats(transformedChats);
    } catch (error) {
      console.error('Failed to fetch chats for search:', error);
      // If API fails but we have cached data, keep using cached data
      const cachedChats = getCachedRecentChats();
      if (cachedChats && cachedChats.length > 0 && chats.length === 0) {
        const transformedCachedChats = cachedChats.map(chat => ({
          id: chat.id,
          title: chat.title || 'Untitled Chat',
          timestamp: formatTimestamp(chat.last_message_at || chat.created_at),
          lastMessage: chat.last_message || undefined
        }));
        setChats(transformedCachedChats);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const handleChatClick = () => {
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col bg-white dark:bg-[#2f2f2f] text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-transparent border-none shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-none focus-visible:border-none focus-visible:ring-offset-0 focus:ring-offset-0 focus:shadow-none focus-visible:shadow-none"
              autoFocus
            />
          </div>
          {/* Divider between search input and recent chats */}
          <div className="border-t border-border/60" />
          
          {/* Results */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 rounded-md bg-muted/30 transition-colors duration-150 ease-out">
                    <div className="w-6 h-6 bg-muted rounded-full animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded animate-pulse w-3/4"></div>
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length > 0 ? (
              <div className="space-y-2">
                {filteredChats.map((chat) => (
                  <NavLink
                    key={chat.id}
                    to={`/chat/${chat.id}`}
                    onClick={handleChatClick}
                    className="group flex items-center space-x-3 p-2.5 rounded-md hover:bg-muted/40 transition-colors duration-150 ease-out"
                  >
                    <div className="h-6 px-2 rounded-2xl bg-transparent flex items-center justify-center flex-shrink-0 transition-colors">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{chat.title}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {chat.timestamp}
                        </span>
                      </div>
                      {chat.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                  </NavLink>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {searchQuery ? 'No chats found' : 'No conversations yet'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Start a new chat to begin'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}