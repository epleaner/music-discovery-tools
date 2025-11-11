/**
 * Custom fetch instance for API requests
 * This is used by Orval-generated clients
 */

// Get API URL from environment - works in both ESM and CJS
// Note: For Vite apps, set VITE_API_URL in .env and it will be available via process.env
// or configure it at runtime in your app
const getApiUrl = (): string => {
  // Try Node.js process.env (works in both CJS and ESM, and Vite replaces this at build time)
  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  // Try global window (browser runtime config)
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }
  // Default
  return 'http://localhost:3001';
};

export const customInstance = async <T>(
  config: RequestInit & { url: string }
): Promise<T> => {
  const { url, ...requestConfig } = config;

  // Get API URL at runtime to avoid CJS/ESM issues
  const API_URL = getApiUrl();

  // Orval generates URLs like '/health', we need to prepend '/api/rest'
  const apiUrl = url.startsWith('/') ? `${API_URL}/api/rest${url}` : `${API_URL}/api/rest/${url}`;

  const response = await fetch(apiUrl, {
    ...requestConfig,
    headers: {
      'Content-Type': 'application/json',
      ...requestConfig.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw error;
  }

  return response.json();
};

export default customInstance;

