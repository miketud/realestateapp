// src/components/RentRollTable.tsx
import { useState, useEffect, useRef, useCallback, useLayoutEffect, type CSSProperties } from 'react';
import { Table } from '@mantine/core';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const API = '/api/rentlog';

const UNIT_WIDTH = 175;
const NOTES_WIDTH = 700;
const TABLE_WIDTH = (UNIT_WIDTH * 5) + NOTES_WIDTH;

const ROW_HOVER_BG = '#d6e7ffff';
const CELL_FOCUS_RING = 'inset 0 0 0 3px #325dae';

const BASE_FONT_SIZE = 16;
const HEADER_RULE = '2px solid rgba(0,0,0,0.25)';
const DIVIDER = '1px solid rgba(0,0,0,0.18)';
const TEXT_COLOR = '#111';
const YEAR_COLOR = '#fff455ff';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

type RentRollTableProps = { property_id: number };

type RentRollData = {
  amounts: string[];
  checks: string[];
  notes: string[];
  dates: string[];
};

type CellCol = 'amount' | 'check' | 'notes' | 'date';
type EditTarget = { row: number; col: CellCol } | null;

function emptyRentRoll(): RentRollData {
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
  fontSize: BASE_FONT_SIZE,
  fontFamily: 'inherit',
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
  height: '100%',
  color: TEXT_COLOR,
};

export default function RentRollTable({ property_id }: RentRollTableProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dataByYear, setDataByYear] = useState<Record<number, RentRollData>>({ [year]: emptyRentRoll() });
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const measure = useCallback(() => setMaxH(bodyRef.current?.scrollHeight ?? 0), []);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  // Fetch rent log for year
  useEffect(() => {
    async function fetchRentRoll() {
      try {
        const res = await fetch(`${API}?property_id=${property_id}&year=${year}`);
        if (!res.ok) throw new Error(await res.text());
        const dbRows = await res.json();
        const rr: RentRollData = emptyRentRoll();
        (dbRows as any[]).forEach(row => {
          const i = months.findIndex(m => m.toLowerCase() === (row.month ?? '').toLowerCase());
          if (i >= 0) {
            rr.amounts[i] = row.rent_amount != null ? String(row.rent_amount) : '';
            rr.checks[i] = row.check_number != null ? String(row.check_number) : '';
            rr.notes[i] = row.notes || '';
            rr.dates[i] = row.date_deposited ? String(row.date_deposited).substring(0, 10) : '';
          }
        });
        setDataByYear(prev => ({ ...prev, [year]: rr }));
        setSaveError(null);
        requestAnimationFrame(measure);
      } catch {
        setDataByYear(prev => ({ ...prev, [year]: emptyRentRoll() }));
        setSaveError('Failed to load rent log.');
        requestAnimationFrame(measure);
      }
    }
    if (property_id) fetchRentRoll();
  }, [property_id, year, measure]);

  const yearData = dataByYear[year] || emptyRentRoll();

  async function handleSave() {
    if (!editing) return;
    const { row, col } = editing;
    const prevVal =
      col === 'amount' ? yearData.amounts[row]
        : col === 'check' ? yearData.checks[row]
          : yearData.notes[row];

    if (editValue === prevVal) {
      setEditing(null);
      setEditValue('');
      return;
    }

    const month = months[row];
    const payload = {
      property_id,
      year,
      month,
      rent_amount: col === 'amount' ? parseMoney(editValue) : parseMoney(yearData.amounts[row]),
      check_number: col === 'check' ? parseIntMaybe(editValue) : parseIntMaybe(yearData.checks[row]),
      notes: col === 'notes' ? (editValue || null) : (yearData.notes[row] || null),
      date_deposited: yearData.dates[row] || null,
    };

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: RentRollData = {
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
      requestAnimationFrame(measure);
    } catch (err: any) {
      setSaveError(`Save failed: ${err.message || 'server error'}`);
    }
  }

  function handleEdit(row: number, col: CellCol, value: string) {
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
      rent_amount: parseMoney(yearData.amounts[i]),
      check_number: parseIntMaybe(yearData.checks[i]),
      notes: yearData.notes[i] || null,
      date_deposited: safeDate,
    };
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: RentRollData = {
        amounts: [...yearData.amounts],
        checks: [...yearData.checks],
        notes: [...yearData.notes],
        dates: [...yearData.dates],
      };
      updated.dates[i] = safeDate ?? '';
      setDataByYear(prev => ({ ...prev, [year]: updated }));
      setSaveError(null);
      requestAnimationFrame(measure);
    } catch (err: any) {
      setSaveError(`Date save failed: ${err.message || 'server error'}`);
    }
  }

  function handleYearChange(newYear: number) {
    setYear(newYear);
    setEditing(null);
    setEditValue('');
    setSaveError(null);
    setDataByYear(prev => (prev[newYear] ? prev : { ...prev, [newYear]: emptyRentRoll() }));
    requestAnimationFrame(measure);
  }

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
    <div style={{ marginTop: 0, width: TABLE_WIDTH, color: TEXT_COLOR }}>
      {/* TITLE ROW (clickable, no background) */}
      <div
        onClick={(e) => {
          // Ignore clicks on year badge/buttons
          const target = e.target as HTMLElement;
          if (target.closest('.year-controls')) return;
          setOpen(v => !v);
        }}
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 0px',
          padding: '12px 16px',
          background: 'transparent',
          borderTop: HEADER_RULE,
          borderBottom: 'none',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: 1,
          position: 'relative',
          color: TEXT_COLOR,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        RENT LOG

        {/* YEAR BADGE + SELECTORS */}
        <div
          className="year-controls"
          style={{
            position: 'absolute',
            left: 40,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            color: TEXT_COLOR,
            fontWeight: 700,
            fontSize: 30,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              background: YEAR_COLOR,
              color: '#000',
              borderRadius: 8,
              userSelect: 'none',
            }}
          >
            {year}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleYearChange(year - 1)} aria-label="Previous year" style={yearBtnPlain}>
              ▼
            </button>
            <button onClick={() => handleYearChange(year + 1)} aria-label="Next year" style={yearBtnPlain}>
              ▲
            </button>
          </div>
        </div>
      </div>

      {/* Divider below title */}
      <div
        style={{
          width: TABLE_WIDTH,
          margin: '0 auto 0px',
          height: 0,
          borderBottom: HEADER_RULE,
          pointerEvents: 'none',
        }}
      />

      {/* Error banner */}
      {saveError && (
        <div
          style={{
            width: TABLE_WIDTH,
            marginBottom: 8,
            padding: '10px 18px',
            background: '#ffeded',
            color: '#a13d3d',
            border: '1px solid #e57e7e',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 0.5,
          }}
        >
          {saveError}
        </div>
      )}

      {/* Collapsible body */}
      <div
        ref={bodyRef}
        style={{
          overflow: open ? 'visible' : 'hidden',
          maxHeight: open ? maxH : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 260ms ease, opacity 200ms ease',
        }}
      >
        <div style={{ width: TABLE_WIDTH }}>
          <Table
            highlightOnHover={false}
            style={{
              width: '100%',
              fontSize: BASE_FONT_SIZE,
              fontFamily: 'inherit',
              borderCollapse: 'collapse',
              border: 'none',
              marginBottom: 0,
              background: '#fff',
              tableLayout: 'fixed',
              color: TEXT_COLOR,
            }}
          >
            <ColsPx />

            <thead>
              <tr style={{ borderBottom: HEADER_RULE }}>
                <th style={thNoLines}>Year</th>
                <th style={thNoLines}>Month</th>
                <th style={thNoLines}>Amount</th>
                <th style={thNoLines}>Check #</th>
                <th style={thNoLines}>Date Deposited</th>
                <th style={thNoLines}>Notes</th>
              </tr>
            </thead>

            <tbody>
              {months.map((month, i) => {
                const rowBg = hoveredRow === i ? ROW_HOVER_BG : undefined;
                const cellFocus = (c: CellCol) => editing?.row === i && editing?.col === c;

                return (
                  <tr
                    key={month}
                    style={{ background: rowBg }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td style={{ ...tdVertLight, borderLeft: 'none' }}>
                      <span style={{ fontWeight: 700 }}>{year}</span>
                    </td>

                    <td style={{ ...tdVertLight, fontWeight: 800, fontSize: 18 }}>{month.toUpperCase()}</td>

                    {/* Amount */}
                    <td
                      style={{ ...tdVertLight, ...(cellFocus('amount') ? { boxShadow: CELL_FOCUS_RING } : {}) }}
                      onClick={() => !editing && handleEdit(i, 'amount', yearData.amounts[i])}
                    >
                      {editing && cellFocus('amount') ? (
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                          }}
                          style={inputCellStyle}
                        />
                      ) : (
                        yearData.amounts[i]
                          ? currencyFormatter.format(Number((yearData.amounts[i] || '0').replace(/[,$]/g, '')))
                          : ''
                      )}
                    </td>

                    {/* Check */}
                    <td
                      style={{ ...tdVertLight, ...(cellFocus('check') ? { boxShadow: CELL_FOCUS_RING } : {}) }}
                      onClick={() => !editing && handleEdit(i, 'check', yearData.checks[i])}
                    >
                      {editing && cellFocus('check') ? (
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                          }}
                          style={inputCellStyle}
                        />
                      ) : (
                        yearData.checks[i]
                      )}
                    </td>

                    {/* Date */}
                    <td
                      style={{ ...tdVertLight, padding: 0 }}
                      title="Click to select, double-click to fill today's date"
                      onDoubleClick={() => {
                        const d = new Date();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        handleDateChange(i, `${d.getFullYear()}-${m}-${day}`);
                      }}
                    >
                      <input
                        type="date"
                        value={yearData.dates[i]}
                        onChange={(e) => handleDateChange(i, e.target.value)}
                        style={{
                          ...inputCellStyle,
                          padding: '11px 18px 11px 0',
                          cursor: 'pointer',
                        }}
                      />
                    </td>

                    {/* Notes */}
                    <td
                      style={{
                        ...tdVertLight,
                        borderRight: 'none',
                        textAlign: 'left',
                        ...(cellFocus('notes') ? { boxShadow: CELL_FOCUS_RING } : {}),
                      }}
                      onClick={() => !editing && handleEdit(i, 'notes', yearData.notes[i])}
                    >
                      {editing && cellFocus('notes') ? (
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                          }}
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
      </div>

      {/* Component divider */}
      <div style={{ width: TABLE_WIDTH, height: 0, borderBottom: DIVIDER, margin: '0px auto 0' }} />
    </div>
  );
}

/* Styles */
const thNoLines: CSSProperties = {
  border: 'none',
  padding: '12px 14px',
  background: 'transparent',
  color: TEXT_COLOR,
  fontWeight: 800,
  fontSize: 16,
  textAlign: 'center',
  textTransform: 'uppercase',
};

const tdVertLight: CSSProperties = {
  borderLeft: DIVIDER,
  borderRight: DIVIDER,
  padding: '13px',
  fontSize: 16,
  textAlign: 'center',
  verticalAlign: 'middle',
  color: TEXT_COLOR,
};

const yearBtnPlain: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  minWidth: 22,
  height: 22,
  fontSize: 12,
  fontWeight: 800,
  color: TEXT_COLOR,
  cursor: 'pointer',
};
