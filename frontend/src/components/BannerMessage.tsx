import { useEffect, useState, useRef } from 'react';

type BannerMessageProps = {
  message: string | null;
  type?: 'error' | 'success' | 'info';
  show?: boolean;
  onDismiss?: () => void;
  autoCloseMs?: number; // ← time in ms before auto-close
};

export default function BannerMessage({
  message,
  type = 'error',
  show = true,
  onDismiss,
  autoCloseMs,
}: BannerMessageProps) {
  const [visible, setVisible] = useState(show);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // reset timers whenever message changes
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];

    if (message && autoCloseMs) {
      setVisible(true);
      const t1 = window.setTimeout(() => setVisible(false), autoCloseMs);
      const t2 = window.setTimeout(() => { onDismiss?.(); }, autoCloseMs + 300);
      timers.current.push(t1, t2);
    }

    return () => {
      timers.current.forEach(t => window.clearTimeout(t));
      timers.current = [];
    };
  }, [message, autoCloseMs, onDismiss]);

  if (!message) return null;

  const colors = {
    error: { bg: '#ffeded', text: '#a13d3d', border: '#e57e7e' },
    success: { bg: '#e7f8ef', text: '#1d7a40', border: '#49c178' },
    info: { bg: '#eef5ff', text: '#2b6fff', border: '#7ea6ff' },
  } as const;

  const theme = colors[type];

  return (
    <div
      role="alert"
      style={{
        width: '100%',
        marginBottom: 16,
        padding: '10px 18px',
        background: theme.bg,
        color: theme.text,
        border: `1.5px solid ${theme.border}`,
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 16,
        letterSpacing: 0.5,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}
    >
      <span style={{ paddingRight: 12 }}>{message}</span>
      {onDismiss && (
        <button
          onClick={() => { setVisible(false); window.setTimeout(() => onDismiss(), 300); }}
          aria-label="Dismiss"
          style={{
            marginLeft: 12,
            flex: '0 0 auto',
            border: `2px solid ${theme.text}`,
            background: '#fff',
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
  );
}
