import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../src/pages/Login';
import { useAuthStore } from '../../src/stores/authStore';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Mail: () => <div data-testid="mail-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
}));

// Mock only the UI components that are causing issues
// Remove most mocks to use actual components
jest.mock('../../src/components/ui/alert', () => ({
  Alert: ({ children, variant, ...props }: any) => <div data-testid="alert" data-variant={variant} {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div data-testid="alert-description" {...props}>{children}</div>,
}));

// Mock auth components
jest.mock('../../src/components/auth', () => ({
  GoogleOAuthButton: () => <button data-testid="google-oauth-button">Sign in with Google</button>,
  GitHubOAuthButton: () => <button data-testid="github-oauth-button">Sign in with GitHub</button>,
  MicrosoftOAuthButton: () => <button data-testid="microsoft-oauth-button">Sign in with Microsoft</button>,
}));

// Mock auth store
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// Mock supabase client
var mockSupabase: any;
jest.mock('../../src/services/supabaseClient', () => {
  mockSupabase = {
    auth: {
      signInWithPassword: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockSupabase,
  };
});

// Mock authRefresh
jest.mock('../../src/lib/authRefresh', () => ({
  authRefreshManager: {
    startMonitoring: jest.fn(),
  },
}));

// Mock errorApiService to avoid import.meta.env issues
jest.mock('../../src/services/errorApiService', () => ({
  errorApiService: {
    reportError: jest.fn(),
  },
}));

// Mock errorHandler to avoid import.meta.env issues
jest.mock('../../src/utils/errorHandler', () => ({
  handleError: jest.fn(),
  normalizeError: jest.fn(),
  createAppError: jest.fn(),
  getUserFriendlyMessage: jest.fn(),
  withErrorHandling: jest.fn(),
  useErrorHandler: jest.fn(),
  ErrorType: {
    NETWORK: 'NETWORK_ERROR',
    AUTHENTICATION: 'AUTH_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    SERVER: 'SERVER_ERROR',
    CLIENT: 'CLIENT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  }
}));

// Mock window.location.search
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

const renderLogin = (search = '') => {
  window.location.search = search;
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    window.location.search = '';
    
    // Reset mock auth store state
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      session: null,
      user: null,
      loading: false,
    });

    // Reset Supabase mock to default successful response
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { full_name: 'Test User' }
        },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token'
        }
      },
      error: null
    });
  });

  it('renders without crashing', () => {
    renderLogin();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('displays the login form elements', () => {
    renderLogin();
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('displays OAuth buttons', () => {
    renderLogin();
    
    expect(screen.getByTestId('google-oauth-button')).toBeInTheDocument();
    expect(screen.getByTestId('github-oauth-button')).toBeInTheDocument();
    expect(screen.getByTestId('microsoft-oauth-button')).toBeInTheDocument();
  });

  it('displays signup link', () => {
    renderLogin();
    
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('handles email input changes', () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('Enter your email');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('handles password input changes', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(passwordInput).toHaveValue('password123');
  });

  it('toggles password visibility', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const toggleButton = screen.getByTestId('eye-icon').closest('button');
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required fields on form submission', async () => {
    renderLogin();
    
    // Submit the form directly instead of clicking the button
    const form = document.querySelector('form');
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('Enter your email');
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    // Submit the form directly instead of clicking the button
    const form = document.querySelector('form');
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('clears field errors when user starts typing', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('Enter your email');
    
    // Trigger validation error by submitting the form
    const form = document.querySelector('form');
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
    
    // Start typing to clear error
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  it('shows loading state during login', async () => {
    renderLogin();
    
    // Mock Supabase signInWithPassword to return a delayed promise (after render to avoid beforeEach clearing)
    const mockLogin = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    mockSupabase.auth.signInWithPassword = mockLogin;
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    
    // Fill in valid data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Submit the form
    const form = document.querySelector('form');
    
    // Wrap the form submission in act()
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    // Check that loading state is shown
    await waitFor(() => {
      expect(screen.getByText('Signing In...')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles login error - invalid credentials', async () => {
    const user = userEvent.setup();
    
    // Mock Supabase signInWithPassword to return an error BEFORE rendering
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' }
    });
    

    
    renderLogin();
    
    // Fill in the form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    
    // Submit the form by clicking the submit button (not OAuth buttons)
    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    
    // Wrap the form submission and state updates in act()
    await act(async () => {
      await user.click(submitButton);
    });

    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify that signInWithPassword was called with correct credentials
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'wrongpassword'
    });
  });

  it('handles login error - email not confirmed', async () => {
    // Mock Supabase signInWithPassword to return an error BEFORE rendering
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Email not confirmed' },
    });

    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const form = document.querySelector('form');
    
    // Wrap the form submission in act()
    await act(async () => {
      fireEvent.submit(form!);
    });

    await waitFor(() => {
      expect(screen.getByText(/please verify your email address before logging in\. check your inbox for a verification link\./i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles generic login error', async () => {
    // Mock Supabase signInWithPassword to return an error BEFORE rendering
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Something went wrong' },
    });

    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const form = document.querySelector('form');
    
    // Wrap the form submission in act()
    await act(async () => {
      fireEvent.submit(form!);
    });

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles network error', async () => {
    mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

    const { getByLabelText } = renderLogin();

    fireEvent.change(getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(getByLabelText(/password/i), { target: { value: 'password123' } });

    const form = document.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/an unexpected error occurred\. please try again\./i)).toBeInTheDocument();
    });
  });

  it('shows loading state during form submission', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockSupabase.auth.signInWithPassword.mockReturnValue(promise);

    const { getByLabelText } = renderLogin();

    fireEvent.change(getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(getByLabelText(/password/i), { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /^sign in$/i });
    const form = document.querySelector('form');
    fireEvent.submit(form!);

    // Check loading state
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Resolve the promise
    resolvePromise!({
      data: { user: { id: '123', email: 'test@example.com' } },
      error: null,
    });

    await waitFor(() => {
      expect(screen.queryByText(/signing in/i)).not.toBeInTheDocument();
    });
  });

  it('redirects authenticated users to dashboard', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      session: { access_token: 'token' },
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    });
    
    renderLogin();
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects authenticated users to return URL when provided', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      session: { access_token: 'token' },
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    });
    
    renderLogin('?returnUrl=%2Fchat');
    
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

  it('does not redirect when auth is loading', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      session: { access_token: 'token' },
      user: { id: '1', email: 'test@example.com' },
      loading: true,
    });
    
    renderLogin();
    
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});