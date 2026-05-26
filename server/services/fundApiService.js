const axios = require('axios');

/**
 * Get latest NAV for a mutual fund
 * @param {string} schemeCode - The AMFI scheme code
 * @returns {Promise<object|null>} - Object with nav and date or null if error
 */
const getLatestNav = async (schemeCode) => {
  try {
    const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`);
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const latestData = response.data.data[0];
      return {
        nav: parseFloat(latestData.nav),
        date: new Date(latestData.date)
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching NAV for scheme ${schemeCode}:`, error.message);
    return null;
  }
};

/**
 * Get historical NAV data for a mutual fund
 * @param {string} schemeCode - The AMFI scheme code
 * @param {number} days - Number of days of historical data
 * @returns {Promise<Array|null>} - Array of NAV data or null if error
 */
const getHistoricalNav = async (schemeCode, days = 365) => {
  try {
    const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`);
    
    if (response.data && response.data.data) {
      // Limit to specified number of days
      return response.data.data.slice(0, days).map(item => ({
        date: new Date(item.date),
        nav: parseFloat(item.nav)
      }));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching historical NAV for scheme ${schemeCode}:`, error.message);
    return null;
  }
};

/**
 * Get fund details
 * @param {string} schemeCode - The AMFI scheme code
 * @returns {Promise<object|null>} - Fund details or null if error
 */
const getFundDetails = async (schemeCode) => {
  try {
    const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`);
    
    if (!response.data || !response.data.meta) {
      return null;
    }
    
    const latestNav = response.data.data && response.data.data.length > 0
      ? {
          nav: parseFloat(response.data.data[0].nav),
          date: new Date(response.data.data[0].date)
        }
      : null;
    
    return {
      name: response.data.meta.scheme_name,
      category: response.data.meta.scheme_category,
      fundHouse: response.data.meta.fund_house,
      schemeType: response.data.meta.scheme_type,
      latestNav: latestNav?.nav,
      navDate: latestNav?.date
    };
  } catch (error) {
    console.error(`Error fetching fund details for scheme ${schemeCode}:`, error.message);
    return null;
  }
};

/**
 * Search for mutual funds by name
 * @param {string} query - Search query
 * @returns {Promise<Array|null>} - Array of matching funds or null if error
 */
const searchFunds = async (query) => {
  try {
    const response = await axios.get(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    
    if (response.data && Array.isArray(response.data)) {
      return response.data.map(fund => ({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse
      }));
    }
    return [];
  } catch (error) {
    console.error(`Error searching for funds with query '${query}':`, error.message);
    return null;
  }
};

module.exports = {
  getLatestNav,
  getHistoricalNav,
  getFundDetails,
  searchFunds
};