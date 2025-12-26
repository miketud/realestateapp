import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient, Prisma } from '@prisma/client';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// ------------------------------
// Utilities
// ------------------------------
const toDigits = (v: string) => (v || '').replace(/\D/g, '');
const clamp10 = (d: string) => d.slice(0, 10);

const uiToDbContact = (body: any) => {
  const name = (body?.name ?? '').trim();
  const phoneDigits = clamp10(toDigits(body?.phone ?? ''));
  if (!name) throw new Error('VALIDATION:name is required');
  if (phoneDigits.length !== 10) throw new Error('VALIDATION:phone must have 10 digits');
  return {
    contact_name: name,
    contact_phone: phoneDigits,
    contact_email: body?.email ?? null,
    contact_type: body?.contact_type ?? null,
    contact_notes: body?.notes ?? null,
  };
};

const dbToUiContact = (c: any) => ({
  contact_id: c.contact_id,
  name: c.contact_name,
  phone: c.contact_phone,
  email: c.contact_email ?? '',
  contact_type: c.contact_type ?? '',
  notes: c.contact_notes ?? '',
  created_at: new Date(c.created_at).getTime(),
  updated_at: new Date(c.updated_at).getTime(),
});

// ------------------------------
// Graceful shutdown for Docker
// ------------------------------
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// ------------------------------
// Start function
// ------------------------------
async function start() {
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  });

// ------------------------------
// Healthcheck (used by Docker)
// ------------------------------
app.get('/health', async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // ensures DB is reachable
    reply.code(200).send({ status: 'ok' });
  } catch {
    reply.code(500).send({ status: 'error', db: false });
  }
});

  // ------------------------------
  // PROPERTIES
  // ------------------------------
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
    try {
      const created = await prisma.property.create({ data: req.body as any });
      reply.status(201).send(created);
    } catch {
      reply.status(400).send({ error: 'Create failed' });
    }
  });

  app.patch('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const updated = await prisma.property.update({
        where: { property_id: Number(id) },
        data: req.body as any,
      });
      reply.send(updated);
    } catch {
      reply.status(404).send({ error: 'Property not found or update failed' });
    }
  });

  app.delete('/api/properties/:id', async (req, reply) => {
    const propertyId = Number((req.params as { id: string }).id);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.loanDetails.deleteMany({ where: { property_id: propertyId } });
        await tx.purchaseDetails.deleteMany({ where: { property_id: propertyId } });
        await tx.rentLog.deleteMany({ where: { property_id: propertyId } });
        await tx.paymentLog.deleteMany({ where: { property_id: propertyId } });
        await tx.transaction.deleteMany({ where: { property_id: propertyId } });
        await tx.property.delete({ where: { property_id: propertyId } });
      });
      reply.status(204).send();
    } catch (e: any) {
      if (e?.code === 'P2025') return reply.status(404).send({ message: 'Property not found' });
      reply.status(500).send({ message: 'Delete failed', details: e?.message });
    }
  });

  // ------------------------------
  // PURCHASE DETAILS
  // ------------------------------
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
    if (b.closing_date !== undefined)
      b.closing_date = b.closing_date ? new Date(b.closing_date) : null;
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

  // ------------------------------
  // LOAN DETAILS
  // ------------------------------
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
    if (!b?.loan_id || !b?.property_id || !b?.purchase_id)
      return reply.status(400).send({ error: 'loan_id, property_id, purchase_id required' });
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

  // ------------------------------
  // RENT LOG
  // ------------------------------
  const getRentHandler = async (req: any, reply: any) => {
    const { property_id, year } = req.query;
    if (!property_id) return reply.status(400).send({ error: 'property_id required' });
    const where: any = { property_id: Number(property_id) };
    if (year) where.year = Number(year);
    try {
      const rows = await prisma.rentLog.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }] });
      reply.send(rows);
    } catch (e: any) {
      reply.status(500).send({ error: e.message });
    }
  };

  const postRentHandler = async (req: any, reply: any) => {
    const b = req.body;
    if (!b?.property_id || !b?.month || !b?.year)
      return reply.status(400).send({ error: 'property_id, month, year required' });

    const key = { property_id_month_year: { property_id: Number(b.property_id), month: String(b.month), year: Number(b.year) } };
    const updateData: any = { rent_amount: b.rent_amount ?? undefined, check_number: b.check_number ?? undefined, notes: b.notes ?? undefined };
    if (b.date_deposited) updateData.date_deposited = new Date(b.date_deposited);
    else if ('rent_amount' in b || 'check_number' in b) updateData.date_deposited = new Date();

    const createData = {
      property_id: Number(b.property_id),
      month: String(b.month),
      year: Number(b.year),
      rent_amount: b.rent_amount ?? 0,
      date_deposited: b.date_deposited ? new Date(b.date_deposited) : new Date(),
      check_number: b.check_number ?? null,
      notes: b.notes ?? null,
    };

    try {
      const row = await prisma.rentLog.upsert({ where: key, update: updateData, create: createData });
      reply.send(row);
    } catch (e: any) {
      reply.status(400).send({ error: e.message });
    }
  };

  app.get('/api/rentlog', getRentHandler);
  app.post('/api/rentlog', postRentHandler);
  app.get('/api/rentroll', getRentHandler);
  app.post('/api/rentroll', postRentHandler);

  // ------------------------------
  // TRANSACTIONS
  // ------------------------------
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
    if (!property_id || amount == null || !date)
      return reply.status(400).send({ error: 'property_id, amount, and date are required' });
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

// ------------------------------
// CONTACTS
// ------------------------------

// GET /api/contacts?q=...
app.get('/api/contacts', async (req, reply) => {
  const { q } = (req.query as { q?: string }) || {};
  const search = (q ?? '').trim();
  const searchDigits = (q ?? '').replace(/\D/g, '');

  let where: Prisma.ContactWhereInput | undefined;
  if (search || searchDigits) {
    where = {
      OR: [
        { contact_name: { contains: search, mode: 'insensitive' } },
        { contact_email: { contains: search, mode: 'insensitive' } },
        { contact_type: { contains: search, mode: 'insensitive' } },
        { contact_notes: { contains: search, mode: 'insensitive' } },
        ...(searchDigits ? [{ contact_phone: { contains: searchDigits } }] : []),
      ],
    };
  }

  const rows = await prisma.contact.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }, { contact_id: 'desc' }],
  });

  reply.send(rows.map(dbToUiContact));
});

// POST /api/contacts
app.post('/api/contacts', async (req, reply) => {
  try {
    const data = uiToDbContact(req.body);
    const created = await prisma.contact.create({ data });
    reply.status(201).send(dbToUiContact(created));
  } catch (e: any) {
    if (String(e.message).startsWith('VALIDATION:')) {
      return reply.status(400).send({ error: e.message.replace('VALIDATION:', '') });
    }
    reply.status(500).send({ error: 'Failed to create contact' });
  }
});

// PATCH /api/contacts/:id
app.patch('/api/contacts/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as any;

  // Build a safe partial patch
  const patch: Prisma.ContactUpdateInput = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return reply.status(400).send({ error: 'name is required' });
    patch.contact_name = name;
  }
  if (body.phone !== undefined) {
    const digits = clamp10(toDigits(String(body.phone)));
    if (digits.length !== 10) return reply.status(400).send({ error: 'phone must have 10 digits' });
    patch.contact_phone = digits;
  }
  if (body.email !== undefined) patch.contact_email = body.email ? String(body.email) : null;
  if (body.contact_type !== undefined) patch.contact_type = body.contact_type ? String(body.contact_type) : null;
  if (body.notes !== undefined) patch.contact_notes = body.notes ? String(body.notes) : null;

  try {
    const updated = await prisma.contact.update({
      where: { contact_id: Number(id) },
      data: patch,
    });
    reply.send(dbToUiContact(updated));
  } catch (e: any) {
    if (e?.code === 'P2025') return reply.status(404).send({ error: 'Contact not found' });
    reply.status(400).send({ error: 'Update failed' });
  }
});

// DELETE /api/contacts/:id
app.delete('/api/contacts/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await prisma.contact.delete({ where: { contact_id: Number(id) } });
    reply.status(204).send();
  } catch (e: any) {
    if (e?.code === 'P2025') return reply.status(404).send({ error: 'Contact not found' });
    reply.status(400).send({ error: 'Delete failed' });
  }
});

  // ------------------------------
  // PAYMENT LOG
  // ------------------------------
  app.get('/api/paymentlog', async (req, reply) => {
    const { property_id, year } = req.query as { property_id?: string; year?: string };
    if (!property_id || !year)
      return reply.status(400).send({ error: 'property_id and year are required' });
    try {
      const rows = await prisma.paymentLog.findMany({
        where: { property_id: Number(property_id), year: Number(year) },
        orderBy: [{ year: 'asc' }],
      });
      reply.send(rows);
    } catch (e: any) {
      reply.status(500).send({ error: 'Failed to load payment log', details: e.message });
    }
  });

  app.post('/api/paymentlog', async (req, reply) => {
    const b = req.body as any;
    if (!b?.property_id || !b?.year || !b?.month)
      return reply.status(400).send({ error: 'property_id, year, month required' });

    const key = {
      property_id_month_year: {
        property_id: Number(b.property_id),
        month: String(b.month),
        year: Number(b.year),
      },
    };

    const updateData: any = {
      payment_amount: b.payment_amount ?? undefined,
      check_number: b.check_number ?? undefined,
      notes: b.notes ?? undefined,
      date_paid: b.date_paid ? new Date(b.date_paid) : undefined,
    };

    const createData: any = {
      property_id: Number(b.property_id),
      month: String(b.month),
      year: Number(b.year),
      payment_amount: b.payment_amount ?? 0,
      check_number: b.check_number ?? null,
      notes: b.notes ?? null,
      date_paid: b.date_paid ? new Date(b.date_paid) : null,
    };

    try {
      const row = await prisma.paymentLog.upsert({ where: key, update: updateData, create: createData });
      reply.send(row);
    } catch (e: any) {
      reply.status(400).send({ error: 'Payment log save failed', details: e.message });
    }
  });

  // ------------------------------
  // PROPERTY MARKERS + ADMIN GEO
  // ------------------------------
  app.get('/api/property_markers', async (_req, reply) => {
    try {
      const rows = await prisma.property.findMany({
        select: {
          property_id: true,
          property_name: true,
          address: true,
          city: true,
          state: true,
          zipcode: true,
          lat: true,
          lng: true,
        },
        orderBy: { property_id: 'asc' },
      });
      reply.send(
        rows.map((r) => ({
          id: r.property_id,
          name: r.property_name ?? 'Property',
          address: r.address,
          city: r.city ?? '',
          state: r.state ?? '',
          zipcode: r.zipcode ?? '',
          lat: r.lat ?? null,
          lng: r.lng ?? null,
        }))
      );
    } catch (e) {
      app.log.error(e);
      reply.code(500).send({ error: 'Failed to build markers' });
    }
  });

  app.post('/api/admin/geocode-missing', async (_req, reply) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const geocodeNominatim = async (q: string) => {
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
    };

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
        if (i < props.length - 1) await sleep(1100);
      }

      reply.send({ updated_count: updated.length, ids: updated });
    } catch (e) {
      app.log.error(e);
      reply.code(500).send({ error: 'Geocoding failed' });
    }
  });

  // ------------------------------
  // Start server
  // ------------------------------
  await app.listen({ port: 3000, host: '0.0.0.0' });
  app.log.info('Server running on http://localhost:3000');
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// ------------------------------
// TENANTS
// ------------------------------
app.get('/api/tenant', async (req, reply) => {
  const { property_id } = req.query as { property_id?: string };
  if (!property_id)
    return reply.status(400).send({ error: 'property_id required' });

  try {
    const rows = await prisma.tenant.findMany({
      where: { property_id: Number(property_id) },
      orderBy: { tenant_id: 'asc' },
    });
    reply.send(rows);
  } catch (e: any) {
    reply.status(500).send({ error: e.message || 'Failed to fetch tenants' });
  }
});

// Create new tenant (one record per POST)
app.post('/api/tenant', async (req, reply) => {
  const b = req.body as any;
  if (!b?.property_id)
    return reply.status(400).send({ error: 'property_id required' });

  try {
    const data: any = {
      property_id: Number(b.property_id),
      tenant_name: b.tenant_name ?? null,
      tenant_status: b.tenant_status ?? 'Inactive',
      lease_start: b.lease_start ? new Date(b.lease_start) : null,
      lease_end: b.lease_end ? new Date(b.lease_end) : null,
      rent_amount:
        b.rent_amount !== undefined && b.rent_amount !== null
          ? Number(b.rent_amount)
          : null,
    };

    // Prisma doesn’t type composite unique constraints yet — cast for runtime safety
    const whereClause = {
      unique_property_tenant_start: {
        property_id: data.property_id,
        tenant_name: data.tenant_name,
        lease_start: data.lease_start,
      },
    } as any;

    const result = await prisma.tenant.upsert({
      where: whereClause,
      update: data,
      create: data,
    });

    reply.status(201).send(result);
  } catch (e: any) {
    reply.status(400).send({ error: e.message });
  }
});

// Update existing tenant
app.patch('/api/tenant/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as any;

  try {
    const data: any = {
      tenant_name: b.tenant_name ?? undefined,
      tenant_status: b.tenant_status ?? undefined,
      lease_start: b.lease_start ? new Date(b.lease_start) : undefined,
      lease_end: b.lease_end ? new Date(b.lease_end) : undefined,
      rent_amount:
        b.rent_amount !== undefined && b.rent_amount !== null
          ? Number(b.rent_amount)
          : undefined,
    };

    const updated = await prisma.tenant.update({
      where: { tenant_id: Number(id) },
      data,
    });
    reply.send(updated);
  } catch (e: any) {
    if (e?.code === 'P2025')
      return reply.status(404).send({ error: 'Tenant not found' });
    reply.status(400).send({ error: e.message || 'Update failed' });
  }
});

// Delete tenant
app.delete('/api/tenant/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await prisma.tenant.delete({ where: { tenant_id: Number(id) } });
    reply.status(204).send();
  } catch (e: any) {
    if (e?.code === 'P2025')
      return reply.status(404).send({ error: 'Tenant not found' });
    reply.status(400).send({ error: e.message || 'Delete failed' });
  }
});

