'use client';

import * as React from 'react';
import Image from 'next/image';
import { useWorkspace } from '@/contexts/organization-context';
import {
  RiBriefcase4Fill,
  RiCheckboxCircleFill,
  RiCompass3Fill,
  RiSearchEyeFill,
} from '@remixicon/react';

import { createOnboardingOrganization } from '@/lib/onboarding-client';
import {
  multiQuestion,
  questionOptions,
  validateAnswer,
  type OnboardingQuestion,
} from '@/lib/onboarding-model';
import { requestJson } from '@/lib/request-json';
import * as Button from '@/components/ui/button';
import { DashedDivider } from '@/components/dashed-divider';

import { ChoiceGroup } from './question-choice';

type Answers = Record<string, string | string[]>;

const stepIcons = [RiBriefcase4Fill, RiSearchEyeFill, RiCompass3Fill];

function answerLabel(question: OnboardingQuestion, value: string) {
  return (
    questionOptions(question).find((option) => option.value === value)?.label ??
    value
  );
}

function previewAnswer(
  questions: OnboardingQuestion[],
  answers: Answers,
  keys: string[],
) {
  const question = questions.find((item) => keys.includes(item.question_key));
  if (!question) return '';

  const value = answers[question.question_key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => answerLabel(question, item)).join(', ');
}

export default function DatabaseOnboarding() {
  const { loading, membership, refresh } = useWorkspace();
  const [questions, setQuestions] = React.useState<OnboardingQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Answers>({});
  const [name, setName] = React.useState('');
  const [step, setStep] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [completed, setCompleted] = React.useState(false);
  const created = React.useRef(false);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    requestJson('/api/onboarding')
      .then((data) => {
        if (cancelled) return;
        const qs = data.questions as OnboardingQuestion[];
        setQuestions(qs);
        const initial: Answers = {};
        for (const answer of data.answers) {
          const question = qs.find((q) => q.id === answer.question_id);
          if (question) initial[question.question_key] = answer.answer_value;
        }
        setAnswers(initial);
        const sections = Array.from(new Set(qs.map((q) => q.section_key)));
        const first = sections.findIndex((key) =>
          qs
            .filter((q) => q.section_key === key)
            .some((q) => !validateAnswer(q, initial[q.question_key])),
        );
        setStep(first < 0 ? Math.max(0, sections.length - 1) : first);
        setCompleted(data.state?.status === 'completed');
        setReady(true);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (membership?.organization?.name) setName(membership.organization.name);
  }, [membership]);

  const sections = Array.from(new Set(questions.map((q) => q.section_key)));
  const visible = questions.filter((q) => q.section_key === sections[step]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      if (!membership && !created.current) {
        await createOnboardingOrganization(name.trim());
        created.current = true;
        await refresh();
      }
      const final = step === sections.length - 1;
      const values = Object.fromEntries(
        visible.map((question) => [
          question.question_key,
          answers[question.question_key] ?? '',
        ]),
      );
      await requestJson('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sectionKey: sections[step],
          answers: values,
          completed: final,
        }),
      });
      if (final) setCompleted(true);
      else setStep(step + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className='p-8'>
        {error ? (
          <p role='alert'>
            {error}
            <button
              className='ml-3 underline'
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </p>
        ) : (
          <p role='status'>Loading onboarding…</p>
        )}
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className='p-8' role='alert'>
        No active onboarding questions are configured.
      </div>
    );
  }

  const stage = previewAnswer(questions, answers, [
    'stage',
    'investment_stage',
  ]);
  const sectors = previewAnswer(questions, answers, [
    'sectors',
    'sector_focus',
  ]);
  const checkSize = previewAnswer(questions, answers, [
    'check_size',
    'checkSize',
  ]);
  const pace = previewAnswer(questions, answers, [
    'investments_per_year',
    'investment_pace',
  ]);
  const sourcing = previewAnswer(questions, answers, ['sourcing']);
  const thesis = previewAnswer(questions, answers, [
    'thesis_summary',
    'thesis',
    'portfolio_url',
    'thesis_url',
  ]);

  return (
    <div className='min-h-screen bg-bg-weak-50 text-text-strong-950'>
      <header className='border-b border-stroke-soft-200 bg-bg-white-0'>
        <div className='mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8'>
          <Image
            src='/images/brand/scouter-mark.webp'
            alt='Scouter'
            width={36}
            height={36}
            className='size-9 object-contain'
          />
          <div>
            <p className='text-label-md'>Set up your workspace</p>
            <p className='text-label-xs text-text-soft-400'>
              Build your Scouter investment profile
            </p>
          </div>
        </div>
      </header>

      <main className='mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-5 sm:px-6 md:gap-6 md:py-7 lg:grid-cols-[minmax(320px,3fr)_minmax(0,5fr)] lg:items-start lg:gap-8 lg:px-8 lg:py-8'>
        <aside className='grid min-w-0 gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:sticky lg:top-8 lg:grid-cols-1'>
          <StepNavigation
            completed={completed}
            pending={pending}
            questions={questions}
            sections={sections}
            step={step}
            onSelect={(index) => {
              setStep(index);
              setCompleted(false);
            }}
          />

          <InvestorPreview
            checkSize={checkSize}
            name={name}
            pace={pace}
            sectors={sectors}
            sourcing={sourcing}
            stage={stage}
            thesis={thesis}
          />
        </aside>

        <section className='min-w-0 rounded-3xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200'>
          <form
            onSubmit={save}
            className='mx-auto flex w-full max-w-[700px] flex-col gap-7 p-5 sm:p-7 md:p-9 lg:min-h-[calc(100vh-128px)] lg:justify-center lg:p-12'
          >
            <div>
              <p className='mb-2 text-label-xs text-text-soft-400'>
                Step {step + 1} of {sections.length}
              </p>
              <h1 className='text-title-h4'>
                {completed ? 'Onboarding complete' : visible[0]?.section_title}
              </h1>
            </div>
            <DashedDivider />

            {completed ? (
              <>
                <p>Your organization profile has been saved.</p>
                <Button.Root asChild>
                  <a href='/auth/continue'>Continue to workspace</a>
                </Button.Root>
              </>
            ) : (
              <>
                {step === 0 && (
                  <label className='space-y-2 text-label-md'>
                    Organization name
                    <input
                      required
                      maxLength={100}
                      disabled={!!membership || created.current}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className='block h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3'
                    />
                  </label>
                )}

                {visible.map((question) => (
                  <div key={question.id} className='space-y-3'>
                    <label
                      htmlFor={question.id}
                      className='block border-l-2 border-orange-500 pl-3 text-label-md'
                    >
                      {question.question}
                      {question.is_required ? ' *' : ''}
                    </label>
                    {questionOptions(question).length ? (
                      <ChoiceGroup
                        options={questionOptions(question)}
                        {...(multiQuestion(question)
                          ? {
                              values: (answers[question.question_key] ||
                                []) as string[],
                              onToggle: (value: string) =>
                                setAnswers((current) => {
                                  const selected = (current[
                                    question.question_key
                                  ] || []) as string[];
                                  return {
                                    ...current,
                                    [question.question_key]: selected.includes(
                                      value,
                                    )
                                      ? selected.filter(
                                          (item) => item !== value,
                                        )
                                      : [...selected, value],
                                  };
                                }),
                            }
                          : {
                              value: (answers[question.question_key] ||
                                '') as string,
                              onSelect: (value: string) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.question_key]: value,
                                })),
                            })}
                      />
                    ) : (
                      <input
                        id={question.id}
                        type={
                          ['url', 'email', 'number'].includes(
                            question.input_type,
                          )
                            ? question.input_type
                            : 'text'
                        }
                        required={question.is_required}
                        value={(answers[question.question_key] || '') as string}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.question_key]: event.target.value,
                          }))
                        }
                        maxLength={10000}
                        className='h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3'
                      />
                    )}
                  </div>
                ))}

                <div className='flex gap-3'>
                  {step > 0 && (
                    <Button.Root
                      type='button'
                      disabled={pending}
                      onClick={() => setStep(step - 1)}
                    >
                      Back
                    </Button.Root>
                  )}
                  <Button.Root
                    className='flex-1'
                    type='submit'
                    disabled={
                      pending ||
                      !name.trim() ||
                      visible.some(
                        (question) =>
                          !validateAnswer(
                            question,
                            answers[question.question_key],
                          ),
                      )
                    }
                  >
                    {pending
                      ? 'Saving…'
                      : step === sections.length - 1
                        ? 'Finish'
                        : 'Continue'}
                  </Button.Root>
                </div>
              </>
            )}

            {error && (
              <p role='alert' className='text-error-base'>
                {error}
              </p>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}

function StepNavigation({
  completed,
  onSelect,
  pending,
  questions,
  sections,
  step,
}: {
  completed: boolean;
  onSelect: (index: number) => void;
  pending: boolean;
  questions: OnboardingQuestion[];
  sections: string[];
  step: number;
}) {
  const progress = completed ? 100 : ((step + 1) / sections.length) * 100;

  return (
    <nav
      aria-label='Onboarding progress'
      className='rounded-3xl bg-bg-white-0 p-4 ring-1 ring-inset ring-stroke-soft-200 sm:p-5'
    >
      <div className='mb-4 flex items-center justify-between gap-4'>
        <div>
          <p className='text-label-md'>Your profile</p>
          <p className='mt-0.5 text-label-xs text-text-soft-400'>
            {completed
              ? 'Ready to continue'
              : `Step ${step + 1} of ${sections.length}`}
          </p>
        </div>
        <span className='text-label-sm text-orange-500'>
          {Math.round(progress)}%
        </span>
      </div>

      <div className='mb-4 h-1 overflow-hidden rounded-full bg-bg-soft-200'>
        <div
          className='h-full rounded-full bg-orange-500 transition-[width] duration-300'
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className='grid grid-cols-3 gap-2 md:grid-cols-1 lg:gap-1.5'>
        {sections.map((key, index) => {
          const current = index === step && !completed;
          const done = index < step || completed;
          const Icon = stepIcons[index] ?? RiBriefcase4Fill;

          return (
            <button
              type='button'
              disabled={pending || index > step}
              onClick={() => onSelect(index)}
              className={`flex min-w-0 items-center gap-2.5 rounded-2xl p-2.5 text-left transition-colors sm:p-3 ${
                current
                  ? 'bg-orange-50 text-text-strong-950 ring-1 ring-inset ring-orange-100'
                  : 'text-text-sub-600 hover:bg-bg-weak-50 disabled:hover:bg-transparent'
              }`}
              key={key}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  current
                    ? 'bg-orange-500 text-text-white-0'
                    : 'bg-bg-weak-50 text-text-soft-400 ring-1 ring-inset ring-stroke-soft-200'
                }`}
              >
                {done ? (
                  <RiCheckboxCircleFill className='size-4 text-success-base' />
                ) : (
                  <Icon className='size-4' />
                )}
              </span>
              <span className='min-w-0'>
                <span className='block text-label-xs text-text-soft-400'>
                  Step {index + 1}/{sections.length}
                </span>
                <span className='mt-0.5 block truncate text-label-sm'>
                  {
                    questions.find((question) => question.section_key === key)
                      ?.section_title
                  }
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function InvestorPreview({
  checkSize,
  name,
  pace,
  sectors,
  sourcing,
  stage,
  thesis,
}: {
  checkSize: string;
  name: string;
  pace: string;
  sectors: string;
  sourcing: string;
  stage: string;
  thesis: string;
}) {
  return (
    <section className='overflow-hidden rounded-3xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200'>
      <div className='border-b border-stroke-soft-200 px-5 py-4'>
        <div className='flex items-center gap-2.5'>
          <span className='flex size-9 items-center justify-center rounded-full bg-bg-weak-50 text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'>
            <RiBriefcase4Fill className='size-4.5' />
          </span>
          <div>
            <p className='text-label-md'>Investor profile preview</p>
            <p className='text-label-xs text-text-soft-400'>
              Updates as you answer
            </p>
          </div>
        </div>
      </div>

      <div className='space-y-5 p-5 sm:p-6'>
        <div>
          <p className='text-label-xs uppercase tracking-[0.08em] text-text-soft-400'>
            Fund
          </p>
          <h2 className='mt-1.5 break-words text-title-h5'>
            {name.trim() || 'Your organization'}
          </h2>
          <p className='mt-2 text-paragraph-sm text-text-sub-600'>
            {stage && sectors
              ? `${stage} investor focused on ${sectors}.`
              : stage
                ? `${stage} investor profile.`
                : sectors
                  ? `Investor focused on ${sectors}.`
                  : 'Your investment focus will appear here.'}
          </p>
        </div>

        <div className='flex flex-wrap gap-2'>
          {sectors ? (
            sectors.split(', ').map((sector) => (
              <span
                key={sector}
                className='rounded-full bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
              >
                {sector}
              </span>
            ))
          ) : (
            <span className='text-label-xs text-text-soft-400'>
              No sectors selected yet
            </span>
          )}
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <PreviewMetric label='Check size' value={checkSize || 'Not set'} />
          <PreviewMetric label='Investment pace' value={pace || 'Not set'} />
        </div>

        {sourcing && (
          <PreviewDetail label='Primary sourcing' value={sourcing} />
        )}
        {thesis && <PreviewDetail label='Thesis source' value={thesis} />}
      </div>
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 rounded-2xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200'>
      <p className='text-label-xs text-text-soft-400'>{label}</p>
      <p className='mt-1 truncate text-label-sm text-text-strong-950'>
        {value}
      </p>
    </div>
  );
}

function PreviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className='border-t border-stroke-soft-200 pt-4'>
      <p className='text-label-xs text-text-soft-400'>{label}</p>
      <p className='mt-1 break-words text-paragraph-sm text-text-sub-600'>
        {value}
      </p>
    </div>
  );
}
