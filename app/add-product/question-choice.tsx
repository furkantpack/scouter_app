import * as React from 'react';
import { RiCheckLine } from '@remixicon/react';

import { cn } from '@/utils/cn';

export type ChoiceOption = {
  value: string;
  label: string;
};

export function ChoiceGroup({
  options,
  value,
  values,
  onSelect,
  onToggle,
}: {
  options: ChoiceOption[];
  value?: string;
  values?: string[];
  onSelect?: (value: string) => void;
  onToggle?: (value: string) => void;
}) {
  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      {options.map((option) => {
        const selected = values
          ? values.includes(option.value)
          : value === option.value;

        return (
          <button
            key={option.value}
            type='button'
            onClick={() =>
              values ? onToggle?.(option.value) : onSelect?.(option.value)
            }
            className={cn(
              'relative min-h-11 rounded-xl border px-3 py-2 pr-9 text-left text-paragraph-sm transition-all',
              selected
                ? 'border-orange-500 bg-orange-50 text-text-strong-950 shadow-regular-xs'
                : 'border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 hover:bg-bg-weak-50',
            )}
          >
            {option.label}
            {selected && (
              <span className='absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-orange-500'>
                <RiCheckLine className='size-3 text-static-white' />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
