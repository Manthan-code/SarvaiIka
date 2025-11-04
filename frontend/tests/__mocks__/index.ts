/**
 * Mock Services Index
 * This file exports all mock services to ensure they're properly registered
 */

import authService from './authService';
import chatsService from './chatsService';
import notificationService from './notificationService';
import profileService from './profileService';
import dashboardService from './dashboardService';

export {
  authService,
  chatsService,
  notificationService,
  profileService,
  dashboardService
};