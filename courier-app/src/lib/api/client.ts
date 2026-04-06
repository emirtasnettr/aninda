import axios from 'axios';
import { getApiBaseUrl } from './config';
import { useAuthStore } from '../../store/authStore';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
