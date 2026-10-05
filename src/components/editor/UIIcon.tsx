'use client';
import {
  IconChevronDown,
  IconChevronUp,
  IconBorderAll,
  IconX,
  IconCheck,
  IconArrowsMove,
  IconFocus2,
  IconHelpCircle,
  IconPhoto,
  IconStack2,
  IconDots,
  IconPaint,
  IconRotate,
  IconSettingsFilled,
  IconTarget,
  IconZoomInArea,
} from '@tabler/icons-react';

const icons = {
  arrow: IconChevronDown,
  arrowUp: IconChevronUp,
  surface: IconBorderAll,
  close: IconX,
  check: IconCheck,
  move: IconArrowsMove,
  focus: IconFocus2,
  help: IconHelpCircle,
  image: IconPhoto,
  layers: IconStack2,
  more: IconDots,
  color: IconPaint,
  rotation: IconRotate,
  settings: IconSettingsFilled,
  point: IconTarget,
  zoom: IconZoomInArea,
};
export type UIIconName = keyof typeof icons;
export function UIIcon({ name, size = 16 }: { name: UIIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} stroke={1.8} aria-hidden="true" />;
}
