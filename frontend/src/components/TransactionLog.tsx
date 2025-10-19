// src/components/TransactionLog.tsx
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { Table, Box } from '@mantine/core';
import BannerMessage from './BannerMessage';
import { Icon, IconButton } from './ui/Icons';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';

/* API */
const API = 'http://localhost:3000/api';

/* Sizing */
const ROW_H = 56;
const UNIT_W = 175;
const TYPE_W = UNIT_W * 2;
const AMOUNT_W = UNIT_W;
const DATE_W = UNIT_W;
const TABLE_W = 1575;
const NOTES_W = TABLE_W - (TYPE_W + AMOUNT_W + DATE_W);

/* Tokens */
const BASE_FONT_SIZE = 16;
const TEXT_COLOR = '#111';
const HEADER_RULE = '2px solid rgba(0,0,0,0.25)';
const DIVIDER = '1px solid rgba(0,0,0,0.18)';
const ROW_HOVER_BG = '#d6e7ffff';
const ENTRY_BG = '#f4f4f4';
const EDIT_DIM_BG = '#00000075';

/* Styles */
const thNoLines: CSSProperties = {
  border: 'none',
  padding: 0,
  background: 'transparent',
  color: '#2b2b2b',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  textAlign: 'center',
  minHeight: 52,
  userSelect: 'none',
};
const headerBtn: CSSProperties = {
  width: '100%',
  minHeight: 52,
  padding: '6px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'box-shadow 160ms ease, background 120ms ease, transform 120ms ease',
  lineHeight: '18px',
  fontSize: 16,
  fontWeight: 800,
  color: '#2b2b2b',
  textTransform: 'uppercase',
  borderRadius: 6,
};
const tdVertLightBase: CSSProperties = {
  borderLeft: DIVIDER,
  borderRight: DIVIDER,
  borderTop: 'none',
  borderBottom: 'none',
  padding: '0 10px',
  fontSize: BASE_FONT_SIZE,
  background: '#fff',
  verticalAlign: 'middle',
  textAlign: 'center',
  height: ROW_H,
  boxSizing: 'border-box',
  color: TEXT_COLOR,
};
const inputTight: CSSProperties = {
  width: '90%',
  height: 36,
  border: 'none',
  background: 'transparent',
  fontSize: BASE_FONT_SIZE,
  color: TEXT_COLOR,
  outline: 'none',
  padding: 0,
  margin: '0 auto',
  display: 'block',
  textAlign: 'center',
};
const inputNotes: CSSProperties = { ...inputTight, textAlign: 'left' };

const TYPE_CELL_INNER: CSSProperties = {
  width: '72%',
  minWidth: 260,
  maxWidth: 420,
  margin: '0 auto',
  padding: '6px 8px',
  boxSizing: 'border-box',
};

/* Dropdown options */
const TXN_TYPES_BASE = [
  'Advertising / Marketing',
  'HOA Fee',
  'Insurance',
  'Late Fee',
  'Leasing Fee',
  'Legal / Professional Fees',
  'Management Fee',
  'Maintenance',
  'Misc Expense',
  'Misc Income',
  'Property Tax',
  'Refund / Rebate',
  'Repairs',
  'Security Deposit',
  'Utilities',
] as const;
const TXN_TYPES = [...TXN_TYPES_BASE].sort((a, b) => a.localeCompare(b));
const TXN_OPTIONS: DropdownOption[] = TXN_TYPES.map((t) => ({ value: t }));

/* Helpers */
const parseCurrencyNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const formatCurrency = (v: any): string => {
  const n = parseCurrencyNumber(v);
  if (n === null) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
const sanitizeMoney = (raw: string) => {
  let s = raw.replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) {
    s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    const [a, b = ''] = s.split('.');
    s = a + '.' + b.slice(0, 2);
  }
  if (s.startsWith('.')) s = '0' + s;
  return s;
};
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

/* Sort icons */
const sortIcons = { asc: <Icon name="sortUp" />, desc: <Icon name="sortDown" />, none: <Icon name="sort" /> } as const;

/* Types */
export type TransactionRow = {
  transaction_id?: number;
  transaction_type?: string;
  notes?: string;
  transaction_amount?: number | string;
  transaction_date?: string;
};
type Props = {
  property_id: number;
  transactions: TransactionRow[];
  setTransactions: (rows: TransactionRow[]) => void;
};
type FocusState =
  | { kind: 'add'; col: 'type' | 'amount' | 'date' | 'notes' }
  | { kind: 'edit'; index: number; col: 'type' | 'amount' | 'date' | 'notes' }
  | null;
type SortKey = 'transaction_type' | 'transaction_amount' | 'transaction_date';
type SortDir = 'asc' | 'desc';

export default function TransactionLog({ property_id, transactions, setTransactions }: Props) {
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hoverHdr, setHoverHdr] = useState<SortKey | null>(null);

// Calculate running total of all logged amounts
const totalAmount = useMemo(() => {
  return transactions.reduce((sum, t) => {
    const n = parseFloat(String(t.transaction_amount || '').replace(/[^\d.-]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
}, [transactions]);


  const sortedRows = useMemo(() => {
    const list = transactions.slice();
    list.sort((a, b) => {
      let av: any;
      let bv: any;
      if (sortKey === 'transaction_amount') {
        av = parseCurrencyNumber(a.transaction_amount);
        bv = parseCurrencyNumber(b.transaction_amount);
        av = av ?? -Infinity;
        bv = bv ?? -Infinity;
      } else if (sortKey === 'transaction_date') {
        av = (a.transaction_date || '').slice(0, 10);
        bv = (b.transaction_date || '').slice(0, 10);
      } else {
        av = (a.transaction_type || '').toLowerCase();
        bv = (b.transaction_type || '').toLowerCase();
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [transactions, sortKey, sortDir]);

  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState(0);
  const measure = useCallback(() => setMaxH(bodyRef.current?.scrollHeight ?? 0), []);
  useLayoutEffect(() => { measure(); }, [measure, transactions, editingIdx, focus, addDraft, draft, open]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  const addHasAny =
    (addDraft.transaction_type ?? '').trim() ||
    (addDraft.notes ?? '').trim() ||
    String(addDraft.transaction_amount ?? '').trim() ||
    (addDraft.transaction_date ?? '').trim();
  const addIsComplete =
    (addDraft.transaction_type ?? '').trim() &&
    (addDraft.notes ?? '').trim() &&
    String(addDraft.transaction_amount ?? '').trim() &&
    (addDraft.transaction_date ?? '').trim();

  const editIsComplete =
    (draft.transaction_type ?? '').trim() &&
    (draft.notes ?? '').trim() &&
    String(draft.transaction_amount ?? '').trim() &&
    (draft.transaction_date ?? '').trim();

  const editHasAny =
    editingIdx !== null &&
    ['transaction_type', 'notes', 'transaction_amount', 'transaction_date'].some((k) => {
      const a = String((draft as any)[k] ?? '').trim();
      const b = String((transactions[editingIdx as number] as any)[k] ?? '').trim();
      return a !== b;
    });

  const onEditCancel = useCallback(() => {
    setEditingIdx(null);
    setDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setFocus(null);
    setConfirmIdx(null);
  }, []);

  /* KEY ESCAPE */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmIdx !== null) { setConfirmIdx(null); return; }
      if (editingIdx !== null) onEditCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmIdx, editingIdx, onEditCancel]);

  /* Input helpers */
  const addKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && addIsComplete) onAddSave();
    else if (e.key === 'Escape') {
      (e.currentTarget as HTMLInputElement).blur();
      setFocus(null);
      setConfirmIdx(null);
    }
  };
  const escUnfocus = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLInputElement).blur();
      onEditCancel();
    }
  };

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const rowActionsVisible = (idx: number, isEditing: boolean, isConfirming: boolean) =>
    hoveredRow === idx || isEditing || isConfirming;

  const openCombobox = (el: HTMLElement) => {
    const box = el.querySelector<HTMLElement>('[role="combobox"], input');
    if (!box) return;
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    box.focus();
  };

  /* ADD logic */
  function onAddInput(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setAddDraft((p) => ({ ...p, [name]: name === 'transaction_amount' ? sanitizeMoney(value) : value }));
  }
  async function onAddSave() {
    if (!addIsComplete) return;
    try {
      const res = await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id,
          amount: parseCurrencyNumber(addDraft.transaction_amount),
          date: addDraft.transaction_date,
          transaction_type: addDraft.transaction_type,
          notes: addDraft.notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setTransactions([created, ...transactions]);
      setAddDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
      setFocus(null);
      setErrorMsg(null);
      setConfirmIdx(null);
      requestAnimationFrame(measure);
    } catch {
      setErrorMsg('Create failed.');
    }
  }
  function onAddCancel() {
    if (!addHasAny) return;
    setAddDraft({ transaction_type: '', notes: '', transaction_amount: '', transaction_date: '' });
    setFocus(null);
    setConfirmIdx(null);
  }

  /* EDIT logic */
  function onEditInput(e: React.ChangeEvent<HTMLInputElement>) {
  const { name, value } = e.target;
  setDraft((p) => ({
    ...p,
    [name]: name === 'transaction_amount' ? sanitizeMoney(value) : value,
  }));
}
  function startEdit(i: number) {
    const r = transactions[i];
    setDraft({
      ...r,
      transaction_amount: sanitizeMoney(String(r.transaction_amount ?? '')),
      transaction_date: r.transaction_date?.slice(0, 10) ?? '',
    });
    setEditingIdx(i);
    setFocus({ kind: 'edit', index: i, col: 'type' });
    setConfirmIdx(null);
  }
  async function onEditSave() {
    if (editingIdx === null || !transactions[editingIdx]?.transaction_id) return;
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
      onEditCancel();
      requestAnimationFrame(measure);
    } catch {
      setErrorMsg('Update failed.');
    }
  }

  /* DELETE */
  const confirmBtnStyle: CSSProperties = {
    height: ROW_H,
    padding: '0 18px',
    fontWeight: 700,
    letterSpacing: 1,
    background: '#000',
    color: '#ffef09',
    border: '1px solid #000',
    cursor: 'pointer',
    userSelect: 'none',
  };
  async function doDelete(idx: number) {
    const id = transactions[idx]?.transaction_id;
    if (!id) { setErrorMsg('Missing transaction id.'); setConfirmIdx(null); return; }
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404 && res.status !== 204) {
        const msg = (await res.text().catch(() => '')) || res.statusText || String(res.status);
        setErrorMsg(`Delete failed. ${msg}`.trim());
        setConfirmIdx(null);
        return;
      }
      setTransactions(transactions.filter((_, i) => i !== idx));
      if (editingIdx === idx) onEditCancel();
      setConfirmIdx(null);
    } catch (e: any) {
      setErrorMsg(`Delete failed. ${e?.message || ''}`.trim());
      setConfirmIdx(null);
    }
  }

  return (
    <Box style={{ margin: '0 auto', width: TABLE_W, overflow: 'visible', color: TEXT_COLOR }}>
      {errorMsg && (
        <div style={{ width: TABLE_W, margin: '0 auto' }}>
          <BannerMessage message={errorMsg} type="error" autoCloseMs={5000} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* CLICKABLE TITLE */}
<div
  onClick={() => setOpen(v => !v)}
  style={{
    width: TABLE_W,
    padding: '12px 16px',
    background: 'transparent',
    borderBottom: HEADER_RULE,
    borderTop: DIVIDER,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 1,
    color: TEXT_COLOR,
    cursor: 'pointer',
    userSelect: 'none',
    position: 'relative',
  }}
>
  {/* TOTAL BADGE — NEW */}
  <div
    style={{
      position: 'absolute',
      left: 40,
      top: '50%',
      transform: 'translateY(-50%)',
      background: '#d40000',
      color: '#fff',
      padding: '2px 14px',
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 30,
      lineHeight: 1,
    }}
  >
    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
  </div>

  TRANSACTION LOG
</div>
      <div style={{ width: TABLE_W, margin: '0 auto', height: 0, borderBottom: DIVIDER, pointerEvents: 'none' }} />

      {/* BODY */}
      <div
        ref={bodyRef}
        style={{
          overflow: open ? 'visible' : 'hidden',
          maxHeight: open ? maxH : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 260ms ease, opacity 200ms ease',
        }}
      >
        <div style={{ width: TABLE_W, overflow: 'visible' }}>
          <Table
            style={{
              width: '100%',
              fontSize: BASE_FONT_SIZE,
              borderCollapse: 'collapse',
              background: '#fff',
              tableLayout: 'fixed',
              color: TEXT_COLOR,
            }}
          >
            <colgroup>
              <col style={{ width: TYPE_W }} />
              <col style={{ width: AMOUNT_W }} />
              <col style={{ width: DATE_W }} />
              <col style={{ width: NOTES_W }} />
            </colgroup>

            {/* HEADER */}
            <thead>
              <tr style={{ height: ROW_H, borderBottom: DIVIDER }}>
                {([
                  { key: 'transaction_type', title: 'Transaction Type', width: TYPE_W },
                  { key: 'transaction_amount', title: 'Amount', width: AMOUNT_W },
                  { key: 'transaction_date', title: 'Date', width: DATE_W },
                ] as Array<{ key: SortKey; title: string; width: number }>).map((c) => {
                  const active = sortKey === c.key;
                  const icon = !active ? sortIcons.none : (sortDir === 'asc' ? sortIcons.asc : sortIcons.desc);
                  const hovered = hoverHdr === c.key;
                  return (
                    <th key={c.key} style={{ ...thNoLines, width: c.width }}>
                      <button
                        type="button"
                        onClick={() =>
                          active
                            ? setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                            : (setSortKey(c.key), setSortDir('asc'))
                        }
                        onMouseEnter={() => setHoverHdr(c.key)}
                        onMouseLeave={() => setHoverHdr((k) => (k === c.key ? null : k))}
                        style={{
                          ...headerBtn,
                          background: hovered ? '#fff' : 'transparent',
                          boxShadow: hovered ? '0 6px 16px rgba(0,0,0,0.18)' : 'none',
                          transform: hovered ? 'translateY(-1px)' : 'none',
                        }}
                      >
                        <span style={{ pointerEvents: 'none', maxWidth: 'calc(100% - 28px)' }}>{c.title.toUpperCase()}</span>
                        <span style={{ pointerEvents: 'none', display: 'inline-flex' }}>{icon}</span>
                      </button>
                    </th>
                  );
                })}
                <th style={{ ...thNoLines, width: NOTES_W }}>
                  <div style={{ ...headerBtn, cursor: 'default', background: 'transparent', boxShadow: 'none' }}>
                    <span>NOTES</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Entry row: stays gray, disabled while editing but not dimmed */}
              {(() => {
                const lock = editingIdx !== null;
                return (
                  <tr style={{ background: ENTRY_BG, height: ROW_H }}>
                    <td
                      style={{ ...tdVertLightBase, border: 'none', background: 'transparent', width: TYPE_W, ...(lock ? { pointerEvents: 'none' } : {}) }}
                      onClick={(e) => openCombobox(e.currentTarget)}
                    >
                      <div style={TYPE_CELL_INNER}>
                        <UniversalDropdown
                          value={addDraft.transaction_type || null}
                          options={TXN_OPTIONS}
                          placeholder="Transaction Type"
                          ariaLabel="Transaction type"
                          onChange={(val) => setAddDraft((p) => ({ ...p, transaction_type: val }))}
                        />
                      </div>
                    </td>

                    <td style={{ ...tdVertLightBase, border: 'none', background: 'transparent', width: AMOUNT_W, ...(lock ? { pointerEvents: 'none' } : {}) }}>
                      <input
                        name="transaction_amount"
                        value={addDraft.transaction_amount ?? ''}
                        onChange={onAddInput}
                        placeholder="0.00"
                        type="text"
                        inputMode="decimal"
                        pattern="^\\d+(\\.\\d{0,2})?$"
                        style={inputTight}
                        onKeyDown={addKeyDown}
                        onFocus={() => setFocus({ kind: 'add', col: 'amount' })}
                      />
                    </td>

                    <td style={{ ...tdVertLightBase, border: 'none', background: 'transparent', width: DATE_W, ...(lock ? { pointerEvents: 'none' } : {}) }}>
                      <input
                        name="transaction_date"
                        value={addDraft.transaction_date ?? ''}
                        onChange={onAddInput}
                        onDoubleClick={() => setAddDraft((p) => ({ ...p, transaction_date: todayISOInNY() }))}
                        placeholder="mm/dd/yyyy"
                        type="date"
                        style={inputTight}
                        onKeyDown={addKeyDown}
                        onFocus={() => setFocus({ kind: 'add', col: 'date' })}
                      />
                    </td>

                    <td style={{ ...tdVertLightBase, border: 'none', background: 'transparent', width: NOTES_W, position: 'relative', ...(lock ? { pointerEvents: 'none' } : {}) }}>
                      <input
                        name="notes"
                        value={addDraft.notes ?? ''}
                        onChange={onAddInput}
                        placeholder="Notes"
                        style={inputNotes}
                        onKeyDown={addKeyDown}
                        onFocus={() => setFocus({ kind: 'add', col: 'notes' })}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: 'calc(100% + 8px)',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'inline-flex',
                          gap: 8,
                          alignItems: 'center',
                          opacity: addIsComplete || addHasAny ? 1 : 0,
                          transition: 'opacity 160ms ease',
                        }}
                      >
                        {addHasAny && <IconButton icon="cancel" label="Cancel" onClick={onAddCancel} />}
                                              {addIsComplete && <IconButton icon="save" label="Save" onClick={onAddSave} />}

                      </div>
                    </td>
                  </tr>
                );
              })()}

              {/* Data rows */}
              {sortedRows.length === 0 ? (
                <tr style={{ height: ROW_H }}>
                  <td colSpan={4} style={{ ...tdVertLightBase, borderLeft: 'none', borderRight: 'none', color: '#c33', fontWeight: 600, letterSpacing: 1 }}>
                    No transactions logged
                  </td>
                </tr>
              ) : (
                sortedRows.map((tx, idx) => {
                  const isEditing = editingIdx === idx;
                  const isConfirming = confirmIdx === idx;
                  const hovered = hoveredRow === idx;
                  const dimOthers = editingIdx !== null && !isEditing;

                  return isEditing ? (
                    <tr
                      key={tx.transaction_id || `edit-${idx}`}
                      style={{ height: ROW_H /* no tr background */ }}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td
                        style={{
                          ...tdVertLightBase,
                          width: TYPE_W,
                          borderLeft: 'none',
                          background: hovered ? ROW_HOVER_BG : '#fff',
                        }}
                        onClick={(e) => openCombobox(e.currentTarget)}
                      >
                        <div style={TYPE_CELL_INNER}>
                          <UniversalDropdown
                            value={draft.transaction_type || null}
                            options={TXN_OPTIONS}
                            placeholder="Transaction Type"
                            ariaLabel="Transaction type"
                            onChange={(val) => setDraft((p) => ({ ...p, transaction_type: val }))}
                          />
                        </div>
                      </td>

                      <td style={{ ...tdVertLightBase, width: AMOUNT_W, background: hovered ? ROW_HOVER_BG : '#fff' }}>
                        <input
                          name="transaction_amount"
                          value={draft.transaction_amount ?? ''}
                          onChange={onEditInput}
                          placeholder="0.00"
                          type="text"
                          inputMode="decimal"
                          pattern="^\\d+(\\.\\d{0,2})?$"
                          style={inputTight}
                          onKeyDown={escUnfocus}
                          onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'amount' })}
                        />
                      </td>

                      <td style={{ ...tdVertLightBase, width: DATE_W, background: hovered ? ROW_HOVER_BG : '#fff' }}>
                        <input
                          name="transaction_date"
                          value={draft.transaction_date ?? ''}
                          onChange={onEditInput}
                          onDoubleClick={() => setDraft((p) => ({ ...p, transaction_date: todayISOInNY() }))}
                          placeholder="mm/dd/yyyy"
                          type="date"
                          style={inputTight}
                          onKeyDown={escUnfocus}
                          onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'date' })}
                        />
                      </td>

                      <td style={{ ...tdVertLightBase, width: NOTES_W, borderRight: 'none', position: 'relative', background: hovered ? ROW_HOVER_BG : '#fff', overflow: 'visible' }}>
                        <input
                          name="notes"
                          value={draft.notes ?? ''}
                          onChange={onEditInput}
                          placeholder="Notes"
                          style={inputNotes}
                          onKeyDown={escUnfocus}
                          onFocus={() => setFocus({ kind: 'edit', index: idx, col: 'notes' })}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 'calc(100% + 8px)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'inline-flex',
                            gap: 10,
                            alignItems: 'center',
                            opacity: 1,
                            transition: 'opacity 160ms ease',
                            zIndex: 1500,
                          }}
                        >
                          {/* Clear first, then Save */}
                          {editHasAny && <IconButton icon="cancel" label="Clear changes" onClick={onEditCancel} />}
                          {editIsComplete && <IconButton icon="save" label="Save" onClick={onEditSave} />}
                          {isConfirming ? (
                            <button type="button" aria-label="Confirm delete" style={confirmBtnStyle} onClick={() => void doDelete(idx)}>
                              CONFIRM?
                            </button>
                          ) : (
                            <IconButton icon="delete" label="Delete" onClick={() => setConfirmIdx(idx)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={tx.transaction_id || idx}
                      style={{ height: ROW_H /* no tr background */, position: 'relative' }}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td
                        style={{
                          ...tdVertLightBase,
                          width: TYPE_W,
                          borderLeft: 'none',
                          background: hovered ? ROW_HOVER_BG : (dimOthers ? EDIT_DIM_BG : '#fff'),
                        }}
                      >
                        {tx.transaction_type || ''}
                      </td>
                      <td
                        style={{
                          ...tdVertLightBase,
                          width: AMOUNT_W,
                          background: hovered ? ROW_HOVER_BG : (dimOthers ? EDIT_DIM_BG : '#fff'),
                        }}
                      >
                        {formatCurrency(tx.transaction_amount)}
                      </td>
                      <td
                        style={{
                          ...tdVertLightBase,
                          width: DATE_W,
                          background: hovered ? ROW_HOVER_BG : (dimOthers ? EDIT_DIM_BG : '#fff'),
                        }}
                      >
                        {(tx.transaction_date || '').slice(0, 10)}
                      </td>
                      <td
                        style={{
                          ...tdVertLightBase,
                          width: NOTES_W,
                          borderRight: 'none',
                          textAlign: 'left',
                          overflow: 'visible',
                          background: hovered ? ROW_HOVER_BG : (dimOthers ? EDIT_DIM_BG : '#fff'),
                        }}
                      >
                        {tx.notes || ''}
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${TABLE_W}px + 8px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'inline-flex',
                            gap: 10,
                            alignItems: 'center',
                            opacity: rowActionsVisible(idx, false, isConfirming) ? 1 : 0,
                            transition: 'opacity 160ms ease-in-out',
                            pointerEvents: 'auto',
                            zIndex: 1500,
                          }}
                        >
                          <IconButton icon="edit" label="Edit" onClick={() => startEdit(idx)} />
                          {isConfirming ? (
                            <button type="button" aria-label="Confirm delete" style={confirmBtnStyle} onClick={() => void doDelete(idx)}>
                              CONFIRM?
                            </button>
                          ) : (
                            <IconButton icon="delete" label="Delete" onClick={() => setConfirmIdx(idx)} />
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
      </div>

      {/* Bottom divider */}
      <div style={{ width: TABLE_W, height: 0, borderBottom: DIVIDER, margin: '0 auto' }} />
    </Box>
  );
}
