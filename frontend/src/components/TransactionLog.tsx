import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Table, Box } from '@mantine/core';
import BannerMessage from './BannerMessage';
import { IconButton } from './ui/Icons'; // path unified with PropertyList
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';

// ===== API BASE (point directly at Fastify on 3000) =====
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:3000';
const API = `${API_BASE}/api`;

// --- CONSTANTS & SIZING ---
const UNIT_WIDTH = 175;
const TYPE_WIDTH = UNIT_WIDTH * 2; // WIDENED 2x as requested
const AMOUNT_WIDTH = UNIT_WIDTH;
const DATE_WIDTH = UNIT_WIDTH;
// No actions column anymore; actions live outside notes cell
const TABLE_WIDTH = 1225 + UNIT_WIDTH; // extra width to account for widened type (keeps nice proportions)
const NOTES_WIDTH = TABLE_WIDTH - (TYPE_WIDTH + AMOUNT_WIDTH + DATE_WIDTH); // fill remaining width

const ENTRY_ROW_BG = '#f4f9ff';
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

const TXN_TYPES = [
  'Security Deposit',
  'Late Fee',
  'Maintenance',
  'Repairs',
  'Property Tax',
  'Insurance',
  'HOA Fee',
  'Utilities',
  'Management Fee',
  'Leasing Fee',
  'Advertising / Marketing',
  'Legal / Professional Fees',
  'Misc Income',
  'Misc Expense',
  'Refund / Rebate',
] as const;

const TXN_OPTIONS: DropdownOption[] = TXN_TYPES.map((t) => ({ value: t }));

// --- STYLES ---
const thStyle: CSSProperties = {
  border: '1px solid #111',
  padding: '10px 14px',
  background: '#000000ff',
  color: '#fff',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
const tdStyle: CSSProperties = {
  border: '1px solid #222',
  padding: '10px 14px',
  fontSize: 16,
  background: '#fff',
  fontFamily: 'inherit',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  color: '#111',
  outline: 'none',
  margin: 0,
  padding: 0,
  verticalAlign: 'middle',
  boxSizing: 'border-box',
  textAlign: 'center',
};

// Anchor notes cell so actions can sit just outside the table on the right
const notesCellOuter: CSSProperties = { position: 'relative', overflow: 'visible' };

// A persistent hover region that exists even when icons are hidden.
const railWrapBase: CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: -8,
  transform: 'translate(100%, -50%)',
  display: 'flex',
  alignItems: 'center',
  minWidth: 88,
  height: 44,
  background: 'transparent',
  zIndex: 1500,
};

// The actual icons container inside the railWrap.
const railIcons = (visible: boolean): CSSProperties => ({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  opacity: visible ? 1 : 0,
  transition: 'opacity 140ms ease-in-out',
  pointerEvents: visible ? 'auto' : 'none',
});

const focusShadow = (cond: boolean): CSSProperties => (cond ? { boxShadow: FOCUS_RING } : {});

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
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
};

// --- TYPES ---
export type TransactionRow = {
  transaction_id?: number;
  transaction_type?: string;
  notes?: string;
  transaction_amount?: number | string;
  transaction_date?: string; // ISO yyyy-mm-dd
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
export default function TransactionLog({
  property_id,
  transactions,
  setTransactions,
}: TransactionLogProps) {
  const [addDraft, setAddDraft] = useState<TransactionRow>({
    transaction_type: '',
    notes: '',
    transaction_amount: '',
    transaction_date: '',
  });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TransactionRow>({
    transaction_type: '',
    notes: '',
    transaction_amount: '',
    transaction_date: '',
  });
  const [focus, setFocus] = useState<FocusState>(null);

  // error banner
  const [saveError, setSaveError] = useState<string | null>(null);

  // DELETE confirm (matches PropertyList behavior)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState<string>('');
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  // Hover only for the right-side action rail (icons area)
  const [hoveredRail, setHoveredRail] = useState<number | 'add' | null>(null);

  useEffect(() => {
    if (confirmIdx !== null) {
      setConfirmText('');
      setTimeout(() => confirmInputRef.current?.focus(), 0);
    }
  }, [confirmIdx]);

  // Global Escape: close delete confirm or exit edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmIdx !== null) {
        setConfirmIdx(null);
        setConfirmText('');
      } else if (editingIdx !== null) {
        handleCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmIdx, editingIdx]);

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
    if (name === 'transaction_amount') setAddDraft((p) => ({ ...p, [name]: sanitizeMoneyInput(value) }));
    else setAddDraft((p) => ({ ...p, [name]: value }));
  }

  async function handleAddSave() {
    if (!addIsComplete) return;
    try {
      const createdRes = await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id,
          amount: parseCurrencyNumber(addDraft.transaction_amount), // POST expects amount/date
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
      setSaveError(null);
    } catch (err: any) {
      console.error(err);
      setSaveError('Create failed.');
    }
  }

  function handleAddCancel() {
    if (!addHasAny) return;
    setAddDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setFocus(null);
  }

  const escUnselect = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLInputElement).blur();
      setFocus(null);
    }
  };
  const addKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && addIsComplete) handleAddSave();
    else if (e.key === 'Escape') {
      (e.currentTarget as HTMLInputElement).blur();
      setFocus(null);
    }
  };

  // ---------- Edit row ----------
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === 'transaction_amount') setDraft((p) => ({ ...p, [name]: sanitizeMoneyInput(value) }));
    else setDraft((p) => ({ ...p, [name]: value }));
  }

  async function handleSave() {
    if (editingIdx === null || !transactions[editingIdx].transaction_id) return;
    const id = transactions[editingIdx].transaction_id!;
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
      setSaveError(null);
    } catch (err) {
      console.error(err);
      setSaveError('Update failed.');
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

  async function tryDeleteURL(url: string, init?: RequestInit) {
    const res = await fetch(url, { method: 'DELETE', ...init });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  }

  async function doDelete(idx: number) {
    const id = transactions[idx]?.transaction_id;
    if (!id) {
      setSaveError('Missing transaction id.');
      return;
    }

    const attempts = [
      () => tryDeleteURL(`${API}/transactions/${id}`),
      () => tryDeleteURL(`${API}/transactions?id=${encodeURIComponent(String(id))}`),
      () =>
        tryDeleteURL(`${API}/transactions`, {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction_id: id }),
        }),
    ];

    let last: { ok: boolean; status?: number; text?: string } | null = null;

    for (const attempt of attempts) {
      try {
        const res = await attempt();
        last = res;

        if (res.ok || res.status === 404) {
          // Success or treat 404 as already removed
          setTransactions(transactions.filter((_, i) => i !== idx));
          setConfirmIdx(null);
          setConfirmText('');
          if (editingIdx === idx) handleCancel();
          setSaveError(null);
          return;
        }
      } catch (e: any) {
        last = { ok: false, text: e?.message };
      }
    }

    setSaveError(
      `Delete failed${last?.status ? ` (${last.status})` : ''}${last?.text ? `: ${last.text}` : ''}`,
    );
  }

  const isAddRowFocused = focus?.kind === 'add';
  const addRowStyle: CSSProperties = isAddRowFocused
    ? { outline: '2px solid #325dae', background: HILITE_BG }
    : {};

  return (
    <Box style={{ marginTop: 40, width: TABLE_WIDTH, overflow: 'visible' }}>
      {/* Error banner */}
      {saveError && (
        <div style={{ width: TABLE_WIDTH, margin: '0 auto 24px' }}>
          <BannerMessage
            message={saveError}
            type="error"
            autoCloseMs={5000}
            onDismiss={() => setSaveError(null)}
          />
        </div>
      )}

      {/* Title */}
      <div
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 0',
          padding: '12px 16px',
          background: '#b6b6b6ff',
          border: '4px solid #000',
          borderBottom: 'none',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: 1,
        }}
      >
        TRANSACTION LOG
      </div>

      <div style={{ width: TABLE_WIDTH, overflow: 'visible' }}>
        <Table
          style={{
            width: '100%',
            fontSize: 16,
            borderCollapse: 'collapse',
            border: '4px solid #000',
            boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
            marginTop: 0,
            marginBottom: 32,
            background: '#fff',
            tableLayout: 'fixed',
            overflow: 'visible',
          }}
        >
          <colgroup>
            <col style={{ width: TYPE_WIDTH }} />
            <col style={{ width: AMOUNT_WIDTH }} />
            <col style={{ width: DATE_WIDTH }} />
            <col style={{ width: NOTES_WIDTH }} />
          </colgroup>

          <thead>
            <tr>
              <th style={{ ...thStyle, width: TYPE_WIDTH }}>Transaction Type</th>
              <th style={{ ...thStyle, width: AMOUNT_WIDTH }}>Amount</th>
              <th style={{ ...thStyle, width: DATE_WIDTH }}>Date</th>
              <th style={{ ...thStyle, width: NOTES_WIDTH }}>Notes</th>
            </tr>
          </thead>

          <tbody>
            {/* Entry row */}
            <tr style={{ background: ENTRY_ROW_BG, ...addRowStyle }}>
              <td
                style={{
                  ...tdStyle,
                  width: TYPE_WIDTH,
                  background: ENTRY_ROW_BG,
                  ...focusShadow(isAddRowFocused && focus?.col === 'type'),
                }}
              >
                <div onFocusCapture={() => setFocus({ kind: 'add', col: 'type' })}>
                  <UniversalDropdown
                    value={addDraft.transaction_type || null}
                    options={TXN_OPTIONS}
                    placeholder="Select Type"
                    ariaLabel="Transaction type"
                    onChange={(val) =>
                      setAddDraft((p) => ({ ...p, transaction_type: val }))
                    }
                  />
                </div>
              </td>

              <td
                style={{
                  ...tdStyle,
                  width: AMOUNT_WIDTH,
                  background: ENTRY_ROW_BG,
                  ...focusShadow(isAddRowFocused && focus?.col === 'amount'),
                }}
              >
                <input
                  name="transaction_amount"
                  value={addDraft.transaction_amount ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'amount' })}
                  placeholder="0.00"
                  type="text"
                  inputMode="decimal"
                  pattern="^\\d+(\\.\\d{0,2})?$"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>

              <td
                style={{
                  ...tdStyle,
                  width: DATE_WIDTH,
                  background: ENTRY_ROW_BG,
                  ...focusShadow(isAddRowFocused && focus?.col === 'date'),
                }}
              >
                <input
                  name="transaction_date"
                  value={addDraft.transaction_date ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'date' })}
                  onDoubleClick={() =>
                    setAddDraft((prev) => ({ ...prev, transaction_date: todayISOInNY() }))
                  }
                  placeholder="mm/dd/yyyy"
                  type="date"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />
              </td>

              <td
                style={{
                  ...tdStyle,
                  width: NOTES_WIDTH,
                  background: ENTRY_ROW_BG,
                  ...focusShadow(isAddRowFocused && focus?.col === 'notes'),
                  ...notesCellOuter,
                }}
              >
                <input
                  name="notes"
                  value={addDraft.notes ?? ''}
                  onChange={handleAddInput}
                  onFocus={() => setFocus({ kind: 'add', col: 'notes' })}
                  placeholder="Notes"
                  style={inputStyle}
                  onKeyDown={addKeyDown}
                />

                {/* Rail hover area — Add row: visible after input, OR on rail hover */}
                <div
                  style={railWrapBase}
                  onMouseEnter={() => setHoveredRail('add')}
                  onMouseLeave={() => setHoveredRail((p) => (p === 'add' ? null : p))}
                >
                  <div style={railIcons(addHasAny || hoveredRail === 'add')}>
                    <IconButton
                      icon="addCircle"
                      label="Save"
                      onClick={handleAddSave}
                      disabled={!addIsComplete}
                      title="Save"
                      size="sm"
                      variant="success"
                    />
                    <IconButton
                      icon="clear"
                      label="Cancel"
                      onClick={handleAddCancel}
                      disabled={!addHasAny}
                      title="Cancel"
                      size="sm"
                      variant="ghost"
                    />
                  </div>
                </div>
              </td>
            </tr>

            {/* Existing rows */}
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    ...tdStyle,
                    border: '1px solid #111',
                    color: '#c33',
                    fontWeight: 600,
                    letterSpacing: 1,
                  }}
                >
                  No transactions logged
                </td>
              </tr>
            ) : (
              transactions.map((tx: TransactionRow, idx: number) => {
                const isRowFocused = focus?.kind === 'edit' && focus.index === idx;
                const confirming = confirmIdx === idx;
                const editing = editingIdx === idx;

                return editing ? (
                  <tr
                    key={tx.transaction_id || `edit-${idx}`}
                    style={{
                      ...(isRowFocused ? { outline: '2px solid #325dae', background: HILITE_BG } : {}),
                    }}
                  >
                    <td
                      style={{
                        ...tdStyle,
                        width: TYPE_WIDTH,
                        ...focusShadow(isRowFocused && focus?.col === 'type'),
                      }}
                    >
                      <div onFocusCapture={() => setFocus({ kind: 'edit', index: idx, col: 'type' })}>
                        <UniversalDropdown
                          value={draft.transaction_type || null}
                          options={TXN_OPTIONS}
                          placeholder="Transaction Type"
                          ariaLabel="Transaction type"
                          onChange={(val) =>
                            setDraft((p) => ({ ...p, transaction_type: val }))
                          }
                        />
                      </div>
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        width: AMOUNT_WIDTH,
                        ...focusShadow(isRowFocused && focus?.col === 'amount'),
                      }}
                    >
                      <input
                        name="transaction_amount"
                        value={draft.transaction_amount ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'amount' })}
                        placeholder="0.00"
                        type="text"
                        inputMode="decimal"
                        pattern="^\\d+(\\.\\d{0,2})?$"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        width: DATE_WIDTH,
                        ...focusShadow(isRowFocused && focus?.col === 'date'),
                      }}
                    >
                      <input
                        name="transaction_date"
                        value={draft.transaction_date ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'date' })}
                        onDoubleClick={() =>
                          setDraft((prev) => ({ ...prev, transaction_date: todayISOInNY() }))
                        }
                        placeholder="mm/dd/yyyy"
                        type="date"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        width: NOTES_WIDTH,
                        ...focusShadow(isRowFocused && focus?.col === 'notes'),
                        ...notesCellOuter,
                      }}
                    >
                      <input
                        name="notes"
                        value={draft.notes ?? ''}
                        onChange={handleInput}
                        onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'notes' })}
                        placeholder="Notes"
                        style={inputStyle}
                        onKeyDown={escUnselect}
                      />

                      {/* Edit-mode rail: always visible while editing */}
                      <div style={railWrapBase}>
                        {!confirming ? (
                          <div style={railIcons(true)}>
                            <IconButton
                              icon="addCircle"
                              label="Save"
                              onClick={handleSave}
                              title="Save"
                              size="sm"
                              variant="success"
                            />
                            <IconButton
                              icon="clear"
                              label="Cancel edit"
                              onClick={handleCancel}
                              title="Cancel"
                              size="sm"
                              variant="ghost"
                            />
                            <IconButton
                              icon="delete"
                              label="Delete"
                              onClick={() => setConfirmIdx(idx)}
                              title="Delete"
                              size="sm"
                              variant="danger"
                            />
                          </div>
                        ) : (
                          <>
                            {/* Tooltip above input */}
                            <div
                              role="tooltip"
                              style={{
                                position: 'absolute',
                                bottom: 56,
                                left: 0,
                                padding: '8px 10px',
                                background: '#111',
                                color: '#fff',
                                border: '2px solid #111',
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                fontSize: 12,
                                whiteSpace: 'nowrap',
                                borderRadius: 6,
                                boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
                              }}
                            >
                              Type DELETE and press Enter to permanently delete.
                            </div>

                            {/* Expand input to the right, like PropertyList */}
                            <div
                              style={{
                                width: 80,
                                height: 44,
                                border: '2px solid #c33',
                                background: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              <input
                                ref={confirmInputRef}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="DELETE"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (confirmText.trim().toUpperCase() === 'DELETE') {
                                      void doDelete(idx);
                                    } else {
                                      setSaveError('Please type DELETE to confirm.');
                                    }
                                  } else if (e.key === 'Escape') {
                                    setConfirmIdx(null);
                                    setConfirmText('');
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  border: 'none',
                                  outline: 'none',
                                  textAlign: 'center',
                                  fontWeight: 900,
                                  letterSpacing: 1,
                                  textTransform: 'uppercase',
                                  fontSize: 14,
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>

                            <div style={{ marginLeft: 8 }}>
                              <IconButton
                                icon="clear"
                                label="Cancel delete"
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setConfirmIdx(null);
                                  setConfirmText('');
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={tx.transaction_id || `row-${idx}`}>
                    <td style={{ ...tdStyle, width: TYPE_WIDTH }}>{tx.transaction_type ?? ''}</td>
                    <td style={{ ...tdStyle, width: AMOUNT_WIDTH }}>{formatCurrency(tx.transaction_amount)}</td>
                    <td style={{ ...tdStyle, width: DATE_WIDTH }}>{toMMDDYYYY(tx.transaction_date)}</td>
                    <td style={{ ...tdStyle, width: NOTES_WIDTH, ...notesCellOuter }}>
                      <div style={{ textAlign: 'center' }}>{tx.notes ?? ''}</div>

                      {/* View-mode rail: icons appear only when hovering this area (or when confirming) */}
                      <div
                        style={railWrapBase}
                        onMouseEnter={() => setHoveredRail(idx)}
                        onMouseLeave={() => setHoveredRail((p) => (p === idx ? null : p))}
                      >
                        {!confirming ? (
                          <div style={railIcons(hoveredRail === idx)}>
                            <IconButton
                              icon="edit"
                              label="Edit"
                              onClick={() => startEdit(idx)}
                              title="Edit"
                              size="sm"
                            />
                            <IconButton
                              icon="delete"
                              label="Delete"
                              onClick={() => setConfirmIdx(idx)}
                              title="Delete"
                              size="sm"
                              variant="danger"
                            />
                          </div>
                        ) : (
                          <>
                            <div
                              role="tooltip"
                              style={{
                                position: 'absolute',
                                bottom: 56,
                                left: 0,
                                padding: '8px 10px',
                                background: '#111',
                                color: '#fff',
                                border: '2px solid #111',
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                fontSize: 12,
                                whiteSpace: 'nowrap',
                                borderRadius: 6,
                                boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
                              }}
                            >
                              Type DELETE and press Enter to permanently delete.
                            </div>

                            <div
                              style={{
                                width: 80,
                                height: 44,
                                border: '2px solid #c33',
                                background: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              <input
                                ref={confirmInputRef}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="DELETE"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (confirmText.trim().toUpperCase() === 'DELETE') {
                                      void doDelete(idx);
                                    } else {
                                      setSaveError('Please type DELETE to confirm.');
                                    }
                                  } else if (e.key === 'Escape') {
                                    setConfirmIdx(null);
                                    setConfirmText('');
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  border: 'none',
                                  outline: 'none',
                                  textAlign: 'center',
                                  fontWeight: 900,
                                  letterSpacing: 1,
                                  textTransform: 'uppercase',
                                  fontSize: 14,
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>

                            <div style={{ marginLeft: 8 }}>
                              <IconButton
                                icon="clear"
                                label="Cancel delete"
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setConfirmIdx(null);
                                  setConfirmText('');
                                }}
                              />
                            </div>
                          </>
                        )}
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
