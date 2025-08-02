import { useState, useRef, useEffect } from 'react';
import { Table, Box, Button } from '@mantine/core';

// --- CONSTANTS & STYLES ---
const ROW_HEIGHT = 48;
const AMOUNT_WIDTH = 160;
const DATE_WIDTH = 160;
const ACTIONS_WIDTH = 288;

const thStyle = {
  border: '1px solid #111',
  padding: '0 14px',
  background: '#164e7e',
  color: '#fff',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  height: ROW_HEIGHT,
  textAlign: 'center' as const,
};

const tdStyle = {
  border: '1px solid #222',
  padding: '0 14px',
  fontSize: 16,
  background: '#fff',
  fontFamily: 'inherit',
  height: ROW_HEIGHT,
  minHeight: ROW_HEIGHT,
  maxHeight: ROW_HEIGHT,
  verticalAlign: 'middle' as const,
  boxSizing: 'border-box' as const,
  overflow: 'hidden',
  lineHeight: `${ROW_HEIGHT}px`,
};

const inputStyle = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  color: '#111',
  outline: 'none',
  height: ROW_HEIGHT - 2,
  lineHeight: `${ROW_HEIGHT - 2}px`,
  margin: 0,
  padding: 0,
  verticalAlign: 'middle' as const,
  boxSizing: 'border-box' as const,
};

const cellBtnBase = {
  border: '2px solid #164e7e',
  borderRadius: 0,
  background: '#fff',
  color: '#164e7e',
  fontWeight: 700,
  fontSize: 15,
  width: 80,
  height: 32,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  boxShadow: 'none' as const,
  cursor: 'pointer',
  marginRight: 0,
  lineHeight: '30px',
  verticalAlign: 'middle',
  display: 'inline-block',
  transition: 'all 0.18s',
};

const cellEdit = {
  ...cellBtnBase,
  border: '2px solid #164e7e',
  color: '#164e7e',
  marginRight: 8,
};
const cellSave = {
  ...cellBtnBase,
  border: '2px solid #29a376',
  color: '#29a376',
  marginRight: 8,
};
const cellCancel = {
  ...cellBtnBase,
  border: '2px solid #aaa',
  color: '#888',
  marginRight: 8,
};
const cellDel = {
  ...cellBtnBase,
  border: '2px solid #c33',
  color: '#c33',
  marginRight: 0,
};

// --- TYPES ---
export type TransactionRow = {
  transaction_id?: number;
  transaction_type?: string;
  notes?: string;
  transaction_amount?: number | string;
  transaction_date?: string;
};

type TransactionLogProps = {
  property_id: number;
  transactions: TransactionRow[];
  setTransactions: (transactions: TransactionRow[]) => void;
};

// --- COMPONENT ---
export default function TransactionLog({ property_id, transactions, setTransactions }: TransactionLogProps) {
  const [addMode, setAddMode] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TransactionRow>({
    transaction_type: '',
    notes: '',
    transaction_amount: '',
    transaction_date: ''
  });
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Focus first input on add/edit
  useEffect(() => {
    if ((addMode || editingIdx !== null) && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [addMode, editingIdx]);

  function getToday() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  // Create new transaction in DB
  async function addTransaction(newTx: TransactionRow) {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id,
        amount: newTx.transaction_amount,
        date: newTx.transaction_date,
        transaction_type: newTx.transaction_type,
        notes: newTx.notes,
      }),
    });
    if (!res.ok) throw new Error('Failed to add transaction');
    return await res.json();
  }

  // Update transaction in DB
  async function updateTransaction(id: number, updateFields: Partial<TransactionRow>) {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateFields),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    return await res.json();
  }

  // Delete transaction in DB
  async function deleteTransaction(id: number) {
    await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async function handleSave() {
    if (!draft.transaction_amount || !draft.transaction_date) return;
    if (editingIdx !== null && transactions[editingIdx].transaction_id) {
      // Editing: PATCH
      try {
        const updated = await updateTransaction(transactions[editingIdx].transaction_id!, draft);
        const updatedArr = [...transactions];
        updatedArr[editingIdx] = updated;
        setTransactions(updatedArr);
        setEditingIdx(null);
        setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
      } catch (e) {
        alert("Update failed.");
      }
    } else {
      // Creating: POST
      try {
        const created = await addTransaction(draft);
        setTransactions([...transactions, created]);
        setAddMode(false);
        setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
      } catch (e) {
        alert("Create failed.");
      }
    }
  }
  function handleCancel() {
    setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setAddMode(false);
    setEditingIdx(null);
  }
  function startEdit(idx: number) {
    setDraft({ ...transactions[idx] });
    setEditingIdx(idx);
    setAddMode(false);
  }
  async function handleDelete(idx: number) {
    if (transactions[idx].transaction_id) {
      await deleteTransaction(transactions[idx].transaction_id!);
    }
    setTransactions(transactions.filter((_, i) => i !== idx));
    handleCancel();
  }

  return (
    <Box style={{ marginTop: 40 }}>
      {/* Always visible Add Transaction button */}
      <Button
        style={{
          border: '2px solid #111',
          borderRadius: 0,
          background: '#fff',
          color: '#111',
          fontWeight: 700,
          fontSize: 18,
          padding: '10px 28px',
          textTransform: 'uppercase',
          letterSpacing: 1,
          boxShadow: 'none',
          marginBottom: 18,
          marginTop: 0,
          marginLeft: 0,
        }}
        onClick={() => setAddMode(true)}
        disabled={addMode || editingIdx !== null}
      >
        Add Transaction
      </Button>
      <Table
        style={{
          width: '100%',
          fontSize: 16,
          borderCollapse: 'collapse',
          border: '2px solid black',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)',
          marginTop: 0,
          marginBottom: 32,
          background: '#fff'
        }}
      >
        <colgroup>
          <col style={{ width: 200 }} />
          <col />
          <col style={{ width: AMOUNT_WIDTH }} />
          <col style={{ width: DATE_WIDTH }} />
          <col style={{ width: ACTIONS_WIDTH }} />
        </colgroup>
        <thead>
          <tr style={{ height: ROW_HEIGHT }}>
            <th style={thStyle}>Transaction Type</th>
            <th style={thStyle}>Notes</th>
            <th style={{ ...thStyle, width: AMOUNT_WIDTH }}>Amount</th>
            <th style={{ ...thStyle, width: DATE_WIDTH }}>Date</th>
            <th style={{ ...thStyle, width: ACTIONS_WIDTH }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {/* Inline Add Row */}
          {addMode && (
            <tr style={{ height: ROW_HEIGHT }}>
              <td style={tdStyle}>
                <input
                  name="transaction_type"
                  ref={firstInputRef}
                  value={draft.transaction_type}
                  onChange={handleInput}
                  placeholder="Transaction Type"
                  style={inputStyle}
                />
              </td>
              <td style={tdStyle}>
                <input
                  name="notes"
                  value={draft.notes}
                  onChange={handleInput}
                  placeholder="Notes"
                  style={inputStyle}
                />
              </td>
              <td style={{ ...tdStyle, width: AMOUNT_WIDTH }}>
                <input
                  name="transaction_amount"
                  value={draft.transaction_amount}
                  onChange={handleInput}
                  placeholder="Amount"
                  type="number"
                  style={inputStyle}
                  required
                />
              </td>
              <td style={{ ...tdStyle, width: DATE_WIDTH }}>
                <input
                  name="transaction_date"
                  value={draft.transaction_date}
                  onChange={handleInput}
                  onDoubleClick={() => setDraft(prev => ({ ...prev, transaction_date: getToday() }))}
                  placeholder="Date"
                  type="date"
                  style={inputStyle}
                  required
                />
              </td>
              <td style={{ ...tdStyle, width: ACTIONS_WIDTH, textAlign: 'center', padding: 0 }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: '100%',
                }}>
                  <Button style={cellSave} onClick={handleSave} disabled={!draft.transaction_amount || !draft.transaction_date}>
                    SAVE
                  </Button>
                  <Button style={cellCancel} onClick={handleCancel}>
                    CANCEL
                  </Button>
                  <span style={{ width: 80, height: 32, opacity: 0 }} />
                </span>
              </td>
            </tr>
          )}
          {/* Existing Transactions */}
          {transactions.length === 0 && !addMode && editingIdx === null ? (
            <tr style={{ height: ROW_HEIGHT }}>
              <td colSpan={5} style={{
                border: '1px solid #111',
                background: '#fff',
                textAlign: 'center',
                color: '#c33',
                fontWeight: 600,
                fontSize: 16,
                letterSpacing: 1,
                lineHeight: `${ROW_HEIGHT}px`
              }}>
                No transactions logged
              </td>
            </tr>
          ) : (
            transactions.map((tx: TransactionRow, idx: number) =>
              editingIdx === idx ? (
                <tr key={tx.transaction_id || idx} style={{ height: ROW_HEIGHT }}>
                  <td style={tdStyle}>
                    <input
                      name="transaction_type"
                      ref={firstInputRef}
                      value={draft.transaction_type}
                      onChange={handleInput}
                      placeholder="Transaction Type"
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      name="notes"
                      value={draft.notes}
                      onChange={handleInput}
                      placeholder="Notes"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ ...tdStyle, width: AMOUNT_WIDTH }}>
                    <input
                      name="transaction_amount"
                      value={draft.transaction_amount}
                      onChange={handleInput}
                      placeholder="Amount"
                      type="number"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ ...tdStyle, width: DATE_WIDTH }}>
                    <input
                      name="transaction_date"
                      value={draft.transaction_date}
                      onChange={handleInput}
                      onDoubleClick={() => setDraft(prev => ({ ...prev, transaction_date: getToday() }))}
                      placeholder="Date"
                      type="date"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ ...tdStyle, width: ACTIONS_WIDTH, textAlign: 'center', padding: 0 }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      height: '100%',
                    }}>
                      <Button style={cellSave} onClick={handleSave}>
                        SAVE
                      </Button>
                      <Button style={cellCancel} onClick={handleCancel}>
                        CANCEL
                      </Button>
                      <Button style={cellDel} onClick={() => handleDelete(idx)}>
                        DEL
                      </Button>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr key={tx.transaction_id || idx} style={{ height: ROW_HEIGHT }}>
                  <td style={tdStyle}>{tx.transaction_type ?? ''}</td>
                  <td style={tdStyle}>{tx.notes ?? ''}</td>
                  <td style={{ ...tdStyle, width: AMOUNT_WIDTH }}>{tx.transaction_amount ?? ''}</td>
                  <td style={{ ...tdStyle, width: DATE_WIDTH }}>{tx.transaction_date ? tx.transaction_date.substring(0, 10) : ''}</td>
                  <td style={{ ...tdStyle, width: ACTIONS_WIDTH, textAlign: 'center', padding: 0 }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      height: '100%',
                    }}>
                      <Button style={cellEdit} onClick={() => startEdit(idx)}>
                        EDIT
                      </Button>
                      <span style={{ width: 80, height: 32, opacity: 0 }} />
                      <Button style={cellDel} onClick={() => handleDelete(idx)}>
                        DEL
                      </Button>
                    </span>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </Table>
    </Box>
  );
}
