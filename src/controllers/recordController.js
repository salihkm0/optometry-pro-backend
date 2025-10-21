const OptometryRecord = require('../Models/OptometryRecord.js');
const Customer = require('../Models/Customer.js');

const getRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, customerId, startDate, endDate } = req.query;
    const shopId = req.user.shop?._id || req.user.shop;

    const query = { shop: shopId };
    
    if (customerId) {
      query.customer = customerId;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const records = await OptometryRecord.find(query)
      .populate('customer', 'name age sex phone')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await OptometryRecord.countDocuments(query);

    res.json({
      records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRecordById = async (req, res) => {
  try {
    const record = await OptometryRecord.findOne({
      _id: req.params.id,
      shop: req.user.shop?._id || req.user.shop
    }).populate('customer', 'name age sex phone email address');

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Convert to plain object and ensure all fields are properly included
    const recordData = record.toObject ? record.toObject() : { ...record._doc };

    // Debug: Log the raw record data
    console.log('Raw record data:', JSON.stringify({
      right_eye_dv_va: recordData.right_eye?.dv?.va,
      right_eye_add_va: recordData.right_eye?.add?.va,
      left_eye_dv_va: recordData.left_eye?.dv?.va,
      left_eye_add_va: recordData.left_eye?.add?.va
    }, null, 2));

    res.json(recordData);
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createRecord = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    
    // Verify customer belongs to the same shop
    const customer = await Customer.findOne({
      _id: req.body.customer,
      shop: shopId
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or access denied' });
    }

    console.log("req.body :", req.body);

    // Enhanced transformation function to handle all fields including VA
    const transformEyeData = (eyeData) => {
      if (!eyeData) return { dv: {}, add: {} };
      
      const transformed = {
        dv: {
          sph: eyeData.dv?.sph || '',
          cyl: eyeData.dv?.cyl || '',
          axis: eyeData.dv?.axis || '',
          va: eyeData.dv?.va || ''
        },
        add: {
          sph: eyeData.nv?.sph || eyeData.add?.sph || '',
          cyl: eyeData.nv?.cyl || eyeData.add?.cyl || '',
          axis: eyeData.nv?.axis || eyeData.add?.axis || '',
          va: eyeData.nv?.va || eyeData.add?.va || ''
        }
      };
      
      return transformed;
    };

    // Ensure eye structure is properly formatted with all fields
    const recordData = {
      ...req.body,
      shop: shopId,
      right_eye: transformEyeData(req.body.right_eye),
      left_eye: transformEyeData(req.body.left_eye)
    };

    // Remove any nv fields to avoid schema conflicts
    if (recordData.right_eye && recordData.right_eye.nv) {
      delete recordData.right_eye.nv;
    }
    if (recordData.left_eye && recordData.left_eye.nv) {
      delete recordData.left_eye.nv;
    }

    console.log("Processed record data:", JSON.stringify(recordData, null, 2));

    const record = new OptometryRecord(recordData);
    await record.save();

    // Update customer's last visit
    await customer.updateLastVisit();

    // Populate customer details for response
    await record.populate('customer', 'name age sex phone email address');

    // Convert to plain object for consistent response
    const responseRecord = record.toObject ? record.toObject() : { ...record._doc };

    res.status(201).json({
      message: 'Record created successfully',
      record: responseRecord
    });
  } catch (error) {
    console.error('Create record error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const updateRecord = async (req, res) => {
  try {
    // Enhanced transformation for update as well
    const transformEyeData = (eyeData) => {
      if (!eyeData) return { dv: {}, add: {} };
      
      return {
        dv: {
          sph: eyeData.dv?.sph || '',
          cyl: eyeData.dv?.cyl || '',
          axis: eyeData.dv?.axis || '',
          va: eyeData.dv?.va || ''
        },
        add: {
          sph: eyeData.nv?.sph || eyeData.add?.sph || '',
          cyl: eyeData.nv?.cyl || eyeData.add?.cyl || '',
          axis: eyeData.nv?.axis || eyeData.add?.axis || '',
          va: eyeData.nv?.va || eyeData.add?.va || ''
        }
      };
    };

    const updateData = {
      ...req.body,
      right_eye: transformEyeData(req.body.right_eye),
      left_eye: transformEyeData(req.body.left_eye)
    };

    // Remove nv fields
    if (updateData.right_eye && updateData.right_eye.nv) {
      delete updateData.right_eye.nv;
    }
    if (updateData.left_eye && updateData.left_eye.nv) {
      delete updateData.left_eye.nv;
    }

    const record = await OptometryRecord.findOneAndUpdate(
      {
        _id: req.params.id,
        shop: req.user.shop?._id || req.user.shop
      },
      updateData,
      { new: true, runValidators: true }
    ).populate('customer', 'name age sex phone email address');

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Convert to plain object for consistent response
    const responseRecord = record.toObject ? record.toObject() : { ...record._doc };

    res.json({
      message: 'Record updated successfully',
      record: responseRecord
    });
  } catch (error) {
    console.error('Update record error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRecord = async (req, res) => {
  try {
    const record = await OptometryRecord.findOneAndDelete({
      _id: req.params.id,
      shop: req.user.shop?._id || req.user.shop
    });

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerRecords = async (req, res) => {
  try {
    const { customerId } = req.params;
    const shopId = req.user.shop?._id || req.user.shop;

    // Verify customer belongs to the same shop
    const customer = await Customer.findOne({
      _id: customerId,
      shop: shopId
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or access denied' });
    }

    const records = await OptometryRecord.find({
      customer: customerId,
      shop: shopId
    })
    .populate('customer', 'name age sex phone email address')
    .sort({ date: -1 });

    // Convert all records to plain objects
    const plainRecords = records.map(record => 
      record.toObject ? record.toObject() : { ...record._doc }
    );

    res.json({
      customer,
      records: plainRecords
    });
  } catch (error) {
    console.error('Get customer records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRecordsStats = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    
    const totalRecords = await OptometryRecord.countDocuments({ shop: shopId });
    
    const recordsThisMonth = await OptometryRecord.countDocuments({
      shop: shopId,
      date: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    const recordsToday = await OptometryRecord.countDocuments({
      shop: shopId,
      date: {
        $gte: new Date().setHours(0, 0, 0, 0)
      }
    });

    // Get records by examination type
    const recordsByType = await OptometryRecord.aggregate([
      { $match: { shop: shopId } },
      { $group: { _id: '$examinationType', count: { $sum: 1 } } }
    ]);

    res.json({
      totalRecords,
      recordsThisMonth,
      recordsToday,
      recordsByType
    });
  } catch (error) {
    console.error('Get records stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getCustomerRecords,
  getRecordsStats
};