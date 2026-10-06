'use client';
import type { ReactNode } from 'react';

type Choice<T extends string> = { value: T; label: string; icon?: ReactNode };

/** Radio capsules for workspace preferences. */
export function ChoiceCapsules<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Choice<T>[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="choice-capsules">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (index +
                      (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : options.length - 1)) %
                    options.length;
            onChange(options[next].value);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('button')
              [next]?.focus();
          }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
