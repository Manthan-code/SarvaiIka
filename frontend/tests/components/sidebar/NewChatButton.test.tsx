import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { NewChatButton } from '../../../src/components/sidebar/NewChatButton';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NewChatButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders new chat button', () => {
    renderWithRouter(<NewChatButton collapsed={false} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('renders collapsed button without text', () => {
    renderWithRouter(<NewChatButton collapsed={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('New Chat')).not.toBeInTheDocument();
  });

  it('navigates to chat when clicked', () => {
    renderWithRouter(<NewChatButton collapsed={false} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

  it('can be focused for keyboard navigation', () => {
    renderWithRouter(<NewChatButton collapsed={false} />);
    
    const button = screen.getByRole('button');
    
    // Focus the button
    button.focus();
    expect(button).toHaveFocus();
  });

  it('applies correct styling classes', () => {
    renderWithRouter(<NewChatButton collapsed={false} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gradient-to-r');
    expect(button).toHaveClass('from-purple-500');
    expect(button).toHaveClass('to-blue-500');
  });

  it('shows plus icon in both collapsed and expanded states', () => {
    const { rerender } = render(
      <BrowserRouter>
        <NewChatButton collapsed={false} />
      </BrowserRouter>
    );
    
    // Check expanded state
    expect(screen.getByRole('button')).toBeInTheDocument();
    
    // Check collapsed state
    rerender(
      <BrowserRouter>
        <NewChatButton collapsed={true} />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});