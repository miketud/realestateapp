// src/components/DatePicker.tsx
import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './ui/Icons';

export type DatePickerFieldProps = {
  value?: string | null;               // ISO yyyy-mm-dd
  onChange: (nextISO: string) => void; // send ISO ('' to clear)
  ariaLabel: string;                   // also used as hover title
  width?: number;
  minDateISO?: string | null;
  maxDateISO?: string | null;
};

function fmt(iso?: string | null): string {
  // Expect "YYYY-MM-DD". Just pretty-print; no Date object, no TZ shifts.
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const [, y, mm, dd] = m;
  return `${mm}/${dd}/${y}`;
}

export default function DatePickerField({
  value,
  onChange,
  ariaLabel,
  width = 160,
  minDateISO,
  maxDateISO,
}: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const min = useMemo(() => minDateISO ?? undefined, [minDateISO]);
  const max = useMemo(() => maxDateISO ?? undefined, [maxDateISO]);

  const openNativePicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  return (
    <div style={{ width, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.currentTarget.value || '')}
        aria-label={ariaLabel}
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {!value ? (
          <motion.button
            key="icon"
            type="button"
            onClick={openNativePicker}
            aria-label={ariaLabel}
            title={ariaLabel}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{
              width: 36, height: 36, border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="calendar" size={22} />
          </motion.button>
        ) : (
          <motion.button
            key="date"
            type="button"
            onClick={openNativePicker}
            aria-label={`${ariaLabel}, ${fmt(value)}`}
            title={ariaLabel}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.14 }}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 30, fontWeight: 800, color: '#000', lineHeight: 1,
            }}
          >
            {fmt(value)}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
