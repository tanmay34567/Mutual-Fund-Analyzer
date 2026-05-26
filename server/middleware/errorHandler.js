module.exports = (err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific error types
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        errors: err.errors.map(e => ({ msg: e.message }))
      });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        errors: [{ msg: 'This record already exists' }]
      });
    }
    
    // Default error handler
    res.status(500).json({ 
      msg: 'Server Error',
      error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
  };