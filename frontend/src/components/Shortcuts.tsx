// src/components/Shortcuts.tsx
import { useEffect, useMemo, useState } from 'react';
import { IoMdAdd } from 'react-icons/io';
import { IconButton } from './ui/Icons';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';

export type Mode = 'rent' | 'payment';
export type ShortcutMode = Mode;

type PropLite = { property_id: number; property_name: string };
type ExistingRow = { id?: number; rent_id?: number; payment_id?: number; month?: string; month_idx?: number; mm?: number };

type Props = { active?: boolean; open?: boolean; mode: Mode | ShortcutMode };

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') || '';
const API = `${API_BASE}/api`;
const RENT_API = `${API_BASE}/api/rentlog`;
const PAY_API = `${API_BASE}/api/paymentlog`;
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'] as const;
const LANE_TRANSITION = 'max-height 300ms ease, opacity 300ms ease, transform 300ms ease';

const sanitizeMoney = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const [a, b = ''] = cleaned.split('.');
  return a + (cleaned.includes('.') ? '.' + b.slice(0, 2) : '');
};
const parseMoney = (s: string) => (s.trim() ? (Number.isFinite(Number(s)) ? Number(s) : null) : null);
const todayISO = () => {
  const d = new Date(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dy = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dy}`;
};
const toIntOrNull = (v: string) => { const n = Number(v.replace(/\D/g, '')); return Number.isInteger(n) ? n : null; };
const toStrOrNull = (v: string) => (v.trim() ? v.trim() : null);
const coerceMonthIdx = (m: unknown): number | null => {
  if (typeof m === 'number' && Number.isFinite(m)) return m >= 1 && m <= 12 ? m - 1 : m;
  const s = String(m ?? '').trim(); if (!s) return null;
  if (/^\d{1,2}$/.test(s)) { const n = Number(s); if (n >= 1 && n <= 12) return n - 1; }
  const idx = MONTHS.findIndex(x => x === s.slice(0, 3).toUpperCase());
  return idx >= 0 ? idx : null;
};

type Row = {
  id: string; expanded: boolean; propId: number | '';
  year: number; monthIdx: number; amount: string; checkNum: string; dateStr: string; notes: string;
};
const newRow = (expanded = true): Row => {
  const n = new Date();
  return { id: Math.random().toString(36).slice(2), expanded, propId: '', year: n.getFullYear(), monthIdx: n.getMonth(), amount: '', checkNum: '', dateStr: '', notes: '' };
};

export default function Shortcuts({ active, open: openLegacy, mode }: Props) {
  const visible = Boolean(active ?? openLegacy ?? false);
  if (!visible) return null;

  const FRAME_W = 1575;
  const RAIL = 56;
  const ROW_H = 56;

  const W_PROP = 350;
  const W_SMALL = 125;
  const W_DATE = 150;
  const W_NOTES = 350;

  // sum of grid cell widths (center target)
  const ENTRY_W = W_PROP + W_SMALL * 4 + W_DATE + W_NOTES; // 1350
  // reserve space for right-side action buttons beside the entry strip
  const ACTION_W = 200; // roomy for Save/Cancel/Remove

  const [propsList, setPropsList] = useState<PropLite[]>([]);
  useEffect(() => {
    fetch(`${API}/properties`)
      .then(r => r.json())
      .then((rows: any[]) =>
        setPropsList(
          (rows || [])
            .map(p => ({ property_id: Number(p.property_id), property_name: String(p.property_name || '') }))
            .filter(p => p.property_name)
            .sort((a, b) => a.property_name.localeCompare(b.property_name, undefined, { sensitivity: 'base' }))
        )
      )
      .catch(() => setPropsList([]));
  }, []);

  const propOptions: DropdownOption[] = useMemo(() => propsList.map(p => ({ value: String(p.property_id), label: p.property_name })), [propsList]);
  const monthOptions: DropdownOption[] = useMemo(() => MONTHS.map(m => ({ value: m, label: m })), []);

  const [rows, setRows] = useState<Row[]>([newRow(true)]);
  const setRow = (id: string, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const clearRow = (id: string) => setRow(id, { propId: '', amount: '', checkNum: '', dateStr: '', notes: '' });
  const removeRow = (id: string) => setRows(rs => rs.filter(r => r.id !== id));
  const addRow = () => setRows(rs => [...rs, newRow(true)]);

  const hasAnyInput = (r: Row) => {
    const n = new Date();
    return !!(r.propId || r.amount || r.checkNum || r.dateStr || r.notes || r.year !== n.getFullYear() || r.monthIdx !== n.getMonth());
  };
  const lastHasInput = rows.length > 0 && hasAnyInput(rows[rows.length - 1]);

  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(null), 3200); return () => clearTimeout(t); }, [ok]);

  const [confirm, setConfirm] = useState<{ rowId: string; id: number; propName: string; month: string; year: number } | null>(null);

  const propName = (r: Row) => propsList.find(p => p.property_id === r.propId)?.property_name || 'Unknown Property';
  const canSave = (r: Row) => r.propId !== '' && parseMoney(r.amount) !== null;

  function buildPayload(r: Row) {
    const base = { property_id: r.propId as number, year: r.year, month: MONTHS[r.monthIdx], month_idx: r.monthIdx + 1, check_number: toIntOrNull(r.checkNum), notes: toStrOrNull(r.notes) };
    return mode === 'rent' ? { ...base, rent_amount: parseMoney(r.amount), date_deposited: r.dateStr || null } : { ...base, payment_amount: parseMoney(r.amount), date_paid: r.dateStr || null };
  }

  async function findExisting(pid: number, yr: number, targetIdx: number) {
    const url = (mode === 'rent' ? RENT_API : PAY_API) + `?property_id=${pid}&year=${yr}`;
    try {
      const r = await fetch(url); if (!r.ok) return null;
      const rows = (await r.json()) as ExistingRow[] | any[];
      const hit = (Array.isArray(rows) ? rows : []).find(row => coerceMonthIdx(row.month ?? row.month_idx ?? row.mm) === targetIdx);
      if (!hit) return null;
      const id = Number(hit.rent_id ?? hit.payment_id ?? hit.id);
      return Number.isFinite(id) ? id : null;
    } catch { return null; }
  }

  async function saveRow(r: Row) {
    setErr(null); setOk(null); setConfirm(null);
    if (!canSave(r)) { setErr('Fill property and amount.'); return; }
    const existingId = await findExisting(r.propId as number, r.year, r.monthIdx);
    if (existingId) { setConfirm({ rowId: r.id, id: existingId, propName: propName(r), month: MONTHS[r.monthIdx], year: r.year }); return; }
    try {
      const url = mode === 'rent' ? RENT_API : PAY_API;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(r)) });
      if (!res.ok) throw new Error(await res.text());
      const amt = parseMoney(r.amount) ?? 0;
      setOk(`Saved ${mode.toUpperCase()}: ${propName(r)} — ${MONTHS[r.monthIdx]} ${r.year} | ${mode === 'rent' ? 'Rent' : 'Payment'} $${amt}${r.dateStr ? ` | Date ${r.dateStr}` : ''}`);
      clearRow(r.id);
    } catch (e: any) { setErr(e?.message || 'Save failed.'); }
  }

  async function overwriteExisting() {
    if (!confirm) return;
    const r = rows.find(x => x.id === confirm.rowId); if (!r) { setConfirm(null); return; }
    const payload = buildPayload(r);
    const url = mode === 'rent' ? `${RENT_API}/${confirm.id}` : `${PAY_API}/${confirm.id}`;
    try {
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!put.ok) {
        const post = await fetch(mode === 'rent' ? RENT_API : PAY_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, overwrite: true }) });
        if (!post.ok) throw new Error(await post.text());
      }
      setOk(`Overwrote ${mode}: ${confirm.propName} — ${confirm.month} ${confirm.year}.`);
      clearRow(r.id); setConfirm(null);
    } catch (e: any) { setErr(e?.message || 'Overwrite failed.'); }
  }

  // layout
  const frame: React.CSSProperties = { width: FRAME_W, margin: '40px auto' };
  const railBtn = (activeBtn: boolean): React.CSSProperties => ({
    width: RAIL, height: RAIL, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: activeBtn ? '#000' : 'transparent', border: 'none', cursor: 'pointer'
  });

  const entryGrid: React.CSSProperties = {
    width: ENTRY_W,
    display: 'grid',
    gridTemplateColumns: `${W_PROP}px ${W_SMALL}px ${W_SMALL}px ${W_SMALL}px ${W_SMALL}px ${W_DATE}px ${W_NOTES}px`,
    alignItems: 'stretch',
    height: ROW_H,
    border: '1px solid #111',
    boxSizing: 'border-box',
    flex: '0 0 auto',
    background: '#fff',
  };
  const sepL = { borderLeft: '1px solid #111' } as const;
  const cellWrap: React.CSSProperties = { position: 'relative', minWidth: 0, overflow: 'hidden' };
  const labelInside: React.CSSProperties = {
    position: 'absolute', top: 4, left: 10, fontSize: 11, fontWeight: 800,
    letterSpacing: .3, color: '#666', userSelect: 'none', pointerEvents: 'none', zIndex: 2
  };
  const inputCommon: React.CSSProperties = {
    height: '100%', width: '100%', border: 'none', outline: 'none', padding: '0 10px',
    fontSize: 16, background: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', display: 'block'
  };

  const rowWrap = (expanded: boolean): React.CSSProperties => ({
    overflow: 'visible',
    maxHeight: expanded ? ROW_H : 0,
    opacity: expanded ? 1 : 0,
    transform: expanded ? 'translateX(0)' : 'translateX(-8px)',
    transition: LANE_TRANSITION,
  });

  const rowLine: React.CSSProperties = {
    width: ENTRY_W + ACTION_W,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
  };

  return (
    <>
      {/* Centered to dashboard width */}
      <div
        style={{
          ...frame,
          display: 'grid',
          gridTemplateColumns: `${RAIL}px 1fr`,
          columnGap: 12,
          alignItems: 'start',
        }}
      >
        {/* Left rail, vertically aligned with centered rows */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {rows.map((r) => (
            <button
              key={`rail-${r.id}`}
              type="button"
              aria-label={r.expanded ? 'Hide entry' : 'Add entry'}
              title={r.expanded ? 'Hide entry' : 'Add entry'}
              onClick={() => setRow(r.id, { expanded: !r.expanded })}
              style={railBtn(r.expanded)}
            >
              <IoMdAdd size={36} color={r.expanded ? '#ffef09' : '#111'} />
            </button>
          ))}
          {lastHasInput && (
            <button
              type="button"
              aria-label="Add another entry"
              title="Add another entry"
              onClick={addRow}
              style={railBtn(false)}
            >
              <IoMdAdd size={36} color={'#111'} />
            </button>
          )}
        </div>

        {/* Right side: rows block centered within the dashboard frame */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {rows.map((r, idx) => {
            const saveReady = canSave(r);
            const showDelete = idx > 0 && !hasAnyInput(r);
            return (
              <div key={r.id} style={rowWrap(r.expanded)}>
                {/* This line has fixed width (ENTRY_W + ACTION_W) and is centered by parent alignItems:center */}
                <div style={rowLine}>
                  {/* Fixed-width entry strip */}
                  <div style={entryGrid}>
                    <div style={{ ...cellWrap }}>
                      <span style={labelInside}>PROPERTY</span>
                      <UniversalDropdown
                        value={r.propId === '' ? null : String(r.propId)}
                        options={propOptions}
                        placeholder="Select property"
                        onChange={(val) => setRow(r.id, { propId: val ? Number(val) : '' })}
                        searchable
                        variant="flat"
                        padTop={18}
                      />
                    </div>

                    <div style={{ ...cellWrap, ...sepL }}>
                      <span style={labelInside}>YEAR</span>
                      <input
                        type="number"
                        value={r.year}
                        min={1900}
                        max={3000}
                        onChange={(e) => setRow(r.id, { year: Number(e.target.value || r.year) })}
                        style={{ ...inputCommon, paddingTop: 16, textAlign: 'center' }}
                      />
                    </div>

                    <div style={{ ...cellWrap, ...sepL }}>
                      <span style={labelInside}>MONTH</span>
                      <UniversalDropdown
                        value={MONTHS[r.monthIdx]}
                        options={monthOptions}
                        placeholder="Select month"
                        onChange={(val) => {
                          const i = MONTHS.findIndex(m => m === val);
                          if (i >= 0) setRow(r.id, { monthIdx: i });
                        }}
                        searchable={false}
                        variant="flat"
                        padTop={18}
                      />
                    </div>

                    <div style={{ ...cellWrap, ...sepL }}>
                      <span style={labelInside}>{mode === 'rent' ? 'RENT' : 'PAYMENT'}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="$"
                        value={r.amount}
                        onChange={(e) => setRow(r.id, { amount: sanitizeMoney(e.target.value) })}
                        style={{ ...inputCommon, paddingTop: 16, textAlign: 'center' }}
                      />
                    </div>

                    <div style={{ ...cellWrap, ...sepL }}>
                      <span style={labelInside}>CHECK #</span>
                      <input
                        type="text"
                        value={r.checkNum}
                        onChange={(e) => setRow(r.id, { checkNum: e.target.value })}
                        style={{ ...inputCommon, paddingTop: 16, textAlign: 'center' }}
                      />
                    </div>

                    <div style={{ ...cellWrap, ...sepL }}>
                      <span style={labelInside}>{mode === 'rent' ? 'DATE DEPOSITED' : 'DATE PAID'}</span>
                      <input
                        type="date"
                        value={r.dateStr}
                        onChange={(e) => setRow(r.id, { dateStr: e.target.value })}
                        onDoubleClick={() => setRow(r.id, { dateStr: todayISO() })}
                        style={{ ...inputCommon, paddingTop: 14, textAlign: 'center' }}
                      />
                    </div>

<div style={{ ...cellWrap, ...sepL, borderRight: '1px solid #111' }}>
  <span style={labelInside}>NOTES</span>
  <input
    type="text"
    value={r.notes}
    onChange={(e) => setRow(r.id, { notes: e.target.value })}
    style={{ ...inputCommon, paddingTop: 16 }}
  />
</div>

                  </div>

                  {/* Fixed-width actions block */}
                  <div style={{ width: ACTION_W, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, height: ROW_H }}>
                    {saveReady && <IconButton icon="save" label="Save" onClick={() => saveRow(r)} />}
                    {hasAnyInput(r) && <IconButton icon="cancel" label="cancel" onClick={() => clearRow(r.id)} />}
                    {showDelete && <IconButton icon="delete" label="Remove" onClick={() => removeRow(r.id)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ok && <Banner kind="ok" msg={ok} />}
      {err && <Banner kind="error" msg={err} />}
      {confirm && (
        <Confirm
          text={`An entry already exists for ${confirm.propName} — ${confirm.month} ${confirm.year}. Overwrite with new values?`}
          onYes={overwriteExisting}
          onNo={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function Banner({ kind, msg }: { kind: 'ok' | 'error'; msg: string }) {
  const okTheme = kind === 'ok';
  return (
    <div
      style={{
        width: 1575, margin: '8px auto 0', padding: '10px 12px',
        background: okTheme ? '#e9ffe9' : '#ffeded',
        color: okTheme ? '#145214' : '#a13d3d',
        border: `1px solid ${okTheme ? '#83c983' : '#e57e7e'}`,
        fontWeight: 800,
      }}
    >
      {msg}
    </div>
  );
}
function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div
      style={{
        width: 1575, 
        margin: '8px auto 0', 
        padding: 12,
        background: '#fff8e1', 
        color: '#5b4700', 
        border: '1px solid #d6b548',
        fontWeight: 800, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        flexWrap: 'wrap'
      }}
    >
      {text}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={onYes} style={{ border: '1px solid #111', background: '#ffd54f', fontWeight: 800, padding: '10px 16px', cursor: 'pointer' }}>Overwrite</button>
        <button onClick={onNo} style={{ border: '1px solid #111', background: '#e0e0e0', fontWeight: 800, padding: '10px 16px', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
