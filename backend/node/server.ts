import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify({ logger: false });

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

  app.delete('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.property.delete({ where: { property_id: Number(id) } });
      reply.status(204).send();
    } catch {
      reply.status(404).send({ error: 'Property not found or delete failed' });
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

      // coerce to correct types; undefined means "don't change" on update
      const updateData: any = {
        rent_amount: b.rent_amount ?? undefined,
        date_deposited: b.date_deposited === undefined ? undefined : (b.date_deposited ? new Date(b.date_deposited) : null),
        check_number: b.check_number ?? undefined,
        notes: b.notes ?? undefined,
      };

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

  // ---- start server last ----
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3000');
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
