const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

/**
 * Parse uploaded portfolio file (CSV or JSON)
 * @param {Object} file - Express file upload object
 * @returns {Promise<Array>} - Array of portfolio holdings
 */
const parsePortfolioFile = async (file) => {
  try {
    // Save file temporarily to parse it
    const tempFilePath = path.join(__dirname, '../temp', file.name);
    await writeFileAsync(tempFilePath, file.data);
    
    let result = [];
    
    // Parse based on file extension
    if (file.name.toLowerCase().endsWith('.csv')) {
      result = await parseCSV(tempFilePath);
    } else if (file.name.toLowerCase().endsWith('.json')) {
      result = await parseJSON(tempFilePath);
    } else {
      throw new Error('Unsupported file format. Please upload CSV or JSON.');
    }
    
    // Delete temp file
    await unlinkAsync(tempFilePath);
    
    return result;
  } catch (error) {
    console.error('Error parsing portfolio file:', error);
    throw error;
  }
};

/**
 * Parse CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} - Array of portfolio holdings
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
      }))
      .on('data', (data) => {
        // Map CSV columns to holding structure
        // Assuming CSV has columns: scheme_code, units, buy_price, buy_date
        const holding = {
          schemeCode: data.scheme_code,
          units: parseFloat(data.units),
          buyPrice: parseFloat(data.buy_price || data.nav || 0),
          buyDate: data.buy_date ? new Date(data.buy_date) : new Date()
        };
        
        // Validate data
        if (holding.schemeCode && 
            !isNaN(holding.units) && 
            !isNaN(holding.buyPrice) && 
            holding.units > 0 && 
            holding.buyPrice > 0) {
          results.push(holding);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Parse JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Array>} - Array of portfolio holdings
 */
const parseJSON = async (filePath) => {
  try {
    const fileContent = await readFileAsync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Handle different JSON structures
    let holdings = [];
    
    if (Array.isArray(data)) {
      // Direct array of holdings
      holdings = data;
    } else if (data.holdings && Array.isArray(data.holdings)) {
      // Object with holdings array
      holdings = data.holdings;
    } else if (data.portfolio && data.portfolio.holdings && Array.isArray(data.portfolio.holdings)) {
      // Nested portfolio object
      holdings = data.portfolio.holdings;
    }
    
    // Normalize and validate holdings
    return holdings
      .filter(h => h && h.schemeCode && h.units && h.buyPrice)
      .map(h => ({
        schemeCode: h.schemeCode || h.scheme_code,
        units: parseFloat(h.units),
        buyPrice: parseFloat(h.buyPrice || h.buy_price || h.nav || 0),
        buyDate: h.buyDate || h.buy_date ? new Date(h.buyDate || h.buy_date) : new Date()
      }))
      .filter(h => !isNaN(h.units) && !isNaN(h.buyPrice) && h.units > 0 && h.buyPrice > 0);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    throw error;
  }
};

module.exports = {
  parsePortfolioFile
};