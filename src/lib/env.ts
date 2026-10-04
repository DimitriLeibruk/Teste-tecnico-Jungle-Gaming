export const env = {
  apiMocking: import.meta.env.VITE_API_MOCKING === 'enabled',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'https://realtime.kurio.mock',
} as const
