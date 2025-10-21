const jwt = require('jsonwebtoken');

// Generate access token (short-lived: 15 minutes)
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: '15m' }
  );
};

// Generate refresh token (long-lived: 30 days)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: '30d' }
  );
};

// Verify token
const verifyToken = (token, secret = process.env.JWT_SECRET || 'your_jwt_secret') => {
  return jwt.verify(token, secret);
};

// Decode token without verification (for checking expiration)
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken
};