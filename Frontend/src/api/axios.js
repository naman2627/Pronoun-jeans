import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Queue of requests that arrived while a token refresh was in flight
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  failedQueue = [];
};

const forceLogout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.replace('/login');
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status          = error.response?.status;
    const requestUrl      = error.config?.url ?? '';
    const originalRequest = error.config;

    const isAuthEndpoint =
      requestUrl.includes('auth/token') || requestUrl.includes('auth/logout');

    // Only intercept 401s on non-auth endpoints, and never retry a second time
    if (status !== 401 || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request until it resolves
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing           = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      isRefreshing = false;
      forceLogout();
      return Promise.reject(error);
    }

    try {
      // Use a plain axios call to avoid triggering this interceptor again
      const res       = await axios.post(
        `${import.meta.env.VITE_API_URL}auth/token/refresh/`,
        { refresh: refreshToken },
      );
      const newAccess = res.data.access;
      localStorage.setItem('accessToken', newAccess);
      // Backend rotates refresh tokens — store the new one if provided
      if (res.data.refresh) localStorage.setItem('refreshToken', res.data.refresh);

      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;