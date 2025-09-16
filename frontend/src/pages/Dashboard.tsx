import { useState } from 'react';
import { Box, Title } from '@mantine/core';

import Reports from '../components/Reports';
import ContactList from '../components/ContactList';
import PropertyList from '../components/PropertyList';
import { IconButton } from '../components/ui/Icons';
import MapOSM from '../components/MapOSM';

const APP_WIDTH = 1575;

type Tab = 'properties' | 'contacts' | 'reports';

function NavLink({
  label,
  tab,
  activeTab,
  onClick,
}: {
  label: string;
  tab: Tab;
  activeTab: Tab;
  onClick: (t: Tab) => void;
}) {
  const [hover, setHover] = useState(false);
  const isActive = activeTab === tab;

  return (
    <button
      onClick={() => onClick(tab)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(tab);
        }
      }}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '8px 12px',
        fontSize: 30,
        fontWeight: 800,
        color: isActive ? '#60a5ffff' : '#909090ff',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: 1,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        filter: hover ? 'drop-shadow(0 8px 20px rgba(0,0,0,0.35))' : 'none',
        transition: 'transform 160ms ease, filter 160ms ease, color 160ms ease',
        outline: 'none',
      }}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

export default function Dashboard() {
  // tabs
  const [activeTab, setActiveTab] = useState<Tab>('properties');

  // force-remount PropertyList to escape any detail view
  const [propertiesReset, setPropertiesReset] = useState(0);
  const resetToPropertyList = () => {
    setActiveTab('properties');
    setPropertiesReset((n) => n + 1);
  };

  // map visibility — starts visible on load/refresh
  const [showMap, setShowMap] = useState(true);

  // dashboard icon: restore default view (Property List + Map)
  const onDashboardIconClick = () => {
    resetToPropertyList();
    setShowMap(true);
  };

  // map icon toggles the map panel
  const onMapIconClick = () => setShowMap((s) => !s);

  return (
    <Box
      style={{
        background: '#ffffffff',
        minHeight: '100vh',
        fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
        padding: 0,
      }}
    >
      {/* ===== Sticky App Header ===== */}
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: APP_WIDTH,
          margin: '12px auto 0',
          padding: '40px 40px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#000000ff',
          border: '4px solid #111',
          borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Title
            order={1}
            style={{
              fontSize: 70,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: 2,
              fontFamily: 'inherit',
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            PROPERTY MANAGER
          </Title>
        </div>

        {/* ===== nav links row ===== */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 20 }}>
          <NavLink label="Property List" tab="properties" activeTab={activeTab} onClick={resetToPropertyList} />
          <NavLink label="Contact List" tab="contacts" activeTab={activeTab} onClick={setActiveTab} />
          <NavLink label="Reports" tab="reports" activeTab={activeTab} onClick={setActiveTab} />
        </div>

        {/* Dashboard + Map icons */}
        <div style={{ position: 'absolute', bottom: 12, left: 20, display: 'flex', gap: 12 }}>
          <IconButton
            icon="dashboard"
            label="Dashboard"
            size="lg"
            variant="ghost"
            onClick={onDashboardIconClick}
            title="Dashboard"
            style={{ color: '#fff', borderColor: '#fff' }}
          />
          <IconButton
            icon="map"
            label={showMap ? 'Hide Map' : 'Show Map'}
            size="lg"
            variant="ghost"
            onClick={onMapIconClick}
            title={showMap ? 'Hide Map' : 'Show Map'}
            style={{ color: '#fff', borderColor: '#fff' }}
          />
        </div>
      </Box>

      {/* ===== Embedded Map Panel ===== */}
      {showMap && (
        <Box
          style={{
            width: APP_WIDTH,
            margin: '20px auto 10px',
            border: '4px solid #111',
            borderRadius: 12,
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '2px solid #111',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: 20 }}>Map (OpenStreetMap)</strong>
            <button
              onClick={() => setShowMap(false)}
              style={{
                border: '2px solid #111',
                background: '#fff',
                cursor: 'pointer',
                padding: '6px 10px',
                fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>

<MapOSM
  endpoint="/api/property_markers"
  height={520}
  fallbackGeocode={true}  // set true if you want client-side geocode for missing coords
/>
        </Box>
      )}

      {/* ===== Page container ===== */}
      <Box style={{ width: APP_WIDTH, margin: showMap ? '10px auto 40px' : '20px auto 40px' }}>
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'properties' && <PropertyList key={propertiesReset} />}
        {activeTab === 'contacts' && <ContactList />}
      </Box>
    </Box>
  );
}
