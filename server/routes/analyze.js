const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Portfolio, Holding, MutualFund } = require('../models');
const { getLatestNav } = require('../services/fundApiService');
const { 
  calculateXIRR, 
  calculateCAGR, 
  calculateVolatility,
  calculateDiversification 
} = require('../services/calculationService');

// @route   GET api/analyze/portfolio/:id
// @desc    Get portfolio analysis
// @access  Private
router.get('/portfolio/:id', auth, async (req, res, next) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: [{
        model: Holding,
        as: 'holdings',
        include: [{
          model: MutualFund,
          attributes: ['name', 'category', 'latestNav', 'navDate']
        }]
      }]
    });

    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }

    // Update NAVs for all funds in the portfolio
    for (const holding of portfolio.holdings) {
      const latestNav = await getLatestNav(holding.schemeCode);
      
      if (latestNav) {
        await MutualFund.update(
          { 
            latestNav: latestNav.nav,
            navDate: latestNav.date
          },
          { where: { schemeCode: holding.schemeCode } }
        );
        
        // Update in current object
        holding.MutualFund.latestNav = latestNav.nav;
        holding.MutualFund.navDate = latestNav.date;
      }
    }

    // Prepare transactions for XIRR calculation
    const transactions = portfolio.holdings.map(holding => ({
      amount: holding.units * holding.buyPrice * -1, // Negative for outflows
      date: holding.buyDate
    }));

    // Calculate current value
    const currentValue = portfolio.holdings.reduce((total, holding) => {
      return total + (holding.units * (holding.MutualFund.latestNav || holding.buyPrice));
    }, 0);

    // Add current value as final transaction
    transactions.push({
      amount: currentValue,
      date: new Date()
    });

    // Calculate metrics
    const totalInvestment = portfolio.holdings.reduce((total, holding) => {
      return total + (holding.units * holding.buyPrice);
    }, 0);

    const absoluteReturn = ((currentValue / totalInvestment) - 1) * 100;
    
    // Calculate XIRR
    const xirrValue = calculateXIRR(transactions);
    
    // Calculate weighted average CAGR
    const cagr = calculateCAGR(portfolio.holdings);
    
    // Calculate volatility
    const volatility = await calculateVolatility(portfolio.holdings);
    
    // Calculate diversification
    const diversification = calculateDiversification(portfolio.holdings);

    res.json({
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalInvestment,
      currentValue,
      absoluteReturn,
      xirr: xirrValue,
      cagr,
      volatility,
      diversification,
      holdings: portfolio.holdings.map(holding => ({
        id: holding.id,
        schemeCode: holding.schemeCode,
        name: holding.MutualFund.name,
        category: holding.MutualFund.category,
        units: holding.units,
        buyPrice: holding.buyPrice,
        buyDate: holding.buyDate,
        currentNav: holding.MutualFund.latestNav || holding.buyPrice,
        navDate: holding.MutualFund.navDate,
        investmentValue: holding.units * holding.buyPrice,
        currentValue: holding.units * (holding.MutualFund.latestNav || holding.buyPrice),
        profit: (holding.units * (holding.MutualFund.latestNav || holding.buyPrice)) - (holding.units * holding.buyPrice),
        returnPercentage: (((holding.MutualFund.latestNav || holding.buyPrice) / holding.buyPrice) - 1) * 100
      }))
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET api/analyze/risks/:id
// @desc    Get risk analysis for a portfolio
// @access  Private
router.get('/risks/:id', auth, async (req, res, next) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: [{
        model: Holding,
        as: 'holdings',
        include: [{
          model: MutualFund,
          attributes: ['name', 'category', 'latestNav', 'navDate']
        }]
      }]
    });

    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }

    // Calculate risk metrics
    const volatility = await calculateVolatility(portfolio.holdings);
    const diversification = calculateDiversification(portfolio.holdings);
    
    res.json({
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      volatility,
      diversification,
      riskAnalysis: {
        sectorConcentration: diversification.sectorConcentration,
        assetClassConcentration: diversification.assetClassConcentration,
        topHoldings: diversification.topHoldings,
        riskLevel: getRiskLevel(volatility.value),
        recommendations: generateRiskRecommendations(volatility, diversification)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to determine risk level
function getRiskLevel(volatility) {
  if (volatility < 10) {
    return 'Low';
  } else if (volatility < 20) {
    return 'Moderate';
  } else {
    return 'High';
  }
}

// Helper function to generate recommendations
function generateRiskRecommendations(volatility, diversification) {
  const recommendations = [];
  
  if (volatility.value > 15) {
    recommendations.push('Consider adding more debt funds to reduce portfolio volatility.');
  }
  
  if (diversification.sectorConcentration.topSector.percentage > 30) {
    recommendations.push(`High concentration (${diversification.sectorConcentration.topSector.percentage.toFixed(2)}%) in ${diversification.sectorConcentration.topSector.name} sector. Consider diversifying.`);
  }
  
  if (diversification.assetClassConcentration.topClass.percentage > 70) {
    recommendations.push(`Portfolio is heavily weighted (${diversification.assetClassConcentration.topClass.percentage.toFixed(2)}%) towards ${diversification.assetClassConcentration.topClass.name}. Consider balancing with other asset classes.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Your portfolio has a good risk-return balance. Continue monitoring performance.');
  }
  
  return recommendations;
}

module.exports = router;