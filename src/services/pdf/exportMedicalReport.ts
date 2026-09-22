/**
 * Orchestrates the medical-file PDF export:
 * gather data → build HTML → render A4 PDF → share / print.
 *
 * `expo-print`, `expo-sharing` and `expo-file-system` are native modules, so a
 * dev client built before they were installed will not have them. They are
 * required lazily (same pattern as `expo-document-picker` in
 * `app/pet/[id]/medical-file.tsx`) so the screen can show a clear message
 * instead of crashing on import.
 */
import { format } from 'date-fns';
import { Pet } from '../../types';
import { collectMedicalReportData } from './medicalReportData';
import { buildMedicalReportHtml } from './medicalReportHtml';
import { MedicalReportData, ReportLabels } from './types';

/** A4 portrait in PostScript points — `printToFileAsync` defaults to US Letter. */
export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

let Print: any = null;
let Sharing: any = null;
let FS: any = null;
try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
  FS = require('expo-file-system/legacy');
} catch {
  // Left null – `isExportAvailable()` reports the gap.
}

export function isExportAvailable(): boolean {
  return !!Print?.printToFileAsync;
}

export interface MedicalReportResult {
  /** Local file URI of the generated PDF. */
  uri: string;
  fileName: string;
  /** Kept so "Print" can re-render without re-reading Firestore. */
  html: string;
  data: MedicalReportData;
}

/** Filesystem-safe filename fragment; keeps Hebrew letters, drops path chars. */
export function slugify(name: string): string {
  return (name || 'pet')
    .trim()
    .replace(/[\\/:*?"<>|.]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'pet';
}

export function buildReportFileName(petName: string, when: Date): string {
  return `medical-file_${slugify(petName)}_${format(when, 'yyyy-MM-dd')}.pdf`;
}

/**
 * Renders the report to a PDF in the cache directory and returns its URI.
 * The file `printToFileAsync` produces has a random name, so it is copied to a
 * readable one — Android's share sheet shows the filename to the recipient.
 */
export async function generateMedicalReport(
  familyId: string,
  pet: Pet,
  labels: ReportLabels
): Promise<MedicalReportResult> {
  if (!isExportAvailable()) {
    throw new Error('EXPORT_MODULE_MISSING');
  }

  const data = await collectMedicalReportData(familyId, pet);
  const html = buildMedicalReportHtml(data, labels);

  const { uri } = await Print.printToFileAsync({
    html,
    width: A4_WIDTH_PT,
    height: A4_HEIGHT_PT,
    base64: false,
  });

  const fileName = buildReportFileName(pet.name, data.generatedAt);
  let finalUri = uri;

  if (FS?.cacheDirectory && typeof FS.copyAsync === 'function') {
    try {
      const target = `${FS.cacheDirectory}${fileName}`;
      // A same-day re-export would otherwise hit an existing file.
      await FS.deleteAsync(target, { idempotent: true }).catch(() => undefined);
      await FS.copyAsync({ from: uri, to: target });
      finalUri = target;
      FS.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    } catch (err) {
      // Keep the original cache file – only the filename is degraded.
      console.warn('[exportMedicalReport] rename failed', err);
    }
  }

  return { uri: finalUri, fileName, html, data };
}

export async function canShare(): Promise<boolean> {
  try {
    return !!Sharing && (await Sharing.isAvailableAsync());
  } catch {
    return false;
  }
}

export async function shareMedicalReport(uri: string, dialogTitle: string): Promise<void> {
  if (!Sharing) throw new Error('EXPORT_MODULE_MISSING');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
}

/**
 * Opens Android's native print dialog. Prints from the HTML rather than the
 * generated file because `printAsync({ uri })` is not supported on Android.
 */
export async function printMedicalReport(html: string): Promise<void> {
  if (!Print?.printAsync) throw new Error('EXPORT_MODULE_MISSING');
  await Print.printAsync({ html, width: A4_WIDTH_PT, height: A4_HEIGHT_PT });
}
