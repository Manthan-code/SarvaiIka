import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManageUsers from '@/pages/admin/ManageUsers';

// Use mapped manual mock via moduleNameMapper; no explicit jest.mock for apiClient
jest.mock('@/services/supabaseClient');

describe('ManageUsers Page', () => {
  it('renders without crashing and shows headings', async () => {
    render(
      <MemoryRouter>
        <ManageUsers />
      </MemoryRouter>
    );
    // Wait for the heading to appear after initial loading completes
    const heading = await screen.findByText(/Manage Users/i);
    expect(heading).toBeInTheDocument();
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });
});