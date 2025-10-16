// src/components/Tenant.tsx
import { useEffect, useMemo, useState } from 'react';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';
import { Icon } from './ui/Icons';

type Contact = { contact_id: number; name: string; contact_type?: string };

const CELL_H = 56;
const STATUSES = ['Current', 'Future', 'Former'] as const;
const STATUS_COLOR: Record<(typeof STATUSES)[number], string> = {
  Current: '#16a34a',
  Future:  '#7e22ce',
  Former:  '#f97316',
};

const START_TEAL = { r: 153, g: 246, b: 228 }; // #99f6e4
const END_GREEN  = { r: 22,  g: 163, b: 74  }; // #16a34a
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (t: number) => ({
  r: lerp(START_TEAL.r, END_GREEN.r, t),
  g: lerp(START_TEAL.g, END_GREEN.g, t),
  b: lerp(START_TEAL.b, END_GREEN.b, t),
});

export default function Tenant({ property_id }: { property_id: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [rent, setRent] = useState<string>('');
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/contacts');
        const data = (await r.json()) as any[];
        if (!alive) return;
        const arr = (Array.isArray(data) ? data : [])
          .map((c) => ({ contact_id: Number(c.contact_id), name: String(c.name || ''), contact_type: String(c.contact_type || '') }))
          .filter((c) => c.name);
        setContacts(arr);
      } catch {
        setContacts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const tenantOptions: DropdownOption[] = useMemo(() => {
    const t = contacts.filter((c) => (c.contact_type || '').toLowerCase() === 'tenant');
    t.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return [{ value: '', label: '—' }, ...t.map((c) => ({ value: String(c.contact_id), label: c.name.toUpperCase() }))];
  }, [contacts]);

  const td: React.CSSProperties = { padding: 0, border: 'none', verticalAlign: 'middle' };
  const dateInputStyle: React.CSSProperties = {
    width: 220, height: 32, border: 'none', outline: 'none', padding: 0,
    fontSize: 30, boxSizing: 'border-box', background: 'transparent', lineHeight: 1, textAlign: 'left',
  };

  const onRentChange = (v: string) => setRent(v.replace(/\D/g, '').slice(0, 5));
  const cycleStatus = () => setStatusIdx((i) => (i + 1) % STATUSES.length);
  const status = STATUSES[statusIdx];

  const rentNum = parseInt(rent || '0', 10) || 0;
  const t = Math.min(rentNum, 100000) / 100000;
  const alpha = 0.4 + 0.6 * t;
  const rgb = mix(t);
  const rentBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

  return (
    // Removed top border, added bottom divider to match PropertyView sections
    <div style={{ border: '4px solid rgba(177, 177, 177, 1)', margin: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
        <colgroup>
          <col style={{ width: 50 }} />
          <col />
        </colgroup>
        <tbody>
          <tr style={{ height: CELL_H }}>
            {/* STATUS COLOR BLOCK */}
            <td style={{ ...td, textAlign: 'center' }}>
              <button
                type="button"
                onClick={cycleStatus}
                aria-label={`Tenant status: ${status}. Click to cycle`}
                title={`${status} — click to cycle`}
                style={{
                  width: 40, height: 40, background: STATUS_COLOR[status],
                  border: '1px solid #111', cursor: 'pointer', display: 'inline-block',
                }}
              />
            </td>

            {/* CONTENT */}
            <td style={{ ...td }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 24,
                  padding: '8px 10px',
                  width: '100%',
                }}
              >
                {/* LEFT: tenant */}
                <div style={{ minWidth: 300, maxWidth: 560, flex: '0 1 480px' }}>
                  <div style={{ fontSize: 30, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>
                    <UniversalDropdown
                      value={tenantId}
                      placeholder="Select tenant…"
                      options={tenantOptions}
                      onChange={setTenantId}
                      ariaLabel="Tenant"
                      searchable
                      variant="flat"
                    />
                  </div>
                </div>

                {/* CENTER: dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: '1 1 auto', justifyContent: 'center' }}>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={dateInputStyle} />
                  <Icon name="arrowRight" size={40} aria-hidden />
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={dateInputStyle} />
                </div>

                {/* RIGHT: rent */}
                <div style={{ flex: '0 0 240px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      padding: '6px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: rentBg,
                      borderRadius: 8,
                      minWidth: 220,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 30, lineHeight: 1 }}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rent}
                      onChange={(e) => onRentChange(e.target.value)}
                      placeholder="00000"
                      style={{
                        width: 140,
                        height: 32,
                        border: 'none',
                        outline: 'none',
                        padding: 0,
                        fontSize: 30,
                        lineHeight: 1,
                        textAlign: 'center',
                        fontWeight: 700,
                        letterSpacing: 1,
                        background: 'transparent',
                      }}
                    />
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
