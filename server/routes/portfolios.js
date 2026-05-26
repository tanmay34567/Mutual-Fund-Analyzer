const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { Portfolio, Holding, MutualFund } = require('../models');
const { parsePortfolioFile } = require('../utils/fileParser');
const { getFundDetails } = require('../services/fundApiService');

// @route   GET api/portfolios
// @desc    Get all user portfolios
// @access  Private
router.get('/', auth, async (req, res, next) => {
  try {
    const portfolios = await Portfolio.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Holding,
        as: 'holdings',
        include: [{
          model: MutualFund,
          attributes: ['name', 'category', 'latestNav', 'navDate']
        }]
      }]
    });
    res.json(portfolios);
  } catch (err) {
    next(err);
  }
});

// @route   GET api/portfolios/:id
// @desc    Get portfolio by ID
// @access  Private
router.get('/:id', auth, async (req, res, next) => {
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

    res.json(portfolio);
  } catch (err) {
    next(err);
  }
});

// @route   POST api/portfolios
// @desc    Create a portfolio
// @access  Private
router.post('/', [
  auth,
  check('name', 'Name is required').not().isEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const portfolio = await Portfolio.create({
      name,
      description,
      userId: req.user.id
    });

    res.status(201).json(portfolio);
  } catch (err) {
    next(err);
  }
});

// @route   POST api/portfolios/:id/holdings
// @desc    Add holding to portfolio
// @access  Private
router.post('/:id/holdings', [
  auth,
  check('schemeCode', 'Scheme code is required').not().isEmpty(),
  check('units', 'Units must be a positive number').isFloat({ min: 0 }),
  check('buyPrice', 'Buy price must be a positive number').isFloat({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if portfolio exists and belongs to user
    const portfolio = await Portfolio.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }

    const { schemeCode, units, buyPrice, buyDate } = req.body;

    // Check if mutual fund exists, if not create it
    let mutualFund = await MutualFund.findOne({ where: { schemeCode } });
    
    if (!mutualFund) {
      const fundDetails = await getFundDetails(schemeCode);
      
      if (!fundDetails) {
        return res.status(400).json({ msg: 'Invalid scheme code' });
      }
      
      mutualFund = await MutualFund.create({
        schemeCode,
        name: fundDetails.name,
        category: fundDetails.category,
        latestNav: fundDetails.latestNav,
        navDate: fundDetails.navDate
      });
    }

    // Create holding
    const holding = await Holding.create({
      portfolioId: portfolio.id,
      schemeCode,
      units,
      buyPrice,
      buyDate: buyDate || new Date()
    });

    res.status(201).json(holding);
  } catch (err) {
    next(err);
  }
});

// @route   POST api/portfolios/upload
// @desc    Upload portfolio data (CSV/JSON)
// @access  Private
router.post('/upload', auth, async (req, res, next) => {
  try {
    if (!req.files || !req.files.portfolio) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const file = req.files.portfolio;
    const portfolioName = req.body.name || 'Imported Portfolio';
    
    // Parse file
    const portfolioData = await parsePortfolioFile(file);
    
    if (!portfolioData || !portfolioData.length) {
      return res.status(400).json({ msg: 'Invalid or empty file' });
    }

    // Create portfolio
    const portfolio = await Portfolio.create({
      name: portfolioName,
      userId: req.user.id
    });

    // Process each fund in the portfolio
    for (const fund of portfolioData) {
      // Check if mutual fund exists, if not create it
      let mutualFund = await MutualFund.findOne({ 
        where: { schemeCode: fund.schemeCode } 
      });
      
      if (!mutualFund) {
        const fundDetails = await getFundDetails(fund.schemeCode);
        
        if (fundDetails) {
          mutualFund = await MutualFund.create({
            schemeCode: fund.schemeCode,
            name: fundDetails.name,
            category: fundDetails.category,
            latestNav: fundDetails.latestNav,
            navDate: fundDetails.navDate
          });
        }
      }

      if (mutualFund) {
        // Create holding
        await Holding.create({
          portfolioId: portfolio.id,
          schemeCode: fund.schemeCode,
          units: fund.units,
          buyPrice: fund.buyPrice,
          buyDate: fund.buyDate || new Date()
        });
      }
    }

    res.status(201).json({ 
      msg: 'Portfolio uploaded successfully',
      portfolioId: portfolio.id 
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE api/portfolios/:id
// @desc    Delete a portfolio
// @access  Private
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }

    // Delete associated holdings
    await Holding.destroy({
      where: { portfolioId: portfolio.id }
    });

    // Delete portfolio
    await portfolio.destroy();

    res.json({ msg: 'Portfolio deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;