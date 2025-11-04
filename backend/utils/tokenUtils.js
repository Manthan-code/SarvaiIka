/**
 * Token Utilities
 * JWT token generation, verification, and management
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate an access token
 * @param {Object} payload - Data to encode in the token
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.tokenExpiration });
};

/**
 * Generate a refresh token
 * @param {Object} payload - Data to encode in the token
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiration });
};

/**
 * Verify a token and return decoded payload
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

/**
 * Decode a token without verification
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Check if a token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired or invalid
 */
const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  isTokenExpired
};