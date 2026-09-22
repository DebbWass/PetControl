import { buildMedicalReportHtml, daysBetween, escapeHtml } from '../medicalReportHtml';
import { FOOD_RECORD_LIMIT, MedicalReportData, ReportLabels } from '../types';

const NOW = new Date('2026-09-22T12:00:00Z');
const d = (s: string) => new Date(s);

/**
 * Stub adapter: echoes the key so assertions can look for the key itself,
 * and renders interpolations so count-bearing strings stay checkable.
 */
const labels: ReportLabels = {
  t: (key, vars) =>
    vars && Object.keys(vars).length > 0
      ? `${key}(${Object.entries(vars)
          .map(([k, v]) => `${k}=${v}`)
          .join(',')})`
      : key,
  formatDate: (d) => (d ? d.toISOString().slice(0, 10) : ''),
  formatDateTime: (d) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : ''),
  isRTL: true,
  lang: 'he',
};

function emptyData(overrides: Partial<MedicalReportData> = {}): MedicalReportData {
  return {
    pet: {
      id: 'pet1',
      name: 'Luna',
      species: 'cat',
      sex: 'female',
      birthdate: new Date('2022-03-14'),
      ageLabel: '4 years',
      isNeutered: true,
      photoDataUri: null,
      isActive: true,
      deceased: false,
      deathDate: null,
      createdAt: new Date('2022-04-02'),
    },
    familyName: 'Cohen',
    generatedAt: NOW,
    weights: [],
    medications: [],
    vaccines: [],
    treatments: [],
    appointments: [],
    food: { records: [], totalCount: 0, limit: FOOD_RECORD_LIMIT },
    documents: [],
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes every html-significant character', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    );
  });

  it('renders null and undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('daysBetween', () => {
  it('counts calendar days and is negative in the past', () => {
    expect(daysBetween(new Date('2026-09-22T23:00:00'), new Date('2026-09-23T01:00:00'))).toBe(1);
    expect(daysBetween(new Date('2026-09-22T01:00:00'), new Date('2026-09-22T23:00:00'))).toBe(0);
    expect(daysBetween(new Date('2026-09-22'), new Date('2026-09-01'))).toBe(-21);
  });
});

describe('buildMedicalReportHtml', () => {
  it('produces a complete A4 rtl document', () => {
    const html = buildMedicalReportHtml(emptyData(), labels);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('@page { size: A4 portrait;');
    expect(html.trim().endsWith('</html>')).toBe(true);
  });

  it('switches direction for english', () => {
    const html = buildMedicalReportHtml(emptyData(), { ...labels, isRTL: false, lang: 'en' });
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('lang="en"');
  });

  it('renders every section with an empty-state line when there is no data', () => {
    const html = buildMedicalReportHtml(emptyData(), labels);
    for (const key of [
      'weight.title',
      'medications.title',
      'vaccines.title',
      'treatments.title',
      'appointments.title',
      'food.title',
      'medicalFile.title',
    ]) {
      expect(html).toContain(key);
    }
    expect(html).toContain('export.empty');
  });

  it('escapes user-supplied strings', () => {
    const html = buildMedicalReportHtml(
      emptyData({ pet: { ...emptyData().pet, name: '<img src=x onerror=1>' } }),
      labels
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
  });

  it('falls back to the species emoji when there is no photo', () => {
    const html = buildMedicalReportHtml(emptyData(), labels);
    expect(html).toContain('avatar emoji');
    expect(html).not.toContain('<img class="avatar"');
  });

  it('inlines the photo when one is present', () => {
    const html = buildMedicalReportHtml(
      emptyData({ pet: { ...emptyData().pet, photoDataUri: 'data:image/jpeg;base64,AAA' } }),
      labels
    );
    expect(html).toContain('<img class="avatar" src="data:image/jpeg;base64,AAA"');
  });

  it('splits medications into active and discontinued tables', () => {
    const base = {
      dosage: '1',
      frequencyValue: 1,
      frequencyUnit: 'daily' as const,
      startDate: new Date('2026-01-01'),
      endDate: null,
      nextDueDate: new Date('2026-09-23'),
      reminderTimes: ['08:00'],
    };
    const html = buildMedicalReportHtml(
      emptyData({
        medications: [
          { id: 'm1', name: 'Thyronorm', type: 'regular', isActive: true, ...base },
          { id: 'm2', name: 'Clavamox', type: 'temporary', isActive: false, ...base, endDate: new Date('2026-05-13') },
        ],
      }),
      labels
    );
    expect(html).toContain('export.activeMedications');
    expect(html).toContain('export.pastMedications');
    expect(html).toContain('Thyronorm');
    expect(html).toContain('Clavamox');
  });

  it('omits the discontinued table when every medication is active', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        medications: [
          {
            id: 'm1',
            name: 'Thyronorm',
            type: 'regular',
            dosage: '1',
            frequencyValue: 1,
            frequencyUnit: 'daily',
            startDate: new Date('2026-01-01'),
            endDate: null,
            nextDueDate: null,
            reminderTimes: [],
            isActive: true,
          },
        ],
      }),
      labels
    );
    expect(html).toContain('export.activeMedications');
    expect(html).not.toContain('export.pastMedications');
  });

  it('flags overdue and upcoming items in the cover alerts', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        treatments: [
          {
            id: 't1',
            category: 'deworming',
            productName: 'Milbemax',
            treatmentDate: new Date('2026-06-03'),
            nextDueDate: new Date('2026-09-01'),
          },
        ],
        vaccines: [
          {
            id: 'v1',
            name: 'FVRCP',
            vaccinationDate: new Date('2025-10-18'),
            nextDueDate: new Date('2026-10-18'),
          },
        ],
      }),
      labels
    );
    expect(html).toContain('export.overdue');
    expect(html).toContain('export.overdueDays(count=21)');
    expect(html).toContain('export.upcoming30');
    expect(html).toContain('export.inDays(count=26)');
  });

  it('keeps recurring medications out of the alert boxes', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        medications: [
          {
            id: 'm1',
            name: 'Thyronorm',
            type: 'regular',
            dosage: '1',
            frequencyValue: 1,
            frequencyUnit: 'daily',
            startDate: d('2026-01-01'),
            endDate: null,
            // Due tomorrow — true of every active daily medication.
            nextDueDate: d('2026-09-23'),
            reminderTimes: ['08:00'],
            isActive: true,
          },
        ],
      }),
      labels
    );
    expect(html).not.toContain('class="alert warn"');
    expect(html).not.toContain('class="alert bad"');
    // Still present in the medications table.
    expect(html).toContain('Thyronorm');
  });

  it('omits the alert boxes when nothing is due', () => {
    const html = buildMedicalReportHtml(emptyData(), labels);
    expect(html).not.toContain('class="alert bad"');
    expect(html).not.toContain('class="alert warn"');
  });

  it('renders a weight table with per-row deltas and no chart for a single record', () => {
    const html = buildMedicalReportHtml(
      emptyData({ weights: [{ id: 'w1', weightKg: 4.3, date: new Date('2026-09-12') }] }),
      labels
    );
    expect(html).toContain('4.3');
    expect(html).not.toContain('<svg');
  });

  it('includes the chart once there are two or more weights', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        weights: [
          { id: 'w1', weightKg: 4.3, date: new Date('2026-09-12') },
          { id: 'w2', weightKg: 4.1, date: new Date('2026-08-10') },
        ],
      }),
      labels
    );
    expect(html).toContain('<svg');
    // Newest-first input: the delta against the previous reading is +0.2.
    expect(html).toContain('+0.2');
  });

  it('states the true total when food records are capped', () => {
    const records = Array.from({ length: FOOD_RECORD_LIMIT }, (_, i) => ({
      id: `f${i}`,
      foodName: 'Royal Canin',
      foodType: 'dry' as const,
      amountGrams: 45,
      feedingDate: new Date('2026-09-20'),
    }));
    const html = buildMedicalReportHtml(
      emptyData({ food: { records, totalCount: 128, limit: FOOD_RECORD_LIMIT } }),
      labels
    );
    expect(html).toContain(`export.foodRecent(shown=${FOOD_RECORD_LIMIT},total=128)`);
  });

  it('reports the plain record count when food is not capped', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        food: {
          records: [
            { id: 'f1', foodName: 'Applaws', foodType: 'wet', amountGrams: 70, feedingDate: new Date('2026-09-20') },
          ],
          totalCount: 1,
          limit: FOOD_RECORD_LIMIT,
        },
      }),
      labels
    );
    expect(html).toContain('export.recordCount(count=1)');
    expect(html).not.toContain('export.foodRecent');
  });

  it('separates scheduled appointments from history', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        appointments: [
          { id: 'a1', title: 'Annual check', scheduledDate: new Date('2026-10-05'), status: 'scheduled' },
          { id: 'a2', title: 'Urgent visit', scheduledDate: new Date('2026-05-03'), status: 'completed' },
          { id: 'a3', title: 'Nail trim', scheduledDate: new Date('2025-12-11'), status: 'cancelled' },
        ],
      }),
      labels
    );
    expect(html).toContain('export.scheduledAppointments');
    expect(html).toContain('export.pastAppointments');
  });

  it('shows an em dash rather than a blank cell for missing dates', () => {
    const html = buildMedicalReportHtml(
      emptyData({ weights: [{ id: 'w1', weightKg: 4.3, date: null }] }),
      labels
    );
    expect(html).toContain('—');
  });

  it('summarises counts across every category', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        weights: [{ id: 'w1', weightKg: 4.3, date: new Date('2026-09-12') }],
        documents: [{ id: 'd1', name: 'X-ray', fileType: 'image', uploadedAt: new Date('2026-05-03') }],
      }),
      labels
    );
    expect(html).toContain('export.summary');
    expect(html).toContain('export.dataRange');
  });

  it('marks a deceased pet in the identity block', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        pet: {
          ...emptyData().pet,
          isActive: false,
          deceased: true,
          deathDate: new Date('2026-08-01'),
        },
      }),
      labels
    );
    expect(html).toContain('pets.deceased');
  });

  it('never leaks NaN or undefined into the output', () => {
    const html = buildMedicalReportHtml(
      emptyData({
        weights: [
          { id: 'w1', weightKg: 4.3, date: new Date('2026-09-12') },
          { id: 'w2', weightKg: 4.3, date: new Date('2026-08-12') },
        ],
      }),
      labels
    );
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});
