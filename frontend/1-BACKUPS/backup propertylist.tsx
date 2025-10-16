// src/components/PropertyList.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Box, Table, Loader, Center } from '@mantine/core';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import PropertyView from './PropertyView';
import { Icon, IconButton } from './ui/Icons';
import UniversalDropdown from './UniversalDropdown';
import BannerMessage from './ui/BannerMessage';

type PropertyInput = {
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
};
type Property = PropertyInput & { property_id: number };
type PropertyRow = Property;

type Props = { onOpenProperty?: (id: number) => void };

const COLS: Array<{ key: keyof PropertyInput; title: string; width: number }> = [
  { key: 'property_name', title: 'Property', width: 360 },
  { key: 'address', title: 'Address', width: 420 },
  { key: 'owner', title: 'Owner', width: 240 },
  { key: 'type', title: 'Type', width: 180 },
  { key: 'status', title: 'Status', width: 160 },
];

const STATUS_OPTIONS = ['Vacant', 'Pending', 'Leased', 'Subleased', 'Financed'] as const;
const TYPE_OPTIONS = ['Commercial', 'Residential', 'Land'] as const;

const FONT_SIZE = 20;
const PLACEHOLDER = '#9aa1a8';
const NAME_BG = '#f3f3f3';
const ROW_H = 56;

const headerTh: CSSProperties = {
  border: '1px solid #111',
  padding: '10px 12px',
  background: '#111',
  color: '#fff',
  fontWeight: 700,
  letterSpacing: 0.3,
  position: 'relative',
  textAlign: 'center',
  lineHeight: 1,
  height: ROW_H,
};
const cellBase: CSSProperties = {
  border: '1px solid #222',
  padding: '10px',
  verticalAlign: 'middle',
  background: '#fff',
  fontSize: FONT_SIZE,
  color: '#111',
  height: ROW_H,
  boxSizing: 'border-box',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const inputBase: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: FONT_SIZE,
  color: 'inherit',
  padding: 0,
  margin: 0,
};

const sorters = {
  asc: <Icon name="sortUp" />,
  desc: <Icon name="sortDown" />,
  none: <Icon name="sort" />,
} as const;

function PlaceholderOrValue({ value }: { value?: any }) {
  const v = value == null || String(value).trim() === '' ? null : value;
  return v == null ? <span style={{ color: PLACEHOLDER }}>—</span> : <span>{String(v)}</span>;
}

export default function PropertyList({ onOpenProperty }: Props) {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<keyof PropertyRow>('property_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [newRow, setNewRow] = useState<PropertyInput>({
    property_name: '', address: '', owner: '', type: '', status: '',
  });
  const [savingNew, setSavingNew] = useState(false);

  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<PropertyInput>({ property_name: '', address: '', owner: '', type: '', status: '' });

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.text())))
      .then((data: any[]) => {
        const names = Array.isArray(data) ? data.map((c) => String(c?.name ?? '')).filter(Boolean) : [];
        const uniq: string[] = [];
        for (const n of names) if (!uniq.includes(n)) uniq.push(n);
        setContactNames(uniq);
      })
      .catch(() => void 0);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (confirmId !== null) {
      setConfirmText('');
      setTimeout(() => confirmInputRef.current?.focus(), 0);
    }
  }, [confirmId]);
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 2400);
    return () => clearTimeout(t);
  }, [successMsg]);

  const TABLE_W = useMemo(() => COLS.reduce((s, c) => s + c.width, 0), []);
  const effectiveName = (r: PropertyRow) => r.property_name || '';
  const readyToAdd = ['property_name', 'address'].every((k) => String((newRow as any)[k]).trim().length > 0);

  async function load() {
    setLoading(true);
    try {
      const data: Property[] = await getProperties();
      setRows((data || []).map((p) => ({ ...p })));
      setBannerError(null);
    } catch (e: any) {
      setBannerError(e?.response?.data?.message || e?.message || 'Failed to load properties.');
    } finally {
      setLoading(false);
    }
  }

  function resetNew() { setNewRow({ property_name: '', address: '', owner: '', type: '', status: '' }); }

  async function addProperty() {
    if (!readyToAdd) return;
    setSavingNew(true);
    try {
      await createProperty(newRow);
      resetNew();
      await load();
      setSuccessMsg('Property created.');
    } catch (e: any) {
      setBannerError(e?.response?.data?.message || e?.message || 'Create failed.');
    } finally {
      setSavingNew(false);
    }
  }

  async function saveEditRow(id: number) {
    try {
      await updateProperty(id, edit);
      setEditingId(null);
      await load();
      setSuccessMsg('Saved.');
    } catch (e: any) {
      setBannerError(e?.response?.data?.message || e?.message || 'Save failed.');
    }
  }

  async function doDelete(id: number) {
    try {
      await deleteProperty(id);
      setConfirmId(null);
      setConfirmText('');
      await load();
      setSuccessMsg('Property deleted.');
    } catch (e: any) {
      setBannerError(e?.response?.data?.message || e?.message || 'Delete failed.');
    }
  }

  function toggleEdit(row: PropertyRow) {
    if (editingId === row.property_id) {
      void saveEditRow(row.property_id);
    } else {
      setEditingId(row.property_id);
      setEdit({
        property_name: row.property_name,
        address: row.address,
        owner: row.owner,
        type: row.type,
        status: row.status,
      });
    }
  }

  const filteredSorted = useMemo(() => {
    const token = query.trim().toLowerCase();
    let list = rows;
    if (token) {
      list = list.filter((r) =>
        (r.property_name + ' ' + r.address + ' ' + r.owner + ' ' + r.type + ' ' + r.status).toLowerCase().includes(token)
      );
    }
    const aVal = (x: any) => String(x ?? '').toLowerCase();
    return list.slice().sort((a: any, b: any) => {
      const av = aVal(a[sortKey]);
      const bv = aVal(b[sortKey]);
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, query, sortKey, sortDir]);

  const header = (c: { key: keyof PropertyInput; title: string; width: number }) => {
    const active = c.key === sortKey;
    const onClick = () => {
      if (!active) { setSortKey(c.key as keyof PropertyRow); setSortDir('asc'); }
      else { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    };
    const icon = !active ? sorters.none : sortDir === 'asc' ? sorters.asc : sorters.desc;

    return (
      <th key={c.key} style={{ ...headerTh, width: c.width }}>
        <button
          type="button"
          onClick={onClick}
          style={{ all: 'unset', cursor: 'pointer', display: 'inline-block', width: '100%', height: '100%', textAlign: 'left', paddingRight: 32 }}
        >
          {c.title}
        </button>
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}>
          {icon}
        </span>
      </th>
    );
  };

  if (!onOpenProperty && selectedId !== null) return <PropertyView property_id={selectedId} />;

  return (
    <Box style={{ position: 'relative', marginTop: 24 }}>
      {/* Whole table open-down animation wrapper */}
      <div
        style={{
          width: '100%',
          overflow: 'visible',                 // allow search to extend above
          transformOrigin: 'top center',
          transform: mounted ? 'scaleY(1)' : 'scaleY(0.96)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 420ms ease, opacity 420ms ease',
        }}
      >
        {/* Add top padding equal to search height so it sits “inside” the wrapper */}
        <div style={{ position: 'relative', width: TABLE_W, margin: '0 auto', paddingTop: ROW_H + 8 }}>
          {/* Search anchored to table top-right */}
          <div style={{ position: 'absolute', right: 0, top: 0 }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties…"
              style={{ height: ROW_H, minWidth: 320, border: '2px solid #111', padding: '0 12px', fontSize: FONT_SIZE, background: '#fff' }}
            />
          </div>

          <Table
            highlightOnHover
            style={{
              width: TABLE_W,
              fontSize: FONT_SIZE,
              borderCollapse: 'collapse',
              border: '1px solid black',
              boxShadow: '0 12px 28px rgba(0,0,0,0.16), inset 0 0 10px rgba(0,0,0,0.08)',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>

            <thead>
              <tr>{COLS.map((c) => header(c))}</tr>
            </thead>

            <tbody>
              {/* Entry row with inner shadow + 3px inner border */}
              <tr style={{ height: ROW_H }}>
                {COLS.map((c, ci) => {
                  const isLast = ci === COLS.length - 1;

                  let content: React.ReactNode;
                  if (c.key === 'owner') {
                    content = (
                      <UniversalDropdown
                        value={newRow.owner || null}
                        placeholder="Owner"
                        options={contactNames.map((n) => ({ value: n, label: n }))}
                        onChange={(v) => setNewRow((p) => ({ ...p, owner: v }))}
                        ariaLabel="Owner"
                        searchable
                      />
                    );
                  } else if (c.key === 'type') {
                    content = (
                      <UniversalDropdown
                        value={newRow.type || null}
                        placeholder="Type"
                        options={TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                        onChange={(v) => setNewRow((p) => ({ ...p, type: v }))}
                        ariaLabel="Type"
                      />
                    );
                  } else if (c.key === 'status') {
                    content = (
                      <UniversalDropdown
                        value={newRow.status || null}
                        placeholder="Status"
                        options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))}
                        onChange={(v) => setNewRow((p) => ({ ...p, status: v }))}
                        ariaLabel="Status"
                      />
                    );
                  } else {
                    // center typing for Property and Address
                    const center = c.key === 'property_name' || c.key === 'address';
                    content = (
                      <input
                        value={(newRow as any)[c.key] ?? ''}
                        onChange={(e) => setNewRow((p) => ({ ...p, [c.key]: e.target.value }))}
                        placeholder={c.title}
                        style={{ ...inputBase, textAlign: center ? 'center' : 'left' }}
                      />
                    );
                  }

                  return (
                    <td
                      key={c.key}
                      style={{
                        ...cellBase,
                        position: 'relative',
                        overflow: 'visible',
                        boxShadow: 'inset 0 0 14px rgba(0,0,0,0.10), inset 0 0 0 3px #111',
                      }}
                    >
                      {content}

                      {isLast && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 'calc(100% + 8px)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            zIndex: 1500,
                          }}
                        >
                          {readyToAdd && (
                            <IconButton
                              icon="addCircle"
                              label={savingNew ? 'Saving…' : 'Save'}
                              onClick={addProperty}
                              disabled={savingNew}
                            />
                          )}
                          {Object.values(newRow).some((v) => String(v ?? '').trim().length > 0) && (
                            <IconButton icon="cancel" label="Clear" onClick={resetNew} />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Data rows */}
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
                  <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 22, background: '#fff' }}>
                    No properties found.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((row, idx) => {
                  const isEditing = editingId === row.property_id;
                  const isConfirming = confirmId === row.property_id;
                  const rowHovered = hoverId === row.property_id;
                  const dimOthers = (editingId ?? confirmId ?? null) !== null && !(isEditing || isConfirming);

                  const transformValue = rowHovered && !dimOthers && !(isEditing || isConfirming) ? 'translateY(-2px)' : 'none';
                  const opacityValue = dimOthers ? 0.5 : 1;

                  return (
                    <tr
                      key={row.property_id}
                      onMouseEnter={() => setHoverId(row.property_id)}
                      onMouseLeave={() => setHoverId((p) => (p === row.property_id ? null : p))}
                      style={{
                        height: ROW_H,
                        transform: transformValue,
                        opacity: opacityValue,
                        transition: 'transform 120ms ease, filter 120ms ease, opacity 120ms ease',
                        filter: rowHovered && !dimOthers && !isEditing && !isConfirming ? 'drop-shadow(0 8px 14px rgba(0,0,0,0.18))' : 'none',
                        position: 'relative',
                      }}
                    >
                      {COLS.map((c, ci) => {
                        const first = ci === 0;
                        const last = ci === COLS.length - 1;

                        const styleCell: CSSProperties = {
                          ...cellBase,
                          borderTop: idx === 0 ? '1px solid #222' : '2px solid #222',
                          ...(first
                            ? { background: NAME_BG, fontWeight: 700, userSelect: 'none', cursor: !isEditing && !isConfirming ? 'pointer' : 'default' }
                            : {}),
                          position: 'relative',
                          overflow: 'visible',
                          paddingRight: last ? 0 : 10,
                          ...(dimOthers ? { background: '#2b2b2b', color: '#cfd6dd', borderColor: '#333' } : {}),
                        };

                        const open = () => {
                          if (onOpenProperty) onOpenProperty(row.property_id);
                          else setSelectedId(row.property_id);
                        };

                        return (
                          <td
                            key={c.key}
                            style={styleCell}
                            {...(first && !isEditing && !isConfirming
                              ? {
                                  onClick: open,
                                  role: 'button',
                                  tabIndex: 0,
                                  onKeyDown: (e: React.KeyboardEvent) => {
                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                                    if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur();
                                  },
                                  title: 'View property',
                                }
                              : {})}
                          >
                            {isEditing ? (
                              c.key === 'type' ? (
                                <UniversalDropdown
                                  value={edit.type || null}
                                  placeholder="Type"
                                  options={TYPE_OPTIONS.map((v) => ({ value: v, label: v }))}
                                  onChange={(v) => setEdit((p) => ({ ...p, type: v }))}
                                  ariaLabel="Type"
                                />
                              ) : c.key === 'status' ? (
                                <UniversalDropdown
                                  value={edit.status || null}
                                  placeholder="Status"
                                  options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))}
                                  onChange={(v) => setEdit((p) => ({ ...p, status: v }))}
                                  ariaLabel="Status"
                                />
                              ) : c.key === 'owner' ? (
                                <UniversalDropdown
                                  value={edit.owner || null}
                                  placeholder="Owner"
                                  options={contactNames.map((n) => ({ value: n, label: n }))}
                                  onChange={(v) => setEdit((p) => ({ ...p, owner: v }))}
                                  ariaLabel="Owner"
                                  searchable
                                />
                              ) : (
                                // center typing for Property and Address in edit mode too
                                <input
                                  value={(edit as any)[c.key] ?? ''}
                                  onChange={(e) => setEdit((p) => ({ ...p, [c.key]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingId != null) { e.preventDefault(); void saveEditRow(editingId); }
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  placeholder={c.title}
                                  style={{ ...inputBase, textAlign: c.key === 'property_name' || c.key === 'address' ? 'center' : 'left' }}
                                />
                              )
                            ) : c.key === 'property_name' ? (
                              <span>{effectiveName(row)}</span>
                            ) : (
                              <PlaceholderOrValue value={(row as any)[c.key]} />
                            )}

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
                                  zIndex: 1500,
                                }}
                              >
                                {!isConfirming && (
                                  <>
                                    {isEditing ? (
                                      <>
                                        <IconButton icon="addCircle" label="Save" onClick={() => void saveEditRow(row.property_id)} />
                                        <IconButton icon="cancel" label="Cancel" onClick={() => setEditingId(null)} />
                                      </>
                                    ) : (
                                      <IconButton icon="edit" label="Edit" onClick={() => toggleEdit(row)} />
                                    )}
                                    <IconButton icon="delete" label="Delete" onClick={() => setConfirmId((prev) => (prev === row.property_id ? null : row.property_id))} />
                                  </>
                                )}

                                <div style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center' }}>
                                  <div
                                    style={{
                                      width: confirmId === row.property_id ? 90 : 0,
                                      height: ROW_H,
                                      overflow: 'hidden',
                                      transition: 'width 180ms ease',
                                      border: confirmId === row.property_id ? '2px solid #c33' : '2px solid transparent',
                                      background: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {confirmId === row.property_id && (
                                      <input
                                        ref={confirmInputRef}
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && confirmText.trim().toUpperCase() === 'DELETE') void doDelete(row.property_id);
                                          if (e.key === 'Escape') setConfirmId(null);
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
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {confirmId === row.property_id && (
                                  <IconButton
                                    icon="cancel"
                                    label="Cancel"
                                    onClick={() => { setConfirmId(null); setConfirmText(''); }}
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
        </div>
      </div>

{bannerError && (
  <BannerMessage kind="error" message={bannerError} inline maxWidth={TABLE_W} />
)}
{successMsg && (
  <BannerMessage
    kind="success"
    message={successMsg}
    inline={false}
    autoHideMs={2400}
    onClose={() => setSuccessMsg(null)}
  />
)}
    </Box>
  );
}
