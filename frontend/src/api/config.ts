// src/api/config.ts
export const API_BASE =
  (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
export const API = `${API_BASE}/api`;