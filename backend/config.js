/**
 * Configuration for JWT tokens
 */
module.exports = {
  jwt: {
    secret: 'test-secret',
    refreshSecret: 'refresh-secret',
    tokenExpiration: '1h',
    refreshExpiration: '7d'
  }
};