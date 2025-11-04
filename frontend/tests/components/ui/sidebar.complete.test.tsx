/**
 * Comprehensive Sidebar Component Tests
 * Tests for desktop and mobile behavior, context provider, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from '../../../src/components/ui/sidebar';

// Mock the useIsMobile hook
jest.mock('../../../src/hooks/use-mobile', () => ({
  useIsMobile: jest.fn()
}));

// Import the mocked hook
import { useIsMobile } from '../../../src/hooks/use-mobile';

// Helper component to test the useSidebar hook
const SidebarStateDisplay = () => {
  const { open, openMobile, toggleSidebar } = useSidebar();
  return (
    <div>
      <div data-testid="open-state">{open ? 'open' : 'closed'}</div>
      <div data-testid="open-mobile-state">{openMobile ? 'open' : 'closed'}</div>
      <button data-testid="toggle-button" onClick={toggleSidebar}>Toggle</button>
    </div>
  );
};

// Helper to render sidebar with provider
const renderSidebar = (isMobile = false, children = <div>Sidebar Content</div>) => {
  (useIsMobile as jest.Mock).mockReturnValue(isMobile);
  
  return render(
    <SidebarProvider>
      <Sidebar data-testid="sidebar">
        {children}
      </Sidebar>
      <SidebarTrigger data-testid="sidebar-trigger">
        Menu
      </SidebarTrigger>
      <SidebarStateDisplay />
    </SidebarProvider>
  );
};

describe('Sidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Desktop Behavior', () => {
    it('should render sidebar content in desktop mode', () => {
      renderSidebar(false);
      
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    });
    
    it('should toggle sidebar open state when trigger is clicked in desktop mode', async () => {
      renderSidebar(false);
      
      // Initial state
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
      
      // Click trigger
      fireEvent.click(screen.getByTestId('sidebar-trigger'));
      
      // State should toggle
      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
      
      // Click again
      fireEvent.click(screen.getByTestId('sidebar-trigger'));
      
      // State should toggle back
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
    
    it('should toggle sidebar with keyboard shortcut in desktop mode', async () => {
      renderSidebar(false);
      
      // Initial state
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
      
      // Press keyboard shortcut (Ctrl+B)
      fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
      
      // State should toggle
      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
    });
  });
  
  describe('Mobile Behavior', () => {
    it('should render as sheet in mobile mode', () => {
      renderSidebar(true);
      
      // In mobile mode, sidebar content is in a sheet
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    it('should toggle mobile sidebar open state when trigger is clicked', async () => {
      renderSidebar(true);
      
      // Initial state
      expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('closed');
      
      // Click trigger
      fireEvent.click(screen.getByTestId('sidebar-trigger'));
      
      // Mobile state should toggle
      expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('open');
    });
    
    it('should close mobile sidebar when clicking outside', async () => {
      renderSidebar(true);
      
      // Open sidebar first
      fireEvent.click(screen.getByTestId('sidebar-trigger'));
      expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('open');
      
      // Click outside (the sheet overlay)
      fireEvent.click(document.querySelector('[data-state="open"]')!);
      
      // Should be closed
      await waitFor(() => {
        expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('closed');
      });
    });
    
    it('should toggle mobile sidebar with keyboard shortcut', async () => {
      renderSidebar(true);
      
      // Initial state
      expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('closed');
      
      // Press keyboard shortcut (Ctrl+B)
      fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
      
      // Mobile state should toggle
      expect(screen.getByTestId('open-mobile-state')).toHaveTextContent('open');
    });
  });
  
  describe('SidebarProvider', () => {
    it('should provide context values through useSidebar hook', () => {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarStateDisplay />
        </SidebarProvider>
      );
      
      // Check initial state from provider
      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
      
      // Toggle state
      fireEvent.click(screen.getByTestId('toggle-button'));
      
      // Check updated state
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
    
    it('should accept and use defaultOpen prop', () => {
      render(
        <SidebarProvider defaultOpen={true}>
          <SidebarStateDisplay />
        </SidebarProvider>
      );
      
      // Check initial state matches defaultOpen
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
  });
  
  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes in desktop mode', () => {
      renderSidebar(false);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('aria-label', 'Sidebar navigation');
    });
    
    it('should have appropriate ARIA attributes in mobile mode', () => {
      renderSidebar(true);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
    
    it('should focus trigger button after closing mobile sidebar', async () => {
      renderSidebar(true);
      
      // Open sidebar
      const triggerButton = screen.getByTestId('sidebar-trigger');
      fireEvent.click(triggerButton);
      
      // Close sidebar
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Trigger should regain focus
      await waitFor(() => {
        expect(document.activeElement).toBe(triggerButton);
      });
    });
  });
});