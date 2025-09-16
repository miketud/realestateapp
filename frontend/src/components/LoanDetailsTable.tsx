import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table } from '@mantine/core';
import BannerMessage from './BannerMessage';

const COL_WIDTH = 175;
const FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = COL_WIDTH * MAX_COLS;

// highlight styles (match Transaction/Rent tables)
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';
const PLACEHOLDER = '#9aa1a8';

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
      {/* Button styled like your input cell */}
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
            width: '100%',
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
    if (col?.type === 'boolean') {
      // Accept true/false or "Yes"/"No"
      if (typeof value === 'string') {
        value = value === 'Yes' || value === 'true';
      } else {
        value = !!value;
      }
    }
    if (col?.type === 'date') value = value === '' ? null : String(value).slice(0, 10);

    try {
      if (key === 'loan_id' && !isLoanIdReady) {
        // Create new loan record on first-time loan_id set
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
        // Update loan_id when record already exists
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
        // Patch any other field once a loan record exists
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
      {/* Error banner ABOVE the whole component (does not change title/table spacing) */}
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

      {/* LOAN DETAILS LABEL BOX */}
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
        LOAN DETAILS
      </div>

      <Table
        striped
        highlightOnHover
        withColumnBorders
        style={{
          fontSize: FONT_SIZE,
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

                  // Loan Number (creates or updates record)
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(col.key);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                          />
                        ) : (
                          <span style={{ color: !saving ? '#000' : '#bbb', cursor: 'default' }}>
                            {v && String(v).trim() !== '' ? String(v) : <span style={{ color: '#bbb' }}>—</span>}
                          </span>
                        )}
                      </td>
                    );
                  }

                  // Gate all other fields until a loan record exists
                  if (!isLoanIdReady) {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={disabledCellStyle}>
                        {col.type === 'boolean' ? '—' : <span style={{ color: '#444' }}>—</span>}
                      </td>
                    );
                  }

                  // Read view
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

                  // Edit views using UniversalDropdown where requested

                  // Loan Status dropdown
                  if (col.key === 'loan_status') {
                    const STATUS_OPTS: DropdownOption[] = [
                      { value: '', label: '—' },
                      { value: 'Active' },
                      { value: 'Paid' },
                      { value: 'Pending' },
                    ];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Loan Status"
                          options={STATUS_OPTS}
                          onChange={(val) => handleSave(col.key, val)}
                          ariaLabel="Loan Status"
                          disabled={saving}
                        />
                      </td>
                    );
                  }

                  // Loan Type dropdown
                  if (col.key === 'loan_type') {
                    const TYPE_OPTS: DropdownOption[] = [
                      { value: '', label: '—' },
                      { value: 'Conventional' },
                      { value: 'Hard Money' },
                      { value: 'Adjustable Rate Mortgage' },
                      { value: 'Fixed Rate Mortgage' },
                    ];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Loan Type"
                          options={TYPE_OPTS}
                          onChange={(val) => handleSave(col.key, val)}
                          ariaLabel="Loan Type"
                          disabled={saving}
                        />
                      </td>
                    );
                  }

                  // Lender autocomplete
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

                  // Boolean fields via UniversalDropdown (Yes/No)
                  if (col.type === 'boolean') {
                    const BOOL_OPTS: DropdownOption[] = [
                      { value: 'Yes' },
                      { value: 'No' },
                    ];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue === true || editValue === 'Yes' ? 'Yes' : 'No'}
                          placeholder={col.label}
                          options={BOOL_OPTS}
                          onChange={(val) => handleSave(col.key, val === 'Yes')}
                          ariaLabel={col.label}
                          disabled={saving}
                        />
                      </td>
                    );
                  }

                  // Date fields
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(col.key);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                        />
                      </td>
                    );
                  }

                  // Number/Text generic
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(col.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave('notes');
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                  disabled={saving}
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
  );
}
