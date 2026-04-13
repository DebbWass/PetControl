import { Species } from '../types';

export interface SpeciesInfo {
  key: Species;
  labelHe: string;
  labelEn: string;
  emoji: string;
  defaultNextDewormingDays: number;
  defaultNextFleaTreatmentDays: number;
}

export const SPECIES_LIST: SpeciesInfo[] = [
  { key: 'cat', labelHe: 'חתול', labelEn: 'Cat', emoji: '🐱', defaultNextDewormingDays: 90, defaultNextFleaTreatmentDays: 30 },
  { key: 'dog', labelHe: 'כלב', labelEn: 'Dog', emoji: '🐶', defaultNextDewormingDays: 90, defaultNextFleaTreatmentDays: 30 },
  { key: 'rabbit', labelHe: 'ארנב', labelEn: 'Rabbit', emoji: '🐰', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 30 },
  { key: 'hamster', labelHe: 'אוגר', labelEn: 'Hamster', emoji: '🐹', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'guinea_pig', labelHe: 'שרקן ים', labelEn: 'Guinea Pig', emoji: '🐾', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'chinchilla', labelHe: "צ'ינצ'ילה", labelEn: 'Chinchilla', emoji: '🐭', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'gerbil', labelHe: 'גרביל', labelEn: 'Gerbil', emoji: '🐭', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'rat', labelHe: 'עכבר בית', labelEn: 'Rat', emoji: '🐀', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'mouse', labelHe: 'עכבר', labelEn: 'Mouse', emoji: '🐁', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 60 },
  { key: 'parrot', labelHe: 'תוכי', labelEn: 'Parrot', emoji: '🦜', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 0 },
  { key: 'canary', labelHe: 'קנרית', labelEn: 'Canary', emoji: '🐤', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 0 },
  { key: 'cockatiel', labelHe: 'קקטיאל', labelEn: 'Cockatiel', emoji: '🦜', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 0 },
  { key: 'budgie', labelHe: 'תוכון', labelEn: 'Budgie', emoji: '🦜', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 0 },
  { key: 'other_bird', labelHe: 'ציפור אחרת', labelEn: 'Other Bird', emoji: '🐦', defaultNextDewormingDays: 180, defaultNextFleaTreatmentDays: 0 },
  { key: 'snake', labelHe: 'נחש', labelEn: 'Snake', emoji: '🐍', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'lizard', labelHe: 'לטאה', labelEn: 'Lizard', emoji: '🦎', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'turtle', labelHe: 'צב', labelEn: 'Turtle', emoji: '🐢', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'chameleon', labelHe: 'זיקית', labelEn: 'Chameleon', emoji: '🦎', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'gecko', labelHe: "גקו'", labelEn: 'Gecko', emoji: '🦎', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'other_reptile', labelHe: 'זוחל אחר', labelEn: 'Other Reptile', emoji: '🐊', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'goldfish', labelHe: 'דג זהב', labelEn: 'Goldfish', emoji: '🐟', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'tropical_fish', labelHe: 'דג טרופי', labelEn: 'Tropical Fish', emoji: '🐠', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'other_fish', labelHe: 'דג אחר', labelEn: 'Other Fish', emoji: '🐡', defaultNextDewormingDays: 0, defaultNextFleaTreatmentDays: 0 },
  { key: 'ferret', labelHe: 'פרט', labelEn: 'Ferret', emoji: '🦡', defaultNextDewormingDays: 90, defaultNextFleaTreatmentDays: 30 },
  { key: 'hedgehog', labelHe: 'קיפוד', labelEn: 'Hedgehog', emoji: '🦔', defaultNextDewormingDays: 90, defaultNextFleaTreatmentDays: 30 },
  { key: 'other', labelHe: 'אחר', labelEn: 'Other', emoji: '🐾', defaultNextDewormingDays: 90, defaultNextFleaTreatmentDays: 30 },
];

export const SPECIES_MAP = Object.fromEntries(
  SPECIES_LIST.map((s) => [s.key, s])
) as Record<Species, SpeciesInfo>;
