import { useEffect, useState, useRef } from 'react';

type BannerMessageProps = {
  message: string | null;
  type?: 'error' | 'success' | 'info';
  show?: boolean;
  onDismiss?: () => void;
  autoCloseMs?: number;
  mode?: 'overlay' | 'inline'; // overlay = fixed, top-of-viewport
};

export default function BannerMessage({
  message,
  type = 'error',
  show = true,
  onDismiss,
  autoCloseMs,
  mode = 'overlay',
}: BannerMessageProps) {
  const [visible, setVisible] = useState(show);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];

    if (message) {
      setVisible(true);
      if (autoCloseMs) {
        const t1 = window.setTimeout(() => setVisible(false), autoCloseMs);
        const t2 = window.setTimeout(() => { onDismiss?.(); }, autoCloseMs + 250);
        timers.current.push(t1, t2);
      }
    }

    return () => {
      timers.current.forEach(t => window.clearTimeout(t));
      timers.current = [];
    };
  }, [message, autoCloseMs, onDismiss]);

  if (!message) return null;

  const colors = {
    error:   { bg: '#b40000ff', text: '#ffffffff', border: '#000000ff' },
    success: { bg: '#e7f8ef', text: '#1d7a40', border: '#49c178' },
    info:    { bg: '#eef5ff', text: '#2b6fff', border: '#7ea6ff' },
  } as const;

  const theme = colors[type];

  const base = {
    padding: '10px 18px',
    background: theme.bg,
    color: theme.text,
    border: `1.5px solid ${theme.border}`,
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 30,
    letterSpacing: 0.5,
    boxSizing: 'border-box' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: visible ? 1 : 0,
    transform: `translateY(${visible ? '0' : '-8px'})`,
    transition: 'opacity 220ms ease, transform 220ms ease',
  };

  const overlayWrap =
    mode === 'overlay'
      ? {
          position: 'fixed' as const,
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(92vw, 1600px)',
          zIndex: 10000,
          pointerEvents: 'none' as const, // clicks go through except on button
        }
      : { width: '100%', marginBottom: 16 };

  return (
    <div style={overlayWrap}>
      <div role="alert" style={{ ...base, pointerEvents: 'auto' }}>
        <span style={{ paddingRight: 12 }}>{message}</span>
        {onDismiss && (
          <button
            onClick={() => { setVisible(false); window.setTimeout(() => onDismiss(), 220); }}
            aria-label="Dismiss"
            style={{
              marginLeft: 12,
              flex: '0 0 auto',
              // border: `2px solid ${theme.text}`,
              background: '#000000ff',
              color: theme.text,
              fontWeight: 900,
              fontSize: 16,
              lineHeight: 1,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
