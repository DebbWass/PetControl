export interface CommonVaccine {
  nameHe: string;
  nameEn: string;
  intervalDays: number; // 0 = no auto-fill, user enters manually
}

export const COMMON_VACCINES: CommonVaccine[] = [
  { nameHe: 'כלבת',         nameEn: 'Rabies',        intervalDays: 365 },
  { nameHe: 'FVRCP (חתולים)', nameEn: 'FVRCP (Cats)', intervalDays: 365 },
  { nameHe: 'DHPPiL (כלבים)', nameEn: 'DHPPiL (Dogs)',intervalDays: 365 },
  { nameHe: 'לפטוספירוזיס', nameEn: 'Leptospirosis', intervalDays: 365 },
  { nameHe: 'בורדטלה',      nameEn: 'Bordetella',    intervalDays: 180 },
  { nameHe: 'אחר',          nameEn: 'Other',         intervalDays: 0   },
];
