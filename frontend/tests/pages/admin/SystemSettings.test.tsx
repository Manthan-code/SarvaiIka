import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SystemSettings from '@/pages/admin/SystemSettings';

// Mock fetch to avoid real network calls during useEffect
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ config: {}, stats: {} })
  }) as any;
});

describe('SystemSettings Page', () => {
  it('renders without crashing and shows headings', async () => {
    render(
      <MemoryRouter>
        <SystemSettings />
      </MemoryRouter>
    );
    // Wait for headings after initial loading state
    const heading = await screen.findByText(/System Settings/i);
    expect(heading).toBeInTheDocument();
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });
});