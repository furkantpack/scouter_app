import { atom } from 'jotai';

export type InvestorOnboardingAnswers = {
  organizationName: string;
  stage: string;
  sectors: string[];
  checkSize: string;
  investmentsPerYear: string;
  sourcing: string;
  frustration: string;
  signals: string[];
  thesisUrl: string;
};

export const investorOnboardingAtom = atom<InvestorOnboardingAnswers>({
  organizationName: '',
  stage: '',
  sectors: [],
  checkSize: '',
  investmentsPerYear: '',
  sourcing: '',
  frustration: '',
  signals: [],
  thesisUrl: '',
});

export const updateInvestorAnswerAtom = atom(
  null,
  (
    get,
    set,
    update: {
      key: keyof InvestorOnboardingAnswers;
      value: string | string[];
    },
  ) => {
    set(investorOnboardingAtom, {
      ...get(investorOnboardingAtom),
      [update.key]: update.value,
    });
  },
);

export const toggleInvestorMultiAnswerAtom = atom(
  null,
  (
    get,
    set,
    update: {
      key: 'sectors' | 'signals';
      value: string;
    },
  ) => {
    const answers = get(investorOnboardingAtom);
    const current = answers[update.key];

    set(investorOnboardingAtom, {
      ...answers,
      [update.key]: current.includes(update.value)
        ? current.filter((item) => item !== update.value)
        : [...current, update.value],
    });
  },
);
