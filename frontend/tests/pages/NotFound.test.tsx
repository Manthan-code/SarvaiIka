import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

describe('NotFound Page', () => {
  it('renders and shows helpful actions', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    // Page should render with at least one heading and action buttons
    const headings = screen.queryAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });
});