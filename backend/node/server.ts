import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify();

async function start() {
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  });

  // ========== PROPERTIES ==========
  app.get('/api/properties', async (_req, reply) => {
    try {
      const properties = await prisma.property.findMany();
      reply.send(properties);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch properties' });
    }
  });

  app.get('/api/properties/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const property = await prisma.property.findUnique({
        where: { property_id: Number(id) },
      });
      if (!property) return reply.status(404).send({ error: 'Not found' });
      reply.send(property);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch property' });
    }
  });

  app.post('/api/properties', async (req, reply) => {
    const data = req.body as any;
    const required = ['property_name', 'address', 'owner'];
    for (const field of required) {
      if (!data[field]) return reply.status(400).send({ error: `${field} is required` });
    }
    try {
      const created = await prisma.property.create({ data });
      reply.status(201).send(created);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to create property', details: error });
    }
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
    } catch {
      reply.status(500).send({ error: 'Server error fetching purchase details' });
    }
  });

  app.post('/api/purchase_details', async (req, reply) => {
    const {
      property_id,
      purchase_price,
      financing_type,
      acquisition_type,
      buyer,
      seller,
      closing_date,
      closing_costs,
      earnest_money,
      notes,
      down_payment,
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

    try {
      const newRecord = await prisma.purchaseDetails.create({
        data: {
          property_id: Number(property_id),
          purchase_price: Number(purchase_price),
          down_payment: down_payment ? Number(down_payment) : undefined,
          financing_type,
          acquisition_type,
          buyer,
          seller,
          closing_date: new Date(closing_date),
          closing_costs: Number(closing_costs),
          earnest_money: earnest_money ? Number(earnest_money) : undefined,
          notes,
        },
      });
      reply.status(201).send(newRecord);
    } catch (error) {
      reply.status(500).send({ error: 'Insert failed', details: error });
    }
  });

  app.patch('/api/purchase_details/:purchase_id', async (req, reply) => {
    const { purchase_id } = req.params as { purchase_id: string };
    const updates = req.body as any;

    if (!purchase_id || !updates) {
      return reply.status(400).send({ error: 'purchase_id and update body required' });
    }

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
      reply.status(500).send({ error: 'Failed to update purchase details', details: error });
    }
  });

  // ========== LOAN DETAILS ==========
  app.get('/api/loan_details', async (req, reply) => {
    const { property_id } = req.query as { property_id?: string };
    if (!property_id) return reply.status(400).send({ error: 'property_id is required' });

    try {
      const loan = await prisma.loanDetails.findFirst({
        where: { property_id: Number(property_id) },
      });
      if (!loan) return reply.status(404).send({ error: 'Loan details not found' });
      reply.send(loan);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch loan details' });
    }
  });

  app.post('/api/loan_details', async (req, reply) => {
    const {
      loan_id,
      property_id,
      purchase_id,
      loan_amount,
      lender,
      interest_rate,
      loan_term,
      monthly_payment,
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
          monthly_payment: Number(monthly_payment) || 0,
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
    } catch {
      reply.status(500).send({ error: 'Failed to create loan record' });
    }
  });

app.patch('/api/loan_details/by_property_purchase', async (req, reply) => {
  const body = req.body as any; // 👈 add this cast!
  const { property_id, purchase_id, ...updates } = body;

  if (!property_id || !purchase_id) {
    return reply.status(400).send({ error: 'property_id and purchase_id required' });
  }

  // Date handling...
  ['loan_start', 'loan_end'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      if (updates[field] === '' || updates[field] === undefined) {
        updates[field] = null;
      } else if (typeof updates[field] === 'string') {
        updates[field] = new Date(updates[field]);
      }
    }
  });

  try {
    const updated = await prisma.loanDetails.update({
      where: {
        property_id_purchase_id: {
          property_id: Number(property_id),
          purchase_id: Number(purchase_id),
        },
      },
      data: updates,
    });
    reply.send(updated);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to update loan details by property_id and purchase_id', details: error });
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
          },
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
        },
      });
      reply.send(entry);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to upsert rent roll entry', details: error });
    }
  });

  app.get('/api/rentroll', async (req, reply) => {
    const { property_id, year } = req.query as { property_id?: string; year?: string };
    if (!property_id || !year) {
      return reply.status(400).send({ error: 'property_id and year are required' });
    }

    try {
      const entries = await prisma.rentRoll.findMany({
        where: {
          property_id: Number(property_id),
          year: Number(year),
        },
      });
      reply.send(entries);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch rent roll entries' });
    }
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
    } catch {
      reply.status(500).send({ error: 'Failed to fetch transactions' });
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

  // ========== LOAN PAYMENTS ==========

// GET loan payments by loanId, propertyId, and optional year
app.get('/api/loan_payments', async (req, reply) => {
  const { loanId, propertyId, year } = req.query as {
    loanId?: string;
    propertyId?: string;
    year?: string;
  };

  if (!loanId || !propertyId) {
    return reply.status(400).send({ error: 'loanId and propertyId are required' });
  }

  try {
    const yearNum = year ? Number(year) : undefined;

    // Build date range if year specified
    let whereClause: any = {
      loan_id: loanId,
      property_id: Number(propertyId),
    };

    if (yearNum) {
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum + 1, 0, 1);

      whereClause.payment_due_date = {
        gte: startDate,
        lt: endDate,
      };
    }

    const payments = await prisma.loanPayment.findMany({
      where: whereClause,
      orderBy: {
        payment_due_date: 'asc',
      },
    });

    reply.send(payments);
  } catch (error) {
    console.error('[GET /api/loan_payments] Error:', error);
    reply.status(500).send({ error: 'Failed to fetch loan payments' });
  }
});

// POST create a new loan payment
app.post('/api/loan_payments', async (req, reply) => {
  const {
    loan_id,
    property_id,
    payment_due_date,
    payment_amount,
    date_paid,
    principal_paid,
    interest_paid,
    late_fee,
    principal_balance,
    notes,
  } = req.body as any;

  if (!loan_id || !property_id || !payment_due_date || payment_amount === undefined) {
    return reply.status(400).send({
      error:
        'loan_id, property_id, payment_due_date, and payment_amount are required',
    });
  }

  try {
    const created = await prisma.loanPayment.create({
      data: {
        loan_id,
        property_id: Number(property_id),
        payment_due_date: new Date(payment_due_date),
        payment_amount: Number(payment_amount),
        date_paid: date_paid ? new Date(date_paid) : null,
        principal_paid: principal_paid ? Number(principal_paid) : 0,
        interest_paid: interest_paid ? Number(interest_paid) : 0,
        late_fee: late_fee ? Number(late_fee) : 0,
        principal_balance: principal_balance ? Number(principal_balance) : 0,
        notes: notes ?? null,
      },
    });

    reply.status(201).send(created);
  } catch (error) {
    console.error('[POST /api/loan_payments] Error:', error);
    reply.status(500).send({ error: 'Failed to create loan payment' });
  }
});

// PATCH update a loan payment by id
app.patch('/api/loan_payments/:loan_payment_id', async (req, reply) => {
  const { loan_payment_id } = req.params as { loan_payment_id: string };
  const updates = req.body as any;

  if (!loan_payment_id || !updates) {
    return reply.status(400).send({ error: 'loan_payment_id and update body required' });
  }

  if (updates.payment_due_date && typeof updates.payment_due_date === 'string') {
    updates.payment_due_date = new Date(updates.payment_due_date);
  }
  if (updates.date_paid && typeof updates.date_paid === 'string') {
    updates.date_paid = new Date(updates.date_paid);
  }

  try {
    const updated = await prisma.loanPayment.update({
      where: { loan_payment_id: Number(loan_payment_id) },
      data: updates,
    });

    reply.send(updated);
  } catch (error) {
    console.error(`[PATCH /api/loan_payments/${loan_payment_id}] Error:`, error);
    reply.status(500).send({ error: 'Failed to update loan payment' });
  }
});


  await app.listen({ port: 3000 });
  console.log('Server running on http://localhost:3000');
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

// PATCH update loan details by loan_id (string PK)
app.patch('/api/loan_details/:loan_id', async (req, reply) => {
  const { loan_id } = req.params as { loan_id: string };
  const updates = req.body as any;

  if (!loan_id || !updates) {
    return reply.status(400).send({ error: 'loan_id and update body required' });
  }

  // Optional: Date fields logic if needed
  ['loan_start', 'loan_end'].forEach((field) => {
    if (updates.hasOwnProperty(field)) {
      if (updates[field] === '' || updates[field] === undefined) {
        updates[field] = null;
      } else if (typeof updates[field] === 'string') {
        updates[field] = new Date(updates[field]);
      }
    }
  });

  try {
    const updated = await prisma.loanDetails.update({
      where: { loan_id: String(loan_id) },
      data: updates,
    });
    reply.send(updated);
  } catch (error) {
    reply.status(404).send({ error: 'Loan not found or update failed', details: error });
  }
});
