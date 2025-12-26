// src/components/Reports.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Box, Table, Button, Center, Loader } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { getProperties } from '../api/properties';
import UniversalDropdown from './UniversalDropdown';
import { IconButton, Icon } from './ui/Icons';

/* ===== Types ===== */
type Property = { property_id: number; property_name: string };
type RentRow = { month: number; amount: number | null };
type ExpenseRow = { type: string; amount: number | null; date: string };
type MultiOption = { value: number; label: string };

/* ===== Consts ===== */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const RENT_API = '/api/rentlog';
const TX_API = '/api/transactions';

const CONTROL_H = 56;
const YEAR_W = 140;
const PROP_W = 520;
const REPORT_BTN_W = 240;
const FRAME_W = 1500;

const GRID_GAP = 10;
const CARD_SHADOW = '0 8px 18px rgba(0,0,0,0.12)';
const CARD_SHADOW_HOVER = '0 16px 32px rgba(0,0,0,0.18)';
const BANNER_SHADOW = 'inset 0 -1px 0 rgba(0,0,0,0.15)';

const COL_PCT = '33.3333%';
const PLACEHOLDER = '#9aa1a8';

const currentYear = () => new Date().getFullYear();
const YEARS: number[] = Array.from({ length: 31 }, (_, i) => currentYear() + 1 - i);

/* ===== Styles (fw 700) ===== */
const controlShell: React.CSSProperties = {
  height: CONTROL_H,
  display: 'inline-flex',
  alignItems: 'center',
  border: '2px solid #111',
  background: '#fff',
  fontWeight: 700,
  fontSize: 20,
  lineHeight: 1,
  boxSizing: 'border-box',
  boxShadow: '0 8px 20px rgba(0,0,0,0.10)',
  padding: 0,
};

const btnBase: React.CSSProperties = {
  ...controlShell,
  padding: '0 16px',
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  minWidth: REPORT_BTN_W,
  width: REPORT_BTN_W,
  justifyContent: 'center',
};

const btnSmall: React.CSSProperties = {
  ...controlShell,
  padding: '0 12px',
  minWidth: 140,
  fontSize: 16,
};

const iconBtn: React.CSSProperties = {
  ...controlShell,
  width: CONTROL_H,
  minWidth: CONTROL_H,
  padding: 0,
  display: 'flex',
  justifyContent: 'center',
};

const headerTh: React.CSSProperties = {
  border: '1.5px solid #111',
  padding: '0 12px',
  height: CONTROL_H,
  background: '#111',
  color: '#fff',
  fontWeight: 700,
  letterSpacing: 0.3,
  textAlign: 'center',
  verticalAlign: 'middle',
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
};

/* ===== Blur-free motion helpers ===== */
const easeOutCb = [0.16, 1, 0.3, 1] as const;
const mountEase = { duration: 0.32, ease: easeOutCb };
const fadeSlide = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: mountEase, transitionEnd: { transform: 'none' as any } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } },
};

/* ===== Click-outside multi-select styled like Universal ===== */
function UniversalMultiDropdown({
  values,
  options,
  onChange,
  ariaLabel,
}: {
  values: number[] | 'ALL';
  options: MultiOption[];
  onChange: (next: number[] | 'ALL') => void;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const isAll = values === 'ALL';
  const display = isAll
    ? 'ALL Properties'
    : Array.isArray(values) && values.length
    ? `${values.length} selected`
    : 'Select properties';

  const allChecked = isAll || (Array.isArray(values) && values.length === options.length && options.length > 0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggleAll = () => onChange(isAll ? [] : 'ALL');
  const toggleOne = (id: number) => {
    if (isAll) return onChange([id]);
    const set = new Set(values as number[]);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange(Array.from(set));
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel || 'Select properties'}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          padding: '0 14px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 700 }}>{display}</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            maxHeight: 340,
            overflowY: 'auto',
            background: '#fff',
            border: '2px solid #111',
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
            zIndex: 2000,
          }}
        >
          <div
            role="option"
            aria-selected={isAll}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              cursor: 'pointer',
              background: isAll ? '#1f6fff' : '#eef4ff',
              color: isAll ? '#fff' : '#0b3aa6',
              fontWeight: 700,
            }}
          >
            <span>ALL Properties</span>
            <input type="checkbox" readOnly checked={allChecked} />
          </div>

          {options.map((opt) => {
            const checked = isAll || (Array.isArray(values) && values.includes(opt.value));
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={checked}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleOne(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderTop: '1px solid #f1f1f1',
                  background: checked ? '#f7fbff' : '#fff',
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

/* ===== Component ===== */
export default function Reports() {
  // Properties
  const [properties, setProperties] = useState<Property[]>([]);
  useEffect(() => {
    (async () => {
      const list = await getProperties();
      const mapped = (list || [])
        .map((p: any) => ({ property_id: p.property_id, property_name: p.property_name }))
        .sort((a, b) => a.property_name.localeCompare(b.property_name));
      setProperties(mapped);
    })();
  }, []);

  // Controls
  const [year, setYear] = useState(currentYear());
  const [selected, setSelected] = useState<number[] | 'ALL'>([]);

  // Results
  const [rentBusy, setRentBusy] = useState(false);
  const [rentResults, setRentResults] = useState<{ property_id: number; property_name: string; rows: RentRow[]; total: number }[]>([]);
  const [expBusy, setExpBusy] = useState(false);
  const [expResults, setExpResults] = useState<{ property_id: number; property_name: string; rows: ExpenseRow[]; total: number }[]>([]);

  const hasSelection = selected === 'ALL' || (Array.isArray(selected) && selected.length > 0);
  const ready = useCallback(() => Number.isInteger(year) && year >= 1900 && year <= 3000 && hasSelection, [year, hasSelection]);

  const inputsDirty = hasSelection || year !== currentYear();
  const resetAll = () => {
    setSelected([]);
    setYear(currentYear());
    setRentResults([]);
    setExpResults([]);
  };

  // Fetchers
  async function fetchRent(property_id: number, y: number): Promise<RentRow[]> {
    const res = await fetch(`${RENT_API}?property_id=${property_id}&year=${y}`);
    if (!res.ok) return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: null }));
    const rows = await res.json();
    const byMonth: Record<number, number> = {};
    (Array.isArray(rows) ? rows : []).forEach((r: any) => {
      const idx = MONTHS.findIndex((m) => m.toLowerCase() === String(r.month || '').toLowerCase());
      if (idx >= 0) {
        const amt = r.rent_amount != null ? Number(r.rent_amount) : null;
        if (amt != null && Number.isFinite(amt)) byMonth[idx + 1] = (byMonth[idx + 1] ?? 0) + amt;
      }
    });
    return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: byMonth[i + 1] ?? null }));
  }

  async function fetchExpenses(property_id: number, y: number): Promise<ExpenseRow[]> {
    const res = await fetch(`${TX_API}?property_id=${property_id}&year=${y}`);
    if (!res.ok) return [];
    const rows = await res.json();
    const yOf = (iso: any): number | null => {
      if (!iso) return null;
      const m = /^(\d{4})/.exec(String(iso));
      return m ? Number(m[1]) : null;
    };
    return (Array.isArray(rows) ? rows : [])
      .map((t: any) => ({
        type: String(t.transaction_type ?? '').trim(),
        amount: t.transaction_amount != null ? Number(t.transaction_amount) : null,
        date: t.transaction_date ? String(t.transaction_date).slice(0, 10) : '',
      }))
      .filter((r) => yOf(r.date) === y)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Parallel fetch. No artificial delays. Smooth visual only.
  async function runRentReport() {
    if (!ready() || rentBusy) return;
    setRentBusy(true);
    setRentResults([]);
    try {
      const ids = selected === 'ALL' ? properties.map((p) => p.property_id) : (selected as number[]);
      const picked = properties.filter((p) => ids.includes(p.property_id));
      const data = await Promise.all(
        picked.map(async (p) => {
          const rows = await fetchRent(p.property_id, year);
          const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
          return { property_id: p.property_id, property_name: p.property_name, rows, total };
        })
      );
      setRentResults(data);
    } finally {
      setRentBusy(false);
    }
  }

  async function runExpenseReport() {
    if (!ready() || expBusy) return;
    setExpBusy(true);
    setExpResults([]);
    try {
      const ids = selected === 'ALL' ? properties.map((p) => p.property_id) : (selected as number[]);
      const picked = properties.filter((p) => ids.includes(p.property_id));
      const data = await Promise.all(
        picked.map(async (p) => {
          const rows = await fetchExpenses(p.property_id, year);
          const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
          return { property_id: p.property_id, property_name: p.property_name, rows, total };
        })
      );
      setExpResults(data);
    } finally {
      setExpBusy(false);
    }
  }

  const clearRent = () => setRentResults([]);
  const clearExpense = () => setExpResults([]);

  const rentGrand = rentResults.reduce((s, g) => s + g.total, 0);
  const expGrand = expResults.reduce((s, g) => s + g.total, 0);

  const yearOptions = useMemo(() => YEARS.map((y) => ({ value: String(y), label: String(y) })), []);
  const propertyOptions = useMemo<MultiOption[]>(
    () => properties.map((p) => ({ value: p.property_id, label: p.property_name })),
    [properties]
  );

  const showAny = rentResults.length > 0 || expResults.length > 0;
  const readyEnabled = ready();

  const incomeBtnStyle: React.CSSProperties = readyEnabled && !rentBusy
    ? { ...btnBase, background: '#1f7a1f', color: '#fff' }
    : { ...btnBase, background: '#f3f3f3', color: '#777', cursor: 'not-allowed' };

  const expenseBtnStyle: React.CSSProperties = readyEnabled && !expBusy
    ? { ...btnBase, background: '#b22222', color: '#fff' }
    : { ...btnBase, background: '#f3f3f3', color: '#777', cursor: 'not-allowed' };

  return (
    <Box style={{ maxWidth: FRAME_W, margin: '24px auto 0' }}>
      <AnimatePresence>
        <motion.div
          initial={fadeSlide.initial}
          animate={fadeSlide.animate}
          exit={fadeSlide.exit}
          style={{ willChange: 'auto' }} // prevent text blur on paint
        >
          {/* Controls: two rows; buttons centered row 2 */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `56px ${YEAR_W}px ${PROP_W}px`,
                gridTemplateRows: '56px 56px',
                gap: GRID_GAP,
                alignItems: 'stretch',
                width: YEAR_W + PROP_W + 56 + GRID_GAP * 2,
              }}
            >
              {/* Clear-all spans rows */}
              {inputsDirty || showAny ? (
                <IconButton icon="cancel" label="clear all" onClick={resetAll} style={{ width: CONTROL_H, height: CONTROL_H, gridRow: '1 / span 2' }} />
              ) : (
                <div style={{ width: CONTROL_H, height: CONTROL_H, gridRow: '1 / span 2' }} />
              )}

              {/* Year: UniversalDropdown */}
              <div style={{ ...controlShell, width: YEAR_W }}>
                <UniversalDropdown
                  value={String(year)}
                  placeholder="Year"
                  options={yearOptions}
                  onChange={(val) => setYear(parseInt(val, 10))}
                  ariaLabel="Reports year"
                />
              </div>

              {/* Properties: Universal-style multi with click-outside close */}
              <div style={{ ...controlShell, width: PROP_W }}>
                <UniversalMultiDropdown
                  values={selected}
                  options={propertyOptions}
                  onChange={setSelected}
                  ariaLabel="Reports properties"
                />
              </div>

              {/* Buttons centered on row 2 */}
              <div style={{ gridColumn: '2 / span 2', gridRow: '2', display: 'flex', justifyContent: 'center', gap: GRID_GAP }}>
                <Button onClick={runRentReport} disabled={!readyEnabled} style={incomeBtnStyle}>
                  {rentBusy ? 'Generating…' : 'INCOME REPORT'}
                </Button>
                <Button onClick={runExpenseReport} disabled={!readyEnabled} style={expenseBtnStyle}>
                  {expBusy ? 'Generating…' : 'EXPENSE REPORT'}
                </Button>
              </div>
            </div>
          </div>

          {/* Divider after any report */}
          <AnimatePresence>
            {showAny && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                exit={{ opacity: 0, scaleX: 0, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                style={{ marginTop: 12, height: 2, background: '#111', transformOrigin: '50% 50%' }}
              />
            )}
          </AnimatePresence>

          {/* ===== OUTPUTS ===== */}
          <div style={{ marginTop: 18 }}>
            {/* INCOME */}
            {rentBusy ? (
              <Center style={{ minHeight: 120 }}><Loader size="lg" /></Center>
            ) : rentResults.length > 0 ? (
              <motion.div initial={fadeSlide.initial} animate={fadeSlide.animate} exit={fadeSlide.exit}>
                <div style={{ maxWidth: FRAME_W, margin: '0 auto 12px auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: 0.6 }}>INCOME REPORT</div>
                  <div
                    style={{
                      border: '2px solid #111',
                      background: '#faf9f5',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: 20,
                      letterSpacing: 0.6,
                      boxSizing: 'border-box',
                      boxShadow: CARD_SHADOW,
                    }}
                  >
                    Grand Total: ${rentGrand.toLocaleString()}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={clearRent} style={btnSmall}>Clear</button>
                    <button title="Export income report" aria-label="Export income report" onClick={exportRent} style={iconBtn}>
                      <Icon name="export" size={22} aria-hidden />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 24,
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    maxWidth: FRAME_W,
                    margin: '0 auto',
                  }}
                >
                  {rentResults.map((grp) => (
                    <motion.div key={grp.property_id} initial={fadeSlide.initial} animate={fadeSlide.animate} exit={fadeSlide.exit}>
                      <div
                        style={{
                          background: '#fff',
                          border: '2px solid #111',
                          boxShadow: CARD_SHADOW,
                          boxSizing: 'border-box',
                          transition: 'transform 300ms ease, box-shadow 300ms ease',
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
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            width: '100%',
                            boxSizing: 'border-box',
                            boxShadow: BANNER_SHADOW,
                          }}
                        >
                          {grp.property_name}
                        </div>

                        <Table withColumnBorders style={{ borderTop: '1px solid #222', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
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
                              <tr><td colSpan={3} style={{ ...td, color: '#c33', fontWeight: 700 }}>No transactions</td></tr>
                            ) : grp.rows.map((r, idx) => (
                              <tr key={idx}>
                                <td style={td}>{year}</td>
                                <td style={td}>{MONTHS[r.month - 1]}</td>
                                <td style={td}>{r.amount == null ? <span style={{ color: PLACEHOLDER }}>—</span> : `$${r.amount.toLocaleString()}`}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={2} style={{ ...td, fontWeight: 700, background: '#faf9f5' }}>Total</td>
                              <td style={{ ...td, fontWeight: 700, background: '#faf9f5' }}>${grp.total.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </Table>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}

            {/* Mid divider */}
            <AnimatePresence>
              {rentResults.length > 0 && expResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                  exit={{ opacity: 0, scaleX: 0, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                  style={{ margin: '18px 0', height: 2, background: '#111', transformOrigin: '50% 50%' }}
                />
              )}
            </AnimatePresence>

            {/* EXPENSE */}
            {expBusy ? (
              <Center style={{ minHeight: 120 }}><Loader size="lg" /></Center>
            ) : expResults.length > 0 ? (
              <motion.div initial={fadeSlide.initial} animate={fadeSlide.animate} exit={fadeSlide.exit}>
                <div style={{ maxWidth: FRAME_W, margin: '0 auto 12px auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: 0.6 }}>EXPENSE REPORT</div>
                  <div
                    style={{
                      border: '2px solid #111',
                      background: '#faf9f5',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: 20,
                      letterSpacing: 0.6,
                      boxSizing: 'border-box',
                      boxShadow: CARD_SHADOW,
                    }}
                  >
                    Grand Total: ${expGrand.toLocaleString()}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={clearExpense} style={btnSmall}>Clear</button>
                    <button title="Export expense report" aria-label="Export expense report" onClick={exportExpense} style={iconBtn}>
                      <Icon name="export" size={22} aria-hidden />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 24,
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    maxWidth: FRAME_W,
                    margin: '0 auto',
                  }}
                >
                  {expResults.map((grp) => (
                    <motion.div key={grp.property_id} initial={fadeSlide.initial} animate={fadeSlide.animate} exit={fadeSlide.exit}>
                      <div
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
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            width: '100%',
                            boxSizing: 'border-box',
                            boxShadow: BANNER_SHADOW,
                          }}
                        >
                          {grp.property_name}
                        </div>

                        <Table withColumnBorders style={{ borderTop: '1px solid #222', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
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
                              <tr><td colSpan={3} style={{ ...td, color: '#c33', fontWeight: 700 }}>No transactions</td></tr>
                            ) : grp.rows.map((r, idx) => (
                              <tr key={idx}>
                                <td style={td}>{r.type || <span style={{ color: PLACEHOLDER }}>—</span>}</td>
                                <td style={td}>{r.amount == null ? <span style={{ color: PLACEHOLDER }}>—</span> : `$${r.amount.toLocaleString()}`}</td>
                                <td style={td}>{r.date || <span style={{ color: PLACEHOLDER }}>—</span>}</td>
                              </tr>
                            ))}
                            <tr>
                              <td style={{ ...td, fontWeight: 700, background: '#faf9f5' }}>Total</td>
                              <td style={{ ...td, fontWeight: 700, background: '#faf9f5' }}>${grp.total.toLocaleString()}</td>
                              <td style={{ ...td, background: '#faf9f5' }} />
                            </tr>
                          </tbody>
                        </Table>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </div>

          {/* Bottom divider */}
          <AnimatePresence>
            {showAny && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                exit={{ opacity: 0, scaleX: 0, transition: { duration: 1, ease: easeOutCb }, transitionEnd: { transform: 'none' as any } }}
                style={{ margin: '18px 0', height: 2, background: '#111', transformOrigin: '50% 50%' }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}

/* ===== Exporters (stubs) ===== */
function exportRent() {}
function exportExpense() {}
