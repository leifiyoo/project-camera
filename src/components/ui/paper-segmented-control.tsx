'use client';

/** Copied from coss-main/packages/ui/src/components/paper-segmented-control.tsx.
 * SPDX-License-Identifier: AGPL-3.0-or-later; see LICENSE.coss-ui.txt.
 * Local adaptations: cn import path and explanatory lint comments only.
 */

import '@fontsource/inter/400.css';

import { DirectionProvider, useDirection } from '@base-ui/react/direction-provider';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { cn } from '@/lib/utils';
import {
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

type PaperSegmentedControlSize = 'sm' | 'default' | 'lg';

interface PaperSegmentedControlOption {
  /** Unique, stable identifier. */
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Required for icon-only options. */
  'aria-label'?: string;
}

type PaperSegmentedControlStyle = CSSProperties & {
  [key: `--paper-segment-${string}`]: string | number;
};

type SelectionProps =
  | {
      multiple?: false;
      value?: string;
      defaultValue?: string;
      onValueChange?: (value: string, details: ToggleGroup.ChangeEventDetails) => void;
    }
  | {
      multiple: true;
      value?: string[];
      defaultValue?: string[];
      onValueChange?: (value: string[], details: ToggleGroup.ChangeEventDetails) => void;
    };

type PaperSegmentedControlProps = Omit<
  ComponentProps<'div'>,
  'children' | 'defaultValue' | 'onChange' | 'style' | 'dir'
> &
  SelectionProps & {
    options: readonly PaperSegmentedControlOption[];
    size?: PaperSegmentedControlSize;
    orientation?: 'horizontal' | 'vertical';
    fullWidth?: boolean;
    disabled?: boolean;
    /** Permit clearing the last selection. Does not select an initial option. */
    allowEmpty?: boolean;
    animated?: boolean;
    loopFocus?: boolean;
    dir?: 'ltr' | 'rtl';
    style?: PaperSegmentedControlStyle;
  };

interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const sizes: Record<PaperSegmentedControlSize, string> = {
  sm: '[--paper-segment-item-height:24px] [--paper-segment-item-padding:6px]',
  default: '[--paper-segment-item-height:28px] [--paper-segment-item-padding:8px]',
  lg: '[--paper-segment-item-height:44px] [--paper-segment-item-padding:12px]',
};

function toValues(value: string | string[] | undefined): string[] {
  return typeof value === 'string' ? (value ? [value] : []) : (value ?? []);
}

function PaperSegmentedControl(props: PaperSegmentedControlProps): ReactElement {
  const {
    options,
    size = 'default',
    orientation = 'horizontal',
    fullWidth = false,
    disabled = false,
    allowEmpty = false,
    animated = true,
    loopFocus = true,
    multiple = false,
    value,
    defaultValue,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Strip the callback from the forwarded DOM props, as in the original.
    onValueChange: _onValueChange,
    className,
    style,
    ref,
    dir,
    ...rootProps
  } = props;
  const inheritedDirection = useDirection();
  const direction = dir ?? inheritedDirection;
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(() => toValues(defaultValue));
  const selectedValues = value === undefined ? internalValue : toValues(value);
  const selectedValue = multiple ? undefined : selectedValues[0];
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);
  const hasSelection = options.some((option) => option.value === selectedValue);

  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- The original measures after every render; the unchanged-rectangle guard prevents repeated updates.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || multiple || !selectedValue) {
      setIndicator(null);
      return;
    }

    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-slot=paper-segment]'));
    const selected = items.find((item) => item.dataset.value === selectedValue);
    if (!selected) {
      setIndicator(null);
      return;
    }

    function measure(): void {
      if (!selected) return;
      const next = {
        height: selected.offsetHeight,
        left: selected.offsetLeft,
        top: selected.offsetTop,
        width: selected.offsetWidth,
      };
      setIndicator((previous) =>
        previous &&
        Object.keys(next).every(
          (key) => previous[key as keyof IndicatorRect] === next[key as keyof IndicatorRect],
        )
          ? previous
          : next,
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const item of items) observer.observe(item);
    return (): void => observer.disconnect();
  });

  function handleValueChange(next: string[], details: ToggleGroup.ChangeEventDetails): void {
    if (!allowEmpty && selectedValues.length > 0 && next.length === 0) {
      details.cancel();
      return;
    }
    if (props.multiple) {
      props.onValueChange?.(next, details);
    } else {
      props.onValueChange?.(next[0] ?? '', details);
    }
    if (!details.isCanceled && value === undefined) setInternalValue(next);
  }

  const indicatorReady = !multiple && hasSelection && indicator !== null;

  return (
    <DirectionProvider direction={direction}>
      <ToggleGroup
        {...rootProps}
        className={cn(
          'relative isolate inline-flex max-w-full items-center justify-start overflow-x-auto rounded-[var(--paper-segment-radius)] bg-[var(--paper-segment-background)] p-[var(--paper-segment-inset)] font-normal text-sm leading-5 antialiased [font-family:var(--paper-segment-font)] [font-synthesis:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          '[--paper-segment-active:#ffffff0d] [--paper-segment-background:#262626] [--paper-segment-focus:#fafafa] [--paper-segment-font:Inter,system-ui,sans-serif] [--paper-segment-foreground:#fafafa] [--paper-segment-inner-radius:max(0px,calc(var(--paper-segment-radius)-var(--paper-segment-inset)))] [--paper-segment-inset:4px] [--paper-segment-muted:#fafafab3] [--paper-segment-radius:14px]',
          sizes[size],
          fullWidth ? 'flex w-full' : 'w-fit',
          orientation === 'vertical' && 'flex-col',
          disabled && 'opacity-50',
          className,
        )}
        data-animated={animated}
        data-indicator-ready={indicatorReady || undefined}
        data-size={size}
        data-slot="paper-segmented-control"
        dir={direction}
        disabled={disabled}
        loopFocus={loopFocus}
        multiple={multiple}
        onValueChange={handleValueChange}
        orientation={orientation}
        ref={rootRef}
        style={style}
        value={selectedValues}
      >
        {indicatorReady && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-0 left-0 rounded-[var(--paper-segment-inner-radius)] bg-[var(--paper-segment-active)]',
              animated &&
                'transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
            )}
            data-slot="paper-segment-indicator"
            style={{
              height: indicator.height,
              transform: `translate(${indicator.left}px, ${indicator.top}px)`,
              width: indicator.width,
            }}
          />
        )}
        {options.map((option) => (
          <Toggle
            aria-label={option['aria-label']}
            className={cn(
              'relative inline-flex h-[var(--paper-segment-item-height)] shrink-0 grow basis-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--paper-segment-inner-radius)] px-[var(--paper-segment-item-padding)] text-[var(--paper-segment-muted)] outline-none hover:text-[var(--paper-segment-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--paper-segment-focus)] focus-visible:-outline-offset-2 disabled:cursor-not-allowed data-pressed:text-[var(--paper-segment-foreground)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              'data-pressed:bg-[var(--paper-segment-active)] in-data-[indicator-ready]:data-pressed:bg-transparent',
              animated && 'transition-colors duration-200 motion-reduce:transition-none',
              size === 'lg' && 'min-w-max',
              orientation === 'vertical' && 'w-full basis-auto',
              option.disabled && !disabled && 'opacity-40',
            )}
            data-slot="paper-segment"
            data-value={option.value}
            disabled={option.disabled}
            key={option.value}
            type="button"
            value={option.value}
          >
            {option.icon && (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {option.icon}
              </span>
            )}
            {option.label}
          </Toggle>
        ))}
      </ToggleGroup>
    </DirectionProvider>
  );
}

export {
  PaperSegmentedControl,
  type PaperSegmentedControlOption,
  type PaperSegmentedControlProps,
  type PaperSegmentedControlSize,
  type PaperSegmentedControlStyle,
};
