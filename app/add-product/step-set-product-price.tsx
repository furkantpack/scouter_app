'use client';

import * as React from 'react';
import * as LabelPrimitives from '@radix-ui/react-label';
import { RiSearchEyeFill } from '@remixicon/react';
import { useAtomValue, useSetAtom } from 'jotai';

import * as Button from '@/components/ui/button';
import { DashedDivider } from '@/components/dashed-divider';

import { ChoiceGroup } from './question-choice';
import {
  investorOnboardingAtom,
  toggleInvestorMultiAnswerAtom,
  updateInvestorAnswerAtom,
} from './store-investor-onboarding';
import { nextStepAtom } from './store-steps';
import { saveOnboardingStep } from '@/lib/onboarding-client';

const sourcing = [
  { value: 'warm-intros', label: 'Warm intros' },
  { value: 'events', label: 'Events' },
  { value: 'cold-outreach', label: 'Cold outreach' },
  { value: 'databases', label: 'Databases' },
  { value: 'founders-find-me', label: "I don't - they find me" },
];

const frustrations = [
  { value: 'too-late', label: 'Too late to deals' },
  { value: 'too-much-noise', label: 'Too much noise' },
  { value: 'no-warm-path', label: 'No warm path' },
  { value: 'weak-signal-quality', label: 'Weak signal quality' },
];

const signals = [
  { value: 'prior-exit', label: 'Prior exit' },
  { value: 'big-tech-background', label: 'Big tech background' },
  { value: 'top-university', label: 'Top university' },
  { value: 'stealth-filing', label: 'Stealth filing' },
  { value: 'layoff', label: 'Layoff' },
  { value: 'serial-founder', label: 'Serial founder' },
];

export default function StepSetProductPrice() {
  const answers = useAtomValue(investorOnboardingAtom);
  const updateAnswer = useSetAtom(updateInvestorAnswerAtom);
  const toggleMulti = useSetAtom(toggleInvestorMultiAnswerAtom);
  const goToNextStep = useSetAtom(nextStepAtom);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const canContinue =
    answers.sourcing && answers.frustration && answers.signals.length > 0;

  return (
    <div className='mx-auto flex w-full max-w-[620px] flex-col gap-5 md:gap-8'>
      <div className='flex w-full flex-col gap-6'>
        <RiSearchEyeFill className='size-7 text-orange-500' />
        <div>
          <div className='text-title-h5 text-text-strong-950'>
            Your Sourcing
          </div>
          <div className='mt-2 text-paragraph-md text-text-sub-600'>
            Su an nasil buluyorsun
          </div>
        </div>
      </div>

      <DashedDivider />

      <div className='flex flex-col gap-8'>
        <Question label='How do you currently find founders before they raise?'>
          <ChoiceGroup
            options={sourcing}
            value={answers.sourcing}
            onSelect={(value) => updateAnswer({ key: 'sourcing', value })}
          />
        </Question>

        <Question label="What's your biggest sourcing frustration?">
          <ChoiceGroup
            options={frustrations}
            value={answers.frustration}
            onSelect={(value) => updateAnswer({ key: 'frustration', value })}
          />
        </Question>

        <Question label='Which signals matter most to you?'>
          <ChoiceGroup
            options={signals}
            values={answers.signals}
            onToggle={(value) => toggleMulti({ key: 'signals', value })}
          />
        </Question>
      </div>

      {error && <p className='text-paragraph-sm text-error-base'>{error}</p>}
      <Button.Root
        disabled={!canContinue || pending}
        onClick={async () => {
          if (pending) return;
          setPending(true); setError('');
          try {
            await saveOnboardingStep(3, {
              5: answers.sourcing,
              6: answers.frustration,
              7: answers.signals,
            });
            goToNextStep();
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save answers.'); }
          finally { setPending(false); }
        }}
        className='w-full'
      >
        {pending ? 'Saving…' : 'Continue'}
      </Button.Root>
    </div>
  );
}

function Question({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-col gap-3'>
      <LabelPrimitives.Root className='border-l-2 border-orange-500 pl-3 text-label-md font-semibold text-text-strong-950'>
        {label}
      </LabelPrimitives.Root>
      {children}
    </div>
  );
}
