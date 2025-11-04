import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpPage from '../../src/pages/HelpPage';
import { useRouter } from 'next/router';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn()
}));

describe('HelpPage', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush
    });
  });

  it('renders help page with all sections', () => {
    render(<HelpPage />);
    
    // Check for main heading
    expect(screen.getByRole('heading', { name: /help center/i })).toBeInTheDocument();
    
    // Check for FAQ section
    expect(screen.getByRole('heading', { name: /frequently asked questions/i })).toBeInTheDocument();
    
    // Check for Contact section
    expect(screen.getByRole('heading', { name: /contact support/i })).toBeInTheDocument();
    
    // Check for Documentation section
    expect(screen.getByRole('heading', { name: /documentation/i })).toBeInTheDocument();
  });

  it('expands FAQ items when clicked', () => {
    render(<HelpPage />);
    
    // Find a FAQ question
    const faqQuestion = screen.getByText(/how do I reset my password/i);
    
    // Initially the answer should not be visible
    expect(screen.queryByText(/you can reset your password by/i)).not.toBeVisible();
    
    // Click on the question
    fireEvent.click(faqQuestion);
    
    // Now the answer should be visible
    expect(screen.getByText(/you can reset your password by/i)).toBeVisible();
    
    // Click again to collapse
    fireEvent.click(faqQuestion);
    
    // Answer should be hidden again
    expect(screen.queryByText(/you can reset your password by/i)).not.toBeVisible();
  });

  it('submits contact form with valid data', () => {
    const mockSubmit = jest.fn();
    
    // Mock the form submission
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
    
    render(<HelpPage />);
    
    // Fill out the contact form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' }
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'This is a test message' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    // Check if fetch was called with the right data
    expect(window.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
        headers: expect.any(Object)
      })
    );
    
    // Check for success message
    expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument();
  });

  it('shows documentation links that navigate correctly when clicked', () => {
    render(<HelpPage />);
    
    // Find a documentation link
    const gettingStartedLink = screen.getByRole('link', { name: /getting started/i });
    
    // Click on the link
    fireEvent.click(gettingStartedLink);
    
    // Check if router was called with the right path
    expect(mockPush).toHaveBeenCalledWith('/docs/getting-started');
  });

  it('displays search results when searching for help topics', () => {
    render(<HelpPage />);
    
    // Find the search input
    const searchInput = screen.getByPlaceholderText(/search for help/i);
    
    // Enter search term
    fireEvent.change(searchInput, {
      target: { value: 'password' }
    });
    
    // Check if search results are displayed
    expect(screen.getByText(/search results for: password/i)).toBeInTheDocument();
    expect(screen.getByText(/how do I reset my password/i)).toBeInTheDocument();
  });
});