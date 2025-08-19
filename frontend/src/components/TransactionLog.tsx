import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Table, Box, Button } from '@mantine/core';

// ===== API BASE (point directly at Fastify on 3000) =====
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:3000';
const API = `${API_BASE}/api`;

// --- CONSTANTS & SIZING ---
const UNIT_WIDTH = 175;
const TYPE_WIDTH = UNIT_WIDTH;
const AMOUNT_WIDTH = UNIT_WIDTH;
const DATE_WIDTH = UNIT_WIDTH;
const ACTIONS_WIDTH = 350;
const TABLE_WIDTH = 1575;
const NOTES_WIDTH = TABLE_WIDTH - (TYPE_WIDTH + AMOUNT_WIDTH + DATE_WIDTH + ACTIONS_WIDTH); // 700

const ENTRY_ROW_BG = '#f4f9ff';
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

// --- STYLES ---
const thStyle: CSSProperties = {
  border: '1px solid #111', padding: '10px 14px', background: '#164e7e', color: '#fff',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
  whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word',
};
const tdStyle: CSSProperties = {
  border: '1px solid #222', padding: '10px 14px', fontSize: 16, background: '#fff',
  fontFamily: 'inherit', verticalAlign: 'middle', boxSizing: 'border-box', textAlign: 'center',
  whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word',
};
const inputStyle: CSSProperties = {
  width: '100%', border: 'none', background: 'transparent', fontSize: 'inherit',
  fontFamily: 'inherit', color: '#111', outline: 'none', margin: 0, padding: 0,
  verticalAlign: 'middle', boxSizing: 'border-box', textAlign: 'center',
};
const cellBtnBase: CSSProperties = {
  border: '2px solid #164e7e', borderRadius: 0, background: '#fff', color: '#164e7e',
  fontWeight: 700, fontSize: 15, width: 'auto', minWidth: 100, padding: '0 12px', height: 32,
  textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'none', cursor: 'pointer',
  lineHeight: '30px', verticalAlign: 'middle', display: 'inline-block',
  transition: 'all 0.18s', whiteSpace: 'nowrap',
};
const cellEdit = { ...cellBtnBase };
const cellSave = { ...cellBtnBase, border: '2px solid #29a376', color: '#29a376' };
const cellCancel = { ...cellBtnBase, border: '2px solid #aaa', color: '#888' };
const cellDel = { ...cellBtnBase, border: '2px solid #c33', color: '#c33' };
const actionsCellStyle: CSSProperties = { ...tdStyle, width: ACTIONS_WIDTH, padding: 0 };
const actionsBar: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'center',
  justifyItems: 'center', width: '100%', height: '100%', gap: 8, padding: '0 8px', boxSizing: 'border-box',
};

// --- HELPERS ---
const toMMDDYYYY = (val?: string) => {
  if (!val) return '';
  const s = val.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
};
const parseCurrencyNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const formatCurrency = (value: any): string => {
  const n = parseCurrencyNumber(value);
  if (n === null) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
// keep only digits and one dot, max 2 decimals (for typing)
const sanitizeMoneyInput = (raw: string) => {
  let s = raw.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    const [intPart, decPart = ''] = s.split('.');
    s = intPart + '.' + decPart.slice(0, 2);
  }
  if (s.startsWith('.')) s = '0' + s;
  return s;
};
// Today in EST/EDT (America/New_York) as YYYY-MM-DD
const todayISOInNY = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
};

// --- TYPES ---
export type TransactionRow = {
  transaction_id?: number;
  transaction_type?: string;
  notes?: string;
  transaction_amount?: number | string;
  transaction_date?: string;   // ISO yyyy-mm-dd
};
type TransactionLogProps = {
  property_id: number;
  transactions: TransactionRow[];
  setTransactions: (transactions: TransactionRow[]) => void;
};
type FocusState =
  | { kind: 'add'; col: 'type' | 'notes' | 'amount' | 'date' }
  | { kind: 'edit'; index: number; col: 'type' | 'notes' | 'amount' | 'date' }
  | null;

// --- COMPONENT ---
export default function TransactionLog({ property_id, transactions, setTransactions }: TransactionLogProps) {
  const [addDraft, setAddDraft] = useState<TransactionRow>({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TransactionRow>({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
  const [focus, setFocus] = useState<FocusState>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editingIdx !== null && firstInputRef.current) firstInputRef.current.focus(); }, [editingIdx]);

  const addHasAny =
    (addDraft.transaction_type ?? '').trim() !== '' ||
    (addDraft.notes ?? '').trim() !== '' ||
    String(addDraft.transaction_amount ?? '').trim() !== '' ||
    (addDraft.transaction_date ?? '').trim() !== '';

  const addIsComplete =
    (addDraft.transaction_type ?? '').trim() !== '' &&
    (addDraft.notes ?? '').trim() !== '' &&
    String(addDraft.transaction_amount ?? '').trim() !== '' &&
    (addDraft.transaction_date ?? '').trim() !== '';

  // ---------- Add row ----------
  function handleAddInput(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === 'transaction_amount') setAddDraft(p => ({ ...p, [name]: sanitizeMoneyInput(value) }));
    else setAddDraft(p => ({ ...p, [name]: value }));
  }

  async function handleAddSave() {
    if (!addIsComplete) return;
    try {
      const createdRes = await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id,
          amount: parseCurrencyNumber(addDraft.transaction_amount),   // POST expects amount/date
          date: addDraft.transaction_date,
          transaction_type: addDraft.transaction_type,
          notes: addDraft.notes,
        }),
      });
      if (!createdRes.ok) throw new Error('Failed to add transaction');
      const created = await createdRes.json();
      setTransactions([created, ...transactions]);
      setAddDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
      setFocus(null);
    } catch { alert('Create failed.'); }
  }

  function handleAddCancel() {
    if (!addHasAny) return;
    setAddDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setFocus(null);
  }

  // --- Esc helpers ---
  const escUnselect = (e: any) => { if (e.key === 'Escape') { (e.currentTarget as HTMLInputElement).blur(); setFocus(null); } };
  const addKeyDown = (e: any) => {
    if (e.key === 'Enter' && addIsComplete) handleAddSave();
    else if (e.key === 'Escape') { (e.currentTarget as HTMLInputElement).blur(); setFocus(null); }
  };

  // ---------- Edit row ----------
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === 'transaction_amount') setDraft(p => ({ ...p, [name]: sanitizeMoneyInput(value) }));
    else setDraft(p => ({ ...p, [name]: value }));
  }

  async function handleSave() {
    if (editingIdx === null || !transactions[editingIdx].transaction_id) return;
    const id = transactions[editingIdx].transaction_id!;
    // PATCH expects DB column names here:
    const payload = {
      transaction_type: draft.transaction_type || null,
      notes: draft.notes || null,
      transaction_amount: parseCurrencyNumber(draft.transaction_amount),
      transaction_date: draft.transaction_date || null,
    };

    try {
      const res = await fetch(`${API}/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      const updated = await res.json();
      const arr = [...transactions];
      arr[editingIdx] = updated;
      setTransactions(arr);
      setEditingIdx(null);
      setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
      setFocus(null);
    } catch (err) {
      console.error(err);
      alert('Update failed.');
    }
  }

  function handleCancel() {
    setEditingIdx(null);
    setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setFocus(null);
  }

  function startEdit(idx: number) {
    const row = transactions[idx];
    setDraft({
      ...row,
      transaction_amount: sanitizeMoneyInput(String(row.transaction_amount ?? '')),
      transaction_date: row.transaction_date?.slice(0, 10) ?? '',
    });
    setEditingIdx(idx);
    setFocus({ kind: 'edit', index: idx, col: 'type' });
  }

  async function handleDelete(idx: number) {
    const id = transactions[idx].transaction_id;
    if (id) await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
    setTransactions(transactions.filter((_, i) => i !== idx));
    handleCancel();
  }

  // highlights
  const isAddRowFocused = focus?.kind === 'add';
  const addRowStyle: CSSProperties = isAddRowFocused ? { outline: '2px solid #325dae', background: HILITE_BG } : {};
  const focusShadow = (cond: boolean): CSSProperties => (cond ? { boxShadow: FOCUS_RING } : {});

  return (
    <Box style={{ marginTop: 40 }}>
      <div style={{ width: TABLE_WIDTH }}>
        <Table
          style={{
            width: '100%', fontSize: 16, borderCollapse: 'collapse', border: '2px solid black',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)', marginTop: 0, marginBottom: 32,
            background: '#fff', tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: TYPE_WIDTH }} />
            <col style={{ width: NOTES_WIDTH }} />
            <col style={{ width: AMOUNT_WIDTH }} />
            <col style={{ width: DATE_WIDTH }} />
            <col style={{ width: ACTIONS_WIDTH }} />
          </colgroup>

          <thead>
            <tr>
              <th style={{ ...thStyle, width: TYPE_WIDTH }}>Transaction Type</th>
              <th style={{ ...thStyle, width: NOTES_WIDTH }}>Notes</th>
              <th style={{ ...thStyle, width: AMOUNT_WIDTH }}>Amount</th>
              <th style={{ ...thStyle, width: DATE_WIDTH }}>Date</th>
              <th style={{ ...thStyle, width: ACTIONS_WIDTH }}>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {/* Entry row */}
            <tr style={{ background: ENTRY_ROW_BG, ...addRowStyle }}>
              <td style={{ ...tdStyle, width: TYPE_WIDTH, background: ENTRY_ROW_BG, ...focusShadow(isAddRowFocused && focus?.col === 'type') }}>
                <input
                  name="transaction_type"
                  value={addDraft.transaction_type ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'type' })}
                  placeholder="Transaction Type"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>
              <td style={{ ...tdStyle, width: NOTES_WIDTH, background: ENTRY_ROW_BG, ...focusShadow(isAddRowFocused && focus?.col === 'notes') }}>
                <input
                  name="notes"
                  value={addDraft.notes ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'notes' })}
                  placeholder="Notes"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>
              <td style={{ ...tdStyle, width: AMOUNT_WIDTH, background: ENTRY_ROW_BG, ...focusShadow(isAddRowFocused && focus?.col === 'amount') }}>
                <input
                  name="transaction_amount"
                  value={addDraft.transaction_amount ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'amount' })}
                  placeholder="0.00"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d+(\.\d{0,2})?$"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>
              <td style={{ ...tdStyle, width: DATE_WIDTH, background: ENTRY_ROW_BG, ...focusShadow(isAddRowFocused && focus?.col === 'date') }}>
                <input
                  name="transaction_date"
                  value={addDraft.transaction_date ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'date' })}
                  onDoubleClick={() => setAddDraft(prev => ({ ...prev, transaction_date: todayISOInNY() }))}
                  placeholder="mm/dd/yyyy"
                  type="date"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>
              <td style={{ ...actionsCellStyle, background: ENTRY_ROW_BG }}>
                <div style={actionsBar}>
                  <Button style={{ ...cellSave, visibility: addHasAny ? 'visible' : 'hidden' }} onClick={handleAddSave} disabled={!addIsComplete}>
                    SAVE
                  </Button>
                  <Button style={{ ...cellCancel, visibility: addHasAny ? 'visible' : 'hidden' }} onClick={handleAddCancel} disabled={!addHasAny}>
                    CANCEL
                  </Button>
                  <Button style={{ ...cellDel, visibility: 'hidden' }} tabIndex={-1}>DEL</Button>
                </div>
              </td>
            </tr>

            {/* Existing rows */}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, border: '1px solid #111', color: '#c33', fontWeight: 600, letterSpacing: 1 }}>
                  No transactions logged
                </td>
              </tr>
            ) : (
              transactions.map((tx: TransactionRow, idx: number) => {
                const isRowFocused = focus?.kind === 'edit' && focus.index === idx;

                return editingIdx === idx ? (
                  <tr key={tx.transaction_id || `edit-${idx}`} style={{ ...(isRowFocused ? { outline: '2px solid #325dae', background: HILITE_BG } : {}) }}>
                    <td style={{ ...tdStyle, width: TYPE_WIDTH, ...focusShadow(isRowFocused && focus?.col === 'type') }}>
                      <input
                        name="transaction_type"
                        ref={firstInputRef}
                        value={draft.transaction_type ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'type' })}
                        placeholder="Transaction Type"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>
                    <td style={{ ...tdStyle, width: NOTES_WIDTH, ...focusShadow(isRowFocused && focus?.col === 'notes') }}>
                      <input
                        name="notes"
                        value={draft.notes ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'notes' })}
                        placeholder="Notes"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>
                    <td style={{ ...tdStyle, width: AMOUNT_WIDTH, ...focusShadow(isRowFocused && focus?.col === 'amount') }}>
                      <input
                        name="transaction_amount"
                        value={draft.transaction_amount ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'amount' })}
                        placeholder="0.00"
                        type="text"
                        inputMode="decimal"
                        pattern="^\d+(\.\d{0,2})?$"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>
                    <td style={{ ...tdStyle, width: DATE_WIDTH, ...focusShadow(isRowFocused && focus?.col === 'date') }}>
                      <input
                        name="transaction_date"
                        value={draft.transaction_date ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'date' })}
                        onDoubleClick={() => setDraft(prev => ({ ...prev, transaction_date: todayISOInNY() }))}
                        placeholder="mm/dd/yyyy"
                        type="date"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>
                    <td style={actionsCellStyle}>
                      <div style={actionsBar}>
                        <Button style={cellSave} onClick={handleSave}>SAVE</Button>
                        <Button style={cellCancel} onClick={handleCancel}>CANCEL</Button>
                        <Button style={cellDel} onClick={() => handleDelete(idx)}>DEL</Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={tx.transaction_id || `row-${idx}`}>
                    <td style={{ ...tdStyle, width: TYPE_WIDTH }}>{tx.transaction_type ?? ''}</td>
                    <td style={{ ...tdStyle, width: NOTES_WIDTH }}>{tx.notes ?? ''}</td>
                    <td style={{ ...tdStyle, width: AMOUNT_WIDTH }}>{formatCurrency(tx.transaction_amount)}</td>
                    <td style={{ ...tdStyle, width: DATE_WIDTH }}>{toMMDDYYYY(tx.transaction_date)}</td>
                    <td style={{ ...tdStyle, width: ACTIONS_WIDTH, padding: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'center', justifyItems: 'center', width: '100%', height: '100%', gap: 8, padding: '0 8px', boxSizing: 'border-box' }}>
                        <Button style={cellEdit} onClick={() => startEdit(idx)}>EDIT</Button>
                        <span style={{ minWidth: 100, height: 32 }} />
                        <Button style={cellDel} onClick={() => handleDelete(idx)}>DEL</Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>
    </Box>
  );
}
