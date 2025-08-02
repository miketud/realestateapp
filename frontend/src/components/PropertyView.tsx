import { useEffect, useState, useRef } from 'react';
import {
  Box, Image, Title, Divider, Table, Loader, Center, Button,
} from '@mantine/core';
import logo from '../assets/propertylogo.svg';
import { getProperty, updatePropertyField } from '../api/properties';
import RentRollTable from './RentRollTable';
import TransactionLog, { type TransactionRow } from './TransactionLog';
import PurchaseDetailsTable from './PurchaseDetailsTable';


const inputCellStyle: React.CSSProperties = {
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
  market_value?: number;
  income_producing?: 'YES' | 'NO';
  financing_type?: string;
};

type PropertyViewProps = {
  property_id: number;
  onBack: () => void;
  refreshProperties: () => void;
};

const FIELDS: { key: keyof Property; label: string }[] = [
  { key: 'property_name', label: 'Property Name' },
  { key: 'address', label: 'Address' },
  { key: 'owner', label: 'Owner' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zipcode', label: 'Zip Code' },
  { key: 'county', label: 'County' },
  // { key: 'purchase_price', label: 'Purchase Price' },
  { key: 'year', label: 'Year' },
  { key: 'market_value', label: 'Current Market Value' },
  { key: 'income_producing', label: 'Income Producing?' },
  // { key: 'financing_type', label: 'Financing Type' },
];

const REQUIRED_FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;

export default function PropertyView({ property_id, onBack, refreshProperties }: PropertyViewProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- TRANSACTIONS STATE ---
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  // --- Load transactions for property ---
  useEffect(() => {
    if (!property_id) return;
    fetch(`/api/transactions?property_id=${property_id}`)
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
        else setTransactions([]);
      })
      .catch(() => setTransactions([]));
  }, [property_id]);
  // --- End transactions block ---

  // Property image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline edit states
  const [editingKey, setEditingKey] = useState<keyof Property | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<boolean>(false);

  // Load property info & image from localStorage when property changes
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
              ? Number(data.zipcode)
              : null,
            year: data.year !== undefined && data.year !== null && data.year !== ''
              ? Number(data.year)
              : null,
          });
          setError(null);
        }
      })
      .catch((err: any) => {
        setProperty(null);
        setError('Failed to load property.');
        console.error(err);
      })
      .finally(() => setLoading(false));

    const saved = localStorage.getItem(`property_image_${property_id}`);
    setImageUrl(saved);
  }, [property_id]);

  // Handle image selection and saving
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

  function handleCellClick(key: keyof Property) {
    if (!loading && property) {
      setEditingKey(key);
      setEditError(false);
      setEditValue(property[key] !== undefined && property[key] !== null ? String(property[key]) : '');
    }
  }

  async function handleSave(key: keyof Property) {
    if (!property) return;

    // Check for blank required field
    if (
      REQUIRED_FIELDS.includes(key as any) &&
      (!editValue.trim() || editValue.trim() === '')
    ) {
      setEditError(true);
      return;
    }
    setEditError(false);

    setSaving(true);
    try {
      let sendValue: any = editValue;

      // If editing zipcode or ye, convert to number or null
      if (key === 'zipcode' || key === 'year' || key === 'market_value') {
        sendValue = editValue.trim() === '' ? null : Number(editValue);
        if (sendValue !== null && isNaN(sendValue)) {
          alert("Please enter a valid number.");
          setSaving(false);
          return;
        }
      }

      await updatePropertyField(property.property_id, key, sendValue);
      setProperty((prev) => prev ? { ...prev, [key]: sendValue } : prev);
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
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: '#111',
              letterSpacing: 2,
              fontFamily: 'inherit',
            }}
          >
            PROPERTY VIEW
          </Title>
          {property?.property_name && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 18 }}>
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 700,
                  color: '#666',
                  borderLeft: '3px solid #222',
                  paddingLeft: 20,
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {property.property_name}
              </span>
              <Button
                onClick={async () => {
                  const newVal = property.income_producing === 'YES' ? 'NO' : 'YES';
                  await updatePropertyField(property.property_id, 'income_producing', newVal);
                  setProperty(prev => prev ? { ...prev, income_producing: newVal } : prev);
                }}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 10,
                  height: 32,
                  fontSize: 20,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0 24px',
                  borderRadius: 0,
                  border: '2px solid #111',
                  background: property.income_producing === 'YES' ? '#39d353' : '#fbb',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {property.income_producing === 'YES' ? 'INCOME PRODUCING' : 'NOT INCOME PRODUCING'}
              </Button>
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
            userSelect: 'none'
          }}
          onClick={handleBoxClick}
          title="Click to upload/change image"
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Property"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                  filter: 'brightness(0.97)'
                }}
              />
              {/* Subtle minimal X at top right */}
              <button
                type="button"
                onClick={e => {
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
                <span
                  style={{
                    fontSize: 16,
                    color: '#888',
                    fontWeight: 700,
                    lineHeight: 1,
                    pointerEvents: 'none',
                    transition: 'color 0.15s',
                    marginTop: '-2px'
                  }}
                >
                  ×
                </span>
              </button>
            </>
          ) : (
            <span style={{ color: '#bbb', fontSize: 18 }}>No Image</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </Box>
      </Box>

      <Divider
        style={{
          height: 7,
          background: '#111',
          boxShadow: '0px 5px 18px 0 rgba(0,0,0,0.18)',
          border: 'none',
          marginBottom: 44,
        }}
      />

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
            marginBottom: 32,
          }}
        >
          Back
        </Button>
        {loading ? (
          <Center style={{ minHeight: '60vh' }}>
            <Loader size="xl" />
          </Center>
        ) : error ? (
          <Box p={40}>
            <Title order={3} style={{ color: 'red' }}>
              {error}
            </Title>
          </Box>
        ) : property ? (
          <>
<Box style={{ width: '100%' }}>
  <Table
    style={{
      width: '100%',
      fontSize: 18,
      borderCollapse: 'collapse',
      border: '2px solid black',
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)',
      fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
      background: '#fff'
    }}
  >
    <thead>
      <tr>
        {FIELDS.map(({ key, label }) => (
          <th
            key={String(key)}
            style={{
              background: '#d5d8bd',
              fontWeight: 600,
              border: '1px solid #222',
              padding: '13px',
              textAlign: 'center',
              textTransform: 'uppercase',
              width: `${100 / FIELDS.length}%`
            }}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      <tr>
        {FIELDS.map(({ key }) => (
          <td
            key={String(key)}
            style={{
              border: '1px solid #222',
              padding: '13px',
              position: 'relative',
              textAlign: 'center',
              width: `${100 / FIELDS.length}%`,
              ...(editError && editingKey === key && REQUIRED_FIELDS.includes(key as any)
                ? {
                  background: 'rgba(255, 255, 150, 0.65)',
                  boxShadow: '0 0 0 4px rgba(255, 230, 0, 0.25)'
                }
                : {})
            }}
            onClick={() => handleCellClick(key)}
          >
            {editingKey === key ? (
              <input
                autoFocus
                className="property-edit"
                style={{
                  ...inputCellStyle,
                  ...(editError && REQUIRED_FIELDS.includes(key as any)
                    ? {
                      background: 'rgba(255, 255, 150, 0.65)',
                      boxShadow: '0 0 0 4px rgba(255, 230, 0, 0.25)'
                    }
                    : {})
                }}
                value={editValue}
                type={key === 'zipcode' || key === 'year' ? 'number' : 'text'}
                onChange={e => {
                  setEditValue(e.target.value);
                  if (editError) setEditError(false);
                }}
                onBlur={() => handleSave(key)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave(key);
                  if (e.key === 'Escape') setEditingKey(null);
                }}
                disabled={saving}
              />
            ) : (
              (() => {
                const val = property[key];
                if (val !== undefined && val !== null && val !== '') return String(val);
                if (!REQUIRED_FIELDS.includes(key as any)) {
                  return <span style={{ color: '#bbb' }}>—</span>;
                }
                return '';
              })()
            )}
            {editingKey === key && saving && (
              <span style={{ position: 'absolute', right: 12, top: 13, fontSize: 15, color: '#325dae' }}>
                Saving...
              </span>
            )}
          </td>
        ))}
      </tr>
    </tbody>
  </Table>
</Box>

            {/* Purchase Details Table (full width row) */}
            <PurchaseDetailsTable property_id={property.property_id} />

            {/* Rent Roll Table with year toggle */}
            <Box style={{ marginTop: 48 }}>
              <Title order={3} style={{ marginBottom: 24, fontWeight: 800, color: '#bd642c' }}>
                RENT LOG
              </Title>
              <RentRollTable property_id={property.property_id} />
            </Box>
            {/* Transaction Log Section */}
            <Box style={{ marginTop: 64 }}>
              <Title order={3} style={{ marginBottom: 24, fontWeight: 800, color: '#31506f' }}>
                TRANSACTION LOG
              </Title>
              {/* PASS property_id to TransactionLog! */}
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
