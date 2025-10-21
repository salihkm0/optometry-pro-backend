const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: [true, 'Shop reference is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age seems unrealistic']
  },
  sex: {
    type: String,
    enum: ['Male', 'Female', 'Other', '']
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  medicalHistory: {
    allergies: [String],
    medications: [String],
    conditions: [String],
    notes: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastVisit: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes
customerSchema.index({ shop: 1, name: 1 });
customerSchema.index({ shop: 1, phone: 1 });
customerSchema.index({ shop: 1, email: 1 });
customerSchema.index({ shop: 1, createdAt: -1 });

// Virtual for full address
customerSchema.virtual('fullAddress').get(function() {
  const parts = [this.address.street, this.address.city, this.address.state, this.address.zipCode];
  return parts.filter(part => part).join(', ');
});

// Update lastVisit when new records are added
customerSchema.methods.updateLastVisit = function() {
  this.lastVisit = new Date();
  return this.save();
};

// Static method to find customers by shop
customerSchema.statics.findByShop = function(shopId) {
  return this.find({ shop: shopId }).sort({ name: 1 });
};

module.exports = mongoose.model('Customer', customerSchema);