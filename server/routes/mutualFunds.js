const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const mutualFundApi = require('../middleware/mutualFundApi');

// @route   GET api/mutual-funds/top10
// @desc    Get top 10 performing mutual funds
// @access  Public
router.get('/top10', async (req, res, next) => {
  try {
    console.log('Fetching top 10 mutual funds directly from API');
    
    // Direct approach: get all funds and select 10 random ones
    const response = await axios.get('https://api.mfapi.in/mf');
    const allFunds = response.data;
    
    // Select 10 random funds
    const funds = [];
    const totalFunds = allFunds.length;
    const numFunds = Math.min(10, totalFunds);
    
    // Create a set to ensure we don't select the same fund twice
    const selectedIndices = new Set();
    
    while (selectedIndices.size < numFunds) {
      const randomIndex = Math.floor(Math.random() * totalFunds);
      if (!selectedIndices.has(randomIndex)) {
        selectedIndices.add(randomIndex);
        funds.push(allFunds[randomIndex]);
      }
    }
    
    // Process each fund to get full details
    const processedFunds = [];
    
    for (const fund of funds) {
      try {
        // Get detailed fund info
        const detailsResponse = await axios.get(`https://api.mfapi.in/mf/${fund.schemeCode}`);
        const fundDetails = detailsResponse.data;
        
        // Prepare the fund data with all available info
        const fundData = {
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          name: fund.schemeName,
          category: fundDetails.meta?.scheme_category || 'N/A',
          fundHouse: fundDetails.meta?.fund_house || 'N/A',
          latestNav: fundDetails.data && fundDetails.data.length > 0 ? parseFloat(fundDetails.data[0].nav) : 0,
          navDate: fundDetails.data && fundDetails.data.length > 0 ? fundDetails.data[0].date : null
        };
        
        processedFunds.push(fundData);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`Error processing fund ${fund.schemeCode}:`, error);
        // Still add the fund with available info
        processedFunds.push({
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          name: fund.schemeName,
          category: 'N/A',
          fundHouse: 'N/A',
          latestNav: 0,
          navDate: null
        });
      }
    }
    
    // Return the processed funds
    res.json(processedFunds);
    
  } catch (err) {
    console.error('Error fetching top mutual funds:', err);
    next(err);
  }
});

// @route   GET api/mutual-funds/search
// @desc    Search mutual funds
// @access  Public (or Private if you prefer)
router.get('/search', async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ msg: 'Search query is required' });
    }

    const funds = await mutualFundApi.searchFunds(query, 10);
    res.json(funds);
  } catch (err) {
    console.error('Error searching mutual funds:', err);
    next(err);
  }
});

// @route   GET api/mutual-funds/:schemeCode
// @desc    Get mutual fund details and NAV history
// @access  Public (or Private if you prefer)
router.get('/:schemeCode', async (req, res, next) => {
  try {
    console.log(`Fetching details for fund with scheme code: ${req.params.schemeCode}`);
    const { schemeCode } = req.params;
    const { duration = '1y' } = req.query; // 1m, 3m, 6m, 1y, 3y, 5y, 10y

    // Direct API approach for reliable data
    try {
      // Fetch fund details and data in one go
      const detailsResponse = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`);
      const fundDetails = detailsResponse.data;
      
      if (!fundDetails || !fundDetails.meta || !fundDetails.data || fundDetails.data.length === 0) {
        return res.status(404).json({ error: 'Fund details not found' });
      }
      
      // Extract and format the historical data for the specified duration
      const durationMap = {
        '1m': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365,
        '3y': 365 * 3,
        '5y': 365 * 5,
        '10y': 365 * 10
      };
      
      const dataCount = Math.min(durationMap[duration] || 365, fundDetails.data.length);
      const historicalData = fundDetails.data
        .slice(0, dataCount)
        .map(item => ({
          date: item.date,
          nav: parseFloat(item.nav)
        }));
      
      // Sort by date (ascending) for proper chart display
      historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`Got ${historicalData.length} historical data points for fund ${schemeCode}`);
      
      // Create the fund data object with all necessary fields
      const fundData = {
        schemeCode,
        name: fundDetails.meta.scheme_name,
        category: fundDetails.meta.scheme_category || 'N/A',
        fundHouse: fundDetails.meta.fund_house || 'N/A',
        latestNav: fundDetails.data[0] ? parseFloat(fundDetails.data[0].nav) : 0,
        navDate: fundDetails.data[0] ? fundDetails.data[0].date : null,
        historicalData: historicalData,
        details: fundDetails // Include the full response for additional details
      };
      
      return res.json(fundData);
    } catch (error) {
      console.error(`Error fetching direct API data for scheme ${schemeCode}:`, error);
      // Fall back to middleware approach if direct API fails
    }
    
    // Fallback to middleware approach
    console.log('Falling back to middleware approach');
    const fundDetails = await mutualFundApi.getFundBySchemeCode(schemeCode);
    const historicalData = await mutualFundApi.getHistoricalData(schemeCode, duration);
    
    // Create a response object with all the necessary data
    const fundData = {
      schemeCode,
      name: fundDetails.meta.scheme_name,
      category: fundDetails.meta.scheme_category || 'N/A',
      latestNav: historicalData.length > 0 ? historicalData[historicalData.length - 1].nav : 0,
      navDate: historicalData.length > 0 ? historicalData[historicalData.length - 1].date : null,
      fundHouse: fundDetails.meta.fund_house || 'N/A',
      historicalData,
      details: fundDetails
    };
    
    res.json(fundData);
  } catch (err) {
    console.error('Error fetching mutual fund details:', err);
    next(err);
  }
});



// @route   GET api/mutual-funds/compare
// @desc    Compare multiple mutual funds
// @access  Public
router.get('/compare', async (req, res, next) => {
  try {
    const { schemeCodes, duration = '1y' } = req.query;
    
    if (!schemeCodes) {
      return res.status(400).json({ msg: 'Scheme codes are required' });
    }
    
    // Parse scheme codes from comma-separated string
    const schemeCodeArray = schemeCodes.split(',').map(code => code.trim());
    
    if (schemeCodeArray.length < 2) {
      return res.status(400).json({ msg: 'At least two scheme codes are required for comparison' });
    }
    
    // Use the middleware to compare funds
    const results = await mutualFundApi.compareFunds(schemeCodeArray, duration);
    
    res.json(results);
  } catch (err) {
    console.error('Error comparing mutual funds:', err);
    next(err);
  }
});

module.exports = router;
