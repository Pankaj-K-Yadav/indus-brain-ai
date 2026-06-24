/**
 * Centralized, typed Axios client for the backend API. All HTTP access flows
 * through this module — feature services build on top of it.
 */
import axios, { type AxiosInstance } from 'axios';
import { env } from '@/lib/env';

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
});
// Note: Content-Type is intentionally not forced here. Axios sets
// application/json for object bodies and multipart/form-data (with boundary)
// for FormData automatically.

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface a normalized error message; feature-level handling added later.
    const message =
      error?.response?.data?.error?.message ?? error?.message ?? 'Unexpected network error';
    return Promise.reject(new Error(message));
  },
);
