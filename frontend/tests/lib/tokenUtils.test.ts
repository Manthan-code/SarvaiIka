import { decodeJWT, isTokenExpired, getTokenExpiry, getTimeUntilExpiry, shouldRefreshToken, TOKEN_EXPIRY } from '../../src/lib/tokenUtils';

// Polyfill atob for Node environment if missing
if (typeof (globalThis as any).atob === 'undefined') {
  (globalThis as any).atob = (input: string) => Buffer.from(input, 'base64').toString('binary');
}

// Helper to create base64url encoded strings
const base64UrlEncode = (obj: unknown) => {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const base64 = Buffer.from(json).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

// Helper to construct a JWT token string
const makeJWT = (payload: Record<string, any>) => {
  const header = { alg: 'none', typ: 'JWT' };
  const headerEnc = base64UrlEncode(header);
  const payloadEnc = base64UrlEncode(payload);
  const signature = 'signature'; // not verified client-side
  return `${headerEnc}.${payloadEnc}.${signature}`;
};

describe('tokenUtils', () => {
  const originalNow = Date.now;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
    jest.spyOn(Date, 'now').mockRestore();
  });

  describe('decodeJWT', () => {
    it('decodes a valid JWT payload', () => {
      const payload = { exp: 1700000000, iat: 1699990000, sub: 'user-123', role: 'admin' };
      const token = makeJWT(payload);
      const decoded = decodeJWT(token)!;
      expect(decoded).toMatchObject(payload);
    });

    it('returns null for tokens with invalid structure', () => {
      expect(decodeJWT('not-a-jwt')).toBeNull();
      expect(decodeJWT('a.b')).toBeNull();
    });

    it('returns null when payload is not valid base64/JSON', () => {
      const headerEnc = base64UrlEncode({ alg: 'none', typ: 'JWT' });
      const invalidPayload = '***invalid***';
      const token = `${headerEnc}.${invalidPayload}.sig`;
      const decoded = decodeJWT(token);
      expect(decoded).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for null or invalid token', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired('not-a-jwt')).toBe(true);
    });

    it('returns false when token exp is in the future without buffer', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowSec * 1000);
      const token = makeJWT({ exp: nowSec + 300 });
      expect(isTokenExpired(token)).toBe(false);
    });

    it('returns true when within buffer minutes of expiry', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const token = makeJWT({ exp: nowSec + 60 }); // expires in 1 minute
      expect(isTokenExpired(token, 2)).toBe(true); // 2 min buffer makes it treated as expired
    });

    it('logs when expired with zero buffer', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const token = makeJWT({ exp: nowSec - 1 }); // already expired
      expect(isTokenExpired(token, 0)).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Token is expired');
    });
  });

  describe('getTokenExpiry', () => {
    it('returns expiry time in milliseconds for valid token', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const token = makeJWT({ exp: nowSec + 120 });
      const expiry = getTokenExpiry(token)!;
      expect(expiry).toBe((nowSec + 120) * 1000);
    });

    it('returns null for invalid token', () => {
      expect(getTokenExpiry(null)).toBeNull();
      expect(getTokenExpiry('a.b')).toBeNull();
      const tokenNoExp = makeJWT({ iat: 1, sub: 'x' } as any);
      expect(getTokenExpiry(tokenNoExp)).toBeNull();
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('returns remaining time in ms when not expired', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const token = makeJWT({ exp: nowSec + 300 }); // expires in 5 minutes
      const remaining = getTimeUntilExpiry(token);
      // Should be close to 300000 ms
      expect(remaining).toBeGreaterThanOrEqual(299000);
      expect(remaining).toBeLessThanOrEqual(301000);
    });

    it('returns 0 for expired or invalid tokens', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const expiredToken = makeJWT({ exp: nowSec - 10 });
      expect(getTimeUntilExpiry(expiredToken)).toBe(0);
      expect(getTimeUntilExpiry(null)).toBe(0);
    });
  });

  describe('shouldRefreshToken', () => {
    it('returns true when token expires within 2 minutes buffer and logs message', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const token = makeJWT({ exp: nowSec + 60 }); // 1 minute left
      const result = shouldRefreshToken(token);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/Token should refresh/i));
    });

    it('returns false when token has more than 2 minutes left', () => {
      const nowMs = 1710000000000;
      const nowSec = Math.floor(nowMs / 1000);
      jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      const token = makeJWT({ exp: nowSec + 600 }); // 10 minutes left
      const result = shouldRefreshToken(token);
      expect(result).toBe(false);
    });

    it('returns false for null token', () => {
      expect(shouldRefreshToken(null)).toBe(false);
    });
  });

  describe('TOKEN_EXPIRY constants', () => {
    it('has expected default values', () => {
      expect(TOKEN_EXPIRY.AUTH_TOKEN_HOURS).toBe(1);
      expect(TOKEN_EXPIRY.REFRESH_TOKEN_DAYS).toBe(60);
      expect(TOKEN_EXPIRY.REFRESH_BUFFER_MINUTES).toBe(2);
    });
  });
});