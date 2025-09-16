// UniversalDropdown.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type DropdownOption = {
  value: string;
  label?: string;
  disabled?: boolean;
};

type UniversalDropdownProps = {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;               // shown on button when no value AND as menu header
  onChange: (value: string) => void;
  disabled?: boolean;
  maxMenuHeight?: number;            // default 220
  ariaLabel?: string;
};

const MENU_BORDER = '#111';
const HOVER_BG = '#eef5ff';

export default function UniversalDropdown({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  maxMenuHeight = 220,
  ariaLabel,
}: UniversalDropdownProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(-1);

  const currentLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found?.label ?? found?.value ?? '';
  }, [value, options]);

  // Close when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Keep active index in range & skip disabled
  const nextEnabled = (start: number, dir: 1 | -1) => {
    if (!options.length) return -1;
    let i = start;
    for (let step = 0; step < options.length; step++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    // focus the current value, else first enabled
    const idx = Math.max(0, options.findIndex(o => o.value === value && !o.disabled));
    setActive(idx !== -1 ? idx : nextEnabled(-1, 1));
  };

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    // return focus to the button for accessibility
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => nextEnabled(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => nextEnabled(i, -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(nextEnabled(-1, 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(nextEnabled(0, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) commit(active);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (active >= 0) commit(active);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }} onKeyDown={onKeyDown}>
      {/* Button looks like your input cell */}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          outline: 'none',
        }}
      >
        {value ? (currentLabel || value) : <span style={{ color: '#999' }}>{placeholder}</span>}
      </button>

      {/* Menu */}
      {open && (
        <div
          role="listbox"
          aria-label={placeholder}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',                    // matches cell width
            maxHeight: maxMenuHeight,
            overflowY: 'auto',
            background: '#fff',
            border: `2px solid ${MENU_BORDER}`,
            zIndex: 100,
            boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header (placeholder) */}
          <div
            style={{
              padding: '10px 12px',
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              background: '#f8f8f8',
              color: '#333',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>

          {/* Thin divider */}
          <div style={{ height: 1, background: '#e5e5e5' }} />

          {/* Options */}
          {options.map((opt, idx) => {
            const isActive = idx === active;
            const isSelected = value === opt.value;
            const isDisabled = !!opt.disabled;
            return (
              <div
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()} // keep focus while clicking
                onClick={() => !isDisabled && commit(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isActive ? HOVER_BG : '#fff',
                  color: isDisabled ? '#999' : '#111',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  borderTop: '1px solid #f2f2f2',
                }}
              >
                <span>{opt.label ?? opt.value}</span>
                {isSelected ? <span aria-hidden>✓</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
