// src/components/PropertyView.tsx
import { useEffect, useState, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Box, Title, Table, Loader, Center } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { getProperty, updatePropertyField } from '../api/properties';
import RentRollTable from './RentRollTable';
import TransactionLog, { type TransactionRow } from './TransactionLog';
import PurchaseDetailsTable from './PurchaseDetailsTable';
import PaymentTable from './PaymentTable';
import BannerMessage from './BannerMessage';
import { IconButton, Icon } from './ui/Icons';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';
import Tenant from './Tenant';

/* sizing */
const COL_WIDTH = 175;
const MAX_COLS = 9;
const TABLE_WIDTH = COL_WIDTH * MAX_COLS; // 1575
const CONTAINER_WIDTH = 1575;
const FONT_SIZE = 20;
const HEADER_FONT_SIZE = 16;
const ROW_H = 52;
const HEADER_H = ROW_H;

/* visuals */
const DIVIDER = '1px solid rgba(0,0,0,0.18)';
const HEADER_RULE = '2px solid rgba(0,0,0,0.25)';
const EMPTY_BG = 'rgba(0,0,0,0.06)';
const HILITE_BG = 'rgba(0, 102, 255, 0.10)';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

/* table cells */
const cellBase: React.CSSProperties = {
  border: 'none',
  borderRight: DIVIDER,
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: 'transparent',
  fontSize: FONT_SIZE,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  height: ROW_H,
  verticalAlign: 'middle',
};

const headerBase: React.CSSProperties = {
  border: 'none',
  borderRight: 'none',
  borderBottom: HEADER_RULE,
  padding: '6px 8px', // allow up to two lines
  background: 'transparent',
  color: '#2b2b2b',
  fontWeight: 800,
  fontSize: HEADER_FONT_SIZE,
  textTransform: 'uppercase',
  textAlign: 'center',
  height: HEADER_H,
  lineHeight: '18px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflow: 'hidden',
  verticalAlign: 'middle',
};

/* fixed-width variants */
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

const inputCellStyle: React.CSSProperties = {
  width: '100%',
  fontSize: FONT_SIZE,
  fontFamily: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  border: 'none',
  background: 'transparent',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
};

/* enums */
const TYPE_OPTIONS = ['Commercial', 'Residential', 'Land'] as const;
const STATUS_OPTIONS = ['Vacant', 'Pending', 'Leased', 'Subleased', 'Financed'] as const;

/* types */
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
  onBack?: () => void;
  refreshProperties?: () => void;
};

const REQUIRED_FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;

/* ---------------- Contacts inline rows (embedded search + results in-row) ---------------- */
type Contact = {
  contact_id: number;
  name: string;
  phone: string;
  email?: string;
  contact_type?: string;
  notes?: string;
};

// requires: import { AnimatePresence, motion } from 'framer-motion'
function ContactInlineRows({ property_id, colSpan }: { property_id: number; colSpan: number }) {
  const CARD_BG = '#f5f7f8';
  const PIN_KEY = (pid: number) => `property_contact_pins_${pid}`;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cache, setCache] = useState<Record<number, Contact>>({});
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(PIN_KEY(property_id));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(PIN_KEY(property_id), JSON.stringify(pinnedIds));
  }, [pinnedIds, property_id]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/contacts');
        const data = await r.json();
        const arr: Contact[] = Array.isArray(data) ? data : [];
        arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        setContacts(arr);
        setCache(Object.fromEntries(arr.map(c => [c.contact_id, c])));
      } catch { setContacts([]); }
    })();
  }, []);

  const pinnedContacts = useMemo(
    () => pinnedIds.map(id => cache[id]).filter(Boolean) as Contact[],
    [pinnedIds, cache]
  );

  const toDigits = (v: string) => (v || '').replace(/\D/g, '');
  const fmtUSPhoneFull = (digits: string) => {
    const d = toDigits(digits).slice(0, 10);
    return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (digits || '—');
  };

  const attachById = (val: string) => {
    const id = Number(val);
    if (!id || Number.isNaN(id) || pinnedIds.includes(id)) return;
    setPinnedIds(p => [...p, id]);
  };
  const removePinned = (id: number) => setPinnedIds(p => p.filter(x => x !== id));

  // combobox
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hover, setHover] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const ignoreNextFocusRef = useRef(false);

  const focusInputSoon = () => setTimeout(() => inputRef.current?.focus(), 0);

  const resetAndFocusOpen = () => {
    q && setQ('');
    setHover(-1);
    setOpen(true);
    focusInputSoon();
  };

  const resetAndFocusClosed = () => {
    q && setQ('');
    setHover(-1);
    setOpen(false);
    ignoreNextFocusRef.current = true;
    setTimeout(() => {
      inputRef.current?.focus();
      requestAnimationFrame(() => { ignoreNextFocusRef.current = false; });
    }, 0);
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      if (!box.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return contacts;
    return contacts.filter(c =>
      [c.name, c.phone, c.email, c.contact_type]
        .map(v => String(v || '').toLowerCase())
        .some(s => s.includes(t))
    );
  }, [q, contacts]);

  return (
    <>
      {/* Search row */}
      <tr>
        <td colSpan={colSpan} style={{ ...cellBase, padding: 0, borderRight: 'none', background: 'transparent' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', alignItems: 'stretch', borderBottom: DIVIDER }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: ROW_H, borderRight: DIVIDER, color: '#fff', background: '#000' }}
              title="Contacts"
              aria-label="Contacts"
            >
              <Icon name="contact" size={20} />
            </div>

            <div ref={boxRef} style={{ padding: '0 8px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', minHeight: ROW_H }}>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); if (!open) setOpen(true); }}
                  onFocus={() => { if (!ignoreNextFocusRef.current) setOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); resetAndFocusClosed(); return; }
                    if (!filtered.length) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setHover(i => (i + 1) % filtered.length); }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setHover(i => (i - 1 + filtered.length) % filtered.length); }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const idx = hover >= 0 ? hover : 0;
                      const id = filtered[idx]?.contact_id;
                      if (id) { attachById(String(id)); resetAndFocusOpen(); }
                    }
                  }}
                  placeholder="Search & attach a contact (name, phone, email, type)…"
                  style={{ width: '100%', height: ROW_H, border: 'none', outline: 'none', padding: '0 12px', fontSize: 16, background: 'transparent' }}
                  aria-label="Search contacts"
                />
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ overflow: 'hidden', border: DIVIDER, boxShadow: '0 12px 24px rgba(0,0,0,0.18)', background: '#fff', marginBottom: 8 }}
                    onMouseDown={(e) => e.preventDefault()} // keep focus on input
                  >
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {filtered.length === 0 ? (
                        <div style={{ padding: 10, color: '#666', fontSize: 14 }}>No matches</div>
                      ) : (
                        filtered.slice(0, 200).map((c, i) => {
                          const d = toDigits(c.phone || '');
                          const phoneFmt = d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (c.phone || '');
                          const meta = [phoneFmt, c.email, c.contact_type].filter(Boolean).join(' · ');
                          const active = i === hover;
                          return (
                            <div
                              key={c.contact_id}
                              onMouseEnter={() => setHover(i)}
                              onClick={() => { attachById(String(c.contact_id)); resetAndFocusOpen(); }}
                              style={{
                                padding: '10px 12px',
                                borderTop: DIVIDER,
                                background: active ? '#eef1f3' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                gap: 8,
                                alignItems: 'baseline',
                                fontSize: 14,
                              }}
                            >
                              <strong style={{ fontSize: 15, color: '#111' }}>{c.name || '—'}</strong>
                              {meta ? <span style={{ color: '#555' }}>· {meta}</span> : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </td>
      </tr>

      {/* pinned contacts */}
      {pinnedContacts.map((c) => (
        <tr key={c.contact_id}>
          <td colSpan={colSpan} style={{ ...cellBase, padding: 0, borderRight: 'none', background: 'transparent' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', alignItems: 'stretch', minHeight: ROW_H, borderBottom: DIVIDER }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: DIVIDER, background: '#eef1f3' }}
                title="Remove contact"
                aria-label="Remove contact"
              >
                <IconButton icon="remove_user" label="Remove contact" onClick={() => removePinned(c.contact_id)} boxSize={28} iconSize={20} />
              </div>
              <div style={{ background: CARD_BG }}>
                <div style={{ minHeight: ROW_H, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px' }}>
                  <strong style={{ fontSize: 20 }}>{c.name || '—'}</strong>
                  <span>· {fmtUSPhoneFull(c.phone || '')}</span>
                  {c.email ? <span>· {c.email}</span> : null}
                  {c.contact_type ? <span>· {c.contact_type}</span> : null}
                  {c.notes ? <span style={{ color: '#444' }}> · {c.notes}</span> : null}
                </div>
              </div>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
/* ============================================ */

export default function PropertyView({ property_id }: PropertyViewProps) {
  const [currentId, setCurrentId] = useState<number>(property_id);
  useEffect(() => setCurrentId(property_id), [property_id]);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const [editingKey, setEditingKey] = useState<keyof Property | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [overviewOpen, setOverviewOpen] = useState(true);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pm:map-open'));
  }, []);

  /* Property switcher state (dropdown panel aligned to header row, full TABLE_WIDTH) */
  type PropLite = { property_id: number; property_name: string; address?: string };
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [allProps, setAllProps] = useState<PropLite[]>([]);
  const [nameResults, setNameResults] = useState<PropLite[]>([]);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const innerPanelRef = useRef<HTMLDivElement | null>(null);
const [panelH, setPanelH] = useState(0);
useLayoutEffect(() => {
  if (!nameSearchOpen) return;
  const el = innerPanelRef.current;
  if (!el) return;
  // measure full content height
  setPanelH(el.scrollHeight);
}, [nameSearchOpen, nameResults, nameLoading, nameQuery]);

  const openNameSearch = useCallback(async () => {
    setNameSearchOpen(true);
    setNameQuery('');
    setHoverIdx(-1);
    setNameLoading(true);
    try {
      const r = await fetch(`/api/properties`);
      const data = await r.json();
      const arr: PropLite[] = (Array.isArray(data) ? data : [])
        .map((p: any) => ({ property_id: Number(p.property_id), property_name: String(p.property_name || ''), address: p.address }))
        .filter((p: PropLite) => p.property_name)
        .sort((a, b) => a.property_name.localeCompare(b.property_name, undefined, { sensitivity: 'base' }));
      setAllProps(arr);
      setNameResults(arr.slice(0, 30));
    } catch {
      setAllProps([]);
      setNameResults([]);
    } finally {
      setNameLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    if (!nameSearchOpen) return;
    const q = nameQuery.trim().toLowerCase();
    const filtered = !q ? allProps : allProps.filter((p) => p.property_name.toLowerCase().includes(q));
    setNameResults(filtered.slice(0, 30));
  }, [nameQuery, nameSearchOpen, allProps]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!nameSearchOpen) return;
      const n = e.target as Node;
      const panel = document.getElementById('prop-switcher-panel');
      const trigger = document.getElementById('prop-switcher-trigger');
      if (panel && panel.contains(n)) return;
      if (trigger && trigger.contains(n)) return;
      setNameSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [nameSearchOpen]);

  const commitSwitch = (pid: number | undefined | null) => {
    if (!pid || Number.isNaN(pid)) { setNameSearchOpen(false); return; }
    if (pid === currentId) { setNameSearchOpen(false); return; }

    setNameSearchOpen(false);
    setProperty(null);
    setLoading(true);
    setError(null);
    setCurrentId(pid);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('property_id', String(pid));
      window.history.pushState({}, '', url);
    } catch { }
  };

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setNameSearchOpen(false); return; }
    if (!nameResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => (i + 1) % nameResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + nameResults.length) % nameResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = hoverIdx >= 0 ? hoverIdx : 0;
      commitSwitch(nameResults[idx]?.property_id);
    }
  };

  /* owner dropdown options */
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

  useEffect(() => {
    if (!currentId) return;
    fetch(`/api/transactions?property_id=${currentId}`)
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setTransactions(data) : setTransactions([])))
      .catch(() => setTransactions([]));
  }, [currentId]);

  useEffect(() => {
    if (!currentId) return;
    setLoading(true);
    setError(null);
    getProperty(currentId)
      .then((data: any) => {
        if (!data || data.error) {
          setProperty(null);
          setError('Property not found.');
        } else {
          setProperty({
            ...data,
            zipcode: data.zipcode !== undefined && data.zipcode !== null && data.zipcode !== '' ? Number(data.zipcode) : null,
            year: data.year !== undefined && data.year !== null && data.year !== '' ? Number(data.year) : null,
            market_value: data.market_value !== undefined && data.market_value !== null && data.market_value !== '' ? Number(data.market_value) : null,
          });
          setError(null);
        }
      })
      .catch(() => {
        setProperty(null);
        setError('Failed to load property.');
      })
      .finally(() => setLoading(false));
  }, [currentId]);

  useEffect(() => {
    if (!property) return;
    window.dispatchEvent(
      new CustomEvent('pm:focus', {
        detail: {
          id: property.property_id,
          address: property.address,
          city: property.city ?? '',
          state: property.state ?? '',
          zipcode: property.zipcode ?? '',
          zoom: 16,
        },
      }),
    );
  }, [property]);

  function handleCellClick(key: keyof Property) {
    if (!loading && property) {
      setEditingKey(key);
      setSaveError(null);
      setEditValue(property[key] !== undefined && property[key] !== null ? String(property[key]) : '');
    }
  }

  async function lookupCityState(zip5: string): Promise<{ city: string; state: string } | null> {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip5}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data?.places?.[0];
      if (!place) return null;
      const city = String(place['place name'] || '').trim();
      const state = String(place['state abbreviation'] || '').trim().toUpperCase();
      if (city && state.length === 2) return { city, state };
    } catch { }
    return null;
  }

  async function handleSave(key: keyof Property, customValue?: any) {
    if (!property) return;
    let value = customValue !== undefined ? customValue : editValue;

    if ((['property_name', 'address', 'owner', 'type', 'status'] as const).includes(key as any) && !String(value).trim()) {
      setSaveError(`${key} cannot be empty.`);
      return;
    }

    setSaving(true);
    try {
      if (key === 'zipcode') {
        const digits = String(value ?? '').replace(/\D/g, '');
        if (digits.length !== 5) {
          setSaveError('ZIP code must be exactly 5 digits.');
          setSaving(false);
          setEditingKey(null);
          return;
        }
        value = Number(digits);
      } else if (key === 'year' || key === 'market_value') {
        value = String(value).trim() === '' ? null : Number(value);
        if (value !== null && isNaN(value)) {
          setSaveError('Please enter a valid number.');
          setSaving(false);
          setEditingKey(null);
          return;
        }
      }

      await updatePropertyField(property.property_id, key, value);
      setProperty((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaveError(null);

      if (key === 'zipcode') {
        const zip5 = String(value).padStart(5, '0');
        const res = await lookupCityState(zip5);
        if (res) {
          const updates: Partial<Property> = {};
          if ((property.city ?? '') !== res.city) {
            await updatePropertyField(property.property_id, 'city' as keyof Property, res.city);
            updates.city = res.city;
          }
          if ((property.state ?? '') !== res.state) {
            await updatePropertyField(property.property_id, 'state' as keyof Property, res.state);
            updates.state = res.state;
          }
          if (Object.keys(updates).length) setProperty((prev) => (prev ? { ...prev, ...updates } : prev));
        }
      }

      if (key === 'status') {
        const v = String(value || '').toLowerCase();
        let nextIncome: 'YES' | 'NO' | null = null;
        if (v === 'vacant' || v === 'pending') nextIncome = 'NO';
        else if (v === 'leased' || v === 'subleased' || v === 'financed') nextIncome = 'YES';
        if (nextIncome) {
          try {
            await updatePropertyField(property.property_id, 'income_producing' as keyof Property, nextIncome);
            setProperty((prev) => (prev ? { ...prev, income_producing: nextIncome! } : prev));
          } catch {
            setSaveError(`Status saved. Failed to set Income-Producing to ${nextIncome}.`);
          }
        }
      }
    } catch {
      setSaveError('Update failed. Please try again.');
    }
    setEditingKey(null);
    setSaving(false);
  }

  function HeaderCell({ label, units = 1 }: { label?: string; units?: number }) {
    const base = units === 1 ? headerSingleUnit : headerBase;
    return <th colSpan={units} style={base}>{label ?? ''}</th>;
  }

  function ValueCell({ k, units = 1, type }: { k: keyof Property; units?: number; type?: 'number' | 'text' }) {
    const val = property?.[k];
    const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(k as any);
    const tdBase = units === 1 ? cellSingleUnit : cellBase;
    const isEditing = editingKey === k;
    const isEmpty = val === undefined || val === null || val === '';

    if (k === 'type' && isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <UniversalDropdown
            value={editValue}
            placeholder="Type"
            options={[{ value: '', label: '—' }, ...TYPE_OPTIONS.map((t) => ({ value: t }))]}
            onChange={(val) => handleSave(k, val)}
            ariaLabel="Type"
            disabled={saving}
          />
        </td>
      );
    }
    if (k === 'owner' && isEditing) {
      const ownerOptions: DropdownOption[] = [{ value: '', label: '—' }, ...contactNames.map((n) => ({ value: n }))];
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <UniversalDropdown
            value={editValue}
            placeholder="Owner"
            options={ownerOptions}
            onChange={(val) => handleSave(k, val)}
            ariaLabel="Owner"
            searchable
          />
        </td>
      );
    }
    if (k === 'status' && isEditing) {
      return (
        <td colSpan={units} style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}>
          <UniversalDropdown
            value={editValue}
            placeholder="Status"
            options={[{ value: '', label: '—' }, ...STATUS_OPTIONS.map((s) => ({ value: s }))]}
            onChange={(val) => handleSave(k, val)}
            ariaLabel="Status"
            disabled={saving}
          />
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
              const v = e.target.value.replace(/\D/g, '').slice(0, 5);
              setEditValue(v);
            }}
            onBlur={async () => {
              if ((editValue || '').length === 5) {
                await handleSave(k);
                try {
                  const res = await lookupCityState(editValue);
                  if (res) {
                    if ((property?.city ?? '') !== res.city) await handleSave('city', res.city);
                    if ((property?.state ?? '') !== res.state) await handleSave('state', res.state);
                  }
                } catch { }
              } else {
                setSaveError('ZIP code must be exactly 5 digits.');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if ((editValue || '').length === 5) e.currentTarget.blur();
                else setSaveError('ZIP code must be exactly 5 digits.');
              }
              if (e.key === 'Escape') setEditingKey(null);
            }}
          />
        </td>
      );
    }
    if (k === 'state' && isEditing) {
      const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
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
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
      );
    }
    if (editingKey === k) {
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
    return (
      <td
        colSpan={units}
        style={{
          ...tdBase,
          cursor: 'pointer',
          background: !isRequired && isEmpty ? EMPTY_BG : 'transparent',
        }}
        onClick={() => handleCellClick(k)}
      >
        {isEmpty
          ? (isRequired ? '' : <span style={{ color: '#bbb' }}>—</span>)
          : k === 'market_value'
            ? `$${Number(val).toLocaleString()}`
            : String(val)}
      </td>
    );
  }

  function BlackCell() {
    return <td style={{ ...cellSingleUnit, background: 'transparent', borderRight: DIVIDER }} />;
  }

  const headerCircleColor = (() => {
    const s = (property?.status || '').toLowerCase();
    if (s === 'leased' || s === 'subleased' || s === 'financed') return '#16a34a';
    if (s === 'vacant' || s === 'pending') return '#ef4444';
    return null;
  })();
  const headerCircleLabel = (() => {
    const s = (property?.status || '').toLowerCase();
    if (s === 'leased' || s === 'subleased' || s === 'financed') return 'INCOME-PRODUCING';
    if (s === 'vacant' || s === 'pending') return 'NOT INCOME-PRODUCING';
    return null;
  })();

return (
  <Box style={{ background: '#fff', minHeight: '100vh' }}>
    <Box style={{ width: CONTAINER_WIDTH, margin: '0 auto 0' }}>
      {saveError !== null && (
        <BannerMessage message={saveError} type="error" autoCloseMs={5000} onDismiss={() => setSaveError(null)} />
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
          {/* HEADER BAR (click to open property switcher) */}
          <Box
            style={{
              width: TABLE_WIDTH,
              boxSizing: 'border-box',
              margin: '0 auto 0',
              padding: '12px 16px',
              background: '#111',
              color: '#ffffffff',
              border: 'none',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: 1,
              position: 'relative',
              lineHeight: 1.1,
            }}
          >
            <div
              aria-label="Property ID"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 40,
                minWidth: 100,
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e7eaf0',
                color: '#111',
                fontSize: 20,
                fontWeight: 700,
                borderRadius: 6,
                lineHeight: 1,
                border: DIVIDER,
                zIndex: 1,
              }}
            >
              ID {property.property_id}
            </div>

            {headerCircleColor && (
              <div
                aria-label={headerCircleLabel || 'Income-Producing state'}
                title={headerCircleLabel || ''}
                style={{
                  position: 'absolute',
                  left: 120,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 300,
                  height: 40,
                  borderRadius: 6,
                  background: headerCircleColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: 0.5,
                  userSelect: 'none',
                  lineHeight: 1,
                  zIndex: 1,
                }}
              >
                {headerCircleLabel}
              </div>
            )}

            <button
              onClick={() => setOverviewOpen((v) => !v)}
              aria-label={overviewOpen ? 'Hide overview' : 'Show overview'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                zIndex: 3,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 18,
                  height: 2,
                  background: '#111',
                  transform: `translate(-50%, -50%) rotate(${overviewOpen ? 60 : 0}deg)`,
                  transition: 'transform 200ms ease',
                }}
              />
            </button>

            <span
              id="prop-switcher-trigger"
              role="button"
              tabIndex={0}
              onClick={openNameSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openNameSearch();
                }
              }}
              style={{ cursor: 'text', userSelect: 'none' }}
              title="Click to switch property (Esc to cancel)"
            >
              {(property.property_name || 'Property').toUpperCase()}
            </span>
          </Box>

{/* One layout-animated stack for divider + panel + body */}
<motion.div layout transition={{ type: 'spring', stiffness: 420, damping: 38 }} style={{ width: TABLE_WIDTH, margin: '0 auto' }}>
{/* Divider under title */}
<div
  style={{
    width: TABLE_WIDTH,
    margin: '0 auto 4px',
    height: 0,
    // borderBottom: '10px solid rgba(190, 6, 6, 1)', //  MAIN TITLE DIVIDER
    boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
    pointerEvents: 'none',
  }}
/>

<AnimatePresence initial={false}>
  {nameSearchOpen && (
    <motion.div
      key="prop-switcher"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: panelH, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ overflow: 'hidden', willChange: 'height,opacity' }}
    >
      <div
        ref={innerPanelRef}
        id="prop-switcher-panel"
        style={{
          width: TABLE_WIDTH,
          margin: '0 auto 8px',
          background: '#fff',
          border: DIVIDER,
          boxShadow: '0 16px 32px rgba(0,0,0,0.2)',
          zIndex: 40,
        }}
      >
        <div style={{ padding: 12, borderBottom: DIVIDER }}>
          <input
            ref={inputRef}
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            onKeyDown={onHeaderKeyDown}
            placeholder="Search properties…"
            style={{
              width: '100%',
              height: 40,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              padding: '0 10px',
              background: '#f6f7f9',
              borderRadius: 6,
            }}
          />
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {nameLoading ? (
            <div style={{ padding: 12, color: '#666' }}>Loading…</div>
          ) : nameResults.length === 0 ? (
            <div style={{ padding: 12, color: '#666' }}>No matches</div>
          ) : (
            nameResults.map((p, i) => {
              const active = i === hoverIdx;
              return (
                <div
                  key={p.property_id}
                  onMouseEnter={() => setHoverIdx(i)}
                  onClick={() => commitSwitch(p.property_id)}
                  style={{
                    padding: '10px 12px',
                    borderTop: DIVIDER,
                    background: active ? '#eef1f3' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                    fontSize: 14,
                  }}
                >
                  <strong style={{ fontSize: 15, color: '#111' }}>{p.property_name}</strong>
                  {p.address ? <span style={{ color: '#555' }}>· {p.address}</span> : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>

{/* BODY — same simple easeOut collapse */}
<motion.div
  initial={false}
  animate={{ opacity: overviewOpen ? 1 : 0, height: overviewOpen ? 'auto' : 0 }}
  transition={{ duration: 0.22, ease: 'easeOut' }}
  style={{ overflow: 'hidden' }}
>
  <div style={{ width: TABLE_WIDTH, margin: '0 auto', background: '#fff', overflow: 'visible' }}>
                <Table
                  highlightOnHover={false}
                  withColumnBorders={false}
                  style={{
                    fontSize: FONT_SIZE,
                    borderCollapse: 'collapse',
                    borderSpacing: 0,
                    width: '100%',
                    tableLayout: 'fixed',
                    margin: 0,
                    background: '#fff',
                  }}
                >
                  <colgroup>
                    {Array.from({ length: MAX_COLS }).map((_, i) => (
                      <col key={i} style={{ width: COL_WIDTH }} />
                    ))}
                  </colgroup>

                  <tbody>
                    <tr>
                      <HeaderCell label="Property Name" units={2} />
                      <HeaderCell label="Address" units={3} />
                      <HeaderCell label="City" />
                      <HeaderCell label="State" />
                      <HeaderCell label="Zip Code" />
                      <HeaderCell label="County" />
                    </tr>
                    <tr>
                      <ValueCell k="property_name" units={2} />
                      <ValueCell k="address" units={3} />
                      <ValueCell k="city" />
                      <ValueCell k="state" />
                      <ValueCell k="zipcode" />
                      <ValueCell k="county" />
                    </tr>

                    <tr>
                      <HeaderCell label="Owner" units={2} />
                      <HeaderCell label="Year" />
                      <HeaderCell label="Type" />
                      <HeaderCell label="Status" />
                      <HeaderCell label="Current Market Value" />
                      <HeaderCell />
                      <HeaderCell />
                      <HeaderCell />
                    </tr>
                    <tr>
                      <ValueCell k="owner" units={2} />
                      <ValueCell k="year" type="number" />
                      <ValueCell k="type" />
                      <ValueCell k="status" />
                      <ValueCell k="market_value" type="number" />
                      <BlackCell />
                      <BlackCell />
                      <BlackCell />
                    </tr>

                    <ContactInlineRows property_id={property.property_id} colSpan={MAX_COLS} />

                    {/* Tenant row */}
                    <tr>
                      <td colSpan={MAX_COLS} style={{ padding: 0, border: 'none' }}>
                        <div style={{ width: '100%', background: '#fff', borderTop: DIVIDER }}>
                          <Tenant property_id={property.property_id} />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </motion.div>
          </motion.div>


            {/* Purchase Details */}
            <Box style={{ width: CONTAINER_WIDTH, margin: '0 auto', marginTop: 0 }}>
              <PurchaseDetailsTable property_id={property.property_id} />
            </Box>

            {/* Payments / Rent log */}
            <Box style={{ width: CONTAINER_WIDTH, margin: '0 auto', marginTop: 0 }}>
              {property.income_producing === 'YES' &&
                (property.status || '').toLowerCase() === 'financed' ? (
                <PaymentTable property_id={property.property_id} />
              ) : property.income_producing === 'YES' ? (
                <RentRollTable property_id={property.property_id} />
              ) : null}
            </Box>

            {/* Transaction Log */}
            <Box style={{ width: CONTAINER_WIDTH, margin: '0 auto', marginTop: 0 }}>
              <TransactionLog
                property_id={property.property_id}
                transactions={transactions}
                setTransactions={setTransactions}
              />
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
