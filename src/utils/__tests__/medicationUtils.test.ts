import { calcMedicationNextDue, calcVaccineNextDue } from '../medicationUtils';

/** Helper: construct a local-time date to avoid DST-related UTC offsets. */
const local = (year: number, month: number, day: number, hour = 8) =>
  new Date(year, month - 1, day, hour, 0, 0, 0);

describe('calcMedicationNextDue', () => {
  const base = local(2024, 1, 10); // Jan 10 2024 08:00 local

  it('returns null for as_needed', () => {
    expect(calcMedicationNextDue(base, 1, 'as_needed')).toBeNull();
  });

  it('adds 8 hours correctly', () => {
    const result = calcMedicationNextDue(base, 8, 'hours');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0); // January
    expect(result!.getDate()).toBe(10);
    expect(result!.getHours()).toBe(16);
  });

  it('adds 1 day correctly', () => {
    const result = calcMedicationNextDue(base, 1, 'daily');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(11);
    expect(result!.getHours()).toBe(8);
  });

  it('adds 2 weeks correctly', () => {
    const result = calcMedicationNextDue(base, 2, 'weekly');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(24);
  });

  it('adds 3 months correctly', () => {
    const result = calcMedicationNextDue(base, 3, 'monthly');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(3); // April (0-indexed)
    expect(result!.getDate()).toBe(10);
  });

  it('returns null for unknown frequency unit', () => {
    // @ts-expect-error – testing invalid input
    expect(calcMedicationNextDue(base, 1, 'unknown')).toBeNull();
  });
});

describe('calcVaccineNextDue', () => {
  const vacDate = local(2024, 3, 1, 0); // March 1 2024 00:00 local

  it('returns null when intervalDays is 0', () => {
    expect(calcVaccineNextDue(vacDate, 0)).toBeNull();
  });

  it('adds 365 days for annual vaccine', () => {
    const result = calcVaccineNextDue(vacDate, 365);
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(1);
  });

  it('adds 30 days for monthly treatment', () => {
    const result = calcVaccineNextDue(vacDate, 30);
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(31);
  });
});
