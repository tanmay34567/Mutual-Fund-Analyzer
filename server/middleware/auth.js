const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  // Get token from header - check both standard Authorization and x-auth-token headers
  const authHeader = req.header('Authorization');
  const xAuthToken = req.header('x-auth-token');
  
  let token;
  
  // Check if token is in Authorization header (with Bearer prefix)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // Check if token is in Authorization header (without Bearer prefix)
  else if (authHeader) {
    token = authHeader;
  }
  // Check if token is in x-auth-token header
  else if (xAuthToken) {
    token = xAuthToken;
  }

  // Check if no token found in any header
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};