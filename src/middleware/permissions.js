const User = require('../Models/User.js');

const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admin has all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      const hasPermission = await req.user.hasPermission(module, action);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. You don't have permission to ${action} ${module}.` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};

// Check page access middleware
const checkPageAccess = (page) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admin can access all pages
      if (req.user.role === 'admin') {
        return next();
      }

      const canAccess = await req.user.canAccessPage(page);
      
      if (!canAccess) {
        return res.status(403).json({ 
          message: `Access denied. You don't have permission to access ${page} page.` 
        });
      }

      next();
    } catch (error) {
      console.error('Page access check error:', error);
      res.status(500).json({ message: 'Server error during page access check' });
    }
  };
};

// Batch permission check for multiple actions
const checkMultiplePermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (req.user.role === 'admin') {
        return next();
      }

      for (const { module, action } of permissions) {
        const hasPermission = await req.user.hasPermission(module, action);
        if (!hasPermission) {
          return res.status(403).json({ 
            message: `Access denied. You don't have permission to ${action} ${module}.` 
          });
        }
      }

      next();
    } catch (error) {
      console.error('Multiple permissions check error:', error);
      res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};

// Get user permissions middleware
const attachUserPermissions = async (req, res, next) => {
  try {
    if (req.user) {
      req.userPermissions = await req.user.getPermissions();
    }
    next();
  } catch (error) {
    console.error('Attach permissions error:', error);
    next();
  }
};

module.exports = {
  checkPermission,
  checkPageAccess,
  checkMultiplePermissions,
  attachUserPermissions
};