import { useEffect, useState } from 'react';
import { Table } from '@mantine/core';
import LoanPaymentsTable from './LoanPaymentsTable';

const cellStyle: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  minWidth: 120,
  maxWidth: 220,
  textAlign: 'center',
  background: '#fff',
};

function InlineSpinner() {
  return (
    <svg
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: 8,
        width: 16,
        height: 16,
      }}
      viewBox="0 0 50 50"
    >
      <circle
        cx="25" cy="25" r="20"
        fill="none" stroke="#325dae" strokeWidth="5"
        strokeDasharray="31.415, 31.415"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

export type LoanDetails = {
  loan_id: string;
  property_id: number;
  purchase_id: number;
  loan_amount: number | null;
  lender: string;
  interest_rate: number | null;
  loan_term: number | null;
  loan_start: string;
  loan_end: string;
  loan_type: string;
  balloon_payment: boolean;
  prepayment_penalty: boolean;
  refinanced: boolean;
  loan_status: string;
  amortization_period?: number | null;
  monthly_payment?: number | null;
  notes?: string;
};

const COLUMNS: {
  key: keyof LoanDetails;
  label: string;
  type?: 'number' | 'date' | 'text' | 'boolean';
}[] = [
    { key: 'loan_id', label: 'Loan Number', type: 'text' },
    { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
    { key: 'lender', label: 'Lender', type: 'text' },
    { key: 'interest_rate', label: 'Interest Rate (%)', type: 'number' },
    { key: 'loan_term', label: 'Loan Term (months)', type: 'number' },
    { key: 'loan_start', label: 'Start Date', type: 'date' },
    { key: 'loan_end', label: 'End Date', type: 'date' },
    { key: 'amortization_period', label: 'Amortization Period (Years)', type: 'number' },
    { key: 'monthly_payment', label: 'Monthly Payment', type: 'number' },
    { key: 'loan_type', label: 'Loan Type', type: 'text' },
    { key: 'balloon_payment', label: 'Balloon Payment', type: 'boolean' },
    { key: 'prepayment_penalty', label: 'Prepayment Penalty', type: 'boolean' },
    { key: 'refinanced', label: 'Refinanced', type: 'boolean' },
    { key: 'loan_status', label: 'Loan Status', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ];

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 17,
  fontFamily: 'inherit',
  border: '1.5px solid #325dae',
  borderRadius: 6,
  background: '#f2f6fd',
  padding: '7px 12px',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function LoanDetailsTable({
  property_id,
}: {
  property_id: number;
}) {
  const [data, setData] = useState<LoanDetails | null>(null);
  const [editingKey, setEditingKey] = useState<keyof LoanDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [saving, setSaving] = useState(false);

  const canShowPayments =
    data?.monthly_payment !== null &&
    data?.loan_start !== '' &&
    data?.loan_term !== null &&
    data?.amortization_period !== null &&
    data?.loan_amount !== null &&
    data?.interest_rate !== null &&
    data?.loan_id &&
    data.loan_id.trim() !== '';

  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    if (canShowPayments) setShowPayments(true);
    else setShowPayments(false);
  }, [canShowPayments]);

  async function getPurchaseIdByPropertyId(property_id: number): Promise<number | null> {
    const res = await fetch(`/api/purchase_details?property_id=${property_id}`);
    const json = await res.json();
    return json && json.purchase_id ? json.purchase_id : null;
  }

  function startEdit(key: keyof LoanDetails) {
    if (!data || saving) return;
    setEditingKey(key);
    setEditValue(data[key] ?? '');
  }

  useEffect(() => {
    fetch(`/api/loan_details?property_id=${property_id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json);
        else {
          getPurchaseIdByPropertyId(property_id).then((purchase_id) => {
            setData({
              loan_id: '',
              property_id,
              purchase_id: purchase_id ?? 0,
              loan_amount: null,
              lender: '',
              interest_rate: null,
              loan_term: null,
              monthly_payment: null,
              loan_start: '',
              loan_end: '',
              loan_type: '',
              balloon_payment: false,
              prepayment_penalty: false,
              refinanced: false,
              loan_status: '',
              amortization_period: null,
              notes: '',
            });
          });
        }
      })
      .catch(() => setData(null));
  }, [property_id]);

  const handleSave = async (key: keyof LoanDetails, customValue?: any) => {
    if (!data) return;
    setSaving(true);

    let value = customValue !== undefined ? customValue : editValue;
    if (COLUMNS.find((col) => col.key === key)?.type === 'number') {
      value = value === '' ? null : Number(value);
    }
    if (COLUMNS.find((col) => col.key === key)?.type === 'boolean') {
      if (value === '' || value === undefined) {
        value = null;
      } else {
        value = value === 'true' || value === true || value === 'Yes';
      }
    }
    if (COLUMNS.find((col) => col.key === key)?.type === 'date') {
      value = value === '' ? null : value.slice(0, 10);
    }
    // ... type conversions above

    let url = '';
    let method: 'POST' | 'PATCH' = 'POST';
    let body: any = {};

    const isLoanIdReady = data.loan_id && data.loan_id.trim() !== '';

    try {
      if (key === 'loan_id' && !isLoanIdReady) {
        // 1. POST new loan row
        url = '/api/loan_details';
        method = 'POST';
        body = { ...data, loan_id: value };
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        if (!created.error) {
          // 2. GET the new row from DB to sync state
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? created : freshJson);
        } else {
          alert("Failed to create loan: " + created.error);
        }
      } else if (key === 'loan_id' && isLoanIdReady) {
        // PATCH loan_id (edit): PATCH by composite key (property_id, purchase_id)
        if (!value || String(value).trim() === '') {
          alert("Loan Number cannot be empty. Use admin tools to delete if needed.");
          setSaving(false);
          setEditingKey(null);
          return;
        }
        url = `/api/loan_details/by_property_purchase`;
        method = 'PATCH';
        body = {
          property_id: data.property_id,
          purchase_id: data.purchase_id,
          loan_id: value,
        };
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const updated = await res.json();
        if (!updated.error) {
          // Fetch updated row using the NEW loan_id
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? updated : freshJson);
        } else {
          alert("Failed to update loan number: " + updated.error);
        }
      } else if (isLoanIdReady && key !== 'loan_id') {
        // PATCH by loan_id for normal fields
        url = `/api/loan_details/${String(data.loan_id)}`;
        method = 'PATCH';
        body = { [key]: value };
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const updated = await res.json();
        if (!updated.error) {
          // GET fresh row to sync state
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? updated : freshJson);
        } else {
          if (res.status === 404) {
            alert("Loan record not found in the database. Please reload the page.");
          } else {
            alert("Error updating loan: " + updated.error);
          }
        }
      } else {
        alert("No loan record exists to edit. Please enter a Loan Number first.");
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error updating loan details.");
    }

    setSaving(false);
    setEditingKey(null);
  };

  // Only allow editing of loan_id until loan row exists (loan_id is set)
  const isLoanIdReady = data?.loan_id && data.loan_id.trim() !== '';

  return (
    <>
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
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map((col) => (
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
            {COLUMNS.map((col) => {
              const v = data?.[col.key];
              const isDateCol = col.key === 'loan_start' || col.key === 'loan_end';
              const isEditing = editingKey === col.key;

              // Loan Number cell (always editable, only editable until row is created)
              if (col.key === 'loan_id') {
                return (
                  <td key={col.key} style={cellStyle}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValue ?? ''}
                        style={inputStyle}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSave(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(col.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => !saving && startEdit(col.key)}
                        style={{ color: !saving ? '#000' : '#bbb', cursor: 'default' }}
                      >
                        {v && String(v).trim() !== '' ? String(v) : <span style={{ color: '#bbb' }}>—</span>}
                      </span>
                    )}
                    {isEditing && <InlineSpinner />}
                  </td>
                );
              }              // All other cells: dim and block editing if row does not exist
              if (!isLoanIdReady) {
                return (
                  <td
                    key={col.key}
                    style={{
                      ...cellStyle,
                      background: '#f3f3f3',
                      color: '#aaa',
                      opacity: 0.6,
                      pointerEvents: 'none',
                    }}
                  >
                    {col.type === 'boolean'
                      ? '—'
                      : <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                );
              }

              // Date cells (editable after row exists)
              if (isDateCol) {
                return (
                  <td
                    key={col.key}
                    style={{
                      ...cellStyle,
                      background: '#fff',
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="date"
                      value={v ? String(v).slice(0, 10) : ''}
                      style={{
                        ...inputStyle,
                        border: 'none',
                        background: 'transparent',
                        padding: '13px',
                        textAlign: 'center',
                      }}
                      disabled={saving}
                      onChange={(e) => !saving && handleSave(col.key, e.target.value)}
                    />
                    {saving && isEditing && <InlineSpinner />}
                  </td>
                );
              }

              // Editable cell input (numbers, text, etc.)
              if (isEditing) {
                if (col.type === 'boolean') {
                  return (
                    <td key={col.key} style={cellStyle}>
                      <select
                        value={editValue === true || editValue === 'Yes' ? 'Yes' : 'No'}
                        style={inputStyle}
                        onChange={(e) => setEditValue(e.target.value === 'Yes')}
                        onBlur={() => handleSave(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(col.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                        disabled={saving}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                      {saving && <InlineSpinner />}
                    </td>
                  );
                }
                return (
                  <td key={col.key} style={cellStyle}>
                    <input
                      type={col.type === 'number' ? 'number' : 'text'}
                      value={editValue ?? ''}
                      style={inputStyle}
                      autoFocus
                      disabled={saving}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSave(col.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(col.key);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                    />
                    {saving && <InlineSpinner />}
                  </td>
                );
              }

              // Default, always allow click-to-edit if not saving (no pointer hand, just default cursor)
              return (
                <td
                  key={col.key}
                  style={{
                    ...cellStyle,
                    background: '#fff',
                    opacity: saving ? 0.5 : 1,
                  }}
                  onClick={() =>
                    !saving && col.type !== 'boolean' && col.key !== 'loan_id'
                      ? startEdit(col.key)
                      : undefined
                  }
                >
                  {(v === null || v === undefined || String(v).trim() === '') && col.type !== 'boolean' ? (
                    <span style={{ color: '#bbb' }}>—</span>
                  ) : col.key === 'interest_rate' ? (
                    `${Number(v)}%`
                  ) : col.key === 'loan_term' ? (
                    Number(v)
                  ) : col.type === 'boolean' ? (
                    v ? 'Yes' : 'No'
                  ) : col.type === 'number' ? (
                    col.key === 'amortization_period'
                      ? Number(v)
                      : `$${Number(v).toLocaleString()}`
                  ) : (
                    String(v)
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </Table>

{canShowPayments && (
  <button
    style={{
      margin: '26px 0 22px 0',
      minWidth: 400,
      fontWeight: 700,
      fontFamily: 'inherit',
      padding: '12px 0',
      border: '2px solid #222',
      borderRadius: 0,
      background: showPayments ? '#f0b8a6a2' : '#97cbf7b4',
      color: '#222',
      fontSize: 18,
      letterSpacing: 1,
      cursor: 'pointer',
      textTransform: 'uppercase',
      boxShadow: showPayments ? '0 2px 7px 0 rgba(50, 50, 0, 0.03)' : 'none',
      transition: 'background 0.14s, color 0.14s, box-shadow 0.14s',
      outline: 'none',
    }}
    onClick={() => setShowPayments((v) => !v)}
  >
    {showPayments ? 'Hide Loan Payments' : 'Show Loan Payments'}
  </button>
)}


      {showPayments && data && (
        <LoanPaymentsTable
          loanStart={data.loan_start}
          loanEnd={data.loan_end || data.loan_start}
          monthlyPayment={Number(data.monthly_payment) || 0}
          loanId={data.loan_id}
          propertyId={data.property_id}
        />
      )}
    </>
  );
}
