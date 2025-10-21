const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg
      }))
    });
  }
  next();
};

const validateShopOwnership = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    const shopId = req.params.shopId || req.body.shop || req.query.shop;
    
    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    if (req.user.shop && req.user.shop._id.toString() === shopId.toString()) {
      return next();
    }

    res.status(403).json({ 
      message: 'Access denied. You can only access your own shop data.' 
    });
  } catch (error) {
    console.error('Shop ownership validation error:', error);
    res.status(500).json({ message: 'Server error during validation' });
  }
};

module.exports = {
  handleValidationErrors,
  validateShopOwnership
};