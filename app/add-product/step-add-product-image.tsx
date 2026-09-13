'use client';

import * as React from 'react';
import * as LabelPrimitives from '@radix-ui/react-label';
import { RiCompass3Fill } from '@remixicon/react';
import { useAtomValue, useSetAtom } from 'jotai';

import * as Button from '@/components/ui/button';
import { DashedDivider } from '@/components/dashed-divider';
import * as Input from '@/components/ui/input';

import {
  investorOnboardingAtom,
  updateInvestorAnswerAtom,
} from './store-investor-onboarding';
import { nextStepAtom } from './store-steps';
import { saveOnboardingStep } from '@/lib/onboarding-client';

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function StepAddProductImage() {
  const answers = useAtomValue(investorOnboardingAtom);
  const updateAnswer = useSetAtom(updateInvestorAnswerAtom);
  const goToNextStep = useSetAtom(nextStepAtom);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const canContinue = isValidUrl(answers.thesisUrl.trim());

  return (
    <div className='mx-auto flex w-full max-w-[620px] flex-col gap-5 md:gap-8'>
      <div className='flex w-full flex-col gap-6'>
        <RiCompass3Fill className='size-7 text-orange-500' />
        <div>
          <div className='text-title-h5 text-text-strong-950'>Your Thesis</div>
          <div className='mt-2 text-paragraph-md text-text-sub-600'>
            Sana ozel skor icin
          </div>
        </div>
      </div>

      <DashedDivider />

      <div className='flex flex-col gap-8'>
        <div className='flex flex-col gap-3'>
          <LabelPrimitives.Root
            htmlFor='thesis-url'
            className='border-l-2 border-orange-500 pl-3 text-label-md font-semibold text-text-strong-950'
          >
            Add your portfolio URL
          </LabelPrimitives.Root>
          <Input.Root>
            <Input.Wrapper>
              <Input.Input
                id='thesis-url'
                type='url'
                inputMode='url'
                placeholder='https://yourportfolio.com'
                value={answers.thesisUrl}
                onChange={(event) =>
                  updateAnswer({
                    key: 'thesisUrl',
                    value: event.target.value,
                  })
                }
                required
              />
            </Input.Wrapper>
          </Input.Root>
          <p className='text-paragraph-sm text-text-sub-600'>
            Enter a URL only. We’ll generate your thesis.
          </p>
        </div>
      </div>

      {error && <p className='text-paragraph-sm text-error-base'>{error}</p>}
      <Button.Root
        disabled={!canContinue || pending}
        onClick={async () => {
          if (pending) return;
          setPending(true); setError('');
          try {
            await saveOnboardingStep(4, { 8: answers.thesisUrl }, true);
            goToNextStep();
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save answer.'); }
          finally { setPending(false); }
        }}
        className='w-full'
      >
        {pending ? 'Saving…' : 'Continue'}
      </Button.Root>
    </div>
  );
}
