// src/components/LoanDetailsTable.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Table } from '@mantine/core';
import BannerMessage from './BannerMessage';
import UniversalDropdown, { type DropdownOption } from './UniversalDropdown';

/* ───────── Tokens (aligned with overview & purchase details) ───────── */
const COL_WIDTH = 175;
const FONT_SIZE = 16;          // data cells
const HEADER_FONT_SIZE = 16;   // smaller headers to fit cell constraints
const MAX_COLS = 9;
const TABLE_WIDTH = COL_WIDTH * MAX_COLS;

const ROW_H = 52;
const HEADER_H = ROW_H;

/* Visuals */
const DIVIDER = '1px solid rgba(0,0,0,0.18)';
const HEADER_RULE = '2px solid rgba(0,0,0,0.25)';
const EMPTY_BG = 'rgba(0,0,0,0.06)';
const INACTIVE_BG = 'rgba(0,0,0,0.12)'; // darker than EMPTY_BG for locked cells
const HILITE_BG = 'rgba(0, 102, 255, 0.10)';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';
const PLACEHOLDER = '#9aa1a8';

/* Base cell */
const cellStyle: React.CSSProperties = {
  border: 'none',
  borderRight: DIVIDER,
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: 'transparent',
  fontSize: FONT_SIZE,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  height: ROW_H,
  verticalAlign: 'middle',
};

/* Header cell */
const headerCellStyle = (hasLabel: boolean): React.CSSProperties => ({
  border: 'none',
  borderRight: 'none',
  borderBottom: HEADER_RULE,
  padding: '6px 8px',             // room for two lines
  background: 'transparent',
  color: hasLabel ? '#2b2b2b' : 'transparent',
  fontWeight: 800,
  textTransform: 'uppercase',
  textAlign: 'center',
  fontSize: HEADER_FONT_SIZE,     // 16px
  height: HEADER_H,               // 52px cap
  lineHeight: '18px',             // fits 2 lines in 52px with padding
  whiteSpace: 'normal',           // allow wrap
  wordBreak: 'break-word',        // break long tokens
  overflow: 'hidden',             // clip overflow past 2 lines
});

/* Filler */
const fillerCell: React.CSSProperties = {
  ...cellStyle,
  background: 'transparent',
  color: 'transparent',
  cursor: 'default',
};

/* Locked cell (until Loan Number has input) */
const inactiveCellStyle: React.CSSProperties = {
  ...cellStyle,
  background: INACTIVE_BG,
  color: '#525964',
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

/* Borderless input */
const inputCellStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  fontSize: FONT_SIZE,
  fontFamily: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: 0,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
};

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

type Column = { key: keyof LoanDetails; label: string; type?: 'number' | 'date' | 'text' | 'boolean' };

const COLUMNS: Column[] = [
  { key: 'loan_id', label: 'Loan Number', type: 'text' },
  { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
  { key: 'lender', label: 'Lender', type: 'text' },
  { key: 'interest_rate', label: 'Interest Rate (%)', type: 'number' },
  { key: 'loan_term', label: 'Loan Term (months)', type: 'number' },
  { key: 'loan_start', label: 'Start Date', type: 'date' },
  { key: 'loan_end', label: 'End Date', type: 'date' },
  { key: 'amortization_period', label: 'Amortization Period (Years)', type: 'number' },
  { key: 'monthly_payment', label: 'Monthly Payment', type: 'number' },

  { key: 'loan_status', label: 'Loan Status', type: 'text' },
  { key: 'loan_type', label: 'Loan Type', type: 'text' },
  { key: 'balloon_payment', label: 'Balloon Payment', type: 'boolean' },
  { key: 'prepayment_penalty', label: 'Prepayment Penalty', type: 'boolean' },
  { key: 'refinanced', label: 'Refinanced', type: 'boolean' },

  { key: 'notes', label: 'Notes', type: 'text' },
];

const FIELDS_WO_NOTES: Column[] = COLUMNS.filter((c) => c.key !== 'notes');

export default function LoanDetailsTable({ property_id }: { property_id: number }) {
  const [data, setData] = useState<LoanDetails | null>(null);
  const [editingKey, setEditingKey] = useState<keyof LoanDetails | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // provisional loan id while user is typing; unlocks other fields immediately
  const [pendingLoanId, setPendingLoanId] = useState<string>('');

  /* Lender options from contacts */
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
  const LENDER_OPTS = useMemo<DropdownOption[]>(
    () => [{ value: '', label: '—' }, ...contactNames.map((n) => ({ value: n }))],
    [contactNames]
  );

  async function getPurchaseIdByPropertyId(pid: number): Promise<number | null> {
    const res = await fetch(`/api/purchase_details?property_id=${pid}`);
    const json = await res.json();
    return json && json.purchase_id ? json.purchase_id : null;
  }

  function startEdit(key: keyof LoanDetails) {
    if (!data || saving) return;
    setSaveError(null);
    setEditingKey(key);
    let current: any = (data as any)[key] ?? '';
    const col = COLUMNS.find((c) => c.key === key);
    if (col?.type === 'date') current = current ? String(current).slice(0, 10) : '';
    setEditValue(current);
    if (key === 'loan_id') setPendingLoanId(String(current || ''));
  }

  useEffect(() => {
    fetch(`/api/loan_details?property_id=${property_id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setData(json);
          setPendingLoanId(json?.loan_id || '');
          setSaveError(null);
        } else {
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
            setPendingLoanId('');
            setSaveError(null);
          });
        }
      })
      .catch(() => {
        setData(null);
        setPendingLoanId('');
        setSaveError('Failed to load loan details.');
      });
  }, [property_id]);

  const isLoanIdReady = Boolean(data?.loan_id && data.loan_id.trim() !== '');
  const isActivationLive = isLoanIdReady || (pendingLoanId.trim() !== '');

  async function ensureLoanRecord(): Promise<boolean> {
    if (!data) return false;
    if (isLoanIdReady) return true;
    const newId = pendingLoanId.trim();
    if (!newId) {
      setSaveError('Enter a Loan Number first.');
      return false;
    }
    try {
      let pid = data.purchase_id;
      if (!pid || pid === 0) {
        const got = await getPurchaseIdByPropertyId(data.property_id);
        if (!got) {
          setSaveError('Create Purchase Details first so a purchase_id exists.');
          return false;
        }
        pid = got;
      }
      const res = await fetch('/api/loan_details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, purchase_id: pid, loan_id: newId }),
      });
      const created = await res.json();
      if (!res.ok || created?.error) {
        setSaveError(`Failed to create loan: ${created?.error || res.statusText}`);
        return false;
      }
      // refresh
      const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
      const freshJson = await fresh.json();
      setData(freshJson.error ? created : freshJson);
      setSaveError(null);
      return true;
    } catch (e: any) {
      setSaveError(`Unexpected error: ${e?.message || 'server error'}`);
      return false;
    }
  }

  const handleSave = async (key: keyof LoanDetails, customValue?: any) => {
    if (!data) return;
    setSaving(true);

    const col = COLUMNS.find((c) => c.key === key);
    let value = customValue !== undefined ? customValue : editValue;

    if (col?.type === 'number') value = value === '' ? null : Number(value);
    if (col?.type === 'boolean') {
      if (typeof value === 'string') value = value === 'Yes' || value === 'true';
      else value = !!value;
    }
    if (col?.type === 'date') value = value === '' ? null : String(value).slice(0, 10);

    try {
      if (key === 'loan_id') {
        const v = String(value || '').trim();
        if (!v) {
          setSaveError('Loan Number cannot be empty.');
          setSaving(false);
          setEditingKey(null);
          return;
        }
        // create or update
        if (!isLoanIdReady) {
          const ok = await ensureLoanRecord();
          if (!ok) {
            setSaving(false);
            setEditingKey(null);
            return;
          }
        } else {
          const res = await fetch(`/api/loan_details/by_property_purchase`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ property_id: data.property_id, purchase_id: data.purchase_id, loan_id: v }),
          });
          const updated = await res.json();
          if (!res.ok || updated?.error) {
            setSaveError(`Failed to update loan number: ${updated?.error || res.statusText}`);
          } else {
            const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
            const freshJson = await fresh.json();
            setData(freshJson.error ? updated : freshJson);
            setSaveError(null);
          }
        }
      } else {
        // for any other field, ensure record exists if activation was via pendingLoanId
        if (!isLoanIdReady) {
          const ok = await ensureLoanRecord();
          if (!ok) {
            setSaving(false);
            setEditingKey(null);
            return;
          }
        }
        const res = await fetch(`/api/loan_details/${String((data.loan_id || pendingLoanId).trim())}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });
        const updated = await res.json();
        if (!res.ok || updated?.error) {
          setSaveError(res.status === 404 ? 'Loan record not found. Reload.' : `Error updating loan: ${updated?.error || res.statusText}`);
        } else {
          const fresh = await fetch(`/api/loan_details?property_id=${data.property_id}`);
          const freshJson = await fresh.json();
          setData(freshJson.error ? updated : freshJson);
          setSaveError(null);
        }
      }
    } catch (err: any) {
      setSaveError(`Unexpected error: ${err?.message || 'server error'}`);
    }

    setSaving(false);
    setEditingKey(null);
  };

  const sections: Column[][] = [];
  for (let i = 0; i < FIELDS_WO_NOTES.length; i += MAX_COLS) {
    sections.push(FIELDS_WO_NOTES.slice(i, i + MAX_COLS));
  }

  const padToMax = (arr: Column[]): (Column | null)[] => {
    const out: (Column | null)[] = [...arr];
    while (out.length < MAX_COLS) out.push(null);
    return out;
  };

  function ColsPx() {
    return (
      <colgroup>
        {Array.from({ length: MAX_COLS }).map((_, i) => (
          <col key={i} style={{ width: COL_WIDTH }} />
        ))}
      </colgroup>
    );
  }

  const focusShadow = (active: boolean): React.CSSProperties =>
    active ? { boxShadow: FOCUS_RING, background: HILITE_BG } : {};

  return (
    <div style={{ marginTop: 0, width: TABLE_WIDTH }}>
      {saveError && (
        <BannerMessage
          message={saveError}
          type="error"
          autoCloseMs={5000}
          onDismiss={() => setSaveError(null)}
        />
      )}

      {/* Title */}
      <div
        style={{
          width: TABLE_WIDTH,
          boxSizing: 'border-box',
          margin: '0 auto 8px',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: 1,
          color: '#111',
          position: 'relative',
        }}
      >
        LOAN DETAILS
      </div>

      {/* Divider under title */}
      <div
        style={{
          width: TABLE_WIDTH,
          margin: '0 auto 4px',
          height: 0,
          borderBottom: HEADER_RULE,
          boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
        }}
      />

      <Table
        highlightOnHover={false}
        withColumnBorders={false}
        style={{
          fontSize: FONT_SIZE,
          borderCollapse: 'collapse',
          borderSpacing: 0,
          background: '#fff',
          width: TABLE_WIDTH,
          textAlign: 'center',
          tableLayout: 'fixed',
          margin: 0,
        }}
      >
        <ColsPx />

        <tbody>
          {sections.map((cols, sIdx) => {
            const padded = padToMax(cols);

            const HeaderRow = (
              <tr key={`h-${sIdx}`}>
                {padded.map((col, ci) => (
                  <th key={`h-${sIdx}-${ci}`} style={headerCellStyle(Boolean(col?.label))}>
                    {col?.label?.toUpperCase() ?? ''}
                  </th>
                ))}
              </tr>
            );

            const ValueRow = (
              <tr key={`v-${sIdx}`}>
                {padded.map((col, ci) => {
                  if (!col) return <td key={`v-${sIdx}-${ci}`} style={fillerCell}>&nbsp;</td>;
                  const v = (data as any)?.[col.key];
                  const isEditing = editingKey === col.key;
                  const isEmpty =
                    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

                  // Loan Number cell (drives activation)
                  if (col.key === 'loan_id') {
                    return (
                      <td
                        key={`v-${sIdx}-${ci}`}
                        style={{
                          ...cellStyle,
                          cursor: 'pointer',
                          background: isEmpty ? EMPTY_BG : 'transparent',
                          ...focusShadow(isEditing),
                        }}
                        onClick={() => !saving && startEdit(col.key)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue ?? ''}
                            style={inputCellStyle}
                            autoFocus
                            disabled={saving}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setPendingLoanId(e.target.value);
                            }}
                            onBlur={() => handleSave(col.key)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(col.key);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                          />
                        ) : isEmpty ? (
                          <span style={{ color: PLACEHOLDER }}>—</span>
                        ) : (
                          <span>{String(v)}</span>
                        )}
                      </td>
                    );
                  }

                  // Locked cells until Loan Number has input (darker background)
                  if (!isActivationLive) {
                    return (
                      <td
                        key={`v-${sIdx}-${ci}`}
                        style={inactiveCellStyle}
                        title="Enter a Loan Number to enable editing"
                      >
                        {col.type === 'boolean' ? '—' : <span style={{ color: '#7b8490' }}>—</span>}
                      </td>
                    );
                  }

                  // Read view
                  if (!isEditing) {
                    return (
                      <td
                        key={`v-${sIdx}-${ci}`}
                        style={{
                          ...cellStyle,
                          cursor: 'pointer',
                          background: isEmpty && col.type !== 'boolean' ? EMPTY_BG : 'transparent',
                        }}
                        onClick={() => !saving && setEditingKey(col.key)}
                      >
                        {isEmpty && col.type !== 'boolean' ? (
                          <span style={{ color: PLACEHOLDER }}>—</span>
                        ) : col.key === 'interest_rate' ? (
                          `${Number(v)}%`
                        ) : col.key === 'loan_term' ? (
                          Number(v)
                        ) : col.type === 'boolean' ? (
                          v ? 'Yes' : 'No'
                        ) : col.type === 'number' ? (
                          col.key === 'amortization_period' ? Number(v) : `$${Number(v).toLocaleString()}`
                        ) : col.type === 'date' ? (
                          String(v).slice(0, 10)
                        ) : (
                          String(v)
                        )}
                      </td>
                    );
                  }

                  /* Edit views below (activationLive == true) */

                  if (col.key === 'loan_status') {
                    const STATUS_OPTS: DropdownOption[] = [
                      { value: '', label: '—' },
                      { value: 'Active' },
                      { value: 'Paid' },
                      { value: 'Pending' },
                    ];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Loan Status"
                          options={STATUS_OPTS}
                          onChange={(val) => handleSave(col.key, val)}
                          ariaLabel="Loan Status"
                        />
                      </td>
                    );
                  }

                  if (col.key === 'loan_type') {
                    const TYPE_OPTS: DropdownOption[] = [
                      { value: '', label: '—' },
                      { value: 'Conventional' },
                      { value: 'Hard Money' },
                      { value: 'Adjustable Rate Mortgage' },
                      { value: 'Fixed Rate Mortgage' },
                    ];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Loan Type"
                          options={TYPE_OPTS}
                          onChange={(val) => handleSave(col.key, val)}
                          ariaLabel="Loan Type"
                        />
                      </td>
                    );
                  }

                  if (col.key === 'lender') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue ?? ''}
                          placeholder="Lender"
                          options={LENDER_OPTS}
                          onChange={(val) => handleSave(col.key, val)}
                          ariaLabel="Lender"
                          searchable
                        />
                      </td>
                    );
                  }

                  if (col.type === 'boolean') {
                    const BOOL_OPTS: DropdownOption[] = [{ value: 'Yes' }, { value: 'No' }];
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <UniversalDropdown
                          value={editValue === true || editValue === 'Yes' ? 'Yes' : 'No'}
                          placeholder={col.label}
                          options={BOOL_OPTS}
                          onChange={(val) => handleSave(col.key, val === 'Yes')}
                          ariaLabel={col.label}
                        />
                      </td>
                    );
                  }

                  if (col.type === 'date') {
                    return (
                      <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                        <input
                          type="date"
                          value={editValue ?? ''}
                          style={inputCellStyle}
                          autoFocus
                          disabled={saving}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(col.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(col.key);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={`v-${sIdx}-${ci}`} style={{ ...cellStyle, ...focusShadow(true) }}>
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={editValue ?? ''}
                        style={inputCellStyle}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSave(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(col.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            );

            return (
              <React.Fragment key={`sec-${sIdx}`}>
                {HeaderRow}
                {ValueRow}
              </React.Fragment>
            );
          })}

          {/* Notes row */}
          <tr>
            <td style={headerCellStyle(true)}>{'NOTES'}</td>
            <td
              colSpan={MAX_COLS - 1}
              style={{
                ...cellStyle,
                textAlign: 'left',
                cursor: 'pointer',
                borderRight: 'none',
                background:
                  data?.notes === null || data?.notes === undefined || String(data?.notes).trim() === ''
                    ? EMPTY_BG
                    : 'transparent',
                ...(editingKey === 'notes' ? { boxShadow: FOCUS_RING, background: HILITE_BG } : {}),
              }}
              onClick={() => setEditingKey('notes')}
            >
              {editingKey === 'notes' ? (
                <input
                  type="text"
                  value={editValue ?? ''}
                  style={{ ...inputCellStyle, maxWidth: '100%', textAlign: 'left' }}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSave('notes')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave('notes');
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                  disabled={saving}
                />
              ) : data?.notes && String(data.notes).trim() !== '' ? (
                <span>{String(data.notes)}</span>
              ) : (
                <span style={{ color: PLACEHOLDER }}>—</span>
              )}
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
}
