'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/utils/cn';

type StepItem = { key: string; label: string };

export default function AddProductSidebar({
  activeStep,
  completed,
  disabled,
  onSelect,
  steps,
}: {
  activeStep: number;
  completed: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
  steps: StepItem[];
}) {
  return (
    <aside className='hidden w-[262px] shrink-0 flex-col gap-16 px-9 py-10 lg:flex'>
      <Image
        src='/images/brand/scouter-mark.webp'
        alt='Scouter'
        width={40}
        height={40}
        className='size-10 object-contain'
      />

      <nav
        aria-label='Onboarding steps'
        className='relative flex w-full flex-1 flex-col gap-9 pt-4'
      >
        {!completed && (
          <div
            className='absolute right-[-2px] h-14 w-0.5 bg-orange-500 transition-all'
            style={{
              top: 16 + activeStep * 95,
              transitionTimingFunction: 'cubic-bezier(.6,.6,0,1)',
              transitionDuration: '.45s',
            }}
          />
        )}

        {steps.map(({ key, label }, index) => {
          const isCompleted = completed || activeStep > index;
          const isCurrent = !completed && activeStep === index;

          return (
            <button
              key={key}
              type='button'
              disabled={disabled || index > activeStep}
              onClick={() => onSelect(index)}
              className='flex w-full flex-col gap-1 text-left focus:outline-none'
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 text-paragraph-md font-medium text-text-soft-400 transition-colors duration-200 ease-out',
                  {
                    'text-orange-500': isCurrent,
                    'text-text-sub-600': isCompleted,
                  },
                )}
              >
                Step {index + 1}/{steps.length}
                <AnimatePresence initial={false} mode='popLayout'>
                  {isCompleted && (
                    <motion.svg
                      key='check-icon'
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{
                        type: 'spring',
                        duration: 0.3,
                        bounce: 0.23,
                      }}
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 14 14'
                      className='size-3.5 shrink-0 origin-center text-success-base'
                    >
                      <path
                        fill='currentColor'
                        d='M7 14A7 7 0 117 0a7 7 0 010 14zm-.698-4.2l4.95-4.95-.99-.99-3.96 3.96-1.98-1.98-.99.99 2.97 2.97z'
                      />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </span>
              <span
                className={cn(
                  'text-paragraph-md text-text-sub-600 transition-colors duration-200 ease-out',
                  { 'text-text-strong-950': isCurrent || isCompleted },
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className='text-paragraph-sm text-text-soft-400'>© 2026 Scouter</div>
    </aside>
  );
}
