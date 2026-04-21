import axios from 'axios';

// While running locally, use localhost. 
// When you deploy the backend to Railway, change this to your Railway URL.
const api = axios.create({
  baseURL: 'http://localhost:8000/api/',
});

// 1. Request Interceptor: Attach the token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. Response Interceptor: Catch expired tokens and unauthorized actions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // The backend rejected the token (expired or not logged in)
      // Wipe the dead session and force a hard redirect to the login page
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;