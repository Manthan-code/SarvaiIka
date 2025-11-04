import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptimizedList } from '@/components/OptimizedList';

const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: `Item ${i + 1}` }));

describe('OptimizedList', () => {
  it('renders loading skeleton', () => {
    const { container } = render(
      <OptimizedList
        items={items}
        itemHeight={40}
        height={200}
        loading
        renderItem={(item) => <div>{(item as any).label}</div>}
        keyExtractor={(item) => (item as any).id}
      />
    );
    // LoadingSkeleton renders pulse placeholders
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state with custom message', () => {
    render(
      <OptimizedList
        items={[]}
        itemHeight={40}
        height={200}
        emptyMessage="No data"
        renderItem={(item) => <div>{(item as any).label}</div>}
        keyExtractor={(_, i) => i}
      />
    );
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders items and handles click', () => {
    const onClick = jest.fn();
    render(
      <OptimizedList
        items={items}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as any).label}</div>}
        keyExtractor={(item) => (item as any).id}
        onItemClick={onClick}
      />
    );
    const first = screen.getByText('Item 1');
    fireEvent.click(first);
    expect(onClick).toHaveBeenCalledWith(items[0], 0);
  });
});