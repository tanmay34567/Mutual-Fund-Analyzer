import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { compareFunds } from '../api/mutualFunds';
import './Compare.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Compare = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState('1y');
  const [chartData, setChartData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Get scheme codes from URL query params
        const params = new URLSearchParams(location.search);
        const fundParams = params.get('funds');
        
        if (!fundParams) {
          setError('No funds selected for comparison');
          setLoading(false);
          return;
        }
        
        let data = await compareFunds(fundParams, duration);
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
          console.warn('Comparison data is not an array, converting to array format');
          // If data is not an array, try to convert it or create a default array
          if (data && typeof data === 'object') {
            // If it's an object, wrap it in an array
            data = [data];
          } else {
            // If it's neither an array nor an object, create an empty array
            data = [];
          }
        }
        
        setFunds(data);
        
        // Prepare chart data only if we have valid data
        if (data.length > 0) {
          prepareChartData(data);
          // Calculate performance metrics
          calculatePerformanceMetrics(data);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching comparison data:', err);
        setError('Failed to load comparison data');
        setLoading(false);
      }
    };

    fetchData();
  }, [location.search, duration]);

  const prepareChartData = (fundsData) => {
    if (!fundsData || !Array.isArray(fundsData) || fundsData.length === 0) return;
    
    // Get all unique dates across all funds
    const allDates = new Set();
    fundsData.forEach(fund => {
      // Check if fund and historicalData exist and historicalData is an array
      if (fund && fund.historicalData && Array.isArray(fund.historicalData)) {
        fund.historicalData.forEach(item => {
          if (item && item.date) {
            allDates.add(item.date);
          }
        });
      }
    });
    
    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    // Create datasets for each fund
    const datasets = fundsData.map((fund, index) => {
      // Generate a color based on index
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
      const color = colors[index % colors.length];
      
      // Create a map of date to NAV for quick lookup
      const dateNavMap = {};
      // Check if historicalData exists and is an array
      if (fund.historicalData && Array.isArray(fund.historicalData)) {
        fund.historicalData.forEach(item => {
          if (item && item.date && item.nav !== undefined) {
            dateNavMap[item.date] = item.nav;
          }
        });
      }
      
      // For each date, get the NAV if available, otherwise null
      const navValues = sortedDates.map(date => dateNavMap[date] || null);
      
      return {
        label: fund.name,
        data: navValues,
        borderColor: color,
        backgroundColor: `${color}33`, // Add transparency
        tension: 0.1,
        pointRadius: 1,
        pointHoverRadius: 5
      };
    });
    
    setChartData({
      labels: sortedDates,
      datasets
    });
  };

  const calculatePerformanceMetrics = (fundsData) => {
    if (!fundsData || !Array.isArray(fundsData) || fundsData.length === 0) return;
    
    const metrics = fundsData.map(fund => {
      // Check if fund and historicalData exist and are valid
      if (!fund || !fund.historicalData || !Array.isArray(fund.historicalData)) {
        return {
          name: fund?.name || 'Unknown Fund',
          returns: {
            oneMonth: 'N/A',
            threeMonths: 'N/A',
            sixMonths: 'N/A',
            oneYear: 'N/A'
          },
          volatility: 'N/A',
          latestNav: 'N/A'
        };
      }
      
      const historicalData = fund.historicalData;
      if (historicalData.length < 2) {
        return {
          name: fund.name || 'Unknown Fund',
          returns: {
            oneMonth: 'N/A',
            threeMonths: 'N/A',
            sixMonths: 'N/A',
            oneYear: 'N/A'
          },
          volatility: 'N/A',
          latestNav: historicalData.length > 0 && historicalData[0].nav !== undefined ? historicalData[0].nav : 'N/A'
        };
      }
      
      // Sort data by date (newest first)
      const sortedData = [...historicalData].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Get latest NAV
      const latestNav = sortedData[0].nav;
      
      // Calculate returns for different periods
      const returns = {};
      
      // Find NAV values at different time points
      const oneMonthIndex = findIndexForDaysAgo(sortedData, 30);
      const threeMonthsIndex = findIndexForDaysAgo(sortedData, 90);
      const sixMonthsIndex = findIndexForDaysAgo(sortedData, 180);
      const oneYearIndex = findIndexForDaysAgo(sortedData, 365);
      
      returns.oneMonth = oneMonthIndex !== -1 ? calculateReturn(latestNav, sortedData[oneMonthIndex].nav) : 'N/A';
      returns.threeMonths = threeMonthsIndex !== -1 ? calculateReturn(latestNav, sortedData[threeMonthsIndex].nav) : 'N/A';
      returns.sixMonths = sixMonthsIndex !== -1 ? calculateReturn(latestNav, sortedData[sixMonthsIndex].nav) : 'N/A';
      returns.oneYear = oneYearIndex !== -1 ? calculateReturn(latestNav, sortedData[oneYearIndex].nav) : 'N/A';
      
      // Calculate volatility (standard deviation of daily returns)
      const dailyReturns = [];
      for (let i = 1; i < sortedData.length; i++) {
        const todayNav = sortedData[i-1].nav;
        const yesterdayNav = sortedData[i].nav;
        const dailyReturn = (todayNav - yesterdayNav) / yesterdayNav;
        dailyReturns.push(dailyReturn);
      }
      
      const volatility = calculateStandardDeviation(dailyReturns) * Math.sqrt(252); // Annualized
      
      return {
        name: fund.name,
        returns,
        volatility: volatility.toFixed(2) + '%',
        latestNav
      };
    });
    
    setPerformanceData(metrics);
  };

  // Helper function to find index for a date that's approximately X days ago
  const findIndexForDaysAgo = (sortedData, days) => {
    const latestDate = new Date(sortedData[0].date);
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - days);
    
    // Find the closest date
    for (let i = 0; i < sortedData.length; i++) {
      const currentDate = new Date(sortedData[i].date);
      if (currentDate <= targetDate) {
        return i;
      }
    }
    
    return -1; // Not found
  };

  // Calculate percentage return
  const calculateReturn = (currentValue, previousValue) => {
    const returnValue = ((currentValue - previousValue) / previousValue) * 100;
    return returnValue.toFixed(2) + '%';
  };

  // Calculate standard deviation
  const calculateStandardDeviation = (values) => {
    const n = values.length;
    if (n === 0) return 0;
    
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n;
    
    return Math.sqrt(variance) * 100; // Convert to percentage
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="compare-container">
        <div className="loading">Loading comparison data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="compare-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={handleBackToHome}>Back to Home</button>
      </div>
    );
  }

  return (
    <div className="compare-container">
      <h1>Mutual Fund Comparison</h1>
      
      <div className="duration-selector">
        {['1m', '3m', '6m', '1y', '3y', '5y'].map(d => (
          <button
            key={d}
            className={`duration-btn ${duration === d ? 'active' : ''}`}
            onClick={() => handleDurationChange(d)}
          >
            {d.toUpperCase()}
          </button>
        ))}
      </div>
      
      {funds.length > 0 && (
        <div className="comparison-section">
          <div className="comparison-card">
            <h2>NAV Comparison</h2>
            <div className="chart-container">
              {chartData && (
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: true,
                        text: 'NAV History Comparison'
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.dataset.label}: ₹${context.parsed.y.toFixed(2)}`;
                          }
                        }
                      }
                    },
                    scales: {
                      x: {
                        ticks: {
                          maxTicksLimit: 10
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
          
          {performanceData && (
            <div className="comparison-card">
              <h2>Performance Metrics</h2>
              <div className="metrics-table-container">
                <table className="metrics-table">
                  <thead>
                    <tr>
                      <th>Fund Name</th>
                      <th>Latest NAV</th>
                      <th>1 Month</th>
                      <th>3 Months</th>
                      <th>6 Months</th>
                      <th>1 Year</th>
                      <th>Volatility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.map((fund, index) => (
                      <tr key={index}>
                        <td>{fund.name}</td>
                        <td>₹{typeof fund.latestNav === 'number' ? fund.latestNav.toFixed(2) : 'N/A'}</td>
                        <td className={fund.returns.oneMonth !== 'N/A' && parseFloat(fund.returns.oneMonth) >= 0 ? 'positive' : 'negative'}>
                          {fund.returns.oneMonth}
                        </td>
                        <td className={fund.returns.threeMonths !== 'N/A' && parseFloat(fund.returns.threeMonths) >= 0 ? 'positive' : 'negative'}>
                          {fund.returns.threeMonths}
                        </td>
                        <td className={fund.returns.sixMonths !== 'N/A' && parseFloat(fund.returns.sixMonths) >= 0 ? 'positive' : 'negative'}>
                          {fund.returns.sixMonths}
                        </td>
                        <td className={fund.returns.oneYear !== 'N/A' && parseFloat(fund.returns.oneYear) >= 0 ? 'positive' : 'negative'}>
                          {fund.returns.oneYear}
                        </td>
                        <td>{fund.volatility}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="fund-details-section">
            {funds.map((fund, index) => (
              <div key={index} className="fund-detail-card">
                <h3>{fund.name}</h3>
                <div className="fund-info">
                  <p><strong>Fund House:</strong> {fund.fundHouse}</p>
                  <p><strong>Category:</strong> {fund.category}</p>
                  <p><strong>Scheme Code:</strong> {fund.schemeCode}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <button className="back-button" onClick={handleBackToHome}>Back to Home</button>
    </div>
  );
};

export default Compare;
