// src/components/PaymentTable.tsx
import { useState, useEffect, type CSSProperties } from 'react';
import { Table } from '@mantine/core';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:3000';
const API = `${API_BASE}/api/paymentlog`;

const UNIT_WIDTH = 175;                 // narrow columns
const NOTES_WIDTH = 700;                // wide notes column
const TABLE_WIDTH = (UNIT_WIDTH * 5) + NOTES_WIDTH;

// Visuals (distinct from RentRollTable)
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

type PaymentTableProps = { property_id: number };

type PaymentData = {
  amounts: string[];
  checks: string[];
  notes: string[];
  dates: string[]; // YYYY-MM-DD or ''
};

type EditTarget = { row: number; col: 'amount' | 'check' | 'notes' | 'date' } | null;

function emptyPayment(): PaymentData {
  return {
    amounts: Array(12).fill(''),
    checks: Array(12).fill(''),
    notes: Array(12).fill(''),
    dates: Array(12).fill(''),
  };
}

const parseMoney = (s: string) => {
  const clean = (s || '').replace(/[,$]/g, '').trim();
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

const parseIntMaybe = (s: string) => {
  const clean = (s || '').trim();
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isInteger(n) ? n : null;
};

const inputCellStyle: CSSProperties = {
  width: '100%',
  fontSize: 16,
  fontFamily: 'inherit',
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
  height: '100%',
};

export default function PaymentTable({ property_id }: PaymentTableProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dataByYear, setDataByYear] = useState<Record<number, PaymentData>>({ [year]: emptyPayment() });
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPayment() {
      try {
        const res = await fetch(`${API}?property_id=${property_id}&year=${year}`);
        if (!res.ok) throw new Error(await res.text());
        const dbRows = await res.json();

        const pd: PaymentData = emptyPayment();
        (dbRows as any[]).forEach(row => {
          const i = months.findIndex(m => m.toLowerCase() === (row.month ?? '').toLowerCase());
          if (i >= 0) {
            pd.amounts[i] = row.payment_amount != null ? String(row.payment_amount) : '';
            pd.checks[i] = row.check_number != null ? String(row.check_number) : '';
            pd.notes[i] = row.notes || '';
            pd.dates[i] = row.date_paid ? String(row.date_paid).substring(0, 10) : '';
          }
        });

        setDataByYear(prev => ({ ...prev, [year]: pd }));
        setSaveError(null);
      } catch (err: any) {
        setDataByYear(prev => ({ ...prev, [year]: emptyPayment() }));
        setSaveError('Failed to load payment log.');
      }
    }
    if (property_id) fetchPayment();
  }, [property_id, year]);

  const yearData = dataByYear[year] || emptyPayment();

  async function handleSave() {
    if (!editing) return;
    const { row, col } = editing;

    const payload = {
      property_id,
      year,
      month: months[row], // keep original cased month for API
      payment_amount: col === 'amount' ? parseMoney(editValue) : parseMoney(yearData.amounts[row]),
      check_number: col === 'check' ? parseIntMaybe(editValue) : parseIntMaybe(yearData.checks[row]),
      notes: col === 'notes' ? (editValue || null) : (yearData.notes[row] || null),
      date_paid: (yearData.dates[row] || null),
    };

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      const updated: PaymentData = {
        amounts: [...yearData.amounts],
        checks: [...yearData.checks],
        notes: [...yearData.notes],
        dates: [...yearData.dates],
      };
      if (col === 'amount') updated.amounts[row] = editValue;
      if (col === 'check') updated.checks[row] = editValue;
      if (col === 'notes') updated.notes[row] = editValue;

      setDataByYear(prev => ({ ...prev, [year]: updated }));
      setEditing(null);
      setEditValue('');
      setSaveError(null);
    } catch (err: any) {
      setSaveError(`Save failed: ${err.message || 'server error'}`);
    }
  }

  function handleEdit(row: number, col: 'amount' | 'check' | 'notes', value: string) {
    setEditing({ row, col });
    setEditValue(value);
    setSaveError(null);
  }

  function handleCancel() {
    setEditing(null);
    setEditValue('');
  }

  async function handleDateChange(i: number, newDate: string) {
    const safeDate = newDate.trim() === '' ? null : newDate;
    const body = {
      property_id,
      year,
      month: months[i],
      payment_amount: parseMoney(yearData.amounts[i]),
      check_number: parseIntMaybe(yearData.checks[i]),
      notes: yearData.notes[i] || null,
      date_paid: safeDate,
    };
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: PaymentData = {
        amounts: [...yearData.amounts],
        checks: [...yearData.checks],
        notes: [...yearData.notes],
        dates: [...yearData.dates],
      };
      updated.dates[i] = safeDate ?? '';
      setDataByYear(prev => ({ ...prev, [year]: updated }));
      setSaveError(null);
    } catch (err: any) {
      setSaveError(`Date save failed: ${err.message || 'server error'}`);
    }
  }

  function handleYearChange(newYear: number) {
    setYear(newYear);
    setEditing(null);
    setEditValue('');
    setSaveError(null);
    setDataByYear(prev => (prev[newYear] ? prev : { ...prev, [newYear]: emptyPayment() }));
  }

  const focusShadow = (cond: boolean): CSSProperties => (cond ? { boxShadow: FOCUS_RING } : {});
  const isRowFocused = (row: number) => editing && editing.row === row;

  function ColsPx() {
    return (
      <colgroup>
        <col style={{ width: UNIT_WIDTH }} />
        <col style={{ width: UNIT_WIDTH }} />
        <col style={{ width: UNIT_WIDTH }} />
        <col style={{ width: UNIT_WIDTH }} />
        <col style={{ width: UNIT_WIDTH }} />
        <col style={{ width: NOTES_WIDTH }} />
      </colgroup>
    );
  }

  return (
    <div style={{ marginTop: 32, width: TABLE_WIDTH }}>
      {/* NAVIGATION BAR (Prev / Year / Next) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          padding: '12px 16px',
          background: '#b6b6b6ff',
          border: '4px solid #000',
          borderBottom: 'none', // attach to Payment Log bar
        }}
      >
        <button style={arrowButtonStyle} onClick={() => handleYearChange(year - 1)}>
          &#8592; Prev
        </button>
        <span style={yearTextStyle}>{year}</span>
        <button style={arrowButtonStyle} onClick={() => handleYearChange(year + 1)}>
          Next &#8594;
        </button>
      </div>

      {/* PAYMENT LOG TITLE */}
      <div
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 0',
          padding: '12px 16px',
          background: '#b6b6b6ff',
          border: '4px solid #000',
          borderTop: 'none',
          borderBottom: 'none',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: 1,
        }}
      >
        PAYMENT LOG
      </div>

      {/* Error banner */}
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

      {/* TABLE */}
      <Table
        highlightOnHover
        style={{
          width: TABLE_WIDTH,
          fontSize: 16,
          fontFamily: 'inherit',
          borderCollapse: 'collapse',
          border: '4px solid #000',
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
          marginBottom: 32,
          background: '#fff',
          tableLayout: 'fixed',
        }}
      >
        <ColsPx />
        <thead>
          <tr>
            <th style={thStyle}>Year</th>
            <th style={thStyle}>Month</th>
            <th style={thStyle}>Amount</th>
            <th style={thStyle}>Check #</th>
            <th style={thStyle}>Date Paid</th>
            <th style={thStyle}>Notes</th>
          </tr>
        </thead>

        <tbody>
          {months.map((month, i) => {
            const rowFocused = isRowFocused(i);
            const rowStyle = rowFocused ? { outline: '2px solid #325dae', background: HILITE_BG } : {};
            return (
              <tr key={month} style={rowStyle}>
                {/* Year cell — bold, larger font, light gray background */}
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 800,
                    fontSize: 18,
                    color: '#ffffffff',
                    background: '#000000ff',
                  }}
                >
                  {year}
                </td>

                {/* Month cell — bold, larger font, light gray background, UPPERCASE */}
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 800,
                    fontSize: 18,
                    background: '#b6b6b6ff',
                  }}
                >
                  {month.toUpperCase()}
                </td>

                {/* Amount */}
                <td
                  style={{ ...tdStyle, ...focusShadow(editing?.row === i && editing?.col === 'amount') }}
                  onClick={() => !editing && handleEdit(i, 'amount', yearData.amounts[i])}
                >
                  {editing && editing.row === i && editing.col === 'amount' ? (
                    <input
                      type="text"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                      style={inputCellStyle}
                    />
                  ) : (
                    yearData.amounts[i]
                      ? currencyFormatter.format(Number((yearData.amounts[i] || '0').replace(/[,$]/g, '')))
                      : ''
                  )}
                </td>

                {/* Check # */}
                <td
                  style={{ ...tdStyle, ...focusShadow(editing?.row === i && editing?.col === 'check') }}
                  onClick={() => !editing && handleEdit(i, 'check', yearData.checks[i])}
                >
                  {editing && editing.row === i && editing.col === 'check' ? (
                    <input
                      type="text"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                      style={inputCellStyle}
                    />
                  ) : (
                    yearData.checks[i]
                  )}
                </td>

                {/* Date Paid */}
                <td
                  style={{ ...tdStyle, padding: 0, ...focusShadow(editing?.row === i && editing?.col === 'date') }}
                  onClick={() => setEditing({ row: i, col: 'date' })}
                  onDoubleClick={() => {
                    const d = new Date();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const today = `${d.getFullYear()}-${m}-${day}`;
                    handleDateChange(i, today);
                  }}
                  title="Click to select, double-click to fill with today's date"
                >
                  <input
                    type="date"
                    value={yearData.dates[i]}
                    onFocus={() => setEditing({ row: i, col: 'date' })}
                    onBlur={() => setEditing(null)}
                    onChange={e => handleDateChange(i, e.target.value)}
                    style={{
                      ...inputCellStyle,
                      padding: '11px 18px 11px 0',
                      cursor: 'pointer',
                      height: '100%',
                    }}
                  />
                </td>

                {/* Notes */}
                <td
                  style={{ ...tdStyle, textAlign: 'left', ...focusShadow(editing?.row === i && editing?.col === 'notes') }}
                  onClick={() => !editing && handleEdit(i, 'notes', yearData.notes[i])}
                >
                  {editing && editing.row === i && editing.col === 'notes' ? (
                    <input
                      type="text"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                      style={{ ...inputCellStyle, textAlign: 'left' }}
                    />
                  ) : (
                    yearData.notes[i]
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

// ----------- Styles -----------
const arrowButtonStyle: CSSProperties = {
  padding: '10px 28px',
  fontWeight: 700,
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  fontSize: 18,
  background: '#fff',
  border: '2px solid #111',
  color: '#111',
  cursor: 'pointer',
  borderRadius: 0,
  boxShadow: 'none',
  outline: 'none',
  letterSpacing: 1,
};

const yearTextStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 25,
  fontFamily: 'inherit',
  background: '#a7d0ff',   // distinct from RentRollTable
  border: '2px solid #111',
  color: '#111',
  letterSpacing: 1,
  textAlign: 'center',
  padding: '10px 28px',
  textTransform: 'uppercase',
  display: 'inline-block',
};

const thStyle: CSSProperties = {
  border: '1px solid #111',
  padding: '14px',
  background: '#000000ff',   // deep blue vs RentRollTable's orange
  color: '#fff',
  fontWeight: 700,
  fontFamily: 'inherit',
  fontSize: 16,
  letterSpacing: 'inherit',
  textAlign: 'center',
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const tdStyle: CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  fontFamily: 'inherit',
  fontSize: 16,
  textAlign: 'center',
  verticalAlign: 'middle',
  color: 'inherit',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
