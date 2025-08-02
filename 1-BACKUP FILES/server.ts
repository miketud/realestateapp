import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify();

async function start() {
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
  });

  // ========== PROPERTIES ==========
  app.get('/api/properties', async (_req, reply) => {
    const properties = await prisma.property.findMany();
    reply.send(properties);
  });

  app.get('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const property = await prisma.property.findUnique({ where: { property_id: Number(id) } });
    if (!property) return reply.status(404).send({ error: 'Not found' });
    reply.send(property);
  });

  app.post('/api/properties', async (req, reply) => {
    const data = req.body as any;
    const required = ['property_name', 'address', 'owner'];
    for (const field of required) {
      if (!data[field]) return reply.status(400).send({ error: `${field} is required` });
    }
    const created = await prisma.property.create({ data });
    reply.status(201).send(created);
  });

  app.put('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    try {
      const updated = await prisma.property.update({
        where: { property_id: Number(id) },
        data,
      });
      reply.send(updated);
    } catch {
      reply.status(404).send({ error: 'Property not found or update failed' });
    }
  });

  app.patch('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updates = req.body as any;
    if (!updates || typeof updates !== 'object') {
      return reply.status(400).send({ error: 'No update data provided' });
    }

    try {
      const updated = await prisma.property.update({
        where: { property_id: Number(id) },
        data: updates,
      });
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

  // ========== PURCHASE DETAILS ==========
  app.get('/api/purchase_details', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id is required' });

    try {
      const purchase = await prisma.purchaseDetails.findFirst({
        where: { property_id: Number(property_id) },
      });
      if (!purchase) return reply.status(404).send({ error: 'Purchase details not found' });
      reply.send(purchase);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Server error fetching purchase details' });
    }
  });

  app.post('/api/purchase_details', async (req, reply) => {
    const {
      property_id, purchase_price, financing_type, acquisition_type,
      buyer, seller, closing_date, closing_costs, earnest_money, notes
    } = req.body as any;

    if (
      property_id === undefined ||
      financing_type === undefined ||
      acquisition_type === undefined ||
      closing_date === undefined ||
      purchase_price === undefined
    ) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    console.log('[POST /api/purchase_details] Payload:', {
      property_id, purchase_price, financing_type, acquisition_type, buyer, seller, closing_date, closing_costs, earnest_money, notes
    });

    try {
      const newRecord = await prisma.purchaseDetails.create({
        data: {
          property_id: Number(property_id),
          purchase_price: Number(purchase_price),
          financing_type,
          acquisition_type,
          buyer,
          seller,
          closing_date: new Date(closing_date),
          closing_costs: Number(closing_costs),
          earnest_money: earnest_money ? Number(earnest_money) : undefined,
          notes,
        }
      });
      reply.status(201).send(newRecord);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Insert failed', details: error });
    }
  });

  app.patch('/api/purchase_details/:purchase_id', async (req, reply) => {
    const { purchase_id } = req.params as { purchase_id: string };
    const updates = req.body as any;

    if (!purchase_id || !updates) {
      return reply.status(400).send({ error: 'purchase_id and update body required' });
    }

    // Fix: Convert closing_date to JS Date if present and is a string
    if (updates.closing_date && typeof updates.closing_date === 'string') {
      updates.closing_date = new Date(updates.closing_date);
    }

    try {
      const updated = await prisma.purchaseDetails.update({
        where: { purchase_id: Number(purchase_id) },
        data: updates,
      });
      reply.send(updated);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Failed to update purchase details', details: error });
    }
  });

  // ========== LOAN DETAILS ==========

  // GET loan details for a given property
  app.get('/api/loan_details', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id is required' });

    try {
      const loan = await prisma.loanDetails.findFirst({
        where: { property_id: Number(property_id) },
      });
      if (!loan) return reply.status(404).send({ error: 'Loan details not found' });
      reply.send(loan);
    } catch (error) {
      console.error('[GET /api/loan_details] Error:', error);
      reply.status(500).send({ error: 'Failed to fetch loan details' });
    }
  });

  // POST: Create a new loan record — only if one does not exist for the property
  app.post('/api/loan_details', async (req, reply) => {
    const {
      loan_id,
      property_id,
      purchase_id,
      loan_amount,
      lender,
      interest_rate,
      loan_term,
      loan_mortgage,
      loan_start,
      loan_end,
      loan_type,
      balloon_payment,
      prepayment_penalty,
      refinanced,
      loan_status,
      notes,
    } = req.body as any;

    if (!loan_id || !property_id || !purchase_id) {
      return reply.status(400).send({ error: 'loan_id, property_id, and purchase_id are required' });
    }

    try {
      // Prevent duplicate loan creation for this property
      const existing = await prisma.loanDetails.findFirst({
        where: { property_id: Number(property_id) },
      });
      if (existing) return reply.status(409).send({ error: 'Loan already exists for this property' });

      const created = await prisma.loanDetails.create({
        data: {
          loan_id: String(loan_id),
          property_id: Number(property_id),
          purchase_id: Number(purchase_id),
          loan_amount: Number(loan_amount) || 0,
          lender: lender ?? '',
          interest_rate: Number(interest_rate) || 0,
          loan_term: Number(loan_term) || 0,
          loan_mortgage: Number(loan_mortgage) || 0,
          loan_start: loan_start ? new Date(loan_start) : null,
          loan_end: loan_end ? new Date(loan_end) : null,
          loan_type: loan_type ?? '',
          balloon_payment: !!balloon_payment,
          prepayment_penalty: !!prepayment_penalty,
          refinanced: !!refinanced,
          loan_status: loan_status ?? '',
          notes: notes ?? null,
        },
      });

      reply.status(201).send(created);
    } catch (err) {
      console.error('[POST /api/loan_details] Creation failed:', err);
      reply.status(500).send({ error: 'Failed to create loan record' });
    }
  });

  // PATCH: Update a loan by loan_id
  app.patch('/api/loan_details/:loan_id', async (req, reply) => {
    const { loan_id } = req.params as { loan_id: string };
    const updates = req.body as Record<string, any>;

    if (!loan_id || !updates) {
      return reply.status(400).send({ error: 'loan_id and update body required' });
    }

    try {
      const updated = await prisma.loanDetails.update({
        where: { loan_id },
        data: updates,
      });
      reply.send(updated);
    } catch (error) {
      console.error('[PATCH /api/loan_details/:loan_id] Update failed:', error);
      reply.status(500).send({ error: 'Failed to update loan details' });
    }
  });

  // ========== RENT ROLL ==========
  app.post('/api/rentroll', async (req, reply) => {
    const { property_id, month, year, rent_amount, date_deposited, notes, check_number } = req.body as any;
    if (!property_id || !month || !year) {
      return reply.status(400).send({ error: 'property_id, month, and year are required' });
    }

    try {
      const entry = await prisma.rentRoll.upsert({
        where: {
          property_id_month_year: {
            property_id: Number(property_id),
            month: String(month),
            year: Number(year),
          }
        },
        update: {
          rent_amount: rent_amount ? Number(rent_amount) : 0,
          date_deposited: new Date(date_deposited),
          notes: notes ?? null,
          check_number: check_number ? Number(check_number) : null,
        },
        create: {
          property_id: Number(property_id),
          month: String(month),
          year: Number(year),
          rent_amount: rent_amount ? Number(rent_amount) : 0,
          date_deposited: new Date(date_deposited),
          notes: notes ?? null,
          check_number: check_number ? Number(check_number) : null,
        }
      });
      reply.send(entry);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to upsert rent roll entry', details: error });
    }
  });

  app.get('/api/rentroll', async (req, reply) => {
    const { property_id, year } = req.query as { property_id?: string, year?: string };
    if (!property_id || !year) {
      return reply.status(400).send({ error: 'property_id and year are required' });
    }

    const entries = await prisma.rentRoll.findMany({
      where: {
        property_id: Number(property_id),
        year: Number(year),
      }
    });
    reply.send(entries);
  });

  // ========== TRANSACTIONS ==========
  app.post('/api/transactions', async (req, reply) => {
    const { property_id, amount, date, transaction_type, notes } = req.body as any;
    if (!property_id || !amount || !date) {
      return reply.status(400).send({ error: 'property_id, amount, and date are required' });
    }

    try {
      const transaction = await prisma.transaction.create({
        data: {
          property_id: Number(property_id),
          transaction_amount: Number(amount),
          transaction_date: new Date(date),
          transaction_type: transaction_type ?? null,
          notes: notes ?? null,
        },
      });
      reply.status(201).send(transaction);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to create transaction', details: error });
    }
  });

  app.get('/api/transactions', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id is required' });

    try {
      const transactions = await prisma.transaction.findMany({
        where: { property_id: Number(property_id) },
        orderBy: { transaction_date: 'desc' },
      });
      reply.send(transactions);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch transactions', details: error });
    }
  });

  app.patch('/api/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updates = req.body as any;

    try {
      const updated = await prisma.transaction.update({
        where: { transaction_id: Number(id) },
        data: updates,
      });
      reply.send(updated);
    } catch {
      reply.status(404).send({ error: 'Transaction not found or update failed' });
    }
  });

  app.delete('/api/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.transaction.delete({
        where: { transaction_id: Number(id) },
      });
      reply.status(204).send();
    } catch {
      reply.status(404).send({ error: 'Transaction not found or delete failed' });
    }
  });

  await app.listen({ port: 3000 });
  console.log('Server running on http://localhost:3000');
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
