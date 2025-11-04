// Mock dependencies first
jest.mock('fs');
jest.mock('../src/config/logger');

const SecretsManager = require('../src/config/secretsManager');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../src/config/logger');

describe('SecretsManager', () => {
  let secretsManager;
  let originalCwd;

  beforeEach(() => {
    secretsManager = new SecretsManager();
    originalCwd = process.cwd();
    jest.clearAllMocks();
    
    // Reset logger mocks
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  describe('constructor', () => {
    it('should initialize with correct secrets path', () => {
      expect(secretsManager.secretsPath).toBe(path.join(process.cwd(), '.secrets'));
    });
  });

  describe('generateSecureString', () => {
    it('should generate a string with default length and encoding', () => {
      const result = secretsManager.generateSecureString();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(32);
    });

    it('should generate a string with custom length', () => {
      const result = secretsManager.generateSecureString(16);
      expect(result.length).toBe(16);
    });

    it('should generate a string with hex encoding', () => {
      const result = secretsManager.generateSecureString(32, 'hex');
      expect(result).toMatch(/^[0-9a-f]+$/);
      expect(result.length).toBe(32);
    });

    it('should generate a string with base64url encoding', () => {
      const result = secretsManager.generateSecureString(32, 'base64url');
      expect(typeof result).toBe('string');
      expect(result.length).toBe(32);
    });

    it('should generate different strings on multiple calls', () => {
      const result1 = secretsManager.generateSecureString();
      const result2 = secretsManager.generateSecureString();
      expect(result1).not.toBe(result2);
    });
  });

  describe('generateJwtSecret', () => {
    it('should generate a base64 encoded JWT secret', () => {
      const result = secretsManager.generateJwtSecret();
      expect(typeof result).toBe('string');
      
      // Should be valid base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
      
      // Should decode to 64 bytes
      const decoded = Buffer.from(result, 'base64');
      expect(decoded.length).toBe(64);
    });

    it('should generate different JWT secrets on multiple calls', () => {
      const result1 = secretsManager.generateJwtSecret();
      const result2 = secretsManager.generateJwtSecret();
      expect(result1).not.toBe(result2);
    });
  });

  describe('generateApiKey', () => {
    it('should generate an API key without prefix', () => {
      const result = secretsManager.generateApiKey();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // 32 bytes = 64 hex chars
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate an API key with prefix', () => {
      const apiKey = secretsManager.generateApiKey('sk-proj');
      expect(apiKey).toMatch(/^sk-proj_[a-f0-9]{64}$/);
      expect(apiKey.length).toBe(72); // 'sk-proj_' (8) + 64 hex chars
    });

    it('should generate different API keys on multiple calls', () => {
      const result1 = secretsManager.generateApiKey();
      const result2 = secretsManager.generateApiKey();
      expect(result1).not.toBe(result2);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate a password with default length', () => {
      const result = secretsManager.generateSecurePassword();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(16);
    });

    it('should generate a password with custom length', () => {
      const result = secretsManager.generateSecurePassword(24);
      expect(result.length).toBe(24);
    });

    it('should generate password with valid characters only', () => {
      const result = secretsManager.generateSecurePassword();
      const validChars = /^[A-Za-z0-9!@#$%^&*]+$/;
      expect(result).toMatch(validChars);
    });

    it('should generate different passwords on multiple calls', () => {
      const result1 = secretsManager.generateSecurePassword();
      const result2 = secretsManager.generateSecurePassword();
      expect(result1).not.toBe(result2);
    });
  });

  describe('validateSecret', () => {
    describe('general validation', () => {
      it('should return invalid for empty secret', () => {
        const result = secretsManager.validateSecret('');
        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('Secret is empty or not a string');
        expect(result.strength).toBe('weak');
      });

      it('should return invalid for null secret', () => {
        const result = secretsManager.validateSecret(null);
        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('Secret is empty or not a string');
      });

      it('should return invalid for non-string secret', () => {
        const result = secretsManager.validateSecret(123);
        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('Secret is empty or not a string');
      });

      it('should detect weak patterns', () => {
        const weakSecrets = ['password123', '123456', 'qwerty', 'admin', 'test', 'demo', 'default'];
        
        weakSecrets.forEach(secret => {
          const result = secretsManager.validateSecret(secret);
          expect(result.issues).toContain('Secret contains common weak patterns');
        });
      });

      it('should return valid for strong general secret', () => {
        const strongSecret = 'aB3$fG7*kL9#mN2@pQ5&rT8!';
        const result = secretsManager.validateSecret(strongSecret);
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.strength).toBe('medium');
      });

      it('should return strong for very long secret', () => {
        const veryLongSecret = 'aB3$fG7*kL9#mN2@pQ5&rT8!uV1%wX4^yZ6+';
        const result = secretsManager.validateSecret(veryLongSecret);
        expect(result.isValid).toBe(true);
        expect(result.strength).toBe('strong');
      });
    });

    describe('JWT validation', () => {
      it('should require at least 32 characters for JWT', () => {
        const shortJwt = 'short';
        const result = secretsManager.validateSecret(shortJwt, 'jwt');
        expect(result.issues).toContain('JWT secret should be at least 32 characters');
      });

      it('should require valid base64 for JWT', () => {
        // Create a string that's long enough (>32 chars) but decodes to less than 24 bytes
        // Using a string with mostly padding characters
        const longButShortDecoded = 'dGVzdA==dGVzdA==dGVzdA==dGVzdA=='; // 32 chars, but decodes to much less than 24 bytes
        const result = secretsManager.validateSecret(longButShortDecoded, 'jwt');
        // This will trigger the "decode to at least 24 bytes" check
        expect(result.issues).toContain('JWT secret should decode to at least 24 bytes');
      });

      it('should require at least 24 decoded bytes for JWT', () => {
        const shortBase64 = Buffer.from('short').toString('base64');
        const result = secretsManager.validateSecret(shortBase64, 'jwt');
        expect(result.issues).toContain('JWT secret should decode to at least 24 bytes');
      });

      it('should validate proper JWT secret', () => {
        const validJwt = Buffer.from('this-is-a-very-long-jwt-secret-that-meets-requirements').toString('base64');
        const result = secretsManager.validateSecret(validJwt, 'jwt');
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('API key validation', () => {
      it('should require at least 20 characters for API key', () => {
        const shortApiKey = 'short';
        const result = secretsManager.validateSecret(shortApiKey, 'api_key');
        expect(result.issues).toContain('API key should be at least 20 characters');
      });

      it('should validate proper API key', () => {
        const validApiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyzabcdef';
        const result = secretsManager.validateSecret(validApiKey, 'api_key');
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('Password validation', () => {
      it('should require at least 8 characters for password', () => {
        const shortPassword = 'short';
        const result = secretsManager.validateSecret(shortPassword, 'password');
        expect(result.issues).toContain('Password should be at least 8 characters');
      });

      it('should require uppercase letters', () => {
        const noUppercase = 'lowercase123!';
        const result = secretsManager.validateSecret(noUppercase, 'password');
        expect(result.issues).toContain('Password should contain uppercase letters');
      });

      it('should require lowercase letters', () => {
        const noLowercase = 'UPPERCASE123!';
        const result = secretsManager.validateSecret(noLowercase, 'password');
        expect(result.issues).toContain('Password should contain lowercase letters');
      });

      it('should require numbers', () => {
        const noNumbers = 'PasswordOnly!';
        const result = secretsManager.validateSecret(noNumbers, 'password');
        expect(result.issues).toContain('Password should contain numbers');
      });

      it('should validate proper password', () => {
        const validPassword = 'ValidPass123!';
        const result = secretsManager.validateSecret(validPassword, 'password');
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
  });

  describe('createSecureEnvTemplate', () => {
    it('should generate a complete environment template', () => {
      const template = secretsManager.createSecureEnvTemplate();
      
      expect(typeof template).toBe('string');
      expect(template).toContain('# SECURITY NOTICE');
      expect(template).toContain('JWT_SECRET=');
      expect(template).toContain('REDIS_PASSWORD=');
      expect(template).toContain('QDRANT_API_KEY=qdrant_');
      expect(template).toContain('PORT=5000');
      expect(template).toContain('NODE_ENV=development');
    });

    it('should include all required sections', () => {
      const template = secretsManager.createSecureEnvTemplate();
      
      const requiredSections = [
        'Server Configuration',
        'Security Secrets',
        'OpenAI & AI Services',
        'Database & Storage',
        'Caching & Sessions',
        'Vector Database',
        'Payment Processing',
        'File Upload & Media',
        'Application URLs',
        'Logging & Monitoring'
      ];

      requiredSections.forEach(section => {
        expect(template).toContain(section);
      });
    });

    it('should generate different secrets on multiple calls', () => {
      const template1 = secretsManager.createSecureEnvTemplate();
      const template2 = secretsManager.createSecureEnvTemplate();
      
      // Extract JWT secrets from both templates
      const jwtMatch1 = template1.match(/JWT_SECRET=([^\n\r]+)/);
      const jwtMatch2 = template2.match(/JWT_SECRET=([^\n\r]+)/);
      
      expect(jwtMatch1[1]).not.toBe(jwtMatch2[1]);
    });
  });

  describe('auditEnvironment', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');
    });

    it('should return clean audit when no env files exist', () => {
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.criticalIssues).toHaveLength(0);
      expect(audit.warnings).toHaveLength(0);
      expect(audit.score).toBe(100);
    });

    it('should detect real API keys in env files', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('OPENAI_API_KEY=sk-proj-realkey123\nSTRIPE_SECRET_KEY=sk_test_realkey456');
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.criticalIssues).toContain('Real API keys found in .env - immediate security risk');
      expect(audit.score).toBeLessThan(100);
    });

    it('should detect database credentials', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('DATABASE_URL=postgresql://user:password@localhost:5432/db');
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.criticalIssues).toContain('Database credentials exposed in .env');
    });

    it('should detect weak JWT secrets', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('JWT_SECRET=shortjwtsecret');
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.warnings).toContain('Weak JWT secret in .env');
    });

    it('should handle file read errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.warnings).toContain('Could not read .env: Permission denied');
    });

    it('should calculate security score correctly', () => {
      // Mock file system calls
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.endsWith('.env');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.endsWith('.env')) {
          return 'OPENAI_API_KEY=sk-proj-realkey\nJWT_SECRET=shortjwtsecret';
        }
        return '';
      });
      
      const audit = secretsManager.auditEnvironment();
      
      // Should find 1 critical issue (sk-proj-) and 1 warning (short JWT)
      expect(audit.criticalIssues.length).toBe(1);
      expect(audit.warnings.length).toBe(1);
      expect(audit.score).toBe(60); // 100 - (1 * 30) - (1 * 10) = 60
    });

    it('should provide recommendations for critical issues', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('OPENAI_API_KEY=sk-proj-realkey');
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.recommendations).toContain('Immediately replace exposed secrets with new ones');
      expect(audit.recommendations).toContain('Add .env files to .gitignore');
      expect(audit.recommendations).toContain('Use environment-specific secret management');
    });

    it('should provide recommendations for low scores', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('OPENAI_API_KEY=sk-proj-realkey1\nSTRIPE_SECRET_KEY=sk_test_realkey2\nJWT_SECRET=shortjwtsecret');
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.score).toBeLessThan(70);
      expect(audit.recommendations).toContain('Implement proper secrets management');
      expect(audit.recommendations).toContain('Use strong, randomly generated secrets');
      expect(audit.recommendations).toContain('Regular security audits');
    });

    it('should check multiple env files', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('.env');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('.env.local')) {
          return 'OPENAI_API_KEY=sk-proj-realkey';
        }
        return '';
      });
      
      const audit = secretsManager.auditEnvironment();
      
      expect(audit.criticalIssues).toContain('Real API keys found in .env.local - immediate security risk');
    });
  });

  describe('logAuditResults', () => {
    it('should log clean audit results', () => {
      fs.existsSync.mockReturnValue(false);
      
      const audit = secretsManager.logAuditResults();
      
      expect(logger.info).toHaveBeenCalledWith('[SECURITY] Environment Security Score: 100/100');
      expect(audit.score).toBe(100);
    });

    it('should log critical issues', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('OPENAI_API_KEY=sk-proj-realkey');
      
      secretsManager.logAuditResults();
      
      expect(logger.error).toHaveBeenCalledWith('[SECURITY] Critical Issues Found:');
      expect(logger.error).toHaveBeenCalledWith('[SECURITY] 🚨 Real API keys found in .env - immediate security risk');
    });

    it('should log warnings', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('JWT_SECRET=weak');
      
      secretsManager.logAuditResults();
      
      expect(logger.warn).toHaveBeenCalledWith('[SECURITY] Warnings:');
      expect(logger.warn).toHaveBeenCalledWith('[SECURITY] ⚠️  Weak JWT secret in .env');
    });

    it('should log recommendations', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('OPENAI_API_KEY=sk-proj-realkey');
      
      secretsManager.logAuditResults();
      
      expect(logger.info).toHaveBeenCalledWith('[SECURITY] Recommendations:');
      expect(logger.info).toHaveBeenCalledWith('[SECURITY] 💡 Immediately replace exposed secrets with new ones');
    });

    it('should return audit results', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = secretsManager.logAuditResults();
      
      expect(result).toHaveProperty('criticalIssues');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('score');
    });
  });
});