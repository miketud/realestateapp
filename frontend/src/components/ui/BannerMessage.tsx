// src/components/ui/BannerMessage.tsx
import React, { useEffect } from 'react';

type Kind = 'error' | 'success' | 'info' | 'warn';

type Props = {
  kind: Kind;
  message: React.ReactNode;
  inline?: boolean;          // true = inline block; false = fixed toast
  maxWidth?: number;         // only used for inline
  autoHideMs?: number;       // optional auto-dismiss for toast mode
  onClose?: () => void;      // optional close handler
  style?: React.CSSProperties;
};

const PALETTES: Record<Kind, { bg: string; border: string; text: string }> = {
  error:   { bg: '#ffeaea', border: '#c33',   text: '#c33' },
  success: { bg: '#e9f7ef', border: '#0a7a28', text: '#0a7a28' },
  info:    { bg: '#eef6ff', border: '#1e66d0', text: '#1e66d0' },
  warn:    { bg: '#fff7e6', border: '#b26a00', text: '#b26a00' },
};

export default function BannerMessage({
  kind,
  message,
  inline = true,
  maxWidth,
  autoHideMs,
  onClose,
  style,
}: Props) {
  const pal = PALETTES[kind];

  useEffect(() => {
    if (!autoHideMs || inline) return;
    const t = setTimeout(() => onClose?.(), autoHideMs);
    return () => clearTimeout(t);
  }, [autoHideMs, inline, onClose]);

  const role = kind === 'error' || kind === 'warn' ? 'alert' : 'status';

  if (inline) {
    return (
      <div
        role={role}
        style={{
          border: `2px solid ${pal.border}`,
          background: pal.bg,
          color: pal.text,
          fontWeight: 700,
          letterSpacing: 0.3,
          padding: '10px 14px',
          marginTop: 8,
          ...(maxWidth ? { maxWidth, marginInline: 'auto' } : {}),
          ...style,
        }}
      >
        {message}
      </div>
    );
  }

  // toast (fixed) mode
  return (
    <div
      role={role}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 12,
        transform: 'translateX(-50%)',
        border: `2px solid ${pal.border}`,
        background: pal.bg,
        color: pal.text,
        fontWeight: 900,
        letterSpacing: 0.3,
        padding: '12px 16px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
        zIndex: 9999,
        ...style,
      }}
      onClick={onClose}
      title={onClose ? 'Dismiss' : undefined}
    >
      {message}
    </div>
  );
}
