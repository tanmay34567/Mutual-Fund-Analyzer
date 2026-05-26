const axios = require('axios');
const { MutualFund } = require('../models');
const { Op } = require('sequelize');

// Base URL for the mutual fund API
const MF_API_BASE_URL = 'https://api.mfapi.in/mf';

/**
 * Middleware for handling mutual fund API requests
 */
const mutualFundApi = {
  /**
   * Fetch all mutual funds from the API
   * @returns {Promise<Array>} Array of mutual funds
   */
  getAllFunds: async () => {
    try {
      const response = await axios.get(MF_API_BASE_URL);
      return response.data;
    } catch (error) {
      console.error('Error fetching all mutual funds:', error);
      throw error;
    }
  },

  /**
   * Fetch a specific mutual fund by scheme code
   * @param {number} schemeCode - The scheme code of the mutual fund
   * @returns {Promise<Object>} Mutual fund details
   */
  getFundBySchemeCode: async (schemeCode) => {
    try {
      // First check if we have it in our database
      const dbFund = await MutualFund.findOne({
        where: { schemeCode: schemeCode }
      });
      
      // If we have recent data (within 1 day), use it
      if (dbFund && dbFund.navDate && new Date() - new Date(dbFund.navDate) < 24 * 60 * 60 * 1000) {
        return {
          meta: {
            fund_house: dbFund.fundHouse,
            scheme_category: dbFund.category,
            scheme_code: dbFund.schemeCode,
            scheme_name: dbFund.name
          },
          data: [{
            date: dbFund.navDate,
            nav: dbFund.latestNav.toString()
          }]
        };
      }
      
      // Otherwise fetch from API
      const response = await axios.get(`${MF_API_BASE_URL}/${schemeCode}`);
      
      // If we got data, save it to our database for future use
      if (response.data && response.data.data && response.data.data.length > 0) {
        const fundData = {
          schemeCode: schemeCode,
          name: response.data.meta?.scheme_name || `Fund ${schemeCode}`,
          category: response.data.meta?.scheme_category || 'N/A',
          latestNav: parseFloat(response.data.data[0].nav) || 0,
          navDate: response.data.data[0].date || null,
          fundHouse: response.data.meta?.fund_house || 'N/A'
        };
        
        await MutualFund.upsert(fundData);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching mutual fund ${schemeCode}:`, error);
      // Return a minimal object with the scheme code to avoid breaking the client
      return {
        meta: {
          fund_house: 'N/A',
          scheme_category: 'N/A',
          scheme_code: schemeCode,
          scheme_name: `Fund ${schemeCode}`
        },
        data: []
      };
    }
  },

  /**
   * Get the latest NAV for a mutual fund
   * @param {number} schemeCode - The scheme code of the mutual fund
   * @returns {Promise<Object>} Latest NAV data
   */
  getLatestNav: async (schemeCode) => {
    try {
      const response = await axios.get(`${MF_API_BASE_URL}/${schemeCode}/latest`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching latest NAV for ${schemeCode}:`, error);
      throw error;
    }
  },

  /**
   * Search for mutual funds by name
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results to return
   * @returns {Promise<Array>} Array of matching mutual funds
   */
  searchFunds: async (query, limit = 10) => {
    try {
      // First try to search in our database
      const dbFunds = await MutualFund.findAll({
        where: {
          name: {
            [Op.iLike]: `%${query}%`
          }
        },
        limit
      });

      if (dbFunds.length > 0) {
        return dbFunds;
      }

      // If not found in database, fetch from external API
      const response = await axios.get(MF_API_BASE_URL);
      const allFunds = response.data;
      
      // Filter funds by name containing the query (case insensitive)
      const filteredFunds = allFunds
        .filter(fund => fund.schemeName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);
      
      return filteredFunds;
    } catch (error) {
      console.error('Error searching mutual funds:', error);
      throw error;
    }
  },

  /**
   * Get historical data for a mutual fund
   * @param {number} schemeCode - The scheme code of the mutual fund
   * @param {string} duration - Duration for historical data (1m, 3m, 6m, 1y, 3y, 5y, 10y)
   * @returns {Promise<Array>} Array of historical NAV data
   */
  getHistoricalData: async (schemeCode, duration = '1y') => {
    try {
      console.log(`Fetching historical data for scheme ${schemeCode} with duration ${duration}`);
      
      const durationMap = {
        '1m': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365,
        '3y': 365 * 3,
        '5y': 365 * 5,
        '10y': 365 * 10
      };

      const count = durationMap[duration] || 365; // Default to 1 year
      const response = await axios.get(`${MF_API_BASE_URL}/${schemeCode}`);
      
      // Ensure we have data to work with
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        console.log(`No historical data found for scheme ${schemeCode}`);
        return [];
      }
      
      // Filter data based on duration
      const allData = response.data.data;
      console.log(`Got ${allData.length} data points for fund ${schemeCode}`);
      
      // Take the most recent 'count' number of data points
      // But don't slice more than we have
      const dataCount = Math.min(count, allData.length);
      const filteredData = allData.slice(0, dataCount);
      
      // Process and format the data
      const processedData = filteredData
        .map(item => ({
          date: item.date,
          nav: parseFloat(item.nav)
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log(`Returning ${processedData.length} processed data points for chart`);
      return processedData;
    } catch (error) {
      console.error(`Error fetching historical data for scheme ${schemeCode}:`, error);
      return [];
    }
  },

  /**
   * Get top performing mutual funds
   * @param {number} limit - Maximum number of funds to return
   * @returns {Promise<Array>} Array of top mutual funds
   */
  getTopFunds: async (limit = 10) => {
    try {
      console.log('Fetching top funds...');
      
      // First try to get funds from the database
      const dbFunds = await MutualFund.findAll({
        order: [['latestNav', 'DESC']],
        limit
      });
      
      // If we have enough recent funds, return them
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentFunds = dbFunds.filter(fund => {
        return fund.navDate && new Date(fund.navDate) >= oneDayAgo;
      });
      
      if (recentFunds.length >= limit) {
        console.log('Returning funds from database');
        return recentFunds.slice(0, limit);
      }
      
      // Otherwise fetch from the API
      console.log('Fetching funds from API');
      const response = await axios.get(MF_API_BASE_URL);
      const funds = response.data.slice(0, limit);
      
      // Process each fund in sequence to avoid overwhelming the API
      const processedFunds = [];
      
      for (const fund of funds) {
        try {
          console.log(`Processing fund ${fund.schemeCode}`);
          
          // Get detailed fund info from the API
          const detailsUrl = `${MF_API_BASE_URL}/${fund.schemeCode}`;
          console.log(`Fetching from: ${detailsUrl}`);
          const detailResponse = await axios.get(detailsUrl);
          
          if (!detailResponse.data || !detailResponse.data.meta) {
            console.log(`No metadata found for fund ${fund.schemeCode}`);
            continue;
          }
          
          const meta = detailResponse.data.meta;
          const navData = detailResponse.data.data && detailResponse.data.data.length > 0 
            ? detailResponse.data.data[0] 
            : null;
          
          console.log(`Fund metadata:`, meta);
          console.log(`Nav data:`, navData);
          
          const fundData = {
            schemeCode: fund.schemeCode,
            name: fund.schemeName,
            category: meta.scheme_category || 'N/A',
            fundHouse: meta.fund_house || 'N/A',
            latestNav: navData && navData.nav ? parseFloat(navData.nav) : 0,
            navDate: navData ? navData.date : null
          };
          
          // Save to database and add to results
          await MutualFund.upsert(fundData);
          processedFunds.push(fundData);
          
          console.log(`Processed fund: ${fundData.name}`);
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing fund ${fund.schemeCode}:`, error);
          
          // Still add the fund with available info
          processedFunds.push({
            schemeCode: fund.schemeCode,
            name: fund.schemeName,
            category: 'N/A',
            fundHouse: 'N/A',
            latestNav: 0,
            navDate: null
          });
        }
      }
      
      return processedFunds;
    } catch (error) {
      console.error('Error fetching top mutual funds:', error);
      
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }
  },

  /**
   * Compare multiple mutual funds
   * @param {Array|string} schemeCodes - Array or comma-separated string of scheme codes
   * @param {string} duration - Duration for historical data
   * @returns {Promise<Array>} Array of mutual fund data for comparison
   */
  compareFunds: async (schemeCodes, duration = '1y') => {
    try {
      // Parse scheme codes if provided as string
      const schemeCodeArray = Array.isArray(schemeCodes) 
        ? schemeCodes 
        : schemeCodes.split(',').map(code => code.trim());
      
      // Fetch data for each scheme code
      const promises = schemeCodeArray.map(async (schemeCode) => {
        try {
          const response = await axios.get(`${MF_API_BASE_URL}/${schemeCode}`);
          const fund = response.data;
          
          // Get historical data for the specified duration
          const historicalData = await mutualFundApi.getHistoricalData(schemeCode, duration);
          
          return {
            schemeCode,
            name: fund.meta.scheme_name,
            fundHouse: fund.meta.fund_house,
            category: fund.meta.scheme_category,
            historicalData
          };
        } catch (error) {
          console.error(`Error fetching data for scheme ${schemeCode}:`, error);
          return {
            schemeCode,
            name: `Fund ${schemeCode}`,
            fundHouse: 'N/A',
            category: 'N/A',
            historicalData: []
          };
        }
      });
      
      return Promise.all(promises);
    } catch (error) {
      console.error('Error comparing mutual funds:', error);
      throw error;
    }
  }
};

module.exports = mutualFundApi;
