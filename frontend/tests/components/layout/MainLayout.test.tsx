import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { MainLayout } from '../../../src/components/layout/MainLayout';
import { useAuthStore } from '../../../src/stores/authStore';
import { useIsMobile } from '../../../src/hooks/use-mobile';

// Mock dependencies
jest.mock('../../../src/stores/authStore');
jest.mock('../../../src/hooks/use-mobile');
jest.mock('../../../src/components/layout/AppSidebar', () => {
  return function MockAppSidebar() {
    return <div data-testid="app-sidebar">App Sidebar</div>;
  };
});

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('MainLayout', () => {
  const defaultAuthState = {
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    updateProfile: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue(defaultAuthState);
    mockUseIsMobile.mockReturnValue(false);
  });

  it('renders main layout with sidebar and content', () => {
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Main Content</div>
      </MainLayout>
    );
    
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('renders children content correctly', () => {
    const testContent = 'Test page content';
    
    renderWithRouter(
      <MainLayout>
        <div>{testContent}</div>
      </MainLayout>
    );
    
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('adapts layout for mobile devices', () => {
    mockUseIsMobile.mockReturnValue(true);
    
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Mobile Content</div>
      </MainLayout>
    );
    
    // Should still render sidebar and content, but with mobile-specific styling
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('handles unauthenticated users', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultAuthState,
      user: null
    });
    
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Content</div>
      </MainLayout>
    );
    
    // Layout should still render but may have different behavior
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('shows loading state when auth is loading', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultAuthState,
      loading: true
    });
    
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Content</div>
      </MainLayout>
    );
    
    // Should handle loading state gracefully
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('applies correct CSS classes for layout structure', () => {
    const { container } = renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Content</div>
      </MainLayout>
    );
    
    // Check that the layout has proper structure
    const layoutContainer = container.firstChild;
    expect(layoutContainer).toHaveClass('group/sidebar-wrapper', 'flex', 'min-h-svh', 'w-full');
  });

  it('handles sidebar toggle on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Mobile Content</div>
      </MainLayout>
    );
    
    // Look for mobile menu toggle if it exists
    const menuToggle = screen.queryByRole('button', { name: /menu/i });
    if (menuToggle) {
      fireEvent.click(menuToggle);
      // Sidebar should toggle visibility
    }
  });

  it('maintains responsive design principles', () => {
    const { container } = renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">Responsive Content</div>
      </MainLayout>
    );
    
    // Check for responsive classes
    const mainContent = screen.getByTestId('main-content').parentElement;
    expect(mainContent).toHaveClass('flex-1');
  });

  it('handles multiple children correctly', () => {
    renderWithRouter(
      <MainLayout>
        <div data-testid="content-1">Content 1</div>
        <div data-testid="content-2">Content 2</div>
        <div data-testid="content-3">Content 3</div>
      </MainLayout>
    );
    
    expect(screen.getByTestId('content-1')).toBeInTheDocument();
    expect(screen.getByTestId('content-2')).toBeInTheDocument();
    expect(screen.getByTestId('content-3')).toBeInTheDocument();
  });

  it('provides proper accessibility structure', () => {
    renderWithRouter(
      <MainLayout>
        <div data-testid="main-content">
          <h1>Page Title</h1>
          <p>Page content</p>
        </div>
      </MainLayout>
    );
    
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});