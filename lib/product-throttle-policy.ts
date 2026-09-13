export const PRODUCT_ACTION_LIMITS = {
  network_analysis: {
    userCooldownSeconds: 60,
    organizationCooldownSeconds: 20,
    maxConcurrentOrganization: 2,
    leaseSeconds: 45 * 60,
  },
  funded_company_analysis: {
    userCooldownSeconds: 60,
    organizationCooldownSeconds: 20,
    maxConcurrentOrganization: 2,
    leaseSeconds: 2 * 60 * 60,
  },
  thesis_generation: {
    userCooldownSeconds: 120,
    organizationCooldownSeconds: 30,
    maxConcurrentOrganization: 1,
    leaseSeconds: 45 * 60,
  },
  funded_instant_refresh: {
    userCooldownSeconds: 20,
    organizationCooldownSeconds: 10,
    maxConcurrentOrganization: 2,
    leaseSeconds: 5 * 60,
  },
  cohort_fit_test: {
    userCooldownSeconds: 20,
    organizationCooldownSeconds: 10,
    maxConcurrentOrganization: 1,
    leaseSeconds: 2 * 60,
  },
} as const;

export type ProductActionType = keyof typeof PRODUCT_ACTION_LIMITS;
