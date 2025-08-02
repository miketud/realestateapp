import { useState, useEffect } from 'react';
import { Table } from '@mantine/core';

const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

type RentRollTableProps = {
  property_id: number;
};

type RentRollData = {
  amounts: string[];
  checks: string[];
  notes: string[];
  dates: string[];
};

type EditTarget = { row: number; col: 'amount' | 'check' | 'notes' } | null;

// Helper to create an empty year's data
function emptyRentRoll(): RentRollData {
  return {
    amounts: Array(12).fill(''),
    checks: Array(12).fill(''),
    notes: Array(12).fill(''),
    dates: Array(12).fill(''),
  };
}

export default function RentRollTable({ property_id }: RentRollTableProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dataByYear, setDataByYear] = useState<Record<number, RentRollData>>({
    [year]: emptyRentRoll(),
  });
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load from DB for the selected property/year
  useEffect(() => {
    async function fetchRentRoll() {
      try {
        const res = await fetch(`/api/rentroll?property_id=${property_id}&year=${year}`);
        const dbRows = await res.json();
        const rr: RentRollData = emptyRentRoll();
        (dbRows as any[]).forEach(row => {
          const i = months.findIndex(m => m.toLowerCase() === (row.month ?? '').toLowerCase());
          if (i >= 0) {
            rr.amounts[i] = row.rent_amount !== null && row.rent_amount !== undefined ? String(row.rent_amount) : '';
            rr.checks[i] = row.check_number !== null && row.check_number !== undefined ? String(row.check_number) : '';
            rr.notes[i] = row.notes || '';
            rr.dates[i] = row.date_deposited ? row.date_deposited.substring(0, 10) : '';
          }
        });
        setDataByYear(prev => ({ ...prev, [year]: rr }));
      } catch (err) {
        setDataByYear(prev => ({ ...prev, [year]: emptyRentRoll() }));
      }
    }
    if (property_id) fetchRentRoll();
  }, [property_id, year]);

  // Get current year's data (always defined)
  const yearData = dataByYear[year] || emptyRentRoll();

  // Save edited value (calls API)
  async function handleSave() {
    if (!editing) return;
    const { row, col } = editing;
    const prevVal =
      col === 'amount' ? yearData.amounts[row]
        : col === 'check' ? yearData.checks[row]
          : yearData.notes[row];

    // Only save if the value changed and is not blank
    if (editValue === prevVal) {
      setEditing(null);
      setEditValue('');
      return;
    }

    const month = months[row];
    const current = yearData;

    // Compose new row for API
    const updatedRow = {
      property_id,
      year,
      month,
      rent_amount: col === 'amount' ? editValue : current.amounts[row],
      check_number: col === 'check' ? editValue : current.checks[row],
      notes: col === 'notes' ? editValue : current.notes[row],
      date_deposited: current.dates[row] || `${year}-${String(row + 1).padStart(2, "0")}-01`,
    };

    try {
      const res = await fetch('/api/rentroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRow),
      });
      if (!res.ok) throw new Error('Failed to save');
      // Update local state for fast feedback
      const updated: RentRollData = {
        amounts: [...current.amounts],
        checks: [...current.checks],
        notes: [...current.notes],
        dates: [...current.dates],
      };
      if (col === 'amount') updated.amounts[row] = editValue;
      if (col === 'check') updated.checks[row] = editValue;
      if (col === 'notes') updated.notes[row] = editValue;
      setDataByYear(prev => ({ ...prev, [year]: updated }));
      setEditing(null);
      setEditValue('');
      setSaveError(null);
    } catch (err) {
      setSaveError('Error: Could not save to server.');
    }
  }
  // Inline cell edit helpers
  function handleEdit(row: number, col: 'amount' | 'check' | 'notes', value: string) {
    setEditing({ row, col });
    setEditValue(value);
    setSaveError(null);
  }

  function handleCancel() {
    setEditing(null);
    setEditValue('');
  }

  // Save date to API
  async function handleDateChange(i: number, newDate: string) {
    // Convert blank date to null for backend
    const safeDate = newDate.trim() === "" ? null : newDate;
    const body = {
      property_id,
      year,
      month: months[i],
      rent_amount: yearData.amounts[i],
      check_number: yearData.checks[i],
      notes: yearData.notes[i],
      date_deposited: safeDate,
    };
    try {
      const res = await fetch('/api/rentroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated: RentRollData = {
        amounts: [...yearData.amounts],
        checks: [...yearData.checks],
        notes: [...yearData.notes],
        dates: [...yearData.dates],
      };
      updated.dates[i] = safeDate ?? ""; // Keep blank string in UI
      setDataByYear(prev => ({ ...prev, [year]: updated }));
      setSaveError(null);
    } catch (err) {
      setSaveError('Error: Could not save date.');
    }
  }

  // Year toggle
  function handleYearChange(newYear: number) {
    setYear(newYear);
    setEditing(null);
    setEditValue('');
    setSaveError(null);
    // Preload next year if needed
    setDataByYear(prev => (
      prev[newYear]
        ? prev
        : { ...prev, [newYear]: emptyRentRoll() }
    ));
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        marginBottom: 22,
        marginLeft: 0,
      }}>
        <button style={arrowButtonStyle} onClick={() => handleYearChange(year - 1)}>
          &#8592; Prev
        </button>
        <span style={yearTextStyle}>{year}</span>
        <button style={arrowButtonStyle} onClick={() => handleYearChange(year + 1)}>
          Next &#8594;
        </button>
      </div>
      {/* Error popup/alert */}
      {saveError && (
        <div style={{
          marginBottom: 16,
          padding: '10px 18px',
          background: '#ffeded',
          color: '#a13d3d',
          border: '1.5px solid #e57e7e',
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: 0.5,
        }}>
          {saveError}
        </div>
      )}
      <Table
        highlightOnHover
        style={{
          width: '100%',
          fontSize: 16,
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
          borderCollapse: 'collapse',
          border: '2px solid black',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)',
          marginTop: 0,
          marginBottom: 32,
          background: '#fff',
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 150 }}>Year</th>
            <th style={{ ...thStyle, width: 150 }}>Month</th>
            <th style={{ ...thStyle, width: 150 }}>Amount</th>
            <th style={{ ...thStyle, width: 150 }}>Check #</th>
            <th style={{ ...thStyle, width: 150 }}>Date Deposited</th>
            <th style={thStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month, i) => (
            <tr key={month}>
              <td style={tdStyle}>{year}</td>
              <td style={tdStyle}>{month}</td>
              {/* Amount */}
              <td style={tdStyle} onClick={() => !editing && handleEdit(i, 'amount', yearData.amounts[i])}>
                {editing && editing.row === i && editing.col === 'amount' ? (
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
                    ? currencyFormatter.format(Number(yearData.amounts[i]))
                    : ""
                )}
              </td>
              {/* Check # */}
              <td style={tdStyle} onClick={() => !editing && handleEdit(i, 'check', yearData.checks[i])}>
                {editing && editing.row === i && editing.col === 'check' ? (
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
                style={{ ...tdStyle, width: 120, padding: 0 }}
                onDoubleClick={() => {
                  const d = new Date();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  handleDateChange(i, `${d.getFullYear()}-${m}-${day}`);
                }}
                title="Double-click to fill with today's date"
              >
                <input
                  type="date"
                  value={yearData.dates[i]}
                  onChange={e => handleDateChange(i, e.target.value)}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    letterSpacing: 'inherit',
                    color: 'inherit',
                    textAlign: 'center',
                    outline: 'none',
                    cursor: 'pointer',
                    padding: '11px 18px 11px 0',
                    boxSizing: 'border-box',
                  }}
                />
              </td>
              {/* Notes */}
              <td style={tdStyle} onClick={() => !editing && handleEdit(i, 'notes', yearData.notes[i])}>
                {editing && editing.row === i && editing.col === 'notes' ? (
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
                  yearData.notes[i]
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// ----------- Styles -----------
const inputCellStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 17,
  fontFamily: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  border: '1.5px solid #325dae',
  borderRadius: 6,
  background: '#f2f6fd',
  padding: '7px 12px',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s',
};

const arrowButtonStyle: React.CSSProperties = {
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
  transition: 'background 0.15s, color 0.15s',
};

const yearTextStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 25,
  fontFamily: 'inherit',
  background: '#edfb83',
  border: '2px solid #111',
  color: '#111',
  letterSpacing: 1,
  textAlign: 'center' as const,
  padding: '10px 28px',
  textTransform: 'uppercase',
  display: 'inline-block',
};

const thStyle = {
  border: '1px solid #111',
  padding: '14px',
  background: '#bd642c',
  color: '#fff',
  fontWeight: 700,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  letterSpacing: 'inherit',
  textAlign: 'center' as const,
  textTransform: 'uppercase' as const,
};

const tdStyle = {
  border: '1px solid #222',
  padding: '13px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  color: 'inherit',
};
