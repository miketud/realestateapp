// src/pages/Info.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './ui/Icons';

export default function Info() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setOpen((p) => !p);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);

    window.addEventListener('pm:info-toggle', onToggle as EventListener);
    window.addEventListener('pm:info-open', onOpen as EventListener);
    window.addEventListener('pm:info-close', onClose as EventListener);

    return () => {
      window.removeEventListener('pm:info-toggle', onToggle as EventListener);
      window.removeEventListener('pm:info-open', onOpen as EventListener);
      window.removeEventListener('pm:info-close', onClose as EventListener);
    };
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="info-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            key="info-card"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              width: 'min(820px, 92vw)',
              background: '#fff',
              border: '8px solid #111',
              boxShadow: '0 28px 64px rgba(0,0,0,0.45)',
              padding: 32,
              color: '#111',
              fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
            }}
          >
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 1 }}>
                PROPERTY MANAGER GUIDE
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{
                  width: 44,
                  height: 44,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Icon name="cancel" size={32} />
              </button>
            </div>

            {/* BODY */}
            <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 500 }}>
              <p style={{ marginTop: 0, marginBottom: 20 }}>
                Manage your real estate portfolio, contacts, and financial records in one place.
                Use the tabs and tools above to navigate between key functions.
              </p>

              <section style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>DASHBOARD</h3>
                <p style={{ margin: 0 }}>
                  Quick navigation hub. Use the top icons to switch between properties, contacts, reports,
                  and shortcuts for adding rent or payments.
                </p>
              </section>

              <section style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>PROPERTIES</h3>
                <p style={{ margin: 0 }}>
                  Add new properties and click any record for an in-depth view with purchase details, rent logs, loans,
                  and transaction history. View and update by property in a consolidated view.
                </p>
              </section>

              <section style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>CONTACTS</h3>
                <p style={{ margin: 0 }}>
                  Create and manage contact records for owners, tenants, lenders, and vendors.
                  These are linked across the app to sync with properties.
                </p>
              </section>

              <section>
                <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>REPORTS</h3>
                <p style={{ margin: 0 }}>
                  Generate income and expense summaries by year and property.
                  You can run reports for all properties or focus on individual ones.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
