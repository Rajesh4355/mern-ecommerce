import axios from 'axios';

const envBaseUrl = process.env.REACT_APP_BASE_URL;
const shouldUseProxyApi =
  !envBaseUrl ||
  envBaseUrl.includes('your-backend-domain') ||
  envBaseUrl.includes('localhost:8000');

export const axiosi = axios.create({
  withCredentials: true,
  baseURL: shouldUseProxyApi ? '/api' : envBaseUrl,
});

axiosi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.response = {
        data: { message: error?.message || 'Network error, please try again' },
      };
    }
    return Promise.reject(error);
  }
);