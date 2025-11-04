import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Bot, User } from "lucide-react";

interface ChatMessageSkeletonProps {
  isUser?: boolean;
}

export function ChatMessageSkeleton({ isUser = false }: ChatMessageSkeletonProps) {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex items-start space-x-3 max-w-[80%] ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        
        <Card className={`p-3 ${isUser ? "bg-primary/10 border-primary/20" : "bg-card border-border"}`}>
          <div className="space-y-2">
            <Skeleton className={`h-4 ${isUser ? 'w-32' : 'w-48'}`} />
            <Skeleton className={`h-4 ${isUser ? 'w-24' : 'w-36'}`} />
            {!isUser && <Skeleton className="h-4 w-28" />}
          </div>
          <Skeleton className="h-3 w-16 mt-2" />
        </Card>
      </div>
    </div>
  );
}

export function ChatLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Loading header */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <span className="ml-2 text-sm">Loading chat messages...</span>
        </div>
      </div>
      
      {/* Skeleton messages */}
      <ChatMessageSkeleton isUser={true} />
      <ChatMessageSkeleton isUser={false} />
      <ChatMessageSkeleton isUser={true} />
      <ChatMessageSkeleton isUser={false} />
    </div>
  );
}