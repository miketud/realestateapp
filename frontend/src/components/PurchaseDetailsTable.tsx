import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Table, Title, Loader, Center } from '@mantine/core';
import LoanDetailsTable from './LoanDetailsTable';

// ---------- Layout constants ----------
const MAIN_COL_WIDTH = 175; // 1 unit
const BASE_FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = MAIN_COL_WIDTH * MAX_COLS;
const HEADER_BG = '#000';
const HEADER_FG = '#fff';

// --- Visual primitives to match Rent/Transaction ---
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

const cellStyle: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: '#fff',
  fontSize: BASE_FONT_SIZE,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

// Borderless inline input
const inputCellStyle: React.CSSProperties = {
  width: '100%',
  fontSize: BASE_FONT_SIZE,
  fontFamily: 'inherit',
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
};

type PurchaseDetails = {
  purchase_id: number;
  property_id: number;
  closing_date: string | null;
  purchase_price: number | null;
  financing_type: string;
  acquisition_type: string;
  buyer: string;
  seller: string;
  closing_costs: number | null;
  earnest_money: number | null;
  down_payment?: number | null;
  notes?: string;
};

type Column = { key: keyof PurchaseDetails; label: string; type?: 'number' | 'date' | 'text' };

const COLUMNS: Column[] = [
  { key: 'closing_date', label: 'Closing Date', type: 'date' },
  { key: 'purchase_price', label: 'Purchase Price', type: 'number' },
  { key: 'financing_type', label: 'Financing Type', type: 'text' },
  { key: 'acquisition_type', label: 'Acquisition Type', type: 'text' },
  { key: 'buyer', label: 'Buyer', type: 'text' },
  { key: 'seller', label: 'Seller', type: 'text' },
  { key: 'down_payment', label: 'Down Payment', type: 'number' },
  { key: 'earnest_money', label: 'Earnest Money', type: 'number' },
  { key: 'closing_costs', label: 'Closing Costs', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
];

// main table excludes notes; we render notes on its own row
const MAIN_COLUMNS: Column[] = COLUMNS.filter(c => c.key !== 'notes');

// lock the grid to 9 × 175px
function ColsPx() {
  return (
    <colgroup>
      {Array.from({ length: MAX_COLS }).map((_, i) => (
        <col key={i} style={{ width: MAIN_COL_WIDTH }} />
      ))}
    </colgroup>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Minimal local-state autocomplete for Buyer/Seller (fast, no lag)
   - Filters preloaded names while typing
   - Local text state while editing (prevents parent re-render lag)
   - Commit on Enter or clicking a suggestion; free-form allowed
   - No blur commit (mirrors your Dashboard behavior)
────────────────────────────────────────────────────────────────────────────── */
function NameAutocompleteSimple({
  initialValue,
  suggestions,
  placeholder = 'Type a name…',
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

export default function PurchaseDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<PurchaseDetails | null>(null);
  const [editKey, setEditKey] = useState<keyof PurchaseDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [propertyCreatedAt, setPropertyCreatedAt] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // 🔹 Preload contact names once for Buyer/Seller autocomplete
  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((arr: any[]) => {
        const names = Array.isArray(arr) ? arr.map(c => String(c?.name || '')).filter(Boolean) : [];
        setContactNames(Array.from(new Set(names)));
      })
      .catch(() => void 0);
  }, []);

  // Load property.created_at for seeding closing_date
  useEffect(() => {
    if (!property_id) return;
    fetch(`/api/properties/${property_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.created_at) setPropertyCreatedAt(j.created_at);
        setSaveError(null);
      })
      .catch(() => { });
  }, [property_id]);

  // Load purchase details
  useEffect(() => {
    setLoading(true);
    fetch(`/api/purchase_details?property_id=${property_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.error) {
          setData(j);
          setSaveError(null);
        } else {
          setData(null);
        }
      })
      .catch(() => {
        setData(null);
        setSaveError('Failed to load purchase details.');
      })
      .finally(() => setLoading(false));
  }, [property_id]);

  // Auto-create if missing (seed closing_date)
  useEffect(() => {
    if (loading || data || !propertyCreatedAt) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    const closingDate = propertyCreatedAt.slice(0, 10);
    fetch('/api/purchase_details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id,
        closing_date: closingDate,
        purchase_price: null,
        buyer: '',
        seller: '',
        financing_type: '',
        acquisition_type: '',
        closing_costs: null,
        earnest_money: null,
        down_payment: null,
        notes: '',
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j) => {
        if (!j?.error) {
          setData(j);
          setSaveError(null);
        }
      })
      .catch((e) => {
        setSaveError(`Failed to auto-create purchase details: ${e?.message || 'server error'}`);
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [loading, data, property_id, propertyCreatedAt]);

  // Editing
  function startEdit(key: keyof PurchaseDetails) {
    if (!data || saving) return;
    setSaveError(null);
    setEditKey(key);
    let v: any = data[key];
    const col = COLUMNS.find((c) => c.key === key);
    if (col?.type === 'date') v = v ? String(v).slice(0, 10) : '';
    setEditValue(v ?? '');
  }

  async function saveEdit(key: keyof PurchaseDetails, customValue?: any) {
    if (!data) return;
    setSaving(true);

    const col = COLUMNS.find((c) => c.key === key);
    let value = customValue !== undefined ? customValue : editValue;

    if (col?.type === 'number') value = value === '' ? null : Number(value);
    if (col?.type === 'date') value = value === '' ? null : String(value).slice(0, 10);

    try {
      const res = await fetch(`/api/purchase_details/${data.purchase_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update');
      }
      const updated = await res.json();
      if (!updated?.error) {
        setData(updated);
        setSaveError(null);
      } else {
        setSaveError('Update failed.');
      }
    } catch (e: any) {
      console.error(e);
      setSaveError(`Failed to save field: ${e?.message || 'server error'}`);
    }

    setSaving(false);
    setEditKey(null);
  }

  if (loading) {
    return (
      <Center style={{ minHeight: 70 }}>
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <div style={{ margin: '56px 0 38px 0' }}>
      {/* PURCHASE DETAILS LABEL BOX */}
      <div
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 0',
          padding: '12px 16px',
          background: '#b6b6b6ff',           // soft yellow
          border: '4px solid #000',        // thick border
          borderBottom: 'none',            // attach to table
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: 1,
        }}
      >
        PURCHASE DETAILS
      </div>

      {/* Error banner (like RentRollTable) */}
      {saveError && (
        <div
          style={{
            width: TABLE_WIDTH,
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

      <div style={{ width: TABLE_WIDTH }}>
        <Table
          striped
          highlightOnHover
          withColumnBorders
          style={{
            fontSize: BASE_FONT_SIZE,
            borderCollapse: 'collapse',
            border: '4px solid #000',       // thick black border, aligned with label
            boxShadow: '0 12px 28px rgba(0,0,0,0.3)', // stronger drop shadow
            background: '#fff',
            width: TABLE_WIDTH,
            textAlign: 'center',
            tableLayout: 'fixed',
          }}
        >
          <ColsPx />

          <thead>
            <tr>
              {MAIN_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    background: '#000',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '13px',
                    border: '1px solid #222',
                    textAlign: 'center',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    width: MAIN_COL_WIDTH,
                    minWidth: MAIN_COL_WIDTH,
                    maxWidth: MAIN_COL_WIDTH,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Main row (everything except Notes) */}
            <tr>
              {MAIN_COLUMNS.map((col) => {
                const v = data?.[col.key];
                const isEditing = editKey === col.key;

                const baseTdStyle: React.CSSProperties = {
                  ...cellStyle,
                  width: MAIN_COL_WIDTH,
                  minWidth: MAIN_COL_WIDTH,
                  maxWidth: MAIN_COL_WIDTH,
                  cursor: 'pointer',
                  ...(isEditing ? { boxShadow: FOCUS_RING, background: '#eef5ff' } : {}),
                };

                if (!isEditing) {
                  return (
                    <td
                      key={col.key}
                      style={baseTdStyle}
                      onClick={() => startEdit(col.key)}
                    >
                      {(v === null || v === undefined || String(v).trim() === '') ? (
                        <span style={{ color: '#bbb' }}>—</span>
                      ) : col.type === 'date' ? (
                        String(v).slice(0, 10)
                      ) : col.type === 'number' ? (
                        `$${Number(v).toLocaleString()}`
                      ) : (
                        String(v)
                      )}
                    </td>
                  );
                }

                // Financing Type: dropdown
                if (col.key === 'financing_type') {
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <select
                        value={editValue ?? ''}
                        style={{ ...inputCellStyle, textAlign: 'center' }}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(col.key);
                          if (e.key === 'Escape') setEditKey(null);
                        }}
                      >
                        <option value="">—</option>
                        <option value="Cash">Cash</option>
                        <option value="Loan">Loan</option>
                        <option value="Seller Financing">Seller Financing</option>
                        <option value="Private Money">Private Money</option>
                        <option value="Hard Money">Hard Money</option>
                      </select>
                    </td>
                  );
                }

                // Acquisition Type: dropdown
                if (col.key === 'acquisition_type') {
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <select
                        value={editValue ?? ''}
                        style={{ ...inputCellStyle, textAlign: 'center' }}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(col.key);
                          if (e.key === 'Escape') setEditKey(null);
                        }}
                      >
                        <option value="">—</option>
                        <option value="1031 Exchange">1031 Exchange</option>
                        <option value="Standard Purchase">Standard Purchase</option>
                        <option value="Foreclosure / REO">Foreclosure / REO</option>
                        <option value="Auction">Auction</option>
                        <option value="Inheritance / Gift">Inheritance / Gift</option>
                      </select>
                    </td>
                  );
                }

                // Buyer & Seller: minimal autocomplete (local; commit on Enter/click)
                if (col.key === 'buyer' || col.key === 'seller') {
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <NameAutocompleteSimple
                        initialValue={editValue ?? ''}
                        suggestions={contactNames}
                        placeholder={col.key === 'buyer' ? 'Buyer' : 'Seller'}
                        onCommit={(finalText) => saveEdit(col.key, finalText)}
                      />
                    </td>
                  );
                }

                // Editing UI for main fields (borderless inputs)
                return (
                  <td key={col.key} style={baseTdStyle}>
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={editValue ?? ''}
                      style={inputCellStyle}
                      autoFocus
                      disabled={saving}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(col.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(col.key);
                        if (e.key === 'Escape') setEditKey(null);
                      }}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Notes row (label + one wide cell) */}
            <tr>
              <td
                style={{
                  ...cellStyle,
                  background: '#ece8d4',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  width: MAIN_COL_WIDTH,
                  minWidth: MAIN_COL_WIDTH,
                  maxWidth: MAIN_COL_WIDTH,
                }}
              >
                Notes
              </td>

              <td
                colSpan={MAX_COLS - 1}
                style={{
                  ...cellStyle,
                  textAlign: 'left',
                  cursor: 'pointer',
                  ...(editKey === 'notes' ? { boxShadow: FOCUS_RING, background: '#eef5ff' } : {}),
                }}
                onClick={() => startEdit('notes')}
              >
                {editKey === 'notes' ? (
                  <input
                    type="text"
                    value={editValue ?? ''}
                    style={{ ...inputCellStyle, maxWidth: '100%', textAlign: 'left' }}
                    autoFocus
                    disabled={saving}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit('notes')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit('notes');
                      if (e.key === 'Escape') setEditKey(null);
                    }}
                  />
                ) : (
                  (data?.notes && String(data.notes).trim() !== '') ? (
                    <span>{String(data.notes)}</span>
                  ) : (
                    <span style={{ color: '#bbb' }}>—</span>
                  )
                )}
              </td>
            </tr>
          </tbody>
        </Table>
      </div>

      {(() => {
        const ft = (data?.financing_type ?? '').toLowerCase();
        const showLoanDetails = ft.includes('loan') || ft.includes('seller financing');
        return showLoanDetails ? (
          <div style={{ marginTop: 26, width: '100%' }}>
            <LoanDetailsTable property_id={property_id} />
          </div>
        ) : null;
      })()}
    </div>
  );
}
