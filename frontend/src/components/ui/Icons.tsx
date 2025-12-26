// src/components/ui/Icons.tsx
import React from 'react';
import {
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaMapMarkedAlt,
  FaTable,
  FaEdit,
  FaTrash,
  FaArrowRight,
  FaArrowDown,
  FaRegListAlt,
  FaHome,
  FaTimes,
  FaPlus,
  FaCheckCircle,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaSave,
  FaUserPlus,
  FaUserMinus,
  FaUsers,
  FaInfoCircle,
  FaFileExport,
} from 'react-icons/fa';

import type { CSSProperties } from 'react';

// Add these aliases back into IconName:
export type IconName =
  | 'search'
  | 'sort'
  | 'sortUp'
  | 'sortDown'
  | 'map'
  | 'tableView'
  | 'edit'
  | 'delete'
  | 'arrowRight'
  | 'arrowDown'
  | 'dashboard'
  | 'home'
  | 'cancel'
  | 'add'
  | 'addCircle'
  | 'save'
  | 'alert'
  | 'calendar'
  | 'info'
  | 'userAdd'
  | 'userRemove'
  | 'contact'
  | "export"
  | 'confirm';
  


const ICONS: Record<IconName, React.ComponentType<{ size?: number }>> = {
  search: FaSearch,
  sort: FaSort,
  sortUp: FaSortUp,
  sortDown: FaSortDown,
  map: FaMapMarkedAlt,
  tableView: FaTable,
  edit: FaEdit,
  delete: FaTrash,
  arrowRight: FaArrowRight,
  arrowDown: FaArrowDown,
  dashboard: FaRegListAlt,
  home: FaHome,
  cancel: FaTimes,
  add: FaPlus, // 👈 alias for backwards compatibility
  addCircle: FaPlus,
  save: FaSave,
  alert: FaExclamationTriangle,
  calendar: FaCalendarAlt,
  info: FaInfoCircle, // or pick another icon you like
  userAdd: FaUserPlus,
  userRemove: FaUserMinus,
  contact: FaUsers,
  confirm: FaCheckCircle,
  export: FaFileExport,
};

export type IconProps = {
  name: IconName;
  size?: number;
  title?: string;
  color?: string;
  hoverColor?: string;
  style?: CSSProperties;
  onClick?: () => void;
  'aria-hidden'?: boolean;
};

export function Icon({
  name,
  size = 22,
  title,
  color = '#111',
  hoverColor,
  style,
  onClick,
  ...rest
}: IconProps) {
  const Cmp = ICONS[name];
  const [hover, setHover] = React.useState(false);

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      title={title}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: hover && hoverColor ? hoverColor : color,
        transition: 'color 0.15s ease',
        ...style,
      }}
      {...rest}
    >
      <Cmp size={size} />
    </span>
  );
}

// ---------------------------------------------
// ICON BUTTON
// ---------------------------------------------
type IconButtonProps = {
  icon: IconName;
  label?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  boxSize?: number;
  iconSize?: number;
  color?: string;
  bg?: string;
  hoverBg?: string;
  style?: React.CSSProperties;
};

export function IconButton({
  icon,
  label,
  title,
  onClick,
  disabled,
  boxSize = 42,
  iconSize = 22,
  color = '#111',
  bg = '#fff',
  hoverBg = '#f1f1f1',
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      disabled={disabled}
      style={{
        width: boxSize,
        height: boxSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        border: '1px solid #000',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s ease, transform 0.1s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = bg;
      }}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </button>
  );
}
