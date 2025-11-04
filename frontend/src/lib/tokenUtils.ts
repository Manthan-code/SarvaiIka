// Token validation utilities for JWT tokens

export interface TokenPayload {
  exp: number; // Expiration time (Unix timestamp)
  iat: number; // Issued at time
  sub: string; // Subject (user ID)
  [key: string]: unknown;
}

/**
 * Decode JWT token without verification (client-side only)
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export const decodeJWT = (token: string): TokenPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

/**
 * Check if a JWT token is expired
 * @param token JWT token string
 * @param bufferMinutes Optional buffer time in minutes before actual expiry
 * @returns true if expired or invalid, false if still valid
 */
export const isTokenExpired = (token: string | null, bufferMinutes: number = 0): boolean => {
  if (!token) return true;
  
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = bufferMinutes * 60;
  const isExpired = payload.exp <= (now + bufferSeconds);
  
  if (isExpired && bufferMinutes === 0) {
    console.log('Token is expired');
  }
  
  return isExpired;
};

/**
 * Get token expiry time in milliseconds
 * @param token JWT token string
 * @returns Expiry time in milliseconds or null if invalid
 */
export const getTokenExpiry = (token: string | null): number | null => {
  if (!token) return null;
  
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return null;
  
  return payload.exp * 1000; // Convert to milliseconds
};

/**
 * Get time until token expires in milliseconds
 * @param token JWT token string
 * @returns Time until expiry in milliseconds, or 0 if expired/invalid
 */
export const getTimeUntilExpiry = (token: string | null): number => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return 0;
  
  const timeUntilExpiry = expiry - Date.now();
  return Math.max(0, timeUntilExpiry);
};

/**
 * Check if token needs refresh (within 2 minutes of expiry)
 * @param token JWT token string
 * @returns true if token should be refreshed
 */
export const shouldRefreshToken = (token: string | null): boolean => {
  if (!token) return false;
  
  const result = isTokenExpired(token, 2); // 2 minutes buffer
  
  if (result) {
    const expiry = getTokenExpiry(token);
    const timeLeft = expiry ? expiry - Date.now() : 0;
    console.log(`Token should refresh - expires in ${Math.round(timeLeft / 1000 / 60)} minutes`);
  }
  
  return result;
};

/**
 * Token expiry constants
 */
export const TOKEN_EXPIRY = {
  AUTH_TOKEN_HOURS: 1,
  REFRESH_TOKEN_DAYS: 60,
  REFRESH_BUFFER_MINUTES: 2
};