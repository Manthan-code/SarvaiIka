import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsModal } from '../../src/components/modals/SettingsModal';

// Mock stores and hooks
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
    setUser: jest.fn(),
    session: { access_token: 'token' }
  })
}));

// Remove outer setThemeMock; define inside factory and expose via property
jest.mock('../../src/hooks/useTheme', () => {
  const setTheme = jest.fn();
  const useTheme = () => ({ theme: 'light', setTheme });
  // expose mock for test retrieval
  (useTheme as any).setTheme = setTheme;
  return { useTheme };
});

jest.mock('../../src/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() })
}));

jest.mock('../../src/hooks/useSafeBackground', () => ({
  useSafeBackground: () => ({
    backgroundImage: null,
    setBackgroundImage: jest.fn(),
    setBackgroundImageById: jest.fn().mockResolvedValue(undefined)
  })
}));

jest.mock('../../src/services/profileService', () => ({
  __esModule: true,
  default: {
    updateProfile: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('../../src/services/supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: {
      updateUser: jest.fn().mockResolvedValue({ error: null })
    }
  }
}));

// Mock UI components likely used within modal sidebar/content
jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, className }: any) => (
    <button className={className} onClick={onClick}>{children}</button>
  )
}));

jest.mock('../../src/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>
}));

jest.mock('../../src/components/ui/separator', () => ({
  Separator: () => <hr />
}));

jest.mock('../../src/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input type="checkbox" checked={checked} onChange={e => onCheckedChange(e.target.checked)} />
  )
}));

jest.mock('../../src/components/ui/input', () => ({
  Input: ({ value, onChange, className, placeholder, disabled }: any) => (
    <input value={value} onChange={onChange} className={className} placeholder={placeholder} disabled={disabled} />
  )
}));

jest.mock('../../src/components/ui/avatar', () => ({
  Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
  AvatarImage: ({ src }: any) => <img src={src || ''} alt="" />,
  AvatarFallback: ({ children, className }: any) => <div className={className}>{children}</div>
}));

jest.mock('../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: any) => (
    <div role="menuitem" aria-disabled={disabled} onClick={disabled ? undefined : onClick}>{children}</div>
  )
}));
jest.mock('lucide-react', () => ({
  User: () => <span>icon-user</span>,
  Bell: () => <span>icon-bell</span>,
  Shield: () => <span>icon-shield</span>,
  Palette: () => <span>icon-palette</span>,
  Download: () => <span>icon-download</span>,
  Edit: () => <span>icon-edit</span>,
  Camera: () => <span>icon-camera</span>,
  Trash2: () => <span>icon-trash</span>,
  Loader2: () => <span>icon-loader</span>,
  X: () => <span>icon-x</span>,
  Monitor: () => <span>icon-monitor</span>,
  Sun: () => <span>icon-sun</span>,
  Moon: () => <span>icon-moon</span>,
  Image: () => <span>icon-image</span>,
  Check: () => <span>icon-check</span>
}));

// Mock fetch used by appearance tab effects
const originalFetch = global.fetch;
beforeEach(() => {
  (global as any).fetch = jest.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/background-images')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ images: [{ id: 'bg1', name: 'Image 1', description: '', url: 'http://img/1', category: 'general', tier_required: 'free' }] })
      } as Response);
    }
    if (url.includes('/api/settings')) {
      return Promise.resolve({ ok: true, json: async () => ({ background_image_id: null }) } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as any;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('SettingsModal', () => {
  it('does not render when open is false', () => {
    render(<SettingsModal open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders when open is true and shows sidebar tabs', () => {
    render(<SettingsModal open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getAllByText('Profile Information').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('closes on ESC key press', () => {
    const onOpenChange = jest.fn();
    render(<SettingsModal open={true} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on outside click', () => {
    const onOpenChange = jest.fn();
    render(<SettingsModal open={true} onOpenChange={onOpenChange} />);
    fireEvent.mouseDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches to Appearance tab and toggles theme', async () => {
    render(<SettingsModal open={true} onOpenChange={() => {}} />);

    // Click appearance tab
    fireEvent.click(screen.getByText('Appearance'));

    // Wait for appearance content to show
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    // Retrieve setTheme mock from mocked module
    const themeModule = require('../../src/hooks/useTheme');
    const setThemeMock = themeModule.useTheme.setTheme as jest.Mock;

    // Toggle to dark theme
    fireEvent.click(screen.getByText('Dark'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');

    // Toggle to light theme
    fireEvent.click(screen.getByText('Light'));
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });
});