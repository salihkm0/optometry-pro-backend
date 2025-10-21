const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'],
    default: 'optometrist'
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop'
  },
  phone: {
    type: String,
    trim: true
  },
  refreshToken: {
    type: String,
    default: null
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  department: {
    type: String,
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  specialization: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  permissions: {
    type: Map,
    of: {
      view: Boolean,
      create: Boolean,
      edit: Boolean,
      delete: Boolean,
      export: Boolean,
      import: Boolean,
      manage: Boolean
    },
    default: {}
  },
  accessiblePages: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ shop: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Check if user has permission for specific module and action
userSchema.methods.hasPermission = async function(module, action) {
  // Admin has all permissions
  if (this.role === 'admin') return true;
  
  // If permissions are directly set on user, use those
  if (this.permissions && this.permissions.get(module)) {
    return this.permissions.get(module)[action] === true;
  }
  
  // Otherwise check role-based permissions
  if (!this.shop) return false;
  
  const Permission = mongoose.model('Permission');
  const permission = await Permission.findOne({
    shop: this.shop,
    role: this.role,
    isActive: true
  });
  
  if (!permission) return false;
  
  return permission.permissions.get(module)?.[action] === true;
};

// Check if user can access a specific page
userSchema.methods.canAccessPage = async function(page) {
  // Admin can access all pages
  if (this.role === 'admin') return true;
  
  // If accessiblePages are directly set on user, use those
  if (this.accessiblePages && this.accessiblePages.length > 0) {
    return this.accessiblePages.includes(page);
  }
  
  // Otherwise check role-based page access
  if (!this.shop) return false;
  
  const Permission = mongoose.model('Permission');
  const permission = await Permission.findOne({
    shop: this.shop,
    role: this.role,
    isActive: true
  });
  
  if (!permission) return false;
  
  return permission.pageAccess.includes(page);
};

// Get user permissions (merged: user-specific + role-based)
userSchema.methods.getPermissions = async function() {
  // Admin has all permissions for all pages
  if (this.role === 'admin') {
    const Permission = mongoose.model('Permission');
    const availablePages = Permission.getAvailablePages();
    const availableActions = Permission.getAvailableActions();
    
    const allPermissions = {};
    availablePages.forEach(page => {
      allPermissions[page] = {};
      availableActions.forEach(action => {
        allPermissions[page][action] = true;
      });
    });
    
    return {
      permissions: allPermissions,
      accessiblePages: availablePages,
      role: this.role
    };
  }
  
  // For non-admin users, merge user-specific and role-based permissions
  const Permission = mongoose.model('Permission');
  const rolePermission = await Permission.findOne({
    shop: this.shop,
    role: this.role,
    isActive: true
  });
  
  let permissions = {};
  let accessiblePages = [];
  
  if (rolePermission) {
    // Convert Map to object for role permissions
    rolePermission.permissions.forEach((value, key) => {
      permissions[key] = { ...value };
    });
    accessiblePages = [...rolePermission.pageAccess];
  }
  
  // Merge with user-specific permissions (user-specific overrides role-based)
  if (this.permissions) {
    this.permissions.forEach((value, key) => {
      if (!permissions[key]) permissions[key] = {};
      Object.keys(value).forEach(action => {
        if (value[action] !== undefined) {
          permissions[key][action] = value[action];
        }
      });
    });
  }
  
  // Merge accessible pages
  if (this.accessiblePages && this.accessiblePages.length > 0) {
    accessiblePages = [...new Set([...accessiblePages, ...this.accessiblePages])];
  }
  
  return {
    permissions,
    accessiblePages,
    role: this.role
  };
};

// Update user permissions
userSchema.methods.updatePermissions = async function(permissions, accessiblePages) {
  if (permissions) {
    this.permissions = new Map(Object.entries(permissions));
  }
  if (accessiblePages) {
    this.accessiblePages = accessiblePages;
  }
  return this.save();
};

module.exports = mongoose.model('User', userSchema);