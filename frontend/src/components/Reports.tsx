// Reports.tsx — Consistent Universal dropdowns for Year and multi-Property selection
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Table, Button, Center, Loader } from '@mantine/core';
import { getProperties } from '../api/properties';
import { IconButton } from './ui/Icons';
import UniversalDropdown from './UniversalDropdown';

/* ================= Types ================= */
type Property = { property_id: number; property_name: string };
type RentRow = { month: number; amount: number | null };
type ExpenseRow = { type: string; amount: number | null; date: string };

/* ================= Constants ================= */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const RENT_API = '/api/rentlog';
const TX_API = '/api/transactions';

const CONTROL_H = 64;
const BTN_MIN_W = 180;
const YEAR_W = BTN_MIN_W;
const PICKER_W = 320;

const GRID_GAP = 24;
const CARD_W = 420;
const GRID_MAX_W = CARD_W * 3 + GRID_GAP * 2; // 3 cards per row
const COL_PCT = '33.3333%';
const PLACEHOLDER = '#9aa1a8';

const currentYear = () => new Date().getFullYear();
const YEARS: number[] = Array.from({ length: 31 }, (_, i) => currentYear() + 1 - i);

/* ================= Shared styles ================= */
const CONTROL_SHADOW = '0 8px 20px rgba(0,0,0,0.10)';
const CELL_SHADOW = CONTROL_SHADOW;
const TABLE_SHADOW = '0 8px 20px rgba(0,0,0,0.10)';
const CARD_SHADOW = '0 8px 18px rgba(0,0,0,0.12)';
const CARD_SHADOW_HOVER = '0 16px 32px rgba(0,0,0,0.18)';
const BANNER_SHADOW = 'inset 0 -1px 0 rgba(0,0,0,0.15)';

const controlBase: React.CSSProperties = {
  height: CONTROL_H,
  display: 'inline-flex',
  alignItems: 'center',
  border: '2px solid #111',
  borderRadius: 0,
  background: '#fff',
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1,
  boxSizing: 'border-box',
  boxShadow: CONTROL_SHADOW,
};

const btnBase: React.CSSProperties = {
  ...controlBase,
  padding: '0 16px',
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  minWidth: BTN_MIN_W,
  justifyContent: 'center',
};

const btnClear: React.CSSProperties = { ...btnBase, background: '#ffe9e9', borderColor: '#c33', color: '#c33' };
const btnExport: React.CSSProperties = { ...btnBase, background: '#efe6ff' };

const headerTh: React.CSSProperties = {
  border: '1.5px solid #111',
  padding: '0 12px',
  height: CONTROL_H,
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  letterSpacing: 0.3,
  textAlign: 'center',
  verticalAlign: 'middle',
  boxShadow: CELL_SHADOW,
};
const td: React.CSSProperties = {
  border: '1px solid #222',
  padding: '0 13px',
  height: CONTROL_H,
  fontFamily: 'inherit',
  fontSize: 18,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: '#fff',
  boxShadow: CELL_SHADOW,
};
const tableShadow: React.CSSProperties = {
  boxShadow: TABLE_SHADOW,
  background: '#fff',
};

/* ================= Universal Multi Dropdown (consistent look) ================= */
type MultiOption = { value: number; label: string; disabled?: boolean };

function UniversalMultiDropdown({
  values,
  options,
  placeholder,
  includeAll = true,
  allLabel = 'ALL Properties',
  onChange,
  ariaLabel,
  maxMenuHeight = 320,
}: {
  values: number[] | 'ALL';
  options: MultiOption[];
  placeholder: string;
  includeAll?: boolean;
  allLabel?: string;
  onChange: (next: number[] | 'ALL') => void;
  ariaLabel?: string;
  maxMenuHeight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<number>(-1); // -1 header, 0..N options (including "ALL" if present)

  // Build menu model: header + (optional) ALL + divider + options
  const menuItems = useMemo(() => {
    const opts = options.map((o) => ({ ...o }));
    return {
      header: { text: placeholder.toUpperCase() },
      allIdx: includeAll ? 0 : -1,
      items: includeAll ? opts : opts,
    };
  }, [options, placeholder, includeAll]);

  // Label logic consistent with the earlier propertyLabel()
  const buttonLabel = useMemo(() => {
    if (values === 'ALL') return allLabel;
    if (!values.length) return 'Select properties';
    if (values.length === 1) {
      const one = options.find((o) => o.value === values[0]);
      return one ? one.label : '1 selected';
    }
    return `${values.length} selected`;
  }, [values, options, allLabel]);

  // Outside click to close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      const t = e.target as Node | null;
      if (t && !wrapRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Open & set initial active
  const openMenu = () => {
    setOpen(true);
    // first enabled item (skip header)
    setActive(includeAll ? 0 : (options.length ? 0 : -1));
  };

  const isChecked = (v: number) => (values === 'ALL' ? true : (values as number[]).includes(v));

  // Toggle logic
  const toggleAll = () => {
    onChange(values === 'ALL' ? [] : 'ALL');
  };
  const toggleOne = (v: number) => {
    if (values === 'ALL') {
      onChange([v]);
      return;
    }
    const set = new Set<number>(values as number[]);
    set.has(v) ? set.delete(v) : set.add(v);
    onChange(Array.from(set));
  };

  const totalCount = includeAll ? options.length + 1 : options.length;
  const nextEnabledIdx = (start: number, dir: 1 | -1) => {
    if (totalCount <= 0) return -1;
    let i = start;
    for (let step = 0; step < totalCount + 1; step++) {
      i = (i + dir + totalCount) % totalCount;
      // All item exists at 0 if includeAll
      if (includeAll && i === 0) return 0;
      // Options index mapping: when includeAll, option i maps to options[i-1]
      const opt = includeAll ? options[i - 1] : options[i];
      if (opt && !opt.disabled) return i;
    }
    return -1;
  };

  const commitAtIndex = (idx: number) => {
    if (idx < 0) return;
    if (includeAll && idx === 0) {
      toggleAll();
      return;
    }
    const opt = includeAll ? options[idx - 1] : options[idx];
    if (!opt || opt.disabled) return;
    toggleOne(opt.value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      } else if (e.key === 'Escape') {
        (e.currentTarget as HTMLButtonElement).blur();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => nextEnabledIdx(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => nextEnabledIdx(i, -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(includeAll ? 0 : 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(includeAll ? options.length : options.length - 1);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) commitAtIndex(active);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }} onKeyDown={onKeyDown}>
      {/* Trigger button styled like UniversalDropdown's button (fills parent box) */}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          textAlign: 'left',
          padding: '0 14px',
          cursor: 'pointer',
          // Square + custom focus ring
          borderRadius: 0,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          outline: 'none',
          boxShadow: focused ? 'inset 0 0 0 2px #111' : 'none',
        }}
      >
        <span style={{ fontWeight: 800 }}>{buttonLabel}</span>
      </button>

      {open && (
        <div
          ref={listRef}
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
            zIndex: 2000,
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          }}
        >
          {/* Header placeholder (non-clickable) */}
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

          {/* ALL */}
          {includeAll && (
            <div
              role="option"
              aria-selected={values === 'ALL'}
              onMouseEnter={() => setActive(0)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleAll()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: active === 0 ? '#eef5ff' : '#fff',
                cursor: 'pointer',
                borderTop: '1px solid #f2f2f2',
              }}
            >
              <span style={{ fontWeight: 700 }}>{allLabel}</span>
              <input type="checkbox" readOnly checked={values === 'ALL'} />
            </div>
          )}

          {/* Options */}
          {options.map((opt, i) => {
            const idx = includeAll ? i + 1 : i;
            const isActive = active === idx;
            const checked = isChecked(opt.value);
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={checked}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !opt.disabled && toggleOne(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isActive ? '#eef5ff' : '#fff',
                  color: opt.disabled ? '#999' : '#111',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  borderTop: '1px solid #f2f2f2',
                }}
              >
                <span>{opt.label}</span>
                <input type="checkbox" readOnly checked={checked} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= Component ================= */
export default function Reports() {
  // Properties catalog (A→Z)
  const [properties, setProperties] = useState<Property[]>([]);
  useEffect(() => {
    (async () => {
      const list = await getProperties();
      const mapped = (list || [])
        .map((p: any) => ({
          property_id: p.property_id,
          property_name: p.property_name,
        }))
        .sort((a, b) => a.property_name.localeCompare(b.property_name));
      setProperties(mapped);
    })();
  }, []);

  // Fade-in
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // RENT controls
  const [rentSelected, setRentSelected] = useState<number[] | 'ALL'>([]);
  const [rentYear, setRentYear] = useState(currentYear());

  // EXPENSE controls
  const [expSelected, setExpSelected] = useState<number[] | 'ALL'>([]);
  const [expYear, setExpYear] = useState(currentYear());

  // “Dirty” flags (show Clear inputs icon)
  const rentDirty =
    (rentSelected === 'ALL' || (Array.isArray(rentSelected) && rentSelected.length > 0)) ||
    rentYear !== currentYear();
  const expDirty =
    (expSelected === 'ALL' || (Array.isArray(expSelected) && expSelected.length > 0)) ||
    expYear !== currentYear();

  // Results
  const [rentBusy, setRentBusy] = useState(false);
  const [rentResults, setRentResults] = useState<
    { property_id: number; property_name: string; rows: RentRow[]; total: number }[]
  >([]);
  const [expBusy, setExpBusy] = useState(false);
  const [expResults, setExpResults] = useState<
    { property_id: number; property_name: string; rows: ExpenseRow[]; total: number }[]
  >([]);

  // Helpers
  const ready = (year: number, sel: number[] | 'ALL') => {
    const yOk = Number.isInteger(year) && year >= 1900 && year <= 3000;
    const pOk = sel === 'ALL' || (Array.isArray(sel) && sel.length > 0);
    return yOk && pOk;
  };
  const resetRentInputs = () => {
    setRentSelected([]);
    setRentYear(currentYear());
  };
  const resetExpInputs = () => {
    setExpSelected([]);
    setExpYear(currentYear());
  };

  /* ================= INCOME REPORT ================= */
  async function fetchRent(property_id: number, y: number): Promise<RentRow[]> {
    const res = await fetch(`${RENT_API}?property_id=${property_id}&year=${y}`);
    if (!res.ok) return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: null }));
    const rows = await res.json();
    const byMonth: Record<number, number> = {};
    (Array.isArray(rows) ? rows : []).forEach((r: any) => {
      const idx = MONTHS.findIndex(m => m.toLowerCase() === String(r.month || '').toLowerCase());
      if (idx >= 0) {
        const amt = r.rent_amount != null ? Number(r.rent_amount) : null;
        if (amt != null && Number.isFinite(amt)) {
          const m = idx + 1;
          byMonth[m] = (byMonth[m] ?? 0) + amt;
        }
      }
    });
    return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: byMonth[i + 1] ?? null }));
  }

  async function runRentReport() {
    if (!ready(rentYear, rentSelected)) return;
    setRentBusy(true);
    try {
      const ids = rentSelected === 'ALL' ? properties.map(p => p.property_id) : (rentSelected as number[]);
      const picked = properties.filter(p => ids.includes(p.property_id));
      const out: { property_id: number; property_name: string; rows: RentRow[]; total: number }[] = [];
      for (const p of picked) {
        const twelve = await fetchRent(p.property_id, rentYear);
        const total = twelve.reduce((s, r) => s + (r.amount ?? 0), 0);
        out.push({ property_id: p.property_id, property_name: p.property_name, rows: twelve, total });
      }
      setRentResults(out);
    } finally {
      setRentBusy(false);
    }
  }

  const clearRent = () => setRentResults([]);
  const rentGrand = rentResults.reduce((s, g) => s + g.total, 0);

  /* ================= EXPENSE REPORT ================= */
  async function fetchExpenses(property_id: number, y: number): Promise<ExpenseRow[]> {
    const res = await fetch(`${TX_API}?property_id=${property_id}&year=${y}`);
    if (!res.ok) return [];
    const rows = await res.json();

    const yearOf = (iso: any): number | null => {
      if (!iso) return null;
      const s = String(iso);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s) || /^(\d{4})/.exec(s);
      return m ? Number(m[1]) : null;
    };

    const list: ExpenseRow[] = (Array.isArray(rows) ? rows : [])
      .map((t: any) => ({
        type: String(t.transaction_type ?? '').trim(),
        amount: t.transaction_amount != null ? Number(t.transaction_amount) : null,
        date: (t.transaction_date ? String(t.transaction_date).slice(0, 10) : ''),
      }))
      .filter(r => yearOf(r.date) === y)
      .sort((a, b) => a.date.localeCompare(b.date));

    return list;
  }

  async function runExpenseReport() {
    if (!ready(expYear, expSelected)) return;
    setExpBusy(true);
    try {
      const ids = expSelected === 'ALL' ? properties.map(p => p.property_id) : (expSelected as number[]);
      const picked = properties.filter(p => ids.includes(p.property_id));
      const out: { property_id: number; property_name: string; rows: ExpenseRow[]; total: number }[] = [];
      for (const p of picked) {
        const rows = await fetchExpenses(p.property_id, expYear);
        const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
        out.push({ property_id: p.property_id, property_name: p.property_name, rows, total });
      }
      setExpResults(out);
    } finally {
      setExpBusy(false);
    }
  }

  const clearExpense = () => setExpResults([]);
  const expGrand = expResults.reduce((s, g) => s + g.total, 0);

  /* ================= UI helpers ================= */
  const yearOptions = useMemo(
    () => YEARS.map((y) => ({ value: String(y) })),
    []
  );
  const propertyOptions = useMemo<MultiOption[]>(
    () => properties.map((p) => ({ value: p.property_id, label: p.property_name })),
    [properties]
  );

  /* ================= Render ================= */
  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 420ms ease, transform 420ms ease',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 150 }}>
        <h2
          style={{
            fontWeight: 900,
            letterSpacing: 1,
            fontSize: 40,
            color: '#111',
            margin: 0,
            lineHeight: 1,
          }}
        >
          REPORTS
        </h2>
      </div>

      {/* ===== Row 1: INCOME ===== */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
          marginTop: 0,
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <Button
          onClick={runRentReport}
          disabled={!ready(rentYear, rentSelected) || rentBusy}
          style={{
            ...btnBase,
            width: 300,
            background: ready(rentYear, rentSelected) && !rentBusy ? '#fff' : '#f3f3f3',
            color: '#111',
          }}
        >
          {rentBusy ? 'Generating…' : 'Income Report'}
        </Button>

        {/* RENT property multi (Universal look) */}
        <div style={{ ...controlBase, minWidth: PICKER_W, padding: 0, justifyContent: 'stretch' }}>
          <UniversalMultiDropdown
            values={rentSelected}
            options={propertyOptions}
            placeholder="Properties"
            includeAll
            allLabel="ALL Properties"
            onChange={setRentSelected}
            ariaLabel="Income report properties"
          />
        </div>

        {/* RENT year (UniversalDropdown) */}
        <div style={{ ...controlBase, width: YEAR_W, padding: 0 }}>
          <UniversalDropdown
            value={String(rentYear)}
            placeholder="Year"
            options={yearOptions}
            onChange={(val) => setRentYear(parseInt(val, 10))}
            ariaLabel="Income report year"
          />
        </div>

        {rentResults.length > 0 && !rentBusy && (
          <>
            <Button onClick={clearRent} style={btnClear}>Clear Report</Button>
            <Button onClick={exportRent} style={btnExport}>Export Report</Button>
          </>
        )}

        {(rentSelected === 'ALL' || (Array.isArray(rentSelected) && rentSelected.length > 0) || rentYear !== currentYear()) && (
          <IconButton
            icon="clear"
            label="Clear inputs"
            variant="danger"
            size="lg"
            onClick={resetRentInputs}
            style={{ width: CONTROL_H, height: CONTROL_H }}
          />
        )}
      </div>

      {/* ===== Row 2: EXPENSE ===== */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
          marginTop: 20,
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <Button
          onClick={runExpenseReport}
          disabled={!ready(expYear, expSelected) || expBusy}
          style={{
            ...btnBase,
            width: 300,
            background: ready(expYear, expSelected) && !expBusy ? '#fff' : '#f3f3f3',
            color: '#111',
          }}
        >
          {expBusy ? 'Generating…' : 'Expense Report'}
        </Button>

        {/* EXPENSE property multi (Universal look) */}
        <div style={{ ...controlBase, minWidth: PICKER_W, padding: 0, justifyContent: 'stretch' }}>
          <UniversalMultiDropdown
            values={expSelected}
            options={propertyOptions}
            placeholder="Properties"
            includeAll
            allLabel="ALL Properties"
            onChange={setExpSelected}
            ariaLabel="Expense report properties"
          />
        </div>

        {/* EXPENSE year (UniversalDropdown) */}
        <div style={{ ...controlBase, width: YEAR_W, padding: 0 }}>
          <UniversalDropdown
            value={String(expYear)}
            placeholder="Year"
            options={yearOptions}
            onChange={(val) => setExpYear(parseInt(val, 10))}
            ariaLabel="Expense report year"
          />
        </div>

        {expResults.length > 0 && !expBusy && (
          <>
            <Button onClick={clearExpense} style={btnClear}>Clear Report</Button>
            <Button onClick={exportExpense} style={btnExport}>Export Report</Button>
          </>
        )}

        {(expSelected === 'ALL' || (Array.isArray(expSelected) && expSelected.length > 0) || expYear !== currentYear()) && (
          <IconButton
            icon="clear"
            label="Clear inputs"
            variant="danger"
            size="lg"
            onClick={resetExpInputs}
            style={{ width: CONTROL_H, height: CONTROL_H }}
          />
        )}
      </div>

      {/* ===== OUTPUTS ===== */}
      <div style={{ marginTop: 18 }}>
        {/* RENT OUTPUT */}
        {rentBusy ? (
          <Center style={{ minHeight: 120 }}><Loader size="lg" /></Center>
        ) : rentResults.length === 0 ? null : (
          <>
            <div style={{ maxWidth: GRID_MAX_W, margin: '0 0 12px 0' }}>
              <div
                style={{
                  border: '2px solid #111',
                  background: '#faf9f5',
                  padding: '10px 14px',
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  boxSizing: 'border-box',
                  boxShadow: CARD_SHADOW,
                }}
              >
                Grand Total: ${rentGrand.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: GRID_GAP,
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                maxWidth: GRID_MAX_W,
                margin: 0,
              }}
            >
              {rentResults.map((grp) => (
                <div
                  key={grp.property_id}
                  style={{
                    background: '#fff',
                    border: '2px solid #111',
                    boxShadow: CARD_SHADOW,
                    boxSizing: 'border-box',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = CARD_SHADOW_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = CARD_SHADOW;
                  }}
                >
                  {/* Property banner */}
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#ece8d4',
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: BANNER_SHADOW,
                    }}
                  >
                    {grp.property_name}
                  </div>

                  <Table
                    withColumnBorders
                    style={{
                      borderTop: '1px solid #222',
                      borderCollapse: 'collapse',
                      width: '100%',
                      tableLayout: 'fixed',
                      ...tableShadow,
                    }}
                  >
                    <colgroup>
                      <col style={{ width: COL_PCT }} />
                      <col style={{ width: COL_PCT }} />
                      <col style={{ width: COL_PCT }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={headerTh}>Year</th>
                        <th style={headerTh}>Month</th>
                        <th style={headerTh}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grp.rows.length === 0 ? (
                        <tr><td colSpan={3} style={{ ...td, color: '#c33', fontWeight: 600 }}>No transactions</td></tr>
                      ) : grp.rows.map((r, i) => (
                        <tr key={i}>
                          <td style={td}>{rentYear}</td>
                          <td style={td}>{MONTHS[r.month - 1]}</td>
                          <td style={td}>
                            {r.amount == null ? <span style={{ color: PLACEHOLDER }}>—</span> : `$${r.amount.toLocaleString()}`}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={2} style={{ ...td, fontWeight: 900, background: '#faf9f5' }}>Total</td>
                        <td style={{ ...td, fontWeight: 900, background: '#faf9f5' }}>${grp.total.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              ))}
            </div>
          </>
        )}

        {/* EXPENSE OUTPUT */}
        {expBusy ? (
          <Center style={{ minHeight: 120 }}><Loader size="lg" /></Center>
        ) : expResults.length === 0 ? null : (
          <>
            <div style={{ maxWidth: GRID_MAX_W, margin: '24px 0 12px 0' }}>
              <div
                style={{
                  border: '2px solid #111',
                  background: '#faf9f5',
                  padding: '10px 14px',
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  boxSizing: 'border-box',
                  boxShadow: CARD_SHADOW,
                }}
              >
                Grand Total: ${expGrand.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: GRID_GAP,
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                maxWidth: GRID_MAX_W,
                margin: 0,
              }}
            >
              {expResults.map(grp => (
                <div
                  key={grp.property_id}
                  style={{
                    background: '#fff',
                    border: '2px solid #111',
                    boxShadow: CARD_SHADOW,
                    boxSizing: 'border-box',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = CARD_SHADOW_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = CARD_SHADOW;
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#ece8d4',
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: BANNER_SHADOW,
                    }}
                  >
                    {grp.property_name}
                  </div>

                  <Table
                    withColumnBorders
                    style={{
                      borderTop: '1px solid #222',
                      borderCollapse: 'collapse',
                      width: '100%',
                      tableLayout: 'fixed',
                      ...tableShadow,
                    }}
                  >
                    <colgroup>
                      <col style={{ width: COL_PCT }} />
                      <col style={{ width: COL_PCT }} />
                      <col style={{ width: COL_PCT }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={headerTh}>Transaction Type</th>
                        <th style={headerTh}>Amount</th>
                        <th style={headerTh}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grp.rows.length === 0 ? (
                        <tr><td colSpan={3} style={{ ...td, color: '#c33', fontWeight: 600 }}>No transactions</td></tr>
                      ) : grp.rows.map((r, i) => (
                        <tr key={i}>
                          <td style={td}>{r.type || <span style={{ color: PLACEHOLDER }}>—</span>}</td>
                          <td style={td}>{r.amount == null ? <span style={{ color: PLACEHOLDER }}>—</span> : `$${r.amount.toLocaleString()}`}</td>
                          <td style={td}>{r.date || <span style={{ color: PLACEHOLDER }}>—</span>}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...td, fontWeight: 900, background: '#faf9f5' }}>Total</td>
                        <td style={{ ...td, fontWeight: 900, background: '#faf9f5' }}>${grp.total.toLocaleString()}</td>
                        <td style={{ ...td, background: '#faf9f5' }} />
                      </tr>
                    </tbody>
                  </Table>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Box>
  );
}

/* ===== Exporters (stubs preserved) ===== */
function exportRent() {}
function exportExpense() {}
