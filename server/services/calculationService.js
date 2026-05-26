const { getHistoricalNav } = require('./fundApiService');
const xirr = require('xirr');

/**
 * Calculate XIRR for a set of cash flows
 * @param {Array} transactions - Array of transactions with amount and date
 * @returns {number} - XIRR value as percentage
 */
const calculateXIRR = (transactions) => {
  try {
    if (!transactions || transactions.length < 2) {
      return 0;
    }

    // Format transactions for xirr library
    const cashflows = transactions.map(t => ({
      amount: t.amount,
      when: t.date
    }));

    // Calculate XIRR
    const xirrValue = xirr(cashflows) * 100;
    
    // Return a reasonable value or 0 if calculation fails
    return isFinite(xirrValue) ? parseFloat(xirrValue.toFixed(2)) : 0;
  } catch (error) {
    console.error('Error calculating XIRR:', error);
    return 0;
  }
};

/**
 * Calculate CAGR for investments
 * @param {Array} holdings - Holdings with buy details and current NAV
 * @returns {number} - Weighted average CAGR
 */
const calculateCAGR = (holdings) => {
  if (!holdings || holdings.length === 0) {
    return 0;
  }

  let totalInvestment = 0;
  let weightedCAGR = 0;

  holdings.forEach(holding => {
    const buyPrice = holding.buyPrice;
    const currentNav = holding.MutualFund.latestNav || buyPrice;
    const investmentValue = holding.units * buyPrice;
    const buyDate = new Date(holding.buyDate);
    const currentDate = new Date();
    
    // Calculate years
    const yearsDiff = (currentDate - buyDate) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (yearsDiff > 0) {
      // Calculate individual CAGR
      const cagr = (Math.pow((currentNav / buyPrice), (1 / yearsDiff)) - 1) * 100;
      
      // Add weighted contribution
      totalInvestment += investmentValue;
      weightedCAGR += cagr * investmentValue;
    }
  });

  // Return the weighted average CAGR
  return totalInvestment > 0 ? parseFloat((weightedCAGR / totalInvestment).toFixed(2)) : 0;
};

/**
 * Calculate volatility based on historical NAV data
 * @param {Array} holdings - Portfolio holdings
 * @param {number} days - Days of history to consider
 * @returns {Object} - Volatility metrics
 */
const calculateVolatility = async (holdings, days = 365) => {
  try {
    if (!holdings || holdings.length === 0) {
      return { value: 0, fundVolatilities: [] };
    }

    const fundVolatilities = [];
    let weightedVolatility = 0;
    let totalInvestment = 0;

    // Calculate volatility for each fund
    for (const holding of holdings) {
      const historicalData = await getHistoricalNav(holding.schemeCode, days);
      
      if (historicalData && historicalData.length > 30) { // Need sufficient data
        // Calculate daily returns
        const returns = [];
        for (let i = 1; i < historicalData.length; i++) {
          returns.push((historicalData[i-1].nav - historicalData[i].nav) / historicalData[i].nav);
        }
        
        // Calculate standard deviation of returns
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        // Annualize the volatility (standard deviation * sqrt(252))
        const annualizedVolatility = stdDev * Math.sqrt(252) * 100;
        
        const investmentValue = holding.units * holding.buyPrice;
        totalInvestment += investmentValue;
        weightedVolatility += annualizedVolatility * investmentValue;
        
        fundVolatilities.push({
          schemeCode: holding.schemeCode,
          name: holding.MutualFund.name,
          volatility: parseFloat(annualizedVolatility.toFixed(2))
        });
      }
    }

    // Calculate weighted average volatility
    const portfolioVolatility = totalInvestment > 0 
      ? parseFloat((weightedVolatility / totalInvestment).toFixed(2)) 
      : 0;

    return {
      value: portfolioVolatility,
      fundVolatilities: fundVolatilities.sort((a, b) => b.volatility - a.volatility)
    };
  } catch (error) {
    console.error('Error calculating volatility:', error);
    return { value: 0, fundVolatilities: [] };
  }
};

/**
 * Calculate diversification metrics for a portfolio
 * @param {Array} holdings - Portfolio holdings
 * @returns {Object} - Diversification metrics
 */
const calculateDiversification = (holdings) => {
  if (!holdings || holdings.length === 0) {
    return {
      sectorConcentration: { topSector: { name: 'N/A', percentage: 0 }, sectors: [] },
      assetClassConcentration: { topClass: { name: 'N/A', percentage: 0 }, classes: [] }
    };
  }

  // Get total portfolio value
  const totalValue = holdings.reduce((sum, holding) => {
    return sum + (holding.units * (holding.MutualFund.latestNav || holding.buyPrice));
  }, 0);

  // Calculate sector concentration
  const sectorMap = new Map();
  holdings.forEach(holding => {
    const fundValue = holding.units * (holding.MutualFund.latestNav || holding.buyPrice);
    const category = holding.MutualFund.category || 'Unclassified';
    
    if (sectorMap.has(category)) {
      sectorMap.set(category, sectorMap.get(category) + fundValue);
    } else {
      sectorMap.set(category, fundValue);
    }
  });

  const sectors = Array.from(sectorMap.entries()).map(([name, value]) => ({
    name,
    value,
    percentage: (value / totalValue) * 100
  })).sort((a, b) => b.percentage - a.percentage);

  // Calculate asset class concentration (simplified - using first word of category)
  const assetClassMap = new Map();
  holdings.forEach(holding => {
    const fundValue = holding.units * (holding.MutualFund.latestNav || holding.buyPrice);
    const category = holding.MutualFund.category || 'Unclassified';
    const assetClass = category.split(' ')[0] || 'Other';
    
    if (assetClassMap.has(assetClass)) {
      assetClassMap.set(assetClass, assetClassMap.get(assetClass) + fundValue);
    } else {
      assetClassMap.set(assetClass, fundValue);
    }
  });

  const classes = Array.from(assetClassMap.entries()).map(([name, value]) => ({
    name,
    value,
    percentage: (value / totalValue) * 100
  })).sort((a, b) => b.percentage - a.percentage);

  // Calculate top holdings
  const topHoldings = holdings.map(holding => {
    const fundValue = holding.units * (holding.MutualFund.latestNav || holding.buyPrice);
    return {
      name: holding.MutualFund.name,
      value: fundValue,
      percentage: (fundValue / totalValue) * 100
    };
  }).sort((a, b) => b.percentage - a.percentage).slice(0, 5);

  return {
    sectorConcentration: {
      topSector: sectors.length > 0 ? 
        { name: sectors[0].name, percentage: sectors[0].percentage } : 
        { name: 'N/A', percentage: 0 },
      sectors
    },
    assetClassConcentration: {
      topClass: classes.length > 0 ? 
        { name: classes[0].name, percentage: classes[0].percentage } : 
        { name: 'N/A', percentage: 0 },
      classes
    },
    topHoldings
  };
};

module.exports = {
  calculateXIRR,
  calculateCAGR,
  calculateVolatility,
  calculateDiversification
};