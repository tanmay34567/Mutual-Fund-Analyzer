import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTopFunds, searchFunds, compareFunds } from '../api/mutualFunds';
import ParticleSphere from '../components/ParticleSphere';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [topPortfolios, setTopPortfolios] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load initial data only once when the component mounts
  useEffect(() => {
    // Check if we already have data in state
    if (topPortfolios.length === 0) {
      fetchTopPortfolios();
    }
  }, []);
  
  // Add click outside handler to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      const searchContainer = document.querySelector('.search-input-container');
      if (searchContainer && !searchContainer.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const fetchTopPortfolios = async () => {
    try {
      // Set loading to true when starting the fetch
      setLoading(true);
      
      // Using the updated getTopFunds function that directly calls the mutual fund API
      const data = await getTopFunds();
      console.log('Fetched top funds:', data);
      
      // Update the state with the new data
      setTopPortfolios(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching top portfolios:', error);
      setLoading(false);
    }
  };

  // Handle input change and fetch suggestions
  const handleSearchInputChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      // Get all funds and filter by query
      const data = await searchFunds(query);
      setSuggestions(data.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(true);
      setSearchLoading(false);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchLoading(false);
    }
  };
  
  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const data = await searchFunds(searchQuery);
      setSearchResults(data);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error searching portfolios:', error);
    }
  };
  
  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.schemeName);
    setShowSuggestions(false);
    navigate(`/portfolio/${suggestion.schemeCode}`);
  };
  
  const toggleFundSelection = (fund) => {
    setSelectedFunds(prev => {
      // Check if fund is already selected
      const isSelected = prev.some(f => f.schemeCode === fund.schemeCode);
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(f => f.schemeCode !== fund.schemeCode);
      } else {
        // Add to selection (limit to 3 funds)
        if (prev.length >= 3) {
          alert('You can only compare up to 3 funds at a time');
          return prev;
        }
        return [...prev, fund];
      }
    });
  };
  
  const handleCompare = () => {
    if (selectedFunds.length < 2) {
      alert('Please select at least 2 funds to compare');
      return;
    }
    
    const schemeCodes = selectedFunds.map(fund => fund.schemeCode).join(',');
    navigate(`/compare?funds=${schemeCodes}`);
  };

  return (
    <div className="home-container">
      <section className="hero-section-no-card">
        <div className="hero-grid">
          <div className="hero-left-column">
            <div className="hero-chip">
              <span className="hero-chip-icon">◆</span> Build Wealth Digitally
            </div>
            
            <h1>Welcome to Mutual Fund Analyzer</h1>
            
            <div className="hero-description-container">
              <p>Analyze and track your favorite mutual fund portfolios</p>
            </div>

            <div className="search-section">
              <form onSubmit={handleSearch} className="search-form">
                <div className="search-input-container">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    placeholder="Search for mutual funds..."
                    className="search-input"
                    autoComplete="off"
                  />
                  {searchLoading && <div className="search-spinner"></div>}
                  
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="search-suggestions">
                      {suggestions.map((suggestion) => (
                        <div 
                          key={suggestion.schemeCode} 
                          className="suggestion-item"
                          onClick={() => handleSelectSuggestion(suggestion)}
                        >
                          <div className="suggestion-name">{suggestion.schemeName}</div>
                          <div className="suggestion-fund-house">{suggestion.fundHouse || 'Unknown Fund House'}</div>
                          <div className="suggestion-code">Code: {suggestion.schemeCode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="search-button">Search</button>
              </form>
            </div>
            
            <div className="compare-controls">
              <button 
                className="compare-action" 
                onClick={handleCompare}
                disabled={selectedFunds.length < 2}
              >
                Compare Selected ({selectedFunds.length}/3)
              </button>
            </div>
          </div>
          
          <div className="hero-right-column">
            <ParticleSphere />
          </div>
        </div>
      </section>

      <section className="top-portfolios-section">
        <div className="section-header">
          <h2>Random Mutual Funds</h2>
          <button 
            className="refresh-button" 
            onClick={fetchTopPortfolios} 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="portfolios-grid stagger-in">
            {topPortfolios.map((portfolio) => (
              <div 
                key={portfolio.schemeCode} 
                className={`portfolio-card ${selectedFunds.some(f => f.schemeCode === portfolio.schemeCode) ? 'selected' : ''}`}
                onClick={() => toggleFundSelection(portfolio)}
              >
                <h3>{portfolio.schemeName || portfolio.name}</h3>
                <p>NAV: ₹{portfolio.latestNav && portfolio.latestNav !== 0 ? portfolio.latestNav.toFixed(2) : 'N/A'}</p>
                <p>Category: {portfolio.category || 'N/A'}</p>
                <p>Fund House: {portfolio.fundHouse || 'N/A'}</p>
                {(
                  <Link to={`/portfolio/${portfolio.schemeCode}`} className="analyze-button">
                    Analyze
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {searchResults.length > 0 && (
        <section className="search-results-section">
          <h2>Search Results</h2>
          <div className="portfolios-grid">
            {searchResults.map((portfolio) => (
              <div 
                key={portfolio.schemeCode} 
                className={`portfolio-card ${selectedFunds.some(f => f.schemeCode === portfolio.schemeCode) ? 'selected' : ''}`}
                onClick={() => toggleFundSelection(portfolio)}
              >
                <h3>{portfolio.schemeName || portfolio.name}</h3>
                <p>NAV: ₹{portfolio.latestNav && portfolio.latestNav !== 0 ? portfolio.latestNav.toFixed(2) : 'N/A'}</p>
                <p>Category: {portfolio.category || 'N/A'}</p>
                <p>Fund House: {portfolio.fundHouse || 'N/A'}</p>
                {(
                  <Link to={`/portfolio/${portfolio.schemeCode}`} className="analyze-button">
                    Analyze
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
