// src/components/UniversalDropdown.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DropdownOption = { value: string; label?: string; disabled?: boolean };

export type UniversalDropdownProps = {
  value: string | null | undefined;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxMenuHeight?: number;
  ariaLabel?: string;
  searchable?: boolean; // defaults true
  variant?: 'default' | 'flat';
  padTop?: number;
};

const MENU_BORDER = '#111';
const PLACEHOLDER = '#9aa1a8';
const HOVER_BG = '#eef5ff';
const ITEM_H = 42;
const HEADER_H = 40;
const VISIBLE_ROWS = 20; // show up to 20 then scroll

export default function UniversalDropdown({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  maxMenuHeight,
  ariaLabel,
  searchable = true,
  variant = 'default',
  padTop = 0,
}: UniversalDropdownProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const ROW_BORDER = 1;     // px
const LIST_VPAD = 12; 

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(-1);
  const [query, setQuery] = useState('');
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? found?.value ?? '';
  }, [value, options]);

  const filtered = useMemo(() => {
    const base = options;
    if (!searchable || !query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((o) => (o.label ?? o.value).toLowerCase().includes(q));
  }, [options, searchable, query]);

const computedMaxMenuH = useMemo(() => {
  const rows = Math.min(VISIBLE_ROWS, filtered.length || VISIBLE_ROWS);
  const bordersPx = Math.max(0, rows - 1) * ROW_BORDER;
  return (maxMenuHeight ?? Infinity) > 0
    ? Math.min(maxMenuHeight!, HEADER_H + LIST_VPAD + rows * ITEM_H + bordersPx)
    : HEADER_H + LIST_VPAD + rows * ITEM_H + bordersPx;
}, [filtered.length, maxMenuHeight]);

  const SHOW_SCROLL = filtered.length > VISIBLE_ROWS;

  const updateRect = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setMenuRect({ top: Math.floor(r.top), left: Math.floor(r.left), width: Math.floor(r.width), height: Math.floor(r.height) });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateRect();
    const onScroll = () => updateRect();
    const onResize = () => updateRect();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      const t = e.target as Node | null;
      if (t && !wrapRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const nextEnabled = (start: number, dir: 1 | -1) => {
    if (!filtered.length) return -1;
    let i = start;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!filtered[i].disabled) return i;
    }
    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    updateRect();
    setQuery('');
    setActive(-1);
    setTimeout(() => searchable && searchRef.current?.focus(), 0);
  };

  const commit = (idx: number) => {
    const opt = filtered[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); return; }
    if (!query.trim()) {
      if (e.key.length === 1 || e.key === 'Backspace') searchRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => nextEnabled(i, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => nextEnabled(i, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(nextEnabled(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(nextEnabled(0, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (active >= 0) commit(active); }
  };

  const menu =
    open && menuRect
      ? createPortal(
          <div
            role="listbox"
            aria-label={placeholder}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: menuRect.top + menuRect.height + 1, // open below the cell
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: computedMaxMenuH,
              overflowY: SHOW_SCROLL ? 'auto' : 'hidden',
              background: '#fff',
              border: `1px solid ${MENU_BORDER}`,
              zIndex: 5000,
              boxShadow: variant === 'flat' ? 'none' : '0 8px 18px rgba(0,0,0,0.2)',
            }}
            onKeyDown={onKeyDown}
          >
            {searchable && (
              <div style={{ padding: 8, borderBottom: `1px solid ${MENU_BORDER}` }}>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(-1); }}
                  placeholder={placeholder}
                  style={{ width: '100%', height: 32, border: `1px solid ${MENU_BORDER}`, padding: '0 8px', outline: 'none' }}
                />
              </div>
            )}

            {/* Always show up to 20 results on open; scroll beyond */}
            <div style={{ padding: '6px 0' }}>
              {filtered.map((opt, idx) => {
                const isActive = idx === active;
                const isSel = value != null && !opt.disabled && value === opt.value;
                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) commit(idx); }}
                    style={{
                      minHeight: ITEM_H,
                      lineHeight: '20px',
                      padding: '10px 12px',
                      background: isActive ? HOVER_BG : '#fff',
                      color: opt.disabled ? '#999' : '#111',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      borderTop: '1px solid #f2f2f2',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{opt.label ?? opt.value}</span>
                    {isSel ? <span>✓</span> : null}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: '10px 12px', color: '#666' }}>No matches.</div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#fff',
          font: 'inherit',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          paddingTop: padTop,
          borderRadius: 0,
          appearance: 'none',
          outline: 'none',
          position: 'relative',
          zIndex: 0,
          boxShadow: 'none',
          color: value ? '#111' : PLACEHOLDER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value ? currentLabel || String(value) : placeholder}
      </button>
      {menu}
    </div>
  );
}
