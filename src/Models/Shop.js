const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true,
    maxlength: [200, 'Shop name cannot exceed 200 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contact: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'USA'
      }
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'professional', 'enterprise'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'canceled'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    features: {
      maxUsers: { type: Number, default: 5 },
      maxCustomers: { type: Number, default: 1000 },
      advancedReports: { type: Boolean, default: false },
      customPermissions: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false }
    }
  },
  settings: {
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    },
    language: {
      type: String,
      default: 'en'
    },
    // Permission settings
    enableAdvancedPermissions: {
      type: Boolean,
      default: true
    },
    defaultUserRole: {
      type: String,
      enum: ['optometrist', 'assistant', 'receptionist'],
      default: 'optometrist'
    },
    // Business settings
    businessHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    },
    appointmentSettings: {
      slotDuration: { type: Number, default: 30 }, // minutes
      maxAppointmentsPerDay: { type: Number, default: 20 },
      allowOnlineBooking: { type: Boolean, default: false }
    },
    // Notification settings
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    // Privacy settings
    dataRetention: {
      customerRecords: { type: Number, default: 3650 }, // days
      auditLogs: { type: Number, default: 365 },
      backupFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: Map,
    of: String
  },
  // Analytics and tracking
  analytics: {
    totalCustomers: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    totalAppointments: { type: Number, default: 0 },
    monthlyGrowth: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  createdBy : {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, {
  timestamps: true
});

// Indexes
shopSchema.index({ owner: 1 });
shopSchema.index({ 'subscription.status': 1 });
shopSchema.index({ isActive: 1 });
shopSchema.index({ 'contact.email': 1 });
shopSchema.index({ createdAt: -1 });

// Virtual for customer count
shopSchema.virtual('customerCount', {
  ref: 'Customer',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Virtual for record count
shopSchema.virtual('recordCount', {
  ref: 'OptometryRecord',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Virtual for user count
shopSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Virtual for appointment count
shopSchema.virtual('appointmentCount', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Method to check if subscription is active
shopSchema.methods.isSubscriptionActive = function() {
  return this.subscription.status === 'active' && 
         (!this.subscription.endDate || this.subscription.endDate > new Date());
};

// Method to check if feature is enabled
shopSchema.methods.hasFeature = function(feature) {
  return this.subscription.features[feature] === true;
};

// Method to get subscription limits
shopSchema.methods.getLimit = function(limitType) {
  return this.subscription.features[limitType] || 0;
};

// Method to initialize default permissions for the shop
shopSchema.methods.initializePermissions = async function() {
  try {
    const Permission = mongoose.model('Permission');
    const roles = ['admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'];
    
    console.log(`Initializing permissions for shop: ${this.name}`);
    
    for (const role of roles) {
      const defaultPermissions = Permission.getDefaultPermissions(role);
      const defaultPages = Object.keys(defaultPermissions);
      
      const permissionsMap = new Map();
      Object.keys(defaultPermissions).forEach(page => {
        permissionsMap.set(page, defaultPermissions[page]);
      });

      await Permission.findOneAndUpdate(
        { shop: this._id, role },
        { 
          shop: this._id,
          role,
          permissions: permissionsMap,
          pageAccess: defaultPages,
          createdBy: this.owner
        },
        { upsert: true, new: true }
      );
      
      console.log(`Initialized permissions for role: ${role}`);
    }
    
    console.log(`Successfully initialized permissions for shop: ${this.name}`);
    return true;
  } catch (error) {
    console.error('Error initializing permissions:', error);
    throw error;
  }
};

// Method to update analytics
shopSchema.methods.updateAnalytics = async function() {
  try {
    const Customer = mongoose.model('Customer');
    const OptometryRecord = mongoose.model('OptometryRecord');
    const Appointment = mongoose.model('Appointment');
    
    const [customerCount, recordCount, appointmentCount] = await Promise.all([
      Customer.countDocuments({ shop: this._id }),
      OptometryRecord.countDocuments({ shop: this._id }),
      Appointment.countDocuments({ shop: this._id })
    ]);
    
    // Calculate monthly growth (placeholder - implement your own logic)
    const currentMonth = new Date().getMonth();
    const lastMonthRecords = await OptometryRecord.countDocuments({
      shop: this._id,
      createdAt: {
        $gte: new Date(new Date().getFullYear(), currentMonth - 1, 1),
        $lt: new Date(new Date().getFullYear(), currentMonth, 1)
      }
    });
    
    const monthlyGrowth = lastMonthRecords > 0 ? 
      ((recordCount - lastMonthRecords) / lastMonthRecords * 100) : 100;
    
    this.analytics = {
      totalCustomers: customerCount,
      totalRecords: recordCount,
      totalAppointments: appointmentCount,
      monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
      lastUpdated: new Date()
    };
    
    await this.save();
    return this.analytics;
  } catch (error) {
    console.error('Error updating analytics:', error);
    throw error;
  }
};

// Static method to find shops by owner
shopSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId }).sort({ createdAt: -1 });
};

// Static method to find active shops
shopSchema.statics.findActiveShops = function() {
  return this.find({ 
    isActive: true,
    'subscription.status': 'active'
  });
};

// Pre-save middleware to update analytics before saving
shopSchema.pre('save', function(next) {
  if (this.isModified('analytics')) {
    this.analytics.lastUpdated = new Date();
  }
  next();
});

// Post-save middleware to initialize permissions after shop creation
shopSchema.post('save', async function(doc) {
  try {
    // Only initialize permissions for new shops
    if (doc.isNew) {
      console.log(`New shop created: ${doc.name}, initializing permissions...`);
      await doc.initializePermissions();
      
      // Update the owner's shop reference if not already set
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(doc.owner, { shop: doc._id });
    }
  } catch (error) {
    console.error('Error in shop post-save middleware:', error);
  }
});

module.exports = mongoose.model('Shop', shopSchema);