import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Image, Title, Divider, Table, Loader, Center, Button } from '@mantine/core';
import {
  MdTableView,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineClear,
  MdOutlineSearch,
  MdExpandLess,
  MdExpandMore,
} from 'react-icons/md';

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

const REQUIRED: Array<keyof PropertyInput> = ['property_name', 'address', 'owner', 'type', 'status'];
const EMPTY_NEW: PropertyInput = { property_name: '', address: '', owner: '', type: '', status: '' };

/* ================= UI Constants & Styles ================= */
const BORDER = 1.5;
const FONT_SIZE = 18;
const PLACEHOLDER = '#9aa1a8';
const BLUE = '#2b6fff';
const NAME_BG = '#f3f3f3';
const NAME_BG_HL = '#eaf1ff';
const ENTRY_ROW_H = 68;

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

/* ================= Small Helpers ================= */
function PlaceholderOrValue({ value, placeholder }: { value?: string; placeholder: string }) {
  return value && value.trim() ? <span>{value}</span> : <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;
}

function SortButtons({
  active, dir, onAsc, onDesc,
}: { active: boolean; dir: SortDir; onAsc: () => void; onDesc: () => void }) {
  return (
    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 6 }}>
      <button
        onClick={onAsc}
        title="Sort ↑"
        style={{
          border: '1.5px solid #fff',
          background: active && dir === 'asc' ? '#fff' : 'transparent',
          color: active && dir === 'asc' ? '#111' : '#fff',
          borderRadius: 4, width: 26, height: 26, lineHeight: '24px', fontWeight: 900, cursor: 'pointer',
        }}
      >▲</button>
      <button
        onClick={onDesc}
        title="Sort ↓"
        style={{
          border: '1.5px solid #fff',
          background: active && dir === 'desc' ? '#fff' : 'transparent',
          color: active && dir === 'desc' ? '#111' : '#fff',
          borderRadius: 4, width: 26, height: 26, lineHeight: '24px', fontWeight: 900, cursor: 'pointer',
        }}
      >▼</button>
    </span>
  );
}

function HeaderCell({
  title, field, width, sortBy, sortDir, setSortBy, setSortDir,
}: {
  title: string; field: Exclude<SortKey, null>; width: number;
  sortBy: SortKey; sortDir: SortDir; setSortBy: (k: SortKey) => void; setSortDir: (d: SortDir) => void;
}) {
  const active = sortBy === field;
  const onAsc = () => (active && sortDir === 'asc' ? setSortBy(null) : (setSortBy(field), setSortDir('asc')));
  const onDesc = () => (active && sortDir === 'desc' ? setSortBy(null) : (setSortBy(field), setSortDir('desc')));
  return (
    <th style={{ ...headerTh, width, minWidth: width, maxWidth: width }}>
      <span>{title}</span>
      <SortButtons active={active} dir={sortDir} onAsc={onAsc} onDesc={onDesc} />
    </th>
  );
}

function ConfirmDelete({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ background: '#fff', border: '2px solid #111', borderRadius: 8, padding: 18, minWidth: 280, textAlign: 'center' }}>
      <div style={{ fontSize: 16, marginBottom: 14 }}>Are you sure you want to delete?</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{ border: '2px solid #111', background: '#ff3b30', color: '#fff', borderRadius: 6, padding: '8px 14px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >{busy ? 'Deleting…' : 'Delete'}</button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ border: '2px solid #111', background: '#fff', borderRadius: 6, padding: '8px 14px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >Cancel</button>
      </div>
    </div>
  );
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

  // NEW: open/close toggle for the property list (default CLOSED to mirror Contact List)
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

  function bumpToTop(id: number) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.property_id === id);
      if (i < 0) return prev;
      const now = Date.now();
      const next = [...prev];
      const [row] = next.splice(i, 1);
      const bumped = { ...row, updated_at: now };
      next.unshift(bumped);
      prevMapRef.current[id] = bumped;
      return next;
    });
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

  function startEdit(row: PropertyRow) {
    setEditingId(row.property_id);
    setEdit({
      property_name: row.property_name,
      address: row.address,
      owner: row.owner,
      type: row.type,
      status: row.status,
    });
  }

  async function finishEdit() {
    if (editingId == null) return;
    const id = editingId;
    setEditSaving(true);
    try {
      await updateProperty(id, edit);
      setRows((prev) => prev.map((r) => (r.property_id === id ? { ...r, ...edit, updated_at: Date.now() } : r)));
      bumpToTop(id);
      setEditingId(null);
      setBannerError(null);
    } catch (e: any) {
      console.error(e);
      setBannerError(e?.response?.data?.message || e?.message || 'Update failed.');
    } finally {
      setEditSaving(false);
    }
  }

  function toggleEdit(row: PropertyRow) {
    if (editingId === row.property_id) void finishEdit(); // Esc/toggle off saves
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

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let arr = rows;
    if (tokens.length) {
      arr = rows.filter((p) => tokens.every((tok) => matchesPropertyToken(p, tok)));
    }

    if (!sortBy) return arr;

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      const va = String(a[sortBy] ?? '').toLowerCase();
      const vb = String(b[sortBy] ?? '').toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, query, sortBy, sortDir]);

  if (selectedId !== null) {
    return <PropertyView property_id={selectedId} onBack={() => setSelectedId(null)} refreshProperties={load} />;
  }

  return (
    <Box style={{ background: '#ffffffff', minHeight: '100vh', fontFamily: 'system-ui, Arial, Helvetica, sans-serif', padding: 0 }}>
      {/* App header */}
      <Box style={{ display: 'flex', alignItems: 'center', padding: '40px 40px 20px 40px', gap: 28 }}>
        <Image src={logo} alt="Logo" width={92} height={92} style={{ objectFit: 'contain' }} />
        <Title order={1} style={{ fontSize: 52, fontWeight: 900, color: '#111', letterSpacing: 2, fontFamily: 'inherit' }}>
          PROPERTY MANAGER
        </Title>
      </Box>
      <Divider style={{ height: 7, background: '#111', boxShadow: '0px 5px 18px 0 rgba(0,0,0,0.18)', border: 'none', marginBottom: 28, maxWidth: 1500 }} />

      {/* ✅ Render Reports */}
      <Reports />

      {/* Title + open/close + search */}
      <Box style={{ margin: '0 40px 12px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title order={2} style={{ fontWeight: 900, letterSpacing: 1, fontSize: 28, color: '#111' }}>
            PROPERTY LIST
          </Title>

          {/* NEW: open/close toggle to the LEFT of search (matches Contact List) */}
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
            {/* Group: icon + input (flush, seamless) */}
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
                      setListOpen(true);      // 🔑 reveal the property list
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 50,
                    border: '2px solid #111',
                    borderLeft: 'none', // seamless seam with icon’s right border
                    padding: '0 12px',
                    fontSize: 16,
                    outline: 'none',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Separate red clear button with small gap */}
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
      <Box style={{ margin: '0 40px 20px 40px', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', background: '#fff', width: TABLE_W, border: `${BORDER * 2}px solid #222`, boxShadow: '0 8px 20px rgba(0,0,0,0.10)' }}>
          <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
          <tbody>
            <tr style={{ height: ENTRY_ROW_H }}>
              {COLS.map((c) => {
                const isSelect = c.key === 'type' || c.key === 'status';
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
                            <option value="Active" style={{ color: '#111' }}>Active</option>
                            <option value="Pending" style={{ color: '#111' }}>Pending</option>
                            <option value="Inactive" style={{ color: '#111' }}>Inactive</option>
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

          {/* Red square clear (same style as Reports) */}
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

      {/* Collapsible Table (matches Contact List behavior) */}
      <div
        style={{
          overflow: 'hidden',
          transition: 'max-height 220ms ease',
          maxHeight: listOpen ? 9999 : 0,
        }}
      >
        <Box style={{ margin: '0 40px' }}>
          <Table
            highlightOnHover
            style={{ width: TABLE_W, fontSize: FONT_SIZE, borderCollapse: 'collapse', border: '2px solid black', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)', fontFamily: 'system-ui, Arial, Helvetica, sans-serif', tableLayout: 'fixed' }}
          >
            <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
            <thead>
              <tr style={{ height: 56 }}>
                {COLS.map((c) => (
                  <HeaderCell
                    key={c.key} title={c.title} field={c.key} width={c.width}
                    sortBy={sortBy} sortDir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir}
                  />
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
                  const nameHL = isEditing || isDeleting;

                  return (
                    <tr
                      key={row.property_id}
                      onMouseEnter={() => setHoverId(row.property_id)}
                      onMouseLeave={() => setHoverId((p) => (p === row.property_id ? null : p))}
                    >
                      {COLS.map((c, ci) => {
                        const first = ci === 0;
                        const last = ci === COLS.length - 1;

                        const cellStyle: React.CSSProperties = {
                          ...cellBase,
                          borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                          ...(first ? {
                            background: nameHL ? NAME_BG_HL : NAME_BG,
                            fontWeight: 800,
                            position: 'relative',
                            boxShadow: nameHL ? `inset 0 0 0 3px ${BLUE}` : 'none',
                            userSelect: 'none',
                            transition: 'background-color 140ms ease, box-shadow 140ms ease',
                          } : {}),
                          ...(last ? { position: 'relative', paddingRight: 0, overflow: 'visible' } : {}),
                        };

                        return (
                          <td key={c.key} style={cellStyle}>
                            {isEditing ? (
                              c.key === 'type' || c.key === 'status' ? (
                                <select
                                  value={edit[c.key]}
                                  onChange={(e) => setEdit((p) => ({ ...p, [c.key]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Escape') void finishEdit(); }}
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
                                      <option value="Active" style={{ color: '#111' }}>Active</option>
                                      <option value="Pending" style={{ color: '#111' }}>Pending</option>
                                      <option value="Inactive" style={{ color: '#111' }}>Inactive</option>
                                    </>
                                  )}
                                </select>
                              ) : (
                                <input
                                  value={edit[c.key]}
                                  onChange={(e) => setEdit((p) => ({ ...p, [c.key]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Escape') void finishEdit(); }}
                                  placeholder={c.title}
                                  style={inputBase}
                                />
                              )
                            ) : (
                              <PlaceholderOrValue value={row[c.key]} placeholder={c.title} />
                            )}

                            {/* Delete overlay to the right of the name cell */}
                            {first && isDeleting && (
                              <div
                                style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', zIndex: 6 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ConfirmDelete
                                  busy={deletingId === row.property_id}
                                  onConfirm={() => doDelete(row.property_id)}
                                  onCancel={() => setConfirmId(null)}
                                />
                              </div>
                            )}

                            {/* Row actions (outside, to the right) */}
                            {last && (
                              <div
                                style={{
                                  position: 'absolute', left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)',
                                  display: 'flex', gap: 10, alignItems: 'center',
                                  opacity: hoverId === row.property_id || isEditing ? 1 : 0,
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
                                  <MdTableView size={22} style={{ display: 'block' }} />
                                </button>
                                <button
                                  aria-label="Edit"
                                  title={isEditing ? 'Finish Editing' : 'Edit'}
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

      {/* Contacts below */}
      <Box style={{ margin: '40px' }}>
        <ContactList />
      </Box>
    </Box>
  );
}
