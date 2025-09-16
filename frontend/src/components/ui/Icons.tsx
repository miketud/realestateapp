// src/components/ui/Icons.tsx
import type { CSSProperties } from 'react';
import {
  MdTableView,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineClear,
  MdOutlineSearch,
  MdOutlineArrowRight,
  MdOutlineArrowDropDown,
  MdOutlineDashboard,
  MdAddCircleOutline, // NEW
} from 'react-icons/md';
import { FaSort, FaSortDown, FaSortUp, FaRegMap } from 'react-icons/fa';

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
  addCircle: MdAddCircleOutline, // NEW
} as const;

export type IconName = keyof typeof ICONS;
type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const pxForSize: Record<SizeToken, number> = {
  xs: 16,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 34,
};

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
  const finalSize = typeof size === 'number' ? size : pxForSize[size];
  return <Cmp size={finalSize} title={title} aria-hidden={ariaHidden} style={style} />;
}

/** Square, accessible icon button with consistent styles */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  size = 'md', // controls square + icon size
  variant = 'default',
  style,
  title,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger' | 'ghost' | 'success'; // success = green (NEW)
  style?: CSSProperties;
  title?: string;
}) {
  const squarePx = size === 'sm' ? 36 : size === 'lg' ? 50 : 44;

  const palette =
    {
      default: { bg: '#fff',     border: '#111', color: '#111' },
      danger:  { bg: '#ffe9e9',  border: '#c33', color: '#c33' },
      ghost:   { bg: 'transparent', border: '#111', color: '#111' },
      success: { bg: '#e9f7f2',  border: '#29a376', color: '#29a376' }, // NEW
    }[variant] ?? { bg: '#fff', border: '#111', color: '#111' };

  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: squarePx,
        height: squarePx,
        display: 'grid',
        placeItems: 'center',
        lineHeight: 0,
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `2px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : size === 'lg' ? 28 : 22} aria-hidden />
    </button>
  );
}
