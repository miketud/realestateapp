// src/components/PurchaseDetailsTable.tsx
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useCallback,
} from 'react';
import { Table, Loader, Center } from '@mantine/core';
import LoanDetailsTable from './LoanDetailsTable';
import BannerMessage from './BannerMessage';
import UniversalDropdown, { type DropdownOption as UDOption } from './UniversalDropdown';

/* ───────── Layout / visuals ───────── */
const MAIN_COL_WIDTH = 175;
const BASE_FONT_SIZE = 16;
const MAX_COLS = 9;
const TABLE_WIDTH = MAIN_COL_WIDTH * MAX_COLS;
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

const cellStyle: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: '#fff',
  fontSize: BASE_FONT_SIZE,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const inputCellStyle: React.CSSProperties = {
  width: '100%',
  fontSize: BASE_FONT_SIZE,
  fontFamily: 'inherit',
  border: 'none',
  background: 'transparent',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
};

type PurchaseDetails = {
  purchase_id: number;
  property_id: number;
  closing_date: string | null;
  purchase_price: number | null;
  financing_type: string;
  acquisition_type: string;
  buyer: string;
  seller: string;
  closing_costs: number | null;
  earnest_money: number | null;
  down_payment?: number | null;
  notes?: string;
};

type Column = { key: keyof PurchaseDetails; label: string; type?: 'number' | 'date' | 'text' };

const COLUMNS: Column[] = [
  { key: 'closing_date', label: 'Closing Date', type: 'date' },
  { key: 'purchase_price', label: 'Purchase Price', type: 'number' },
  { key: 'financing_type', label: 'Financing Type', type: 'text' },
  { key: 'acquisition_type', label: 'Acquisition Type', type: 'text' },
  { key: 'buyer', label: 'Buyer', type: 'text' },
  { key: 'seller', label: 'Seller', type: 'text' },
  { key: 'down_payment', label: 'Down Payment', type: 'number' },
  { key: 'earnest_money', label: 'Earnest Money', type: 'number' },
  { key: 'closing_costs', label: 'Closing Costs', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
];

const MAIN_COLUMNS: Column[] = COLUMNS.filter((c) => c.key !== 'notes');

function ColsPx() {
  return (
    <colgroup>
      {Array.from({ length: MAX_COLS }).map((_, i) => (
        <col key={i} style={{ width: MAIN_COL_WIDTH }} />
      ))}
    </colgroup>
  );
}

/* ───────── Component ───────── */
export default function PurchaseDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<PurchaseDetails | null>(null);
  const [editKey, setEditKey] = useState<keyof PurchaseDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [propertyCreatedAt, setPropertyCreatedAt] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // Collapsible state
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState(0);
  const measure = useCallback(() => setMaxH(bodyRef.current?.scrollHeight ?? 0), []);
  useLayoutEffect(() => { measure(); }, [measure, data, editKey, open]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  // Load contacts → options for Buyer/Seller
  const [contactNames, setContactNames] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((arr: any[]) => {
        const names = Array.isArray(arr) ? arr.map((c) => String(c?.name || '')).filter(Boolean) : [];
        setContactNames(Array.from(new Set(names)));
      })
      .catch(() => void 0);
  }, []);
  const CONTACT_OPTS = useMemo<UDOption[]>(
    () => [{ value: '', label: '—' }, ...contactNames.map((n) => ({ value: n }))],
    [contactNames]
  );

  // property.created_at
  useEffect(() => {
    if (!property_id) return;
    fetch(`/api/properties/${property_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.created_at) setPropertyCreatedAt(j.created_at);
        setSaveError(null);
      })
      .catch(() => {});
  }, [property_id]);

  // load purchase details
  useEffect(() => {
    setLoading(true);
    fetch(`/api/purchase_details?property_id=${property_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.error) {
          setData(j);
          setSaveError(null);
        } else {
          setData(null);
        }
      })
      .catch(() => {
        setData(null);
        setSaveError('Failed to load purchase details.');
      })
      .finally(() => setLoading(false));
  }, [property_id]);

  // auto-create if missing
  useEffect(() => {
    if (loading || data || !propertyCreatedAt) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    const closingDate = propertyCreatedAt.slice(0, 10);
    fetch('/api/purchase_details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id,
        closing_date: closingDate,
        purchase_price: null,
        buyer: '',
        seller: '',
        financing_type: '',
        acquisition_type: '',
        closing_costs: null,
        earnest_money: null,
        down_payment: null,
        notes: '',
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j) => {
        if (!j?.error) {
          setData(j);
          setSaveError(null);
        }
      })
      .catch((e) => {
        setSaveError(`Failed to auto-create purchase details: ${e?.message || 'server error'}`);
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [loading, data, property_id, propertyCreatedAt]);

  /* Editing */
  function startEdit(key: keyof PurchaseDetails) {
    if (!data || saving) return;
    setSaveError(null);
    setEditKey(key);
    let v: any = data[key];
    const col = COLUMNS.find((c) => c.key === key);
    if (col?.type === 'date') v = v ? String(v).slice(0, 10) : '';
    setEditValue(v ?? '');
  }

  async function saveEdit(key: keyof PurchaseDetails, customValue?: any) {
    if (!data) return;
    setSaving(true);

    const col = COLUMNS.find((c) => c.key === key);
    let value = customValue !== undefined ? customValue : editValue;

    if (col?.type === 'number') value = value === '' ? null : Number(value);
    if (col?.type === 'date') value = value === '' ? null : String(value).slice(0, 10);

    try {
      const res = await fetch(`/api/purchase_details/${data.purchase_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update');
      }
      const updated = await res.json();
      if (!updated?.error) {
        setData(updated);
        setSaveError(null);
      } else {
        setSaveError('Update failed.');
      }
    } catch (e: any) {
      setSaveError(`Failed to save field: ${e?.message || 'server error'}`);
    }

    setSaving(false);
    setEditKey(null);
  }

  if (loading) {
    return (
      <Center style={{ minHeight: 70 }}>
        <Loader size="md" />
      </Center>
    );
  }

  const labelBarStyle: React.CSSProperties = {
    width: TABLE_WIDTH,
    boxSizing: 'border-box',
    margin: '0 auto 0',
    padding: '12px 16px',
    background: '#b6b6b6ff',
    border: '1px solid #000',
    borderBottom: open ? 'none' : '1px solid #000',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 1,
    position: 'relative',
  };

  // Static dropdowns
  const FINANCING_OPTS: UDOption[] = [
    { value: '', label: '—' },
    { value: 'Cash' },
    { value: 'Loan' },
    { value: 'Seller Financing' },
    { value: 'Private Money' },
    { value: 'Hard Money' },
  ];
  const ACQ_OPTS: UDOption[] = [
    { value: '', label: '—' },
    { value: '1031 Exchange' },
    { value: 'Standard Purchase' },
    { value: 'Foreclosure / REO' },
    { value: 'Auction' },
    { value: 'Inheritance / Gift' },
  ];

  return (
    <div style={{ margin: 0 }}>
      {saveError && (
        <div style={{ width: TABLE_WIDTH, margin: '0 auto 24px' }}>
          <BannerMessage
            message={saveError}
            type="error"
            autoCloseMs={5000}
            onDismiss={() => setSaveError(null)}
          />
        </div>
      )}

      {/* LABEL + TOGGLE */}
      <div style={labelBarStyle}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Hide purchase details' : 'Show purchase details'}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 18,
              height: 2,
              background: '#000',
              transform: `translate(-50%, -50%) rotate(${open ? 60 : 0}deg)`,
              transition: 'transform 200ms ease',
            }}
          />
        </button>
        PURCHASE DETAILS
      </div>

      {/* Collapsible body */}
      <div
        ref={bodyRef}
        style={{
          overflow: open ? 'visible' : 'hidden',
          maxHeight: open ? maxH : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 260ms ease, opacity 200ms ease',
        }}
      >
        <div style={{ width: TABLE_WIDTH, margin: '0 auto 0' }}>
          <Table
            striped
            highlightOnHover
            withColumnBorders
            style={{
              fontSize: BASE_FONT_SIZE,
              borderCollapse: 'collapse',
              border: '1px solid #000',
              boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
              background: '#fff',
              width: TABLE_WIDTH,
              textAlign: 'center',
              tableLayout: 'fixed',
            }}
          >
            <ColsPx />

            <thead>
              <tr>
                {MAIN_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      background: '#000',
                      color: '#fff',
                      fontWeight: 700,
                      padding: '13px',
                      border: '1px solid #222',
                      textAlign: 'center',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      width: MAIN_COL_WIDTH,
                      minWidth: MAIN_COL_WIDTH,
                      maxWidth: MAIN_COL_WIDTH,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Main row */}
              <tr>
                {MAIN_COLUMNS.map((col) => {
                  const v = data?.[col.key];
                  const isEditing = editKey === col.key;

                  const baseTdStyle: React.CSSProperties = {
                    ...cellStyle,
                    width: MAIN_COL_WIDTH,
                    minWidth: MAIN_COL_WIDTH,
                    maxWidth: MAIN_COL_WIDTH,
                    cursor: 'pointer',
                    ...(isEditing ? { boxShadow: FOCUS_RING, background: '#eef5ff' } : {}),
                  };

                  if (!isEditing) {
                    return (
                      <td
                        key={col.key}
                        style={baseTdStyle}
                        onClick={() => startEdit(col.key)}
                      >
                        {v === null || v === undefined || String(v).trim() === ''
                          ? <span style={{ color: '#bbb' }}>—</span>
                          : col.type === 'date'
                          ? String(v).slice(0, 10)
                          : col.type === 'number'
                          ? `$${Number(v).toLocaleString()}`
                          : String(v)}
                      </td>
                    );
                  }

                  // Financing Type
                  if (col.key === 'financing_type') {
                    return (
                      <td key={col.key} style={baseTdStyle}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Financing Type"
                          options={FINANCING_OPTS}
                          onChange={(val) => saveEdit(col.key, val)}
                          ariaLabel="Financing Type"
                        />
                      </td>
                    );
                  }

                  // Acquisition Type
                  if (col.key === 'acquisition_type') {
                    return (
                      <td key={col.key} style={baseTdStyle}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Acquisition Type"
                          options={ACQ_OPTS}
                          onChange={(val) => saveEdit(col.key, val)}
                          ariaLabel="Acquisition Type"
                        />
                      </td>
                    );
                  }

                  // Buyer / Seller
                  if (col.key === 'buyer' || col.key === 'seller') {
                    return (
                      <td key={col.key} style={baseTdStyle}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder={col.key === 'buyer' ? 'Buyer' : 'Seller'}
                          options={CONTACT_OPTS}
                          onChange={(val) => saveEdit(col.key, val)}
                          ariaLabel={col.key === 'buyer' ? 'Buyer' : 'Seller'}
                        />
                      </td>
                    );
                  }

                  // Generic editor
                  return (
                    <td key={col.key} style={baseTdStyle}>
                      <input
                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        value={editValue ?? ''}
                        style={inputCellStyle}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(col.key);
                          if (e.key === 'Escape') setEditKey(null);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>

              {/* Notes row */}
              <tr>
                <td
                  style={{
                    ...cellStyle,
                    background: '#ece8d4',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    width: MAIN_COL_WIDTH,
                    minWidth: MAIN_COL_WIDTH,
                    maxWidth: MAIN_COL_WIDTH,
                  }}
                >
                  Notes
                </td>

                <td
                  colSpan={MAX_COLS - 1}
                  style={{
                    ...cellStyle,
                    textAlign: 'left',
                    cursor: 'pointer',
                    ...(editKey === 'notes' ? { boxShadow: FOCUS_RING, background: '#eef5ff' } : {}),
                  }}
                  onClick={() => startEdit('notes')}
                >
                  {editKey === 'notes' ? (
                    <input
                      type="text"
                      value={editValue ?? ''}
                      style={{ ...inputCellStyle, maxWidth: '100%', textAlign: 'left' }}
                      autoFocus
                      disabled={saving}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit('notes')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit('notes');
                        if (e.key === 'Escape') setEditKey(null);
                      }}
                    />
                  ) : data?.notes && String(data.notes).trim() !== '' ? (
                    <span>{String(data.notes)}</span>
                  ) : (
                    <span style={{ color: '#bbb' }}>—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </Table>
        </div>

        {/* Conditional loan details */}
        {(() => {
          const ft = (data?.financing_type ?? '').toLowerCase();
          const showLoanDetails = ft.includes('loan') || ft.includes('seller financing');
          return showLoanDetails ? (
            <div style={{ marginTop: 0, width: '100%' }}>
              <LoanDetailsTable property_id={property_id} />
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
