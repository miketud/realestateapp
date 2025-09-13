// Reports.tsx — Material feel + independent rows + strict year filter + export mirrors UI + row Clear icon
import { useEffect, useMemo, useState } from 'react';
import { Box, Title, Table, Button, Center, Loader } from '@mantine/core';
import { MdOutlineClear } from 'react-icons/md';
import { getProperties } from '../api/properties';

// ===== Types
type Property = { property_id: number; property_name: string };
type RentRow = { month: number; amount: number | null };
type ExpenseRow = { type: string; amount: number | null; date: string };

// ===== Constants
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const RENT_API = '/api/rentlog';
const TX_API = '/api/transactions';

const CONTROL_H = 42;
const BTN_MIN_W = 180;       // also Year width
const YEAR_W = BTN_MIN_W;    // keep year inputs identical
const PICKER_W = 320;
const GRID_GAP = 24;
const CARD_W = 420;
const GRID_MAX_W = CARD_W * 3 + GRID_GAP * 2; // 3 cards per row
const COL_PCT = '33.3333%';
const PLACEHOLDER = '#9aa1a8';

const currentYear = () => new Date().getFullYear();

// ===== Material Shadows (UI)
const CELL_SHADOW = '0 2px 4px rgba(0,0,0,0.08)';
const TABLE_SHADOW = '0 8px 20px rgba(0,0,0,0.10)';
const CARD_SHADOW = '0 8px 18px rgba(0,0,0,0.12)';
const CARD_SHADOW_HOVER = '0 16px 32px rgba(0,0,0,0.18)';
const BANNER_SHADOW = 'inset 0 -1px 0 rgba(0,0,0,0.15)';

export default function Reports() {
  // One shared property catalogue (sorted A→Z)
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

  // ===== RENT controls (independent)
  const [rentPickerOpen, setRentPickerOpen] = useState(false);
  const [rentSelected, setRentSelected] = useState<number[] | 'ALL'>([]);
  const [rentYear, setRentYear] = useState(currentYear());

  // ===== EXPENSE controls (independent)
  const [expPickerOpen, setExpPickerOpen] = useState(false);
  const [expSelected, setExpSelected] = useState<number[] | 'ALL'>([]);
  const [expYear, setExpYear] = useState(currentYear());

  // Row “dirty” (to show the Clear icon)
  const rentDirty =
    (rentSelected === 'ALL' || (Array.isArray(rentSelected) && rentSelected.length > 0)) ||
    rentYear !== currentYear();
  const expDirty =
    (expSelected === 'ALL' || (Array.isArray(expSelected) && expSelected.length > 0)) ||
    expYear !== currentYear();

  // ===== Results state
  const [rentBusy, setRentBusy] = useState(false);
  const [rentResults, setRentResults] = useState<
    { property_id: number; property_name: string; rows: RentRow[]; total: number }[]
  >([]);
  const [expBusy, setExpBusy] = useState(false);
  const [expResults, setExpResults] = useState<
    { property_id: number; property_name: string; rows: ExpenseRow[]; total: number }[]
  >([]);

  // ===== Helpers
  const propertyLabel = (sel: number[] | 'ALL') => {
    if (sel === 'ALL') return 'ALL Properties';
    if (!sel.length) return 'Select properties';
    if (sel.length === 1) {
      const one = properties.find(p => p.property_id === sel[0]);
      return one ? one.property_name : '1 selected';
    }
    return `${sel.length} selected`;
  };

  const ready = (year: number, sel: number[] | 'ALL') => {
    const yOk = Number.isInteger(year) && year >= 1900 && year <= 3000;
    const pOk = sel === 'ALL' || (Array.isArray(sel) && sel.length > 0);
    return yOk && pOk;
  };

  const toggleOne = (sel: number[] | 'ALL', id: number): number[] => {
    if (sel === 'ALL') return [id];
    const set = new Set(sel);
    set.has(id) ? set.delete(id) : set.add(id);
    return Array.from(set);
  };

  const resetRentInputs = () => {
    setRentSelected([]);
    setRentYear(currentYear());
    setRentPickerOpen(false);
  };
  const resetExpInputs = () => {
    setExpSelected([]);
    setExpYear(currentYear());
    setExpPickerOpen(false);
  };

  // ===== INCOME REPORT
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

  // ===== EXPENSE REPORT
  async function fetchExpenses(property_id: number, y: number): Promise<ExpenseRow[]> {
    // Keep server filter if available, but enforce client-side by year
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

  // ===== Shared styles
  const controlBase: React.CSSProperties = {
    height: CONTROL_H,
    display: 'inline-flex',
    alignItems: 'center',
    border: '2px solid #111',
    borderRadius: 0,
    background: '#fff',
    fontWeight: 700,
    lineHeight: 1,
    boxSizing: 'border-box',
  };
  const btnBase: React.CSSProperties = {
    ...controlBase,
    padding: '0 18px',
    letterSpacing: 1,
    textTransform: 'uppercase',
    cursor: 'pointer',
    minWidth: BTN_MIN_W,
    justifyContent: 'center',
  };

  const btnClear: React.CSSProperties = { ...btnBase, background: '#ffe9e9' }; // red
  const btnExport: React.CSSProperties = { ...btnBase, background: '#efe6ff' }; // purple

  const headerTh: React.CSSProperties = {
    border: '1.5px solid #111',
    padding: '10px 12px',
    background: '#111',
    color: '#fff',
    fontWeight: 800,
    letterSpacing: 0.3,
    textAlign: 'center',
    boxShadow: CELL_SHADOW, // material cell shadow
  };
  const td: React.CSSProperties = {
    border: '1px solid #222',
    padding: '13px',
    fontFamily: 'inherit',
    fontSize: 18,
    textAlign: 'center',
    verticalAlign: 'middle',
    boxShadow: CELL_SHADOW, // material cell shadow
  };
  const tableShadow: React.CSSProperties = {
    boxShadow: TABLE_SHADOW, // material table shadow
    background: '#fff',
  };

  // ===== EXPORT (mirror UI incl. empty states)
  const exportRent = () => {
    const stamp = new Date().toLocaleString();
    const emptyAll = rentResults.length === 0;
    const html = `
<!doctype html><html><head><meta charset="utf-8"><title>Income Report</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,Arial,Helvetica,sans-serif;padding:24px;color:#111}
h1{margin:0 0 12px;font-size:22px}.summary{margin:10px 0 16px;font-weight:900;border:1px solid #111;padding:10px 14px;background:#faf9f5}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:${GRID_GAP}px}.group{border:1px solid #111;page-break-inside:avoid}
.gtitle{background:#ece8d4;padding:8px 10px;font-weight:900;letter-spacing:.6px;border-bottom:1px solid #111}
table{width:100%;border-collapse:collapse;table-layout:fixed}col{width:33.3333%}
th{background:#111;color:#fff;font-weight:800;letter-spacing:.3px;padding:8px 10px;border:1px solid #111;text-align:center}
td{padding:10px;border:1px solid #222;text-align:center}tfoot td{font-weight:900;background:#faf9f5}
.footer{margin-top:22px;font-size:12px;color:#555;text-align:right}
.note{padding:12px 14px;border:1px dashed #999;background:#f7f7f7}
</style></head><body>
<h1>Income Report — ${rentYear}</h1>
${emptyAll
        ? `<div class="note">No properties selected or no matching rent entries for ${rentYear}.</div>`
        : `<div class="summary">Grand Total: $${rentResults.reduce((s, g) => s + g.total, 0).toLocaleString()}</div>
     <div class="grid">
       ${rentResults.map(g => `
         <div class="group">
           <div class="gtitle">${g.property_name}</div>
           <table><colgroup><col/><col/><col/></colgroup>
             <thead><tr><th>Year</th><th>Month</th><th>Amount</th></tr></thead>
             <tbody>
               ${g.rows.length === 0
            ? `<tr><td colspan="3" style="color:#c33;font-weight:600">No transactions</td></tr>`
            : g.rows.map(r => `
                     <tr><td>${rentYear}</td><td>${MONTHS[r.month - 1]}</td><td>${r.amount == null ? '—' : `$${r.amount.toLocaleString()}`}</td></tr>
                   `).join('')}
             </tbody>
             <tfoot><tr><td colspan="2">Total</td><td>$${g.total.toLocaleString()}</td></tr></tfoot>
           </table>
         </div>
       `).join('')}
     </div>`}
<div class="footer">Report generated ${stamp}</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };

  const exportExpense = () => {
    const stamp = new Date().toLocaleString();
    const emptyAll = expResults.length === 0 || expResults.every(grp => grp.rows.length === 0);
    const html = `
<!doctype html><html><head><meta charset="utf-8"><title>Expense Report</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,Arial,Helvetica,sans-serif;padding:24px;color:#111}
h1{margin:0 0 12px;font-size:22px}.summary{margin:10px 0 16px;font-weight:900;border:1px solid #111;padding:10px 14px;background:#faf9f5}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:${GRID_GAP}px}.group{border:1px solid #111;page-break-inside:avoid}
.gtitle{background:#ece8d4;padding:8px 10px;font-weight:900;letter-spacing:.6px;border-bottom:1px solid #111}
table{width:100%;border-collapse:collapse;table-layout:fixed}col{width:33.3333%}
th{background:#111;color:#fff;font-weight:800;letter-spacing:.3px;padding:8px 10px;border:1px solid #111;text-align:center}
td{padding:10px;border:1px solid #222;text-align:center}tfoot td{font-weight:900;background:#faf9f5}
.footer{margin-top:22px;font-size:12px;color:#555;text-align:right}
.note{padding:12px 14px;border:1px dashed #999;background:#f7f7f7}
</style></head><body>
<h1>Expense Report — ${expYear}</h1>
${emptyAll
        ? `<div class="note">No transactions for the selected properties in ${expYear}.</div>`
        : `<div class="summary">Grand Total: $${expResults.reduce((s, g) => s + g.total, 0).toLocaleString()}</div>
     <div class="grid">
       ${expResults.map(g => `
         <div class="group">
           <div class="gtitle">${g.property_name}</div>
           <table><colgroup><col/><col/><col/></colgroup>
             <thead><tr><th>Transaction Type</th><th>Amount</th><th>Date</th></tr></thead>
             <tbody>
               ${g.rows.length === 0
            ? `<tr><td colspan="3" style="color:#c33;font-weight:600">No transactions</td></tr>`
            : g.rows.map(r => `
                     <tr><td>${r.type || '—'}</td><td>${r.amount == null ? '—' : `$${r.amount.toLocaleString()}`}</td><td>${r.date || '—'}</td></tr>
                   `).join('')}
             </tbody>
             <tfoot><tr><td>Total</td><td>$${g.total.toLocaleString()}</td><td></td></tr></tfoot>
           </table>
         </div>
       `).join('')}
     </div>`}
<div class="footer">Report generated ${stamp}</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };

  // ===== UI
  return (
    <Box style={{ margin: '0 40px 28px 40px' }}>
      <Title order={2} style={{ fontWeight: 900, letterSpacing: 1, fontSize: 28, color: '#111' }}>
        REPORTS
      </Title>

      {/* ===== Row 1: RENT (button first, then picker, then year, then Clear icon) ===== */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginTop: 12, flexWrap: 'wrap', position: 'relative' }}>
        <Button
          onClick={runRentReport}
          disabled={!ready(rentYear, rentSelected) || rentBusy}
          style={{
            ...btnBase,
            background: ready(rentYear, rentSelected) && !rentBusy ? '#fff' : '#f3f3f3',
            color: '#111',
          }}
        >
          {rentBusy ? 'Generating…' : 'Income Report'}
        </Button>

        {/* RENT picker */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setRentPickerOpen(o => !o)}
            style={{ ...controlBase, padding: '0 14px', minWidth: PICKER_W, justifyContent: 'space-between' }}
          >
            <span>{propertyLabel(rentSelected)}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>▼</span>
          </button>
          {rentPickerOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 10,
                background: '#fff', border: '2px solid #111', minWidth: PICKER_W, maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 10px 24px rgba(0,0,0,0.12)', padding: 10, boxSizing: 'border-box'
              }}
              onMouseLeave={() => setRentPickerOpen(false)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid #eee', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={rentSelected === 'ALL'}
                  onChange={(e) => setRentSelected(e.target.checked ? 'ALL' : [])}
                />
                <span style={{ fontWeight: 800 }}>ALL Properties</span>
              </div>
              {properties.map(p => (
                <label key={p.property_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={rentSelected === 'ALL'}
                    checked={rentSelected === 'ALL' ? true : (rentSelected as number[]).includes(p.property_id)}
                    onChange={() => setRentSelected(prev => toggleOne(prev, p.property_id))}
                  />
                  <span>{p.property_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* RENT year */}
        <input
          type="number"
          value={rentYear}
          onChange={(e) => setRentYear(parseInt(e.target.value || String(currentYear()), 10))}
          style={{ ...controlBase, width: YEAR_W, justifyContent: 'center', textAlign: 'center' }}
          placeholder="Year"
        />

        {rentResults.length > 0 && !rentBusy && (
          <>
            <Button onClick={clearRent} style={btnClear}>Clear Report</Button>
            <Button onClick={exportRent} style={btnExport}>Export Report</Button>
          </>
        )}

        {/* RENT Clear inputs icon (appears when dirty) */}
        {rentDirty && (
          <button
            title="Clear inputs"
            onClick={resetRentInputs}
            style={{
              ...controlBase,
              width: 44,
              justifyContent: 'center',
              padding: 0,
              borderColor: '#c33',
              color: '#c33',
              background: '#ffe9e9'
            }}
          >
            <MdOutlineClear size={22} />
          </button>
        )}
      </div>

      {/* ===== Row 2: EXPENSE (button first, then picker, then year, then Clear icon) ===== */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginTop: 12, flexWrap: 'wrap', position: 'relative' }}>
        <Button
          onClick={runExpenseReport}
          disabled={!ready(expYear, expSelected) || expBusy}
          style={{
            ...btnBase,
            background: ready(expYear, expSelected) && !expBusy ? '#fff' : '#f3f3f3',
            color: '#111',
          }}
        >
          {expBusy ? 'Generating…' : 'Expense Report'}
        </Button>


        {/* EXPENSE picker */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setExpPickerOpen(o => !o)}
            style={{ ...controlBase, padding: '0 14px', minWidth: PICKER_W, justifyContent: 'space-between' }}
          >
            <span>{propertyLabel(expSelected)}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>▼</span>
          </button>
          {expPickerOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 10,
                background: '#fff', border: '2px solid #111', minWidth: PICKER_W, maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 10px 24px rgba(0,0,0,0.12)', padding: 10, boxSizing: 'border-box'
              }}
              onMouseLeave={() => setExpPickerOpen(false)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid #eee', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={expSelected === 'ALL'}
                  onChange={(e) => setExpSelected(e.target.checked ? 'ALL' : [])}
                />
                <span style={{ fontWeight: 800 }}>ALL Properties</span>
              </div>
              {properties.map(p => (
                <label key={p.property_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={expSelected === 'ALL'}
                    checked={expSelected === 'ALL' ? true : (expSelected as number[]).includes(p.property_id)}
                    onChange={() => setExpSelected(prev => toggleOne(prev, p.property_id))}
                  />
                  <span>{p.property_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* EXPENSE year */}
        <input
          type="number"
          value={expYear}
          onChange={(e) => setExpYear(parseInt(e.target.value || String(currentYear()), 10))}
          style={{ ...controlBase, width: YEAR_W, justifyContent: 'center', textAlign: 'center' }}
          placeholder="Year"
        />

        {expResults.length > 0 && !expBusy && (
          <>
            <Button onClick={clearExpense} style={btnClear}>Clear Report</Button>
            <Button onClick={exportExpense} style={btnExport}>Export Report</Button>
          </>
        )}

        {/* EXPENSE Clear inputs icon (appears when dirty) */}
        {expDirty && (
          <button
            title="Clear inputs"
            onClick={resetExpInputs}
            style={{
              ...controlBase,
              width: 44,
              justifyContent: 'center',
              padding: 0,
              borderColor: '#c33',
              color: '#c33',
              background: '#ffe9e9'
            }}
          >
            <MdOutlineClear size={22} />
          </button>
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
                      ...tableShadow, // material table elevation
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
                      ...tableShadow, // material table elevation
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
