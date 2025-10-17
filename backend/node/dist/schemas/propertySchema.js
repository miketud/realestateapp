"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertySchema = void 0;
const zod_1 = require("zod");
exports.propertySchema = zod_1.z.object({
    property_id: zod_1.z.number().optional(), // For existing/fetched properties
    property_name: zod_1.z.string(), // Required for new properties
    owner: zod_1.z.string(), // Required for new properties
    address: zod_1.z.string().optional().nullable(), // Optional for create
    city: zod_1.z.string().optional().nullable(),
    state: zod_1.z.string().optional().nullable(),
    zipcode: zod_1.z.string().optional().nullable(),
    county: zod_1.z.string().optional().nullable(),
    purchase_price: zod_1.z.number().optional().nullable(),
    market_value: zod_1.z.number().optional().nullable(),
    year: zod_1.z.number().optional().nullable(),
    type: zod_1.z.string().optional().nullable(),
    status: zod_1.z.string().optional().nullable(),
    income_producing: zod_1.z.enum(['YES', 'NO']).optional(),
    financing_type: zod_1.z.string().optional().nullable(), // ← ✅ Added this line
});
