import axios from 'axios';
import config from '../config';

// Create an axios instance for our backend API
export const apiClient = axios.create({
  baseURL: config.apiUrl
});

// Create a separate axios instance for external APIs (without auth headers)
export const externalApiClient = axios.create();

// Function to set auth token for our backend API
export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common['x-auth-token'] = token;
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['x-auth-token'];
    delete apiClient.defaults.headers.common['Authorization'];
  }
};
