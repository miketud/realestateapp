import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Box, Title, Table, Loader, Center, Button,
} from '@mantine/core';
import { getProperty, updatePropertyField } from '../api/properties';
import RentRollTable from './RentRollTable';
import TransactionLog, { type TransactionRow } from './TransactionLog';
import PurchaseDetailsTable from './PurchaseDetailsTable';
import PaymentTable from './PaymentTable';

// --- Grid / sizing ---
const COL_WIDTH = 175;
const FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = COL_WIDTH * MAX_COLS;
const LABEL_BORDER = 4;

// Standard app width (match grid so header aligns perfectly)
const APP_WIDTH = TABLE_WIDTH; // 1575px

// --- API base ---
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:3000';
const API = `${API_BASE}/api`;

// --- Visual primitives ---
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

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

const cellBase: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: '#fff',
  fontSize: FONT_SIZE,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
const headerBase: React.CSSProperties = {
  ...cellBase,
  background: '#000000ff',
  color: '#ffffffff',
  fontWeight: 700,
  textTransform: 'uppercase',
};
const cellSingleUnit: React.CSSProperties = {
  ...cellBase,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
};
const headerSingleUnit: React.CSSProperties = {
  ...headerBase,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
};

const STATUS_COLORS: Record<string, string> = {
  Vacant: '#c72727ff',
  Pending: '#ff9544ff',
  Leased: '#3e9c57ff',
  Subleased: '#3e9c57ff',
  Financed: '#3e9c57ff',
};

type Property = {
  property_id: number;
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
  city?: string;
  state?: string;
  zipcode?: number | null;
  county?: string;
  purchase_price?: number;
  year?: number | null;
  market_value?: number | null;
  income_producing?: 'YES' | 'NO';
  financing_type?: string;
};

type PropertyViewProps = {
  property_id: number;
  onBack: () => void;
  refreshProperties: () => void;
};

const REQUIRED_FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;

/* === Contact search + pin (cards) === */
type Contact = {
  contact_id: number;
  name: string;
  phone: string;
  email?: string;
  contact_type?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
};

function ContactSearchPins({ property_id, width }: { property_id: number; width: number }) {
  const TABLE_BORDER = 2;
  const INPUT_BORDER = 2;
  const NUDGE = 2;
  const inputOuterWidth = Math.max(0, width - (TABLE_BORDER - INPUT_BORDER) - NUDGE);

  const PIN_KEY = (pid: number) => `property_contact_pins_${pid}`;

  const toDigits = (v: string) => (v || '').replace(/\D/g, '');
  const clamp10 = (d: string) => d.slice(0, 10);
  const fmtUSPhoneFull = (digits: string) => {
    const d = clamp10(toDigits(digits));
    if (d.length !== 10) return d;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);

  const [pinnedIds, setPinnedIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(PIN_KEY(property_id));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const [allCache, setAllCache] = useState<Record<number, Contact>>({});

  useEffect(() => {
    localStorage.setItem(PIN_KEY(property_id), JSON.stringify(pinnedIds));
  }, [pinnedIds, property_id]);

  const refreshPinned = useCallback(async () => {
    if (!pinnedIds.length) return;
    try {
      const fetched = await Promise.allSettled(
        pinnedIds.map((id) => fetch(`${API}/contacts/${id}`).then((r) => r.json()))
      );
      setAllCache((prev) => {
        const next = { ...prev };
        for (const res of fetched) {
          if (res.status === 'fulfilled' && res.value?.contact_id) {
            next[res.value.contact_id] = res.value as Contact;
          }
        }
        return next;
      });
    } catch { /* ignore */ }
  }, [pinnedIds]);

  useEffect(() => { refreshPinned(); }, [refreshPinned]);

  useEffect(() => {
    const onFocus = () => refreshPinned();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshPinned]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/contacts`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setResults(arr);
      setOpen(true);
      setAllCache((prev) => {
        const next = { ...prev };
        arr.forEach((c: Contact) => (next[c.contact_id] = c));
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuery = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/contacts?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setResults(arr);
      setOpen(true);
      setAllCache((prev) => {
        const next = { ...prev };
        arr.forEach((c: Contact) => (next[c.contact_id] = c));
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) return;
    debounceRef.current = window.setTimeout(() => {
      fetchQuery(q);
    }, 180);
    return () => window.clearTimeout(debounceRef.current);
  }, [query, fetchQuery]);

  const pinnedContacts = useMemo(
    () => pinnedIds.map((id) => allCache[id]).filter(Boolean) as Contact[],
    [pinnedIds, allCache]
  );

  const selectContact = (c: Contact) => {
    setPinnedIds((prev) => (prev.includes(c.contact_id) ? prev : [...prev, c.contact_id]));
    setQuery('');
    setOpen(false);
    setHoverIdx(-1);
    setAllCache((prev) => ({ ...prev, [c.contact_id]: c }));
  };
  const removePinned = (id: number) => {
    setPinnedIds((prev) => prev.filter((x) => x !== id));
  };

  const openList = () => {
    if (query.trim()) fetchQuery(query.trim());
    else fetchAll();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = hoverIdx >= 0 ? hoverIdx : 0;
      selectContact(results[idx]);
    }
  };

  const outerWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!outerWrapRef.current) return;
      if (!outerWrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const outerWrap: React.CSSProperties = { width, marginTop: 12, position: 'relative' };
  const inputWrap: React.CSSProperties = { width: inputOuterWidth, position: 'relative' };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '2px solid #111',
    borderRadius: 0,
    padding: '10px 12px',
    fontSize: 16,
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  };
  const listStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    width: '100%',
    maxHeight: 320,
    overflowY: 'auto',
    background: '#fff',
    border: '2px solid #111',
    zIndex: 50,
    boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
  };
  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid #ddd',
    cursor: 'pointer',
    background: active ? '#eef5ff' : '#fff',
    fontSize: 14,
    alignItems: 'center',
  });
  const pinGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 12,
    marginTop: 12,
    width,
  };
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    border: '2px solid #111',
    background: '#ffffff',
    padding: '12px 14px',
    borderRadius: 8,
    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
    boxSizing: 'border-box',
  };
  const removeBtn: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    background: '#fff',
    border: '2px solid #111',
    borderRadius: 999,
    lineHeight: 0,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  };

  return (
    <div ref={outerWrapRef} style={outerWrap}>
      <div style={{ fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>CONTACT</div>

      <div style={inputWrap}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openList}
          onClick={openList}
          onKeyDown={onKeyDown}
          placeholder="Search & pin a contact (name, phone, email, type)…"
          style={inputStyle}
        />
        {open && results.length > 0 && (
          <div style={listStyle}>
            {loading && <div style={{ padding: 10, fontSize: 14, color: '#666' }}>Loading…</div>}
            {results.map((c, i) => (
              <div
                key={c.contact_id}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); selectContact(c); }}
                style={rowStyle(i === hoverIdx)}
                title="Click to pin"
              >
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || '—'}</div>
                <div>{c.phone ? fmtUSPhoneFull(c.phone) : '—'}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email || '—'}</div>
                <div style={{ color: '#444' }}>{c.contact_type || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={pinGrid}>
        {pinnedContacts.map((c) => (
          <div key={c.contact_id} style={cardStyle}>
            <button
              aria-label="Remove pinned contact"
              title="Remove"
              onClick={() => removePinned(c.contact_id)}
              style={removeBtn}
            >
              <span style={{ fontSize: 16, fontWeight: 900, marginTop: -2 }}>×</span>
            </button>

            <div style={{ fontWeight: 900, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.name || '—'}
            </div>
            <div style={{ fontSize: 13, color: '#444', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.phone ? fmtUSPhoneFull(c.phone) : '—'}
              {c.email ? <> · {c.email}</> : null}
              {c.contact_type ? <> · {c.contact_type}</> : null}
            </div>
            {c.notes ? (
              <div style={{ marginTop: 6, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.notes}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* === OwnerAutocompleteSimple (local text; commit on Enter/click only) === */
function OwnerAutocompleteSimple({
  initialValue,
  suggestions,
  onCommit,
  placeholder = 'Owner',
}: {
  initialValue: string;
  suggestions: string[];
  onCommit: (text: string) => void;
  placeholder?: string;
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
        // IMPORTANT: no onBlur commit here
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
            <button
              key={name + idx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(name)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid #eee',
                background: idx === active ? '#f5f7ff' : '#fff',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ============================================
   Property View
   ============================================ */

export default function PropertyView({ property_id, onBack, refreshProperties }: PropertyViewProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const [editingKey, setEditingKey] = useState<keyof Property | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveError, setShowSaveError] = useState(false);
  const saveErrorTimers = useRef<number[]>([]);

  // separate saving flag for the toggle
  const [togglingIncome, setTogglingIncome] = useState(false);

  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.text())))
      .then((data: any[]) => {
        const names = Array.isArray(data) ? data.map((c: any) => String(c.name || '')).filter(Boolean) : [];
        const uniq: string[] = [];
        for (const n of names) if (!uniq.includes(n)) uniq.push(n);
        setContactNames(uniq);
      })
      .catch(() => void 0);
  }, []);

  // Load transactions
  useEffect(() => {
    if (!property_id) return;
    fetch(`${API}/transactions?property_id=${property_id}`)
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
        else setTransactions([]);
      })
      .catch(() => setTransactions([]));
  }, [property_id]);

  // Load property
  useEffect(() => {
    setLoading(true);
    setError(null);
    getProperty(property_id)
      .then((data: any) => {
        if (!data || data.error) {
          setProperty(null);
          setError('Property not found.');
        } else {
          setProperty({
            ...data,
            zipcode: data.zipcode !== undefined && data.zipcode !== null && data.zipcode !== ''
              ? Number(data.zipcode) : null,
            year: data.year !== undefined && data.year !== null && data.year !== ''
              ? Number(data.year) : null,
            market_value: data.market_value !== undefined && data.market_value !== null && data.market_value !== ''
              ? Number(data.market_value) : null,
          });
          setError(null);
        }
      })
      .catch(() => {
        setProperty(null);
        setError('Failed to load property.');
      })
      .finally(() => setLoading(false));
  }, [property_id]);

  function handleCellClick(key: keyof Property) {
    if (!loading && property) {
      setEditingKey(key);
      setSaveError(null);
      setEditValue(
        property[key] !== undefined && property[key] !== null
          ? String(property[key])
          : ''
      );
    }
  }

  useEffect(() => {
    // clear any previous timers whenever the message changes or unmounts
    saveErrorTimers.current.forEach(t => window.clearTimeout(t));
    saveErrorTimers.current = [];

    if (saveError) {
      setShowSaveError(true); // fade in immediately
      // after 5s, start fade out
      const t1 = window.setTimeout(() => setShowSaveError(false), 5000);
      // after fade-out (300ms), remove message
      const t2 = window.setTimeout(() => setSaveError(null), 5300);
      saveErrorTimers.current.push(t1, t2);
    }

    return () => {
      saveErrorTimers.current.forEach(t => window.clearTimeout(t));
      saveErrorTimers.current = [];
    };
  }, [saveError]);

  const dismissSaveError = () => {
    // stop any running timers
    saveErrorTimers.current.forEach(t => window.clearTimeout(t));
    saveErrorTimers.current = [];
    // fade out, then clear
    setShowSaveError(false);
    const t = window.setTimeout(() => setSaveError(null), 300);
    saveErrorTimers.current.push(t);
  };

  async function handleSave(key: keyof Property, customValue?: any) {
    if (!property) return;

    let value = customValue !== undefined ? customValue : editValue;

    if (REQUIRED_FIELDS.includes(key as any) && (!String(value).trim() || String(value).trim() === '')) {
      setSaveError(`${key} cannot be empty.`);
      return;
    }

    setSaving(true);
    try {
      if (key === 'zipcode' || key === 'year' || key === 'market_value') {
        value = String(value).trim() === '' ? null : Number(value);
        if (value !== null && isNaN(value)) {
          setSaveError('Please enter a valid number.');
          setSaving(false);
          return;
        }
      }

      // Save the edited field
      await updatePropertyField(property.property_id, key, value);
      setProperty(prev => (prev ? { ...prev, [key]: value } : prev));
      setSaveError(null);

      // ====== Income-producing rules triggered by Status ======
      if (key === 'status') {
        const v = String(value || '').toLowerCase();
        // Vacant & Pending => NO; Leased/Subleased/Financed => YES
        let nextIncome: 'YES' | 'NO' | null = null;
        if (v === 'vacant' || v === 'pending') nextIncome = 'NO';
        else if (v === 'leased' || v === 'subleased' || v === 'financed') nextIncome = 'YES';

        if (nextIncome) {
          try {
            await updatePropertyField(property.property_id, 'income_producing' as keyof Property, nextIncome);
            setProperty(prev => (prev ? { ...prev, income_producing: nextIncome! } : prev));
          } catch {
            setSaveError(`Status saved. Failed to set Income-Producing to ${nextIncome}.`);
          }
        }
      }
      // =======================================================
    } catch {
      setSaveError('Update failed. Please try again.');
    }
    setEditingKey(null);
    setSaving(false);
  }

  function handleBack() {
    onBack();
    refreshProperties();
  }

  // --- Income-Producing toggle (manual override button)
  const isIncomeYes = property?.income_producing === 'YES';

  const toggleIncomeProducing = async () => {
    if (!property || togglingIncome) return;
    const nextVal: 'YES' | 'NO' = isIncomeYes ? 'NO' : 'YES';

    // optimistic UI
    setTogglingIncome(true);
    setProperty(prev => (prev ? { ...prev, income_producing: nextVal } : prev));

    try {
      await updatePropertyField(property.property_id, 'income_producing' as keyof Property, nextVal);
      setSaveError(null);
    } catch {
      // revert on failure
      setProperty(prev => (prev ? { ...prev, income_producing: isIncomeYes ? 'YES' : 'NO' } : prev));
      setSaveError('Failed to update Income-Producing status. Please try again.');
    } finally {
      setTogglingIncome(false);
    }
  };

  function HeaderCell({ label, units = 1, blackout = false }: { label?: string; units?: number; blackout?: boolean }) {
    const style = units === 1
      ? (blackout ? { ...headerSingleUnit, background: '#000', color: '#000' } : headerSingleUnit)
      : (blackout ? { ...headerBase, background: '#000', color: '#000' } : headerBase);

    return (
      <th colSpan={units} style={style}>
        {label ?? ''}
      </th>
    );
  }

  function ValueCell({ k, units = 1, type }: { k: keyof Property; units?: number; type?: 'number' | 'text' }) {
    const val = property?.[k];
    const isRequired = REQUIRED_FIELDS.includes(k as any);
    const tdBase = units === 1 ? cellSingleUnit : cellBase;
    const isEditing = editingKey === k;

    // Special editors
    if (k === 'type' && isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <select
            value={editValue ?? ''}
            style={{ ...inputCellStyle, textAlign: 'center' }}
            autoFocus
            disabled={saving}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
          >
            <option value="">—</option>
            <option value="Commercial">Commercial</option>
            <option value="Residential">Residential</option>
            <option value="Land">Land</option>
          </select>
        </td>
      );
    }
    if (k === 'owner' && isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <OwnerAutocompleteSimple
            initialValue={editValue}
            suggestions={contactNames}
            onCommit={(finalText) => {
              setEditValue(finalText);
              handleSave(k, finalText);
            }}
            placeholder="Owner"
          />
        </td>
      );
    }

    if (k === 'status' && isEditing) {
      const statusOptions = ['Vacant', 'Pending', 'Leased', 'Subleased', 'Financed'];
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <select
            value={editValue ?? ''}
            style={{ ...inputCellStyle, textAlign: 'center' }}
            autoFocus
            disabled={saving}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
          >
            <option value="">—</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (k === 'year' && isEditing) {
      const yearVal = editValue || String(new Date().getFullYear());
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <input
            type="number"
            value={yearVal}
            style={inputCellStyle}
            autoFocus
            disabled={saving}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
          />
        </td>
      );
    }

    if (k === 'zipcode' && isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <input
            type="text"
            value={editValue ?? ''}
            style={inputCellStyle}
            autoFocus
            disabled={saving}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 5);
              setEditValue(val);
            }}
            onBlur={async () => {
              if (editValue.length === 5) {
                await handleSave(k);

                // best-effort ZIP->City/State lookup
                try {
                  const res = await fetch(`https://api.zippopotam.us/us/${editValue}`);
                  if (res.ok) {
                    const data = await res.json();
                    const place = data.places?.[0];
                    if (place) {
                      const cityName = place['place name'];
                      const stateAbbr = place['state abbreviation'];

                      await handleSave('city' as keyof Property, cityName);
                      setProperty(prev => prev ? { ...prev, city: cityName } : prev);

                      await handleSave('state' as keyof Property, stateAbbr);
                      setProperty(prev => prev ? { ...prev, state: stateAbbr } : prev);
                    }
                  }
                } catch (err) {
                  console.error('ZIP lookup failed:', err);
                }
              } else {
                setSaveError('Zip code must be exactly 5 digits.');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (editValue.length === 5) {
                  e.currentTarget.blur();
                } else {
                  setSaveError('Zip code must be exactly 5 digits.');
                }
              }
              if (e.key === 'Escape') setEditingKey(null);
            }}
          />
        </td>
      );
    }

    if (k === 'state' && isEditing) {
      const states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
        "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA",
        "WA", "WV", "WI", "WY"
      ];
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <select
            value={editValue ?? ''}
            style={{ ...inputCellStyle, textAlign: 'center' }}
            autoFocus
            disabled={saving}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
          >
            <option value="">—</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </td>
      );
    }

    // Generic editor
    if (isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <input
            autoFocus
            style={inputCellStyle}
            value={editValue}
            type={type === 'number' ? 'number' : 'text'}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
            disabled={saving}
          />
        </td>
      );
    }

    // Read-only cell (click to edit). Colorize Status via STATUS_COLORS.
    const statusBg =
      k === 'status' && typeof val === 'string'
        ? (STATUS_COLORS[val] || undefined)
        : undefined;

    return (
      <td
        colSpan={units}
        style={{ ...tdBase, cursor: 'pointer', ...(statusBg ? { background: statusBg } : null) }}
        onClick={() => handleCellClick(k)}
      >
        {val !== undefined && val !== null && val !== ''
          ? (k === 'market_value' ? `$${Number(val).toLocaleString()}` : String(val))
          : isRequired
            ? ''
            : <span style={{ color: '#bbb' }}>—</span>}
      </td>
    );
  }

  function BlackCell() {
    return <td style={{ ...cellSingleUnit, background: '#000', color: '#000', cursor: 'default' }} />;
  }

  return (
    <Box style={{ background: '#ffffffff', minHeight: '100vh', fontFamily: 'system-ui, Arial, Helvetica, sans-serif', padding: 0 }}>
      {/* ===== Sticky Property Name Header ===== */}
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: APP_WIDTH,
          margin: '12px auto 20px',
          padding: '40px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#384758ff',
          border: '4px solid #111',
          borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
        }}
      >
        <Button
          onClick={() => { onBack(); refreshProperties(); }}
          title="Back to Dashboard"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            border: '2px solid #111',
            borderRadius: 0,
            background: '#fff',
            color: '#111',
            fontWeight: 800,
            fontSize: 20,
            padding: '8px 14px',
            textTransform: 'uppercase',
            letterSpacing: 1,
            boxShadow: 'none',
            lineHeight: 1,
          }}
        >
          DASHBOARD
        </Button>

        {property && (
          <Button
            onClick={toggleIncomeProducing}
            disabled={togglingIncome}
            title="Toggle income-producing status"
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              border: '2px solid #111',
              borderRadius: 0,
              background: (property?.income_producing === 'YES') ? '#3e9c57ff' : '#c72727ff',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 20,
              padding: '8px 14px',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              boxShadow: 'none',
              transition: 'background 160ms ease',
            }}
          >
            {togglingIncome ? 'SAVING…' : (property?.income_producing === 'YES' ? 'INCOME-PRODUCING: YES' : 'INCOME-PRODUCING: NO')}
          </Button>
        )}

        <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: 1, color: '#ffffffff', lineHeight: 1.2, textTransform: 'uppercase' }}>
          {property?.property_name || 'Property'}
        </div>
      </Box>

      {/* ===== Centered page container aligned to header width ===== */}
      <Box style={{ width: APP_WIDTH, margin: '0 auto 40px' }}>
        {/* Error banner */}
        {saveError !== null && (
          <div
            role="alert"
            style={{
              width: '100%',
              marginBottom: 16,
              padding: '10px 18px',
              background: '#ffeded',
              color: '#a13d3d',
              border: '1.5px solid #e57e7e',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: 0.5,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: showSaveError ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          >
            <span style={{ paddingRight: 12 }}>{saveError}</span>
            <button
              aria-label="Dismiss error"
              onClick={dismissSaveError}
              style={{
                marginLeft: 12,
                flex: '0 0 auto',
                border: '2px solid #a13d3d',
                background: '#fff',
                color: '#a13d3d',
                fontWeight: 900,
                fontSize: 16,
                lineHeight: 1,
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <Center style={{ minHeight: '60vh' }}>
            <Loader size="xl" />
          </Center>
        ) : error ? (
          <Box p={40}>
            <Title order={3} style={{ color: 'red' }}>{error}</Title>
          </Box>
        ) : property ? (
          <>
            {/* -------- OVERVIEW LABEL BOX (attached on top of table) -------- */}
            <Box
              style={{
                width: TABLE_WIDTH,
                boxSizing: 'border-box',
                margin: '0 auto 0',
                padding: '12px 16px',
                background: '#b6b6b6ff',
                border: `${LABEL_BORDER}px solid #000`,
                borderBottom: 'none',
                textAlign: 'center',
                fontWeight: 900,
                fontSize: 40,
                letterSpacing: 1,
              }}
            >
              OVERVIEW
            </Box>

            {/* -------- OVERVIEW TABLE -------- */}
            <Box style={{ width: '100%', marginBottom: 12 }}>
              <Table
                striped
                highlightOnHover
                withColumnBorders
                style={{
                  fontSize: FONT_SIZE,
                  borderCollapse: 'collapse',
                  border: `${LABEL_BORDER}px solid #000`,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
                  background: '#fff',
                  width: TABLE_WIDTH,
                  textAlign: 'center',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  {Array.from({ length: MAX_COLS }).map((_, i) => (
                    <col key={i} style={{ width: COL_WIDTH }} />
                  ))}
                </colgroup>

                <tbody>
                  {/* Row 1 headers */}
                  <tr>
                    <HeaderCell label="Property Name" units={2} />
                    <HeaderCell label="Address" units={3} />
                    <HeaderCell label="City" />
                    <HeaderCell label="State" />
                    <HeaderCell label="Zip Code" />
                    <HeaderCell label="County" />
                  </tr>

                  {/* Row 1 values */}
                  <tr>
                    <ValueCell k="property_name" units={2} />
                    <ValueCell k="address" units={3} />
                    <ValueCell k="city" />
                    <ValueCell k="state" />
                    <ValueCell k="zipcode" />
                    <ValueCell k="county" />
                  </tr>

                  {/* Row 2 headers */}
                  <tr>
                    <HeaderCell label="Owner" units={2} />
                    <HeaderCell label="Year" />
                    <HeaderCell label="Type" />
                    <HeaderCell label="Status" />
                    <HeaderCell label="Current Market Value" />
                    <HeaderCell blackout />
                    <HeaderCell blackout />
                    <HeaderCell blackout />
                  </tr>

                  {/* Row 2 values */}
                  <tr>
                    <ValueCell k="owner" units={2} />
                    <ValueCell k="year" type="number" />
                    <ValueCell k="type" />
                    {/* Status cell colorized via STATUS_COLORS */}
                    <ValueCell k="status" />
                    <ValueCell k="market_value" type="number" />
                    <BlackCell />
                    <BlackCell />
                    <BlackCell />
                  </tr>
                </tbody>
              </Table>
            </Box>

            {/* === CONTACT CARDS === */}
            <ContactSearchPins property_id={property.property_id} width={APP_WIDTH} />

            <PurchaseDetailsTable property_id={property.property_id} />

            {/* --- PAYMENTS / RENT LOG (conditional) --- */}
            {(property.income_producing === 'YES') && (property.status || '').toLowerCase() === 'financed' ? (
              <Box style={{ marginTop: 48 }}>
                <PaymentTable property_id={property.property_id} />
              </Box>
            ) : (property.income_producing === 'YES') ? (
              <Box style={{ marginTop: 48 }}>
                <RentRollTable property_id={property.property_id} />
              </Box>
            ) : null}

            {/* --- TRANSACTION LOG (always visible) --- */}
            <Box style={{ marginTop: 64 }}>
              <TransactionLog property_id={property.property_id} transactions={transactions} setTransactions={setTransactions} />
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
