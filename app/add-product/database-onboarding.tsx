'use client';

import * as React from 'react';
import { useWorkspace } from '@/contexts/organization-context';

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

import PreviewCard from './preview-card';
import { ChoiceGroup } from './question-choice';
import AddProductSidebar from './sidebar';

type Answers = Record<string, string | string[]>;

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
        const sectionKeys = Array.from(new Set(qs.map((q) => q.section_key)));
        const first = sectionKeys.findIndex((key) =>
          qs
            .filter((q) => q.section_key === key)
            .some((q) => !validateAnswer(q, initial[q.question_key])),
        );
        setStep(first < 0 ? Math.max(0, sectionKeys.length - 1) : first);
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

  const stepItems = sections.map((key) => ({
    key,
    label:
      questions.find((question) => question.section_key === key)
        ?.section_title ?? key,
  }));
  const selectStep = (index: number) => {
    setStep(index);
    setCompleted(false);
  };
  const preview = {
    organizationName: name,
    stage: previewAnswer(questions, answers, ['stage', 'investment_stage']),
    sectors: previewAnswer(questions, answers, ['sectors', 'sector_focus']),
    checkSize: previewAnswer(questions, answers, ['check_size', 'checkSize']),
    investmentsPerYear: previewAnswer(questions, answers, [
      'investments_per_year',
      'investment_pace',
    ]),
    sourcing: previewAnswer(questions, answers, ['sourcing']),
    signals: previewAnswer(questions, answers, ['signals', 'founder_signals']),
    thesisUrl: previewAnswer(questions, answers, [
      'portfolio_url',
      'thesis_url',
      'thesis_summary',
      'thesis',
    ]),
  };

  return (
    <div className='flex min-h-screen bg-bg-white-0'>
      <AddProductSidebar
        activeStep={step}
        completed={completed}
        disabled={pending}
        onSelect={selectStep}
        steps={stepItems}
      />

      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='border-b border-stroke-soft-200 px-4 py-3 lg:hidden'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='text-label-xs text-orange-500'>
                Step {step + 1}/{sections.length}
              </p>
              <p className='text-label-md text-text-strong-950'>
                {stepItems[step]?.label}
              </p>
            </div>
            <p className='text-label-sm text-text-soft-400'>
              {Math.round(
                ((completed ? sections.length : step + 1) / sections.length) *
                  100,
              )}
              %
            </p>
          </div>
          <div className='mt-3 h-1 overflow-hidden rounded-full bg-bg-soft-200'>
            <div
              className='h-full bg-orange-500 transition-[width] duration-300'
              style={{
                width: `${((completed ? sections.length : step + 1) / sections.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className='flex min-w-0 flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,550px)_minmax(0,1fr)]'>
          <div className='relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-2xl bg-bg-weak-50 p-6 sm:p-10 xl:m-2 xl:min-h-[calc(100vh-16px)]'>
            <PreviewCard answers={preview} />
          </div>

          <form
            onSubmit={save}
            className='mx-auto flex w-full max-w-[700px] flex-col justify-center gap-7 p-6 lg:p-12'
          >
            <h1 className='text-title-h4'>
              {completed ? 'Onboarding complete' : visible[0]?.section_title}
            </h1>
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
        </div>
      </div>
    </div>
  );
}
