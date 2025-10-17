// src/components/ui/Icons.tsx
import { type CSSProperties } from 'react';
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
  MdInfoOutline,
} from 'react-icons/md';
import { FaSort, FaSortDown, FaSortUp, FaRegMap, FaUserMinus } from 'react-icons/fa';
import { IoMdHome, IoMdAdd } from 'react-icons/io';
import { AiOutlineExport } from 'react-icons/ai';

/* Registry */
const ICONS = {
  tableView: MdTableView,
  edit: MdOutlineEdit,
  delete: MdOutlineDelete,
  cancel: MdOutlineClear, // was "clear"
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
  remove_user: FaUserMinus,
  export: AiOutlineExport,
  info: MdInfoOutline,
} as const;

export type IconName = keyof typeof ICONS;

/* Primitive Icon */
const ICON_PX = 22;

export function Icon({
  name,
  size = ICON_PX,
  title,
  'aria-hidden': ariaHidden,
  style,
}: {
  name: IconName;
  size?: number;
  title?: string;
  'aria-hidden'?: boolean;
  style?: CSSProperties;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} title={title} aria-hidden={ariaHidden} style={style} />;
}

/* IconButton with per-icon colors */
type IconButtonColors = { bg: string; border: string; color: string };

const PER_ICON: Record<IconName, IconButtonColors> = {
  // semantic
  delete: { bg: '#dc2626', border: '#7f1d1d', color: '#fff' }, // red
  cancel: { bg: '#f97316', border: '#7c2d12', color: '#fff' }, // orange
  remove: { bg: '#2563eb', border: '#1e3a8a', color: '#fff' }, // blue
  addCircle: { bg: '#30a800ff', border: '#111', color: '#ffffffff' },

  
  // neutral
  edit: { bg: '#fff', border: '#111', color: '#111' },
  search: { bg: '#fff', border: '#111', color: '#111' },
  arrowRight: { bg: '#fff', border: '#111', color: '#111' },
  arrowDown: { bg: '#fff', border: '#111', color: '#111' },
  dashboard: { bg: '#fff', border: '#111', color: '#111' },
  map: { bg: '#fff', border: '#111', color: '#111' },
  sort: { bg: '#fff', border: '#111', color: '#111' },
  sortUp: { bg: '#fff', border: '#111', color: '#111' },
  sortDown: { bg: '#fff', border: '#111', color: '#111' },
  home: { bg: '#fff', border: '#111', color: '#111' },
  add: { bg: '#fff', border: '#111', color: '#111' },
  view: { bg: '#fff', border: '#111', color: '#111' },
  contact: { bg: '#fff', border: '#111', color: '#111' },
  upload: { bg: '#fff', border: '#111', color: '#111' },
  tableView: { bg: '#fff', border: '#111', color: '#111' },
  remove_user: { bg: '#fff', border: '#111', color: '#111' },
  export: { bg: '#fff', border: '#111', color: '#111' },
  info: { bg: '#fff', border: '#111', color: '#111' },
};

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  boxSize = 44,
  iconSize = ICON_PX,
  style,
  title,
  colors,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  boxSize?: number;
  iconSize?: number;
  style?: CSSProperties;
  title?: string;
  colors?: Partial<IconButtonColors>;
}) {
  const tone = { ...PER_ICON[icon], ...(colors || {}) };

  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: boxSize,
        height: boxSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        verticalAlign: 'middle',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `2px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        boxSizing: 'border-box',
        borderRadius: 0,
        ...style,
      }}
    >
      <Icon name={icon} size={iconSize} aria-hidden style={{ display: 'block' }} />
    </button>
  );
}