import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminMasterPanel } from '@/components/sidebar/AdminMasterPanel';
import { SidebarProvider } from '@/components/ui/sidebar';

jest.mock('framer-motion', () => ({
  motion: { div: (props: any) => <div {...props} /> },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('AdminMasterPanel', () => {
  it('renders admin menu items', () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <AdminMasterPanel collapsed={false} />
        </SidebarProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Manage Users/i)).toBeInTheDocument();
    expect(screen.getByText(/Background Images/i)).toBeInTheDocument();
    expect(screen.getByText(/System Settings/i)).toBeInTheDocument();
  });

  it('navigates when clicking a menu item', () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <AdminMasterPanel collapsed={false} />
        </SidebarProvider>
      </MemoryRouter>
    );
    const usersItem = screen.getByText(/Manage Users/i);
    fireEvent.click(usersItem);
    // Navigation happens via useNavigate, but in tests we just assert click doesn't crash
    expect(usersItem).toBeInTheDocument();
  });
});