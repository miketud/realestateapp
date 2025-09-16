import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient, Prisma } from '@prisma/client'; // <-- include Prisma enum + client

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// ---- Contacts helpers ----
const toDigits = (v: string) => (v || '').replace(/\D/g, '');
const clamp10 = (d: string) => d.slice(0, 10);

// Map UI payload -> Prisma data
function uiToDbContact(body: any) {
  // required: name, phone
  const name = (body?.name ?? '').trim();
  const phoneDigits = clamp10(toDigits(body?.phone ?? ''));
  if (!name) throw new Error('VALIDATION:name is required');
  if (phoneDigits.length !== 10) throw new Error('VALIDATION:phone must have 10 digits');

  const data = {
    contact_name: name,
    contact_phone: phoneDigits,                 // store digits only
    contact_email: body?.email ?? null,
    contact_type: body?.contact_type ?? null,
    contact_notes: body?.notes ?? null,         // UI “notes” -> DB “contact_notes”
  };
  return data;
}

// Map Prisma -> UI shape your ContactList.tsx expects
function dbToUiContact(c: any) {
  return {
    contact_id: c.contact_id,
    name: c.contact_name,
    phone: c.contact_phone,    // digits only; you format in UI
    email: c.contact_email ?? '',
    contact_type: c.contact_type ?? '',
    notes: c.contact_notes ?? '',
    created_at: new Date(c.created_at).getTime(),
    updated_at: new Date(c.updated_at).getTime(),
  };
}

async function start() {
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  });

  // ---------------- Health ----------------
  app.get('/health', async (_req, reply) => reply.send({ ok: true }));

  // =====================================================
  // PROPERTIES
  // =====================================================
  app.get('/api/properties', async (_req, reply) => {
    try {
      const rows = await prisma.property.findMany();
      reply.send(rows);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch properties' });
    }
  });

  app.get('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const row = await prisma.property.findUnique({ where: { property_id: Number(id) } });
      if (!row) return reply.status(404).send({ error: 'Not found' });
      reply.send(row);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch property' });
    }
  });

  app.post('/api/properties', async (req, reply) => {
    const data = req.body as any;
    try {
      const created = await prisma.property.create({ data });
      reply.status(201).send(created);
    } catch {
      reply.status(400).send({ error: 'Create failed' });
    }
  });

  app.put('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    try {
      const updated = await prisma.property.update({ where: { property_id: Number(id) }, data });
      reply.send(updated);
    } catch {
      reply.status(404).send({ error: 'Property not found or update failed' });
    }
  });

  app.patch('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updates = req.body as any;
    try {
      const updated = await prisma.property.update({ where: { property_id: Number(id) }, data: updates });
      reply.send(updated);
    } catch {
      reply.status(404).send({ error: 'Property not found or update failed' });
    }
  });

// REPLACE your delete handler with this:
app.delete('/api/properties/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const propertyId = Number(id);

  try {
    await prisma.$transaction(async (tx) => {
      // delete dependents first
      await tx.loanDetails.deleteMany({ where: { property_id: propertyId } });
      await tx.purchaseDetails.deleteMany({ where: { property_id: propertyId } });
      await tx.rentLog.deleteMany({ where: { property_id: propertyId } });
      await tx.paymentLog.deleteMany({ where: { property_id: propertyId } });
      await tx.transaction.deleteMany({ where: { property_id: propertyId } });

      // then the property
      await tx.property.delete({ where: { property_id: propertyId } });
    });

    return reply.status(204).send();
  } catch (e: any) {
    // not found
    if (e?.code === 'P2025') {
      return reply.status(404).send({ message: 'Property not found' });
    }
    // any other unexpected error
    console.error('DELETE /api/properties/:id failed', e);
    return reply.status(500).send({ message: 'Delete failed', details: e?.message });
  }
});

  // =====================================================
  // PURCHASE DETAILS
  // =====================================================
  app.get('/api/purchase_details', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id required' });
    try {
      const row = await prisma.purchaseDetails.findUnique({ where: { property_id: Number(property_id) } });
      if (!row) return reply.send({ error: 'not_found' });
      reply.send(row);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch purchase details' });
    }
  });

  app.post('/api/purchase_details', async (req, reply) => {
    const b = req.body as any;
    try {
      const created = await prisma.purchaseDetails.create({
        data: {
          property_id: Number(b.property_id),
          purchase_price: b.purchase_price ?? 0,
          down_payment: b.down_payment ?? null,
          financing_type: b.financing_type ?? '',
          acquisition_type: b.acquisition_type ?? '',
          buyer: b.buyer ?? '',
          seller: b.seller ?? '',
          closing_date: b.closing_date ? new Date(b.closing_date) : new Date(),
          closing_costs: b.closing_costs ?? 0,
          earnest_money: b.earnest_money ?? null,
          notes: b.notes ?? null,
        },
      });
      reply.status(201).send(created);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.patch('/api/purchase_details/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;
    if (b.closing_date !== undefined) {
      b.closing_date = b.closing_date ? new Date(b.closing_date) : null;
    }
    try {
      const updated = await prisma.purchaseDetails.update({
        where: { purchase_id: Number(id) },
        data: b,
      });
      reply.send(updated);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  });

  // =====================================================
  // LOAN DETAILS
  // =====================================================
  app.get('/api/loan_details', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id required' });
    try {
      const row = await prisma.loanDetails.findFirst({
        where: { property_id: Number(property_id) },
        orderBy: { loan_start: 'asc' },
      });
      if (!row) return reply.send({ error: 'not_found' });
      reply.send(row);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch loan details' });
    }
  });

  app.post('/api/loan_details', async (req, reply) => {
    const b = req.body as any;
    if (!b?.loan_id || !b?.property_id || !b?.purchase_id) {
      return reply.status(400).send({ error: 'loan_id, property_id, and purchase_id are required' });
    }
    try {
      const created = await prisma.loanDetails.create({
        data: {
          loan_id: String(b.loan_id),
          property_id: Number(b.property_id),
          purchase_id: Number(b.purchase_id),
          loan_amount: b.loan_amount ?? null,
          lender: b.lender ?? null,
          interest_rate: b.interest_rate ?? null,
          loan_term: b.loan_term ?? null,
          loan_start: b.loan_start ? new Date(b.loan_start) : null,
          loan_end: b.loan_end ? new Date(b.loan_end) : null,
          amortization_period: b.amortization_period ?? null,
          monthly_payment: b.monthly_payment ?? null,
          loan_type: b.loan_type ?? null,
          balloon_payment: b.balloon_payment ?? null,
          prepayment_penalty: b.prepayment_penalty ?? null,
          refinanced: b.refinanced ?? null,
          loan_status: b.loan_status ?? null,
          notes: b.notes ?? null,
        },
      });
      reply.status(201).send(created);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.patch('/api/loan_details/by_property_purchase', async (req, reply) => {
    const b = req.body as { property_id: number; purchase_id: number } & Record<string, any>;
    if (!b?.property_id || !b?.purchase_id) {
      return reply.status(400).send({ error: 'property_id and purchase_id required' });
    }
    ['loan_start', 'loan_end'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(b, field)) {
        b[field] = b[field] ? new Date(b[field]) : null;
      }
    });
    try {
      const updated = await prisma.loanDetails.update({
        where: { property_id_purchase_id: { property_id: Number(b.property_id), purchase_id: Number(b.purchase_id) } },
        data: { ...b, property_id: undefined, purchase_id: undefined },
      });
      reply.send(updated);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.patch('/api/loan_details/:loan_id', async (req, reply) => {
    const { loan_id } = req.params as { loan_id: string };
    const b = req.body as any;
    ['loan_start', 'loan_end'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(b, field)) {
        b[field] = b[field] ? new Date(b[field]) : null;
      }
    });
    try {
      const updated = await prisma.loanDetails.update({
        where: { loan_id: String(loan_id) },
        data: b,
      });
      reply.send(updated);
    } catch (e: any) {
      reply.status(404).send({ error: 'Loan not found or update failed', details: e.message });
    }
  });

  // =====================================================
  // RENT LOG (formerly RentRoll) — Prisma model RentLog maps to table rent_log
  // =====================================================
  // Use shared handlers; no app.inject (fixes TS errors).
  const getRentHandler = async (req: any, reply: any) => {
    const { property_id, year } = req.query as { property_id?: string; year?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id required' });
    const where: any = { property_id: Number(property_id) };
    if (year) where.year = Number(year);
    try {
      const rows = await prisma.rentLog.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }] });
      reply.send(rows);
    } catch (e: any) {
      reply.status(500).send({ error: 'Failed to fetch rent log', details: e.message });
    }
  };

  const postRentHandler = async (req: any, reply: any) => {
    const b = req.body as {
      property_id: number;
      month: string;
      year: number | string;
      rent_amount?: number | null;
      date_deposited?: string | null;
      check_number?: number | null;
      notes?: string | null;
    };
    if (!b?.property_id || !b?.month || !b?.year) {
      return reply.status(400).send({ error: 'property_id, month, and year are required' });
    }

    try {
      const key = {
        property_id_month_year: {
          property_id: Number(b.property_id),
          month: String(b.month),
          year: Number(b.year),
        },
      };

      


// detect edits to money fields
const isAmountKey = Object.prototype.hasOwnProperty.call(b, 'rent_amount');
const isCheckKey  = Object.prototype.hasOwnProperty.call(b, 'check_number');
const hasMoneyEdit = isAmountKey || isCheckKey;

// build updates (undefined means "don't change")
const updateData: any = {
  rent_amount:   b.rent_amount   ?? undefined,
  check_number:  b.check_number  ?? undefined,
  notes:         b.notes         ?? undefined,
};

// If client supplied a date string, use it.
// Otherwise, if Amount or Check were edited, auto-stamp today's date.
// (Keeps column NOT NULL without forcing a date for unrelated edits.)
if (b.date_deposited) {
  updateData.date_deposited = new Date(b.date_deposited);
} else if (hasMoneyEdit) {
  updateData.date_deposited = new Date();
}

      const createData: any = {
        property_id: Number(b.property_id),
        month: String(b.month),
        year: Number(b.year),
        rent_amount: b.rent_amount ?? 0,
        date_deposited: b.date_deposited ? new Date(b.date_deposited) : new Date(),
        check_number: b.check_number ?? null,
        notes: b.notes ?? null,
      };

      const row = await prisma.rentLog.upsert({ where: key, update: updateData, create: createData });
      reply.send(row);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  };

  // Legacy + new routes
  app.get('/api/rentroll', getRentHandler);
  app.post('/api/rentroll', postRentHandler);
  app.get('/api/rentlog', getRentHandler);
  app.post('/api/rentlog', postRentHandler);

  // =====================================================
  // TRANSACTIONS
  // =====================================================
  app.get('/api/transactions', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id required' });
    try {
      const rows = await prisma.transaction.findMany({
        where: { property_id: Number(property_id) },
        orderBy: { transaction_date: 'desc' },
      });
      reply.send(rows);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch transactions' });
    }
  });

  app.post('/api/transactions', async (req, reply) => {
    const { property_id, amount, date, transaction_type, notes } = req.body as any;
    if (!property_id || amount == null || !date) {
      return reply.status(400).send({ error: 'property_id, amount, and date are required' });
    }
    try {
      const row = await prisma.transaction.create({
        data: {
          property_id: Number(property_id),
          transaction_amount: Number(amount),
          transaction_date: new Date(date),
          transaction_type: transaction_type ?? null,
          notes: notes ?? null,
        },
      });
      reply.status(201).send(row);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  });

app.patch('/api/transactions/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as any;

  // Coerce incoming values to what Prisma expects
  const updates: any = {};

  if ('transaction_amount' in body) {
    const n = body.transaction_amount === null || body.transaction_amount === ''
      ? null
      : Number(body.transaction_amount);
    if (n !== null && !Number.isFinite(n)) {
      return reply.status(400).send({ error: 'transaction_amount must be a number' });
    }
    updates.transaction_amount = n;
  }

  if ('transaction_date' in body) {
    const raw = body.transaction_date;
    const d = (raw === null || raw === '') ? null : new Date(raw);
    if (d !== null && Number.isNaN(d.valueOf())) {
      return reply.status(400).send({ error: 'transaction_date is invalid' });
    }
    updates.transaction_date = d;
  }

  if ('transaction_type' in body) updates.transaction_type = body.transaction_type ?? null;
  if ('notes' in body) updates.notes = body.notes ?? null;

  try {
    const row = await prisma.transaction.update({
      where: { transaction_id: Number(id) },
      data: updates,
    });
    reply.send(row);
  } catch (e) {
    console.error('PATCH /api/transactions/:id failed', e);
    reply.status(404).send({ error: 'Transaction not found or update failed' });
  }
});
// =====================================================
// CONTACTS
// =====================================================
app.get('/api/contacts', async (req, reply) => {
  const { q } = (req.query as { q?: string }) || {};
  const search = (q ?? '').trim();
  const searchDigits = (q ?? '').replace(/\D/g, '');

  let where: Prisma.ContactWhereInput | undefined;
  if (search || searchDigits) {
    where = {
      OR: [
        { contact_name:  { contains: search, mode: Prisma.QueryMode.insensitive } },
        { contact_email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { contact_type:  { contains: search, mode: Prisma.QueryMode.insensitive } },
        { contact_notes: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ...(searchDigits ? [{ contact_phone: { contains: searchDigits } } as Prisma.ContactWhereInput] : []),
      ],
    };
  }

  const rows = await prisma.contact.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }, { contact_id: 'desc' }],
  });

  reply.send(rows.map(dbToUiContact));
});

app.get('/api/contacts/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const row = await prisma.contact.findUnique({ where: { contact_id: Number(id) } });
  if (!row) return reply.status(404).send({ error: 'Not found' });
  reply.send(dbToUiContact(row));
});

app.post('/api/contacts', async (req, reply) => {
  try {
    const data = uiToDbContact(req.body);
    const created = await prisma.contact.create({ data });
    reply.status(201).send(dbToUiContact(created));
  } catch (e: any) {
    if (String(e.message).startsWith('VALIDATION:')) {
      return reply.status(400).send({ error: e.message.replace('VALIDATION:', '') });
    }
    console.error(e);
    reply.status(500).send({ error: 'Failed to create contact' });
  }
});

app.patch('/api/contacts/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const patch: Prisma.ContactUpdateInput = {};
    if ('name' in (req.body as any)) {
      const name = (req.body as any).name?.trim() ?? '';
      if (!name) throw new Error('VALIDATION:name is required');
      patch.contact_name = name;
    }
    if ('phone' in (req.body as any)) {
      const digits = clamp10(toDigits((req.body as any).phone ?? ''));
      if (digits.length !== 10) throw new Error('VALIDATION:phone must have 10 digits');
      patch.contact_phone = digits;
    }
    if ('email' in (req.body as any))        patch.contact_email = (req.body as any).email ?? null;
    if ('contact_type' in (req.body as any)) patch.contact_type = (req.body as any).contact_type ?? null;
    if ('notes' in (req.body as any))        patch.contact_notes = (req.body as any).notes ?? null;

    const updated = await prisma.contact.update({ where: { contact_id: Number(id) }, data: patch });
    reply.send(dbToUiContact(updated));
  } catch (e: any) {
    if (String(e.message).startsWith('VALIDATION:')) {
      return reply.status(400).send({ error: e.message.replace('VALIDATION:', '') });
    }
    if (e?.code === 'P2025') return reply.status(404).send({ error: 'Not found' });
    console.error(e);
    reply.status(500).send({ error: 'Failed to update contact' });
  }
});

app.delete('/api/contacts/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await prisma.contact.delete({ where: { contact_id: Number(id) } });
    reply.send({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return reply.status(404).send({ error: 'Not found' });
    console.error(e);
    reply.status(500).send({ error: 'Failed to delete contact' });
  }
});

  // ---- start server last ----
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3000');
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

// =====================================================
// PAYMENT LOG (mirrors RentLog) — Prisma model PaymentLog
// =====================================================
app.get('/api/paymentlog', async (req, reply) => {
  const { property_id, year } = req.query as { property_id?: string; year?: string };
  if (!property_id || !year) {
    return reply.status(400).send({ error: 'property_id and year are required' });
  }
  try {
    const rows = await prisma.paymentLog.findMany({
      where: { property_id: Number(property_id), year: Number(year) },
      orderBy: [{ year: 'asc' }], // optional: add month ordering if you store numeric month
    });
    reply.send(rows);
  } catch (e: any) {
    reply.status(500).send({ error: 'Failed to load payment log', details: e.message });
  }
});

app.post('/api/paymentlog', async (req, reply) => {
  const b = req.body as {
    property_id: number | string;
    year: number | string;
    month: string;
    payment_amount?: number | null;
    check_number?: number | null;
    notes?: string | null;
    date_paid?: string | null;
  };
  if (!b?.property_id || !b?.year || !b?.month) {
    return reply.status(400).send({ error: 'property_id, year, month required' });
  }

  try {
    const key = {
      property_id_month_year: {
        property_id: Number(b.property_id),
        month: String(b.month),
        year: Number(b.year),
      },
    };

    const updateData: any = {
      payment_amount: b.payment_amount ?? undefined,
      check_number:   b.check_number   ?? undefined,
      notes:          b.notes          ?? undefined,
      date_paid:      b.date_paid ? new Date(b.date_paid) : undefined,
    };

    const createData: any = {
      property_id:    Number(b.property_id),
      month:          String(b.month),
      year:           Number(b.year),
      payment_amount: b.payment_amount ?? 0,
      check_number:   b.check_number   ?? null,
      notes:          b.notes          ?? null,
      date_paid:      b.date_paid ? new Date(b.date_paid) : null,
    };

    const row = await prisma.paymentLog.upsert({ where: key, update: updateData, create: createData });
    reply.send(row);
  } catch (e: any) {
    reply.status(400).send({ error: 'Payment log save failed', details: e.message });
  }
});

app.get('/api/property_markers', async (_req, reply) => {
  try {
    const rows = await prisma.property.findMany({
      select: {
        property_id: true,
        property_name: true,
        address: true,  // street
        city: true,
        state: true,
        zipcode: true,
        lat: true,
        lng: true,
      },
      orderBy: { property_id: 'asc' },
    });

    reply.send(rows.map(r => ({
      id: r.property_id,
      name: r.property_name ?? 'Property',
      address: r.address,             // street only
      city: r.city ?? '',
      state: r.state ?? '',
      zipcode: r.zipcode ?? '',
      lat: r.lat ?? null,
      lng: r.lng ?? null,
    })));
  } catch (e) {
    app.log.error(e);
    reply.code(500).send({ error: 'Failed to build markers' });
  }
});

// --------- One-time/occasional helper to fill missing lat/lng ----------
type Geo = { lat: number; lng: number };

async function geocodeNominatim(q: string): Promise<Geo | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PropertyManager/1.0 (admin@yourdomain.com)',
      'Accept-Language': 'en-US,en;q=0.8',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

app.post('/api/admin/geocode-missing', async (_req, reply) => {
  try {
    const props = await prisma.property.findMany({
      where: { OR: [{ lat: null }, { lng: null }] },
      select: { property_id: true, address: true, city: true, state: true, zipcode: true },
      orderBy: { property_id: 'asc' },
    });

    const updated: number[] = [];
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      const full = [p.address, p.city, p.state, p.zipcode].filter(Boolean).join(', ');
      const hit = await geocodeNominatim(full).catch(() => null);
      if (hit) {
        await prisma.property.update({
          where: { property_id: p.property_id },
          data: { lat: hit.lat, lng: hit.lng, geocoded_at: new Date() },
        });
        updated.push(p.property_id);
      }
      if (i < props.length - 1) await sleep(1100); // be polite to OSM (≈1 req/sec)
    }

    reply.send({ updated_count: updated.length, ids: updated });
  } catch (e) {
    app.log.error(e);
    reply.code(500).send({ error: 'Geocoding failed' });
  }
});
