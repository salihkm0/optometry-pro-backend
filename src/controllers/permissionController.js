const Permission = require('../Models/Permission.js');
const Shop = require('../Models/Shop.js');
const User = require('../Models/User.js');

// Get permissions for a shop
const getShopPermissions = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    
    // Admin can access any shop, others only their own
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (userShopId.toString() !== shopId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view permissions for your own shop.' 
        });
      }
    }

    const permissions = await Permission.find({ shop: shopId, isActive: true });
    
    // Get shop info
    const shop = await Shop.findById(shopId).select('name settings');
    
    // Get available pages and actions
    const availablePages = Permission.getAvailablePages();
    const availableActions = Permission.getAvailableActions();
    
    res.json({
      shop,
      permissions,
      availablePages,
      availableActions
    });
  } catch (error) {
    console.error('Get shop permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create or update permissions for a role
const updateRolePermissions = async (req, res) => {
  try {
    const { shopId, role } = req.params;
    const { permissions, pageAccess } = req.body;

    // Admin can update any shop's permissions
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (userShopId.toString() !== shopId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only update permissions for your own shop.' 
        });
      }
      
      // Only shop owners can update permissions in their shop
      if (req.user.role !== 'shop_owner') {
        return res.status(403).json({ 
          message: 'Access denied. Only shop owners can update permissions.' 
        });
      }
    }

    // Convert permissions object to Map
    const permissionsMap = new Map();
    if (permissions) {
      Object.keys(permissions).forEach(page => {
        permissionsMap.set(page, permissions[page]);
      });
    }

    const updatedPermission = await Permission.findOneAndUpdate(
      { shop: shopId, role },
      { 
        permissions: permissionsMap,
        pageAccess: pageAccess || [],
        createdBy: req.user._id
      },
      { new: true, runValidators: true, upsert: true }
    );

    // Update all users with this role to clear their cached permissions
    await User.updateMany(
      { shop: shopId, role },
      { $unset: { permissions: 1, accessiblePages: 1 } }
    );

    res.json({
      message: 'Permissions updated successfully',
      permission: updatedPermission
    });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create custom permissions for specific user
const createUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, accessiblePages } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if current user has permission to manage this user's permissions
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (user.shop.toString() !== userShopId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. You can only manage permissions for users in your own shop.' 
        });
      }
      
      if (req.user.role !== 'shop_owner') {
        return res.status(403).json({ 
          message: 'Access denied. Only shop owners can manage user permissions.' 
        });
      }
    }

    await user.updatePermissions(permissions, accessiblePages);

    res.json({
      message: 'User permissions updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create user permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user-specific permissions
const getUserSpecificPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('permissions accessiblePages role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if current user has permission to view this user's permissions
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (user.shop.toString() !== userShopId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view permissions for users in your own shop.' 
        });
      }
    }

    const permissionsObj = {};
    if (user.permissions) {
      user.permissions.forEach((value, key) => {
        permissionsObj[key] = { ...value };
      });
    }

    res.json({
      userId: user._id,
      permissions: permissionsObj,
      accessiblePages: user.accessiblePages,
      role: user.role
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset permissions to default for a role
const resetRolePermissions = async (req, res) => {
  try {
    const { shopId, role } = req.params;

    // Admin can reset any shop's permissions
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (userShopId.toString() !== shopId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only reset permissions for your own shop.' 
        });
      }
      
      if (req.user.role !== 'shop_owner') {
        return res.status(403).json({ 
          message: 'Access denied. Only shop owners can reset permissions.' 
        });
      }
    }

    const defaultPermissions = Permission.getDefaultPermissions(role);
    const defaultPages = Object.keys(defaultPermissions);
    
    const permissionsMap = new Map();
    Object.keys(defaultPermissions).forEach(page => {
      permissionsMap.set(page, defaultPermissions[page]);
    });

    const updatedPermission = await Permission.findOneAndUpdate(
      { shop: shopId, role },
      { 
        permissions: permissionsMap,
        pageAccess: defaultPages,
        createdBy: req.user._id
      },
      { new: true, runValidators: true, upsert: true }
    );

    // Update all users with this role to clear their cached permissions
    await User.updateMany(
      { shop: shopId, role },
      { $unset: { permissions: 1, accessiblePages: 1 } }
    );

    res.json({
      message: 'Permissions reset to default successfully',
      permission: updatedPermission
    });
  } catch (error) {
    console.error('Reset role permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Initialize permissions for a new shop
const initializeShopPermissions = async (req, res) => {
  try {
    const { shopId } = req.params;

    // Only admin can initialize permissions for any shop
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Only admin can initialize permissions.' 
      });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    await shop.initializePermissions();
    
    const permissions = await Permission.find({ shop: shopId });

    res.json({
      message: 'Shop permissions initialized successfully',
      permissions
    });
  } catch (error) {
    console.error('Initialize shop permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's permissions (for frontend)
const getUserPermissions = async (req, res) => {
  try {
    console.log('Getting permissions for user:', req.user.email);
    const userPermissions = await req.user.getPermissions();
    
    // Convert Mongoose documents to plain JavaScript objects
    const cleanPermissions = {}
    if (userPermissions.permissions) {
      Object.keys(userPermissions.permissions).forEach(module => {
        const moduleData = userPermissions.permissions[module]
        if (moduleData && typeof moduleData === 'object') {
          // Extract clean data from Mongoose document
          cleanPermissions[module] = moduleData._doc ? { ...moduleData._doc } : { ...moduleData }
          // Remove Mongoose internal properties
          delete cleanPermissions[module].$__
          delete cleanPermissions[module].$isNew
          delete cleanPermissions[module].$basePath
        }
      })
    }
    
    res.json({
      permissions: cleanPermissions,
      accessiblePages: userPermissions.accessiblePages || [],
      role: userPermissions.role,
      userId: req.user._id,
      email: req.user.email,
      name: req.user.name
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check specific permission
const checkUserPermission = async (req, res) => {
  try {
    const { module, action } = req.query;
    
    if (!module || !action) {
      return res.status(400).json({ 
        message: 'Module and action parameters are required' 
      });
    }

    const hasPermission = await req.user.hasPermission(module, action);
    
    res.json({
      hasPermission,
      module,
      action
    });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check page access
const checkPageAccess = async (req, res) => {
  try {
    const { page } = req.query;
    
    if (!page) {
      return res.status(400).json({ 
        message: 'Page parameter is required' 
      });
    }

    const canAccess = await req.user.canAccessPage(page);
    
    res.json({
      canAccess,
      page
    });
  } catch (error) {
    console.error('Check page access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all available pages and actions
const getAvailablePermissions = async (req, res) => {
  try {
    const availablePages = Permission.getAvailablePages();
    const availableActions = Permission.getAvailableActions();
    
    res.json({
      availablePages,
      availableActions
    });
  } catch (error) {
    console.error('Get available permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShopPermissions,
  updateRolePermissions,
  createUserPermissions,
  getUserSpecificPermissions,
  resetRolePermissions,
  initializeShopPermissions,
  getUserPermissions,
  checkUserPermission,
  checkPageAccess,
  getAvailablePermissions
};