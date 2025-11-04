const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class SecretsManager {
  constructor() {
    this.secretsPath = path.join(process.cwd(), '.secrets');
  }

  /**
   * Generate a cryptographically secure random string
   * @param {number} length - Length of the string
   * @param {string} encoding - Encoding format (hex, base64, base64url)
   * @returns {string} Secure random string
   */
  generateSecureString(length = 32, encoding = 'base64') {
    const bytes = Math.ceil(length * 0.75); // Adjust for base64 encoding
    return crypto.randomBytes(bytes).toString(encoding).slice(0, length);
  }

  /**
   * Generate a secure JWT secret
   * @returns {string} Base64 encoded JWT secret
   */
  generateJwtSecret() {
    return crypto.randomBytes(64).toString('base64');
  }

  /**
   * Generate a secure API key
   * @param {string} prefix - Optional prefix for the key
   * @returns {string} Secure API key
   */
  generateApiKey(prefix = '') {
    const randomPart = crypto.randomBytes(32).toString('hex');
    return prefix ? `${prefix}_${randomPart}` : randomPart;
  }

  /**
   * Generate a secure password
   * @param {number} length - Password length
   * @returns {string} Secure password
   */
  generateSecurePassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Validate if a secret meets security requirements
   * @param {string} secret - Secret to validate
   * @param {string} type - Type of secret (jwt, api_key, password)
   * @returns {object} Validation result
   */
  validateSecret(secret, type = 'general') {
    const result = {
      isValid: false,
      issues: [],
      strength: 'weak'
    };

    if (!secret || typeof secret !== 'string') {
      result.issues.push('Secret is empty or not a string');
      return result;
    }

    // Check for common patterns that indicate weak secrets
    const weakPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /test/i,
      /demo/i,
      /default/i
    ];

    const hasWeakPattern = weakPatterns.some(pattern => pattern.test(secret));
    if (hasWeakPattern) {
      result.issues.push('Secret contains common weak patterns');
    }

    // Type-specific validation
    switch (type) {
      case 'jwt':
        if (secret.length < 32) {
          result.issues.push('JWT secret should be at least 32 characters');
        }
        try {
          const decoded = Buffer.from(secret, 'base64');
          if (decoded.length < 24) {
            result.issues.push('JWT secret should decode to at least 24 bytes');
          }
        } catch {
          result.issues.push('JWT secret should be valid base64');
        }
        break;
        
      case 'api_key':
        if (secret.length < 20) {
          result.issues.push('API key should be at least 20 characters');
        }
        break;
        
      case 'password':
        if (secret.length < 8) {
          result.issues.push('Password should be at least 8 characters');
        }
        if (!/[A-Z]/.test(secret)) {
          result.issues.push('Password should contain uppercase letters');
        }
        if (!/[a-z]/.test(secret)) {
          result.issues.push('Password should contain lowercase letters');
        }
        if (!/[0-9]/.test(secret)) {
          result.issues.push('Password should contain numbers');
        }
        break;
    }

    // Calculate strength
    if (result.issues.length === 0) {
      result.isValid = true;
      if (secret.length >= 32 && /[A-Za-z0-9+/=]/.test(secret)) {
        result.strength = 'strong';
      } else if (secret.length >= 16) {
        result.strength = 'medium';
      }
    }

    return result;
  }

  /**
   * Create a secure environment template
   * @returns {string} Environment template content
   */
  createSecureEnvTemplate() {
    const template = `# =========================
# SECURITY NOTICE
# =========================
# This file contains sensitive information. Never commit this file to version control.
# Use .env.example for template and documentation.

# =========================
# Server Configuration
# =========================
PORT=5000
NODE_ENV=development

# =========================
# Security Secrets (CRITICAL - Replace with real values)
# =========================
JWT_SECRET=${this.generateJwtSecret()}

# =========================
# OpenAI & AI Services
# =========================
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
FREE_MODEL=gpt-3.5-turbo
PAID_CHEAP_MODEL=gpt-3.5-turbo-16k
PAID_EXPENSIVE_MODEL=gpt-4
DALL_E_API_KEY=sk-proj-your_dall_e_api_key_here
LUCIDCHART_API_KEY=your_lucidchart_api_key_here

# =========================
# Database & Storage
# =========================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# =========================
# Caching & Sessions
# =========================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=${this.generateSecurePassword(16)}

# =========================
# Vector Database
# =========================
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=${this.generateApiKey('qdrant')}

# =========================
# Payment Processing
# =========================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_CLI_WEBHOOK_SECRET=whsec_your_cli_webhook_secret_here
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret_here
STRIPE_PRICE_FREE=price_your_free_price_id
STRIPE_PRICE_PLUS=price_your_plus_price_id
STRIPE_PRICE_PRO=price_your_pro_price_id

# =========================
# File Upload & Media
# =========================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# =========================
# Application URLs
# =========================
FRONTEND_URL=http://localhost:8080

# =========================
# Logging & Monitoring
# =========================
LOG_LEVEL=info
`;

    return template;
  }

  /**
   * Audit current environment for security issues
   * @returns {object} Audit results
   */
  auditEnvironment() {
    const audit = {
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      score: 0
    };

    // Check for exposed secrets in common locations
    const dangerousFiles = ['.env', '.env.local', '.env.development'];
    dangerousFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Check for real API keys patterns
          if (content.includes('sk-proj-') || content.includes('sk_test_') || content.includes('sk_live_')) {
            audit.criticalIssues.push(`Real API keys found in ${file} - immediate security risk`);
          }
          
          // Check for database URLs with credentials
          if (content.match(/postgresql:\/\/.*:.*@/)) {
            audit.criticalIssues.push(`Database credentials exposed in ${file}`);
          }
          
          // Check for JWT secrets
          if (content.includes('JWT_SECRET=') && !content.includes('your_jwt_secret')) {
            const jwtMatch = content.match(/JWT_SECRET=([^\n\r]+)/);
            if (jwtMatch && jwtMatch[1] && jwtMatch[1].length < 32) {
              audit.warnings.push(`Weak JWT secret in ${file}`);
            }
          }
        } catch (error) {
          audit.warnings.push(`Could not read ${file}: ${error.message}`);
        }
      }
    });

    // Calculate security score
    let score = 100;
    score -= audit.criticalIssues.length * 30;
    score -= audit.warnings.length * 10;
    audit.score = Math.max(0, score);

    // Add recommendations
    if (audit.criticalIssues.length > 0) {
      audit.recommendations.push('Immediately replace exposed secrets with new ones');
      audit.recommendations.push('Add .env files to .gitignore');
      audit.recommendations.push('Use environment-specific secret management');
    }

    if (audit.score < 70) {
      audit.recommendations.push('Implement proper secrets management');
      audit.recommendations.push('Use strong, randomly generated secrets');
      audit.recommendations.push('Regular security audits');
    }

    return audit;
  }

  /**
   * Log security audit results
   */
  logAuditResults() {
    const audit = this.auditEnvironment();
    
    logger.info(`[SECURITY] Environment Security Score: ${audit.score}/100`);
    
    if (audit.criticalIssues.length > 0) {
      logger.error('[SECURITY] Critical Issues Found:');
      audit.criticalIssues.forEach(issue => logger.error(`[SECURITY] 🚨 ${issue}`));
    }
    
    if (audit.warnings.length > 0) {
      logger.warn('[SECURITY] Warnings:');
      audit.warnings.forEach(warning => logger.warn(`[SECURITY] ⚠️  ${warning}`));
    }
    
    if (audit.recommendations.length > 0) {
      logger.info('[SECURITY] Recommendations:');
      audit.recommendations.forEach(rec => logger.info(`[SECURITY] 💡 ${rec}`));
    }
    
    return audit;
  }
}

module.exports = SecretsManager;