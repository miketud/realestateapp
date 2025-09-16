import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Table, Loader, Center } from '@mantine/core';
import LoanDetailsTable from './LoanDetailsTable';
import BannerMessage from './BannerMessage';

/* ────────────────── Layout / visuals ────────────────── */
const MAIN_COL_WIDTH = 175;
const BASE_FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = MAIN_COL_WIDTH * MAX_COLS;
const FOCUS_RING = 'inset 0 0 0 3px #325dae';
const PLACEHOLDER = '#9aa1a8';

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

const MAIN_COLUMNS: Column[] = COLUMNS.filter((c) => c.key !== 'notes');

function ColsPx() {
  return (
    <colgroup>
      {Array.from({ length: MAX_COLS }).map((_, i) => (
        <col key={i} style={{ width: MAIN_COL_WIDTH }} />
      ))}
    </colgroup>
  );
}

/* ────────────────── Universal Dropdown (fills cell, header placeholder, hover highlight) ────────────────── */
type DropdownOption = { value: string; label?: string; disabled?: boolean };

function UniversalDropdown({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  maxMenuHeight = 220,
  ariaLabel,
}: {
  value: string | null | undefined;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxMenuHeight?: number;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(-1);

  const currentLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found?.label ?? found?.value ?? '';
  }, [value, options]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const nextEnabled = (start: number, dir: 1 | -1) => {
    if (!options.length) return -1;
    let i = start;
    for (let step = 0; step < options.length; step++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    const idx = options.findIndex(o => o.value === value && !o.disabled);
    setActive(idx >= 0 ? idx : nextEnabled(-1, 1));
  };

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => nextEnabled(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => nextEnabled(i, -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(nextEnabled(-1, 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(nextEnabled(0, -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (active >= 0) commit(active);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }} onKeyDown={onKeyDown}>
      {/* Button styled like an input cell */}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          outline: 'none',
          color: value ? '#111' : PLACEHOLDER,
        }}
      >
        {value ? (currentLabel || value) : placeholder}
      </button>

      {/* Menu */}
      {open && (
        <div
          role="listbox"
          aria-label={placeholder}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',                // matches cell width
            maxHeight: maxMenuHeight,
            overflowY: 'auto',
            background: '#fff',
            border: '2px solid #111',
            zIndex: 80,
            boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header (placeholder) */}
          <div
            style={{
              padding: '10px 12px',
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              background: '#f8f8f8',
              color: '#333',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>

          {/* Thin divider */}
          <div style={{ height: 1, background: '#e5e5e5' }} />

          {/* Options */}
          {options.map((opt, idx) => {
            const isActive = idx === active;
            const isSelected = value === opt.value;
            const isDisabled = !!opt.disabled;
            return (
              <div
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()} // keep focus
                onClick={() => !isDisabled && commit(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isActive ? '#eef5ff' : '#fff',
                  color: isDisabled ? '#999' : '#111',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  borderTop: '1px solid #f2f2f2',
                }}
              >
                <span>{opt.label ?? opt.value}</span>
                {isSelected ? <span aria-hidden>✓</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────── Inline, fast autocomplete for Buyer/Seller ────────────────── */
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
      .filter((n) => n.toLowerCase().includes(q))
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
            setActive((i) => Math.min(i + 1, list.length - 1));
          } else if (e.key === 'ArrowUp' && list.length) {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
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
              onMouseDown={(e) => e.preventDefault()}
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

/* ───────────────────────────── Component ───────────────────────────── */
export default function PurchaseDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<PurchaseDetails | null>(null);
  const [editKey, setEditKey] = useState<keyof PurchaseDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [propertyCreatedAt, setPropertyCreatedAt] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // preload contact names once for Buyer/Seller autocomplete
  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((arr: any[]) => {
        const names = Array.isArray(arr) ? arr.map((c) => String(c?.name || '')).filter(Boolean) : [];
        setContactNames(Array.from(new Set(names)));
      })
      .catch(() => void 0);
  }, []);

  // property.created_at (seed closing_date if missing)
  useEffect(() => {
    if (!property_id) return;
    fetch(`/api/properties/${property_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.created_at) setPropertyCreatedAt(j.created_at);
        setSaveError(null);
      })
      .catch(() => {});
  }, [property_id]);

  // load purchase details
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

  // auto-create record if missing (seed closing_date)
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

  /* ───────────── Editing ───────────── */
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
      {/* Error banner ABOVE the whole component */}
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

      {/* PURCHASE DETAILS LABEL BOX */}
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
        PURCHASE DETAILS
      </div>

      {/* Table stays flush with the title */}
      <div style={{ width: TABLE_WIDTH, margin: '0 auto' }}>
        <Table
          striped
          highlightOnHover
          withColumnBorders
          style={{
            fontSize: BASE_FONT_SIZE,
            borderCollapse: 'collapse',
            border: '4px solid #000',
            boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
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
                      {v === null || v === undefined || String(v).trim() === ''
                        ? <span style={{ color: '#bbb' }}>—</span>
                        : col.type === 'date'
                        ? String(v).slice(0, 10)
                        : col.type === 'number'
                        ? `$${Number(v).toLocaleString()}`
                        : String(v)}
                    </td>
                  );
                }

                // Financing Type: UniversalDropdown
                if (col.key === 'financing_type') {
                  const FINANCING_OPTS: DropdownOption[] = [
                    { value: '', label: '—' },
                    { value: 'Cash' },
                    { value: 'Loan' },
                    { value: 'Seller Financing' },
                    { value: 'Private Money' },
                    { value: 'Hard Money' },
                  ];
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <UniversalDropdown
                        value={editValue ?? ''}
                        placeholder="Financing Type"
                        options={FINANCING_OPTS}
                        onChange={(val) => saveEdit(col.key, val)}
                        ariaLabel="Financing Type"
                        disabled={saving}
                      />
                    </td>
                  );
                }

                // Acquisition Type: UniversalDropdown
                if (col.key === 'acquisition_type') {
                  const ACQ_OPTS: DropdownOption[] = [
                    { value: '', label: '—' },
                    { value: '1031 Exchange' },
                    { value: 'Standard Purchase' },
                    { value: 'Foreclosure / REO' },
                    { value: 'Auction' },
                    { value: 'Inheritance / Gift' },
                  ];
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <UniversalDropdown
                        value={editValue ?? ''}
                        placeholder="Acquisition Type"
                        options={ACQ_OPTS}
                        onChange={(val) => saveEdit(col.key, val)}
                        ariaLabel="Acquisition Type"
                        disabled={saving}
                      />
                    </td>
                  );
                }

                // Buyer & Seller: local autocomplete
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

                // Generic editor
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
                ) : data?.notes && String(data.notes).trim() !== '' ? (
                  <span>{String(data.notes)}</span>
                ) : (
                  <span style={{ color: '#bbb' }}>—</span>
                )}
              </td>
            </tr>
          </tbody>
        </Table>
      </div>

      {/* Conditional loan details */}
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
