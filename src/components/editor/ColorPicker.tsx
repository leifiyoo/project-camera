'use client';
import { useState } from 'react';
import { Popover } from 'radix-ui';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Button } from '@radix-ui/themes';
import { useStudio } from '@/lib/studio/store';
import { UIIcon } from './UIIcon';

const swatches = ['#ffffff', '#f6f4ed', '#e5e9ef', '#c5d8d1', '#b9cddd', '#ffdc32', '#18181b'];

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const state = useStudio.getState();
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) state.commit();
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant="soft"
          color="gray"
          className="color-trigger"
          aria-label="Choose color"
          title={value}
        >
          <span className="color-trigger-swatch" style={{ background: value }} />
          <UIIcon name="arrow" size={14} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="color-popover"
          aria-label="Color picker"
          data-studio-popup
          sideOffset={8}
          collisionPadding={12}
          onCloseAutoFocus={() => state.commit()}
        >
          <div className="popover-heading">
            <strong>Color</strong>
            <Popover.Close className="popover-close" aria-label="Close color picker">
              <UIIcon name="close" />
            </Popover.Close>
          </div>
          <div
            onPointerDownCapture={() => state.begin()}
            onPointerUpCapture={() => state.commit()}
            onPointerCancelCapture={() => state.commit()}
            onKeyDownCapture={() => state.begin()}
            onKeyUpCapture={() => state.commit()}
          >
            <HexColorPicker color={value} onChange={onChange} />
          </div>
          <div className="color-popover-swatches">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                aria-pressed={value.toLowerCase() === color}
                style={{ background: color }}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
          <HexColorInput
            className="color-hex-input"
            aria-label="Hex color"
            color={value}
            onChange={onChange}
            prefixed
            onFocus={() => state.begin()}
            onBlur={() => state.commit()}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
