import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
jest.mock('../../../src/stores/authStore');
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

jest.mock('../../../src/services/supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: {
      signInWithOAuth: jest.fn(),
    },
  },
}));

// Mock console.error
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Import after mocks
import { OAuthButton } from '../../../src/components/auth/OAuthButton';
import { useAuthStore } from '../../../src/stores/authStore';
import supabaseClient from '../../../src/services/supabaseClient';

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockSupabaseClient = supabaseClient as jest.Mocked<typeof supabaseClient>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('OAuthButton', () => {
  const mockSignIn = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    
    // Set up default mock behavior
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://example.com/oauth' },
      error: null
    });
    
    mockUseAuthStore.mockReturnValue({
      signIn: mockSignIn,
      user: null,
      loading: false,
      error: null,
      signOut: jest.fn().mockResolvedValue(undefined),
      signUp: jest.fn(),
      resetPassword: jest.fn(),
      updateProfile: jest.fn()
    });
  });

  it('renders OAuth button with correct provider', () => {
    renderWithRouter(
      <OAuthButton 
        provider="google" 
        className="custom-class"
      >
        <span>Continue with Google</span>
      </OAuthButton>
    );
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('handles OAuth sign in successfully', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://oauth-url.com' },
      error: null
    });

    renderWithRouter(
      <OAuthButton 
        provider="github"
      >
        <span>Continue with GitHub</span>
      </OAuthButton>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    });
  });

  it('handles OAuth sign in error', async () => {
    const errorMessage = 'OAuth provider not available';
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: errorMessage }
    });

    renderWithRouter(
      <OAuthButton 
        provider="azure"
      >
        <span>Continue with Microsoft</span>
      </OAuthButton>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait for the OAuth call to complete
    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    });
    
    // Component should handle error gracefully without crashing
    expect(button).toBeInTheDocument();
  });

  it('disables button during local loading state', async () => {
    // Mock a slow OAuth response to test loading state
    mockSupabaseClient.auth.signInWithOAuth.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        data: { url: 'https://oauth-url.com' },
        error: null
      }), 100))
    );

    renderWithRouter(
      <OAuthButton 
        provider="google"
      >
        <span>Continue with Google</span>
      </OAuthButton>
    );
    
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    
    // Click button to trigger loading state
    fireEvent.click(button);
    
    // Button should be disabled during loading
    expect(button).toBeDisabled();
  });

  it('handles network error gracefully', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(
      new Error('Network error')
    );

    renderWithRouter(
      <OAuthButton 
        provider="google"
      >
        <span>Continue with Google</span>
      </OAuthButton>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait for the OAuth call to be attempted
    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    });
    
    // Component should handle error gracefully without crashing
    expect(button).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-oauth-button';
    
    renderWithRouter(
      <OAuthButton 
        provider="google"
        className={customClass}
      >
        <span>Continue with Google</span>
      </OAuthButton>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(customClass);
  });
});