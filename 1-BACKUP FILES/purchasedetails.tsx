import { useEffect, useRef, useState } from 'react';
import { Table, Title, Loader, Center } from '@mantine/core';
import LoanDetailsTable from './LoanDetailsTable';


type PurchaseDetails = {
  purchase_id: number;
  property_id: number;
  closing_date: string | null;
  purchase_price: number | null;
  buyer: string;
  seller: string;
  financing_type: string;
  acquisition_type: string;
  closing_costs: number | null;
  earnest_money: number | null;
  down_payment?: number | null;
  notes?: string;
};

const COLUMNS: { key: keyof PurchaseDetails; label: string; type?: 'number' | 'date' | 'text' }[] = [
  { key: 'closing_date', label: 'Closing Date', type: 'date' },
  { key: 'purchase_price', label: 'Purchase Price', type: 'number' },
  { key: 'down_payment', label: 'Down Payment', type: 'number' },
  { key: 'buyer', label: 'Buyer', type: 'text' },
  { key: 'seller', label: 'Seller', type: 'text' },
  { key: 'financing_type', label: 'Financing Type', type: 'text' },
  { key: 'acquisition_type', label: 'Acquisition Type', type: 'text' },
  { key: 'closing_costs', label: 'Closing Costs', type: 'number' },
  { key: 'earnest_money', label: 'Earnest Money', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 17,
  fontFamily: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  border: '1.5px solid #325dae',
  borderRadius: 6,
  background: '#f2f6fd',
  padding: '7px 12px',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function PurchaseDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<PurchaseDetails | null>(null);
  const [editKey, setEditKey] = useState<keyof PurchaseDetails | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propertyCreatedAt, setPropertyCreatedAt] = useState<string | null>(null);
  const creatingFlag = useRef<{ [property_id: number]: boolean }>({});

  // Fetch property info for created_at
  useEffect(() => {
    if (!property_id) return;
    fetch(`/api/properties/${property_id}`)
      .then(res => res.json())
      .then(json => {
        if (json && json.created_at) {
          setPropertyCreatedAt(json.created_at);
        }
      });
  }, [property_id]);

  // Fetch purchase details as normal
  useEffect(() => {
    setLoading(true);
    fetch(`/api/purchase_details?property_id=${property_id}`)
      .then(res => res.json())
      .then(json => {
        if (!json.error) setData(json);
        else setData(null);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [property_id]);

  // Auto-create Purchase Details if none exist, using property.created_at for closing_date
  useEffect(() => {
    if (!loading && !data && propertyCreatedAt) {
      if (creatingFlag.current[property_id]) return;
      creatingFlag.current[property_id] = true;

      const closingDate = propertyCreatedAt.slice(0, 10);

      fetch('/api/purchase_details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id,
          purchase_price: null,
          financing_type: '',
          acquisition_type: '',
          buyer: '',
          seller: '',
          closing_date: closingDate,
          closing_costs: null,
          earnest_money: null,
          notes: ''
        })
      })
        .then(res => res.json())
        .then(json => {
          if (!json.error) setData(json);
        });
    }
  }, [loading, data, property_id, propertyCreatedAt]);

  function startEdit(key: keyof PurchaseDetails) {
    if (!data || saving) return;
    setEditKey(key);
    let v = data[key];
    if (COLUMNS.find(col => col.key === key)?.type === 'date' && v) {
      v = new Date(String(v)).toISOString().slice(0, 10);
    }
    setEditValue(v === null || v === undefined ? '' : String(v));
  }

  async function saveEdit(key: keyof PurchaseDetails, customValue?: string) {
    if (!data) return;
    setSaving(true);
    let value: any = customValue !== undefined ? customValue : editValue;
    if (COLUMNS.find(col => col.key === key)?.type === 'number') {
      value = value === '' ? 0 : Number(value);
    }
    if (COLUMNS.find(col => col.key === key)?.type === 'date') {
      value = value === '' ? null : value;
    }
    try {
      const res = await fetch(`/api/purchase_details/${data.purchase_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const updated = await res.json();
      if (!updated.error) setData(updated);
      else alert('Error updating: ' + updated.error);
    } catch (e) {
      alert('Network or server error');
      console.error(e);
    }
    setSaving(false);
    setEditKey(null);
    setEditValue('');
  }

  if (loading) {
    return (
      <Center style={{ minHeight: 70 }}>
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <div style={{ margin: '56px 0 38px 0' }}>
      <Title order={3} style={{
        marginBottom: 18,
        fontWeight: 800,
        color: '#4d4637',
        letterSpacing: 1,
      }}>
        PURCHASE DETAILS
      </Title>
      <Table
        striped
        highlightOnHover
        withColumnBorders
        style={{
          fontSize: 18,
          borderCollapse: 'collapse',
          border: '2px solid #222',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.06)',
          background: '#fff',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={{
                  background: '#ece8d4',
                  color: '#242211',
                  fontWeight: 700,
                  padding: '13px',
                  border: '1px solid #222',
                  textAlign: 'center',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {COLUMNS.map(col => {
              // Always-on date input for closing_date
              if (col.key === 'closing_date') {
                return (
                  <td
                    key={col.key}
                    style={{
                      border: '1px solid #222',
                      padding: 0,
                      position: 'relative',
                      minWidth: 150,
                      maxWidth: 240,
                      background: '#fff',
                    }}
                  >
                    <input
                      type="date"
                      value={
                        data?.closing_date
                          ? data.closing_date.slice(0, 10)
                          : ''
                      }
                      style={{
                        ...inputStyle,
                        border: 'none',
                        background: 'transparent',
                        padding: '13px',
                      }}
                      disabled={saving}
                      onChange={e => {
                        saveEdit('closing_date', e.target.value);
                      }}
                    />
                    {saving && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: 13,
                          fontSize: 15,
                          color: '#325dae'
                        }}
                      >
                        Saving...
                      </span>
                    )}
                  </td>
                );
              }
              // All other cells: click to edit as before
              return (
                <td
                  key={col.key}
                  style={{
                    border: '1px solid #222',
                    padding: '13px',
                    position: 'relative',
                    background: editKey === col.key ? '#f6f8f5' : undefined,
                    minWidth: 150,
                    maxWidth: 240,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                  onClick={() => !saving && editKey !== col.key && startEdit(col.key)}
                >
                  {editKey === col.key ? (
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={editValue}
                      style={inputStyle}
                      autoFocus
                      disabled={saving}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(col.key)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(col.key);
                        if (e.key === 'Escape') {
                          setEditKey(null);
                          setEditValue('');
                        }
                      }}
                    />
                  ) : (
                    (() => {
                      const v = data?.[col.key];
                      if (v === null || v === undefined || String(v).trim() === '') {
                        return <span style={{ color: '#bbb' }}>—</span>;
                      } if (col.type === 'date') return new Date(String(v)).toLocaleDateString();
                      if (col.type === 'number') return v !== null ? `$${Number(v).toLocaleString()}` : '—';
                      return String(v);
                    })()
                  )}
                  {editKey === col.key && saving && (
                    <span style={{
                      position: 'absolute',
                      right: 14,
                      top: 13,
                      fontSize: 15,
                      color: '#325dae'
                    }}>
                      Saving...
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </Table>
      {data?.financing_type === 'LOAN' && (
        <div style={{ marginTop: 26, width: '100%' }}>
          <Title
  order={3}
  style={{
    marginBottom: 18,
    fontWeight: 800,
    color: '#4d4637',
    letterSpacing: 1,
    marginTop: 36, // Adds spacing from the section above
    textTransform: 'uppercase',
  }}
>
  LOAN DETAILS
</Title>
          <LoanDetailsTable property_id={property_id} />
        </div>
      )}
    </div>
  );
}
