/** Keep progressive disclosure independent of the form view. */
export function normalizedB2BMobile(phone: string): string {
  return phone.replace(/\D/g, "")
    .replace(/^90(?=5\d{9}$)/, "")
    .replace(/^0(?=5\d{9}$)/, "");
}

export type RegistrationProgressValues = {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyCategory: string;
  taxNumber: string;
  taxValid: boolean;
  taxChecking: boolean;
};

/** Each completed field unlocks the next; the tax office is auto-populated if possible. */
export function registrationStepReadiness(values: RegistrationProgressValues): boolean[] {
  return [
    values.companyName.trim().length >= 2,
    values.firstName.trim().length >= 2,
    values.lastName.trim().length >= 2,
    /^\S+@\S+\.\S+$/.test(values.email.trim()),
    /^5\d{9}$/.test(normalizedB2BMobile(values.phone)),
    Boolean(values.companyCategory),
    values.taxNumber.length === 10 && values.taxValid && !values.taxChecking,
  ];
}
