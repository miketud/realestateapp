import { useEffect, useState } from 'react';
import { Box, Image, Title, Divider, Table, Loader, Center, Button } from '@mantine/core';
import logo from '../assets/propertylogo.svg';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import PropertyView from '../components/PropertyView';

type PropertyInput = {
  property_name: string;
  address: string;
  owner: string;
  type: string;
  status: string;
};
type Property = PropertyInput & { property_id: number };

const FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;
const REQUIRED_FIELDS = ['property_name', 'address', 'owner', 'type', 'status'] as const;

const emptyNewProperty: PropertyInput = {
  property_name: '',
  address: '',
  owner: '',
  type: '',
  status: '',
};

const ACTION_CELL_WIDTH = 292; // px
const ROW_HEIGHT = 68;         // px

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newProperty, setNewProperty] = useState<PropertyInput>({ ...emptyNewProperty });
  const [saving, setSaving] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);

  // Edit and delete state
  const [editId, setEditId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<PropertyInput>({ ...emptyNewProperty });
  const [editSaving, setEditSaving] = useState(false);
  const [delLoadingId, setDelLoadingId] = useState<number | null>(null);

  // Missing fields for add and edit
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [editMissingFields, setEditMissingFields] = useState<string[]>([]);

  // Fetch properties from backend
  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await getProperties();
      setProperties(
        Array.isArray(data) ? data.filter((p) => typeof p.property_id === "number") : []
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleAddProperty = async () => {
    // Check for missing required fields
    const missing = REQUIRED_FIELDS.filter(field => !newProperty[field].trim());
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }
    setMissingFields([]);
    setSaving(true);
    try {
      await createProperty(newProperty);
      setAdding(false);
      setNewProperty({ ...emptyNewProperty });
      await fetchProperties();
    } finally {
      setSaving(false);
    }
  };

  // Edit Handlers
  const handleEdit = (property: Property) => {
    setEditId(property.property_id);
    setEditValues({
      property_name: property.property_name,
      address: property.address,
      owner: property.owner,
      type: property.type,
      status: property.status,
    });
    setEditMissingFields([]);
  };

  const handleSaveEdit = async (property_id: number) => {
    // Check for missing required fields
    const missing = REQUIRED_FIELDS.filter(field => !editValues[field].trim());
    if (missing.length > 0) {
      setEditMissingFields(missing);
      return;
    }
    setEditMissingFields([]);
    setEditSaving(true);
    try {
      await updateProperty(property_id, editValues);
      setEditId(null);
      setEditValues({ ...emptyNewProperty });
      await fetchProperties();
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditValues({ ...emptyNewProperty });
    setEditMissingFields([]);
  };

  // Delete Handler
  const handleDelete = async (property_id: number) => {
    if (!window.confirm("Delete this property?")) return;
    setDelLoadingId(property_id);
    try {
      await deleteProperty(property_id);
      await fetchProperties();
    } finally {
      setDelLoadingId(null);
    }
  };

  // Highlight style for missing required fields
  const highlightStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 150, 0.65)', // soft yellow
    boxShadow: '0 0 0 4px rgba(255, 230, 0, 0.25)', // subtle outer glow
    transition: 'background 0.2s, box-shadow 0.2s'
  };

  // ------ Render PropertyView when a property is selected ------
  if (selectedProperty !== null) {
    return (
      <PropertyView
        property_id={selectedProperty}
        onBack={() => setSelectedProperty(null)}
        refreshProperties={fetchProperties} // <--- Callback passed here!
      />
    );
  }

  return (
    <Box
      style={{
        background: '#f4f4f0',
        minHeight: '100vh',
        fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
        padding: 0,
      }}
    >
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '40px 40px 20px 40px',
          gap: 28,
        }}
      >
        <Image src={logo} alt="Logo" width={92} height={92} style={{ objectFit: 'contain' }} />
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
          PROPERTY MANAGER
        </Title>
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

      <Box style={{ margin: '0 40px 32px 40px', display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          variant="outline"
          style={{
            border: '3px solid #111',
            borderRadius: 0,
            background: '#fff',
            color: '#111',
            fontWeight: 700,
            fontSize: 22,
            padding: '16px 48px',
            fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            boxShadow: 'none',
          }}
          onClick={() => { setAdding(true); setMissingFields([]); }}
          disabled={adding}
        >
          ADD PROPERTY
        </Button>
      </Box>

      <Box style={{ margin: '0 40px' }}>
        <Table
          highlightOnHover
          style={{
            width: '100%',
            fontSize: 18,
            borderCollapse: 'collapse',
            border: '2px solid black',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08)',
            fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '21%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: `${ACTION_CELL_WIDTH}px` }} />
          </colgroup>
          <thead>
            <tr style={{ height: ROW_HEIGHT }}>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Property Name</th>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Address</th>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Owner</th>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Type</th>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>Status</th>
              <th style={{ border: '1px solid #111', padding: '14px', background: '#222', color: '#fff', fontWeight: 700, letterSpacing: 1, width: ACTION_CELL_WIDTH, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr style={{ height: ROW_HEIGHT }}>
                {FIELDS.map((key) => (
                  <td
                    key={key}
                    style={{
                      border: '1px solid #222',
                      padding: '13px',
                      ...(REQUIRED_FIELDS.includes(key as any) && missingFields.includes(key)
                        ? highlightStyle
                        : {})
                    }}
                  >
                    <input
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        fontSize: 18,
                        fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
                        background: 'transparent',
                      }}
                      value={newProperty[key]}
                      placeholder={key.replace('_', ' ').toUpperCase()}
                      onChange={e => {
                        setNewProperty((prev) => ({ ...prev, [key]: e.target.value }));
                        if (
                          missingFields.length > 0 &&
                          REQUIRED_FIELDS.includes(key as any)
                        ) {
                          if (e.target.value.trim()) {
                            setMissingFields(missingFields.filter(f => f !== key));
                          }
                        }
                      }}
                      disabled={saving}
                    />
                  </td>
                ))}
                <td
                  style={{
                    border: '1px solid #222',
                    padding: '13px',
                    width: ACTION_CELL_WIDTH,
                    minWidth: ACTION_CELL_WIDTH,
                    maxWidth: ACTION_CELL_WIDTH,
                    textAlign: 'center',
                  }}
                >
                  <Button
                    onClick={handleAddProperty}
                    disabled={saving}
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 0,
                      border: '2px solid #111',
                      background: '#fff',
                      color: '#111',
                      padding: '6px 16px',
                      width: 80,
                      marginRight: 12,
                    }}
                  >
                    {saving ? 'Saving...' : 'SAVE'}
                  </Button>
                  <Button
                    onClick={() => {
                      setAdding(false);
                      setNewProperty({ ...emptyNewProperty });
                      setMissingFields([]);
                    }}
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 0,
                      border: '2px solid #dadd42',
                      background: '#fff',
                      color: '#666',
                      marginRight: 12,
                      padding: '8px',
                      width: 80,
                    }}
                    disabled={saving}
                  >
                    CANCEL
                  </Button>
                  <span style={{ display: 'inline-block', width: 80, height: 1, verticalAlign: 'middle' }} />
                </td>
              </tr>
            )}
            {loading ? (
              <tr style={{ height: ROW_HEIGHT }}>
                <td colSpan={FIELDS.length + 1}>
                  <Center style={{ minHeight: 96 }}>
                    <Loader size="lg" />
                  </Center>
                </td>
              </tr>
            ) : properties.length === 0 ? (
              <tr style={{ height: ROW_HEIGHT }}>
                <td colSpan={FIELDS.length + 1} style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 22 }}>
                  No properties found.
                </td>
              </tr>
            ) : (
              properties.map((p) => (
                <tr key={p.property_id} style={{ height: ROW_HEIGHT }}>
                  {editId === p.property_id ? (
                    <>
                      {FIELDS.map((key) => (
                        <td
                          key={key}
                          style={{
                            border: '1px solid #222',
                            padding: '13px',
                            ...(REQUIRED_FIELDS.includes(key as any) && editMissingFields.includes(key)
                              ? highlightStyle
                              : {})
                          }}
                        >
                          <input
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              fontSize: 18,
                              fontFamily: 'inherit',
                              background: 'transparent',
                            }}
                            value={editValues[key]}
                            onChange={e => {
                              setEditValues((prev) => ({ ...prev, [key]: e.target.value }));
                              if (
                                editMissingFields.length > 0 &&
                                REQUIRED_FIELDS.includes(key as any)
                              ) {
                                if (e.target.value.trim()) {
                                  setEditMissingFields(editMissingFields.filter(f => f !== key));
                                }
                              }
                            }}
                            disabled={editSaving}
                          />
                        </td>
                      ))}
                      <td style={{
                        border: '1px solid #222',
                        padding: '13px',
                        width: ACTION_CELL_WIDTH,
                        textAlign: 'center',
                      }}>
                        <Button
                          onClick={() => handleSaveEdit(p.property_id)}
                          disabled={editSaving}
                          style={{
                            fontSize: 16, fontWeight: 600, borderRadius: 0,
                            border: '2px solid #111', background: '#fff',
                            color: '#111', padding: '6px 16px', width: 80, marginRight: 12,
                          }}
                        >
                          {editSaving ? 'Saving...' : 'SAVE'}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          disabled={editSaving}
                          style={{
                            fontSize: 16, fontWeight: 600, borderRadius: 0,
                            border: '2px solid #dadd42', background: '#fff',
                            color: '#666', marginRight: 12, padding: '8px', width: 80,
                          }}
                        >CANCEL</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      {FIELDS.map((key) => (
                        <td key={key} style={{
                          border: '1px solid #222', padding: '13px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{p[key]}</td>
                      ))}
                      <td style={{
                        border: '1px solid #222', padding: '13px',
                        width: ACTION_CELL_WIDTH, textAlign: 'center',
                      }}>
                        <Button onClick={() => setSelectedProperty(p.property_id)}
                          style={{
                            border: '2px solid #111', borderRadius: 0,
                            background: '#fff', color: '#111', fontWeight: 600,
                            fontSize: 15, padding: '8px 0', width: 80, marginRight: 12,
                            textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'none'
                          }}>VIEW</Button>
                        <Button
                          onClick={() => handleEdit(p)}
                          style={{
                            border: '2px solid #3a6', borderRadius: 0,
                            background: '#fff', color: '#207a3f', fontWeight: 600,
                            fontSize: 15, padding: '8px 0', width: 80, marginRight: 12,
                            textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'none'
                          }}>EDIT</Button>
                        <Button
                          onClick={() => handleDelete(p.property_id)}
                          disabled={delLoadingId === p.property_id}
                          style={{
                            border: '2px solid #c33', borderRadius: 0,
                            background: '#fff', color: '#c33', fontWeight: 600,
                            fontSize: 15, padding: '8px 0', width: 80,
                            textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'none'
                          }}>
                          {delLoadingId === p.property_id ? "..." : "DEL"}
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Box>
    </Box>
  );
}
