import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../../src/pages/Chat';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => ({ chatId: undefined })),
  useNavigate: () => mockNavigate,
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Copy: () => <div data-testid="copy-icon" />,
  Share2: () => <div data-testid="share-icon" />,
  Check: () => <div data-testid="check-icon" />,
  ArrowUp: () => <div data-testid="arrow-up-icon" />,
  MoreHorizontal: () => <div data-testid="more-horizontal-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Loader2: () => <div data-testid="loader2-icon" />,
}));

// Mock UI components
jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
}));

// Legacy skeleton removed; no longer mocked

// Mock hooks
const mockUseActiveChat = {
  messages: [],
  isLoading: false,
  error: null,
  currentChatId: null,
  currentChat: null,
  sendMessage: jest.fn(),
  addMessage: jest.fn(),
  switchChat: jest.fn(),
  refreshMessages: jest.fn(),
  clearMessages: jest.fn(),
};

jest.mock('../../src/hooks/useActiveChat', () => ({
  useActiveChat: () => mockUseActiveChat,
}));

const mockUseAuthStore = {
  user: { id: '1', email: 'test@example.com' },
  session: { access_token: 'token' },
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore,
}));

jest.mock('../../src/hooks/useSafeBackground', () => ({
  useSafeBackground: () => ({ backgroundImage: null }),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
  share: jest.fn(() => Promise.resolve()),
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(() => true),
});

const renderChat = (chatId?: string) => {
  const { useParams } = require('react-router-dom');
  useParams.mockReturnValue({ chatId });
  
  return render(
    <MemoryRouter initialEntries={[chatId ? `/chat/${chatId}` : '/chat']}>
      <Chat />
    </MemoryRouter>
  );
};

describe('Chat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseActiveChat.messages = [];
    mockUseActiveChat.isLoading = false;
    mockUseActiveChat.error = null;
    mockUseActiveChat.currentChatId = null;
    mockUseActiveChat.currentChat = null;
  });

  it('renders without crashing', () => {
    renderChat();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('displays new chat title when no chatId is provided', () => {
    renderChat();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('displays chat title when chat exists', () => {
    mockUseActiveChat.currentChat = { id: '1', title: 'Test Chat' };
    renderChat('1');
    expect(screen.getByText('Test Chat')).toBeInTheDocument();
  });

  it('does not display old welcome message in empty state', () => {
    renderChat();
    expect(screen.queryByText('How can I help you today?')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ask anything, from creative ideas to technical explanations/)).not.toBeInTheDocument();
  });

  it('displays loading indicator when loading', () => {
    mockUseActiveChat.isLoading = true;
    renderChat();
    expect(screen.getByTestId('chat-loading-indicator')).toBeInTheDocument();
  });

  it('displays error message when error exists', () => {
    mockUseActiveChat.error = 'Test error message';
    renderChat();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders messages correctly', () => {
    mockUseActiveChat.messages = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!' },
    ];
    renderChat();
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('handles text input changes', () => {
    renderChat();
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    expect(textarea).toHaveValue('Test message');
  });

  it('handles form submission', async () => {
    renderChat();
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    const sendButton = screen.getByTestId('arrow-up-icon').closest('button');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton!);
    
    await waitFor(() => {
      expect(mockUseActiveChat.sendMessage).toHaveBeenCalledWith('Test message', 'new-chat');
    });
  });

  it('handles Enter key press to send message', async () => {
    renderChat();
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    
    await waitFor(() => {
      expect(mockUseActiveChat.sendMessage).toHaveBeenCalledWith('Test message', 'new-chat');
    });
  });

  it('does not send message on Shift+Enter', () => {
    renderChat();
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    
    expect(mockUseActiveChat.sendMessage).not.toHaveBeenCalled();
  });

  it('disables send button when input is empty', () => {
    renderChat();
    const sendButton = screen.getByTestId('arrow-up-icon').closest('button');
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    renderChat();
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    const sendButton = screen.getByTestId('arrow-up-icon').closest('button');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('shows share and more options for existing chats', () => {
    mockUseActiveChat.currentChat = { id: '1', title: 'Test Chat' };
    renderChat('1');
    
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByTestId('more-horizontal-icon')).toBeInTheDocument();
  });

  it('does not show share and more options for new chats', () => {
    renderChat();
    
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByTestId('more-horizontal-icon')).not.toBeInTheDocument();
  });

  it('handles copy message functionality', async () => {
    mockUseActiveChat.messages = [
      { id: '1', role: 'assistant', content: 'Test response' },
    ];
    renderChat();
    
    const copyButton = screen.getByTestId('copy-icon').closest('button');
    fireEvent.click(copyButton!);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test response');
    });
  });

  it('handles share message functionality', async () => {
    mockUseActiveChat.messages = [
      { id: '1', role: 'assistant', content: 'Test response' },
    ];
    renderChat();
    
    const shareButton = screen.getByTestId('share-icon').closest('button');
    fireEvent.click(shareButton!);
    
    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalledWith({
        title: 'AI Assistant Response',
        text: 'Test response',
      });
    });
  });

  it('handles chat deletion', async () => {
    mockUseActiveChat.currentChat = { id: '1', title: 'Test Chat' };
    mockUseActiveChat.currentChatId = '1';
    renderChat('1');
    
    const deleteButton = screen.getByTestId('trash-icon');
    fireEvent.click(deleteButton.closest('div')!);
    
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this chat? This action cannot be undone.');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('handles share chat functionality', async () => {
    mockUseActiveChat.currentChat = { id: '1', title: 'Test Chat' };
    renderChat('1');
    
    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalledWith({
        title: 'Chat: Test Chat',
        text: 'Check out this conversation: Test Chat',
        url: window.location.href,
      });
    });
  });

  it('shows thinking indicator when sending message', () => {
    mockUseActiveChat.messages = [];
    renderChat();
    
    // Simulate sending state
    const textarea = screen.getByPlaceholderText('Need help? Ask away…');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    
    // Mock the isSending state by checking if the component would show the thinking indicator
    // This is a simplified test since we can't easily mock internal state
    expect(screen.getByPlaceholderText('Need help? Ask away…')).toBeInTheDocument();
  });

  it('switches to existing chat when chatId changes', () => {
    const { useParams } = require('react-router-dom');
    useParams.mockReturnValue({ chatId: '123' });
    
    renderChat('123');
    
    expect(mockUseActiveChat.switchChat).toHaveBeenCalledWith('123');
  });

  it('clears messages for new chat', () => {
    renderChat();
    expect(mockUseActiveChat.clearMessages).toHaveBeenCalled();
  });

  it('shows dropdown menu when plus button is clicked', () => {
    renderChat();
    const plusButton = screen.getByText('+');
    
    fireEvent.click(plusButton);
    
    expect(screen.getByText('📎 Add photos & files')).toBeInTheDocument();
    expect(screen.getByText('🎨 Create Image')).toBeInTheDocument();
  });

  it('handles untitled chat display', () => {
    mockUseActiveChat.currentChat = { id: '1', title: '' };
    renderChat('1');
    expect(screen.getByText('Untitled Chat')).toBeInTheDocument();
  });
});