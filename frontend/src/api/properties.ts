// src/api/properties.ts
import axios from 'axios';

/**
 * Property data types
 */
export type PropertyInput = {
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
  income_producing?: 'YES' | 'NO';
  financing_type?: string;
};

export type Property = PropertyInput & {
  property_id: number;
  city?: string;
  state?: string;
  zipcode?: string;
  county?: string;
  purchase_price?: number;
  market_value?: number;
  year?: number;
};

/**
 * Base URL configuration
 *
 * - Local dev: defaults to http://localhost:3000 unless overridden in `.env`.
 * - Docker/production: set VITE_API_BASE to e.g. http://realestateapp-backend:3000
 *
 * `.replace(/\/$/, '')` ensures no trailing slash.
 */
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const API_URL = `${API_BASE}/api/properties`;

/**
 * --------------------------------------------
 * CRUD Operations
 * --------------------------------------------
 */
export async function getProperties(): Promise<Property[]> {
  const res = await axios.get(API_URL);
  return res.data;
}

export async function createProperty(property: PropertyInput): Promise<Property> {
  const res = await axios.post(API_URL, property);
  return res.data;
}

export async function getProperty(id: number): Promise<Property> {
  const res = await axios.get(`${API_URL}/${id}`);
  return res.data;
}

/** Use PATCH to match backend route (/api/properties/:id via PATCH) */
export async function updateProperty(property_id: number, property: PropertyInput): Promise<Property> {
  const res = await axios.patch(`${API_URL}/${property_id}`, property);
  return res.data;
}

export async function deleteProperty(id: number): Promise<void> {
  await axios.delete(`${API_URL}/${id}`);
}

/** Partial update for inline editing */
export async function updatePropertyField(
  property_id: number,
  field: string,
  value: any
): Promise<Property> {
  const res = await axios.patch(`${API_URL}/${property_id}`, { [field]: value });
  return res.data;
}
