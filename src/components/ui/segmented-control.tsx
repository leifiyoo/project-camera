'use client';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type SegmentedControlOption = {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Required when `label` is empty, e.g. for icon-only options. */
  'aria-label'?: string;
};

type Indicator = { left: number; top: number; width: number; height: number };

const NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/** Single-choice radio group with a sliding selection indicator. Styled in studio.css. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  size = 'default',
  fullWidth = false,
  disabled = false,
  className,
  'aria-label': label,
}: {
  options: readonly SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'default';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled);

  useLayoutEffect(() => {
    const element = root.current;
    const selected = element?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!element || !selected) {
      setIndicator(null);
      return;
    }
    const measure = () =>
      setIndicator((previous) => {
        const next = {
          left: selected.offsetLeft,
          top: selected.offsetTop,
          width: selected.offsetWidth,
          height: selected.offsetHeight,
        };
        return previous &&
          previous.left === next.left &&
          previous.top === next.top &&
          previous.width === next.width &&
          previous.height === next.height
          ? previous
          : next;
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [value, options]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    if (!NAVIGATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));
    if (!enabled.length) return;
    const position = enabled.indexOf(from);
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled[enabled.length - 1]
          : enabled[(position + step + enabled.length) % enabled.length];
    if (options[next].value !== value) onValueChange(options[next].value);
    root.current?.querySelectorAll<HTMLButtonElement>('[data-slot="segment"]')[next]?.focus();
  };

  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={className}
      data-slot="segmented-control"
      data-size={size}
      data-full-width={fullWidth || undefined}
      data-indicator-ready={indicator ? '' : undefined}
    >
      {indicator && (
        <span
          aria-hidden="true"
          data-slot="segment-indicator"
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
          }}
        />
      )}
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          data-slot="segment"
          aria-checked={option.value === value}
          aria-label={option['aria-label']}
          disabled={disabled || option.disabled}
          tabIndex={index === focusIndex ? 0 : -1}
          onClick={() => option.value !== value && onValueChange(option.value)}
          onKeyDown={(event) => move(event, index)}
        >
          {option.icon && (
            <span aria-hidden="true" className="segment-icon">
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
