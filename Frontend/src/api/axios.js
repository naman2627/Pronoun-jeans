import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    // Never redirect on 401 from auth endpoints — avoids infinite loop
    const isAuthEndpoint =
      requestUrl.includes('auth/token') || requestUrl.includes('auth/logout');

    if (status === 401 && !isAuthEndpoint) {
      localStorage.clear();
      window.location.replace('/login');
    }

    return Promise.reject(error);
  }
);

export default api;