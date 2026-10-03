'use client';
import { useState } from 'react';
import { Button, Theme } from '@radix-ui/themes';
import { DropdownMenu, Popover } from 'radix-ui';
import type { Asset } from '@/lib/studio/model';
import Inspector, { type InspectorKind, type MediaTarget } from './Inspector';
import { UIIcon, type UIIconName } from './UIIcon';

export type CanvasTool = 'move' | 'rotate' | 'point' | 'focus';

export default function QuickAccessBar({
  assets,
  onImport,
  onPickFocus,
  tool,
  onToolChange,
  onLayers,
  onFit,
  onReset,
  disabled,
}: {
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onLayers: () => void;
  onFit: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState<InspectorKind | null>(null);
  const controls: { kind: InspectorKind; label: string; icon: UIIconName | null }[] = [
    { kind: 'focus', label: 'Focus settings', icon: 'arrow' },
    { kind: 'zoom', label: 'Zoom', icon: 'zoom' },
    { kind: 'rotation', label: 'Rotation', icon: null },
    { kind: 'background', label: 'Background', icon: 'color' },
  ];
  return (
    <div className="stage-tools quick-access-bar" role="toolbar" aria-label="Canvas quick access">
      <Button
        className={`quick-control${tool === 'move' ? ' active' : ''} quick-icon-only`}
        variant="ghost"
        color="gray"
        aria-label="Move surface"
        title="Move surface"
        disabled={disabled}
        onClick={() => {
          setOpen(null);
          onToolChange('move');
        }}
      >
        <UIIcon name="move" size={18} />
      </Button>
      <span className="tool-divider" />
      <Button
        className={`quick-control${tool === 'focus' ? ' active' : ''}`}
        variant="ghost"
        color="gray"
        aria-label="Focus"
        title="Choose a focus point on the canvas"
        disabled={disabled}
        onClick={() => {
          setOpen(null);
          onPickFocus();
        }}
      >
        <UIIcon name="focus" size={18} />
        <span>Focus</span>
      </Button>
      {controls.map(({ kind, label, icon }) => (
        <Popover.Root
          key={kind}
          open={open === kind}
          onOpenChange={(next) => setOpen(next ? kind : null)}
        >
          <Popover.Trigger asChild>
            <Button
              className={`quick-control${kind === 'focus' ? ' quick-focus-settings quick-icon-only' : ''}${open === kind || (kind === 'rotation' && tool === 'rotate') ? ' active' : ''}`}
              variant="ghost"
              color="gray"
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => {
                if (kind === 'rotation') onToolChange('rotate');
              }}
            >
              {icon && <UIIcon name={icon} size={kind === 'focus' ? 12 : 18} />}
              {kind !== 'focus' && (
                <span className={kind === 'rotation' ? 'quick-rotation-label' : undefined}>
                  {label}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Theme asChild accentColor="blue" grayColor="gray" radius="large">
              <Popover.Content
                className="control-popover"
                data-studio-popup
                aria-label={`${label} controls`}
                side="top"
                align="center"
                sideOffset={12}
                collisionPadding={12}
              >
                <div className="popover-heading">
                  <strong>{kind === 'focus' ? 'Focus' : label}</strong>
                  <Popover.Close className="popover-close" aria-label={`Close ${label}`}>
                    <UIIcon name="close" />
                  </Popover.Close>
                </div>
                <Inspector
                  kind={kind}
                  compact
                  assets={assets}
                  onImport={onImport}
                  onPickFocus={() => {
                    setOpen(null);
                    onPickFocus();
                  }}
                />
              </Popover.Content>
            </Theme>
          </Popover.Portal>
        </Popover.Root>
      ))}
      <span className="tool-divider" />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            color="gray"
            className="quick-control quick-icon-only"
            disabled={disabled}
            aria-label="More canvas controls"
            title="More canvas controls"
          >
            <UIIcon name="more" size={19} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="paper-menu"
            data-studio-popup
            align="end"
            side="top"
            sideOffset={12}
            collisionPadding={12}
          >
            <DropdownMenu.Item className="paper-menu-item" onSelect={onFit}>
              <UIIcon name="zoom" />
              <span>Fit to frame</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="paper-menu-item" onSelect={onReset}>
              <UIIcon name="move" />
              <span>Reset view</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="paper-menu-separator" />
            <DropdownMenu.Item
              className="paper-menu-item"
              onSelect={() => {
                setOpen(null);
                onToolChange('point');
              }}
            >
              <UIIcon name="point" />
              <span>Mark a detail for animation</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="paper-menu-item" onSelect={onLayers}>
              <UIIcon name="layers" />
              <span>Layers and scene settings</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
