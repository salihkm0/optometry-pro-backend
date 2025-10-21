const mongoose = require('mongoose');

const eyeMeasurementSchema = new mongoose.Schema({
  sph: { type: String, default: '' },
  cyl: { type: String, default: '' },
  axis: { type: String, default: '' },
  va: { type: String, default: '' }
});

const eyeSchema = new mongoose.Schema({
  dv: { type: eyeMeasurementSchema, default: () => ({}) },
  add: { type: eyeMeasurementSchema, default: () => ({}) }
});

const optometryRecordSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: [true, 'Shop reference is required'],
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Examination date is required'],
    default: Date.now
  },
  
  // Updated Eye Structure
  right_eye: { type: eyeSchema, default: () => ({}) },
  left_eye: { type: eyeSchema, default: () => ({}) },
  
  // Additional Measurements
  ph: String,
  prism: String,
  base: String,
  pd: String, // Pupillary Distance
  
  // Professional Information
  optometrist: {
    type: String,
    trim: true
  },
  assistant: {
    type: String,
    trim: true
  },
  
  // Examination Details
  examinationType: {
    type: String,
    enum: ['routine', 'comprehensive', 'contact_lens', 'follow_up', 'emergency', 'other'],
    default: 'routine'
  },
  
  // Additional Notes
  chiefComplaint: String,
  history: String,
  diagnosis: String,
  recommendations: String,
  notes: String,
  
  // Prescription
  prescriptionType: {
    type: String,
    enum: ['distance', 'reading', 'bifocal', 'progressive', 'computer', 'other']
  },
  lensType: {
    type: String,
    enum: ['single_vision', 'bifocal', 'progressive', 'office', 'other']
  },
  frame: String,
  
  // Follow-up
  nextAppointment: Date,
  followUpNotes: String,
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'completed', 'cancelled'],
    default: 'completed'
  },
  
  // Digital Signature
  signedBy: String,
  signatureDate: Date
}, {
  timestamps: true
});

// Compound indexes for efficient querying
optometryRecordSchema.index({ shop: 1, customer: 1 });
optometryRecordSchema.index({ shop: 1, date: -1 });
optometryRecordSchema.index({ customer: 1, date: -1 });
optometryRecordSchema.index({ shop: 1, optometrist: 1 });
optometryRecordSchema.index({ shop: 1, status: 1 });

// Virtual for customer name (populate alternative)
optometryRecordSchema.virtual('customerName', {
  ref: 'Customer',
  localField: 'customer',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name' }
});

// Static method to get records by date range
optometryRecordSchema.statics.findByDateRange = function(shopId, startDate, endDate) {
  return this.find({
    shop: shopId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('customer', 'name age sex phone').sort({ date: -1 });
};

// Instance method to calculate patient age at time of examination
optometryRecordSchema.methods.getPatientAgeAtExam = async function() {
  const customer = await mongoose.model('Customer').findById(this.customer);
  if (!customer || !customer.age || !this.date) return null;
  
  const examDate = new Date(this.date);
  const birthYear = examDate.getFullYear() - customer.age;
  return examDate.getFullYear() - birthYear;
};

module.exports = mongoose.model('OptometryRecord', optometryRecordSchema);