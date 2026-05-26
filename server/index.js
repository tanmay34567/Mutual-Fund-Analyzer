require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const errorHandler = require('./middleware/errorHandler');
const morgan = require('morgan');

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'https://mutual-fund-analyzer.vercel.app'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Add logging middleware

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolios', require('./routes/portfolios'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/mutual-funds', require('./routes/mutualFunds'));

// Test Route
app.get('/api/test', (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Error handling middleware
app.use(errorHandler);

// Port Configuration
const PORT = process.env.PORT || 5000;

// Start server and database connection
const startServer = async () => {
  // Start the server regardless of database connection
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test API at: http://localhost:${PORT}/api/test`);
  });

  // Try to connect to the database
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    console.log('Server is running but database connection failed.');
    console.log('Some API endpoints may not work properly.');
  }

  return server;
};

startServer();