const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'],
    required: true
  },
  permissions: {
    type: Map,
    of: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
      import: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    },
    default: {}
  },
  pageAccess: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index
permissionSchema.index({ shop: 1, role: 1 }, { unique: true });

// Static method to get default permissions for a role
permissionSchema.statics.getDefaultPermissions = function(role) {
  const defaults = {
    admin: {
      dashboard: { view: true, manage: true },
      customers: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      records: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      appointments: { view: true, create: true, edit: true, delete: true, export: true },
      billing: { view: true, create: true, edit: true, delete: true, export: true },
      inventory: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      reports: { view: true, create: true, export: true, manage: true },
      settings: { view: true, edit: true, manage: true },
      users: { view: true, create: true, edit: true, delete: true, manage: true },
      permissions: { view: true, create: true, edit: true, delete: true, manage: true }
    },
    shop_owner: {
      dashboard: { view: true, manage: true },
      customers: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      records: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      appointments: { view: true, create: true, edit: true, delete: true, export: true },
      billing: { view: true, create: true, edit: true, delete: true, export: true },
      inventory: { view: true, create: true, edit: true, delete: true, export: true, import: true },
      reports: { view: true, create: true, export: true, manage: true },
      settings: { view: true, edit: true, manage: true },
      users: { view: true, create: true, edit: true, delete: true, manage: true },
      permissions: { view: true, create: true, edit: true, delete: true, manage: true }
    },
    optometrist: {
      dashboard: { view: true },
      customers: { view: true, create: true, edit: true, export: true },
      records: { view: true, create: true, edit: true, export: true },
      appointments: { view: true, create: true, edit: true },
      reports: { view: true, export: true }
    },
    assistant: {
      dashboard: { view: true },
      customers: { view: true, create: true, edit: true },
      records: { view: true, create: true },
      appointments: { view: true, create: true, edit: true }
    },
    receptionist: {
      dashboard: { view: true },
      customers: { view: true, create: true, edit: true },
      appointments: { view: true, create: true, edit: true, delete: true }
    }
  };

  return defaults[role] || defaults.assistant;
};

// Method to get available pages/modules
permissionSchema.statics.getAvailablePages = function() {
  return [
    'dashboard',
    'customers',
    'records',
    'appointments',
    'billing',
    'inventory',
    'reports',
    'settings',
    'users',
    'permissions',
    'analytics',
    'notifications',
    'help'
  ];
};

// Method to get available actions
permissionSchema.statics.getAvailableActions = function() {
  return ['view', 'create', 'edit', 'delete', 'export', 'import', 'manage'];
};

module.exports = mongoose.model('Permission', permissionSchema);