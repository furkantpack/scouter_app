'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAtom } from 'jotai';

import { cn } from '@/utils/cn';

import { activeStepAtom, ADD_PRODUCT_STEPS } from './store-steps';

export default function AddProductSidebar() {
  const [activeStep, setActiveStep] = useAtom(activeStepAtom);

  return (
    <div className='hidden w-[262px] shrink-0 flex-col gap-16 px-9 py-10 lg:flex'>
      <img
        src='/images/brand/scouter-mark.webp'
        alt='Scouter'
        className='size-10 object-contain'
      />

      <div className='relative flex w-full flex-1 flex-col gap-9 pt-4'>
        <div
          className='absolute right-[-2px] h-14 w-0.5 bg-orange-500 transition-all'
          style={{
            top: 16 + activeStep * 44 + activeStep * 51,
            transitionTimingFunction: 'cubic-bezier(.6,.6,0,1)',
            transitionDuration: '.45s',
          }}
        />
        {ADD_PRODUCT_STEPS.map(({ label, index }) => {
          const isCompleted = activeStep > index;
          const isCurrent = activeStep === index;

          return (
            <button
              key={label}
              type='button'
              disabled={index > activeStep}
              onClick={() => setActiveStep(index)}
              className={cn(
                'flex w-full flex-col gap-1 text-left',
                'focus:outline-none',
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-1.5 text-paragraph-md font-medium text-text-soft-400',
                  'transition-colors duration-200 ease-out',
                  {
                    'text-orange-500': isCurrent,
                    'text-text-sub-600': isCompleted,
                  },
                )}
              >
                Step {index + 1}/{ADD_PRODUCT_STEPS.length}
                <AnimatePresence initial={false} mode='popLayout'>
                  {isCompleted && (
                    <motion.svg
                      key='check-icon'
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0,
                      }}
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
              </div>
              <div
                className={cn(
                  'text-paragraph-md text-text-sub-600',
                  'transition-colors duration-200 ease-out',
                  {
                    'text-text-strong-950': isCurrent || isCompleted,
                  },
                )}
              >
                {label}
              </div>
            </button>
          );
        })}
      </div>

      <div className='text-paragraph-sm text-text-soft-400'>© 2026 Scouter</div>
    </div>
  );
}
