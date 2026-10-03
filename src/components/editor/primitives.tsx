'use client';
import {
  useEffect,
  useRef,
  useState,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type HTMLAttributes,
  type PointerEvent,
} from 'react';
import { X } from 'lucide-react';
import { IconButton as RadixIconButton, TextField } from '@radix-ui/themes';
import { Slider, Select as RadixSelect } from 'radix-ui';
import { UIIcon, type UIIconName } from './UIIcon';
import { useStudio } from '@/lib/studio/store';
export function IconButton({
  label,
  children,
  active = false,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <RadixIconButton
      type="button"
      variant="ghost"
      color="gray"
      className={`icon-button${active ? ' active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      {children}
    </RadixIconButton>
  );
}
export function Panel({
  title,
  children,
  onClose,
  wide = false,
  side = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  side?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusable = () =>
      el
        ? [
            ...el.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]',
            ),
          ].filter((element) => element.getClientRects().length > 0 && element.checkVisibility())
        : [];
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !document.querySelector('[data-studio-popup]')
      ) {
        onClose();
        e.stopPropagation();
      }
      if (e.key === 'Tab' && el) {
        const focus = focusable();
        const first = focus[0],
          last = focus.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className={`panel ${wide ? 'wide' : ''} ${side ? 'side-panel' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      ref={ref}
    >
      <div className="panel-head">
        <h2>{title}</h2>
        <IconButton label={`Close ${title}`} onClick={onClose}>
          <X size={17} />
        </IconButton>
      </div>
      <div className="panel-content">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  labelProps,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  labelProps?: HTMLAttributes<HTMLSpanElement>;
}) {
  return (
    <div className="field">
      <span {...labelProps}>{label}</span>
      {Children.map(children, (child) =>
        isValidElement<{
          'aria-label'?: string;
          onFocus?: React.FocusEventHandler<HTMLElement>;
          onBlur?: React.FocusEventHandler<HTMLElement>;
        }>(child)
          ? cloneElement(child, {
              'aria-label': child.props['aria-label'] || label,
              onFocus: (e) => {
                if (typeof child.type === 'string' && ['input', 'textarea'].includes(child.type))
                  useStudio.getState().begin();
                child.props.onFocus?.(e);
              },
              onBlur: (e) => {
                child.props.onBlur?.(e);
                if (typeof child.type === 'string' && ['input', 'textarea'].includes(child.type))
                  useStudio.getState().commit();
              },
            })
          : child,
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit,
  scrub = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  scrub?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; value: number; active: boolean } | null>(null);
  const pointerHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!scrub || event.button !== 0) return;
      drag.current = { x: event.clientX, y: event.clientY, value, active: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.currentTarget.tagName !== 'INPUT') event.preventDefault();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current) return;
      const dx = event.clientX - current.x,
        dy = event.clientY - current.y;
      if (!current.active && Math.hypot(dx, dy) < 3) return;
      if (!current.active) {
        useStudio.getState().begin();
        current.active = true;
      }
      event.preventDefault();
      setDraft(null);
      const next = Math.round((current.value + (dx - dy) * step * 5) / step) * step;
      onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next)));
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.active) {
        event.preventDefault();
        useStudio.getState().commit();
      }
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => {
      if (drag.current?.active) useStudio.getState().commit();
      drag.current = null;
    },
    onLostPointerCapture: () => {
      if (drag.current?.active) useStudio.getState().commit();
      drag.current = null;
    },
  };
  return (
    <Field
      label={label}
      labelProps={
        scrub
          ? { ...pointerHandlers, className: 'scrub-label', title: 'Drag to adjust' }
          : undefined
      }
    >
      <div className={`number-field${scrub ? ' scrubbable-number' : ''}`}>
        <TextField.Root
          {...(scrub ? pointerHandlers : {})}
          type="number"
          variant="soft"
          color="gray"
          onFocus={() => useStudio.getState().begin()}
          onBlur={() => {
            setDraft(null);
            useStudio.getState().commit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label={label}
          value={draft ?? Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            useStudio.getState().begin();
            setDraft(e.target.value);
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n))
              onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
          }}
        >
          {unit && (
            <TextField.Slot side="right">
              <span>{unit}</span>
            </TextField.Slot>
          )}
        </TextField.Root>
      </div>
    </Field>
  );
}
export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  unit = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const begin = useStudio((s) => s.begin),
    commit = useStudio((s) => s.commit);
  return (
    <Field label={label}>
      <div className="range-row">
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
        <Slider.Root
          className="studio-slider rt-SliderRoot rt-r-size-1"
          min={min}
          max={max}
          step={step}
          value={[value]}
          onPointerDown={begin}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyDown={(event) => {
            if (
              [
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'Home',
                'End',
                'PageUp',
                'PageDown',
              ].includes(event.key)
            )
              begin();
          }}
          onKeyUp={commit}
          onBlur={commit}
          onValueChange={([next]) => {
            begin();
            onChange(next);
          }}
          onValueCommit={commit}
        >
          <Slider.Track className="rt-SliderTrack">
            <Slider.Range className="rt-SliderRange" />
          </Slider.Track>
          <Slider.Thumb className="rt-SliderThumb" aria-label={label} />
        </Slider.Root>
      </div>
    </Field>
  );
}

const EMPTY_OPTION = '__studio_empty_option__';

export function Select({
  value,
  onValueChange,
  children,
  'aria-label': label,
  ...props
}: ComponentProps<typeof RadixSelect.Root> & { 'aria-label'?: string }) {
  return (
    <RadixSelect.Root
      {...props}
      value={value || EMPTY_OPTION}
      onValueChange={(next) => onValueChange?.(next === EMPTY_OPTION ? '' : next)}
    >
      <RadixSelect.Trigger className="studio-select" aria-label={label}>
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <UIIcon name="arrow" size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="studio-select-menu paper-menu"
          data-studio-popup
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <RadixSelect.ScrollUpButton className="menu-scroll-button">
            <UIIcon name="arrowUp" size={12} />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="paper-menu-viewport">{children}</RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="menu-scroll-button">
            <UIIcon name="arrow" size={12} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectOption({
  value,
  children,
  icon = 'settings',
  ...props
}: ComponentProps<typeof RadixSelect.Item> & { icon?: UIIconName }) {
  return (
    <RadixSelect.Item {...props} className="paper-menu-item" value={value || EMPTY_OPTION}>
      <UIIcon name={icon} />
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="paper-menu-check">
        <UIIcon name="check" size={14} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}
