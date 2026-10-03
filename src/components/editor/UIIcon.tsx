'use client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BorderAll01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CursorMove01Icon,
  FocusPointIcon,
  HelpCircleIcon,
  Image01Icon,
  Layers01Icon,
  MoreHorizontalIcon,
  PaintBucketIcon,
  Rotate01Icon,
  Settings01Icon,
  Target01Icon,
  ZoomInAreaIcon,
} from '@hugeicons/core-free-icons';

const icons = {
  arrow: ArrowDown01Icon,
  arrowUp: ArrowUp01Icon,
  surface: BorderAll01Icon,
  close: Cancel01Icon,
  check: CheckmarkCircle02Icon,
  move: CursorMove01Icon,
  focus: FocusPointIcon,
  help: HelpCircleIcon,
  image: Image01Icon,
  layers: Layers01Icon,
  more: MoreHorizontalIcon,
  color: PaintBucketIcon,
  rotation: Rotate01Icon,
  settings: Settings01Icon,
  point: Target01Icon,
  zoom: ZoomInAreaIcon,
};
export type UIIconName = keyof typeof icons;
export function UIIcon({ name, size = 16 }: { name: UIIconName; size?: number }) {
  return <HugeiconsIcon icon={icons[name]} size={size} strokeWidth={1.7} aria-hidden="true" />;
}
