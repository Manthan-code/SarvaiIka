import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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
  User: () => <div data-testid="user-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}));

// Mock UI components
jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../src/components/ui/input', () => ({
  Input: ({ onChange, ...props }: any) => (
    <input onChange={onChange} data-testid="input" {...props} />
  ),
}));

jest.mock('../../src/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('../../src/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div data-testid="card-description" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h1 data-testid="card-title" {...props}>{children}</h1>,
}));

jest.mock('../../src/components/ui/separator', () => ({
  Separator: (props: any) => <hr data-testid="separator" {...props} />,
}));

jest.mock('../../src/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div data-testid="alert-description" {...props}>{children}</div>,
}));

// Mock auth components
jest.mock('../../src/components/auth/GoogleOAuthButton', () => ({
  GoogleOAuthButton: () => <button data-testid="google-oauth-button">Sign up with Google</button>,
}));

jest.mock('../../src/components/auth/GitHubOAuthButton', () => ({
  GitHubOAuthButton: () => <button data-testid="github-oauth-button">Sign up with GitHub</button>,
}));

jest.mock('../../src/components/auth/MicrosoftOAuthButton', () => ({
  MicrosoftOAuthButton: () => <button data-testid="microsoft-oauth-button">Sign up with Microsoft</button>,
}));

// Mock auth store
const mockUseAuthStore = {
  session: null,
  user: null,
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore,
}));

// Mock supabase client (import the same mock file used by moduleNameMapper)
import mockSupabase from '../__mocks__/supabaseClient.ts';

// Import Signup AFTER mocks are defined so it uses mocked modules
import Signup from '../../src/pages/Signup';

const renderSignup = () => {
  return render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );
};

describe('Signup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.session = null;
    mockUseAuthStore.user = null;
    // Reset the mock to default implementation
    mockSupabase.auth.signUp.mockReset();
  });

  it('renders without crashing', () => {
    renderSignup();
    expect(screen.getByTestId('card-title')).toHaveTextContent('Create Account');
  });

  it('displays the signup form elements', () => {
    renderSignup();
    
    expect(screen.getByTestId('card-title')).toHaveTextContent('Create Account');
    expect(screen.getByText('Sign up to get started with your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays OAuth buttons', () => {
    renderSignup();
    
    expect(screen.getByTestId('google-oauth-button')).toBeInTheDocument();
    expect(screen.getByTestId('github-oauth-button')).toBeInTheDocument();
    expect(screen.getByTestId('microsoft-oauth-button')).toBeInTheDocument();
  });

  it('displays login link', () => {
    renderSignup();
    
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('displays password requirements', () => {
    renderSignup();
    
    expect(screen.getByText('Must be at least 8 characters with uppercase, lowercase, and number')).toBeInTheDocument();
  });

  it('handles name input changes', () => {
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    expect(nameInput).toHaveValue('John Doe');
  });

  it('handles email input changes', () => {
    renderSignup();
    const emailInput = screen.getByPlaceholderText('Enter your email');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('handles password input changes', () => {
    renderSignup();
    const passwordInput = screen.getByPlaceholderText('Create a password');
    
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    expect(passwordInput).toHaveValue('Password123');
  });

  it('toggles password visibility', () => {
    renderSignup();
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const toggleButton = screen.getByTestId('eye-icon').closest('button');
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required fields on form submission', async () => {
    renderSignup();
    const form = screen.getByRole('form');
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('validates name length', async () => {
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const form = screen.getByRole('form') || document.querySelector('form');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'A' } });
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    renderSignup();
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const form = screen.getByRole('form') || document.querySelector('form');
    
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('validates password length', async () => {
    renderSignup();
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form') || document.querySelector('form');
    
    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('validates password complexity', async () => {
    renderSignup();
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form') || document.querySelector('form');
    
    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one uppercase letter, one lowercase letter, and one number')).toBeInTheDocument();
    });
  });

  it('clears field errors when user starts typing', async () => {
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const form = screen.getByRole('form') || document.querySelector('form');
    
    // Trigger validation error
    await act(async () => {
      fireEvent.submit(form!);
    });
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
    });
    
    // Start typing to clear error
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    });
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
  });

  it('handles successful signup with email confirmation', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: '1' }, session: null },
      error: null,
    });
    
    renderSignup();
    const nameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const form = screen.getByRole('form');
    
    // Debug: Check initial values
    console.log('Initial values:', {
      name: nameInput.value,
      email: emailInput.value,
      password: passwordInput.value
    });
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    });
    
    // Debug: Check values after change
    console.log('After change:', {
      name: nameInput.value,
      email: emailInput.value,
      password: passwordInput.value
    });
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    // Debug: Check if signUp was called
    console.log('signUp call count:', mockSupabase.auth.signUp.mock.calls.length);
    console.log('signUp calls:', mockSupabase.auth.signUp.mock.calls);
    
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123',
      options: {
        data: {
          name: 'John Doe',
          full_name: 'John Doe',
        },
      },
    });

    // Should show success screen
    await waitFor(() => {
      expect(screen.getByText('Check Your Email')).toBeInTheDocument();
      expect(screen.getByText('Verification email sent. Please verify before logging in.')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('handles successful signup with auto-confirmation', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: '1' }, session: { access_token: 'token' } },
      error: null,
    });
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    });
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles signup error - email already exists', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    });
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
    });
  });

  it('handles generic signup error', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'Some other error' },
    });
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    });
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Some other error')).toBeInTheDocument();
    });
  });

  it('handles network error', async () => {
    // Mock the signUp to reject with an error
    mockSupabase.auth.signUp.mockRejectedValue(new Error('Network error'));
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    });
    
    await act(async () => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows loading state during form submission', async () => {
    mockSupabase.auth.signUp.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({ 
          data: { user: { id: '1', email: 'test@example.com' }, session: null }, 
          error: null 
        }), 100)
      )
    );
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const form = screen.getByRole('form');
    const submitButton = screen.getByRole('button', { name: /create account/i });
    
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    
    fireEvent.submit(form!);
    
    // Check loading state immediately
    expect(screen.getByText('Creating Account...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('redirects authenticated users to dashboard', () => {
    mockUseAuthStore.session = { access_token: 'token' };
    mockUseAuthStore.user = { id: '1', email: 'test@example.com' };
    
    renderSignup();
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('displays return to login link on success screen', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: '1' }, session: null },
      error: null,
    });
    
    renderSignup();
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Create a password');
    const submitButton = screen.getByRole('button', { name: /create account/i });
    
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Return to Login')).toBeInTheDocument();
    });
  });
});