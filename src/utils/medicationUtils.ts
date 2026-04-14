import { addHours, addDays, addWeeks, addMonths } from 'date-fns';
import { FrequencyUnit } from '../types';

/**
 * Calculate the next due date for a medication based on its frequency.
 * Returns null for 'as_needed' medications.
 */
export function calcMedicationNextDue(
  start: Date,
  frequencyValue: number,
  frequencyUnit: FrequencyUnit
): Date | null {
  switch (frequencyUnit) {
    case 'as_needed':
      return null;
    case 'hours':
      return addHours(start, frequencyValue);
    case 'daily':
      return addDays(start, frequencyValue);
    case 'weekly':
      return addWeeks(start, frequencyValue);
    case 'monthly':
      return addMonths(start, frequencyValue);
    default:
      return null;
  }
}

/**
 * Calculate the next due date for a vaccine based on an interval in days.
 * Returns null when intervalDays is 0 (user must enter manually).
 */
export function calcVaccineNextDue(
  vaccinationDate: Date,
  intervalDays: number
): Date | null {
  if (intervalDays === 0) return null;
  return addDays(vaccinationDate, intervalDays);
}
