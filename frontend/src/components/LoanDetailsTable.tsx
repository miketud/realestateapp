import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table, Title } from '@mantine/core';

const COL_WIDTH = 175;
const FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = COL_WIDTH * MAX_COLS;

// highlight styles (match Transaction/Rent tables)
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

// Base cell (1 unit)
const cellStyle: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: '#fff',
  fontSize: FONT_SIZE,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

// Header cell used inside <tbody> (to match PropertyView look)
const headerCellStyle = (hasLabel: boolean): React.CSSProperties => ({
  ...cellStyle,
  background: '#000',
  color: hasLabel ? '#fff' : '#000', // labeled headers = white text; filler stays black-on-black
  fontWeight: 700,
  textTransform: 'uppercase',
});

// Blacked-out filler (1 unit)
const blackCell: React.CSSProperties = {
  ...cellStyle,
  background: '#000',
  color: '#000',
  cursor: 'default',
};

// Disabled (until Loan Number exists)
const disabledCellStyle: React.CSSProperties = {
  ...cellStyle,
  background: '#383838ff',
  color: '#5e5e5e',
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

// Borderless inline input (match Transaction/Rent)
const inputCellStyle: React.CSSProperties = {
  width: '100%',
  fontSize: FONT_SIZE,
  fontFamily: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
};

export type LoanDetails = {
  loan_id: string;
  property_id: number;
  purchase_id: number;
  loan_amount: number | null;
  lender: string;
  interest_rate: number | null;
  loan_term: number | null;
  loan_start: string;
  loan_end: string;
  loan_type: string;
  balloon_payment: boolean;
  prepayment_penalty: boolean;
  refinanced: boolean;
  loan_status: string;
  amortization_period?: number | null;
  monthly_payment?: number | null;
  notes?: string;
};

// ---- Column typing to avoid ".keys()" confusion ----
type Column = { key: keyof LoanDetails; label: string; type?: 'number' | 'date' | 'text' | 'boolean' };

const COLUMNS: Column[] = [
  { key: 'loan_id', label: 'Loan Number', type: 'text' },
  { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
  { key: 'lender', label: 'Lender', type: 'text' },
  { key: 'interest_rate', label: 'Interest Rate (%)', type: 'number' },
  { key: 'loan_term', label: 'Loan Term (months)', type: 'number' },
  { key: 'loan_start', label: 'Start Date', type: 'date' },
  { key: 'loan_end', label: 'End Date', type: 'date' },
  { key: 'amortization_period', label: 'Amortization Period (Years)', type: 'number' },
  { key: 'monthly_payment', label: 'Monthly Payment', type: 'number' },

  { key: 'loan_status', label: 'Loan Status', type: 'text' },
  { key: 'loan_type', label: 'Loan Type', type: 'text' },
  { key: 'balloon_payment', label: 'Balloon Payment', type: 'boolean' },
  { key: 'prepayment_penalty', label: 'Prepayment Penalty', type: 'boolean' },
  { key: 'refinanced', label: 'Refinanced', type: 'boolean' },

  { key: 'notes', label: 'Notes', type: 'text' }, // rendered last, separate row
];

const FIELDS_WO_NOTES: Column[] = COLUMNS.filter(c => c.key !== 'notes');

/* ──────────────────────────────────────────────────────────
   Minimal local-state autocomplete for Lender (fast, no lag)
   - Filters preloaded names while typing
   - Local text state while editing (prevents parent re-render lag)
   - Commit on Enter or clicking a suggestion; free-form allowed
   - No blur commit (mirrors Dashboard behavior)
────────────────────────────────────────────────────────── */
function LenderAutocomplete({
  initialValue,
  suggestions,
  placeholder = 'Lender',
  onCommit,
}: {
  initialValue: string;
  suggestions: string[];
  placeholder?: string;
  onCommit: (finalText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [text, setText] = useState(initialValue || '');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return Array.from(new Set(suggestions))
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 8);
  }, [text, suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commit = (val: string) => {
    onCommit(val);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100%' }}>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (list.length) commit(list[active]);
            else commit(text);
          } else if (e.key === 'ArrowDown' && list.length) {
            e.preventDefault();
            setActive(i => Math.min(i + 1, list.length - 1));
          } else if (e.key === 'ArrowUp' && list.length) {
            e.preventDefault();
            setActive(i => Math.max(i - 1, 0));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        style={inputCellStyle}
      />
      {open && list.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 220,
            overflowY: 'auto',
            border: '2px solid #111',
            background: '#fff',
            zIndex: 70,
            boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
          }}
        >
          {list.map((name, idx) => (
            <div
              key={name + idx}
              onMouseDown={(e) => e.preventDefault()} // keep input from blurring
              onClick={() => commit(name)}
              style={{
                padding: '10px 12px',
                background: idx === active ? '#eef5ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LoanDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<LoanDetails | null>(null);
  const [editingKey, setEditingKey] = useState<keyof LoanDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 🔹 Preload contact names once for lender autocomplete
  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((arr: any[]) => {
        const names = Array.isArray(arr)
          ? arr.map(c => String(c?.name || '')).filter(Boolean)
          : [];
        setContactNames(Array.from(new Set(names)));
      })
      .catch(() => void 0);
  }, []);

  async function getPurchaseIdByPropertyId(pid: number): Promise<number | null> {
    const res = await fetch(`/api/purchase_details?property_id=${pid}`);
    const json = await res.json();
    return json && json.purchase_id ? json.purchase_id : null;
  }

  function startEdit(key: keyof LoanDetails) {
    if (!data || saving) return;
    setSaveError(null);
    setEditingKey(key);
    let current: any = (data as any)[key] ?? '';
    const col = COLUMNS.find(c => c.key === key);
    if (col?.type === 'date') current = current ? String(current).slice(0, 10) : '';
    setEditValue(current);
  }

  useEffect(() => {
    fetch(`/api/loan_details?property_id=${property_id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setData(json);
          setSaveError(null);
        } else {
          getPurchaseIdByPropertyId(property_id).then((purchase_id) => {
            setData({
              loan_id: '',
              property_id,
              purchase_id: purchase_id ?? 0,
              loan_amount: null,
              lender: '',
              interest_rate: null,
              loan_term: null,
              monthly_payment: null,
              loan_start: '',
              loan_end: '',
              loan_type: '',
              balloon_payment: false,
              prepayment_penalty: false,
              refinanced: false,
              loan_status: '',
              amortization_period: null,
              notes: '',
            });
            setSaveError(null);
          });
        }
      })
      .catch(() => {
        setData(null);
        setSaveError('Failed to load loan details.');
      });
  }, [property_id]);

  const isLoanIdReady = Boolean(data?.loan_id && data.loan_id.trim() !== '');

  const handleSave = async (key: keyof LoanDetails, customValue?: any) => {
    if (!data) return;
    setSaving(true);

    let value = customValue !== undefined ? customValue : editValue;
    const col = COLUMNS.find((c) => c.key === key);

    if (col?.type === 'number') value = value === '' ? null : Number(value);
    if (col?.type === 'boolean') value =
      value === '' || value === undefined ? null : (value === true || value === 'true' || value === 'Yes');
    if (col?.type === 'date') value = value === '' ? null : String(value).slice(0, 10);

    try {
      if (key === 'loan_id' && !isLoanIdReady) {
        let pid = data.purchase_id;
        if (!pid || pid === 0) {
          pid = await getPurchaseIdByPropertyId(data.property_id) as any;
          if (!pid) {
            setSaveError('Please create Purchase Details first so a purchase_id exists before creating the loan.');
            setSaving(false); setEditingKey(null); return;
          }
          setData(prev => prev ? { ...prev, purchase_id: pid! } : prev);
        }

        const res = await fetch('/api/loan_details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, purchase_id: pid, loan_id: value }),
        });
        const created = await res.json();
        if (res.ok && !created.error) {
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? created : freshJson);
          setSaveError(null);
        } else {
          setSaveError(`Failed to create loan: ${created?.error || res.statusText}`);
        }
      } else if (key === 'loan_id' && isLoanIdReady) {
        if (!value || String(value).trim() === '') {
          setSaveError('Loan Number cannot be empty. Use admin tools to delete if needed.');
          setSaving(false); setEditingKey(null); return;
        }
        const res = await fetch(`/api/loan_details/by_property_purchase`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: data.property_id, purchase_id: data.purchase_id, loan_id: value }),
        });
        const updated = await res.json();
        if (res.ok && !updated.error) {
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? updated : freshJson);
          setSaveError(null);
        } else {
          setSaveError(`Failed to update loan number: ${updated?.error || res.statusText}`);
        }
      } else if (isLoanIdReady && key !== 'loan_id') {
        const res = await fetch(`/api/loan_details/${String(data.loan_id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });
        const updated = await res.json();
        if (res.ok && !updated.error) {
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? updated : freshJson);
          setSaveError(null);
        } else {
          setSaveError(res.status === 404 ? 'Loan record not found. Please reload.' : `Error updating loan: ${updated?.error || res.statusText}`);
        }
      } else {
        setSaveError('No loan record exists to edit. Please enter a Loan Number first.');
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(`Unexpected error: ${err?.message || 'server error'}`);
    }

    setSaving(false);
    setEditingKey(null);
  };

  const sections: Column[][] = [];
  for (let i = 0; i < FIELDS_WO_NOTES.length; i += MAX_COLS) {
    sections.push(FIELDS_WO_NOTES.slice(i, i + MAX_COLS));
  }

  const padToMax = (arr: Column[]): (Column | null)[] => {
    const out: (Column | null)[] = [...arr];
    while (out.length < MAX_COLS) out.push(null);
    return out;
  };

  function ColsPx() {
    return (
      <colgroup>
        {Array.from({ length: MAX_COLS }).map((_, i) => (
          <col key={i} style={{ width: COL_WIDTH }} />
        ))}
      </colgroup>
    );
  }

  const focusShadow = (active: boolean): React.CSSProperties =>
    active ? { boxShadow: FOCUS_RING, background: HILITE_BG } : {};

  return (
    <div style={{ marginTop: 16, width: TABLE_WIDTH }}>
      {/* LOAN DETAILS LABEL BOX */}
      <div
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 0',
          padding: '12px 16px',
          background: '#b6b6b6ff',           // soft yellow
          border: '4px solid #000',        // thick black border
          borderBottom: 'none',            // attach to table
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: 1,
        }}
      >
        LOAN DETAILS
      </div>

      {/* Error banner */}
      {saveError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 18px',
            background: '#ffeded',
            color: '#a13d3d',
            border: '1.5px solid #e57e7e',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 0.5,
          }}
        >
          {saveError}
        </div>
      )}

      <Table
        striped
        highlightOnHover
        withColumnBorders
        style={{
          fontSize: FONT_SIZE,
          borderCollapse: 'collapse',
          border: '4px solid #000',          // match label border
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)', // stronger drop shadow
          background: '#fff',
          width: TABLE_WIDTH,
          textAlign: 'center',
          tableLayout: 'fixed',
        }}
      >
        <ColsPx />

        <tbody>
          {sections.map((cols, sIdx) => {
            const padded = padToMax(cols);

            const HeaderRow = (
              <tr key={`h-${sIdx}`}>
                {padded.map((col, ci) => (
                  <th key={`h-${sIdx}-${ci}`} style={headerCellStyle(Boolean(col?.label))}>
                    {col?.label ?? ''}
                  </th>
                ))}
              </tr>
            );

            const ValueRow = (
              <tr key={`v-${sIdx}`}>
                {padded.map((col, ci) => {
                  if (!col) return <td key={`v-${sIdx}-${ci}`} style={blackCell}>&nbsp;</td>;
                  const v = (data as any)?.[col.key];
                  const isEditing = editingKey === col.key;

                  if (col.key === 'loan_id') {
                    return (
                      <td
                        key={`v-${sIdx}-${ci}`}
                        style={{ ...cellStyle, cursor: 'pointer', ...focusShadow(isEditing) }}
                        onClick={() => !saving && startEdit(col.key)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue ?? ''}
                            style={inputCellStyle}
                            autoFocus
                            disabled={saving}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSave(col.key)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(col.key); if (e.key === 'Escape') setEditingKey(null); }}
                          />
                        ) : (
                          <span style={{ color: !saving ? '#000' : '#bbb', cursor: 'default' }}>
                            {v && String(v).trim() !== '' ? String(v) : <span style={{ color: '#bbb' }}>—</span>}
                          </span>
                        )}
                      </td>
                    );
                  }

                  if (!isLoanIdReady) {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={disabledCellStyle}>
                        {col.type === 'boolean' ? '—' : <span style={{ color: '#444' }}>—</span>}
                      </td>
                    );
                  }

                  if (!isEditing) {
                    return (
                      <td
                        key={`v-${sIdx}-${ci}`}
                        style={{ ...cellStyle, cursor: 'pointer', ...focusShadow(isEditing) }}
                        onClick={() => !saving && startEdit(col.key)}
                      >
                        {(v === null || v === undefined || String(v).trim() === '') && col.type !== 'boolean' ? (
                          <span style={{ color: '#bbb' }}>—</span>
                        ) : col.key === 'interest_rate' ? (
                          `${Number(v)}%`
                        ) : col.key === 'loan_term' ? (
                          Number(v)
                        ) : col.type === 'boolean' ? (
                          v ? 'Yes' : 'No'
                        ) : col.type === 'number' ? (
                          col.key === 'amortization_period' ? Number(v) : `$${Number(v).toLocaleString()}`
                        ) : col.type === 'date' ? (
                          String(v).slice(0, 10)
                        ) : (
                          String(v)
                        )}
                      </td>
                    );
                  }

                  // Loan Status: dropdown
                  if (col.key === 'loan_status') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <select
                          value={editValue ?? ''}
                          style={{
                            ...inputCellStyle,
                            textAlign: 'center',
                          }}
                          autoFocus
                          disabled={saving}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(col.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(col.key);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                        >
                          <option value="">—</option>
                          <option value="Active">Active</option>
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </td>
                    );
                  }

                  // Loan Type: dropdown
                  if (col.key === 'loan_type') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <select
                          value={editValue ?? ''}
                          style={{
                            ...inputCellStyle,
                            textAlign: 'center',
                          }}
                          autoFocus
                          disabled={saving}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(col.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(col.key);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                        >
                          <option value="">—</option>
                          <option value="Conventional">Conventional</option>
                          <option value="Hard Money">Hard Money</option>
                          <option value="Adjustable Rate Mortgage">Adjustable Rate Mortgage</option>
                          <option value="Fixed Rate Mortgage">Fixed Rate Mortgage</option>
                        </select>
                      </td>
                    );
                  }

                  // Lender: minimal autocomplete (local; commit on Enter/click only)
                  if (col.key === 'lender') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <LenderAutocomplete
                          initialValue={editValue ?? ''}
                          suggestions={contactNames}
                          placeholder="Lender"
                          onCommit={(finalText) => handleSave(col.key, finalText)}
                        />
                      </td>
                    );
                  }

                  if (col.type === 'boolean') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <select
                          value={editValue === true || editValue === 'Yes' ? 'Yes' : 'No'}
                          style={inputCellStyle}
                          onChange={(e) => setEditValue(e.target.value === 'Yes')}
                          onBlur={() => handleSave(col.key)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(col.key); if (e.key === 'Escape') setEditingKey(null); }}
                          disabled={saving}
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                    );
                  }

                  if (col.type === 'date') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <input
                          type="date"
                          value={editValue ?? ''}
                          style={inputCellStyle}
                          autoFocus
                          disabled={saving}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(col.key)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(col.key); if (e.key === 'Escape') setEditingKey(null); }}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={editValue ?? ''}
                        style={inputCellStyle}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSave(col.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(col.key); if (e.key === 'Escape') setEditingKey(null); }}
                      />
                    </td>
                  );
                })}
              </tr>
            );

            return (
              <React.Fragment key={`sec-${sIdx}`}>
                {HeaderRow}
                {ValueRow}
              </React.Fragment>
            );
          })}

          {/* Notes row */}
          <tr>
            <td
              style={{
                ...cellStyle,
                background: '#ece8d4',
                color: '#242211',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Notes
            </td>
            <td
              colSpan={MAX_COLS - 1}
              style={{
                border: '1px solid #222',
                padding: '13px',
                textAlign: 'left',
                fontSize: FONT_SIZE,
                cursor: 'pointer',
                ...(editingKey === 'notes' ? { boxShadow: FOCUS_RING, background: HILITE_BG } : {}),
              }}
              onClick={() => startEdit('notes')}
            >
              {editingKey === 'notes' ? (
                <input
                  type="text"
                  value={editValue ?? ''}
                  style={{ ...inputCellStyle, maxWidth: '100%', textAlign: 'left' }}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSave('notes')}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave('notes'); if (e.key === 'Escape') setEditingKey(null); }}
                  disabled={saving}
                />
              ) : (
                (data?.notes && String(data.notes).trim() !== '') ? <span>{String(data.notes)}</span> : <span style={{ color: '#bbb' }}>—</span>
              )}
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
}
