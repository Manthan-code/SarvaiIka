import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
} from '../../../src/components/ui/sidebar';
import { useIsMobile } from '../../../src/hooks/use-mobile';

jest.mock('../../../src/hooks/use-mobile', () => ({
  useIsMobile: jest.fn(),
}));

const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

function renderSidebar(opts?: { defaultOpen?: boolean; collapsible?: 'offcanvas' | 'icon' | 'none' }) {
  const defaultOpen = opts?.defaultOpen ?? true;
  const collapsible = opts?.collapsible ?? 'offcanvas';

  const utils = render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar side="left" variant="sidebar" collapsible={collapsible}>
        <SidebarHeader>
          <div>Header</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton data-testid="menu-button" isActive tooltip="Home">
                <span>Home</span>
              </SidebarMenuButton>
              <SidebarMenuAction aria-label="Action" />
              <SidebarMenuBadge>3</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarTrigger data-testid="sidebar-trigger" />
          <SidebarRail data-testid="sidebar-rail" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  );

  return utils;
}

describe('Sidebar UI primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to desktop
    mockUseIsMobile.mockReturnValue(false);
    // Reset cookie to avoid bleed across tests
    document.cookie = 'sidebar:state=; Max-Age=0; path=/';
  });

  it('renders expanded by default on desktop and toggles via SidebarTrigger', () => {
    const { container } = renderSidebar({ defaultOpen: true, collapsible: 'offcanvas' });

    // Expanded state should be present initially
    expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument();

    // Click the trigger to collapse
    const trigger = screen.getByTestId('sidebar-trigger');
    fireEvent.click(trigger);

    expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument();
    // Cookie should be set with collapsed state
    expect(document.cookie).toMatch(/sidebar:state=false/);

    // Keyboard shortcut Ctrl/Cmd + b toggles back to expanded
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument();
    expect(document.cookie).toMatch(/sidebar:state=true/);
  });

  it('toggles via SidebarRail click', () => {
    const { container } = renderSidebar({ defaultOpen: true, collapsible: 'offcanvas' });
    const rail = screen.getByTestId('sidebar-rail');

    // Collapse via rail
    fireEvent.click(rail);
    expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument();

    // Expand via rail again
    fireEvent.click(rail);
    expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument();
  });

  it('shows tooltip for menu button when collapsed and not mobile', async () => {
    mockUseIsMobile.mockReturnValue(false);
    const { container } = renderSidebar({ defaultOpen: false, collapsible: 'icon' });

    // Ensure collapsed state
    expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument();

    // Hover to trigger tooltip
    const menuButton = screen.getByTestId('menu-button');
    fireEvent.mouseOver(menuButton);

    // Tooltip content should become visible when collapsed on desktop
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('renders mobile sheet variant when isMobile is true and toggles without errors', () => {
    mockUseIsMobile.mockReturnValue(true);
    renderSidebar({ defaultOpen: true, collapsible: 'offcanvas' });

    // On mobile, the Sheet content is only mounted when openMobile=true. Initially it should not be present
    expect(document.querySelector('[data-mobile="true"]')).not.toBeInTheDocument();

    // Use the global keyboard shortcut to toggle open on mobile
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    // After toggling, the mobile sheet should be mounted
    expect(document.querySelector('[data-mobile="true"]')).toBeInTheDocument();
  });

  it('applies active state and size variants on SidebarMenuButton', () => {
    const { rerender } = render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="offcanvas">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton data-testid="menu-btn-1" isActive size="sm">
                  <span>Item 1</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const btn1 = screen.getByTestId('menu-btn-1');
    expect(btn1).toHaveAttribute('data-active', 'true');
    expect(btn1).toHaveAttribute('data-size', 'sm');

    // Rerender with different size and inactive
    rerender(
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="offcanvas">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton data-testid="menu-btn-2" isActive={false} size="lg">
                  <span>Item 2</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );

    const btn2 = screen.getByTestId('menu-btn-2');
    expect(btn2).toHaveAttribute('data-active', 'false');
    expect(btn2).toHaveAttribute('data-size', 'lg');
  });
});