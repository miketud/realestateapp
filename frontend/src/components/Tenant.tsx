// src/components/Tenant.tsx
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';
import { Icon, IconButton } from './ui/Icons';
import DatePickerField from './DatePicker';

type Contact = { contact_id: number; name: string; contact_type?: string };

type TenantRecord = {
  property_id: number;
  tenant_id?: number | null;
  tenant_name?: string | null;
  tenant_status?: 'Current' | 'Future' | 'Former' | 'Inactive' | null;
  lease_start?: string | null; // ISO yyyy-mm-dd
  lease_end?: string | null;   // ISO yyyy-mm-dd
  rent_amount?: number | null;
  created_at?: string;
  updated_at?: string;
};

const CELL_H = 70;
const API_TENANT = '/api/tenant';

const STATUS_COLOR: Record<NonNullable<TenantRecord['tenant_status']>, string> = {
  Current: '#16a34a',
  Future : '#7e22ce',
  Former : '#f97316',
  Inactive: '#9ca3af',
};

/* ------------------------------
   A single tenant row
------------------------------ */
function TenantRow({
  contacts,
  row,
  onChange,
  onSave,
  isMain = false,
}: {
  contacts: Contact[];
  row: TenantRecord;
  onChange: (patch: Partial<TenantRecord>) => void;
  onSave: (t: TenantRecord) => Promise<void>;
  isMain?: boolean; // main/anchored row (styling hook if needed)
}) {
  const [tenantId, setTenantId] = useState<string>('');

  // options (uppercased labels)
  const tenantOptions: DropdownOption[] = useMemo(
    () => [{ value: '', label: '—' }, ...contacts.map((c) => ({ value: String(c.contact_id), label: c.name.toUpperCase() }))],
    [contacts]
  );

  // derive convenience values
  const status = row.tenant_status ?? 'Inactive';
  const fromDate = row.lease_start ?? '';
  const toDate = row.lease_end ?? '';
  const canSave = Boolean(row.tenant_name && row.lease_start);

  // “lease ending soon” badge logic
  const leaseEndSoon = !!toDate && (() => {
    const end = new Date(toDate);
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / 86400000;
    return diff <= 30 && diff >= 0;
  })();

  // initial tenantId match for dropdown display, when a row comes with tenant_name
  useEffect(() => {
    if (!row.tenant_name) {
      setTenantId('');
      return;
    }
    const match = contacts.find(
      (c) => c.name.toUpperCase() === String(row.tenant_name || '').toUpperCase()
    );
    setTenantId(match ? String(match.contact_id) : '');
  }, [row.tenant_name, contacts]);

  // handlers
  const onSelectTenant = (val: string) => {
    setTenantId(val);
    const match = contacts.find((c) => String(c.contact_id) === val);
    if (match) {
      const trimmedName = match.name.slice(0, 25);
      onChange({
        tenant_id: match.contact_id,
        tenant_name: trimmedName,
        tenant_status: 'Current',
      });
    } else {
      onChange({ tenant_id: null, tenant_name: null, tenant_status: 'Inactive' });
    }
  };

  const cycleStatus = () => {
    if (!row?.tenant_name) return;
    const order: NonNullable<TenantRecord['tenant_status']>[] = ['Current', 'Future', 'Former'];
    const idx = order.indexOf((status as any) || 'Inactive');
    const next = idx === -1 ? 'Current' : order[(idx + 1) % order.length];
    onChange({ tenant_status: next });
  };

  const clearTenant = () => onChange({ tenant_name: null, tenant_id: null, tenant_status: 'Inactive' });
  const clearDates = () => onChange({ lease_start: null, lease_end: null });
  const clearRent = () => onChange({ rent_amount: null });

  const onFrom = (iso: string) => {
    if (toDate && iso && new Date(iso) > new Date(toDate)) return;
    onChange({ lease_start: iso || null });
  };
  const onTo = (iso: string) => {
    if (fromDate && iso && new Date(iso) < new Date(fromDate)) return;
    onChange({ lease_end: iso || null });
  };
  const onRent = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    onChange({ rent_amount: digits ? Number(digits) : null });
  };

  return (
    <div style={{ position: 'relative', borderTop: isMain ? '4px solid #000' : '2px solid #000', overflow: 'visible' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
          <col style={{ width: '33.33%' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: CELL_H }}>
            {/* LEFT — Tenant */}
            <td style={{ position: 'relative', verticalAlign: 'middle' }}>
              {/* section clear (×) */}
              {row?.tenant_name && (
                <button
                  onClick={clearTenant}
                  title="Clear tenant"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#555',
                  }}
                >
                  ×
                </button>
              )}

              {/* status pill */}
              <motion.button
                onClick={cycleStatus}
                animate={{ backgroundColor: STATUS_COLOR[status as keyof typeof STATUS_COLOR] || STATUS_COLOR.Inactive }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 8,
                  minWidth: 100,
                  height: 24,
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  color: '#fff',
                  border: 'none',
                  opacity: row?.tenant_name ? 1 : 0.45,
                  cursor: row?.tenant_name ? 'pointer' : 'default',
                  zIndex: 5,
                }}
                disabled={!row?.tenant_name}
                title={`${status} Tenant`}
                aria-label={`${status} Tenant`}
              >
                {row?.tenant_name ? status : '—'}
              </motion.button>

              {/* tenant select / display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: CELL_H }} title="Tenant Name" aria-label="Tenant Name">
                <div
                  style={{
                    width: '90%',
                    maxWidth: 500,
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: 30,
                    textTransform: 'uppercase',
                    color: '#000',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <UniversalDropdown
                    value={tenantId}
                    placeholder={row?.tenant_name ? row.tenant_name.toUpperCase().slice(0, 25) : 'Select tenant…'}
                    options={tenantOptions}
                    onChange={onSelectTenant}
                    ariaLabel="Tenant"
                    searchable
                    variant="flat"
                  />
                </div>
              </div>
            </td>

            {/* CENTER — Dates */}
            <td style={{ position: 'relative', verticalAlign: 'middle' }}>
              {/* vertical black dividers */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#000' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: '#000' }} />

              {/* section clear (×) */}
              {(row?.lease_start || row?.lease_end) && (
                <button
                  onClick={clearDates}
                  title="Clear dates"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#555',
                  }}
                >
                  ×
                </button>
              )}

              {/* expiring badge */}
              {leaseEndSoon && (
                <div style={{ position: 'absolute', right: 120, top: 0, color: '#b91c1c' }} title="Lease ending soon">
                  <Icon name="alert" size={20} />
                </div>
              )}

              {/* pickers */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, height: CELL_H }}>
                <DatePickerField value={fromDate} onChange={onFrom} ariaLabel="Lease Start" width={180} maxDateISO={toDate || null} />
                <Icon name="arrowRight" size={32} aria-hidden />
                <DatePickerField value={toDate} onChange={onTo} ariaLabel="Lease End" width={180} minDateISO={fromDate || null} />
              </div>
            </td>

            {/* RIGHT — Rent + Save icon (in its own mini section at the far right) */}
            <td style={{ position: 'relative', border: 'none', paddingRight: 64 /* reserve space for the save icon "section" */ }}>
              {/* section clear (×) */}
              {row?.rent_amount != null && row.rent_amount !== undefined && (
                <button
                  onClick={clearRent}
                  title="Clear rent"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 64 + 8, // keep away from the save button area
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#555',
                  }}
                >
                  ×
                </button>
              )}

              {/* rent input */}
              <div
                style={{
                  width: '100%',
                  height: CELL_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                title="Monthly Rent"
                aria-label="Monthly Rent"
              >
                <span style={{ fontWeight: 900, fontSize: 30, color: '#000' }}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={row?.rent_amount != null ? String(row.rent_amount) : ''}
                  onChange={(e) => onRent(e.target.value)}
                  placeholder="00000"
                  style={{
                    width: 150,
                    height: 36,
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    fontSize: 30,
                    lineHeight: 1,
                    textAlign: 'center',
                    fontWeight: 900,
                    letterSpacing: 1,
                    background: 'transparent',
                    color: '#000',
                  }}
                />
              </div>

              {/* SAVE ICON “SECTION” — positioned inside this cell so it doesn’t push anything and has no divider */}
              <AnimatePresence>
                {canSave && (
                  <motion.div
                    key="save-icon"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                    }}
                    title="Save tenant"
                    aria-label="Save tenant"
                  >
                    <IconButton
                      icon="save"
                      label="Save"
                      onClick={() => onSave(row)}
                      boxSize={48}
                      iconSize={28}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------
   Container — anchored main row + appended rows after save
------------------------------ */
export default function Tenant({ property_id }: { property_id: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rows, setRows] = useState<TenantRecord[]>([]); // rows[0] is the anchored row

  // load contacts + initial tenant (single) for this property, then anchor a main row
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cRes, tRes] = await Promise.all([
          fetch('/api/contacts'),
          fetch(`${API_TENANT}?property_id=${property_id}`),
        ]);
        const contactsJson = (await cRes.json()) as any[];
        const oneTenant = await tRes.json();

        if (!alive) return;

        const list: Contact[] = (Array.isArray(contactsJson) ? contactsJson : [])
          .map((c) => ({
            contact_id: Number(c.contact_id),
            name: String(c.name || ''),
            contact_type: String(c.contact_type || ''),
          }))
          .filter((c) => c.name);

        list.sort((a, b) => {
          const at = (a.contact_type || '').toLowerCase() === 'tenant' ? 0 : 1;
          const bt = (b.contact_type || '').toLowerCase() === 'tenant' ? 0 : 1;
          if (at !== bt) return at - bt;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        setContacts(list);

        // anchor row: if server returned one, use it. else start blank.
        const anchor: TenantRecord =
          oneTenant && oneTenant.property_id
            ? {
                ...oneTenant,
                lease_start: oneTenant.lease_start?.slice?.(0, 10) ?? null,
                lease_end: oneTenant.lease_end?.slice?.(0, 10) ?? null,
              }
            : {
                property_id,
                tenant_status: 'Inactive',
                tenant_name: null,
                tenant_id: null,
                lease_start: null,
                lease_end: null,
                rent_amount: null,
              };

        setRows([anchor]); // main row only to begin with
      } catch {
        if (!alive) return;
        setContacts([]);
        setRows([
          {
            property_id,
            tenant_status: 'Inactive',
            tenant_name: null,
            tenant_id: null,
            lease_start: null,
            lease_end: null,
            rent_amount: null,
          },
        ]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [property_id]);

  // persist a row then append a blank row below
  const saveRow = async (t: TenantRecord) => {
    try {
      await fetch(API_TENANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      });

      // Append a fresh blank row beneath current rows
      setRows((prev) => [
        ...prev,
        {
          property_id,
          tenant_status: 'Inactive',
          tenant_name: null,
          tenant_id: null,
          lease_start: null,
          lease_end: null,
          rent_amount: null,
        },
      ]);
    } catch (e) {
      console.error('Tenant save failed', e);
    }
  };

  return (
    <div style={{ position: 'relative', border: '4px solid #000', overflow: 'visible' }}>
      {/* anchored main row */}
      {rows.length > 0 && (
        <TenantRow
          contacts={contacts}
          row={rows[0]}
          onChange={(p) =>
            setRows((prev) => {
              const copy = [...prev];
              copy[0] = { ...copy[0], ...p };
              return copy;
            })
          }
          onSave={saveRow}
          isMain
        />
      )}

      {/* appended rows (after saving) */}
      {rows.slice(1).map((r, i) => (
        <TenantRow
          key={`row-${i + 1}`}
          contacts={contacts}
          row={r}
          onChange={(p) =>
            setRows((prev) => {
              const copy = [...prev];
              copy[i + 1] = { ...copy[i + 1], ...p };
              return copy;
            })
          }
          onSave={saveRow}
        />
      ))}
    </div>
  );
}
