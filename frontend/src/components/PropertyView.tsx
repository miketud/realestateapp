import { useEffect, useState, useRef } from 'react';
import {
  Box, Image, Title, Divider, Table, Loader, Center, Button,
} from '@mantine/core';
import logo from '../assets/propertylogo.svg';
import { getProperty, updatePropertyField } from '../api/properties';
import RentRollTable from './RentRollTable';
import TransactionLog, { type TransactionRow } from './TransactionLog';
import PurchaseDetailsTable from './PurchaseDetailsTable';

// --- Grid / sizing ---
const COL_WIDTH = 175;            // 1 unit
const FONT_SIZE = 16;
const MAX_COLS = 9;               // 9 units per row
const TABLE_WIDTH = COL_WIDTH * MAX_COLS;

// --- API base (kept consistent with TransactionLog) ---
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:3000';
const API = `${API_BASE}/api`;

// --- Visual primitives (match Rent/Transaction style) ---
const HILITE_BG = '#eef5ff';
const FOCUS_RING = 'inset 0 0 0 3px #325dae';

// Borderless inline input (no textbox border)
const inputCellStyle: React.CSSProperties = {
  width: '100%',
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

// Base cell
const cellBase: React.CSSProperties = {
  border: '1px solid #222',
  padding: '13px',
  position: 'relative',
  textAlign: 'center',
  background: '#fff',
  fontSize: FONT_SIZE,
  // wrapping like other tables
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
// Header base
const headerBase: React.CSSProperties = {
  ...cellBase,
  background: '#ece8d4',
  color: '#242211',
  fontWeight: 700,
  textTransform: 'uppercase',
};
// Single-unit helpers
const cellSingleUnit: React.CSSProperties = {
  ...cellBase,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
};
const headerSingleUnit: React.CSSProperties = {
  ...headerBase,
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
};

function InlineSpinner() {
  return (
    <svg
      style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8, width: 16, height: 16 }}
      viewBox="0 0 50 50"
    >
      <circle
        cx="25" cy="25" r="20" fill="none" stroke="#325dae" strokeWidth="5"
        strokeDasharray="31.415, 31.415" strokeLinecap="round"
      >
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

type Property = {
  property_id: number;
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
  city?: string;
  state?: string;
  zipcode?: number | null;
  county?: string;
  purchase_price?: number;
  year?: number | null;
  market_value?: number | null;
  income_producing?: 'YES' | 'NO';
  financing_type?: string;
};

type PropertyViewProps = {
  property_id: number;
  onBack: () => void;
  refreshProperties: () => void;
};

const REQUIRED_FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;

export default function PropertyView({ property_id, onBack, refreshProperties }: PropertyViewProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transactions (load from same API base used by edits)
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  // Image
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline edit
  const [editingKey, setEditingKey] = useState<keyof Property | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<boolean>(false);

  // Load transactions
  useEffect(() => {
    if (!property_id) return;
    fetch(`${API}/transactions?property_id=${property_id}`)
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
        else setTransactions([]);
      })
      .catch(() => setTransactions([]));
  }, [property_id]);

  // Load property + image
  useEffect(() => {
    setLoading(true);
    setError(null);
    getProperty(property_id)
      .then((data: any) => {
        if (!data || data.error) {
          setProperty(null);
          setError('Property not found.');
        } else {
          setProperty({
            ...data,
            zipcode: data.zipcode !== undefined && data.zipcode !== null && data.zipcode !== ''
              ? Number(data.zipcode) : null,
            year: data.year !== undefined && data.year !== null && data.year !== ''
              ? Number(data.year) : null,
            market_value: data.market_value !== undefined && data.market_value !== null && data.market_value !== ''
              ? Number(data.market_value) : null,
          });
          setError(null);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setProperty(null);
        setError('Failed to load property.');
      })
      .finally(() => setLoading(false));

    const saved = localStorage.getItem(`property_image_${property_id}`);
    setImageUrl(saved);
  }, [property_id]);

  // Image handlers
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        localStorage.setItem(`property_image_${property_id}`, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }
  function handleBoxClick() {
    fileInputRef.current?.click();
  }

  // Edit handlers
  function handleCellClick(key: keyof Property) {
    if (!loading && property) {
      setEditingKey(key);
      setEditError(false);
      setEditValue(property[key] !== undefined && property[key] !== null ? String(property[key]) : '');
    }
  }

  async function handleSave(key: keyof Property) {
    if (!property) return;

    if (REQUIRED_FIELDS.includes(key as any) && (!editValue.trim() || editValue.trim() === '')) {
      setEditError(true);
      return;
    }
    setEditError(false);

    setSaving(true);
    try {
      let sendValue: any = editValue;

      if (key === 'zipcode' || key === 'year' || key === 'market_value') {
        sendValue = editValue.trim() === '' ? null : Number(editValue);
        if (sendValue !== null && isNaN(sendValue)) {
          alert('Please enter a valid number.');
          setSaving(false);
          return;
        }
      }

      await updatePropertyField(property.property_id, key, sendValue);
      setProperty(prev => (prev ? { ...prev, [key]: sendValue } : prev));
    } catch (e) {
      alert('Update failed. Please try again.');
    }
    setEditingKey(null);
    setSaving(false);
    setEditError(false);
  }

  function handleBack() {
    onBack();
    refreshProperties();
  }

  // Income toggle (DB + UI)
  async function toggleIncomeProducing() {
    if (!property) return;
    const newVal = property.income_producing === 'YES' ? 'NO' : 'YES';
    try {
      await updatePropertyField(property.property_id, 'income_producing', newVal);
      setProperty(prev => (prev ? { ...prev, income_producing: newVal } : prev));
    } catch {
      alert('Failed to update Income Producing status.');
    }
  }

  // ---------- Helpers ----------
  function ColsPx() {
    return (
      <colgroup>
        {Array.from({ length: MAX_COLS }).map((_, i) => (
          <col key={i} style={{ width: COL_WIDTH }} />
        ))}
      </colgroup>
    );
  }

  // Section membership for row highlight
  const row1Keys: Array<keyof Property> = ['property_name', 'address', 'city', 'state', 'zipcode', 'county'];
  const row2Keys: Array<keyof Property> = ['owner', 'year', 'type', 'market_value'];

  const isRow1Editing = editingKey ? row1Keys.includes(editingKey) : false;
  const isRow2Editing = editingKey ? row2Keys.includes(editingKey) : false;

  // Header cell
  function HeaderCell({ label, units = 1, blackout = false }: { label?: string; units?: number; blackout?: boolean }) {
    const style = units === 1
      ? (blackout ? { ...headerSingleUnit, background: '#000', color: '#000' } : headerSingleUnit)
      : (blackout ? { ...headerBase, background: '#000', color: '#000' } : headerBase);

    return (
      <th colSpan={units} style={style}>
        {label ?? ''}
      </th>
    );
  }

  // Value cell (inline editable with row/cell highlight)
  function ValueCell({
    k, units = 1, type,
  }: { k: keyof Property; units?: number; type?: 'number' | 'text' }) {
    const val = property?.[k];
    const isRequired = REQUIRED_FIELDS.includes(k as any);
    const tdBase = units === 1 ? cellSingleUnit : cellBase;
    const isEditing = editingKey === k;

    // Editing state
    if (isEditing) {
      return (
        <td
          colSpan={units}
          style={{ ...tdBase, background: HILITE_BG, boxShadow: FOCUS_RING }}
        >
          <input
            autoFocus
            style={inputCellStyle}
            value={editValue}
            type={type === 'number' ? 'number' : 'text'}
            onChange={(e) => {
              setEditValue(e.target.value);
              if (editError) setEditError(false);
            }}
            onBlur={() => handleSave(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(k);
              if (e.key === 'Escape') setEditingKey(null);
            }}
            disabled={saving}
          />
          {saving && <InlineSpinner />}
        </td>
      );
    }

    // Display state
    return (
      <td
        colSpan={units}
        style={{ ...tdBase, cursor: 'pointer' }}
        onClick={() => handleCellClick(k)}
      >
        {val !== undefined && val !== null && val !== ''
          ? (k === 'market_value' ? `$${Number(val).toLocaleString()}` : String(val))
          : isRequired
          ? ''
          : <span style={{ color: '#bbb' }}>—</span>}
      </td>
    );
  }

  function BlackCell() {
    return <td style={{ ...cellSingleUnit, background: '#000', color: '#000', cursor: 'default' }} />;
  }

  return (
    <Box style={{
      background: '#f4f4f0',
      minHeight: '100vh',
      fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
      padding: 0,
    }}>
      {/* Top bar */}
      <Box style={{
        display: 'flex',
        alignItems: 'center',
        padding: '40px 40px 20px 40px',
        gap: 28,
        position: 'relative',
      }}>
        <Image src={logo} alt="Logo" width={92} height={92} style={{ objectFit: 'contain' }} />
        <Box style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Title
            order={1}
            style={{ fontSize: 52, fontWeight: 900, color: '#111', letterSpacing: 2, fontFamily: 'inherit' }}
          >
            PROPERTY VIEW
          </Title>
          {property?.property_name && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 18 }}>
              <span style={{ fontSize: 50, fontWeight: 700, color: '#666', borderLeft: '3px solid #222', paddingLeft: 20, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {property.property_name}
              </span>
            </Box>
          )}
        </Box>

        {/* Property image box */}
        <Box
          style={{
            marginLeft: 'auto',
            position: 'relative',
            width: 190,
            height: 140,
            border: '1.5px solid #ccc',
            borderRadius: 4,
            background: '#000000ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={handleBoxClick}
          title="Click to upload/change image"
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Property"
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', filter: 'brightness(0.97)' }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageUrl(null);
                  localStorage.removeItem(`property_image_${property_id}`);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  background: 'rgba(255,255,255,0.7)',
                  border: 'none',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  padding: 0,
                }}
                tabIndex={-1}
                title="Clear Image"
              >
                <span style={{ fontSize: 16, color: '#888', fontWeight: 700, lineHeight: 1, pointerEvents: 'none', marginTop: '-2px' }}>
                  ×
                </span>
              </button>
            </>
          ) : (
            <span style={{ color: '#bbb', fontSize: 18 }}>No Image</span>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
        </Box>
      </Box>

      <Divider style={{ height: 7, background: '#111', boxShadow: '0px 5px 18px 0 rgba(0,0,0,0.18)', border: 'none', marginBottom: 44 }} />

      <Box style={{ margin: '0 40px 40px 40px' }}>
        <Button
          onClick={handleBack}
          style={{
            border: '2px solid #111',
            borderRadius: 0,
            background: '#fff',
            color: '#111',
            fontWeight: 700,
            fontSize: 18,
            padding: '10px 28px',
            textTransform: 'uppercase',
            letterSpacing: 1,
            boxShadow: 'none',
            marginBottom: 24,
          }}
        >
          DASHBOARD
        </Button>

        {/* OVERVIEW + Income Producing toggle */}
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, width: TABLE_WIDTH }}>
          <Title order={3} style={{ margin: 0, fontWeight: 900, color: '#111', letterSpacing: 1 }}>
            OVERVIEW
          </Title>
          {property && (
            <Button
              onClick={toggleIncomeProducing}
              style={{
                height: 36,
                fontSize: 16,
                fontWeight: 800,
                textTransform: 'uppercase',
                padding: '0 20px',
                borderRadius: 0,
                border: '2px solid #111',
                background: property.income_producing === 'YES' ? '#39d353' : '#f44336',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Toggle Income Producing"
            >
              {property.income_producing === 'YES' ? 'INCOME PRODUCING' : 'NOT INCOME PRODUCING'}
            </Button>
          )}
        </Box>

        {loading ? (
          <Center style={{ minHeight: '60vh' }}>
            <Loader size="xl" />
          </Center>
        ) : error ? (
          <Box p={40}>
            <Title order={3} style={{ color: 'red' }}>{error}</Title>
          </Box>
        ) : property ? (
          <>
            {/* -------- OVERVIEW TABLE -------- */}
            <Box style={{ width: TABLE_WIDTH, marginBottom: 18 }}>
              <Table
                striped
                highlightOnHover
                withColumnBorders
                style={{
                  fontSize: FONT_SIZE,
                  borderCollapse: 'collapse',
                  border: '2px solid #222',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.06)',
                  background: '#fff',
                  width: '100%',
                  textAlign: 'center',
                  tableLayout: 'fixed',
                }}
              >
                <ColsPx />

                <tbody>
                  {/* SECTION 1 — headers (2 + 3 + 1 + 1 + 1 + 1 = 9) */}
                  <tr>
                    <HeaderCell label="Property Name" units={2} />
                    <HeaderCell label="Address" units={3} />
                    <HeaderCell label="City" units={1} />
                    <HeaderCell label="State" units={1} />
                    <HeaderCell label="Zip Code" units={1} />
                    <HeaderCell label="County" units={1} />
                  </tr>
                  {/* SECTION 1 — values */}
                  <tr style={isRow1Editing ? { outline: '2px solid #325dae', background: HILITE_BG } : undefined}>
                    <ValueCell k="property_name" units={2} />
                    <ValueCell k="address" units={3} />
                    <ValueCell k="city" units={1} />
                    <ValueCell k="state" units={1} />
                    <ValueCell k="zipcode" units={1} type="number" />
                    <ValueCell k="county" units={1} />
                  </tr>

                  {/* SECTION 2 — headers (2 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 9) */}
                  <tr>
                    <HeaderCell label="Owner" units={2} />
                    <HeaderCell label="Year" units={1} />
                    <HeaderCell label="Type" units={1} />
                    <HeaderCell label="Current Market Value" units={1} />
                    <HeaderCell blackout units={1} />
                    <HeaderCell blackout units={1} />
                    <HeaderCell blackout units={1} />
                    <HeaderCell blackout units={1} />
                  </tr>
                  {/* SECTION 2 — values */}
                  <tr style={isRow2Editing ? { outline: '2px solid #325dae', background: HILITE_BG } : undefined}>
                    <ValueCell k="owner" units={2} />
                    <ValueCell k="year" units={1} type="number" />
                    <ValueCell k="type" units={1} />
                    <ValueCell k="market_value" units={1} type="number" />
                    <BlackCell />
                    <BlackCell />
                    <BlackCell />
                    <BlackCell />
                  </tr>
                </tbody>
              </Table>
            </Box>

            {/* Purchase Details */}
            <PurchaseDetailsTable property_id={property.property_id} />

            {/* Rent Log */}
            <Box style={{ marginTop: 48 }}>
              <Title order={3} style={{ marginBottom: 24, fontWeight: 800, color: '#bd642c' }}>
                RENT LOG
              </Title>
              <RentRollTable property_id={property.property_id} />
            </Box>

            {/* Transaction Log */}
            <Box style={{ marginTop: 64 }}>
              <Title order={3} style={{ marginBottom: 24, fontWeight: 800, color: '#31506f' }}>
                TRANSACTION LOG
              </Title>
              <TransactionLog
                property_id={property.property_id}
                transactions={transactions}
                setTransactions={setTransactions}
              />
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
