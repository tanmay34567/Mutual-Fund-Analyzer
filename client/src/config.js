// Configuration for different environments
const config = {
  // API URLs
  // Using the deployed backend URL
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://mutual-fund-analyzer.onrender.com/api' // Use deployed backend URL
    : 'http://localhost:5000/api',
  
  // External API URLs
  mutualFundApiUrl: 'https://api.mfapi.in/mf',
  
  // Flag to indicate if we're in production
  isProduction: process.env.NODE_ENV === 'production'
};

export default config;
