import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, setAuthToken } from '../api/axiosConfig';
import config from '../config';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Set up auth token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
    }
  }, []);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          setLoading(false);
          return;
        }
        
        // Set the token in axios headers
        setAuthToken(token);
        
        // Verify token and get user data
        const res = await apiClient.get('/auth/user');
        setCurrentUser(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Auth check failed:', err);
        localStorage.removeItem('token');
        setAuthToken(null);
        setError(err.response?.data?.msg || 'Authentication failed');
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setError(null);
      const res = await apiClient.post('/auth/login', { email, password });
      const token = res.data.token;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      
      // Set token in axios headers
      setAuthToken(token);
      
      // Fetch user data
      const userRes = await apiClient.get('/auth/user');
      setCurrentUser(userRes.data);
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.status === 404) {
        // User doesn't exist
        setError('User not found. Please register first.');
      } else {
        setError(err.response?.data?.msg || 'Login failed');
      }
      return false;
    }
  };

  // Register function
  const register = async (name, email, password) => {
    try {
      setError(null);
      const res = await apiClient.post('/auth/register', { name, email, password });
      const token = res.data.token;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      
      // Set token in axios headers
      setAuthToken(token);
      
      // Fetch user data
      const userRes = await apiClient.get('/auth/user');
      setCurrentUser(userRes.data);
      
      return true;
    } catch (err) {
      console.error('Register error:', err);
      setError(err.response?.data?.msg || 'Registration failed');
      return false;
    }
  };

  // Logout function
  const logout = () => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    
    // Clear auth headers
    setAuthToken(null);
    
    // Clear user state
    setCurrentUser(null);
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    register,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
