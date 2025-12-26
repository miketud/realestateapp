// src/api/config.ts
const isProd = import.meta.env.MODE === 'production';
export const API_BASE =
  (import.meta.env.VITE_API_BASE || (isProd ? '' : 'http://localhost:3000')).replace(/\/$/, '');
export const API = `${API_BASE}/api`;
export const apiUrl = (p: string) => `${API}${p.startsWith('/') ? p : `/${p}`}`;
