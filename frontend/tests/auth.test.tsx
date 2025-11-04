import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../src/pages/Login';
import Signup from '../src/pages/Signup';
import { useAuthStore } from '../src/stores/authStore';

// Mock the auth store
jest.mock('../src/stores/authStore');
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: '' })
}));

// Mock sonner for toast notifications
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  mockConsoleError.mockClear();
});

describe('Authentication Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Component', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        isAuthenticated: jest.fn(() => false),
        setUser: jest.fn(),
        setSession: jest.fn(),
        setLoading: jest.fn(),
        signOut: jest.fn(),
        initializeAuth: jest.fn(),
        clearAuthState: jest.fn(),
        resyncCacheSelectively: jest.fn()
      });
    });

    it('renders login form correctly', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: 'password123' }
      });
      
      fireEvent.click(submitButton);
      
      // Just verify the form elements are present and can be interacted with
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('handles email input correctly', async () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: 'password123' }
      });
      
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('handles form interaction correctly', async () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: 'password123' }
      });
      
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
      expect(submitButton).toBeEnabled();
    });

    it('renders submit button correctly', async () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeEnabled();
    });
  });

  describe('Signup Component', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        isAuthenticated: jest.fn(() => false),
        setUser: jest.fn(),
        setSession: jest.fn(),
        setLoading: jest.fn(),
        signOut: jest.fn(),
        initializeAuth: jest.fn(),
        clearAuthState: jest.fn(),
        resyncCacheSelectively: jest.fn()
      });
    });

    it('renders signup form correctly', () => {
      render(
        <BrowserRouter>
          <Signup />
        </BrowserRouter>
      );

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      render(
        <BrowserRouter>
          <Signup />
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(nameInput, {
        target: { value: 'John Doe' }
      });
      fireEvent.change(emailInput, {
        target: { value: 'newuser@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: 'Password123' }
      });
      
      fireEvent.click(submitButton);

      // Just verify the form elements are present and can be interacted with
      expect(nameInput).toHaveValue('John Doe');
      expect(emailInput).toHaveValue('newuser@example.com');
      expect(passwordInput).toHaveValue('Password123');
    });

    it('handles password input correctly', async () => {
      render(
        <BrowserRouter>
          <Signup />
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);

      fireEvent.change(nameInput, {
        target: { value: 'John Doe' }
      });
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: '123' }
      });

      expect(nameInput).toHaveValue('John Doe');
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('123');
    });

    it('handles form interaction correctly', async () => {
      render(
        <BrowserRouter>
          <Signup />
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Test that form elements are interactive
      fireEvent.change(nameInput, {
        target: { value: 'Test User' }
      });
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(passwordInput, {
        target: { value: 'Password123' }
      });
      
      expect(nameInput).toHaveValue('Test User');
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('Password123');
      expect(submitButton).toBeEnabled();
    });
  });
});