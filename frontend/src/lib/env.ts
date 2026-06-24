/**
 * Typed access to client environment variables. Centralizes `import.meta.env`
 * usage and provides safe defaults.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api',
  appName: import.meta.env.VITE_APP_NAME ?? 'INDUS-BRAIN AI',
} as const;
