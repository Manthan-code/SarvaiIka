import React, { useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const CenteredChatDemo: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [docked, setDocked] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // Dock input to bottom after first submit
    if (!docked) setDocked(true);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMsg: ChatMessage = { id, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate assistant response
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant',
        content: 'This is a demo response showing messages above the input.'
      };
      setMessages(prev => [...prev, assistantMsg]);
    }, 700);
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Top spacer collapses when docked to move input downward smoothly */}
      <div
        className={`transition-[height] duration-300 ease-out ${docked ? 'h-0' : 'h-1/2'}`}
      />

      {/* Messages area expands naturally above input when docked */}
      <div
        className={`transition-[height] duration-300 ease-out ${docked ? 'flex-1' : 'h-0'} overflow-y-auto px-4`}
      >
        <div className="max-w-3xl mx-auto space-y-4 pb-24">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-2xl px-4 py-3 shadow-sm text-sm md:text-base max-w-[80%] whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input area: centered initially; sticky at bottom after submit */}
      <div
        className={`transition-all duration-300 ease-out ${
          docked
            ? 'sticky bottom-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60'
            : ''
        }`}
      >
        <form onSubmit={handleSubmit} className="px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={docked ? 3 : 4}
                placeholder={docked ? 'Ask something…' : 'Need help? Ask away…'}
                className="w-full resize-none bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!input.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Bottom spacer collapses when docked */}
      <div
        className={`transition-[height] duration-300 ease-out ${docked ? 'h-0' : 'h-1/2'}`}
      />
    </div>
  );
};

export default CenteredChatDemo;