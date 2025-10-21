const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per windowMs
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//     retryAfter: 900 // 15 minutes in seconds
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use(limiter);

// Additional rate limiting for auth routes
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // limit each IP to 5 requests per windowMs for auth
//   message: {
//     error: 'Too many authentication attempts, please try again later.',
//     retryAfter: 900
//   }
// });

// app.use('/api/auth', authLimiter);
// app.use('/api/auth');

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parser middleware with increased limits for file uploads
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb'
}));

// Trust proxy (important for rate limiting and secure cookies in production)
app.set('trust proxy', 1);

// Database connection with improved options
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/optometry_db';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 5,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`👥 Host: ${mongoose.connection.host}`);
  console.log(`🔌 Port: ${mongoose.connection.port}`);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🔄 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT. Closing MongoDB connection...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM. Closing MongoDB connection...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed.');
  process.exit(0);
});

// API Routes
app.use('/api/auth', require('./src/Routes/auth'));
app.use('/api/admin', require('./src/Routes/admin'));
app.use('/api/shops', require('./src/Routes/shops'));
app.use('/api/customers', require('./src/Routes/customers'));
app.use('/api/records', require('./src/Routes/records'));
app.use('/api/users', require('./src/Routes/users'));
app.use('/api/permissions', require('./src/Routes/permissions'));
app.use('/api/user-management', require('./src/Routes/userManagement'));

// Health check route with detailed information
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Optometry Backend is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    memoryUsage: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };

  // Check database connection
  try {
    await mongoose.connection.db.admin().ping();
    healthCheck.database = 'Healthy';
  } catch (error) {
    healthCheck.database = 'Unhealthy';
    healthCheck.status = 'Degraded';
    healthCheck.message = 'Database connection issue';
  }

  res.status(healthCheck.status === 'OK' ? 200 : 503).json(healthCheck);
});

// API status route
app.get('/api/status', (req, res) => {
  res.json({
    service: 'Optometry Management System API',
    status: 'Operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      shops: '/api/shops',
      customers: '/api/customers',
      records: '/api/records',
      users: '/api/users',
      permissions: '/api/permissions',
      userManagement: '/api/user-management'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Optometry Management System API',
    documentation: process.env.API_DOCS_URL || 'https://docs.yourapi.com',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Error stack:', err.stack);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      message: 'Validation Error',
      errors: errors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      message: 'Duplicate Entry',
      error: `${field} already exists`,
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
      error: 'Please provide a valid authentication token',
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired',
      error: 'Please login again',
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    message: 'API endpoint not found',
    error: `Route ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/api/auth',
      '/api/admin',
      '/api/shops',
      '/api/customers',
      '/api/records',
      '/api/users',
      '/api/permissions',
      '/api/user-management',
      '/api/health',
      '/api/status'
    ]
  });
});

// 404 handler for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    error: `The requested route ${req.originalUrl} was not found on this server`,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`
🚀 Server is running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📅 Started at: ${new Date().toISOString()}
🔗 Health check: http://localhost:${PORT}/api/health
📊 API Status: http://localhost:${PORT}/api/status
  `);
});

// Server error handling
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;