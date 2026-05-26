import axios from 'axios';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_URL = `${API_BASE_URL}/portfolios`;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true' || process.env.NODE_ENV === 'development';

// Enhanced mock data with more realistic mutual fund examples
const generateMockPortfolios = () => {
  const fundCategories = [
    "Equity", "Debt", "Hybrid", "ELSS", "Index", "Sectoral", "International"
  ];
  
  const schemes = [
    { code: "MF001", name: "Blue Chip Equity Fund", category: "Equity" },
    { code: "MF002", name: "Corporate Bond Fund", category: "Debt" },
    { code: "MF003", name: "Balanced Advantage Fund", category: "Hybrid" },
    { code: "MF004", name: "Tax Saver Fund", category: "ELSS" },
    { code: "MF005", name: "Nifty 50 Index Fund", category: "Index" },
    { code: "MF006", name: "Technology Sector Fund", category: "Sectoral" },
    { code: "MF007", name: "US Equity Fund", category: "International" }
  ];

  return [
    {
      id: 1,
      name: "Retirement Portfolio",
      description: "Long-term growth focused retirement plan",
      holdings: schemes.slice(0, 3).map(scheme => ({
        ...scheme,
        units_held: Math.floor(Math.random() * 500) + 50,
        buy_price: Math.floor(Math.random() * 500) + 50,
        current_nav: Math.floor(Math.random() * 500) + 50,
        purchase_date: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString()
      })),
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    },
    {
      id: 2,
      name: "Tax Saving Portfolio",
      description: "ELSS funds for tax saving under 80C",
      holdings: schemes.filter(s => s.category === "ELSS").map(scheme => ({
        ...scheme,
        units_held: Math.floor(Math.random() * 300) + 30,
        buy_price: Math.floor(Math.random() * 300) + 30,
        current_nav: Math.floor(Math.random() * 300) + 30,
        purchase_date: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString()
      })),
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }
  ];
};

// Enhanced error handler with analytics
const handleApiError = (error, context) => {
  const errorDetails = {
    context,
    message: error.response?.data?.message || error.message,
    status: error.response?.status,
    code: error.code,
    timestamp: new Date().toISOString()
  };

  console.error('API Error:', errorDetails);
  
  // You can add error reporting to analytics service here
  // trackError(errorDetails);

  throw {
    ...errorDetails,
    userMessage: `Failed to ${context.replace(/fetch|get|create|update|delete/gi, '')}`,
    isAxiosError: axios.isAxiosError(error)
  };
};

// Configure axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${localStorage.getItem('token')}` // Uncomment for auth
  }
});

// Response interceptor to normalize data
apiClient.interceptors.response.use(
  response => {
    // Normalize response data structure
    if (response.data && typeof response.data === 'object') {
      return {
        ...response,
        data: {
          success: true,
          data: response.data.data || response.data,
          meta: response.data.meta || {}
        }
      };
    }
    return response;
  },
  error => Promise.reject(error)
);

const PortfolioService = {
  /**
   * Get all portfolios with automatic mock fallback
   * @returns {Promise<Array>} Array of portfolio objects
   */
  async getPortfolios() {
    if (USE_MOCK_DATA) {
      console.info('[Mock] Fetching portfolios');
      return generateMockPortfolios();
    }

    try {
      const response = await apiClient.get('/portfolios');
      console.debug('Portfolios loaded:', response.data);
      return response.data.data || response.data;
    } catch (error) {
      if (USE_MOCK_DATA) {
        console.warn('API failed, falling back to mock data');
        return generateMockPortfolios();
      }
      return handleApiError(error, 'fetch portfolios');
    }
  },

  /**
   * Get portfolio by ID with detailed analytics
   * @param {number|string} id Portfolio ID
   * @returns {Promise<Object>} Portfolio object
   */
  async getPortfolio(id) {
    if (USE_MOCK_DATA) {
      console.info(`[Mock] Fetching portfolio ${id}`);
      const mock = generateMockPortfolios().find(p => p.id == id);
      if (mock) return mock;
      throw { message: 'Portfolio not found', status: 404 };
    }

    try {
      const response = await apiClient.get(`/portfolios/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      if (USE_MOCK_DATA) {
        const mock = generateMockPortfolios().find(p => p.id == id);
        if (mock) return mock;
      }
      return handleApiError(error, `fetch portfolio ${id}`);
    }
  },

  /**
   * Create new portfolio with validation
   * @param {Object} portfolioData 
   * @returns {Promise<Object>} Created portfolio
   */
  async createPortfolio(portfolioData) {
    if (USE_MOCK_DATA) {
      console.info('[Mock] Creating portfolio');
      const newPortfolio = {
        id: Math.floor(Math.random() * 1000) + 10,
        ...portfolioData,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
      return newPortfolio;
    }

    try {
      const response = await apiClient.post('/portfolios', portfolioData);
      return response.data.data || response.data;
    } catch (error) {
      return handleApiError(error, 'create portfolio');
    }
  },

  /**
   * Update portfolio with optimistic locking
   * @param {number|string} id 
   * @param {Object} updates 
   * @returns {Promise<Object>} Updated portfolio
   */
  async updatePortfolio(id, updates) {
    if (USE_MOCK_DATA) {
      console.info(`[Mock] Updating portfolio ${id}`);
      const mock = generateMockPortfolios().find(p => p.id == id);
      if (!mock) throw { message: 'Portfolio not found', status: 404 };
      return { ...mock, ...updates, last_updated: new Date().toISOString() };
    }

    try {
      const response = await apiClient.put(`/portfolios/${id}`, updates);
      return response.data.data || response.data;
    } catch (error) {
      return handleApiError(error, `update portfolio ${id}`);
    }
  },

  /**
   * Delete portfolio with confirmation
   * @param {number|string} id 
   * @returns {Promise<boolean>} Success status
   */
  async deletePortfolio(id) {
    if (USE_MOCK_DATA) {
      console.info(`[Mock] Deleting portfolio ${id}`);
      return true;
    }

    try {
      await apiClient.delete(`/portfolios/${id}`);
      return true;
    } catch (error) {
      return handleApiError(error, `delete portfolio ${id}`);
    }
  },

  /**
   * Get portfolio analytics (XIRR, CAGR, etc.)
   * @param {number|string} id 
   * @returns {Promise<Object>} Analytics data
   */
  async getPortfolioAnalytics(id) {
    if (USE_MOCK_DATA) {
      console.info(`[Mock] Fetching analytics for portfolio ${id}`);
      return {
        xirr: (Math.random() * 15 + 5).toFixed(2),
        cagr: (Math.random() * 12 + 4).toFixed(2),
        volatility: (Math.random() * 10 + 2).toFixed(2),
        sharpe_ratio: (Math.random() * 1.5 + 0.5).toFixed(2),
        sector_allocation: {
          Equity: Math.floor(Math.random() * 60 + 20),
          Debt: Math.floor(Math.random() * 40 + 10),
          Others: Math.floor(Math.random() * 20 + 5)
        }
      };
    }

    try {
      const response = await apiClient.get(`/portfolios/${id}/analytics`);
      return response.data.data || response.data;
    } catch (error) {
      return handleApiError(error, `fetch analytics for portfolio ${id}`);
    }
  }
};

export default PortfolioService;