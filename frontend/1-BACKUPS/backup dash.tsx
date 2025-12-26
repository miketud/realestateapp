// src/pages/Dashboard.tsx
import { useEffect, useRef, useState } from 'react';
import { Box } from '@mantine/core';
import Shortcuts from '../components/Shortcuts';
import Reports from '../components/Reports';
import ContactList from '../components/ContactList';
import PropertyList from '../components/PropertyList';
import { Icon } from '../components/ui/Icons';
import MapOSM from '../components/MapOSM';

const APP_WIDTH = 1575;
const BORDER_THICKNESS = 8;
type Tab = 'properties' | 'contacts' | 'reports' | 'PropertyView' | null;
type ShortcutMode = 'rent' | 'payment';
type ActionMode = 'expense' | 'check';
type Layer = 'nav' | 'shortcuts' | 'actions';

/* minimal css once */
function useAnimCss() {
  useEffect(() => {
    const id = 'pm-anim-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .layer { position: absolute; inset: 0; }
      .layer-hide { opacity: 0; pointer-events: none; transform: translateY(-6px); transition: opacity 180ms ease, transform 180ms ease; }
      .layer-show { opacity: 1; pointer-events: auto; transform: translateY(0); transition: opacity 220ms ease, transform 220ms ease; }
      .fade-enter { opacity: 0; transform: translateY(-8px); }
      .fade-enter.fade-active { opacity: 1; transform: translateY(0); transition: opacity 220ms ease, transform 220ms ease; }
    `;
    document.head.appendChild(s);
  }, []);
}
function Appear({ children, deps }: { children: React.ReactNode; deps: any[] }) {
  const [cls, setCls] = useState('fade-enter');
  useEffect(() => {
    setCls('fade-enter');
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setCls('fade-enter fade-active')));
    return () => cancelAnimationFrame(t);
  }, deps);
  return <div className={cls}>{children}</div>;
}

/* nav cell */
function NavCell({
  label,
  active,
  onClick,
  showLeftBar,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  showLeftBar?: boolean;
}) {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    padding: '6px 18px',
    fontWeight: 900,
    letterSpacing: 1,
    fontSize: 40,
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
    background: active ? '#ffef09' : '#fff',
    transition: 'background 140ms ease',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {showLeftBar && <div aria-hidden style={{ width: BORDER_THICKNESS, background: '#111', margin: '0 10px' }} />}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
        style={base}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f5f5f5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#ffef09' : '#fff'; }}
      >
        {label}
      </div>
    </div>
  );
}

/* icon button */
function CleanIconButton({
  name, active, onClick, title,
}: {
  name: 'home' | 'add' | 'search' | 'map';
  active?: boolean;
  onClick?: () => void;
  title: string;
}) {
  const ROW_H = 56;
  const ICON_SIZE = 40;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: ROW_H, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#000' : 'transparent', border: 'none', cursor: 'pointer',
      }}
    >
      <Icon name={name} size={ICON_SIZE} style={{ color: active ? '#ffef09' : '#111' }} aria-hidden />
    </button>
  );
}

export default function Dashboard() {
  useAnimCss();

  /* single layer */
  const [layer, setLayer] = useState<Layer>('nav');
  const [activeTab, setActiveTab] = useState<Tab>(null);

  /* shortcuts/actions state */
  const [shortcutsMode, setShortcutsMode] = useState<ShortcutMode>('rent');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [actionsMode, setActionsMode] = useState<ActionMode>('expense');
  const [actionsOpen, setActionsOpen] = useState(false);

  /* other state */
  const [propertiesReset, setPropertiesReset] = useState(0);

  /* global map icon reflect */
  const [mapActive, setMapActive] = useState(false);
  useEffect(() => {
    const h = (e: any) => setMapActive(!!e?.detail?.open);
    window.addEventListener('pm:map-state', h as EventListener);
    return () => window.removeEventListener('pm:map-state', h as EventListener);
  }, []);

  /* helpers */
  const closeMap = () => window.dispatchEvent(new CustomEvent('pm:map-close'));

  const goNav = () => {
    setLayer('nav');
    setShortcutsOpen(false);
    setActionsOpen(false);
  };

  // Toggle ribbons. If already open, revert to NAV.
  const toggleShortcuts = () => {
    closeMap();
    if (layer === 'shortcuts' && shortcutsOpen) {
      setShortcutsOpen(false);
      setLayer('nav'); // revert to home links
      return;
    }
    setActionsOpen(false);
    setActiveTab(null);
    setLayer('shortcuts');
    setShortcutsOpen(true);
  };

  const toggleActions = () => {
    closeMap();
    if (layer === 'actions' && actionsOpen) {
      setActionsOpen(false);
      setLayer('nav'); // revert to home links
      return;
    }
    setShortcutsOpen(false);
    setActiveTab(null);
    setLayer('actions');
    setActionsOpen(true);
  };

  /* header ref */
  const headerRef = useRef<HTMLDivElement | null>(null);

  return (
    <Box style={{ background: '#fff', minHeight: '100vh', fontFamily: 'system-ui, Arial, Helvetica, sans-serif' }}>
      {/* HEADER */}
      <Box
        id="app-header"
        ref={headerRef}
        style={{
          width: APP_WIDTH,
          margin: '12px auto 0',
          padding: '0 16px 16px',
          background: '#fff',
          border: `${BORDER_THICKNESS}px solid #111`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          position: 'relative', boxShadow: '0 22px 50px rgba(0,0,0,0.35)',
        }}
      >
        {/* ICONS */}
        <div style={{ height: 56, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <CleanIconButton name="home" title="Home" onClick={() => (window.location.href = '/')} />
          <CleanIconButton
            name="add"
            title={layer === 'shortcuts' && shortcutsOpen ? 'Hide shortcuts' : 'Show shortcuts'}
            active={layer === 'shortcuts' && shortcutsOpen}
            onClick={toggleShortcuts}
          />
          <CleanIconButton
            name="search"
            title={layer === 'actions' && actionsOpen ? 'Hide actions' : 'Show actions'}
            active={layer === 'actions' && actionsOpen}
            onClick={toggleActions}
          />
          <CleanIconButton
            name="map"
            title={mapActive ? 'Hide Map' : 'Show Map'}
            active={mapActive}
            onClick={() => window.dispatchEvent(new CustomEvent('pm:map-toggle'))}
          />
        </div>

        {/* LAYER ROW */}
        <div style={{ width: '100%', position: 'relative', minHeight: 56 }}>
          {/* NAV */}
          <div className={`layer ${layer === 'nav' ? 'layer-show' : 'layer-hide'}`} style={{ display: 'flex', justifyContent: 'center' }}>
            <Appear deps={[layer]}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NavCell
                  label="PROPERTIES"
                  active={activeTab === 'properties'}
                  onClick={() => { goNav(); setActiveTab('properties'); setPropertiesReset((n) => n + 1); closeMap(); }}
                />
                <NavCell
                  label="CONTACTS"
                  active={activeTab === 'contacts'}
                  onClick={() => { goNav(); setActiveTab('contacts'); closeMap(); }}
                  showLeftBar
                />
                <NavCell
                  label="REPORTS"
                  active={activeTab === 'reports'}
                  onClick={() => { goNav(); setActiveTab('reports'); closeMap(); }}
                  showLeftBar
                />
              </div>
            </Appear>
          </div>

          {/* SHORTCUTS ribbon */}
          <div className={`layer ${layer === 'shortcuts' ? 'layer-show' : 'layer-hide'}`} style={{ display: 'flex', justifyContent: 'center' }}>
            <Appear deps={[layer, shortcutsOpen]}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NavCell
                  label="RENT"
                  active={shortcutsOpen && shortcutsMode === 'rent'}
                  onClick={() => { setShortcutsMode('rent'); setShortcutsOpen((v) => (shortcutsMode === 'rent' ? !v : true)); if (shortcutsOpen) setLayer('nav'); }}
                />
                <NavCell
                  label="PAYMENT"
                  active={shortcutsOpen && shortcutsMode === 'payment'}
                  onClick={() => { setShortcutsMode('payment'); setShortcutsOpen((v) => (shortcutsMode === 'payment' ? !v : true)); if (shortcutsOpen) setLayer('nav'); }}
                  showLeftBar
                />
              </div>
            </Appear>
          </div>

          {/* ACTIONS ribbon */}
          <div className={`layer ${layer === 'actions' ? 'layer-show' : 'layer-hide'}`} style={{ display: 'flex', justifyContent: 'center' }}>
            <Appear deps={[layer, actionsOpen]}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NavCell
                  label="EXPENSE"
                  active={actionsOpen && actionsMode === 'expense'}
                  onClick={() => { setActionsMode('expense'); setActionsOpen((v) => (actionsMode === 'expense' ? !v : true)); if (actionsOpen) setLayer('nav'); }}
                />
                <NavCell
                  label="CHECK"
                  active={actionsOpen && actionsMode === 'check'}
                  onClick={() => { setActionsMode('check'); setActionsOpen((v) => (actionsMode === 'check' ? !v : true)); if (actionsOpen) setLayer('nav'); }}
                  showLeftBar
                />
              </div>
            </Appear>
          </div>
        </div>
      </Box>

      {/* MAP DRAWER, zero-gap under header. Always mounted, pushes content down. */}
      <MapOSM endpoint="/api/property_markers" height={560} />

      {/* MAIN */}
      <Box style={{ width: APP_WIDTH, margin: '0 auto 10px' }}>
        {layer === 'nav' && activeTab === 'reports' && <Reports />}
        {layer === 'nav' && activeTab === 'properties' && <PropertyList key={propertiesReset} />}
        {layer === 'nav' && activeTab === 'contacts' && <ContactList />}
      </Box>

      {/* SHORTCUTS PANEL below main only when shortcuts layer is active and open */}
      {layer === 'shortcuts' && shortcutsOpen && (
        <Box style={{ width: APP_WIDTH, margin: '0 auto' }}>
          <Appear deps={[shortcutsOpen]}>
            <Shortcuts open={shortcutsOpen} mode={shortcutsMode} />
          </Appear>
        </Box>
      )}
    </Box>
  );
}
