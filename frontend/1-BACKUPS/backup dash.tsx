import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Image, Title, Divider, Table, Loader, Center, Button } from '@mantine/core';
import {
  MdOutlinePageview,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineClear,
} from 'react-icons/md';

import logo from '../assets/propertylogo.svg';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import PropertyView from '../components/PropertyView';
import ContactList from '../components/ContactList';
/* =========================================================
   Types
   ========================================================= */
type PropertyInput = {
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
};

type Property = PropertyInput & {
  property_id: number;
};

type PropertyRow = Property & {
  created_at: number; // local bookkeeping for default order
  updated_at: number; // "last updated first"
};

type SortKey = keyof PropertyInput | null;
type SortDir = 'asc' | 'desc';

/* =========================================================
   Column Config (shared by entry row + list)
   ========================================================= */
const COLS: Array<{ key: keyof PropertyInput; title: string; width: number }> = [
  { key: 'property_name', title: 'Property Name', width: 300 },
  { key: 'address',       title: 'Address',       width: 300 },
  { key: 'owner',         title: 'Owner',         width: 200 },
  { key: 'type',          title: 'Type',          width: 200 },
  { key: 'status',        title: 'Status',        width: 200 },
];

/* =========================================================
   UI Constants
   ========================================================= */
const BORDER = 1.5;
const PLACEHOLDER = '#9aa1a8';
const BLUE = '#2b6fff';
const NAME_BG = '#f3f3f3';
const NAME_BG_HIGHLIGHT = '#eaf1ff';
const FONT_SIZE = 18;
const ROW_HEIGHT = 68; // entry row & button; body rows grow (wrapping)

const emptyNewProperty: PropertyInput = {
  property_name: '',
  address: '',
  owner: '',
  type: '',
  status: '',
};

/* =========================================================
   Shared Styles
   ========================================================= */
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

const sharedCellBase: React.CSSProperties = {
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

const inputBaseStyle: React.CSSProperties = {
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

/* =========================================================
   Small UI Helpers
   ========================================================= */

// Placeholder-looking value in the list
function PlaceholderOrValue({
  value,
  placeholder,
}: {
  value?: string;
  placeholder: string;
}) {
  if (value && value.trim().length > 0) return <span>{value}</span>;
  return <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;
}

// Sort buttons (asc/desc). Clicking active direction again clears sort.
function SortButtons({
  active,
  dir,
  onAsc,
  onDesc,
}: {
  active: boolean;
  dir: SortDir;
  onAsc: () => void;
  onDesc: () => void;
}) {
  return (
    <span
      style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        gap: 6,
      }}
    >
      <button
        onClick={onAsc}
        title="Sort ↑"
        style={{
          border: '1.5px solid #fff',
          background: active && dir === 'asc' ? '#fff' : 'transparent',
          color: active && dir === 'asc' ? '#111' : '#fff',
          borderRadius: 4,
          width: 26,
          height: 26,
          lineHeight: '24px',
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        ▲
      </button>
      <button
        onClick={onDesc}
        title="Sort ↓"
        style={{
          border: '1.5px solid #fff',
          background: active && dir === 'desc' ? '#fff' : 'transparent',
          color: active && dir === 'desc' ? '#111' : '#fff',
          borderRadius: 4,
          width: 26,
          height: 26,
          lineHeight: '24px',
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        ▼
      </button>
    </span>
  );
}

// Header cell with centered label + right-aligned sort controls
function HeaderCell({
  title,
  field,
  width,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
}: {
  title: string;
  field: Exclude<SortKey, null>;
  width: number;
  sortBy: SortKey;
  sortDir: SortDir;
  setSortBy: (k: SortKey) => void;
  setSortDir: (d: SortDir) => void;
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

// Delete confirm overlay (UI-only — wired up in parent)
function ConfirmDelete({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '2px solid #111',
        borderRadius: 8,
        padding: 18,
        minWidth: 280,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 14 }}>
        Are you sure you want to delete?
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            border: '2px solid #111',
            background: '#fff',
            borderRadius: 6,
            padding: '8px 14px',
            fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            border: '2px solid #111',
            background: '#fff',
            borderRadius: 6,
            padding: '8px 14px',
            fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Component
   ========================================================= */
export default function Dashboard() {
  /* --------------------- Data / state --------------------- */
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Search + tri-state sorting (asc / desc / default)
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Entry row
  const [newProperty, setNewProperty] = useState<PropertyInput>({ ...emptyNewProperty });
  const [savingNew, setSavingNew] = useState(false);
  const [hoverAdd, setHoverAdd] = useState(false);

  // Row UI
  const [hoverRowId, setHoverRowId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<PropertyInput>({ ...emptyNewProperty });
  const [editSaving, setEditSaving] = useState(false);

  // Delete flow guards
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Top-of-table error banner
  const [bannerError, setBannerError] = useState<string | null>(null);

  // View page
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);

  // Preserve timestamps on refetch
  const prevMapRef = useRef<Record<number, PropertyRow>>({});

  /* --------------------- Effects --------------------- */
  useEffect(() => {
    void fetchProperties();
  }, []);

  /* --------------------- Derived --------------------- */
  const REQUIRED_FIELDS: Array<keyof PropertyInput> = ['property_name', 'address', 'owner', 'type', 'status'];
  const isReadyToAdd = REQUIRED_FIELDS.every((f) => newProperty[f].trim().length > 0);

  const tableWidth = useMemo(() => COLS.reduce((sum, c) => sum + c.width, 0), []);

  /* --------------------- API & Data helpers --------------------- */
  async function fetchProperties() {
    setLoading(true);
    try {
      const data: Property[] = await getProperties();
      const now = Date.now();
      const prevMap = prevMapRef.current;

      const rows: PropertyRow[] = (Array.isArray(data) ? data : [])
        .filter((p) => typeof p.property_id === 'number')
        .map((p) => {
          const prev = prevMap[p.property_id];
          return {
            ...p,
            created_at: prev?.created_at ?? now,
            updated_at: prev?.updated_at ?? now,
          };
        });

      setProperties(rows);
      prevMapRef.current = Object.fromEntries(rows.map((r) => [r.property_id, r]));
      setBannerError(null);
    } catch (err: any) {
      console.error(err);
      setBannerError(err?.response?.data?.message || err?.message || 'Failed to load properties.');
    } finally {
      setLoading(false);
    }
  }

  function moveRowToFront(id: number) {
    setProperties((prev) => {
      const idx = prev.findIndex((r) => r.property_id === id);
      if (idx < 0) return prev;
      const now = Date.now();
      const updated = [...prev];
      const [row] = updated.splice(idx, 1);
      const bumped = { ...row, updated_at: now };
      updated.unshift(bumped);
      prevMapRef.current[id] = bumped;
      return updated;
    });
  }

  /* --------------------- Entry row actions --------------------- */
  function resetNew() {
    setNewProperty({ ...emptyNewProperty });
  }

  async function handleAddProperty() {
    if (!isReadyToAdd) return;
    setSavingNew(true);
    try {
      await createProperty(newProperty);
      resetNew();
      await fetchProperties();
      // Best-effort bump newest (assume max id added last)
      setProperties((prev) => {
        if (prev.length === 0) return prev;
        const maxId = prev.reduce((m, r) => (r.property_id > m ? r.property_id : m), prev[0].property_id);
        return prev.sort((a, b) => (a.property_id === maxId ? -1 : b.property_id === maxId ? 1 : 0));
      });
      setBannerError(null);
    } catch (err: any) {
      console.error(err);
      setBannerError(err?.response?.data?.message || err?.message || 'Create failed.');
    } finally {
      setSavingNew(false);
    }
  }

  /* --------------------- Row edit / delete --------------------- */
  function startEdit(row: PropertyRow) {
    setEditingId(row.property_id);
    setEditValues({
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
      await updateProperty(id, editValues);
      setProperties((prev) =>
        prev.map((r) => (r.property_id === id ? { ...r, ...editValues, updated_at: Date.now() } : r))
      );
      moveRowToFront(id);
      setEditingId(null);
      setBannerError(null);
    } catch (err: any) {
      console.error(err);
      setBannerError(err?.response?.data?.message || err?.message || 'Update failed.');
    } finally {
      setEditSaving(false);
    }
  }

  function toggleEdit(row: PropertyRow) {
    if (editingId === row.property_id) void finishEdit(); // toggle off acts as save
    else startEdit(row);
  }

  async function handleDelete(id: number) {
    try {
      setDeletingId(id);
      await deleteProperty(id);
      setProperties((prev) => prev.filter((r) => r.property_id !== id));
      setConfirmDeleteId(null);
      if (selectedProperty === id) setSelectedProperty(null);
      setBannerError(null);
    } catch (err: any) {
      console.error(err);
      setBannerError(err?.response?.data?.message || err?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  /* --------------------- Search + sort --------------------- */
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = properties;

    if (q.length) {
      arr = properties.filter((p) => {
        return (
          p.property_name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
        );
      });
    }

    // Default order = current array order (we bump edited/added rows to front).
    if (!sortBy) return arr;

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      const va = String(a[sortBy] ?? '').toLowerCase();
      const vb = String(b[sortBy] ?? '').toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [properties, query, sortBy, sortDir]);

  /* --------------------- Early return: detail view --------------------- */
  if (selectedProperty !== null) {
    return (
      <PropertyView
        property_id={selectedProperty}
        onBack={() => setSelectedProperty(null)}
        refreshProperties={fetchProperties}
      />
    );
  }

  /* =========================================================
     Render
     ========================================================= */
  return (
    <Box
      style={{
        background: '#f4f4f0',
        minHeight: '100vh',
        fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
        padding: 0,
      }}
    >
      {/* App header */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '40px 40px 20px 40px',
          gap: 28,
        }}
      >
        <Image src={logo} alt="Logo" width={92} height={92} style={{ objectFit: 'contain' }} />
        <Title
          order={1}
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: '#111',
            letterSpacing: 2,
            fontFamily: 'inherit',
          }}
        >
          PROPERTY MANAGER
        </Title>
      </Box>

      <Divider
        style={{
          height: 7,
          background: '#111',
          boxShadow: '0px 5px 18px 0 rgba(0,0,0,0.18)',
          border: 'none',
          marginBottom: 28,
        }}
      />

      {/* PROPERTY LIST + Search */}
      <Box style={{ margin: '0 40px 12px 40px' }}>
        <Title
          order={2}
          style={{ fontWeight: 900, letterSpacing: 1, fontSize: 28, color: '#111' }}
        >
          PROPERTY LIST
        </Title>

        {/* Red error banner (like other tables) */}
        {bannerError && (
          <div
            role="alert"
            style={{
              width: COLS.reduce((s, c) => s + c.width, 0),
              border: '2px solid #c33',
              background: '#ffeaea',
              color: '#c33',
              fontWeight: 700,
              letterSpacing: 0.3,
              padding: '10px 14px',
              margin: '8px 0 12px',
            }}
          >
            {bannerError}
          </div>
        )}

        <div style={{ width: COLS.reduce((s, c) => s + c.width, 0), marginTop: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties (name, address, owner, type, status)…"
            style={{
              width: '100%',
              border: '2px solid #111',
              borderRadius: 0,
              padding: '12px 14px',
              fontSize: 16,
              outline: 'none',
              background: '#fff',
            }}
          />
        </div>
      </Box>

      {/* Entry row + ADD PROPERTY + Clear */}
      <Box style={{ margin: '0 40px 20px 40px', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <table
          style={{
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            background: '#fff',
            width: COLS.reduce((s, c) => s + c.width, 0),
            border: `${BORDER * 2}px solid #222`,
          }}
        >
          {/* Shared colgroup keeps PERFECT alignment with list below */}
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: `${c.width}px` }} />
            ))}
          </colgroup>

          <tbody>
            <tr style={{ height: ROW_HEIGHT }}>
              {COLS.map((c) => {
                const isSelect = c.key === 'type' || c.key === 'status';
                return (
                  <td key={c.key} style={{ ...sharedCellBase }}>
                    {isSelect ? (
                      <select
                        value={newProperty[c.key]}
                        onChange={(e) =>
                          setNewProperty((prev) => ({ ...prev, [c.key]: e.target.value }))
                        }
                        style={{
                          ...inputBaseStyle,
                          color: newProperty[c.key] ? '#111' : PLACEHOLDER, // gray placeholder when empty
                        }}
                      >
                        {/* options themselves are black */}
                        {c.key === 'type' ? (
                          <>
                            <option value="" style={{ color: '#111' }}>Type</option>
                            <option value="Commercial"  style={{ color: '#111' }}>Commercial</option>
                            <option value="Residential" style={{ color: '#111' }}>Residential</option>
                            <option value="Land"        style={{ color: '#111' }}>Land</option>
                          </>
                        ) : (
                          <>
                            <option value="" style={{ color: '#111' }}>Status</option>
                            <option value="Active"   style={{ color: '#111' }}>Active</option>
                            <option value="Pending"  style={{ color: '#111' }}>Pending</option>
                            <option value="Inactive" style={{ color: '#111' }}>Inactive</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <input
                        value={newProperty[c.key]}
                        onChange={(e) =>
                          setNewProperty((prev) => ({ ...prev, [c.key]: e.target.value }))
                        }
                        placeholder={c.title}
                        style={inputBaseStyle}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Add button + Clear icon on hover */}
        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setHoverAdd(true)}
          onMouseLeave={() => setHoverAdd(false)}
        >
          <Button
            onClick={handleAddProperty}
            disabled={!isReadyToAdd || savingNew}
            style={{
              border: '2px solid #111',
              borderRadius: 0,
              background: isReadyToAdd && !savingNew ? '#fff' : '#f2f2f2',
              color: '#111',
              fontWeight: 800,
              fontSize: 16,
              padding: '0 16px',
              textTransform: 'uppercase',
              letterSpacing: 1,
              height: ROW_HEIGHT + BORDER * 2,
              alignSelf: 'stretch',
              cursor: isReadyToAdd && !savingNew ? 'pointer' : 'not-allowed',
            }}
          >
            {savingNew ? 'Saving…' : 'ADD PROPERTY'}
          </Button>

          <button
            aria-label="Clear"
            title="Clear inputs"
            onClick={resetNew}
            style={{
              position: 'absolute',
              left: 'calc(100% + 8px)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: '2px solid #111',
              borderRadius: 6,
              padding: 4,
              cursor: 'pointer',
              lineHeight: 0,
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              opacity: hoverAdd ? 1 : 0,
              transition: 'opacity 160ms ease-in-out',
            }}
          >
            <MdOutlineClear size={18} />
          </button>
        </div>
      </Box>

      {/* Property table */}
      <Box style={{ margin: '0 40px' }}>
        <Table
          highlightOnHover
          style={{
            width: COLS.reduce((s, c) => s + c.width, 0),
            fontSize: FONT_SIZE,
            borderCollapse: 'collapse',
            border: '2px solid black',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)',
            fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: `${c.width}px` }} />
            ))}
          </colgroup>

          <thead>
            <tr style={{ height: 56 }}>
              {COLS.map((c) => (
                <HeaderCell
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
            ) : filteredSorted.length === 0 ? (
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
              filteredSorted.map((row, idx) => {
                const isEditing = editingId === row.property_id;
                const isDeleting = confirmDeleteId === row.property_id;
                const nameHighlighted = isEditing || isDeleting;

                return (
                  <tr
                    key={row.property_id}
                    onMouseEnter={() => setHoverRowId(row.property_id)}
                    onMouseLeave={() =>
                      setHoverRowId((prev) => (prev === row.property_id ? null : prev))
                    }
                  >
                    {COLS.map((c, ci) => {
                      const isFirst = ci === 0;
                      const isLast = ci === COLS.length - 1;

                      const cellStyle: React.CSSProperties = {
                        ...sharedCellBase,
                        borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                        ...(isFirst
                          ? {
                              background: nameHighlighted ? NAME_BG_HIGHLIGHT : NAME_BG,
                              fontWeight: 800,
                              position: 'relative',
                              boxShadow: nameHighlighted ? `inset 0 0 0 3px ${BLUE}` : 'none',
                              userSelect: 'none',
                              transition: 'background-color 140ms ease, box-shadow 140ms ease',
                            }
                          : {}),
                        ...(isLast ? { position: 'relative', paddingRight: 0, overflow: 'visible' } : {}),
                      };

                      return (
                        <td key={c.key} style={cellStyle}>
                          {/* Cell content: edit vs read */}
                          {isEditing ? (
                            c.key === 'type' || c.key === 'status' ? (
                              <select
                                value={editValues[c.key]}
                                onChange={(e) =>
                                  setEditValues((prev) => ({ ...prev, [c.key]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') void finishEdit();
                                }}
                                style={{
                                  ...inputBaseStyle,
                                  color: (editValues[c.key] || '').trim() ? '#111' : PLACEHOLDER,
                                }}
                              >
                                {c.key === 'type' ? (
                                  <>
                                    <option value="" style={{ color: '#111' }}>Type</option>
                                    <option value="Commercial"  style={{ color: '#111' }}>Commercial</option>
                                    <option value="Residential" style={{ color: '#111' }}>Residential</option>
                                    <option value="Land"        style={{ color: '#111' }}>Land</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="" style={{ color: '#111' }}>Status</option>
                                    <option value="Active"   style={{ color: '#111' }}>Active</option>
                                    <option value="Pending"  style={{ color: '#111' }}>Pending</option>
                                    <option value="Inactive" style={{ color: '#111' }}>Inactive</option>
                                  </>
                                )}
                              </select>
                            ) : (
                              <input
                                value={editValues[c.key]}
                                onChange={(e) =>
                                  setEditValues((prev) => ({ ...prev, [c.key]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') void finishEdit();
                                }}
                                placeholder={c.title}
                                style={inputBaseStyle}
                              />
                            )
                          ) : (
                            <PlaceholderOrValue value={row[c.key]} placeholder={c.title} />
                          )}

                          {/* Delete confirm overlay (to the right of the first cell) */}
                          {isFirst && isDeleting && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `calc(100% + 12px)`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 6,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ConfirmDelete
                                busy={deletingId === row.property_id}
                                onConfirm={() => handleDelete(row.property_id)}
                                onCancel={() => setConfirmDeleteId(null)}
                              />
                            </div>
                          )}

                          {/* Row actions (outside, to the right) */}
                          {isLast && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 'calc(100% + 8px)',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                gap: 10,
                                alignItems: 'center',
                                opacity: hoverRowId === row.property_id || isEditing ? 1 : 0,
                                transition: 'opacity 160ms ease-in-out',
                                pointerEvents: 'auto',
                                zIndex: 5,
                              }}
                              onMouseEnter={() => setHoverRowId(row.property_id)}
                              onMouseLeave={() =>
                                setHoverRowId((prev) => (prev === row.property_id ? null : prev))
                              }
                            >
                              <button
                                aria-label="View"
                                title="View"
                                onClick={() => setSelectedProperty(row.property_id)}
                                style={{
                                  background: 'transparent',
                                  border: '2px solid #111',
                                  borderRadius: 6,
                                  padding: 4,
                                  cursor: 'pointer',
                                  lineHeight: 0,
                                  width: 28,
                                  height: 28,
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <MdOutlinePageview size={18} />
                              </button>

                              <button
                                aria-label="Edit"
                                title={isEditing ? 'Finish Editing' : 'Edit'}
                                onClick={() => toggleEdit(row)}
                                style={{
                                  background: 'transparent',
                                  border: `2px solid ${isEditing ? BLUE : '#111'}`,
                                  borderRadius: 6,
                                  padding: 4,
                                  cursor: 'pointer',
                                  lineHeight: 0,
                                  width: 28,
                                  height: 28,
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <MdOutlineEdit size={18} />
                              </button>

                              <button
                                aria-label="Delete"
                                title="Delete"
                                onClick={() => setConfirmDeleteId(row.property_id)}
                                style={{
                                  background: 'transparent',
                                  border: '2px solid #111',
                                  borderRadius: 6,
                                  padding: 4,
                                  cursor: 'pointer',
                                  lineHeight: 0,
                                  width: 28,
                                  height: 28,
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <MdOutlineDelete size={18} />
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

      {/* Contacts section underneath */}
      <Box style={{ margin: '40px' }}>
        <ContactList />
      </Box>
    </Box>
  );
}
