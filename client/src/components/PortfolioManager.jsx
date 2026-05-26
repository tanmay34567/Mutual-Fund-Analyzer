import React, { useState, useEffect } from 'react';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import axios from 'axios';
import { searchFunds, getLatestNav } from '../api/mutualFunds';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './PortfolioManager.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PortfolioManager = () => {
  // Get auth context
  const { currentUser, loading: authLoading } = useAuth();
  
  // State for portfolio list
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State for portfolio creation form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    portfolioName: '',
    description: '',
    holdings: []
  });
  
  // State for fund search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // State for holding being added
  const [currentHolding, setCurrentHolding] = useState({
    schemeCode: '',
    schemeName: '',
    units: '',
    buyPrice: '',
    buyDate: '',
    investmentAmount: '',
    latestNav: null,
    navDate: null,
    category: '',
    fundHouse: ''
  });
  
  // State for selected portfolio to view
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  
  // Load user portfolios on component mount
  useEffect(() => {
    fetchUserPortfolios();
  }, []);
  
  // Add click outside handler to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      const searchContainer = document.querySelector('.fund-search-container');
      if (searchContainer && !searchContainer.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Fetch user portfolios from backend
  const fetchUserPortfolios = async () => {
    try {
      setLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('No authentication token found, showing sample data');
        // Show sample data if not authenticated
        const samplePortfolios = [
          {
            id: 'sample1',
            portfolioName: 'Sample Portfolio (Login to create your own)',
            description: 'This is a sample portfolio. Login to create and manage your own portfolios.',
            createdAt: new Date().toISOString(),
            holdings: [],
            totalInvestment: 0,
            currentValue: 0,
            absoluteReturn: 0,
            xirr: 0,
            cagr: 0,
            volatility: { value: 0, rating: 'N/A' }
          }
        ];
        setPortfolios(samplePortfolios);
        setLoading(false);
        return;
      }
      
      // Make authenticated API call to fetch portfolios
      const response = await axios.get(`${config.apiUrl}/portfolios`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Process the portfolio data to match our component's expected format
      const processedPortfolios = response.data.map(portfolio => {
        // Process holdings to include calculated values
        const processedHoldings = portfolio.holdings.map(holding => {
          const mutualFund = holding.MutualFund || {};
          const units = parseFloat(holding.units);
          const buyPrice = parseFloat(holding.buyPrice);
          const currentNav = parseFloat(mutualFund.latestNav || buyPrice);
          const investmentValue = units * buyPrice;
          const currentValue = units * currentNav;
          const profit = currentValue - investmentValue;
          const returnPercentage = investmentValue > 0 ? (profit / investmentValue) * 100 : 0;
          
          return {
            schemeCode: holding.schemeCode,
            schemeName: mutualFund.name || `Fund ${holding.schemeCode}`,
            units: units,
            buyPrice: buyPrice,
            buyDate: holding.buyDate,
            currentNav: currentNav,
            investmentValue: investmentValue,
            currentValue: currentValue,
            profit: profit,
            returnPercentage: returnPercentage,
            category: mutualFund.category || 'N/A'
          };
        });
        
        // Calculate portfolio-level metrics
        const totalInvestment = processedHoldings.reduce((sum, holding) => sum + holding.investmentValue, 0);
        const currentValue = processedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
        const absoluteReturn = totalInvestment > 0 ? ((currentValue - totalInvestment) / totalInvestment) * 100 : 0;
        
        // Simple CAGR calculation (simplified for demo)
        const oldestHolding = processedHoldings.reduce((oldest, holding) => {
          const holdingDate = new Date(holding.buyDate);
          return !oldest || holdingDate < new Date(oldest.buyDate) ? holding : oldest;
        }, null);
        
        const years = oldestHolding ? 
          (new Date() - new Date(oldestHolding.buyDate)) / (365 * 24 * 60 * 60 * 1000) : 1;
        
        const cagr = years > 0 ? 
          (Math.pow((currentValue / totalInvestment), (1 / years)) - 1) * 100 : absoluteReturn;
        
        // Calculate volatility based on category mix
        const categoryValues = {};
        processedHoldings.forEach(holding => {
          const category = holding.category;
          if (!categoryValues[category]) categoryValues[category] = 0;
          categoryValues[category] += holding.currentValue;
        });
        
        // Assign volatility rating based on equity percentage
        const equityValue = categoryValues['Equity'] || 0;
        const equityPercentage = currentValue > 0 ? (equityValue / currentValue) * 100 : 0;
        let volatilityRating = 'Low';
        if (equityPercentage > 70) volatilityRating = 'High';
        else if (equityPercentage > 30) volatilityRating = 'Medium';
        
        return {
          id: portfolio.id,
          portfolioName: portfolio.name,
          description: portfolio.description || '',
          createdAt: portfolio.createdAt,
          holdings: processedHoldings,
          totalInvestment: totalInvestment,
          currentValue: currentValue,
          absoluteReturn: absoluteReturn,
          xirr: absoluteReturn * 1.1, // Simplified approximation
          cagr: cagr,
          volatility: { 
            value: equityPercentage / 10, // Simplified volatility value
            rating: volatilityRating 
          }
        };
      });
      
      setPortfolios(processedPortfolios);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
      // For demo purposes, create some sample portfolios if API fails
      const samplePortfolios = [
        {
          id: '1',
          portfolioName: 'Sample Equity Portfolio',
          description: 'Sample equity investments (API connection failed)',
          createdAt: new Date().toISOString(),
          holdings: [
            {
              schemeCode: '120503',
              schemeName: 'SBI Blue Chip Fund-Regular Plan-Growth',
              units: 100,
              buyPrice: 45.67,
              buyDate: '2023-01-15',
              currentNav: 52.34,
              investmentValue: 4567,
              currentValue: 5234,
              profit: 667,
              returnPercentage: 14.6,
              category: 'Equity'
            }
          ],
          totalInvestment: 4567,
          currentValue: 5234,
          absoluteReturn: 14.6,
          xirr: 16.2,
          cagr: 15.4,
          volatility: { value: 12.5, rating: 'Medium' }
        }
      ];
      setPortfolios(samplePortfolios);
      setLoading(false);
    }
  };
  
  // Handle fund search input change
  const handleSearchInputChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      const data = await searchFunds(query);
      setSearchResults(data.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(true);
      setSearchLoading(false);
    } catch (error) {
      console.error('Error fetching fund suggestions:', error);
      setSearchLoading(false);
    }
  };
  
  // Handle fund selection from search results
  const handleSelectFund = async (fund) => {
    setSearchLoading(true);
    try {
      // Fetch latest NAV data for the selected fund
      const navData = await getLatestNav(fund.schemeCode);
      
      setCurrentHolding({
        ...currentHolding,
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName || fund.name || navData.name || `Fund ${fund.schemeCode}`,
        buyPrice: navData.latestNav || '',
        category: navData.category || '',
        fundHouse: navData.fundHouse || '',
        latestNav: navData.latestNav || null,
        navDate: navData.navDate || null
      });
      
      setSearchQuery(fund.schemeName || fund.name || navData.name || `Fund ${fund.schemeCode}`);
    } catch (error) {
      console.error('Error fetching NAV data:', error);
      // Still set the basic fund info even if NAV fetch fails
      setCurrentHolding({
        ...currentHolding,
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName || fund.name || `Fund ${fund.schemeCode}`
      });
      setSearchQuery(fund.schemeName || fund.name || `Fund ${fund.schemeCode}`);
    } finally {
      setSearchLoading(false);
      setShowSuggestions(false);
    }
  };
  
  // Handle input change for holding form
  const handleHoldingInputChange = (e) => {
    const { name, value } = e.target;
    const updatedHolding = { ...currentHolding, [name]: value };
    
    // Auto-calculate based on NAV
    if (currentHolding.latestNav) {
      const nav = currentHolding.latestNav;
      
      // If units changed, calculate investment amount
      if (name === 'units' && value) {
        const units = parseFloat(value);
        if (!isNaN(units) && units > 0) {
          updatedHolding.investmentAmount = (units * nav).toFixed(2);
        }
      }
      
      // If investment amount changed, calculate units
      if (name === 'investmentAmount' && value) {
        const amount = parseFloat(value);
        if (!isNaN(amount) && amount > 0) {
          updatedHolding.units = (amount / nav).toFixed(4);
        }
      }
    }
    
    setCurrentHolding(updatedHolding);
  };
  
  // Add holding to portfolio
  const handleAddHolding = () => {
    // Validate inputs
    if (!currentHolding.schemeCode || !currentHolding.units || !currentHolding.buyPrice || !currentHolding.buyDate) {
      alert('Please fill all required fields');
      return;
    }
    
    // Calculate investment value
    const units = parseFloat(currentHolding.units);
    const buyPrice = parseFloat(currentHolding.buyPrice);
    const investmentValue = units * buyPrice;
    
    // Use latest NAV for current value calculations
    const currentNav = currentHolding.latestNav || buyPrice;
    const currentValue = units * currentNav;
    const profit = currentValue - investmentValue;
    const returnPercentage = investmentValue > 0 ? (profit / investmentValue) * 100 : 0;
    
    // Add holding to form data
    const newHolding = {
      ...currentHolding,
      units: units,
      buyPrice: buyPrice,
      investmentValue: investmentValue,
      currentNav: currentNav,
      currentValue: currentValue,
      profit: profit,
      returnPercentage: returnPercentage,
      category: currentHolding.category || 'N/A'
    };
    
    setFormData({
      ...formData,
      holdings: [...formData.holdings, newHolding]
    });
    
    // Reset current holding form
    setCurrentHolding({
      schemeCode: '',
      schemeName: '',
      units: '',
      buyPrice: '',
      buyDate: '',
      investmentAmount: '',
      latestNav: null,
      navDate: null,
      category: '',
      fundHouse: ''
    });
    setSearchQuery('');
  };
  
  // Remove holding from form
  const handleRemoveHolding = (index) => {
    const updatedHoldings = [...formData.holdings];
    updatedHoldings.splice(index, 1);
    setFormData({
      ...formData,
      holdings: updatedHoldings
    });
  };
  
  // Handle form input change
  const handleFormInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Create new portfolio
  const handleCreatePortfolio = async () => {
    // Validate form
    if (!formData.portfolioName || formData.holdings.length === 0) {
      alert('Please provide a portfolio name and add at least one holding');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('You must be logged in to create a portfolio');
        setLoading(false);
        return;
      }
      
      // Set up headers with authentication token
      const headers = {
        'x-auth-token': token,
        'Authorization': `Bearer ${token}`
      };
      
      // First create the portfolio
      const portfolioResponse = await axios.post(`${config.apiUrl}/portfolios`, {
        name: formData.portfolioName,
        description: formData.description
      }, { headers });
      
      const portfolioId = portfolioResponse.data.id;
      
      // Then add each holding to the portfolio
      for (const holding of formData.holdings) {
        await axios.post(`${config.apiUrl}/portfolios/${portfolioId}/holdings`, {
          schemeCode: holding.schemeCode,
          units: holding.units,
          buyPrice: holding.buyPrice,
          buyDate: holding.buyDate
        }, { headers });
      }
      
      // Fetch updated portfolios to reflect the changes
      await fetchUserPortfolios();
      
      // Reset form
      setFormData({
        portfolioName: '',
        description: '',
        holdings: []
      });
      
      // Close form
      setShowForm(false);
      setLoading(false);
      
    } catch (error) {
      console.error('Error creating portfolio:', error);
      if (error.response?.status === 401) {
        alert('Authentication failed. Please log in again.');
      } else {
        alert('Failed to create portfolio. Please try again.');
      }
      setLoading(false);
    }
  };
  
  // Delete portfolio
  const handleDeletePortfolio = async (portfolioId) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('You must be logged in to delete a portfolio');
        setLoading(false);
        return;
      }
      
      // Call the API to delete the portfolio with authentication headers
      await axios.delete(`${config.apiUrl}/portfolios/${portfolioId}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Remove portfolio from state
      const updatedPortfolios = portfolios.filter(p => p.id !== portfolioId);
      setPortfolios(updatedPortfolios);
      
      // If the deleted portfolio was selected, deselect it
      if (selectedPortfolio && selectedPortfolio.id === portfolioId) {
        setSelectedPortfolio(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      if (error.response?.status === 401) {
        alert('Authentication failed. Please log in again.');
      } else {
        alert('Failed to delete portfolio. Please try again.');
      }
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Get portfolio allocation chart data
  const getPortfolioAllocationData = (portfolio) => {
    if (!portfolio?.holdings || portfolio.holdings.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e0e0e0'],
          borderWidth: 1
        }]
      };
    }

    // Group holdings by category
    const categoryMap = {};
    
    portfolio.holdings.forEach(holding => {
      const category = holding.category || 'Unknown';
      const value = holding.currentValue;
      
      if (categoryMap[category]) {
        categoryMap[category] += value;
      } else {
        categoryMap[category] = value;
      }
    });

    const categories = Object.keys(categoryMap);
    const values = Object.values(categoryMap);
    
    // Colors for chart
    const backgroundColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#8BC34A', '#607D8B', '#E91E63', '#2196F3'
    ];

    return {
      labels: categories,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors.slice(0, categories.length),
        borderWidth: 1
      }]
    };
  };
  
  // Get holdings distribution chart data
  const getHoldingsDistributionData = (portfolio) => {
    if (!portfolio?.holdings || portfolio.holdings.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e0e0e0'],
          borderWidth: 1
        }]
      };
    }
    
    const labels = portfolio.holdings.map(h => h.schemeName.split('-')[0]); // Shorten names
    const values = portfolio.holdings.map(h => h.currentValue);
    
    // Colors for chart
    const backgroundColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#8BC34A', '#607D8B', '#E91E63', '#2196F3'
    ];
    
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors.slice(0, labels.length),
        borderWidth: 1
      }]
    };
  };
  
  // Get performance comparison chart data
  const getPerformanceComparisonData = (portfolio) => {
    if (!portfolio?.holdings || portfolio.holdings.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'No Data',
          data: [0],
          backgroundColor: '#e0e0e0',
          borderColor: '#e0e0e0',
          borderWidth: 1
        }]
      };
    }
    
    const labels = portfolio.holdings.map(h => h.schemeName.split('-')[0]); // Shorten names
    const returnValues = portfolio.holdings.map(h => h.returnPercentage);
    
    return {
      labels,
      datasets: [{
        label: 'Return %',
        data: returnValues,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };
  };
  
  return (
    <div className="portfolio-manager">
      <div className="portfolio-manager-header">
        <h2>Portfolio Manager</h2>
        <button 
          className="create-portfolio-btn"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) {
              setFormData({
                portfolioName: '',
                description: '',
                holdings: []
              });
            }
          }}
        >
          {showForm ? 'Cancel' : 'Create New Portfolio'}
        </button>
      </div>
      
      {/* Portfolio Creation Form */}
      {showForm && (
        <div className="portfolio-form-container">
          <h3>Create New Portfolio</h3>
          <div className="portfolio-form">
            <div className="form-group">
              <label>Portfolio Name</label>
              <input 
                type="text"
                name="portfolioName"
                value={formData.portfolioName}
                onChange={handleFormInputChange}
                placeholder="Enter portfolio name"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormInputChange}
                placeholder="Enter portfolio description"
                rows="3"
              />
            </div>
            
            <div className="holdings-section">
              <h4>Holdings</h4>
              
              {/* Add Holding Form */}
              <div className="add-holding-form">
                <div className="form-group fund-search-container">
                  <label>Search Fund</label>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    placeholder="Search for mutual funds..."
                    autoComplete="off"
                  />
                  {searchLoading && <div className="search-spinner"></div>}
                  
                  {showSuggestions && searchResults.length > 0 && (
                    <div className="search-suggestions">
                      {searchResults.map((fund) => (
                        <div 
                          key={fund.schemeCode} 
                          className="suggestion-item"
                          onClick={() => handleSelectFund(fund)}
                        >
                          <div className="suggestion-name">{fund.schemeName || fund.name || `Fund ${fund.schemeCode}`}</div>
                          <div className="suggestion-code">Code: {fund.schemeCode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {currentHolding.latestNav && (
                  <div className="nav-info">
                    <div className="nav-data">
                      <span className="nav-label">Latest NAV:</span>
                      <span className="nav-value">₹{currentHolding.latestNav.toFixed(2)}</span>
                    </div>
                    {currentHolding.navDate && (
                      <div className="nav-data">
                        <span className="nav-label">As of:</span>
                        <span className="nav-value">{new Date(currentHolding.navDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {currentHolding.category && (
                      <div className="nav-data">
                        <span className="nav-label">Category:</span>
                        <span className="nav-value">{currentHolding.category}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Investment Amount (₹)</label>
                    <input 
                      type="number"
                      name="investmentAmount"
                      value={currentHolding.investmentAmount}
                      onChange={handleHoldingInputChange}
                      placeholder="Amount to invest"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Units</label>
                    <input 
                      type="number"
                      name="units"
                      value={currentHolding.units}
                      onChange={handleHoldingInputChange}
                      placeholder="Number of units"
                      min="0"
                      step="0.0001"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Buy Price (₹)</label>
                    <input 
                      type="number"
                      name="buyPrice"
                      value={currentHolding.buyPrice}
                      onChange={handleHoldingInputChange}
                      placeholder="NAV at purchase"
                      min="0"
                      step="0.01"
                      readOnly={currentHolding.latestNav !== null}
                    />
                    {currentHolding.latestNav && (
                      <small className="form-text">Using latest NAV as buy price</small>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Buy Date</label>
                    <input 
                      type="date"
                      name="buyDate"
                      value={currentHolding.buyDate}
                      onChange={handleHoldingInputChange}
                    />
                  </div>
                </div>
                
                <button 
                  className="add-holding-btn"
                  onClick={handleAddHolding}
                  disabled={!currentHolding.schemeCode || !currentHolding.units || !currentHolding.buyPrice || !currentHolding.buyDate}
                >
                  Add Holding
                </button>
              </div>
              
              {/* Holdings List */}
              {formData.holdings.length > 0 ? (
                <div className="holdings-list">
                  <h4>Added Holdings</h4>
                  <table className="holdings-table">
                    <thead>
                      <tr>
                        <th>Fund Name</th>
                        <th>Units</th>
                        <th>Buy Price</th>
                        <th>Buy Date</th>
                        <th>Investment</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.holdings.map((holding, index) => (
                        <tr key={index}>
                          <td>{holding.schemeName}</td>
                          <td>{holding.units}</td>
                          <td>₹{parseFloat(holding.buyPrice).toFixed(2)}</td>
                          <td>{holding.buyDate}</td>
                          <td>₹{holding.investmentValue.toFixed(2)}</td>
                          <td>
                            <button 
                              className="remove-btn"
                              onClick={() => handleRemoveHolding(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="no-holdings-message">No holdings added yet</p>
              )}
            </div>
            
            <div className="form-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    portfolioName: '',
                    description: '',
                    holdings: []
                  });
                }}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleCreatePortfolio}
                disabled={!formData.portfolioName || formData.holdings.length === 0}
              >
                Create Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Portfolios List */}
      <div className="portfolios-list-section">
        <h3>Your Portfolios</h3>
        {loading ? (
          <div className="loading">Loading portfolios...</div>
        ) : portfolios.length === 0 ? (
          <div className="no-portfolios">
            <p>You don't have any portfolios yet.</p>
            <button 
              className="create-portfolio-btn"
              onClick={() => setShowForm(true)}
            >
              Create Your First Portfolio
            </button>
          </div>
        ) : (
          <div className="portfolios-list">
            {portfolios.map(portfolio => (
              <div key={portfolio.id} className="portfolio-card">
                <div className="portfolio-card-header">
                  <h3>{portfolio.portfolioName}</h3>
                  <div className="portfolio-actions">
                    <button 
                      className="view-btn"
                      onClick={() => setSelectedPortfolio(portfolio)}
                    >
                      View Details
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeletePortfolio(portfolio.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="portfolio-card-body">
                  <p className="portfolio-description">{portfolio.description}</p>
                  <div className="portfolio-metrics">
                    <div className="metric">
                      <span className="metric-label">Investment</span>
                      <span className="metric-value">{formatCurrency(portfolio.totalInvestment)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Current Value</span>
                      <span className="metric-value">{formatCurrency(portfolio.currentValue)}</span>
                    </div>
                    <div className="metric">
                      <span className={`metric-value ${(portfolio.absoluteReturn || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(portfolio.absoluteReturn || 0) >= 0 ? '+' : ''}{(portfolio.absoluteReturn || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Portfolio Details */}
      {selectedPortfolio && (
        <div className="portfolio-details">
          <div className="portfolio-details-header">
            <h3>{selectedPortfolio.portfolioName} - Details</h3>
            <button 
              className="close-btn"
              onClick={() => setSelectedPortfolio(null)}
            >
              Close
            </button>
          </div>
          
          <div className="portfolio-summary">
            <div className="portfolio-metrics-card">
              <h4>Performance Metrics</h4>
              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Total Investment</span>
                  <span className="metric-value">{formatCurrency(selectedPortfolio.totalInvestment)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Current Value</span>
                  <span className="metric-value">{formatCurrency(selectedPortfolio.currentValue)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Absolute Return</span>
                  <span className={`metric-value ${(selectedPortfolio.absoluteReturn || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(selectedPortfolio.absoluteReturn || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">XIRR</span>
                  <span className={`metric-value ${(selectedPortfolio.xirr || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(selectedPortfolio.xirr || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">CAGR</span>
                  <span className={`metric-value ${(selectedPortfolio.cagr || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(selectedPortfolio.cagr || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Volatility</span>
                  <span className="metric-value">{(selectedPortfolio.volatility?.value || 0).toFixed(2)}% ({selectedPortfolio.volatility?.rating || 'N/A'})</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="portfolio-charts">
            <div className="chart-card">
              <h4>Asset Allocation</h4>
              <div className="chart-container">
                <Doughnut 
                  data={getPortfolioAllocationData(selectedPortfolio)} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                      },
                      title: {
                        display: true,
                        text: 'Allocation by Category'
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="chart-card">
              <h4>Holdings Distribution</h4>
              <div className="chart-container">
                <Pie 
                  data={getHoldingsDistributionData(selectedPortfolio)} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                      },
                      title: {
                        display: true,
                        text: 'Distribution by Fund'
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="chart-card">
              <h4>Performance Comparison</h4>
              <div className="chart-container">
                <Bar 
                  data={getPerformanceComparisonData(selectedPortfolio)} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      title: {
                        display: true,
                        text: 'Return % by Fund'
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Return %'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="holdings-details">
            <h4>Holdings</h4>
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Fund Name</th>
                  <th>Category</th>
                  <th>Units</th>
                  <th>Buy Price</th>
                  <th>Current NAV</th>
                  <th>Investment</th>
                  <th>Current Value</th>
                  <th>Profit/Loss</th>
                  <th>Return %</th>
                </tr>
              </thead>
              <tbody>
                {selectedPortfolio.holdings.map((holding, index) => (
                  <tr key={index}>
                    <td>{holding.schemeName}</td>
                    <td>{holding.category || 'N/A'}</td>
                    <td>{holding.units.toFixed(2)}</td>
                    <td>₹{holding.buyPrice.toFixed(2)}</td>
                    <td>₹{holding.currentNav.toFixed(2)}</td>
                    <td>{formatCurrency(holding.investmentValue)}</td>
                    <td>{formatCurrency(holding.currentValue)}</td>
                    <td className={holding.profit >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(holding.profit)}
                    </td>
                    <td className={holding.returnPercentage >= 0 ? 'positive' : 'negative'}>
                      {holding.returnPercentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioManager;
