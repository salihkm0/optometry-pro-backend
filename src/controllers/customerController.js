const Customer = require('../Models/Customer.js');
const OptometryRecord = require('../Models/OptometryRecord.js');

const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    // For admin, don't filter by shop; for other roles, use shop ID
    const query = { isActive: true };
    
    if (req.user.role !== 'admin') {
      const shopId = req.user.shop?._id || req.user.shop;
      if (!shopId) {
        return res.status(400).json({ message: 'Shop ID is required' });
      }
      query.shop = shopId;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments(query);

    res.json({
      customers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerById = async (req, res) => {
  try {
    // For admin, don't filter by shop; for other roles, use shop ID
    const filter = { _id: req.params.id };
    
    if (req.user.role !== 'admin') {
      filter.shop = req.user.shop?._id || req.user.shop;
    }

    const customer = await Customer.findOne(filter);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const customerData = { ...req.body };
    
    // For non-admin users, set shop ID from user's shop
    if (req.user.role !== 'admin') {
      const shopId = req.user.shop?._id || req.user.shop;
      if (!shopId) {
        return res.status(400).json({ message: 'Shop ID is required' });
      }
      customerData.shop = shopId;
    } else {
      // For admin, ensure shop ID is provided in request body
      if (!customerData.shop) {
        return res.status(400).json({ message: 'Shop ID is required for admin' });
      }
    }

    const customer = new Customer(customerData);
    await customer.save();

    res.status(201).json({
      message: 'Customer created successfully',
      customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    // For admin, don't filter by shop; for other roles, use shop ID
    const filter = { _id: req.params.id };
    
    if (req.user.role !== 'admin') {
      filter.shop = req.user.shop?._id || req.user.shop;
    }

    const customer = await Customer.findOneAndUpdate(
      filter,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({
      message: 'Customer updated successfully',
      customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    // For admin, don't filter by shop; for other roles, use shop ID
    const filter = { _id: req.params.id };
    
    if (req.user.role !== 'admin') {
      filter.shop = req.user.shop?._id || req.user.shop;
    }

    const customer = await Customer.findOneAndUpdate(
      filter,
      { isActive: false },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerStats = async (req, res) => {
  try {
    // For admin, get stats for all shops; for other roles, filter by shop
    const query = { isActive: true };
    
    if (req.user.role !== 'admin') {
      const shopId = req.user.shop?._id || req.user.shop;
      query.shop = shopId;
    }

    const totalCustomers = await Customer.countDocuments(query);
    
    const newCustomersThisMonth = await Customer.countDocuments({
      ...query,
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    // For optometry records query
    const recordQuery = {};
    if (req.user.role !== 'admin') {
      recordQuery.shop = req.user.shop?._id || req.user.shop;
    }

    const customersWithRecords = await OptometryRecord.distinct('customer', recordQuery);

    res.json({
      totalCustomers,
      newCustomersThisMonth,
      customersWithRecords: customersWithRecords.length
    });
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats
};