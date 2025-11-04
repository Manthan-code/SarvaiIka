import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManageBackgroundImages from '@/pages/admin/ManageBackgroundImages';

describe('ManageBackgroundImages Page', () => {
  it('renders without crashing and shows headings', async () => {
    render(
      <MemoryRouter>
        <ManageBackgroundImages />
      </MemoryRouter>
    );
    const heading = await screen.findByRole('heading', { name: /manage background images/i });
    expect(heading).toBeInTheDocument();
  });
});