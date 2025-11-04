import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StreamingChat from '../../src/components/StreamingChat';

// Mock UI components used by StreamingChat
jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, size, className }: any) => (
    <button type={type} disabled={disabled} onClick={onClick} data-size={size} className={className}>
      {children}
    </button>
  )
}));

jest.mock('../../src/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, disabled, className }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className={className} />
  )
}));

jest.mock('../../src/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>
}));

jest.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader2" />, 
  Send: () => <span data-testid="send-icon" />, 
  Zap: () => <span data-testid="zap-icon" />
}));

// Mock useStreamingChat hook with an exposed setter to control state per test
jest.mock('../../src/hooks/useStreamingChat', () => {
  const defaultState: any = {
    messages: [],
    streamingState: {
      isStreaming: false,
      currentModel: 'mock-model',
      error: null,
      streamingText: ''
    },
    sendMessage: jest.fn(async () => {})
  };
  const useStreamingChat = () => defaultState;
  (useStreamingChat as any).__setState = (next: any) => {
    if (next.messages !== undefined) defaultState.messages = next.messages;
    if (next.streamingState !== undefined) defaultState.streamingState = next.streamingState;
    if (next.sendMessage !== undefined) defaultState.sendMessage = next.sendMessage;
  };
  return { useStreamingChat };
});

describe('StreamingChat component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mod = require('../../src/hooks/useStreamingChat');
    (mod.useStreamingChat as any).__setState({
      messages: [],
      streamingState: {
        isStreaming: false,
        currentModel: 'gpt-4',
        error: null,
        streamingText: ''
      },
      sendMessage: jest.fn(async () => {})
    });
  });

  it('renders header and model badge, shows messages and streaming indicator', () => {
    const mod = require('../../src/hooks/useStreamingChat');
    (mod.useStreamingChat as any).__setState({
      messages: [
        { id: '1', role: 'user', content: 'Hello', type: 'text' },
        { id: '2', role: 'assistant', content: 'Hi there!', type: 'text', model: 'gpt-4' },
      ],
      streamingState: {
        isStreaming: true,
        currentModel: 'gpt-4',
        error: null,
        streamingText: ''
      }
    });

    render(<StreamingChat />);

    // Header
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
    // Model badge and message footer both contain 'gpt-4'
    expect(screen.getAllByText('gpt-4').length).toBeGreaterThanOrEqual(1);

    // Messages rendered
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();

    // Streaming indicator shown
    expect(screen.getAllByTestId('loader2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/is thinking/i)).toBeInTheDocument();
  });

  it('sends a message on submit and disables input while streaming', async () => {
    const mod = require('../../src/hooks/useStreamingChat');
    const sendMessageMock = jest.fn(async () => {});
    (mod.useStreamingChat as any).__setState({
      messages: [],
      streamingState: {
        isStreaming: false,
        currentModel: 'mock-model',
        error: null,
        streamingText: ''
      },
      sendMessage: sendMessageMock
    });

    const { rerender } = render(<StreamingChat />);

    const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Hello AI' } });

    const submit = screen.getByRole('button');
    fireEvent.click(submit);

    expect(sendMessageMock).toHaveBeenCalledWith('Hello AI');

    // Now set streaming to true and ensure input and button are disabled
    (mod.useStreamingChat as any).__setState({
      streamingState: {
        isStreaming: true,
        currentModel: 'mock-model',
        error: null,
        streamingText: ''
      }
    });

    // Re-render to reflect new state
    rerender(<StreamingChat />);

    const disabledInput = screen.getByPlaceholderText('Type your message...');
    const disabledButton = screen.getByRole('button');
    expect(disabledInput).toBeDisabled();
    expect(disabledButton).toBeDisabled();
  });
});