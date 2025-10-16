// src/pages/ContactList.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Box, Table, Center, Loader } from '@mantine/core';
import { Icon, IconButton } from './ui/Icons';
import UniversalDropdown from './UniversalDropdown';
import ContactTypeTag from './ContactTypeTag';
import { MdViewList } from 'react-icons/md';

/* ========= Types ========= */
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

type ContactCreatePayload = {
  name: string;
  phone: string;
  email?: string;
  contact_type?: string;
  notes?: string;
};
const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);

type SortKey = 'name' | 'phone' | 'email' | 'contact_type' | null;
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

const API = '/api/contacts';

const FONT_SIZE = 18;
const PLACEHOLDER = '#9aa1a8';
const NAME_BG = '#f3f3f3';
const NAME_BG_HL = '#eaf1ff';

const ICON_H = 56;            // toolbar icon size only
const ENTRY_ROW_H = 56;
const BORDER = 1;
const LANE_TRANSITION = 'max-width 300ms ease, opacity 300ms ease, transform 300ms ease';

const COLS: Array<{ key: Exclude<SortKey, null> | 'notes'; title: string; width: number }> = [
  { key: 'name', title: 'Name', width: 300 },
  { key: 'phone', title: 'Phone', width: 240 },
  { key: 'email', title: 'Email', width: 300 },
  { key: 'contact_type', title: 'Type', width: 240 },
];

/* ========= Helpers ========= */
const toDigits = (v: string) => (v || '').replace(/\D/g, '');
const clamp10 = (d: string) => d.slice(0, 10);

const fmtUSPhoneDisplay = (raw: string) => {
  const d = clamp10(toDigits(raw));
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/* ========= Shared cell/input styles ========= */
const headerTh: CSSProperties = {
  border: '1px solid #111',
  padding: '10px 12px',
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  letterSpacing: 0.3,
  position: 'relative',
  textAlign: 'center',
  lineHeight: 1,
  userSelect: 'none',
  cursor: 'pointer',
};

const cellBase: CSSProperties = {
  border: `${BORDER}px solid #222`,
  padding: '10px',
  verticalAlign: 'middle',
  background: '#fff',
  fontSize: FONT_SIZE,
  color: '#111',
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
  color: 'inherit',
  background: 'transparent',
  display: 'block',
};

/* ========= Component ========= */
export default function ContactList() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // toolbar states
  const [addOpen, setAddOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  // add draft
  const [draft, setDraft] = useState<{ name: string; phone: string; email: string; contact_type: string; notes: string }>({
    name: '', phone: '', email: '', contact_type: '', notes: '',
  });

  const readyToAdd = Boolean(draft.name.trim() && clamp10(toDigits(draft.phone)).length === 10);
  const hasNewInput = Object.values(draft).some((v) => String(v ?? '').trim().length > 0);

  // editing + row states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  // delete confirm
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  // search
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  // sort
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // expanded notes row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // errors
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // live phone drafts when editing
  const [phoneDrafts, setPhoneDrafts] = useState<Record<number, string>>({});

  // effects
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); else setQuery(''); }, [searchOpen]);
  useEffect(() => { if (query.trim().length) setListOpen(true); }, [query]);
  useEffect(() => {
    if (confirmId !== null) {
      setConfirmText('');
      setTimeout(() => confirmInputRef.current?.focus(), 0);
    }
  }, [confirmId]);
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 2500);
    return () => clearTimeout(t);
  }, [successMsg]);

  /* ========= API ========= */
  async function load() {
    setLoading(true);
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as Contact[] | any[];
      const arr: Contact[] = Array.isArray(data) ? data.map(normalizeLoaded) : [];
      setRows(arr);
      setBannerError(null);
    } catch (e: any) {
      setBannerError(e?.message || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }

  function normalizeLoaded(c: any): Contact {
    const now = Date.now();
    return {
      contact_id: Number(c.contact_id ?? now),
      name: String(c.name ?? ''),
      phone: String(c.phone ?? ''),
      email: String(c.email ?? ''),
      contact_type: String(c.contact_type ?? ''),
      notes: String(c.notes ?? ''),
      created_at: Number(c.created_at ?? now),
      updated_at: Number(c.updated_at ?? now),
    };
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

  /* ========= Add / Edit / Delete ========= */
  const resetDraft = () => setDraft({ name: '', phone: '', email: '', contact_type: '', notes: '' });

  const addContact = async () => {
    if (!readyToAdd) return;
    try {
      const payload: ContactCreatePayload = {
        name: draft.name.trim(),
        phone: clamp10(toDigits(draft.phone)),
        email: opt(draft.email),
        contact_type: opt(draft.contact_type),
        notes: opt(draft.notes),
      };
      // optimistic insert
      const tempId = Date.now();
      const optimistic: Contact = {
        contact_id: tempId,
        name: payload.name!,
        phone: payload.phone!,
        email: String(payload.email ?? ''),
        contact_type: String(payload.contact_type ?? ''),
        notes: String(payload.notes ?? ''),
        created_at: tempId,
        updated_at: tempId,
      };
      setRows((p) => [...p, optimistic]);
      resetDraft();

      const saved = await apiCreate(payload);
      setRows((p) => p.map((c) => (c.contact_id === tempId ? normalizeLoaded(saved) : c)));
      setSuccessMsg('Contact created.');
    } catch (e: any) {
      // rollback
      setRows((p) => p.filter((c) => c.created_at !== optimisticCreatedAtGuess(p)));
      setBannerError(e?.message || 'Create failed.');
    }
  };
  const optimisticCreatedAtGuess = (arr: Contact[]) => Math.max(...arr.map((c) => c.created_at));

  const savePatch = async (id: number, patch: Partial<Contact>) => {
    const now = Date.now();
    const prev = rows;
    setRows((p) => p.map((c) => (c.contact_id === id ? { ...c, ...patch, updated_at: now } : c)));
    try {
      const saved = await apiPatch(id, patch);
      setRows((p) => p.map((c) => (c.contact_id === id ? normalizeLoaded(saved) : c)));
      setSuccessMsg('Saved changes.');
    } catch (e: any) {
      setRows(prev);
      setBannerError(e?.message || 'Update failed.');
    }
  };

  const doDelete = async (id: number) => {
    const prev = rows;
    setEditingId((e) => (e === id ? null : e));
    setConfirmId(null);
    setConfirmText('');
    setRows((p) => p.filter((c) => c.contact_id !== id));
    try {
      await apiDelete(id);
      setSuccessMsg('Contact deleted.');
    } catch (e: any) {
      setRows(prev);
      setBannerError(e?.message || 'Delete failed.');
    }
  };

  const toggleEdit = (row: Contact) => {
    if (editingId === row.contact_id) {
      setEditingId(null);
      return;
    }
    setEditingId(row.contact_id);
    setExpandedId(row.contact_id); // show notes while editing
  };

  /* ========= Search + Sort ========= */
  const matchesToken = (c: Contact, token: string) => {
    const t = token.toLowerCase();
    const isDigits = /^\d+$/.test(t);
    const phoneHit = isDigits ? toDigits(c.phone).includes(t) || fmtUSPhoneDisplay(c.phone).toLowerCase().includes(t) : false;
    const textHit =
      (c.name || '').toLowerCase().includes(t) ||
      (c.email || '').toLowerCase().includes(t) ||
      (c.contact_type || '').toLowerCase().includes(t) ||
      (c.notes || '').toLowerCase().includes(t);
    return phoneHit || textHit;
  };

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let base = tokens.length ? rows.filter((c) => tokens.every((t) => matchesToken(c, t))) : rows;

    const withIdx = (arr: Contact[]) => arr.map((v, i) => ({ v, i }));
    const cmpStr = (a: string, b: string) =>
      (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });

    if (sortBy) {
      const dir = sortDir === 'desc' ? -1 : 1;
      return withIdx(base)
        .sort((A, B) => {
          let av = '';
          let bv = '';
          if (sortBy === 'phone') {
            av = toDigits(A.v.phone);
            bv = toDigits(B.v.phone);
          } else {
            av = String((A.v as any)[sortBy] ?? '');
            bv = String((B.v as any)[sortBy] ?? '');
          }
          const c = cmpStr(av.toLowerCase(), bv.toLowerCase());
          return c !== 0 ? c * dir : A.i - B.i;
        })
        .map((x) => x.v);
    }

    // default sort by name A→Z, stable
    return withIdx(base)
      .sort((A, B) => {
        const c = cmpStr((A.v.name || '').toLowerCase(), (B.v.name || '').toLowerCase());
        return c !== 0 ? c : A.i - B.i;
      })
      .map((x) => x.v);
  }, [rows, query, sortBy, sortDir]);

  /* ========= Derived widths ========= */
  const TABLE_W = useMemo(() => COLS.reduce((s, c) => s + c.width, 0), []);
  const PANEL_W_ADD = TABLE_W + 120;
  const PANEL_W_SEARCH = COLS.find((c) => c.key === 'name')!.width + 60;
  const PANEL_W_LIST = TABLE_W;

  /* ========= Handlers ========= */
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  /* ========= Render ========= */
  return (
    <Box style={{ position: 'relative' }}>
      {/* Toolbar layout identical to PropertyList: left icons, right lanes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `56px 1fr`,
          columnGap: 16,
          alignItems: 'start',
          marginBottom: 16,
        }}
      >
        {/* Left: stacked icons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            title={addOpen ? 'Hide add contact' : 'Add contact'}
            aria-label="Add contact"
            onClick={() => setAddOpen((v) => !v)}
            style={{
              width: ICON_H, height: ICON_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: addOpen ? '#000' : 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <Icon name="add" size={40} style={{ color: addOpen ? '#ffef09' : '#111' }} aria-hidden />
          </button>

          <button
            type="button"
            title={searchOpen ? 'Hide search' : 'Show search'}
            aria-label="Search"
            onClick={() => setSearchOpen((v) => !v)}
            style={{
              width: ICON_H, height: ICON_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: searchOpen ? '#000' : 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <Icon name="search" size={40} style={{ color: searchOpen ? '#ffef09' : '#111' }} aria-hidden />
          </button>

          <button
            type="button"
            title={listOpen ? 'Hide list' : 'Show list'}
            aria-label="Toggle list"
            onClick={() => setListOpen((v) => !v)}
            style={{
              width: ICON_H, height: ICON_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: listOpen ? '#000' : 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <MdViewList size={40} color={listOpen ? '#ffef09' : '#111'} />
          </button>
        </div>

        {/* Right: sliding lanes */}
        <div style={{ display: 'grid', gridAutoRows: `${ENTRY_ROW_H}px`, rowGap: 8 }}>
          {/* Lane 1 — ADD CONTACT */}
          <div
            style={{
              maxWidth: addOpen ? PANEL_W_ADD : 0,
              transition: LANE_TRANSITION,
              overflow: 'visible',
              opacity: addOpen ? 1 : 0,
              transform: addOpen ? 'translateX(0)' : 'translateX(-8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <table
              style={{
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                background: '#fff',
                width: TABLE_W,
                border: '1px solid #222',
              }}
            >
              <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: `${c.width}px` }} />)}</colgroup>
              <tbody>
                <tr style={{ height: ENTRY_ROW_H }}>
                  {/* Name */}
                  <td style={{ ...cellBase, position: 'relative' }}>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Name"
                      style={{ ...inputBase, fontWeight: 800 }}
                    />
                  </td>
                  {/* Phone */}
                  <td style={{ ...cellBase, position: 'relative' }}>
                    <input
                      value={fmtUSPhoneDisplay(draft.phone)}
                      onChange={(e) => setDraft((p) => ({ ...p, phone: clamp10(toDigits(e.target.value)) }))}
                      placeholder="(555) 555-5555"
                      style={{ ...inputBase, textAlign: 'center', fontWeight: 600, fontSize: 16 }}
                    />
                  </td>
                  {/* Email */}
                  <td style={{ ...cellBase, position: 'relative' }}>
                    <input
                      value={draft.email}
                      onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      style={inputBase}
                    />
                  </td>
                  {/* Type (dropdown with tag) */}
                  <td style={{ ...cellBase, position: 'relative', overflow: 'visible' }}>
                    <UniversalDropdown
                      value={draft.contact_type ? draft.contact_type : null}
                      placeholder="Type"
                      options={CONTACT_TYPE_OPTIONS.map((t) => ({ value: t }))}
                      onChange={(val) => setDraft((p) => ({ ...p, contact_type: val }))}
                      ariaLabel="Contact type"
                    />
                    <ContactTypeTag type={draft.contact_type} variant="corner" corner="tr" size={18} />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Match IconButton sizes with PropertyList */}
            {readyToAdd && (
              <IconButton
                icon="addCircle"
                label="Add"
                onClick={addContact}
              />
            )}
            {hasNewInput && (
              <IconButton
                icon="cancel"
                label="cancel"
                onClick={resetDraft}
              />
            )}
          </div>

          {/* Lane 2 — SEARCH */}
          <div
            style={{
              maxWidth: searchOpen ? PANEL_W_SEARCH : 0,
              transition: LANE_TRANSITION,
              overflow: 'hidden',
              opacity: searchOpen ? 1 : 0,
              transform: searchOpen ? 'translateX(0)' : 'translateX(-8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts…"
              style={{
                width: COLS.find((c) => c.key === 'name')!.width,
                height: ENTRY_ROW_H,
                border: '1px solid #111',
                padding: '0 12px',
                fontSize: FONT_SIZE,
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
            {query && <IconButton icon="cancel" label="cancel" onClick={() => setQuery('')} />}
          </div>

          {/* Lane 3 — LIST */}
          <div
            style={{
              maxWidth: listOpen ? PANEL_W_LIST : 0,
              transition: LANE_TRANSITION,
              overflow: 'visible',
              opacity: listOpen ? 1 : 0,
              transform: listOpen ? 'translateX(0)' : 'translateX(-8px)',
            }}
          >
            <Box style={{ margin: 0, position: 'relative', zIndex: 0 }}>
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
                  <tr style={{ height: ENTRY_ROW_H }}>
                    {COLS.map((c) => (
                      <SortHeader
                        key={c.key}
                        title={c.title}
                        field={c.key as Exclude<SortKey, null>}
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
                        style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 22, background: '#fff' }}
                      >
                        No contacts found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => {
                      const isEditing = editingId === row.contact_id;
                      const isConfirming = confirmId === row.contact_id;
                      const isFocused = isEditing || isConfirming;
                      const rowHovered = hoverId === row.contact_id;
                      const dimOthers = (editingId ?? confirmId ?? null) !== null && !isFocused;

                      return (
                        <React.Fragment key={row.contact_id}>
                          <tr
                            onMouseEnter={() => setHoverId(row.contact_id)}
                            onMouseLeave={() => setHoverId((p) => (p === row.contact_id ? null : p))}
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

                              const styleCell: CSSProperties = {
                                ...cellBase,
                                borderTop: undefined,
                                ...(first ? { background: isEditing ? NAME_BG_HL : NAME_BG, fontWeight: 800, userSelect: 'none' } : {}),
                                position: 'relative',
                                overflow: 'visible',
                                paddingRight: last ? 0 : 10,
                              };

                              const renderVal = (val: string | undefined, placeholder: string) =>
                                val && String(val).trim().length ? <span>{val}</span> : <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;

                              return (
                                <td
                                  key={c.key}
                                  style={
                                    c.key === 'name' && !isEditing
                                      ? { ...styleCell, cursor: 'pointer' }
                                      : styleCell
                                  }
                                  {...(c.key === 'name' && !isEditing
                                    ? {
                                        role: 'button',
                                        tabIndex: 0,
                                        title: 'Toggle notes',
                                        onClick: () =>
                                          setExpandedId((p) => (p === row.contact_id ? null : row.contact_id)),
                                        onKeyDown: (e: React.KeyboardEvent) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setExpandedId((p) => (p === row.contact_id ? null : row.contact_id));
                                          }
                                        },
                                      }
                                    : {})}
                                >
                                  {/* Cells */}
                                  {isEditing ? (
                                    c.key === 'contact_type' ? (
                                      <UniversalDropdown
                                        value={row.contact_type ? row.contact_type : null}
                                        placeholder="Type"
                                        options={CONTACT_TYPE_OPTIONS.map((t) => ({ value: t }))}
                                        onChange={(val) => savePatch(row.contact_id, { contact_type: val })}
                                        ariaLabel="Contact type"
                                      />
                                    ) : c.key === 'phone' ? (
                                      <input
                                        value={fmtPhoneEditing(phoneDrafts[row.contact_id] ?? row.phone)}
                                        onChange={(e) => {
                                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                          setPhoneDrafts((prev) => ({ ...prev, [row.contact_id]: digits }));
                                        }}
                                        onBlur={async () => {
                                          const digits = (phoneDrafts[row.contact_id] ?? row.phone ?? '').replace(/\D/g, '').slice(0, 10);
                                          if (digits && digits.length === 10 && digits !== row.phone) {
                                            await savePatch(row.contact_id, { phone: digits });
                                          }
                                        }}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            const digits = (phoneDrafts[row.contact_id] ?? row.phone ?? '').replace(/\D/g, '').slice(0, 10);
                                            if (digits.length === 10) await savePatch(row.contact_id, { phone: digits });
                                          }
                                          if (e.key === 'Escape') {
                                            setPhoneDrafts((prev) => ({ ...prev, [row.contact_id]: row.phone ?? '' }));
                                            (e.currentTarget as HTMLInputElement).blur();
                                          }
                                        }}
                                        placeholder="(555) 555-5555"
                                        style={{ ...inputBase, textAlign: 'center', fontWeight: 600, fontSize: 16 }}
                                        autoFocus={first}
                                      />
                                    ) : c.key === 'name' ? (
                                      <input
                                        value={row.name || ''}
                                        onChange={(e) => savePatch(row.contact_id, { name: e.target.value })}
                                        onKeyDown={handleEditKeyDown}
                                        placeholder="Name"
                                        style={{ ...inputBase, fontWeight: 800 }}
                                        autoFocus={first}
                                      />
                                    ) : c.key === 'email' ? (
                                      <input
                                        value={row.email || ''}
                                        onChange={(e) => savePatch(row.contact_id, { email: e.target.value })}
                                        onKeyDown={handleEditKeyDown}
                                        placeholder="Email"
                                        style={inputBase}
                                      />
                                    ) : (
                                      renderVal('', '') // not used
                                    )
                                  ) : (
                                    (() => {
                                      if (c.key === 'phone') {
                                        const d = String(row.phone || '').replace(/\D/g, '').slice(0, 10);
                                        return d ? fmtUSPhoneDisplay(d) : <span style={{ color: '#999' }}>—</span>;
                                      }
                                      if (c.key === 'name') {
                                        const label = row.name?.trim() || 'Name';
                                        return row.name?.trim() ? (
                                          label
                                        ) : (
                                          <span style={{ color: PLACEHOLDER }}>{label}</span>
                                        );
                                      }
                                      if (c.key === 'email') {
                                        return renderVal(row.email || '', 'Email');
                                      }
                                      if (c.key === 'contact_type') {
                                        return (
                                          <>
                                            {renderVal(row.contact_type || '', 'Type')}
                                            <ContactTypeTag type={row.contact_type} variant="corner" corner="tr" size={18} />
                                          </>
                                        );
                                      }
                                      return null;
                                    })()
                                  )}

                                  {/* Row actions on the right of last cell */}
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
                                        zIndex: 1500,
                                      }}
                                    >
                                      {!isConfirming && (
                                        <>
                                          {isEditing ? (
                                            <IconButton
                                              icon="addCircle"        // reuse as Save
                                              label="Save"
                                              onClick={() => setEditingId(null)}
                                            />
                                          ) : (
                                            <IconButton
                                              icon="edit"
                                              label="Edit"
                                              onClick={() => toggleEdit(row)}
                                            />
                                          )}
                                          <IconButton
                                            icon="delete"
                                            label="Delete"
                                            onClick={() => setConfirmId((prev) => (prev === row.contact_id ? null : row.contact_id))}
                                          />
                                        </>
                                      )}

                                      {/* Delete confirm input */}
                                      <div style={{ position: 'relative', height: ENTRY_ROW_H, display: 'flex', alignItems: 'center' }}>
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
                                              border: '1px solid #111',
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
                                                    void doDelete(row.contact_id);
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
                                              }}
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {isConfirming && (
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

                          {/* Notes row collapsible */}
                          <tr>
                            <td colSpan={COLS.length} style={{ padding: 0, border: 'none' }}>
                              {(() => {
                                const open = expandedId === row.contact_id;
                                return (
                                  <div
                                    aria-hidden={!open}
                                    style={{
                                      overflow: 'hidden',
                                      transition: 'max-height 220ms ease',
                                      maxHeight: open ? ENTRY_ROW_H + 26 : 0,
                                      borderLeft: open ? `${BORDER}px solid #222` : 'none',
                                      borderRight: open ? `${BORDER}px solid #222` : 'none',
                                      borderBottom: open ? `${BORDER}px solid #222` : 'none',
                                      background: '#fff',
                                      margin: 0,
                                    }}
                                  >
                                    {editingId === row.contact_id ? (
                                      // Editing: no toggle click, just the input
                                      <div
                                        style={{
                                          padding: '13px',
                                          minHeight: ENTRY_ROW_H,
                                          display: 'flex',
                                          alignItems: 'center',
                                          boxSizing: 'border-box',
                                        }}
                                        title="Notes"
                                      >
                                        <input
                                          type="text"
                                          value={row.notes || ''}
                                          onChange={(e) => savePatch(row.contact_id, { notes: e.target.value })}
                                          placeholder="Add notes..."
                                          onKeyDown={handleEditKeyDown}
                                          style={inputBase}
                                        />
                                      </div>
                                    ) : (
                                      // Viewing: whole row is a button that toggles open/closed
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedId((p) => (p === row.contact_id ? null : row.contact_id))
                                        }
                                        title="Click to toggle notes"
                                        aria-expanded={open}
                                        style={{
                                          all: 'unset',
                                          display: 'block',
                                          width: '100%',
                                          padding: '13px',
                                          minHeight: ENTRY_ROW_H,
                                          boxSizing: 'border-box',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {(row.notes && row.notes.trim())
                                          ? row.notes
                                          : <span style={{ color: PLACEHOLDER }}>Add notes...</span>}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </Box>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {bannerError && (
        <div
          role="alert"
          style={{
            border: '2px solid #c33',
            background: '#ffeaea',
            color: '#c33',
            fontWeight: 700,
            letterSpacing: 0.3,
            padding: '10px 14px',
            marginTop: 8,
            maxWidth: TABLE_W,
          }}
        >
          {bannerError}
        </div>
      )}

      {/* Success banner */}
      {successMsg && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            border: '2px solid #0a7a28',
            background: '#e9f7ef',
            color: '#0a7a28',
            fontWeight: 900,
            letterSpacing: 0.3,
            padding: '12px 16px',
            maxWidth: TABLE_W,
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            zIndex: 9999,
          }}
        >
          {successMsg}
        </div>
      )}
    </Box>
  );

  function fmtPhoneEditing(digitsOrRaw: string) {
    const d = (digitsOrRaw || '').replace(/\D/g, '').slice(0, 10);
    if (!d) return '';
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
}

/* ========= Sort header ========= */
function SortHeader({
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
  const toggle = () => {
    if (!active) {
      setSortBy(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy(null);
    }
  };
  return (
    <th
      style={{ ...headerTh, width, minWidth: width, maxWidth: width }}
      onClick={toggle}
      title={!active ? `Sort ${title} (A→Z)` : sortDir === 'asc' ? `Sort ${title} (Z→A)` : `cancel sort`}
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
