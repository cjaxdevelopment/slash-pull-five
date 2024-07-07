import axios from 'axios';

console.log("REACT_APP_API_URL: ", process.env.REACT_APP_API_URL);

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000', // Fallback to localhost for development
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

instance.interceptors.response.use((response) => {
  return response;
}, (error) => {
  // Handle token expiration
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    delete instance.defaults.headers.common['Authorization'];
    window.location.href = '/login'; // Redirect to login
  }
  return Promise.reject(error);
});

export default instance;
