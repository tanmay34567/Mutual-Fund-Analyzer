import React, { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { useAuth } from '../context/AuthContext'
import { getFundDetails } from '../api/mutualFunds'
import { apiClient } from '../api/axiosConfig'
import Spinner from '../components/Spinner'
import './Portfolio.css'

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
)

const Portfolio = () => {
  const { id } = useParams()
  const { currentUser, loading: authLoading } = useAuth()
  const [fund, setFund] = useState(null)
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState('1y')

  useEffect(() => {
    // Fetch data regardless of authentication status
    const fetchData = async () => {
      try {
        setLoading(true)
        // Use the updated API function that directly calls the mutual fund API
        const fundData = await getFundDetails(id, duration)
        setFund(fundData)
        
        // Check if user is authenticated and has portfolios
        if (currentUser) {
          try {
            // First, get the user's portfolios to check if this fund is in any of them
            const portfoliosRes = await apiClient.get('/portfolios')
            const portfolios = portfoliosRes.data
            
            // Find portfolios that contain this fund
            const matchingPortfolios = portfolios.filter(portfolio => 
              portfolio.holdings.some(holding => holding.schemeCode === id)
            )
            
            // If this fund is in at least one portfolio, get analysis for the first one
            if (matchingPortfolios.length > 0) {
              const portfolioId = matchingPortfolios[0].id
              const analysisRes = await apiClient.get(`/analyze/portfolio/${portfolioId}`)
              setPortfolioAnalysis(analysisRes.data)
            } else {
              // If no matching portfolio, we'll just show the fund data without analysis
              console.log('This fund is not in any of your portfolios')
            }
          } catch (analysisErr) {
            console.error('Error fetching portfolio analysis:', analysisErr)
            // If portfolio analysis fails, we can still show the fund data
          }
        }
        
        setLoading(false)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load portfolio details. Please try again later.')
        setLoading(false)
      }
    }

    fetchData()
  }, [id, currentUser, duration])

  if (loading) return <Spinner />

  if (error) return (
    <div className="error-message">
      {error}
    </div>
  )

  // Helper function to get portfolio allocation chart data
  const getPortfolioAllocationData = () => {
    if (!portfolioAnalysis?.holdings || portfolioAnalysis.holdings.length === 0) {
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
    
    portfolioAnalysis.holdings.forEach(holding => {
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

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="portfolio">
      <div className="portfolio-header">
        <h1>{portfolioAnalysis?.portfolioName || fund?.name}</h1>
        <div className="fund-meta">
          {fund?.category && <p>Category: {fund.category}</p>}
          {fund?.fundHouse && <p>Fund House: {fund.fundHouse}</p>}
        </div>
      </div>

      {/* Portfolio Analysis Section - Only shown when authenticated and data is available */}
      {currentUser && portfolioAnalysis && (
        <div className="analysis-section">
          <h2>Portfolio Analysis</h2>
          
          <div className="portfolio-grid">
            {/* Performance Metrics */}
            <div className="portfolio-card">
              <h2>Performance Metrics</h2>
              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Total Investment</span>
                  <span className="metric-value">{formatCurrency(portfolioAnalysis.totalInvestment)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Current Value</span>
                  <span className="metric-value">{formatCurrency(portfolioAnalysis.currentValue)}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Absolute Return</span>
                  <span className={`metric-value ${portfolioAnalysis.absoluteReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                    {portfolioAnalysis.absoluteReturn.toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">XIRR</span>
                  <span className={`metric-value ${portfolioAnalysis.xirr >= 0 ? 'text-success' : 'text-danger'}`}>
                    {portfolioAnalysis.xirr.toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">CAGR</span>
                  <span className={`metric-value ${portfolioAnalysis.cagr >= 0 ? 'text-success' : 'text-danger'}`}>
                    {portfolioAnalysis.cagr.toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Volatility</span>
                  <span className="metric-value">{portfolioAnalysis.volatility.value.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Portfolio Allocation Chart */}
            <div className="portfolio-card">
              <h2>Asset Allocation</h2>
              <div className="chart-container">
                <Doughnut 
                  data={getPortfolioAllocationData()} 
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
          </div>

          {/* Holdings Table */}
          <div className="portfolio-card">
            <h2>Holdings</h2>
            <div className="holdings-table-container">
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
                  {portfolioAnalysis.holdings.map(holding => (
                    <tr key={holding.id}>
                      <td>{holding.name}</td>
                      <td>{holding.category}</td>
                      <td>{holding.units.toFixed(2)}</td>
                      <td>₹{holding.buyPrice.toFixed(2)}</td>
                      <td>₹{holding.currentNav.toFixed(2)}</td>
                      <td>{formatCurrency(holding.investmentValue)}</td>
                      <td>{formatCurrency(holding.currentValue)}</td>
                      <td className={holding.profit >= 0 ? 'text-success' : 'text-danger'}>
                        {formatCurrency(holding.profit)}
                      </td>
                      <td className={holding.returnPercentage >= 0 ? 'text-success' : 'text-danger'}>
                        {holding.returnPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Diversification Analysis */}
          <div className="portfolio-grid">
            <div className="portfolio-card">
              <h2>Sector Concentration</h2>
              <div className="chart-container">
                {portfolioAnalysis.diversification.sectorConcentration.sectors.length > 0 && (
                  <Pie
                    data={{
                      labels: portfolioAnalysis.diversification.sectorConcentration.sectors.map(s => s.name),
                      datasets: [{
                        data: portfolioAnalysis.diversification.sectorConcentration.sectors.map(s => s.percentage),
                        backgroundColor: [
                          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                          '#FF9F40', '#8BC34A', '#607D8B', '#E91E63', '#2196F3'
                        ].slice(0, portfolioAnalysis.diversification.sectorConcentration.sectors.length),
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                        },
                        title: {
                          display: true,
                          text: 'Sector Allocation'
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            <div className="portfolio-card">
              <h2>Top Holdings</h2>
              <div className="top-holdings">
                {portfolioAnalysis.diversification.topHoldings.map((holding, index) => (
                  <div key={index} className="holding-bar">
                    <div className="holding-name">{holding.name}</div>
                    <div className="holding-bar-container">
                      <div 
                        className="holding-bar-fill" 
                        style={{ width: `${holding.percentage}%`, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5] }}
                      ></div>
                      <span className="holding-percentage">{holding.percentage.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fund Details Section */}
      <div className="portfolio-grid">
        {fund && (
          <div className="portfolio-card">
            <h2>Fund Overview</h2>
            <div className="fund-details">
              <div className="detail-item">
                <span className="label">Latest NAV:</span>
                <span className="value">₹{fund?.latestNav?.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="label">NAV Date:</span>
                <span className="value">{fund?.navDate}</span>
              </div>
            </div>
          </div>
        )}

        {fund?.historicalData && (
          <div className="portfolio-card">
            <h2>NAV Performance</h2>
            <div className="duration-selector">
              {['1m', '3m', '6m', '1y', '3y', '5y'].map(d => (
                <button
                  key={d}
                  className={`duration-btn ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="chart-container">
              <Line
                data={{
                  labels: fund.historicalData.map(d => d.date),
                  datasets: [{
                    label: 'NAV (₹)',
                    data: fund.historicalData.map(d => d.nav),
                    borderColor: '#36A2EB',
                    tension: 0.1
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    title: {
                      display: true,
                      text: 'NAV History'
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {fund?.details && (
        <div className="portfolio-card">
          <h2>Fund Details</h2>
          <div className="fund-details-grid">
            {Object.entries(fund.details.meta || {}).map(([key, value]) => (
              <div key={key} className="detail-item">
                <span className="label">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                <span className="value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



export default Portfolio