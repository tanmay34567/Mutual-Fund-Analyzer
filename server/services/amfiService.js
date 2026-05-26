const axios = require('axios');

const getLatestNav = async (schemeCode) => {
  try {
    const response = await axios.get('https://api.mfapi.in/mf/' + schemeCode);
    const latestNav = response.data.data[0].nav;
    return parseFloat(latestNav);
  } catch (error) {
    console.error('Error fetching NAV:', error);
    return null;
  }
};

const getFundDetails = async (schemeCode) => {
  try {
    const response = await axios.get('https://api.mfapi.in/mf/' + schemeCode);
    return {
      name: response.data.meta.scheme_name,
      category: response.data.meta.scheme_category
    };
  } catch (error) {
    console.error('Error fetching fund details:', error);
    return null;
  }
};

module.exports = { getLatestNav, getFundDetails };