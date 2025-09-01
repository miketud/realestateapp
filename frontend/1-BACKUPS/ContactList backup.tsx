import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Title, Button } from '@mantine/core';
import { MdOutlineEdit, MdOutlineDelete, MdOutlineClear, MdOutlineSearch } from 'react-icons/md';
import ContactTypeTag from './ContactTypeTag';

const ROW_HEIGHT = 68;
const FONT_SIZE = 18;
const COL_WIDTH = 250;
const BLUE = '#2b6fff';
const BORDER = 1.5;
const PLACEHOLDER = '#9aa1a8';
const NAME_BG = '#f3f3f3';
const NAME_BG_HIGHLIGHT = '#eaf1ff';

const TABLE_SHADOW = '0 8px 20px rgba(0,0,0,0.10)'; // keep subtle depth on entry + list tables
const API = '/api/contacts';

const toDigits = (v: string) => (v || '').replace(/\D/g, '');
const clamp10 = (d: string) => d.slice(0, 10);
const fmtUSPhoneFull = (digits: string) => {
  const d = clamp10(toDigits(digits));
  if (d.length !== 10) return d;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
const fmtUSPhoneLive = (digits: string) => {
  const d = clamp10(toDigits(digits));
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

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

type SortKey = 'name' | 'phone' | 'email' | 'contact_type' | null;
type SortDir = 'asc' | 'desc';

export default function ContactList() {
  /* state */
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [hoverRowId, setHoverRowId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [phoneDrafts, setPhoneDrafts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [draft, setDraft] = useState<Omit<Contact, 'created_at' | 'updated_at'>>({
    contact_id: Date.now(),
    name: '',
    phone: '',
    email: '',
    contact_type: '',
    notes: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [hoverAdd, setHoverAdd] = useState(false);

  // NEW: icon → expanding search next to the title
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  /* load */
  useEffect(() => {
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.text())))
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch((e) => console.error('GET /api/contacts failed', e));
  }, []);

  /* outside click collapses notes */
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (listRef.current && t && !listRef.current.contains(t)) setExpandedId(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  /* helpers */
  const showError = (msg: string) => setErrorMsg(msg);
  const resetDraft = () =>
    setDraft({ contact_id: Date.now(), name: '', phone: '', email: '', contact_type: '', notes: '' });
  const isReadyToAdd = Boolean(draft.name.trim() && toDigits(draft.phone).length === 10);
  const normalizeName = (v: string) => v.trim().toLowerCase();
  const nameExists = (name: string, excludeId?: number) =>
    contacts.some((c) => (excludeId ? c.contact_id !== excludeId : true) && normalizeName(c.name) === normalizeName(name));

  async function apiCreate(payload: {
    name: string; phone: string; email?: string | null; contact_type?: string | null; notes?: string | null;
  }) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Contact;
  }
  async function apiPatch(id: number, payload: any) {
    const r = await fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Contact;
  }
  async function apiDelete(id: number) {
    const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return true;
  }

  /* actions */
  const handleAdd = async () => {
    if (!isReadyToAdd) return;
    if (nameExists(draft.name)) {
      showError(`Duplicate name blocked: "${draft.name.trim()}" already exists.`);
      return;
    }
    const now = Date.now();
    const digits = clamp10(toDigits(draft.phone));
    const tempId = now;
    const optimistic: Contact = {
      contact_id: tempId,
      name: draft.name.trim(),
      phone: digits,
      email: draft.email || '',
      contact_type: draft.contact_type || '',
      notes: draft.notes || '',
      created_at: now,
      updated_at: now,
    };
    setContacts((prev) => [...prev, optimistic]);
    resetDraft();
    try {
      const saved = await apiCreate({
        name: optimistic.name,
        phone: optimistic.phone,
        email: optimistic.email || null,
        contact_type: optimistic.contact_type || null,
        notes: optimistic.notes || null,
      });
      setContacts((prev) => prev.map((c) => (c.contact_id === tempId ? saved : c)));
    } catch (e) {
      setContacts((prev) => prev.filter((c) => c.contact_id !== tempId));
      showError('Could not add contact. Please try again.');
    }
  };

  const patchContact = async (id: number, patch: Partial<Contact>) => {
    if (typeof patch.name === 'string' && patch.name.trim().length) {
      if (nameExists(patch.name, id)) {
        showError(`Duplicate name blocked: "${patch.name.trim()}" already exists.`);
        return;
      }
    }
    const toPayload: any = {};
    if ('name' in patch) toPayload.name = patch.name;
    if ('phone' in patch) toPayload.phone = patch.phone;
    if ('email' in patch) toPayload.email = patch.email ?? null;
    if ('contact_type' in patch) toPayload.contact_type = patch.contact_type ?? null;
    if ('notes' in patch) toPayload.notes = patch.notes ?? null;

    const prev = contacts;
    const now = Date.now();
    setContacts((p) => p.map((c) => (c.contact_id === id ? { ...c, ...patch, updated_at: now } : c)));
    try {
      const saved = await apiPatch(id, toPayload);
      setContacts((p) => p.map((c) => (c.contact_id === id ? saved : c)));
    } catch (e) {
      setContacts(prev);
      showError('Could not save changes. Please try again.');
    }
  };

  const deleteRow = async (id: number) => {
    const prev = contacts;
    setContacts((p) => p.filter((c) => c.contact_id !== id));
    if (expandedId === id) setExpandedId(null);
    if (editingRowId === id) setEditingRowId(null);
    setConfirmDeleteId(null);
    try {
      await apiDelete(id);
    } catch (e) {
      setContacts(prev);
      showError('Could not delete contact. Please try again.');
    }
  };

  const toggleEdit = (row: Contact) => {
    if (editingRowId === row.contact_id) {
      setEditingRowId(null);
      return;
    }
    setEditingRowId(row.contact_id);
    setExpandedId(row.contact_id);
  };

  /* layout + derived */
  const sharedCellBase: React.CSSProperties = {
    border: `${BORDER}px solid #222`,
    padding: '13px',
    verticalAlign: 'middle',
    width: COL_WIDTH,
    maxWidth: COL_WIDTH,
    minWidth: COL_WIDTH,
    background: '#fff',
    fontSize: FONT_SIZE,
    fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
    color: '#111',
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
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
    color: 'inherit',
    background: 'transparent',
    display: 'block',
  };
  const selectFullHeightStyle: React.CSSProperties = {
    ...inputBaseStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    cursor: 'pointer',
  };
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingRowId(null);
    }
  };
  const tableWidth = useMemo(() => COL_WIDTH * 4, []);
  const NOTES_OPEN_MAX = ROW_HEIGHT + 26;

  const renderValue = (val: string | undefined, placeholder: string) =>
    val && String(val).trim().length ? <span>{val}</span> : <span style={{ color: PLACEHOLDER }}>{placeholder}</span>;

  const defaultSort = (arr: Contact[]) => [...arr].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = toDigits(query);
    let arr = contacts;
    if (q.length || qDigits.length) {
      arr = contacts.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const type = (c.contact_type || '').toLowerCase();
        const notes = (c.notes || '').toLowerCase();
        const phoneD = toDigits(c.phone);
        const phoneFmt = fmtUSPhoneFull(c.phone).toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          type.includes(q) ||
          notes.includes(q) ||
          (qDigits.length ? phoneD.includes(qDigits) : false) ||
          phoneFmt.includes(q)
        );
      });
    }
    if (!sortBy) return defaultSort(arr);
    const cmp = (a: Contact, b: Contact) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let va = '';
      let vb = '';
      if (sortBy === 'phone') {
        va = toDigits(a.phone);
        vb = toDigits(b.phone);
      } else {
        va = ((a as any)[sortBy] || '').toString().toLowerCase();
        vb = ((b as any)[sortBy] || '').toString().toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    };
    return [...arr].sort(cmp);
  }, [contacts, query, sortBy, sortDir]);

  const HeaderCell = ({ title, field }: { title: string; field: Exclude<SortKey, null> }) => {
    const active = sortBy === field;
    const onAscClick = () => {
      if (active && sortDir === 'asc') setSortBy(null);
      else {
        setSortBy(field);
        setSortDir('asc');
      }
    };
    const onDescClick = () => {
      if (active && sortDir === 'desc') setSortBy(null);
      else {
        setSortBy(field);
        setSortDir('desc');
      }
    };
    return (
      <th
        style={{
          border: '1.5px solid #111',
          padding: '10px 12px',
          width: COL_WIDTH,
          minWidth: COL_WIDTH,
          maxWidth: COL_WIDTH,
          background: '#111',
          color: '#fff',
          fontWeight: 800,
          letterSpacing: 0.3,
          position: 'relative',
          textAlign: 'center',
        }}
      >
        <span>{title}</span>
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
            onClick={onAscClick}
            title={`Sort ${title} ↑`}
            style={{
              border: '1.5px solid #fff',
              background: active && sortDir === 'asc' ? '#fff' : 'transparent',
              color: active && sortDir === 'asc' ? '#111' : '#fff',
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
            onClick={onDescClick}
            title={`Sort ${title} ↓`}
            style={{
              border: '1.5px solid #fff',
              background: active && sortDir === 'desc' ? '#fff' : 'transparent',
              color: active && sortDir === 'desc' ? '#111' : '#fff',
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
      </th>
    );
  };

  /* render */
  return (
    <Box style={{ margin: '32px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title + icon search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Title order={2} style={{ fontWeight: 900, letterSpacing: 1, fontSize: 28, color: '#111' }}>
          CONTACT LIST
        </Title>

        <div style={{ display: 'flex', alignItems: 'center', height: 50 }}>
          <button
            aria-label="Search contacts"
            title="Search contacts"
            onClick={() => setSearchOpen((v) => !v)}
            style={{
              width: 50,
              height: 50,
              border: '2px solid #111',
              borderRadius: 0,
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <MdOutlineSearch size={28} />
          </button>
          {/* Smooth width transition; fixed height */}
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
              placeholder="Search contacts…"
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
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            width: tableWidth,
            border: '2px solid #111',
            background: '#ff3b30',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 800,
            letterSpacing: 0.2,
            boxShadow: '0 2px 0 rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{
              background: 'transparent',
              border: '2px solid #fff',
              color: '#fff',
              borderRadius: 6,
              padding: '4px 10px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Entry row + Add */}
      <Box style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <table
          style={{
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            background: '#fff',
            width: tableWidth,
            border: `${BORDER * 2}px solid #222`,
            boxShadow: TABLE_SHADOW,
            boxSizing: 'border-box',
          }}
        >
          <tbody>
            <tr style={{ height: ROW_HEIGHT }}>
              <td style={sharedCellBase}>
                <input
                  placeholder="Name"
                  value={draft.name}
                  style={inputBaseStyle}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </td>
              <td style={sharedCellBase}>
                <input
                  placeholder="Phone"
                  value={fmtUSPhoneLive(draft.phone)}
                  style={inputBaseStyle}
                  onChange={(e) => setDraft({ ...draft, phone: clamp10(toDigits(e.target.value)) })}
                />
              </td>
              <td style={sharedCellBase}>
                <input
                  placeholder="Email"
                  value={draft.email}
                  style={inputBaseStyle}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </td>
              <td style={{ ...sharedCellBase, position: 'relative' }}>
                <select
                  value={draft.contact_type}
                  style={{ ...selectFullHeightStyle, color: draft.contact_type ? '#111' : PLACEHOLDER }}
                  onChange={(e) => setDraft({ ...draft, contact_type: e.target.value })}
                >
                  <option value="" style={{ color: '#111' }}>Type</option>
                  <option value="Personal">Personal</option>
                  <option value="Tenant">Tenant</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Manager">Manager</option>
                  <option value="Emergency Contact">Emergency Contact</option>
                  <option value="Other">Other</option>
                </select>
                <ContactTypeTag type={draft.contact_type} variant="corner" corner="tr" size={18} />
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setHoverAdd(true)}
          onMouseLeave={() => setHoverAdd(false)}
        >
          <Button
            onClick={handleAdd}
            disabled={!isReadyToAdd}
            style={{
              border: '2px solid #111',
              borderRadius: 0,
              background: isReadyToAdd ? '#fff' : '#f2f2f2',
              color: '#111',
              fontWeight: 800,
              fontSize: 16,
              padding: '0 16px',
              textTransform: 'uppercase',
              letterSpacing: 1,
              height: ROW_HEIGHT + BORDER * 2,
              alignSelf: 'stretch',
              cursor: isReadyToAdd ? 'pointer' : 'not-allowed',
            }}
          >
            ADD CONTACT
          </Button>

          <button
            aria-label="Clear inputs"
            title="Clear inputs"
            onClick={resetDraft}
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

      {/* List */}
      <div ref={listRef} style={{ position: 'relative', width: tableWidth, overflow: 'visible' }}>
        <table
          style={{
            tableLayout: 'fixed',
            width: tableWidth,
            border: `${BORDER * 2}px solid #222`,
            borderCollapse: 'collapse',
            background: '#fff',
            fontSize: FONT_SIZE,
            fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
            overflow: 'visible',
            boxShadow: TABLE_SHADOW,
            boxSizing: 'border-box',
          }}
        >
          <thead>
            <tr style={{ height: 56 }}>
              <HeaderCell title="Name" field="name" />
              <HeaderCell title="Phone" field="phone" />
              <HeaderCell title="Email" field="email" />
              <HeaderCell title="Type" field="contact_type" />
            </tr>
          </thead>

          <tbody>
            {filteredSorted.map((c, idx) => {
              const isExpanded = expandedId === c.contact_id;
              const isEditing = editingRowId === c.contact_id;

              return (
                <React.Fragment key={c.contact_id}>
                  <tr
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoverRowId(c.contact_id)}
                    onMouseLeave={() => setHoverRowId((prev) => (prev === c.contact_id ? null : prev))}
                  >
                    <td
                      style={{
                        ...sharedCellBase,
                        background: isEditing ? NAME_BG_HIGHLIGHT : NAME_BG,
                        fontWeight: 800,
                        cursor: isEditing ? 'text' : 'pointer',
                        userSelect: 'none',
                        borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                        position: 'relative',
                        boxShadow: isEditing ? `inset 0 0 0 3px ${BLUE}` : 'none',
                        transition: 'background-color 140ms ease, box-shadow 140ms ease',
                        overflow: 'visible',
                      }}
                      onClick={() => { if (!isEditing) setExpandedId((prev) => (prev === c.contact_id ? null : c.contact_id)); }}
                      title={isEditing ? undefined : 'Click to show notes'}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={c.name || ''}
                          onChange={(e) => patchContact(c.contact_id, { name: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                          placeholder="Name"
                          style={{ ...inputBaseStyle, fontWeight: 800, background: 'transparent' }}
                          autoFocus
                        />
                      ) : c.name?.trim().length ? (
                        c.name
                      ) : (
                        <span style={{ color: PLACEHOLDER }}>Name</span>
                      )}

                      {/* Confirm delete popover */}
                      {confirmDeleteId === c.contact_id && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(100% + 12px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              background: '#fff',
                              border: '2px solid #111',
                              borderRadius: 8,
                              padding: 14,
                              minWidth: 280,
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: 16, marginBottom: 12 }}>Are you sure you want to delete?</div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                              <button
                                onClick={() => deleteRow(c.contact_id)}
                                style={{
                                  border: '2px solid #111',
                                  background: '#ff3b30',
                                  color: '#fff',
                                  borderRadius: 6,
                                  padding: '8px 14px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                style={{
                                  border: '2px solid #111',
                                  background: '#fff',
                                  borderRadius: 6,
                                  padding: '8px 14px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    <td
                      style={{
                        ...sharedCellBase,
                        cursor: isEditing ? 'text' : 'default',
                        userSelect: 'none',
                        borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                        position: 'relative',
                        background: '#fff',
                      }}
                    >
                      {isEditing ? (
                        <input
                          value={
                            (() => {
                              const d = (phoneDrafts[c.contact_id] ?? c.phone ?? '').replace(/\D/g, '').slice(0, 10);
                              if (!d) return '';
                              if (d.length <= 3) return `(${d}`;
                              if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
                              return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
                            })()
                          }
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhoneDrafts((prev) => ({ ...prev, [c.contact_id]: digits }));
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const digits = (phoneDrafts[c.contact_id] ?? c.phone ?? '').replace(/\D/g, '').slice(0, 10);
                              if (digits.length !== 10) return;
                              await patchContact(c.contact_id, { phone: digits });
                              setPhoneDrafts((prev) => ({ ...prev, [c.contact_id]: digits }));
                            }
                            if (e.key === 'Escape') {
                              setPhoneDrafts((prev) => ({ ...prev, [c.contact_id]: c.phone ?? '' }));
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={async () => {
                            const digits = (phoneDrafts[c.contact_id] ?? c.phone ?? '').replace(/\D/g, '').slice(0, 10);
                            if (digits && digits !== (c.phone ?? '')) {
                              if (digits.length !== 10) return;
                              await patchContact(c.contact_id, { phone: digits });
                            }
                            setPhoneDrafts((prev) => ({ ...prev, [c.contact_id]: digits || (c.phone ?? '') }));
                          }}
                          placeholder="(555) 555-5555"
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            textAlign: 'center',
                            fontSize: 16,
                            fontWeight: 600,
                          }}
                          autoFocus
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        (() => {
                          const d = String(c.phone || '').replace(/\D/g, '').slice(0, 10);
                          if (!d) return <span style={{ color: '#999' }}>—</span>;
                          if (d.length <= 3) return `(${d}`;
                          if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
                          return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
                        })()
                      )}
                    </td>

                    <td
                      style={{
                        ...sharedCellBase,
                        borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                        background: '#fff',
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={c.email || ''}
                          style={inputBaseStyle}
                          onChange={(e) => patchContact(c.contact_id, { email: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                          placeholder="Email"
                        />
                      ) : (
                        renderValue(c.email || '', 'Email')
                      )}
                    </td>

                    <td
                      style={{
                        ...sharedCellBase,
                        borderTop: idx === 0 ? `${BORDER}px solid #222` : `${BORDER * 2}px solid #222`,
                        position: 'relative',
                        overflow: 'visible',
                        paddingRight: 0,
                        background: '#fff',
                      }}
                    >
                      {isEditing ? (
                        <select
                          value={c.contact_type || ''}
                          style={{ ...selectFullHeightStyle, color: c.contact_type ? '#111' : PLACEHOLDER, background: 'transparent' }}
                          onChange={(e) => patchContact(c.contact_id, { contact_type: e.target.value })}
                          onKeyDown={handleEditKeyDown}
                        >
                          <option value="" style={{ color: '#111' }}>Type</option>
                          <option value="Personal">Personal</option>
                          <option value="Tenant">Tenant</option>
                          <option value="Contractor">Contractor</option>
                          <option value="Vendor">Vendor</option>
                          <option value="Manager">Manager</option>
                          <option value="Emergency Contact">Emergency Contact</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        renderValue(c.contact_type || '', 'Type')
                      )}

                      {/* Type square */}
                      <ContactTypeTag type={c.contact_type} variant="corner" corner="tr" size={18} />

                      {/* Row actions */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 'calc(100% + 8px)',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          opacity: hoverRowId === c.contact_id || isEditing ? 1 : 0,
                          transition: 'opacity 160ms ease-in-out',
                          pointerEvents: 'auto',
                        }}
                        onMouseEnter={() => setHoverRowId(c.contact_id)}
                        onMouseLeave={() => setHoverRowId((prev) => (prev === c.contact_id ? null : prev))}
                      >
                        <button
                          aria-label="Edit"
                          title={isEditing ? 'Finish Editing' : 'Edit'}
                          onClick={() => toggleEdit(c)}
                          style={{
                            background: 'transparent',
                            border: '2px solid #111',
                            borderRadius: 4,
                            padding: 0,
                            width: 50,
                            height: 50,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            lineHeight: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          <MdOutlineEdit size={35} />
                        </button>

                        <button
                          aria-label="Delete"
                          title="Delete"
                          onClick={() => setConfirmDeleteId(c.contact_id)}
                          style={{
                            background: 'transparent',
                            border: '2px solid #111',
                            borderRadius: 4,
                            padding: 0,
                            width: 50,
                            height: 50,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            lineHeight: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          <MdOutlineDelete size={40} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Notes */}
                  <tr>
                    <td colSpan={4} style={{ padding: 0, border: 'none' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          transition: 'max-height 220ms ease',
                          maxHeight: isExpanded ? NOTES_OPEN_MAX : 0,
                          borderLeft: isExpanded ? `${BORDER}px solid #222` : 'none',
                          borderRight: isExpanded ? `${BORDER}px solid #222` : 'none',
                          borderBottom: isExpanded ? `${BORDER}px solid #222` : 'none',
                          background: '#fff',
                        }}
                      >
                        <div
                          style={{
                            padding: '13px',
                            minHeight: ROW_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            boxSizing: 'border-box',
                          }}
                        >
                          {editingRowId === c.contact_id ? (
                            <input
                              type="text"
                              value={c.notes || ''}
                              onChange={(e) => patchContact(c.contact_id, { notes: e.target.value })}
                              placeholder="Add notes..."
                              onKeyDown={handleEditKeyDown}
                              style={inputBaseStyle}
                            />
                          ) : (
                            renderValue(c.notes || '', 'Add notes...')
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
