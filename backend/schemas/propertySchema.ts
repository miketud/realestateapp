import { z } from "zod";

export const propertySchema = z.object({
  property_id: z.number().optional(), // For existing/fetched properties
  property_name: z.string(),          // Required for new properties
  owner: z.string(),                  // Required for new properties
  address: z.string().optional().nullable(), // Optional for create
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipcode: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  purchase_price: z.number().optional().nullable(),
  market_value: z.number().optional().nullable(),
  year: z.number().optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  income_producing: z.enum(['YES', 'NO']).optional(),
  financing_type: z.string().optional().nullable(), // ← ✅ Added this line
});

export type PropertyInput = z.infer<typeof propertySchema>;
