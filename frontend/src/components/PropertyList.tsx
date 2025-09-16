import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Box, Table, Loader, Center, Button } from '@mantine/core';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import PropertyView from './PropertyView';
import { Icon, IconButton } from './ui/Icons';

/* ================= Types & Columns ================= */
type PropertyInput = {
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
};
type Property = PropertyInput & { property_id: number };
type PropertyRow = Property & { created_at: number; updated_at: number };
type SortKey = keyof PropertyInput | null;
type SortDir = 'asc' | 'desc';

const COLS: Array<{ key: keyof PropertyInput; title: string; width: number }> = [
  { key: 'property_name', title: 'Property Name', width: 300 },
  { key: 'address', title: 'Address', width: 300 },
  { key: 'owner', title: 'Owner', width: 200 },
  { key: 'type', title: 'Type', width: 200 },
  { key: 'status', title: 'Status', width: 200 },
];

/** Status can be blank or one of these */
const STATUS_OPTIONS = ['Vacant', 'Pending', 'Leased', 'Subleased', 'Financed'] as const;
const TYPE_OPTIONS = ['Commercial', 'Residential', 'Land'] as const;

// status is NO LONGER required (blank allowed)
const REQUIRED: Array<keyof PropertyInput> = ['property_name', 'address', 'owner', 'type'];
const EMPTY_NEW: PropertyInput = { property_name: '', address: '', owner: '', type: '', status: '' };

/* ================= UI Constants & Styles ================= */
const BORDER = 1.5;
const FONT_SIZE = 18;
const PLACEHOLDER = '#9aa1a8';
const NAME_BG = '#f3f3f3';
const ENTRY_ROW_H = 68;

/* Header cell style */
const headerTh: CSSProperties = {
  border: '1.5px solid #111',
  padding: '10px 12px',
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  letterSpacing: 0.3,
  position: 'relative',
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};

/* Table cell base */
const cellBase: CSSProperties = {
  border: `${BORDER}px solid #222`,
  padding: '13px',
  verticalAlign: 'middle',
  background: '#fff',
  fontSize: FONT_SIZE,
  fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
  color: '#111',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  height: ENTRY_ROW_H,
  boxSizing: 'border-box',
};

const inputBase: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  padding: 0,
  margin: 0,
  fontSize: FONT_SIZE,
  lineHeight: '1.2',
  fontFamily: 'inherit',
  color: 'inherit',
  background: 'transparent',
  display: 'block',
};

/* ================= Universal Dropdown (fills cell, header placeholder, hover highlight) ================= */
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
  const [focused, setFocused] = useState(false);

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
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
    const idx = options.findIndex((o) => o.value === value && !o.disabled);
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
      } else if (e.key === 'Escape') {
        // close focus style
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
      setActive((i) => nextEnabled(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => nextEnabled(i, -1));
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          // square + custom focus ring (no rounded flash)
          borderRadius: 0,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          outline: 'none',
          boxShadow: focused ? 'inset 0 0 0 2px #111' : 'none',
          color: value ? '#111' : PLACEHOLDER,
        }}
      >
        {value ? currentLabel || value : placeholder}
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
            zIndex: 2000, // keep above table
            boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
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

          {/* Options */}
          {options.map((opt, idx) => {
            const isActive = idx === active;
            const isSelected = value != null && value !== '' && !opt.disabled && value === opt.value;
            const isDisabled = !!opt.disabled;
            return (
              <div
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()}
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

/* ================= Owner Autocomplete (free-form + suggestions) ================= */
type ContactLite = { contact_id: number; name: string };

function OwnerAutocomplete({
  value,
  onChange,
  placeholder,
  suggestions,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: string[];
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const list = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const hits = suggestions.filter((n) => n.toLowerCase().includes(q));
    const uniq: string[] = [];
    for (const n of hits) if (!uniq.includes(n)) uniq.push(n);
    return uniq.slice(0, 8);
  }, [value, suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      const t = e.target as Node | null;
      if (t && !wrapRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commit = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100%' }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (list.length) commit(list[active]);
            else onEnter?.();
          } else if (e.key === 'ArrowDown' && list.length) {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, list.length - 1));
          } else if (e.key === 'ArrowUp' && list.length) {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        style={inputBase}
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
            zIndex: 2000,
            boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
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

function PlaceholderOrValue({
  value,
  placeholder,
}: {
  value?: string;
  placeholder: string;
}) {
  return value && value.trim() ? <span>{value}</span> : <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;
}

/** ================= Sortable Header (single 3-state toggle) ================= */
function SortHeader<T extends keyof PropertyInput>({
  title,
  field,
  width,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
}: {
  title: string;
  field: T;
  width: number;
  sortBy: SortKey;
  sortDir: SortDir;
  setSortBy: (k: SortKey) => void;
  setSortDir: (d: SortDir) => void;
}) {
  const active = sortBy === field;

  const toggle = () => {
    if (!active) {
      setSortBy(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy(null); // back to default alphabetical by name
    }
  };

  return (
    <th
      style={{ ...headerTh, width, minWidth: width, maxWidth: width, cursor: 'pointer', userSelect: 'none' }}
      onClick={toggle}
      title={!active ? `Sort ${title} (A→Z)` : sortDir === 'asc' ? `Sort ${title} (Z→A)` : `Clear sort`}
    >
      <span>{title}</span>
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {!active ? <Icon name="sort" /> : sortDir === 'asc' ? <Icon name="sortUp" /> : <Icon name="sortDown" />}
      </span>
    </th>
  );
}

/* ================= Component ================= */
export default function PropertyList() {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Search next to the title
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // open/close toggle for the property list (default OPEN)
  const [listOpen, setListOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true)); // smooth fade-in after mount
    return () => cancelAnimationFrame(t);
  }, []);
  const [newRow, setNewRow] = useState<PropertyInput>({ ...EMPTY_NEW });
  const [savingNew, setSavingNew] = useState(false);
  const [hoverAdd, setHoverAdd] = useState(false);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState<string>(''); // DELETE input
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<PropertyInput>({ ...EMPTY_NEW });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [bannerError, setBannerError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const prevMapRef = useRef<Record<number, PropertyRow>>({});

  // focus the DELETE input when confirmation opens
  useEffect(() => {
    if (confirmId !== null) {
      setConfirmText('');
      setTimeout(() => confirmInputRef.current?.focus(), 0);
    }
  }, [confirmId]);

  // Global Escape handling: exit delete confirm or edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmId !== null) {
        setConfirmId(null);
        setConfirmText('');
      } else if (editingId !== null) {
        finishEdit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmId, editingId]);

  // Contact names (for owner autocomplete)
  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.text())))
      .then((data: ContactLite[] | any[]) => {
        const names = Array.isArray(data) ? data.map((c: any) => String(c.name || '')).filter(Boolean) : [];
        const uniq: string[] = [];
        for (const n of names) if (!uniq.includes(n)) uniq.push(n);
        setContactNames(uniq);
      })
      .catch(() => void 0);
  }, []);

  useEffect(() => {
    void load();
  }, []);

  const TABLE_W = useMemo(() => COLS.reduce((s, c) => s + c.width, 0), []);
  const readyToAdd = REQUIRED.every((k) => newRow[k].trim().length > 0);

  async function load() {
    setLoading(true);
    try {
      const data: Property[] = await getProperties();
      const now = Date.now();
      const prev = prevMapRef.current;
      const mapped: PropertyRow[] = (data || []).map((p) => {
        const prevRow = prev[p.property_id];
        return { ...p, created_at: prevRow?.created_at ?? now, updated_at: prevRow?.updated_at ?? now };
      });
      setRows(mapped);
      prevMapRef.current = Object.fromEntries(mapped.map((r) => [r.property_id, r]));
      setBannerError(null);
    } catch (e: any) {
      console.error(e);
      setBannerError(e?.response?.data?.message || e?.message || 'Failed to load properties.');
    } finally {
      setLoading(false);
    }
  }

  function resetNew() {
    setNewRow({ ...EMPTY_NEW });
  }

  async function addProperty() {
    if (!readyToAdd) return;
    setSavingNew(true);
    try {
      await createProperty(newRow);
      resetNew();
      await load();
      // keep newest at top (assumes max id newest)
      setRows((prev) => {
        if (!prev.length) return prev;
        const maxId = prev.reduce((m, r) => (r.property_id > m ? r.property_id : m), prev[0].property_id);
        return prev.sort((a, b) => (a.property_id === maxId ? -1 : b.property_id === maxId ? 1 : 0));
      });
      setBannerError(null);
    } catch (e: any) {
      console.error(e);
      setBannerError(e?.response?.data?.message || e?.message || 'Create failed.');
    } finally {
      setSavingNew(false);
    }
  }

  // Freeze the current name during edit so sorting won't jump in real-time
  const [frozenNameForSort, setFrozenNameForSort] = useState<string | null>(null);

  function startEdit(row: PropertyRow) {
    setEditingId(row.property_id);
    setFrozenNameForSort(row.property_name);
    setEdit({
      property_name: row.property_name,
      address: row.address,
      owner: row.owner,
      type: row.type,
      status: row.status,
    });
  }

  // Autosave helper (per-field)
  async function saveField(id: number, key: keyof PropertyInput, value: string) {
    // Optimistic UI
    setEdit((p) => (editingId === id ? { ...p, [key]: value } : p));
    setRows((prev) => prev.map((r) => (r.property_id === id ? { ...r, [key]: value, updated_at: Date.now() } : r)));

    // Build a full PropertyInput for the API
    const row = rows.find((r) => r.property_id === id);
    if (!row) return;

    const payload: PropertyInput = {
      property_name: row.property_name,
      address: row.address,
      owner: row.owner,
      type: row.type,
      status: row.status,
    };
    (payload as any)[key] = value;

    try {
      await updateProperty(id, payload);
      setBannerError(null);
    } catch (e: any) {
      console.error(e);
      setBannerError(e?.response?.data?.message || e?.message || 'Update failed.');
    }
  }

  async function finishEdit() {
    if (editingId == null) return;
    setEditingId(null);
    setFrozenNameForSort(null);
    setEditSaving(false);
  }

  function toggleEdit(row: PropertyRow) {
    if (editingId === row.property_id) void finishEdit();
    else startEdit(row);
  }

  async function doDelete(id: number) {
    try {
      setDeletingId(id);
      // Proactively clear editing state if the deleted row was in edit mode
      if (editingId === id) {
        setEditingId(null);
        setFrozenNameForSort(null);
      }
      // Also close confirm UI immediately
      setConfirmId(null);
      setConfirmText('');
      setHoverId((prev) => (prev === id ? null : prev));

      await deleteProperty(id);
      setRows((prev) => prev.filter((r) => r.property_id !== id));
      if (selectedId === id) setSelectedId(null);
      setBannerError(null);
    } catch (e: any) {
      console.error(e);
      setBannerError(e?.response?.data?.message || e?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  // helper: does a single token match a property row?
  const matchesPropertyToken = (p: PropertyRow, token: string) => {
    const t = token.toLowerCase();
    return (
      p.property_name.toLowerCase().includes(t) ||
      p.address.toLowerCase().includes(t) ||
      p.owner.toLowerCase().includes(t) ||
      p.type.toLowerCase().includes(t) ||
      p.status.toLowerCase().includes(t)
    );
  };

  // effectiveName: use frozen name for the row in edit mode (prevents live resort)
  const effectiveName = (r: PropertyRow) =>
    editingId && r.property_id === editingId && frozenNameForSort !== null ? frozenNameForSort : r.property_name || '';

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let arr = rows;
    if (tokens.length) {
      arr = rows.filter((p) => tokens.every((tok) => matchesPropertyToken(p, tok)));
    }

    // Default = alphabetical by Property Name (stable for edits)
    const defaultSort = (xs: PropertyRow[]) =>
      [...xs].sort((a, b) => effectiveName(a).localeCompare(effectiveName(b), undefined, { sensitivity: 'base' }));

    if (!sortBy) return defaultSort(arr);

    const dir = sortDir === 'asc' ? 1 : -1;

    // If explicitly sorting by name, also use effectiveName
    if (sortBy === 'property_name') {
      return [...arr].sort((a, b) => {
        const va = effectiveName(a).toLowerCase();
        const vb = effectiveName(b).toLowerCase();
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }

    // Other fields unchanged
    return [...arr].sort((a, b) => {
      const va = String(a[sortBy] ?? '').toLowerCase();
      const vb = String(b[sortBy] ?? '').toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, query, sortBy, sortDir, editingId, frozenNameForSort]);

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void finishEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      void finishEdit();
    }
  };

  // Property detail view hand-off
  if (selectedId !== null) {
    return <PropertyView property_id={selectedId} onBack={() => setSelectedId(null)} refreshProperties={load} />;
  }

  /* ================= Render ================= */
  return (
    <Box
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 420ms ease, transform 420ms ease',
      }}
    >
      {/* Title + open/close + search */}
      <Box style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 150 }}>
          <h2 style={{ fontWeight: 900, letterSpacing: 1, fontSize: 40, color: '#111', margin: 0, lineHeight: 1 }}>
            PROPERTY LIST
          </h2>

          {/* open/close toggle */}
          <IconButton
            icon={listOpen ? 'arrowDown' : 'arrowRight'}
            label={listOpen ? 'Close list' : 'Open list'}
            size="lg"
            onClick={() => setListOpen((v) => !v)}
          />

          {/* Search control */}
          <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
            {/* Group: icon + input (flush) */}
            <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
              <IconButton
                icon="search"
                label={searchOpen ? 'Close search' : 'Open search'}
                size="lg"
                onClick={() => setSearchOpen((v) => !v)}
              />

              {/* Expanding input flush to the icon */}
              <div
                style={{
                  width: searchOpen ? 300 : 0,
                  height: 50,
                  overflow: 'hidden',
                  transition: 'width 240ms ease',
                }}
              >
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search properties…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setListOpen(true);
                    }
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 50,
                    border: '2px solid #111',
                    borderLeft: 'none', // flush with IconButton
                    padding: '0 12px',
                    fontSize: 16,
                    outline: 'none',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Separate red clear button */}
            {query && (
              <IconButton
                icon="clear"
                label="Clear search"
                variant="danger"
                // default size (md) to match other icons
                onClick={() => setQuery('')}
                style={{ marginLeft: 8 }}
              />
            )}
          </div>
        </div>

        {/* Banner under the title/search row */}
        {bannerError && (
          <div
            role="alert"
            style={{
              width: TABLE_W,
              border: '2px solid #c33',
              background: '#ffeaea',
              color: '#c33',
              fontWeight: 700,
              letterSpacing: 0.3,
              padding: '10px 14px',
              margin: '12px 0 0',
            }}
          >
            {bannerError}
          </div>
        )}
      </Box>

      {/* Entry Row + Add + Clear */}
      <Box style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <table
          style={{
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            background: '#fff',
            width: TABLE_W,
            border: `${BORDER * 2}px solid #222`,
            boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
          }}
        >
          <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
          <tbody>
            <tr style={{ height: ENTRY_ROW_H }}>
              {COLS.map((c) => {
                const isSelect = c.key === 'type' || c.key === 'status';
                if (c.key === 'owner') {
                  return (
                    <td key={c.key} style={{ ...cellBase, position: 'relative', overflow: 'visible' }}>
                      <OwnerAutocomplete
                        value={newRow.owner}
                        onChange={(v) => setNewRow((p) => ({ ...p, owner: v }))}
                        placeholder="Owner"
                        suggestions={contactNames}
                      />
                    </td>
                  );
                }
                return (
                  <td key={c.key} style={{ ...cellBase, position: 'relative', overflow: 'visible' }}>
                    {isSelect ? (
                      <UniversalDropdown
                        value={(newRow[c.key] ?? null) as string | null}
                        placeholder={c.key === 'type' ? 'Type' : 'Status'}
                        options={
                          c.key === 'type'
                            ? TYPE_OPTIONS.map((t) => ({ value: t }))
                            : STATUS_OPTIONS.map((s) => ({ value: s }))
                        }
                        onChange={(val) => setNewRow((p) => ({ ...p, [c.key]: val }))}
                        ariaLabel={c.title}
                      />

                    ) : (
                      <input
                        value={newRow[c.key]}
                        onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                        placeholder={c.title}
                        style={inputBase}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setHoverAdd(true)}
          onMouseLeave={() => setHoverAdd(false)}
        >
          <Button
            onClick={addProperty}
            disabled={!readyToAdd || savingNew}
            style={{
              border: '2px solid #111',
              borderRadius: 0,
              background: readyToAdd && !savingNew ? '#fff' : '#f2f2f2',
              color: '#111',
              fontWeight: 800,
              fontSize: 16,
              padding: '0 16px',
              textTransform: 'uppercase',
              letterSpacing: 1,
              height: ENTRY_ROW_H + BORDER * 2,
              alignSelf: 'stretch',
              cursor: readyToAdd && !savingNew ? 'pointer' : 'not-allowed',
            }}
          >
            {savingNew ? 'Saving…' : 'ADD PROPERTY'}
          </Button>

          {/* Red square clear */}
          <div
            style={{
              position: 'absolute',
              left: 'calc(100% + 8px)',
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: hoverAdd ? 1 : 0,
              transition: 'opacity 160ms ease-in-out',
            }}
          >
            <IconButton icon="clear" label="Clear inputs" variant="danger" onClick={resetNew} />
          </div>
        </div>
      </Box>

      {/* Collapsible Table */}
      <div
        style={{
          // Only hide overflow when collapsed; keep visible while open so menus/tooltips/shadows can escape
          overflow: listOpen ? 'visible' : 'hidden',
          transition: 'max-height 500ms cubic-bezier(0.2, 0, 0, 1), opacity 450ms ease, transform 450ms ease',
          maxHeight: listOpen ? 9999 : 0,
          opacity: listOpen ? 1 : 0,
          transform: listOpen ? 'translateY(0)' : 'translateY(-4px)',
          willChange: 'max-height, opacity, transform',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box style={{ margin: '0', position: 'relative', zIndex: 1 }}>
          <Table
            highlightOnHover
            style={{
              width: TABLE_W,
              fontSize: FONT_SIZE,
              borderCollapse: 'collapse',
              border: '2px solid black',
              boxShadow: '0 12px 28px rgba(0,0,0,0.16), inset 0 0 10px rgba(0,0,0,0.08)',
              fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
            <thead>
              <tr style={{ height: 56 }}>
                {COLS.map((c) => (
                  <SortHeader
                    key={c.key}
                    title={c.title}
                    field={c.key}
                    width={c.width}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    setSortBy={setSortBy}
                    setSortDir={setSortDir}
                  />
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLS.length} style={{ background: '#fff' }}>
                    <Center style={{ minHeight: 96 }}>
                      <Loader size="lg" />
                    </Center>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLS.length}
                    style={{
                      textAlign: 'center',
                      padding: 40,
                      color: '#666',
                      fontSize: 22,
                      background: '#fff',
                    }}
                  >
                    No properties found.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const isEditing = editingId === row.property_id;
                  const isConfirming = confirmId === row.property_id;
                  const isFocused = isEditing || isConfirming;
                  const rowHovered = hoverId === row.property_id;
                  const dimOthers = (editingId ?? confirmId ?? null) !== null && !isFocused;

                  return (
                    <tr
                      key={row.property_id}
                      onMouseEnter={() => setHoverId(row.property_id)}
                      onMouseLeave={() => setHoverId((p) => (p === row.property_id ? null : p))}
                      style={{
                        height: ENTRY_ROW_H,
                        transform: rowHovered && !dimOthers && !isFocused ? 'translateY(-4px)' : 'none',
                        transition: 'transform 150ms ease, filter 150ms ease, opacity 120ms ease',
                        filter: rowHovered && !dimOthers && !isFocused ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.22))' : 'none',
                        opacity: dimOthers ? 0.45 : 1,
                        position: 'relative',
                      }}
                    >
                      {COLS.map((c, ci) => {
                        const first = ci === 0;
                        const last = ci === COLS.length - 1;

                        const cellStyle: CSSProperties = {
                          ...cellBase,
                          borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                          ...(first
                            ? {
                              background: NAME_BG,
                              fontWeight: 800,
                              position: 'relative',
                              userSelect: 'none',
                            }
                            : {}),
                          ...(last ? { position: 'relative', paddingRight: 0, overflow: 'visible' } : { position: 'relative', overflow: 'visible' }),
                        };

                        return (
                          <td key={c.key} style={cellStyle}>
                            {isEditing ? (
                              c.key === 'type' || c.key === 'status' ? (
                                <UniversalDropdown
                                  value={edit[c.key]}
                                  placeholder={c.key === 'type' ? 'Type' : 'Status'}
                                  options={
                                    c.key === 'type'
                                      ? TYPE_OPTIONS.map((t) => ({ value: t }))
                                      : STATUS_OPTIONS.map((s) => ({ value: s }))}
                                  onChange={(val) => saveField(row.property_id, c.key, val)}
                                  ariaLabel={c.title}
                                />
                              ) : c.key === 'owner' ? (
                                <OwnerAutocomplete
                                  value={edit.owner}
                                  onChange={(v) => saveField(row.property_id, 'owner', v)}
                                  placeholder="Owner"
                                  suggestions={contactNames}
                                  onEnter={() => finishEdit()}
                                />
                              ) : (
                                <input
                                  value={edit[c.key]}
                                  onChange={(e) => saveField(row.property_id, c.key, e.target.value)}
                                  onKeyDown={handleEditKeyDown}
                                  placeholder={c.title}
                                  style={inputBase}
                                />
                              )
                            ) : (
                              <PlaceholderOrValue value={row[c.key]} placeholder={c.title} />
                            )}

                            {/* Row actions (outside, to the right) */}
                            {last && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 'calc(100% + 8px)',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  display: 'flex',
                                  gap: 10,
                                  alignItems: 'center',
                                  opacity: hoverId === row.property_id || isEditing || isConfirming ? 1 : 0,
                                  transition: 'opacity 160ms ease-in-out',
                                  pointerEvents: 'auto',
                                  zIndex: 1500, // keep action area above the table
                                }}
                                onMouseEnter={() => setHoverId(row.property_id)}
                                onMouseLeave={() => setHoverId((p) => (p === row.property_id ? null : p))}
                              >
                                {/* View/Edit/Delete shown only when NOT confirming */}
                                {!isConfirming && (
                                  <>
                                    <IconButton
                                      icon="tableView"
                                      label="View"
                                      onClick={() => setSelectedId(row.property_id)}
                                    />
                                    <IconButton
                                      icon="edit"
                                      label={editingId === row.property_id ? 'Finish Edit' : 'Edit'}
                                      onClick={() => toggleEdit(row)}
                                    />
                                    <IconButton
                                      icon="delete"
                                      label="Delete"
                                      variant="danger"
                                      onClick={() =>
                                        setConfirmId((prev) => (prev === row.property_id ? null : row.property_id))
                                      }
                                    />
                                  </>
                                )}

                                {/* DELETE confirmation input that expands to the right */}
                                <div style={{ position: 'relative', height: ENTRY_ROW_H, display: 'flex', alignItems: 'center' }}>
                                  {/* Tooltip above input */}
                                  {isConfirming && (
                                    <div
                                      role="tooltip"
                                      style={{
                                        position: 'absolute',
                                        bottom: ENTRY_ROW_H + 10,
                                        left: 0,
                                        padding: '8px 10px',
                                        background: '#111',
                                        color: '#fff',
                                        border: '2px solid #111',
                                        fontWeight: 700,
                                        letterSpacing: 0.3,
                                        fontSize: 12,
                                        whiteSpace: 'nowrap',
                                        borderRadius: 6,
                                        boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
                                        zIndex: 2000,
                                      }}
                                    >
                                      Type DELETE and press Enter to permanently delete.
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      width: isConfirming ? 80 : 0,
                                      height: ENTRY_ROW_H,
                                      overflow: 'hidden',
                                      transition: 'width 180ms ease',
                                      border: isConfirming ? '2px solid #c33' : '2px solid transparent',
                                      background: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {isConfirming && (
                                      <input
                                        ref={confirmInputRef}
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (confirmText.trim().toUpperCase() === 'DELETE') {
                                              void doDelete(row.property_id);
                                            } else {
                                              setBannerError('Please type DELETE to confirm.');
                                            }
                                          } else if (e.key === 'Escape') {
                                            setConfirmId(null);
                                            setConfirmText('');
                                          }
                                        }}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          border: 'none',
                                          outline: 'none',
                                          textAlign: 'center',
                                          fontWeight: 900,
                                          letterSpacing: 1,
                                          textTransform: 'uppercase',
                                          fontSize: 14,
                                          fontFamily: 'inherit',
                                          // square focus ring
                                          borderRadius: 0,
                                          appearance: 'none',
                                          WebkitAppearance: 'none',
                                          MozAppearance: 'none',
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Cancel X to the right of the entry cell — same size as other icons */}
                                {isConfirming && (
                                  <IconButton
                                    icon="clear"
                                    label="Cancel delete"
                                    variant="danger"
                                    onClick={() => {
                                      setConfirmId(null);
                                      setConfirmText('');
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Box>
      </div>
    </Box>
  );
}
