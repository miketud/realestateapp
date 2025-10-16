// src/components/ui/Icons.tsx
import { useState, useRef, type CSSProperties } from 'react';
import {
  MdTableView,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineClear,
  MdOutlineSearch,
  MdOutlineArrowRight,
  MdOutlineArrowDropDown,
  MdOutlineDashboard,
  MdAddCircleOutline,
  MdViewList,
  MdOutlineRemoveCircle,
  MdContacts,
  MdOutlineUploadFile,
} from 'react-icons/md';
import { FaSort, FaSortDown, FaSortUp, FaRegMap } from 'react-icons/fa';
import { IoMdHome, IoMdAdd } from 'react-icons/io';

const ICONS = {
  tableView: MdTableView,
  edit: MdOutlineEdit,
  delete: MdOutlineDelete,
  clear: MdOutlineClear,
  search: MdOutlineSearch,
  arrowRight: MdOutlineArrowRight,
  arrowDown: MdOutlineArrowDropDown,
  dashboard: MdOutlineDashboard,
  map: FaRegMap,
  sort: FaSort,
  sortUp: FaSortUp,
  sortDown: FaSortDown,
  addCircle: MdAddCircleOutline,
  home: IoMdHome,
  add: IoMdAdd,
  view: MdViewList,
  remove: MdOutlineRemoveCircle,
  contact: MdContacts,
  upload: MdOutlineUploadFile,
} as const;

export type IconName = keyof typeof ICONS;
type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const PX: Record<SizeToken, number> = { xs: 16, sm: 18, md: 22, lg: 28, xl: 34 };

export function Icon({
  name,
  size = 'md',
  title,
  'aria-hidden': ariaHidden,
  style,
}: {
  name: IconName;
  size?: SizeToken | number;
  title?: string;
  'aria-hidden'?: boolean;
  style?: CSSProperties;
}) {
  const Cmp = ICONS[name];
  const final = typeof size === 'number' ? size : PX[size];
  return <Cmp size={final} title={title} aria-hidden={ariaHidden} style={style} />;
}

/* ---------- IconButton ---------- */
type Variant = 'default' | 'primary' | 'warning' | 'success' | 'danger' | 'ghost';
const PALETTE: Record<Variant, { bg: string; border: string; color: string }> = {
  default: { bg: '#fff', border: '#111', color: '#111' },
  primary: { bg: '#2563eb', border: '#1e3a8a', color: '#fff' }, // blue
  warning: { bg: '#f97316', border: '#7c2d12', color: '#fff' }, // orange
  success: { bg: '#e9f7f2', border: '#29a376', color: '#29a376' },
  danger: { bg: '#dc2626', border: '#7f1d1d', color: '#fff' },  // red
  ghost: { bg: 'transparent', border: '#111', color: '#111' },
};

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  size = 'md',
  variant,
  style,
  title,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: Variant;
  style?: CSSProperties;
  title?: string;
}) {
  const box = size === 'sm' ? 36 : size === 'lg' ? 50 : 44;
  const inferred: Variant =
    variant ??
    (icon === 'delete' ? 'danger' : icon === 'clear' ? 'warning' : icon === 'remove' ? 'primary' : 'default');
  const tone = PALETTE[inferred];

  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: box,
        height: box,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        verticalAlign: 'middle',
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `2px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : size === 'lg' ? 28 : 22} aria-hidden style={{ display: 'block' }} />
    </button>
  );
}

/* ---------- DeleteControl ---------- */
export function DeleteControl({
  onConfirm,
  onCancel,
  size = 'sm',
  confirmWord = 'DELETE',
  placeholder = 'type DELETE',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  style,
}: {
  onConfirm: () => void;
  onCancel?: () => void;
  size?: 'sm' | 'md' | 'lg';
  confirmWord?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <IconButton
        icon="delete"
        label="Delete"
        title="Delete"
        size={size}
        variant="danger"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        style={style}
      />
    );
  }

  const WRAP: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: PALETTE.danger.bg,
    border: `2px solid ${PALETTE.danger.border}`,
    padding: '6px 8px',
    borderRadius: 4,
    color: '#fff',
  };
  const INPUT: CSSProperties = {
    height: 28,
    minWidth: 220,
    border: `1px solid ${PALETTE.danger.border}`,
    outline: 'none',
    padding: '0 8px',
    background: '#fff',
    color: '#111',
  };

  return (
    <span style={{ display: 'inline-flex', ...style }}>
      <span style={WRAP}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          style={INPUT}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              reset();
              onCancel?.();
            }
            if (e.key === 'Enter' && text.trim().toUpperCase() === confirmWord) {
              reset();
              onConfirm();
            }
          }}
        />
        <IconButton
          icon="delete"
          label={confirmLabel}
          title={confirmLabel}
          size={size}
          variant="danger"
          onClick={() => {
            if (text.trim().toUpperCase() === confirmWord) {
              reset();
              onConfirm();
            }
          }}
        />
        <IconButton
          icon="clear"
          label={cancelLabel}
          title={cancelLabel}
          size={size}
          variant="danger" // red cancel as requested
          onClick={() => {
            reset();
            onCancel?.();
          }}
        />
      </span>
    </span>
  );
}
