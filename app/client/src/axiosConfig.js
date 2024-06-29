import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000',
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
