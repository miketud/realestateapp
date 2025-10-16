// src/pages/ContactList.tsx
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { CSSProperties } from 'react';
import { Box, Table, Center, Loader } from '@mantine/core';
import { Icon, IconButton } from './ui/Icons';
import UniversalDropdown from './UniversalDropdown';
import BannerMessage from './ui/BannerMessage';

/* ========= Types ========= */
type Contact = {
  contact_id: number;
  name: string;
  phone: string; // digits only (10)
  email?: string;
  contact_type?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
};

type ContactCreatePayload = {
  name: string;
  phone: string; // digits only (10)
  email?: string;
  contact_type?: string;
  notes?: string;
};

type SortKey = 'name' | 'phone' | 'email' | 'contact_type';
type SortDir = 'asc' | 'desc';

/* ========= Constants ========= */
const CONTACT_TYPE_OPTIONS = [
  'Personal',
  'Tenant',
  'Owner',
  'Contractor',
  'Vendor',
  'Manager',
  'Emergency Contact',
  'Other',
] as const;

const NOTES_BG = '#bec8dfff';
const API = '/api/contacts';
const U = (s?: string) => (s ? s.toUpperCase() : '');
const EMPTY = '—';
function PlaceholderOrValue({ value }: { value?: any }) {
  const v = value == null || String(value).trim() === '' ? null : value;
  return v == null ? <span style={{ color: PLACEHOLDER }}>{EMPTY}</span> : <span>{String(v)}</span>;
}


const FONT_SIZE = 20;
const PLACEHOLDER = '#9aa1a8';
const ROW_H = 56;
const HEADER_FONT_SIZE = 16;
const HEADER_LINE_HEIGHT = '18px';
const HEADER_MIN_H = 52;
const DIVIDER = '1px solid rgba(0,0,0,0.18)';
const HEADER_RULE = '2px solid rgba(0,0,0,0.25)';

/* widen Type to fit "Emergency Contact" */
const COLS: Array<{ key: SortKey; title: string; width: number }> = [
  { key: 'name', title: 'Name', width: 360 },
  { key: 'phone', title: 'Phone', width: 240 },
  { key: 'email', title: 'Email', width: 420 },
  { key: 'contact_type', title: 'Type', width: 240 },
];

/* ========= Shared styles ========= */
const headerTh: CSSProperties = {
  padding: 0,
  background: 'transparent',
  color: '#2b2b2b',
  fontWeight: 800,
  letterSpacing: 0.3,
  textAlign: 'center',
  border: 'none',
  userSelect: 'none',
  verticalAlign: 'middle',
  minHeight: HEADER_MIN_H,
};
const cellBase: CSSProperties = {
  border: 'none',
  borderRight: DIVIDER,
  padding: '12px 10px',
  verticalAlign: 'middle',
  background: 'transparent',
  fontSize: FONT_SIZE,
  color: '#111',
  height: ROW_H,
  boxSizing: 'border-box',
  textAlign: 'center',
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
  textAlign: 'center',
};

const sortIcons = {
  asc: <Icon name="sortUp" />,
  desc: <Icon name="sortDown" />,
  none: <Icon name="sort" />,
} as const;

/* ========= Utils ========= */
const toDigits = (v: string) => (v || '').replace(/\D/g, '');
const clamp10 = (d: string) => d.slice(0, 10);
const fmtUSPhoneDisplay = (raw: string) => {
  const d = clamp10(toDigits(raw));
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);

/* ========= SmoothCollapse ========= */
function useMeasuredHeight<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T | null>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, h };
}

function SmoothCollapse({
  open,
  children,
  duration = 260,
}: {
  open: boolean;
  children: React.ReactNode;
  duration?: number;
}) {
  const { ref, h } = useMeasuredHeight<HTMLDivElement>([children, open]);
  return (
    <div
      style={{
        maxHeight: open ? h : 0,
        opacity: open ? 1 : 0,
        overflow: 'hidden',
        transition: `max-height ${duration}ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease`,
        willChange: 'max-height, opacity',
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

/* ========= Component ========= */
export default function ContactList() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [hoverHdr, setHoverHdr] = useState<SortKey | null>(null);

  const [draft, setDraft] = useState<{ name: string; phone: string; email: string; contact_type: string; notes: string }>({
    name: '', phone: '', email: '', contact_type: '', notes: '',
  });
  const readyToAdd = Boolean(draft.name.trim() && clamp10(toDigits(draft.phone)).length === 10);
  const hasNewInput = Object.values(draft).some((v) => String(v ?? '').trim().length > 0);
  const [savingNew, setSavingNew] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  const [edit, setEdit] = useState<{ name: string; phone: string; email: string; contact_type: string; notes: string }>({
    name: '', phone: '', email: '', contact_type: '', notes: '',
  });
  const [original, setOriginal] = useState<Contact | null>(null);

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = tableWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setExpandedIds(new Set());
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (confirmId !== null) {
      setConfirmText('');
      setTimeout(() => confirmInputRef.current?.focus(), 0);
    }
  }, [confirmId]);

  /* ========= API ========= */
  async function load() {
    setLoading(true);
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as any[];
      const now = Date.now();
      const arr: Contact[] = Array.isArray(data)
        ? data.map((c: any) => ({
          contact_id: Number(c.contact_id ?? now),
          name: String(c.name ?? ''),
          phone: clamp10(toDigits(String(c.phone ?? ''))),
          email: String(c.email ?? ''),
          contact_type: String(c.contact_type ?? ''),
          notes: String(c.notes ?? ''),
          created_at: Number(c.created_at ?? now),
          updated_at: Number(c.updated_at ?? now),
        }))
        : [];
      setRows(arr);
      setBannerError(null);
    } catch (e: any) {
      setBannerError(e?.message || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }

  async function apiCreate(payload: ContactCreatePayload): Promise<Contact> {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Contact;
  }
  async function apiPatch(id: number, patch: Partial<Contact>): Promise<Contact> {
    const r = await fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Contact;
  }
  async function apiDelete(id: number): Promise<void> {
    const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
  }

  function resetDraft() {
    setDraft({ name: '', phone: '', email: '', contact_type: '', notes: '' });
  }

  async function addContact() {
    if (!readyToAdd) return;
    setSavingNew(true);
    try {
      const payload: ContactCreatePayload = {
        name: draft.name.trim(),
        phone: clamp10(toDigits(draft.phone)),
        email: opt(draft.email),
        contact_type: opt(draft.contact_type),
        notes: opt(draft.notes),
      };
      await apiCreate(payload);
      resetDraft();
      await load();
      setSuccessMsg('Contact created.');
    } catch (e: any) {
      setBannerError(e?.message || 'Create failed.');
    } finally {
      setSavingNew(false);
    }
  }

  function startEdit(row: Contact) {
    setEditingId(row.contact_id);
    setOriginal(row);
    setEdit({
      name: row.name ?? '',
      phone: clamp10(toDigits(row.phone ?? '')),
      email: row.email ?? '',
      contact_type: row.contact_type ?? '',
      notes: row.notes ?? '',
    });
    setExpandedIds((prev) => new Set(prev).add(row.contact_id));
  }

  async function saveEditRow(id: number) {
    try {
      const patch: Partial<Contact> = {
        name: edit.name.trim(),
        phone: clamp10(toDigits(edit.phone)),
        email: opt(edit.email),
        contact_type: opt(edit.contact_type),
        notes: opt(edit.notes),
      };
      await apiPatch(id, patch);
      setEditingId(null);
      setOriginal(null);
      await load();
      setSuccessMsg('Saved.');
    } catch (e: any) {
      setBannerError(e?.message || 'Save failed.');
    }
  }

  async function doDelete(id: number) {
    try {
      await apiDelete(id);
      setConfirmId(null);
      setConfirmText('');
      setEditingId((cur) => (cur === id ? null : cur));
      setOriginal(null);
      await load();
      setSuccessMsg('Contact deleted.');
    } catch (e: any) {
      setBannerError(e?.message || 'Delete failed.');
    }
  }

  function clearAndExitEdit() {
    setEditingId(null);
    setOriginal(null);
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredSorted = useMemo(() => {
    const token = query.trim().toLowerCase();
    let list = rows;
    if (token) {
      list = list.filter((r) => {
        const phoneStr = fmtUSPhoneDisplay(r.phone).toLowerCase();
        const combined = `${r.name} ${r.email ?? ''} ${r.contact_type ?? ''} ${phoneStr} ${(r.notes ?? '').toLowerCase()}`;
        return combined.includes(token);
      });
    }
    const val = (obj: Contact, key: SortKey) =>
      key === 'phone' ? toDigits(obj.phone) : String((obj as any)[key] ?? '').toLowerCase();
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => val(a, sortKey).localeCompare(val(b, sortKey)) * dir);
  }, [rows, query, sortKey, sortDir]);

  const TABLE_W = useMemo(() => COLS.reduce((s, c) => s + c.width, 0), []);

  /* Header cell with PropertyList hover style */
  const header = (c: { key: SortKey; title: string; width: number }) => {
    const active = c.key === sortKey;
    const onClick = () => {
      if (!active) { setSortKey(c.key); setSortDir('asc'); }
      else { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    };
    const icon = !active ? sortIcons.none : sortDir === 'asc' ? sortIcons.asc : sortIcons.desc;
    const hovered = hoverHdr === c.key;

    return (
      <th key={c.key} style={{ ...headerTh, width: c.width, borderBottom: HEADER_RULE }}>
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setHoverHdr(c.key)}
          onMouseLeave={() => setHoverHdr((k) => (k === c.key ? null : k))}
          style={{
            width: '100%',
            minHeight: HEADER_MIN_H,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            boxShadow: hovered ? '0 6px 16px rgba(0,0,0,0.18)' : 'none', // match PropertyList
            transition: 'box-shadow 160ms ease',
            fontWeight: 800,
            color: '#2b2b2b',
            textTransform: 'uppercase',
            lineHeight: HEADER_LINE_HEIGHT,
            fontSize: HEADER_FONT_SIZE,
            textAlign: 'center',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          <span style={{ pointerEvents: 'none', maxWidth: 'calc(100% - 28px)' }}>
            {c.title.toUpperCase()}
          </span>
          <span style={{ pointerEvents: 'none', display: 'inline-flex' }}>{icon}</span>
        </button>
      </th>
    );
  };

  return (
    <Box style={{ position: 'relative', marginTop: 24 }}>
      <div
        ref={tableWrapRef}
        style={{
          width: '100%',
          overflow: 'visible',
          transformOrigin: 'top center',
          transform: mounted ? 'scaleY(1)' : 'scaleY(0.96)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 420ms ease, opacity 420ms ease',
        }}
      >
        <div style={{ position: 'relative', width: TABLE_W, margin: '0 auto', paddingTop: ROW_H + 8 }}>
          <div style={{ position: 'absolute', right: 0, top: 0 }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts…"
              style={{ height: ROW_H, minWidth: 320, border: '2px solid #111', padding: '0 12px', fontSize: FONT_SIZE, background: '#fff' }}
            />
          </div>

          <Table
            highlightOnHover={false}
            style={{
              width: TABLE_W,
              fontSize: FONT_SIZE,
              borderCollapse: 'collapse',
              borderSpacing: 0,
              tableLayout: 'fixed',
              background: 'transparent',
            }}
          >
            <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>

            <thead>
              <tr style={{ height: 'auto' }}>{COLS.map((c) => header(c))}</tr>
            </thead>

            <tbody>
              {/* Entry row */}
              <tr style={{ height: ROW_H }}>
                {COLS.map((c, ci) => {
                  const last = ci === COLS.length - 1;
                  let content: React.ReactNode;

                  if (c.key === 'contact_type') {
                    content = (
                      <UniversalDropdown
                        value={draft.contact_type || null}
                        placeholder="Type"
                        options={CONTACT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                        onChange={(v) => setDraft((p) => ({ ...p, contact_type: v }))}
                        ariaLabel="Contact type"
                      />
                    );
                  } else if (c.key === 'phone') {
                    content = (
                      <input
                        value={fmtUSPhoneDisplay(draft.phone)}
                        onChange={(e) => setDraft((p) => ({ ...p, phone: clamp10(toDigits(e.target.value)) }))}
                        placeholder="(555) 555-5555"
                        style={{ ...inputBase, fontWeight: 600, fontSize: 16 }}
                      />
                    );
                  } else if (c.key === 'email') {
                    content = (
                      <input
                        value={draft.email}
                        onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                        placeholder="Email"
                        style={inputBase}
                      />
                    );
                  } else if (c.key === 'name') {
                    content = (
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="ADD NAME"
                        style={{ ...inputBase, fontWeight: 700 }}
                      />
                    );
                  } else {
                    content = null;
                  }

                  return (
                    <td
                      key={c.key}
                      style={{
                        ...cellBase,
                        background: 'rgba(0,0,0,0.06)',
                        borderRight: last ? 'none' : DIVIDER,
                        ...(last ? { overflow: 'visible', position: 'relative' } : {}),
                      }}
                    >
                      {content}

                      {last && (
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
                            <IconButton icon="addCircle" label={savingNew ? 'Saving…' : 'Save'} onClick={addContact} disabled={savingNew} />
                          )}
                          {Object.values(draft).some((v) => String(v ?? '').trim().length > 0) && (
                            <IconButton icon="cancel" label="Clear" onClick={resetDraft} />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Entry notes */}
              <tr>
                <td colSpan={COLS.length} style={{ padding: 0, border: 'none' }}>
                  <SmoothCollapse open={hasNewInput}>
                    <div style={{ background: '#fff', fontSize: 16, color: '#111', padding: 8 }}>
                      <textarea
                        value={draft.notes}
                        onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Notes…"
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  </SmoothCollapse>
                </td>
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
                    No contacts found.
                  </td>
                </tr>
              ) : (
                filteredSorted.flatMap((row) => {
                  const isEditing = editingId === row.contact_id;
                  const isConfirming = confirmId === row.contact_id;
                  const isFocused = isEditing || isConfirming;
                  const rowHovered = hoverId === row.contact_id;
                  const dimOthers = (editingId ?? confirmId ?? null) !== null && !isFocused;
                  const isExpanded = expandedIds.has(row.contact_id);
                  const isHighlighted = rowHovered && !dimOthers && !isFocused;

                  const mainRow = (
                    <tr
                      key={`row-${row.contact_id}`}
                      onMouseEnter={() => setHoverId(row.contact_id)}
                      onMouseLeave={() => setHoverId((p) => (p === row.contact_id ? null : p))}
                      style={{ height: ROW_H, transition: 'opacity 120ms ease', opacity: dimOthers ? 0.5 : 1, position: 'relative' }}
                    >
                      {COLS.map((c, ci) => {
                        const first = ci === 0;
                        const last = ci === COLS.length - 1;

                        const styleCell: CSSProperties = {
                          ...cellBase,
                          position: 'relative',
                          background: isHighlighted ? '#d6e7ffff' : (dimOthers ? '#2b2b2b' : 'transparent'),
                          color: dimOthers ? '#cfd6dd' : '#111',
                          // keep the divider light and consistent
                          borderRight: last ? 'none' : DIVIDER,
                          // REQUIRED so the action rail outside the cell remains clickable
                          ...(last ? { overflow: 'visible' } : {}),
                          ...(first ? { userSelect: 'none', cursor: 'pointer', fontWeight: 700 } : {}),
                        };


                        const toggleIfName = () => {
                          if (!isEditing && !isConfirming) toggleExpanded(row.contact_id);
                        };

                        return (
                          <td
                            key={c.key}
                            style={styleCell}
                            {...(first
                              ? {
                                onClick: toggleIfName,
                                role: 'button',
                                tabIndex: 0,
                                onKeyDown: (e: React.KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleIfName(); }
                                },
                                title: isExpanded ? 'Hide notes' : 'Show notes',
                              }
                              : {})}
                          >
                            {isEditing ? (
                              c.key === 'contact_type' ? (
                                <UniversalDropdown
                                  value={edit.contact_type || null}
                                  placeholder="Type"
                                  options={CONTACT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                                  onChange={(v) => setEdit((p) => ({ ...p, contact_type: v }))}
                                  ariaLabel="Contact type"
                                />
                              ) : c.key === 'phone' ? (
                                <input
                                  value={fmtUSPhoneDisplay(edit.phone)}
                                  onChange={(e) => setEdit((p) => ({ ...p, phone: clamp10(toDigits(e.target.value)) }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingId != null) { e.preventDefault(); void saveEditRow(editingId); }
                                    if (e.key === 'Escape') clearAndExitEdit();
                                  }}
                                  placeholder="(555) 555-5555"
                                  style={{ ...inputBase, fontWeight: 600, fontSize: 16 }}
                                />
                              ) : c.key === 'name' ? (
                                <input
                                  value={edit.name}
                                  onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingId != null) { e.preventDefault(); void saveEditRow(editingId); }
                                    if (e.key === 'Escape') clearAndExitEdit();
                                  }}
                                  placeholder="Name"
                                  style={{ ...inputBase, fontWeight: 700 }}
                                />
                              ) : c.key === 'email' ? (
                                <input
                                  value={edit.email}
                                  onChange={(e) => setEdit((p) => ({ ...p, email: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingId != null) { e.preventDefault(); void saveEditRow(editingId); }
                                    if (e.key === 'Escape') clearAndExitEdit();
                                  }}
                                  placeholder="Email"
                                  style={inputBase}
                                />
                              ) : null
                            ) : c.key === 'phone' ? (
                              (() => {
                                const val = fmtUSPhoneDisplay(row.phone);
                                return val ? (
                                  <span title={val}>{val}</span>
                                ) : (
                                  <span style={{ color: PLACEHOLDER }}>{EMPTY}</span>
                                );
                              })()
                            ) : c.key === 'name' ? (
                              row.name ? (
                                <span title={row.name}>{U(row.name)}</span>
                              ) : (
                                <span style={{ color: PLACEHOLDER }}>{EMPTY}</span>
                              )
                            ) : c.key === 'email' ? (
                              <PlaceholderOrValue value={row.email} />
                            ) : c.key === 'contact_type' ? (
                              <PlaceholderOrValue value={row.contact_type} />
                            ) : null}

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
                                  opacity: hoverId === row.contact_id || isEditing || isConfirming ? 1 : 0,
                                  transition: 'opacity 160ms ease-in-out',
                                  pointerEvents: 'auto',
                                  zIndex: 1500,
                                }}
                              >
                                {!isConfirming && (
                                  <>
                                    {isEditing ? (
                                      <>
                                        {/* Clear first, then Save */}
                                        <IconButton icon="cancel" label="Clear" onClick={clearAndExitEdit} />
                                        <IconButton icon="addCircle" label="Save" onClick={() => void saveEditRow(row.contact_id)} />
                                        <IconButton
                                          icon="delete"
                                          label="Delete"
                                          onClick={() => setConfirmId((prev) => (prev === row.contact_id ? null : row.contact_id))}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <IconButton icon="edit" label="Edit" onClick={() => startEdit(row)} />
                                        <IconButton
                                          icon="delete"
                                          label="Delete"
                                          onClick={() => setConfirmId((prev) => (prev === row.contact_id ? null : row.contact_id))}
                                        />
                                      </>
                                    )}
                                  </>
                                )}

                                <div style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center' }}>
                                  <div
                                    style={{
                                      width: confirmId === row.contact_id ? 90 : 0,
                                      height: ROW_H,
                                      overflow: 'hidden',
                                      transition: 'width 180ms ease',
                                      border: confirmId === row.contact_id ? '2px solid #c33' : '2px solid transparent',
                                      background: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {confirmId === row.contact_id && (
                                      <input
                                        ref={confirmInputRef}
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && confirmText.trim().toUpperCase() === 'DELETE') void doDelete(row.contact_id);
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
                                          fontSize: 16,
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {confirmId === row.contact_id && (
                                  <IconButton
                                    icon="cancel"
                                    label="Cancel"
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

                  const notesRow = (
                    <tr key={`notes-${row.contact_id}`}>
                      <td colSpan={COLS.length} style={{ padding: 0, border: 'none' }}>
                        <SmoothCollapse open={isExpanded}>
                          <div style={{ background: NOTES_BG, borderBottom: '#111', fontSize: 16, color: '#111', padding: 8 }}>
                            {isEditing ? (
                              <textarea
                                value={edit.notes}
                                onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Escape') clearAndExitEdit(); }}
                                placeholder="Notes…"
                                rows={3}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  resize: 'vertical',
                                }}
                              />
                            ) : (
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {row.notes ? (
                                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.notes}</div>
                                ) : (
                                  <span style={{ color: PLACEHOLDER }}>{EMPTY}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </SmoothCollapse>
                      </td>
                    </tr>
                  );

                  return [mainRow, notesRow];
                })
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {bannerError && <BannerMessage kind="error" message={bannerError} inline maxWidth={TABLE_W} />}
      {successMsg && <BannerMessage kind="success" message={successMsg} inline={false} autoHideMs={2400} onClose={() => setSuccessMsg(null)} />}
    </Box>
  );
}
