'use client';

import * as React from 'react';
import * as LabelPrimitives from '@radix-ui/react-label';
import { RiBriefcase4Fill } from '@remixicon/react';
import { useAtomValue, useSetAtom } from 'jotai';

import * as Button from '@/components/ui/button';
import * as Input from '@/components/ui/input';
import { DashedDivider } from '@/components/dashed-divider';
import { useWorkspace } from '@/contexts/organization-context';

import { ChoiceGroup } from './question-choice';
import {
  investorOnboardingAtom,
  toggleInvestorMultiAnswerAtom,
  updateInvestorAnswerAtom,
} from './store-investor-onboarding';
import { nextStepAtom } from './store-steps';
import {
  createOnboardingOrganization,
  saveOnboardingStep,
} from '@/lib/onboarding-client';

const stages = [
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'all-stages', label: 'All stages' },
];

const sectors = [
  { value: 'ai', label: 'AI' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'deep-tech', label: 'Deep Tech' },
  { value: 'climate', label: 'Climate' },
  { value: 'saas', label: 'SaaS' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'sector-agnostic', label: 'Sector Agnostic' },
  { value: 'other', label: 'Other' },
];

const checkSizes = [
  { value: '25k-100k', label: '$25K-$100K' },
  { value: '100k-500k', label: '$100K-$500K' },
  { value: '500k-2m', label: '$500K-$2M' },
  { value: '2m-plus', label: '$2M+' },
];

const investmentsPerYear = [
  { value: '1-5', label: '1-5' },
  { value: '5-15', label: '5-15' },
  { value: '15-30', label: '15-30' },
  { value: '30-plus', label: '30+' },
];

export default function StepAddProductDetails() {
  const answers = useAtomValue(investorOnboardingAtom);
  const updateAnswer = useSetAtom(updateInvestorAnswerAtom);
  const toggleMulti = useSetAtom(toggleInvestorMultiAnswerAtom);
  const goToNextStep = useSetAtom(nextStepAtom);
  const { membership, refresh } = useWorkspace();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const existingName = membership?.organization?.name;
    if (existingName && !answers.organizationName) {
      updateAnswer({ key: 'organizationName', value: existingName });
    }
  }, [answers.organizationName, membership, updateAnswer]);

  const canContinue =
    answers.organizationName.trim() &&
    answers.stage &&
    answers.sectors.length > 0 &&
    answers.checkSize &&
    answers.investmentsPerYear;

  return (
    <div className='mx-auto flex w-full max-w-[620px] flex-col gap-7 md:gap-9'>
      <div className='flex w-full flex-col gap-7'>
        <RiBriefcase4Fill className='size-7 text-orange-500' />
        <div>
          <div className='text-title-h4 text-text-strong-950'>Your Fund</div>
          <div className='mt-3 text-paragraph-lg text-text-sub-600'>
            Seni taniyalim
          </div>
        </div>
      </div>

      <DashedDivider />

      <div className='flex flex-col gap-8'>
        <div className='flex flex-col gap-3'>
          <LabelPrimitives.Root
            htmlFor='organization-name'
            className='border-l-2 border-orange-500 pl-3 text-label-md font-semibold text-text-strong-950'
          >
            Organization name
          </LabelPrimitives.Root>
          <Input.Root>
            <Input.Wrapper>
              <Input.Input
                id='organization-name'
                value={answers.organizationName}
                placeholder='First Round Capital'
                onChange={(event) =>
                  updateAnswer({
                    key: 'organizationName',
                    value: event.target.value,
                  })
                }
                required
              />
            </Input.Wrapper>
          </Input.Root>
        </div>

        <Question label='What stage do you primarily invest in?'>
          <ChoiceGroup
            options={stages}
            value={answers.stage}
            onSelect={(value) => updateAnswer({ key: 'stage', value })}
          />
        </Question>

        <Question label='Which sectors are you most active in?'>
          <ChoiceGroup
            options={sectors}
            values={answers.sectors}
            onToggle={(value) => toggleMulti({ key: 'sectors', value })}
          />
        </Question>

        <Question label="What's your typical check size?">
          <ChoiceGroup
            options={checkSizes}
            value={answers.checkSize}
            onSelect={(value) => updateAnswer({ key: 'checkSize', value })}
          />
        </Question>

        <Question label='How many new investments do you make per year?'>
          <ChoiceGroup
            options={investmentsPerYear}
            value={answers.investmentsPerYear}
            onSelect={(value) =>
              updateAnswer({ key: 'investmentsPerYear', value })
            }
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
            if (!membership) {
              await createOnboardingOrganization(
                answers.organizationName.trim(),
              );
              await refresh();
            }
            await saveOnboardingStep(2, {
              1: answers.stage,
              2: answers.sectors,
              3: answers.checkSize,
              4: answers.investmentsPerYear,
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
