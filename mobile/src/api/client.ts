import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

// Default to localhost for web/iOS, 10.0.2.2 for Android emulator
const getBaseURL = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getBaseURL();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor to inject Token & Tenant Branch Header
api.interceptors.request.use((config) => {
  const { token, selectedBranchId } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (selectedBranchId) {
    config.headers['x-branch-id'] = selectedBranchId;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout on 401 Unauthorized
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
