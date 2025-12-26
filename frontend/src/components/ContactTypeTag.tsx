import React from 'react';

export const TYPE_COLORS: Record<string, string> = {
  Personal: '#2B78E4',
  Tenant: '#E69138',
  Contractor: '#6AA84F',
  Vendor: '#8E7CC3',
  Manager: '#FFD966',
  'Emergency Contact': '#CC0000',
  Other: '#7f8a99',
  '': '#999999',
};

export function colorForContactType(type?: string) {
  return TYPE_COLORS[type || ''] || TYPE_COLORS[''];
}

type ContactTypeTagProps = {
  type?: string | null;
  variant?: 'corner' | 'inline';
  size?: number;
  corner?: 'tr' | 'tl' | 'br' | 'bl';
  withBorder?: boolean;
  ariaLabel?: string;
};

export default function ContactTypeTag({
  type,
  variant = 'corner',
  size = 30,          // larger default square
  corner = 'tr',
  withBorder = true,
  ariaLabel = 'contact type',
}: ContactTypeTagProps) {
  const bg = colorForContactType(type || '');

  if (variant === 'inline') {
    return (
      <span
        aria-label={ariaLabel}
        title={type || undefined}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          background: bg,
          border: withBorder ? '2px solid #111' : 'none',
          borderRadius: 3,
          marginLeft: 6,
          verticalAlign: 'middle',
        }}
      />
    );
  }

  const pos: React.CSSProperties =
    corner === 'tr' ? { top: 6, right: 6 } :
    corner === 'tl' ? { top: 6, left: 6 } :
    corner === 'br' ? { bottom: 6, right: 6 } :
                      { bottom: 6, left: 6 };

  return (
    <span
      aria-label={ariaLabel}
      title={type || undefined}
      style={{
        position: 'absolute',
        ...pos,
        width: size,
        height: size,
        background: bg,
        border: withBorder ? '2px solid #111' : 'none',
        borderRadius: 3,
        pointerEvents: 'none',
      }}
    />
  );
}
