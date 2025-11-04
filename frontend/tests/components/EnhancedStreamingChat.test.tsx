import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import EnhancedStreamingChat from '../../src/components/EnhancedStreamingChat';

// Mock all dependencies
jest.mock('../../src/hooks/useEnhancedStreamingChat', () => ({
  useEnhancedStreamingChat: jest.fn(() => ({
    messages: [],
    streamingState: {
      isStreaming: false,
      currentModel: null,
      error: null,
      stage: 'idle',
      progress: 0
    },
    metrics: {
      totalMessages: 0,
      averageResponseTime: 0,
      successRate: 100,
      totalTokens: 0,
      preferredModels: {}
    },
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    cancelStreaming: jest.fn(),
    clearCache: jest.fn(),
    cacheSize: 0,
    retryCount: 0,
    exportMessages: jest.fn(),
    importMessages: jest.fn()
  }))
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button'
  },
  AnimatePresence: ({ children }: { children: any }) => children
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('EnhancedStreamingChat', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EnhancedStreamingChat />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays the chat interface', () => {
    renderWithRouter(<EnhancedStreamingChat />);
    
    // Check for basic elements
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });
});