import axios from 'axios';

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
 * Base URL automatically switches between local dev and Docker runtime.
 *
 * - In local Vite dev: VITE_API_BASE comes from `.env` (defaults to localhost).
 * - In Docker: it’s passed via Dockerfile/Compose as `http://realestateapp-backend:3000`.
 */
const API_BASE =
  (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '');

const API_URL = `${API_BASE}/api/properties`;

// --------------------------------------------
// CRUD Operations
// --------------------------------------------

export const getProperties = async (): Promise<Property[]> => {
  const res = await axios.get(API_URL);
  return res.data;
};

export const createProperty = async (property: PropertyInput): Promise<Property> => {
  const res = await axios.post(API_URL, property);
  return res.data;
};

export const getProperty = async (id: number): Promise<Property> => {
  const res = await axios.get(`${API_URL}/${id}`);
  return res.data;
};

export const updateProperty = async (
  property_id: number,
  property: PropertyInput
): Promise<Property> => {
  const res = await axios.put(`${API_URL}/${property_id}`, property);
  return res.data;
};

export const deleteProperty = async (id: number): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};

// PATCH one field (inline-edit support)
export const updatePropertyField = async (
  property_id: number,
  field: string,
  value: any
): Promise<Property> => {
  const res = await axios.patch(`${API_URL}/${property_id}`, { [field]: value });
  return res.data;
};
