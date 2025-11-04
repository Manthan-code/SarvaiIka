/**
 * Button Component Tests
 * Tests for button variants, sizes, and accessibility
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../../src/components/ui/button';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    
    let button = screen.getByRole('button', { name: /delete/i });
    expect(button).toHaveClass('bg-destructive');
    
    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole('button', { name: /outline/i });
    expect(button).toHaveClass('border');
    
    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole('button', { name: /ghost/i });
    expect(button).toHaveClass('hover:bg-accent');
    
    rerender(<Button variant="link">Link</Button>);
    button = screen.getByRole('button', { name: /link/i });
    expect(button).toHaveClass('text-primary');
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    
    let button = screen.getByRole('button', { name: /default/i });
    expect(button).toHaveClass('h-10');
    
    rerender(<Button size="sm">Small</Button>);
    button = screen.getByRole('button', { name: /small/i });
    expect(button).toHaveClass('h-9');
    
    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole('button', { name: /large/i });
    expect(button).toHaveClass('h-11');
  });

  it('handles disabled state correctly', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await userEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger click when disabled', async () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByRole('button', { name: /disabled/i });
    await userEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    
    const button = screen.getByRole('button', { name: /custom/i });
    expect(button).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    
    expect(ref.current).not.toBeNull();
    expect(ref.current?.textContent).toBe('Ref Button');
  });

  it('renders as different HTML element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="https://example.com">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveClass('bg-primary');
  });
});