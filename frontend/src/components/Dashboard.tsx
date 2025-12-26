// src/pages/Dashboard.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mantine/core';
import Shortcuts from './Shortcuts';
import Reports from './Reports';
import ContactList from './ContactList';
import PropertyList from './PropertyList';
import { Icon } from './ui/Icons';
import MapOSM from './MapOSM';
import { AnimatePresence, motion } from 'framer-motion';
import Info from './Info';

const APP_WIDTH = 1575;
const BORDER_THICKNESS = 8;
const HOVER_BG = '#33395c8a';

type Tab = 'properties' | 'contacts' | 'reports' | 'PropertyView' | null;
type ShortcutMode = 'rent' | 'payment';
type ActionMode = 'expense' | 'check';
type Layer = 'nav' | 'shortcuts' | 'actions';

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
    fontWeight: 800,
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
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#ffef09' : '#fff'; }}
      >
        {label}
      </div>
    </div>
  );
}

/* icon button with 1s flash for home */
function CleanIconButton({
  name, active, onClick, title,
}: {
  name: 'home' | 'add' | 'search' | 'map' | 'info';
  active?: boolean;
  onClick?: () => void;
  title: string;
}) {
  const ROW_H = 56;
  const ICON_SIZE = 40;

  const [flash, setFlash] = useState(false);
  const timerRef = useRef<number | null>(null);

  const handleClick = () => {
    if (name === 'home') {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setFlash(true);
      timerRef.current = window.setTimeout(() => setFlash(false), 2000); // 1s flash visual (current timing = 2s)
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!active && !flash) e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (active || flash) ? '#000' : 'transparent';
      }}
      style={{
        width: ROW_H,
        height: ROW_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: (active || flash) ? '#000' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 140ms ease',
      }}
    >
      <Icon
        name={name}
        size={ICON_SIZE}
        style={{
          color: (active || flash) ? '#ffef09' : '#111',
          transition: 'color 140ms ease',
        }}
        aria-hidden
      />
    </button>
  );
}

export default function Dashboard() {
  /* single layer */
  const [layer, setLayer] = useState<Layer>('nav');
  const [activeTab, setActiveTab] = useState<Tab>(null);

  /* shortcuts/actions state */
  const [shortcutsMode, setShortcutsMode] = useState<ShortcutMode>('rent');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [actionsMode, setActionsMode] = useState<ActionMode>('expense');
  const [actionsOpen, setActionsOpen] = useState(false);

  /* force PropertyList remount on each PROPERTIES click */
  const [propertiesKey, setPropertiesKey] = useState(0);

  /* global map & info icon reflect */
  const [mapActive, setMapActive] = useState(false);
  const [infoActive, setInfoActive] = useState(false);

  useEffect(() => {
    const h = (e: any) => setMapActive(!!e?.detail?.open);
    window.addEventListener('pm:map-state', h as EventListener);
    return () => window.removeEventListener('pm:map-state', h as EventListener);
  }, []);
  useEffect(() => {
    const h = (e: any) => setInfoActive(!!e?.detail?.open);
    window.addEventListener('pm:info-state', h as EventListener);
    return () => window.removeEventListener('pm:info-state', h as EventListener);
  }, []);

  /* helpers */
  const closeMap = () => window.dispatchEvent(new CustomEvent('pm:map-close'));

  const goNav = () => {
    setLayer('nav');
    setShortcutsOpen(false);
    setActionsOpen(false);
  };

  // Toggle ribbons via icons only
  const toggleShortcuts = () => {
    closeMap();
    if (layer === 'shortcuts' && shortcutsOpen) {
      setShortcutsOpen(false);
      setLayer('nav');
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
      setLayer('nav');
      return;
    }
    setShortcutsOpen(false);
    setActiveTab(null);
    setLayer('actions');
    setActionsOpen(true);
  };

  /* header + links measurement for centered rule */
  const headerRef = useRef<HTMLDivElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const [ruleCenter, setRuleCenter] = useState(0);

  function measureRule() {
    const h = headerRef.current?.getBoundingClientRect();
    const l = linksRef.current?.getBoundingClientRect();
    if (!h || !l) return;
    const center = (l.left - h.left) + l.width / 2;
    setRuleCenter(center);
  }

  useLayoutEffect(() => {
    measureRule();
    const on = () => measureRule();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useLayoutEffect(() => { measureRule(); }, [layer, shortcutsOpen, actionsOpen, activeTab]);

  const layerVariants = {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.22, ease: 'easeOut' as const },
  };

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
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          position: 'relative',
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
          {/* NEW: INFO ICON */}
          <CleanIconButton
            name="info"
            title={infoActive ? 'Hide Info' : 'Show Info'}
            active={infoActive}
            onClick={() => window.dispatchEvent(new CustomEvent('pm:info-toggle'))}
          />
        </div>

        {/* LAYER ROW */}
        <div style={{ width: '100%', position: 'relative', minHeight: 56 }}>
          <AnimatePresence mode="wait">
            {layer === 'nav' && (
              <motion.div
                key="nav"
                style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}
                initial="initial" animate="animate" exit="exit" transition={layerVariants.transition}
                variants={layerVariants}
              >
                <div ref={linksRef} style={{ display: 'flex', alignItems: 'center' }}>
                  <NavCell
                    label="PROPERTIES"
                    active={activeTab === 'properties'}
                    onClick={() => {
                      goNav();
                      setActiveTab('properties');
                      setPropertiesKey((k) => k + 1); // force remount every click
                      closeMap();
                    }}
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
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {layer === 'shortcuts' && shortcutsOpen && (
              <motion.div
                key="shortcuts"
                style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}
                initial="initial" animate="animate" exit="exit" transition={layerVariants.transition}
                variants={layerVariants}
              >
                <div ref={linksRef} style={{ display: 'flex', alignItems: 'center' }}>
                  <NavCell
                    label="RENT"
                    active={shortcutsOpen && shortcutsMode === 'rent'}
                    onClick={() => { setShortcutsMode('rent'); setShortcutsOpen(true); setLayer('shortcuts'); }}
                  />
                  <NavCell
                    label="PAYMENT"
                    active={shortcutsOpen && shortcutsMode === 'payment'}
                    onClick={() => { setShortcutsMode('payment'); setShortcutsOpen(true); setLayer('shortcuts'); }}
                    showLeftBar
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {layer === 'actions' && actionsOpen && (
              <motion.div
                key="actions"
                style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}
                initial="initial" animate="animate" exit="exit" transition={layerVariants.transition}
                variants={layerVariants}
              >
                <div ref={linksRef} style={{ display: 'flex', alignItems: 'center' }}>
                  <NavCell
                    label="EXPENSE"
                    active={actionsOpen && actionsMode === 'expense'}
                    onClick={() => { setActionsMode('expense'); setActionsOpen(true); setLayer('actions'); }}
                  />
                  <NavCell
                    label="CHECK"
                    active={actionsOpen && actionsMode === 'check'}
                    onClick={() => { setActionsMode('check'); setActionsOpen(true); setLayer('actions'); }}
                    showLeftBar
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM RULE */}
        <motion.div
          key="header-rule"
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: `calc(${ruleCenter}px - 50vw)`,
            width: '100vw',
            height: 1,
            transformOrigin: '50% 50%',
            background: '#111',
            boxShadow: '0 8px 14px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}
        />
      </Box>

      {/* MAP */}
      <MapOSM endpoint="/api/property_markers" height={560} />

      {/* MAIN */}
      <Box style={{ width: APP_WIDTH, margin: '0 auto 0' }}>
        {layer === 'nav' && activeTab === 'reports' && <Reports />}
        {layer === 'nav' && activeTab === 'properties' && (
          <div style={{ marginTop: 0 }}>
            <PropertyList key={propertiesKey} />
          </div>
        )}
        {layer === 'nav' && activeTab === 'contacts' && <ContactList />}
      </Box>

      {/* SHORTCUTS PANEL */}
      <AnimatePresence>
        {layer === 'shortcuts' && shortcutsOpen && (
          <motion.div
            key="shortcuts-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            style={{ width: APP_WIDTH, margin: '0 auto' }}
          >
            <Shortcuts open={shortcutsOpen} mode={shortcutsMode} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* INFO OVERLAY (globally controlled) */}
      <Info />
    </Box>
  );
}
