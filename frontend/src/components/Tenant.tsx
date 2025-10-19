// src/components/Tenant.tsx
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';
import DatePickerField from './DatePicker';
import { IconButton, Icon } from './ui/Icons';

type Contact = { contact_id: number; name: string };

type TenantRecord = {
  tenant_id?: number | null;
  property_id: number;
  tenant_name?: string | null;
  tenant_status?: 'CURRENT' | 'FUTURE' | 'PAST' | null;
  lease_start?: string | null;
  lease_end?: string | null;
  rent_amount?: number | null;
  locked?: boolean;
};

const CELL_H = 70;
const API_TENANT = '/api/tenant';
const STATUS_COLOR = {
  CURRENT: '#1e7e34', // deep green
  FUTURE: '#7e22ce',  // purple
  PAST: '#d32f2f',    // red
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d
    .getDate()
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
}

function computeStatus(start?: string | null, end?: string | null): 'CURRENT' | 'FUTURE' | 'PAST' | null {
  if (!start || !end) return null;
  const today = new Date();
  const s = new Date(start);
  const e = new Date(end);
  if (today >= s && today <= e) return 'CURRENT';
  if (today < s) return 'FUTURE';
  if (today > e) return 'PAST';
  return null;
}

/* ------------------------------------------
   ENTRY ROW (Add Tenant)
------------------------------------------ */
function TenantEntryRow({
  contacts,
  entry,
  onChange,
  onSave,
}: {
  contacts: Contact[];
  entry: TenantRecord;
  onChange: (patch: Partial<TenantRecord>) => void;
  onSave: (t: TenantRecord) => Promise<void>;
}) {
  const tenantOptions: DropdownOption[] = useMemo(
    () => contacts.map((c) => ({ value: String(c.contact_id), label: c.name.toUpperCase() })),
    [contacts]
  );

  const handleTenantSelect = (val: string) => {
    const match = contacts.find((c) => String(c.contact_id) === val);
    onChange({
      tenant_name: match?.name?.toUpperCase() || null,
    });
  };

  const canSave =
    Boolean(entry.tenant_name && entry.lease_start && entry.lease_end && entry.rent_amount);

  const saveTenant = async () => {
    const computedStatus = computeStatus(entry.lease_start, entry.lease_end);
    await onSave({ ...entry, tenant_status: computedStatus });
  };

  return (
    <motion.div
      layout
      style={{
        background: '#e5e5e5',
        borderTop: '4px solid #000',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: CELL_H }}>
            {/* TENANT */}
            <td style={{ position: 'relative', verticalAlign: 'middle' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: CELL_H,
                  fontSize: 30,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                <UniversalDropdown
                  value={entry.tenant_name || ''}
                  placeholder="Select Tenant..."
                  options={tenantOptions}
                  searchable
                  onChange={handleTenantSelect}
                  variant="flat"
                />
              </div>
            </td>

            {/* DATES */}
            <td style={{ position: 'relative', verticalAlign: 'middle' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  height: CELL_H,
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
<DatePickerField
  value={entry.lease_start || ''}
  onChange={(val) => {
    // If toDate exists and new fromDate is after it, reset toDate
    if (entry.lease_end && val && new Date(val) > new Date(entry.lease_end)) {
      onChange({ lease_start: val, lease_end: null });
    } else {
      onChange({ lease_start: val });
    }
  }}
  ariaLabel="Lease Start"
  width={170}
/>

<Icon name="arrowRight" size={26} />

<DatePickerField
  value={entry.lease_end || ''}
  onChange={(val) => {
    // Only accept if end >= start
    if (entry.lease_start && val && new Date(val) < new Date(entry.lease_start)) return;
    onChange({ lease_end: val });
  }}
  ariaLabel="Lease End"
  width={170}
/>

              </div>
            </td>

            {/* RENT + SAVE */}
            <td style={{ position: 'relative', verticalAlign: 'middle', paddingRight: 100 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 30 }}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000"
                  value={entry.rent_amount ?? ''}
                  onChange={(e) =>
                    onChange({ rent_amount: Number(e.target.value) || null })
                  }
                  style={{
                    width: 150,
                    height: 36,
                    border: 'none',
                    outline: 'none',
                    fontSize: 30,
                    textAlign: 'center',
                    fontWeight: 800,
                    background: 'transparent',
                  }}
                />
              </div>

              {canSave && (
                <div
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <IconButton
                    icon="save"
                    label="Save"
                    title="Save Tenant"
                    onClick={saveTenant}
                    boxSize={46}
                    iconSize={26}
                  />
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

/* ------------------------------------------
   DATA ROW (View + Delete + Status Badge)
------------------------------------------ */
function TenantDataRow({
  tenant,
  onDelete,
  onSave,
}: {
  tenant: TenantRecord;
  onDelete: (t: TenantRecord) => Promise<void>;
  onSave: (t: TenantRecord) => Promise<void>;
}) {
  const [hover, setHover] = useState(false);

  const deleteTenant = async () => {
    await onDelete(tenant);
  };

  // dynamically compute status on each render
  const computedStatus = computeStatus(tenant.lease_start, tenant.lease_end);

  useEffect(() => {
    if (computedStatus && computedStatus !== tenant.tenant_status) {
      onSave({ ...tenant, tenant_status: computedStatus });
    }
  }, [computedStatus]); // auto-update status silently

  return (
    <motion.div
      layout
      style={{
        borderTop: '4px solid #000',
        position: 'relative',
        background: '#fff',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* STATUS BADGE */}
      {computedStatus && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            background: STATUS_COLOR[computedStatus],
            color: '#fff',
            fontWeight: 800,
            textTransform: 'uppercase',
            fontSize: 14,
            padding: '4px 10px',
            borderRadius: 4,
            zIndex: 5,
            letterSpacing: 0.5,
          }}
        >
          {computedStatus}
        </div>
      )}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: CELL_H }}>
            <td
              style={{
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 800,
                textTransform: 'uppercase',
              }}
            >
              {tenant.tenant_name || '—'}
            </td>

            <td style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
                <span>{tenant.lease_start ? formatDate(tenant.lease_start) : '—'}</span>
                <Icon name="arrowRight" size={26} />
                <span>{tenant.lease_end ? formatDate(tenant.lease_end) : '—'}</span>
              </div>
            </td>

            <td
              style={{
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 800,
                position: 'relative',
                paddingRight: 100,
              }}
            >
              {tenant.rent_amount ? `$${tenant.rent_amount}` : '—'}
              <AnimatePresence>
                {hover && (
                  <motion.div
                    key="delete"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0 }}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 100,
                    }}
                  >
                    <IconButton
                      icon="delete"
                      label="Delete"
                      title="Delete Tenant"
                      onClick={deleteTenant}
                      boxSize={46}
                      iconSize={26}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </td>
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

/* ------------------------------------------
   MAIN TENANT COMPONENT
------------------------------------------ */
export default function Tenant({ property_id }: { property_id: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rows, setRows] = useState<TenantRecord[]>([]);
  const [entry, setEntry] = useState<TenantRecord>({
    property_id,
    tenant_name: null,
    tenant_status: null,
    lease_start: null,
    lease_end: null,
    rent_amount: null,
    locked: false,
  });
  const [entryVisible, setEntryVisible] = useState(true);

  useEffect(() => {
    (async () => {
      const [cRes, tRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch(`${API_TENANT}?property_id=${property_id}`),
      ]);
      const contactsJson = await cRes.json();
      const tJson = await tRes.json();
      const loaded = Array.isArray(tJson) ? tJson : [];
      setContacts(contactsJson || []);
      setRows(loaded);
      setEntryVisible(loaded.length === 0);
    })();
  }, [property_id]);

  const saveTenant = async (t: TenantRecord) => {
    const isUpdate = Boolean(t.tenant_id);
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `${API_TENANT}/${t.tenant_id}` : API_TENANT;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    const saved = await res.json();

    if (isUpdate) {
      setRows((prev) =>
        prev.map((r) => (r.tenant_id === saved.tenant_id ? saved : r))
      );
    } else {
      setRows((prev) => [...prev, saved]);
      setEntry({
        property_id,
        tenant_name: null,
        tenant_status: null,
        lease_start: null,
        lease_end: null,
        rent_amount: null,
        locked: false,
      });
      // after first save, slide up and hide
      setTimeout(() => setEntryVisible(false), 400);
    }
  };

  const deleteTenant = async (t: TenantRecord) => {
    if (!t.tenant_id) return;
    await fetch(`${API_TENANT}/${t.tenant_id}`, { method: 'DELETE' });
    setRows((prev) => {
      const updated = prev.filter((r) => r.tenant_id !== t.tenant_id);
      if (updated.length === 0) {
        // reopen entry smoothly if all deleted
        setTimeout(() => setEntryVisible(true), 300);
      }
      return updated;
    });
  };

  return (
    <div style={{ border: '4px solid #000', position: 'relative', overflow: 'hidden' }}>
      {/* Entry Row with smooth collapse/expand */}
{/* ENTRY CONTAINER */}
<div style={{ position: 'relative' }}>
  {/* Clickable Top Border (toggle bar) */}
  <motion.div
    layout="position"
    style={{
      height: 14,
      background: '#000',
      borderTop: '4px solid #000',
      cursor: 'pointer',
      userSelect: 'none',
      position: 'relative',
      zIndex: 5,
    }}
    whileHover={{ opacity: 0.8 }}
    onClick={() => setEntryVisible((v) => !v)}
  />

  {/* Sliding Entry Form */}
  <motion.div
    layout
    animate={{
      height: entryVisible ? 'auto' : 0,
      opacity: entryVisible ? 1 : 0,
    }}
    transition={{
      height: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.3 },
    }}
    style={{
      overflow: 'hidden',
      background: '#e5e5e5',
      borderBottom: entryVisible ? 'none' : '4px solid #000',
    }}
  >
    <AnimatePresence initial={false}>
      {entryVisible && (
        <motion.div
          key="entryForm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
        >
          <TenantEntryRow
            contacts={contacts}
            entry={entry}
            onChange={(p) => setEntry({ ...entry, ...p })}
            onSave={saveTenant}
          />
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
</div>

      {/* Data Rows */}
{/* Smoothly animated sorted rows */}
<AnimatePresence>
  {[...rows]
    .sort((a, b) => {
      const order = { CURRENT: 0, FUTURE: 1, PAST: 2, null: 3 };
      return (order[a.tenant_status || 'null'] ?? 3) - (order[b.tenant_status || 'null'] ?? 3);
    })
    .map((r, i) => (
      <motion.div key={r.tenant_id || i} layout transition={{ duration: 0.45, ease: 'easeInOut' }}>
        <TenantDataRow tenant={r} onDelete={deleteTenant} onSave={saveTenant} />
      </motion.div>
    ))}
</AnimatePresence>

    </div>
  );
}
