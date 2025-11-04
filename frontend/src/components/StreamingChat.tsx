import React, { useEffect, useRef } from 'react';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Loader2, Send, Zap } from 'lucide-react';

const StreamingChat: React.FC = () => {
  const { messages, streamingState, sendMessage } = useStreamingChat();
  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streamingState.isStreaming) return;
    
    const message = input;
    setInput('');
    await sendMessage(message);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header with model info */}
      <div className="border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Chat</h2>
        {streamingState.currentModel && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {streamingState.currentModel}
          </Badge>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {message.type === 'image' ? (
                <img 
                  src={message.content} 
                  alt="Generated image" 
                  className="max-w-full rounded"
                />
              ) : (
                <div className="whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-5 bg-current ml-1 animate-pulse" />
                  )}
                </div>
              )}
              
              {message.model && (
                <div className="text-xs opacity-70 mt-1">
                  {message.model}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {streamingState.isStreaming && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {streamingState.currentModel ? `${streamingState.currentModel} is thinking...` : 'Processing...'}
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={streamingState.isStreaming}
          className="flex-1"
        />
        <Button 
          type="submit" 
          disabled={!input.trim() || streamingState.isStreaming}
          size="icon"
        >
          {streamingState.isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
      
      {streamingState.error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 m-4 rounded">
          {streamingState.error}
        </div>
      )}
    </div>
  );
};

export default StreamingChat;