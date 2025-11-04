import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorMonitoringSettings from '@/components/ErrorMonitoringSettings';
import { notificationService } from '@/services/notificationService';
import { errorMonitoringManager } from '@/config/errorMonitoring';

// Remove automatic module mock and spy on real service methods instead to ensure same instance is used

describe('ErrorMonitoringSettings', () => {
  it('renders and toggles monitoring enabled', async () => {
    const onChange = jest.fn();
    render(<ErrorMonitoringSettings onConfigChange={onChange} />);

    const user = userEvent.setup();
    const toggle = screen.getByLabelText('Enable Error Monitoring');
    await user.click(toggle);
    expect(onChange).toHaveBeenCalled();
  });

  it('changes reporting thresholds', async () => {
    const onChange = jest.fn();
    render(<ErrorMonitoringSettings onConfigChange={onChange} />);

    const user = userEvent.setup();
    const inputs = screen.getAllByRole('spinbutton');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '2');
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and removes filters', async () => {
    render(<ErrorMonitoringSettings />);

    const user = userEvent.setup();
    // Switch to Filters tab
    const filtersTab = screen.getByRole('tab', { name: /filters/i });
    await user.click(filtersTab);
    await waitFor(() => expect(filtersTab).toHaveAttribute('aria-selected', 'true'));

    const filtersPanelId = filtersTab.getAttribute('aria-controls');
    expect(filtersPanelId).toBeTruthy();
    const filtersPanel = document.getElementById(filtersPanelId!);
    expect(filtersPanel).toBeTruthy();
    await waitFor(() => expect(filtersPanel).not.toHaveAttribute('hidden'));

    const input = within(filtersPanel!).getByPlaceholderText(/enter url to ignore/i);
    await user.type(input, 'http://example.com');
    await user.click(within(filtersPanel!).getByText('Add'));

    const badgeText = /http:\/\/example.com/i;
    const badge = await within(filtersPanel!).findByText(badgeText);
    expect(badge).toBeInTheDocument();

    // remove by clicking badge
    await user.click(badge);
    await waitFor(() => {
      expect(within(filtersPanel!).queryByText(badgeText)).not.toBeInTheDocument();
    });
  });

  it('tests notifications', async () => {
    const spy = jest.spyOn(notificationService, 'notifyError').mockResolvedValue();
    render(<ErrorMonitoringSettings />);

    const user = userEvent.setup();
    // Switch to Notifications tab
    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
    await user.click(notificationsTab);
    await waitFor(() => expect(notificationsTab).toHaveAttribute('aria-selected', 'true'));

    const notificationsPanelId = notificationsTab.getAttribute('aria-controls');
    expect(notificationsPanelId).toBeTruthy();
    const notificationsPanel = document.getElementById(notificationsPanelId!);
    expect(notificationsPanel).toBeTruthy();
    await waitFor(() => expect(notificationsPanel).not.toHaveAttribute('hidden'));

    const testButton = within(notificationsPanel!).getByText(/test notifications/i);
    await user.click(testButton);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
  });

  it('resets statistics', async () => {
    const spy = jest.spyOn(errorMonitoringManager, 'reset');
    render(<ErrorMonitoringSettings />);

    const user = userEvent.setup();
    // Switch to Statistics tab
    const statsTab = screen.getByRole('tab', { name: /statistics/i });
    await user.click(statsTab);
    await waitFor(() => expect(statsTab).toHaveAttribute('aria-selected', 'true'));

    const statsPanelId = statsTab.getAttribute('aria-controls');
    expect(statsPanelId).toBeTruthy();
    const statsPanel = document.getElementById(statsPanelId!);
    expect(statsPanel).toBeTruthy();
    await waitFor(() => expect(statsPanel).not.toHaveAttribute('hidden'));

    const resetButton = within(statsPanel!).getByText(/reset statistics/i);
    await user.click(resetButton);
    expect(spy).toHaveBeenCalled();
  });
});