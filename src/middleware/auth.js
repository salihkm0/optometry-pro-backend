const jwt = require('jsonwebtoken');
const User = require('../Models/User.js');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('Auth middleware - Token received:', token ? 'Yes' : 'No');
    console.log(token)
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    console.log(decoded)
    console.log('Token decoded successfully, user ID:', decoded.userId);
    
    const user = await User.findById(decoded.userId).populate('shop');
    
    if (!user) {
      console.log('User not found for ID:', decoded.userId);
      return res.status(401).json({ message: 'Token is not valid' });
    }

    if (!user.isActive) {
      console.log('User account deactivated:', user.email);
      return res.status(401).json({ message: 'User account is deactivated' });
    }

    console.log('Authentication successful for user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const user = await User.findById(decoded.userId).populate('shop');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  auth,
  requireRole,
  optionalAuth
};