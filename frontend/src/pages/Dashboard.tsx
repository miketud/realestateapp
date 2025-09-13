import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Image, Title, Table, Loader, Center, Button } from '@mantine/core';
import {
  MdTableView,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineClear,
  MdOutlineSearch,
  MdExpandLess,
  MdExpandMore,
} from 'react-icons/md';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';

import logo from '../assets/propertylogo.svg';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import PropertyView from '../components/PropertyView';
import ContactList from '../components/ContactList';
import Reports from '../components/Reports';

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

// status is NO LONGER required (blank allowed)
const REQUIRED: Array<keyof PropertyInput> = ['property_name', 'address', 'owner', 'type'];
const EMPTY_NEW: PropertyInput = { property_name: '', address: '', owner: '', type: '', status: '' };

/* ================= UI Constants & Styles ================= */
const BORDER = 1.5;
const FONT_SIZE = 18;
const PLACEHOLDER = '#9aa1a8';
const NAME_BG = '#f3f3f3';
const ENTRY_ROW_H = 68;

/* Match PropertyView fixed app width so header + content align exactly */
const APP_WIDTH = 1575;

/* Header cell style */
const headerTh: React.CSSProperties = {
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
  wordBreak: 'break-word',
};

const cellBase: React.CSSProperties = {
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

const inputBase: React.CSSProperties = {
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
            zIndex: 20,
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
  return value && value.trim()
    ? <span>{value}</span>
    : <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;
}

/* ================= Component ================= */
export default function Dashboard() {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Search next to the title
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  // open/close toggle for the property list (default CLOSED)
  const [listOpen, setListOpen] = useState(false);

  const [newRow, setNewRow] = useState<PropertyInput>({ ...EMPTY_NEW });
  const [savingNew, setSavingNew] = useState(false);
  const [hoverAdd, setHoverAdd] = useState(false);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<PropertyInput>({ ...EMPTY_NEW });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [bannerError, setBannerError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const prevMapRef = useRef<Record<number, PropertyRow>>({});

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

  useEffect(() => { void load(); }, []);

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

  function resetNew() { setNewRow({ ...EMPTY_NEW }); }

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
    setRows((prev) =>
      prev.map((r) => (r.property_id === id ? { ...r, [key]: value, updated_at: Date.now() } : r))
    );

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
      await deleteProperty(id);
      setRows((prev) => prev.filter((r) => r.property_id !== id));
      setConfirmId(null);
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
    editingId && r.property_id === editingId && frozenNameForSort !== null
      ? frozenNameForSort
      : (r.property_name || '');

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let arr = rows;
    if (tokens.length) {
      arr = rows.filter((p) => tokens.every((tok) => matchesPropertyToken(p, tok)));
    }

    // Default = alphabetical by Property Name (stable for edits)
    const defaultSort = (xs: PropertyRow[]) =>
      [...xs].sort((a, b) =>
        effectiveName(a).localeCompare(effectiveName(b), undefined, { sensitivity: 'base' })
      );

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

  const focusedId = editingId ?? confirmId ?? null;

  // Pressing Enter while in edit mode: finish edit
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void finishEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      void finishEdit();
    }
  };

  if (selectedId !== null) {
    return <PropertyView property_id={selectedId} onBack={() => setSelectedId(null)} refreshProperties={load} />;
  }

  /** ================= Sortable Header (single 3-state toggle) ================= */
  function SortHeader<T extends keyof PropertyInput>({
    title,
    field,
    width,
  }: {
    title: string;
    field: T;
    width: number;
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
        title={
          !active ? `Sort ${title} (A→Z)`
          : sortDir === 'asc' ? `Sort ${title} (Z→A)`
          : `Clear sort`
        }
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
          {!active ? <FaSort /> : sortDir === 'asc' ? <FaSortUp /> : <FaSortDown />}
        </span>
      </th>
    );
  }

  /** ================= Render ================= */
  return (
    <Box style={{ background: '#ffffffff', minHeight: '100vh', fontFamily: 'system-ui, Arial, Helvetica, sans-serif', padding: 0 }}>
      {/* ===== Sticky App Header (matches PropertyView header style) ===== */}
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
          background: '#384758ff',     // same background tone as PropertyView header
          border: '4px solid #111',     // same heavy border
          borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)', // drop shadow
        }}
      >
        {/* Centered row: logo (left) + title (right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Image src={logo} alt="Logo" width={92} height={92} style={{ objectFit: 'contain' }} />
          <Title
            order={1}
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: 2,
              fontFamily: 'inherit',
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            PROPERTY MANAGER
          </Title>
        </div>
      </Box>

      {/* ===== Page container aligned to header width ===== */}
      <Box style={{ width: APP_WIDTH, margin: '0 auto 40px' }}>
        {/* ✅ Reports stays first, aligned with header */}
        <Reports />

        {/* Title + open/close + search */}
        <Box style={{ margin: '0 0 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title order={2} style={{ fontWeight: 900, letterSpacing: 1, fontSize: 28, color: '#111' }}>
              PROPERTY LIST
            </Title>

            {/* open/close toggle */}
            <button
              aria-label={listOpen ? 'Close list' : 'Open list'}
              title={listOpen ? 'Close list' : 'Open list'}
              onClick={() => setListOpen(v => !v)}
              style={{
                width: 50, height: 50,
                border: '2px solid #111', background: '#fff',
                display: 'grid', placeItems: 'center', cursor: 'pointer', lineHeight: 0,
              }}
            >
              {listOpen ? <MdExpandLess size={28} /> : <MdExpandMore size={28} />}
            </button>

            {/* Search control */}
            <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
              {/* Group: icon + input (flush) */}
              <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
                <button
                  aria-label="Search"
                  title="Search"
                  onClick={() => setSearchOpen(v => !v)}
                  style={{
                    width: 50, height: 50,
                    border: '2px solid #111', background: '#fff',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', lineHeight: 0,
                  }}
                >
                  <MdOutlineSearch size={28} />
                </button>

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
                    }}
                    style={{
                      width: '100%',
                      height: 50,
                      border: '2px solid #111',
                      borderLeft: 'none',
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
                <button
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setQuery('')}
                  style={{
                    marginLeft: 8,
                    width: 44, height: 44,
                    display: 'grid', placeItems: 'center',
                    background: '#ffe9e9',
                    border: '2px solid #c33',
                    color: '#c33',
                    cursor: 'pointer',
                  }}
                >
                  <MdOutlineClear size={22} />
                </button>
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
              boxShadow: '0 8px 20px rgba(0,0,0,0.10)',
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
                    <td key={c.key} style={{ ...cellBase }}>
                      {isSelect ? (
                        <select
                          value={newRow[c.key]}
                          onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                          style={{ ...inputBase, color: newRow[c.key] ? '#111' : PLACEHOLDER }}
                        >
                          {c.key === 'type' ? (
                            <>
                              <option value="" style={{ color: '#111' }}>Type</option>
                              <option value="Commercial" style={{ color: '#111' }}>Commercial</option>
                              <option value="Residential" style={{ color: '#111' }}>Residential</option>
                              <option value="Land" style={{ color: '#111' }}>Land</option>
                            </>
                          ) : (
                            <>
                              <option value="" style={{ color: '#111' }}>Status</option>
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} style={{ color: '#111' }}>{opt}</option>
                              ))}
                            </>
                          )}
                        </select>
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
                border: '2px solid #111', borderRadius: 0,
                background: readyToAdd && !savingNew ? '#fff' : '#f2f2f2',
                color: '#111', fontWeight: 800, fontSize: 16, padding: '0 16px',
                textTransform: 'uppercase', letterSpacing: 1,
                height: ENTRY_ROW_H + BORDER * 2, alignSelf: 'stretch',
                cursor: readyToAdd && !savingNew ? 'pointer' : 'not-allowed',
              }}
            >
              {savingNew ? 'Saving…' : 'ADD PROPERTY'}
            </Button>

            {/* Red square clear */}
            <button
              aria-label="Clear inputs"
              title="Clear inputs"
              onClick={resetNew}
              style={{
                position: 'absolute',
                left: 'calc(100% + 8px)',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                background: '#ffe9e9',
                border: '2px solid #c33',
                color: '#c33',
                cursor: 'pointer',
                opacity: hoverAdd ? 1 : 0,
                transition: 'opacity 160ms ease-in-out',
              }}
            >
              <MdOutlineClear size={22} />
            </button>
          </div>
        </Box>

        {/* Collapsible Table */}
        <div
          style={{
            overflow: 'hidden',
            transition: 'max-height 220ms ease',
            maxHeight: listOpen ? 9999 : 0,
          }}
        >
          <Box style={{ margin: '0' }}>
            <Table
              highlightOnHover
              style={{
                width: TABLE_W,
                fontSize: FONT_SIZE,
                borderCollapse: 'collapse',
                border: '2px solid black',
                boxShadow: '0 12px 28px rgba(0,0,0,0.16), inset 0 0 10px rgba(0,0,0,0.08)',
                fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
                tableLayout: 'fixed'
              }}
            >
              <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
              <thead>
                <tr style={{ height: 56 }}>
                  {COLS.map((c) => (
                    <SortHeader key={c.key} title={c.title} field={c.key} width={c.width} />
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan={COLS.length} style={{ background: '#fff' }}>
                    <Center style={{ minHeight: 96 }}><Loader size="lg" /></Center>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 22, background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,0.10)' }}>
                    No properties found.
                  </td></tr>
                ) : (
                  filtered.map((row, idx) => {
                    const isEditing = editingId === row.property_id;
                    const isDeleting = confirmId === row.property_id;
                    const isFocused = isEditing || isDeleting;
                    const rowHovered = hoverId === row.property_id;
                    const dimOthers = focusedId !== null && !isFocused;

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

                          const cellStyle: React.CSSProperties = {
                            ...cellBase,
                            borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                            ...(first ? {
                              background: NAME_BG,
                              fontWeight: 800,
                              position: 'relative',
                              userSelect: 'none',
                            } : {}),
                            ...(last ? { position: 'relative', paddingRight: 0, overflow: 'visible' } : { position: 'relative', overflow: 'visible' }),
                          };

                          return (
                            <td key={c.key} style={cellStyle}>
                              {isEditing ? (
                                c.key === 'type' || c.key === 'status' ? (
                                  <select
                                    value={edit[c.key]}
                                    onChange={(e) => saveField(row.property_id, c.key, e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    style={{ ...inputBase, color: (edit[c.key] || '').trim() ? '#111' : PLACEHOLDER }}
                                  >
                                    {c.key === 'type' ? (
                                      <>
                                        <option value="" style={{ color: '#111' }}>Type</option>
                                        <option value="Commercial" style={{ color: '#111' }}>Commercial</option>
                                        <option value="Residential" style={{ color: '#111' }}>Residential</option>
                                        <option value="Land" style={{ color: '#111' }}>Land</option>
                                      </>
                                    ) : (
                                      <>
                                        <option value="" style={{ color: '#111' }}>Status</option>
                                        {STATUS_OPTIONS.map(opt => (
                                          <option key={opt} value={opt} style={{ color: '#111' }}>{opt}</option>
                                        ))}
                                      </>
                                    )}
                                  </select>
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
                                    position: 'absolute', left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)',
                                    display: 'flex', gap: 10, alignItems: 'center',
                                    opacity: (hoverId === row.property_id || isEditing) ? 1 : 0,
                                    transition: 'opacity 160ms ease-in-out', pointerEvents: 'auto', zIndex: 5,
                                  }}
                                  onMouseEnter={() => setHoverId(row.property_id)}
                                  onMouseLeave={() => setHoverId((p) => (p === row.property_id ? null : p))}
                                >
                                  <button
                                    aria-label="View"
                                    title="View"
                                    onClick={() => setSelectedId(row.property_id)}
                                    style={{
                                      background: 'transparent',
                                      border: '2px solid #111',
                                      borderRadius: 0,
                                      padding: 0,
                                      width: 44,
                                      height: 44,
                                      display: 'grid',
                                      placeItems: 'center',
                                      cursor: 'pointer',
                                      lineHeight: 0,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <MdTableView size={22} />
                                  </button>

                                  <button
                                    aria-label={editingId === row.property_id ? 'Finish Edit' : 'Edit'}
                                    title={editingId === row.property_id ? 'Finish Edit' : 'Edit'}
                                    onClick={() => toggleEdit(row)}
                                    style={{
                                      background: 'transparent',
                                      border: '2px solid #111',
                                      borderRadius: 0,
                                      padding: 0,
                                      width: 44,
                                      height: 44,
                                      display: 'grid',
                                      placeItems: 'center',
                                      cursor: 'pointer',
                                      lineHeight: 0,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <MdOutlineEdit size={22} />
                                  </button>

                                  <button
                                    aria-label="Delete"
                                    title="Delete"
                                    onClick={() => setConfirmId(row.property_id)}
                                    style={{
                                      background: 'transparent',
                                      border: '2px solid #111',
                                      borderRadius: 0,
                                      padding: 0,
                                      width: 44,
                                      height: 44,
                                      display: 'grid',
                                      placeItems: 'center',
                                      cursor: 'pointer',
                                      lineHeight: 0,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <MdOutlineDelete size={22} />
                                  </button>
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

        {/* ✅ Contact List preserved and aligned under property list */}
        <Box style={{ marginTop: 28 }}>
          <ContactList />
        </Box>
      </Box>
    </Box>
  );
}
