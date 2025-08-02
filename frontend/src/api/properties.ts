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

const API_URL = 'http://localhost:3000/api/properties';

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

export const deleteProperty = async (property_id: number): Promise<void> => {
  await axios.delete(`${API_URL}/${property_id}`);
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