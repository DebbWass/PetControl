/**
 * Builds the A4 HTML document for the medical-file PDF export.
 *
 * Pure TypeScript — no react-native / expo imports — so it runs under jest's
 * node environment. All locale-dependent behaviour arrives through the
 * injected `ReportLabels` adapter.
 *
 * Print notes (Android WebView / Chromium print engine):
 *  - `<thead>` rows repeat automatically when a table spans pages.
 *  - `position: fixed` elements repeat on every page — used for the footer.
 *  - CSS `@page` margin boxes and `counter(page)` are NOT supported, so the
 *    footer carries no page numbers.
 */
import { SPECIES_MAP } from '../../constants/species';
import { buildWeightChartSvg, canRenderWeightChart } from './weightChartSvg';
import {
  MedicalReportData,
  ReportAppointment,
  ReportDocument,
  ReportFood,
  ReportLabels,
  ReportMedication,
  ReportTreatment,
  ReportVaccine,
  ReportWeight,
} from './types';

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Every user-supplied string must pass through this before interpolation. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DASH = '—';

function txt(value: string | undefined | null): string {
  const s = (value ?? '').trim();
  return s === '' ? DASH : escapeHtml(s);
}

/**
 * `formatDate`/`formatDateTime` return '' for a missing date — the report
 * shows an em dash instead of a blank cell.
 */
function orDash(formatted: string): string {
  const s = (formatted ?? '').trim();
  return s === '' ? DASH : escapeHtml(s);
}

function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return DASH;
  return Number(value.toFixed(digits)).toString();
}

function signed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return DASH;
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`;
}

type PillTone = 'ok' | 'warn' | 'bad' | 'neutral';

function pill(label: string, tone: PillTone = 'neutral'): string {
  return `<span class="pill p-${tone}">${escapeHtml(label)}</span>`;
}

/** Whole days from `now` to `date`; negative when overdue. */
export function daysBetween(from: Date, to: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS);
}

/**
 * Due-date pill, matching the thresholds used on the vaccines screen
 * (`app/pet/[id]/vaccines.tsx`): overdue → danger, ≤30 days → warning,
 * otherwise success. A record with no next-due date is "historic".
 */
function duePill(due: Date | null, now: Date, L: ReportLabels): string {
  if (!due) return pill(L.t('export.historic'), 'neutral');
  const d = daysBetween(now, due);
  if (d < 0) return pill(L.t('export.overdueDays', { count: Math.abs(d) }), 'bad');
  if (d === 0) return pill(L.t('export.today'), 'warn');
  if (d <= 30) return pill(L.t('export.inDays', { count: d }), 'warn');
  return pill(L.t('export.inDays', { count: d }), 'ok');
}

interface Column {
  label: string;
  width?: string;
}

function table(columns: Column[], rows: string[][], extraClass = ''): string {
  const head = columns
    .map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${escapeHtml(c.label)}</th>`)
    .join('');
  const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="tb ${extraClass}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sectionHead(title: string, meta?: string): string {
  return `<div class="sech"><b>${escapeHtml(title)}</b>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</div>`;
}

function emptyLine(L: ReportLabels): string {
  return `<p class="empty">${escapeHtml(L.t('export.empty'))}</p>`;
}

function tile(label: string, value: string, sub?: string, tone?: 'ok' | 'warn' | 'bad'): string {
  const subClass = tone ? ` class="sub tone-${tone}"` : ' class="sub"';
  return (
    `<div class="tile"><div class="tlabel">${escapeHtml(label)}</div>` +
    `<div class="tval">${value}</div>` +
    (sub ? `<div${subClass}>${escapeHtml(sub)}</div>` : '') +
    '</div>'
  );
}

// ─── Label lookups ────────────────────────────────────────────────────────────

function speciesLabel(data: MedicalReportData, L: ReportLabels): string {
  const info = SPECIES_MAP[data.pet.species];
  if (!info) return escapeHtml(data.pet.species);
  return escapeHtml(L.lang === 'he' ? info.labelHe : info.labelEn);
}

function sexLabel(sex: string, L: ReportLabels): string {
  if (sex === 'male') return L.t('pets.male');
  if (sex === 'female') return L.t('pets.female');
  return L.t('pets.unknown');
}

function medTypeTone(type: string): PillTone {
  if (type === 'regular') return 'ok';
  if (type === 'temporary') return 'warn';
  return 'neutral';
}

function apptTone(status: string): PillTone {
  if (status === 'completed') return 'ok';
  if (status === 'cancelled') return 'bad';
  return 'neutral';
}

function frequencyLabel(m: ReportMedication, L: ReportLabels): string {
  const unit = L.t(`medications.${m.frequencyUnit}`);
  if (m.frequencyUnit === 'as_needed') return unit;
  return `${unit} ×${m.frequencyValue}`;
}

function dosageLabel(m: ReportMedication, L: ReportLabels): string {
  const unit = m.dosageUnit ? L.t(`medications.${m.dosageUnit}`) : '';
  return txt([m.dosage, unit].filter(Boolean).join(' '));
}

function amountLabel(f: ReportFood, L: ReportLabels): string {
  const unit = f.amountUnit ? L.t(`food.${f.amountUnit}`) : L.t('food.gram');
  return `${num(f.amountGrams, 0)} ${escapeHtml(unit)}`;
}

function docTypeLabel(type: string, L: ReportLabels): string {
  if (type === 'image') return L.t('export.docTypeImage');
  if (type === 'pdf') return L.t('export.docTypePdf');
  return L.t('export.docTypeOther');
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function buildIdentity(data: MedicalReportData, L: ReportLabels): string {
  const { pet } = data;
  const birth = pet.birthdate
    ? `${orDash(L.formatDate(pet.birthdate))}${pet.ageLabel ? ` · ${escapeHtml(L.t('export.age'))} ${escapeHtml(pet.ageLabel)}` : ''}`
    : DASH;

  const statusParts: string[] = [];
  if (pet.deceased) {
    statusParts.push(L.t('pets.deceased') + (pet.deathDate ? ` · ${L.formatDate(pet.deathDate)}` : ''));
  } else {
    statusParts.push(pet.isActive ? L.t('pets.active') : L.t('pets.inactive'));
  }
  if (pet.createdAt) {
    statusParts.push(`${L.t('export.createdAt')} ${L.formatDate(pet.createdAt)}`);
  }

  const row = (l1: string, v1: string, l2?: string, v2?: string) =>
    `<tr><td class="k">${escapeHtml(l1)}</td><td>${v1}</td>` +
    (l2 !== undefined
      ? `<td class="k">${escapeHtml(l2)}</td><td>${v2 ?? DASH}</td>`
      : '<td class="k"></td><td></td>') +
    '</tr>';

  return (
    sectionHead(L.t('export.identity')) +
    '<table class="tb kv"><tbody>' +
    row(L.t('pets.species'), speciesLabel(data, L), L.t('pets.breed'), txt(pet.breed)) +
    row(L.t('pets.sex'), escapeHtml(sexLabel(pet.sex, L)), L.t('pets.birthdate'), birth) +
    row(L.t('pets.color'), txt(pet.color), L.t('pets.isNeutered'), escapeHtml(pet.isNeutered ? L.t('common.yes') : L.t('common.no'))) +
    `<tr><td class="k">${escapeHtml(L.t('pets.microchip'))}</td><td colspan="3" class="mono">${txt(pet.microchipNumber)}</td></tr>` +
    `<tr><td class="k">${escapeHtml(L.t('export.status'))}</td><td colspan="3">${escapeHtml(statusParts.join(' · '))}</td></tr>` +
    '</tbody></table>'
  );
}

function buildSnapshot(data: MedicalReportData, L: ReportLabels): string {
  const now = data.generatedAt;
  const tiles: string[] = [];

  // Latest weight + delta against the previous reading.
  const weights = data.weights;
  if (weights.length > 0) {
    const latest = weights[0];
    const prev = weights[1];
    const delta = prev ? latest.weightKg - prev.weightKg : null;
    tiles.push(
      tile(
        L.t('export.latestWeight'),
        `${num(latest.weightKg)} <span class="unit">${escapeHtml(L.t('weight.kg'))}</span>`,
        delta === null ? L.formatDate(latest.date) : `${signed(delta)} ${L.t('weight.kg')}`,
        delta === null ? undefined : delta > 0 ? 'ok' : delta < 0 ? 'bad' : undefined
      )
    );
  } else {
    tiles.push(tile(L.t('export.latestWeight'), DASH, L.t('export.none')));
  }

  const activeMeds = data.medications.filter((m) => m.isActive);
  tiles.push(
    tile(
      L.t('export.activeMeds'),
      String(activeMeds.length),
      L.t('export.ofTotal', { count: data.medications.length })
    )
  );

  // Soonest future vaccine due date.
  const nextVac = data.vaccines
    .filter((v) => v.nextDueDate)
    .sort((a, b) => (a.nextDueDate as Date).getTime() - (b.nextDueDate as Date).getTime())[0];
  if (nextVac) {
    const d = daysBetween(now, nextVac.nextDueDate as Date);
    tiles.push(
      tile(
        L.t('export.nextVaccine'),
        orDash(L.formatDate(nextVac.nextDueDate)),
        d < 0 ? L.t('export.overdueDays', { count: Math.abs(d) }) : L.t('export.inDays', { count: d }),
        d < 0 ? 'bad' : d <= 30 ? 'warn' : 'ok'
      )
    );
  } else {
    tiles.push(tile(L.t('export.nextVaccine'), DASH, L.t('export.none')));
  }

  const nextAppt = data.appointments
    .filter((a) => a.status === 'scheduled' && a.scheduledDate && (a.scheduledDate as Date) >= now)
    .sort((a, b) => (a.scheduledDate as Date).getTime() - (b.scheduledDate as Date).getTime())[0];
  if (nextAppt) {
    tiles.push(
      tile(
        L.t('export.nextAppointment'),
        orDash(L.formatDate(nextAppt.scheduledDate)),
        [nextAppt.veterinarian, nextAppt.clinic].filter(Boolean).join(' · ') || nextAppt.title
      )
    );
  } else {
    tiles.push(tile(L.t('export.nextAppointment'), DASH, L.t('export.none')));
  }

  return (
    sectionHead(L.t('export.snapshot'), L.t('export.asOf', { date: L.formatDate(now) })) +
    `<div class="tiles t4">${tiles.join('')}</div>`
  );
}

interface AlertItem {
  label: string;
  due: Date;
}

function collectAlerts(data: MedicalReportData): { overdue: AlertItem[]; soon: AlertItem[] } {
  const now = data.generatedAt;
  const items: AlertItem[] = [];

  for (const v of data.vaccines) {
    if (v.nextDueDate) items.push({ label: `${v.name}`, due: v.nextDueDate });
  }
  for (const t of data.treatments) {
    if (t.nextDueDate) items.push({ label: `${t.productName}`, due: t.nextDueDate });
  }
  for (const a of data.appointments) {
    if (a.status === 'scheduled' && a.scheduledDate) items.push({ label: a.title, due: a.scheduledDate });
  }
  // Medications are deliberately excluded: a recurring daily dose is always
  // "due tomorrow", which would drown out the items that need attention. The
  // next dose for each active medication is in the medications table instead.

  const overdue = items.filter((i) => daysBetween(now, i.due) < 0).sort((a, b) => a.due.getTime() - b.due.getTime());
  const soon = items
    .filter((i) => {
      const d = daysBetween(now, i.due);
      return d >= 0 && d <= 30;
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  return { overdue, soon };
}

function buildAlerts(data: MedicalReportData, L: ReportLabels): string {
  const { overdue, soon } = collectAlerts(data);
  const now = data.generatedAt;
  const parts: string[] = [];

  if (overdue.length > 0) {
    const lines = overdue
      .map((i) => {
        const d = Math.abs(daysBetween(now, i.due));
        return `· ${escapeHtml(i.label)} · ${orDash(L.formatDate(i.due))} · ${escapeHtml(L.t('export.overdueDays', { count: d }))}`;
      })
      .join('<br>');
    parts.push(
      `<div class="alert bad"><div class="atitle">${escapeHtml(L.t('export.overdue'))}</div><div class="abody">${lines}</div></div>`
    );
  }

  if (soon.length > 0) {
    const lines = soon
      .map((i) => {
        const d = daysBetween(now, i.due);
        const when = d === 0 ? L.t('export.today') : L.t('export.inDays', { count: d });
        return `· ${escapeHtml(i.label)} · ${orDash(L.formatDate(i.due))} · ${escapeHtml(when)}`;
      })
      .join('<br>');
    parts.push(
      `<div class="alert warn"><div class="atitle">${escapeHtml(L.t('export.upcoming30'))}</div><div class="abody">${lines}</div></div>`
    );
  }

  return parts.join('');
}

function buildCover(data: MedicalReportData, L: ReportLabels): string {
  const { pet } = data;
  const info = SPECIES_MAP[pet.species];
  const avatar = pet.photoDataUri
    ? `<img class="avatar" src="${pet.photoDataUri}" alt="">`
    : `<div class="avatar emoji">${escapeHtml(info?.emoji ?? '\u{1F43E}')}</div>`;

  const chips: string[] = [pill(sexLabel(pet.sex, L))];
  if (pet.ageLabel) chips.push(pill(pet.ageLabel));
  if (pet.isNeutered) chips.push(pill(L.t('pets.isNeutered')));
  chips.push(
    pet.deceased
      ? pill(L.t('pets.deceased'), 'neutral')
      : pill(pet.isActive ? L.t('pets.active') : L.t('pets.inactive'), pet.isActive ? 'ok' : 'neutral')
  );

  const contents = [
    L.t('export.identity'),
    L.t('weight.title'),
    L.t('medications.title'),
    L.t('vaccines.title'),
    L.t('treatments.title'),
    L.t('appointments.title'),
    L.t('food.title'),
    L.t('medicalFile.title'),
  ].join(' · ');

  return (
    '<section class="page cover">' +
    '<div class="idcard">' +
    avatar +
    '<div class="idmain">' +
    `<div class="pname">${escapeHtml(pet.name)}</div>` +
    `<div class="psub">${speciesLabel(data, L)}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''}</div>` +
    `<div class="chips">${chips.join('')}</div>` +
    '</div>' +
    '<div class="idside">' +
    `<div class="slabel">${escapeHtml(L.t('export.petId'))}</div><div class="mono svalue">${escapeHtml(pet.id)}</div>` +
    (data.familyName
      ? `<div class="slabel">${escapeHtml(L.t('export.family'))}</div><div class="svalue">${escapeHtml(data.familyName)}</div>`
      : '') +
    '</div></div>' +
    buildIdentity(data, L) +
    buildSnapshot(data, L) +
    buildAlerts(data, L) +
    `<div class="toc">${escapeHtml(L.t('export.contents'))}: ${escapeHtml(contents)}</div>` +
    '</section>'
  );
}

// ─── Weight ───────────────────────────────────────────────────────────────────

function buildWeight(records: ReportWeight[], L: ReportLabels): string {
  const head = sectionHead(
    L.t('weight.title'),
    records.length > 0 ? L.t('export.recordCount', { count: records.length }) : undefined
  );
  if (records.length === 0) return `<section class="sec">${head}${emptyLine(L)}</section>`;

  const values = records.map((r) => r.weightKg).filter(Number.isFinite);
  const latest = records[0];
  const oldest = records[records.length - 1];
  const kg = L.t('weight.kg');

  const tiles =
    '<div class="tiles t5">' +
    tile(L.t('export.weightCurrent'), `${num(latest.weightKg)} <span class="unit">${escapeHtml(kg)}</span>`) +
    tile(L.t('export.weightFirst'), `${num(oldest.weightKg)} <span class="unit">${escapeHtml(kg)}</span>`) +
    tile(L.t('export.weightMin'), `${num(Math.min(...values))} <span class="unit">${escapeHtml(kg)}</span>`) +
    tile(L.t('export.weightMax'), `${num(Math.max(...values))} <span class="unit">${escapeHtml(kg)}</span>`) +
    tile(L.t('export.weightChange'), signed(latest.weightKg - oldest.weightKg)) +
    '</div>';

  const chart = canRenderWeightChart(records)
    ? `<div class="chartbox">${buildWeightChartSvg(records, L.t('weight.title'))}</div>`
    : '';

  // Records are newest-first, so the "previous" reading is the next index.
  const rows = records.map((r, i) => {
    const prev = records[i + 1];
    const delta = prev ? r.weightKg - prev.weightKg : null;
    const deltaCell =
      delta === null
        ? DASH
        : `<span class="${delta > 0 ? 'tone-ok' : delta < 0 ? 'tone-bad' : ''}">${signed(delta)}</span>`;
    return [
      orDash(L.formatDate(r.date)),
      `${num(r.weightKg)} ${escapeHtml(kg)}`,
      deltaCell,
      txt(r.notes),
    ];
  });

  const tbl = table(
    [
      { label: L.t('common.date'), width: '17%' },
      { label: L.t('weight.weightKg'), width: '14%' },
      { label: L.t('export.change'), width: '16%' },
      { label: L.t('common.notes') },
    ],
    rows
  );

  return `<section class="sec">${head}${tiles}${chart}${tbl}</section>`;
}

// ─── Medications ──────────────────────────────────────────────────────────────

function medRows(meds: ReportMedication[], L: ReportLabels, active: boolean): string[][] {
  return meds.map((m) => {
    const lastCol = active
      ? `${orDash(L.formatDate(m.nextDueDate))}${
          m.reminderTimes.length > 0 ? `<div class="sub2">${escapeHtml(m.reminderTimes.join(', '))}</div>` : ''
        }`
      : orDash(L.formatDate(m.endDate));
    return [
      `<b>${escapeHtml(m.name)}</b>`,
      pill(L.t(`medications.${m.type}`), medTypeTone(m.type)),
      dosageLabel(m, L),
      escapeHtml(frequencyLabel(m, L)),
      orDash(L.formatDate(m.startDate)),
      lastCol,
      txt(m.notes),
    ];
  });
}

function medColumns(L: ReportLabels, active: boolean): Column[] {
  return [
    { label: L.t('medications.name'), width: '18%' },
    { label: L.t('medications.type'), width: '9%' },
    { label: L.t('medications.dosage'), width: '11%' },
    { label: L.t('medications.frequency'), width: '14%' },
    { label: L.t('medications.startDate'), width: '12%' },
    { label: active ? L.t('export.nextDose') : L.t('medications.endDate'), width: '12%' },
    { label: L.t('common.notes') },
  ];
}

function buildMedications(meds: ReportMedication[], L: ReportLabels): string {
  if (meds.length === 0) {
    return `<section class="sec">${sectionHead(L.t('medications.title'))}${emptyLine(L)}</section>`;
  }
  const active = meds.filter((m) => m.isActive);
  const past = meds.filter((m) => !m.isActive);

  let html = '<section class="sec">';
  html += sectionHead(L.t('export.activeMedications'), L.t('export.recordCount', { count: active.length }));
  html += active.length > 0 ? table(medColumns(L, true), medRows(active, L, true)) : emptyLine(L);
  html += '</section>';

  if (past.length > 0) {
    html += '<section class="sec">';
    html += sectionHead(L.t('export.pastMedications'), L.t('export.recordCount', { count: past.length }));
    html += table(medColumns(L, false), medRows(past, L, false));
    html += '</section>';
  }
  return html;
}

// ─── Vaccines ─────────────────────────────────────────────────────────────────

function buildVaccines(vaccines: ReportVaccine[], now: Date, L: ReportLabels): string {
  const head = sectionHead(
    L.t('vaccines.title'),
    vaccines.length > 0 ? L.t('export.recordCount', { count: vaccines.length }) : undefined
  );
  if (vaccines.length === 0) return `<section class="sec">${head}${emptyLine(L)}</section>`;

  const rows = vaccines.map((v) => [
    `<b>${escapeHtml(v.name)}</b>`,
    orDash(L.formatDate(v.vaccinationDate)),
    orDash(L.formatDate(v.nextDueDate)),
    duePill(v.nextDueDate, now, L),
    txt(v.veterinarian),
    txt(v.clinic),
    txt(v.batchNumber),
  ]);

  const tbl = table(
    [
      { label: L.t('vaccines.name'), width: '20%' },
      { label: L.t('vaccines.date'), width: '12%' },
      { label: L.t('vaccines.nextDue'), width: '12%' },
      { label: L.t('export.colStatus'), width: '14%' },
      { label: L.t('vaccines.veterinarian'), width: '13%' },
      { label: L.t('vaccines.clinic'), width: '14%' },
      { label: L.t('vaccines.batchNumber') },
    ],
    rows
  );
  return `<section class="sec">${head}${tbl}</section>`;
}

// ─── Treatments ───────────────────────────────────────────────────────────────

function buildTreatments(treatments: ReportTreatment[], now: Date, L: ReportLabels): string {
  const head = sectionHead(
    L.t('treatments.title'),
    treatments.length > 0 ? L.t('export.recordCount', { count: treatments.length }) : undefined
  );
  if (treatments.length === 0) return `<section class="sec">${head}${emptyLine(L)}</section>`;

  const rows = treatments.map((t) => [
    escapeHtml(L.t(`treatments.${t.category}`)),
    `<b>${escapeHtml(t.productName)}</b>`,
    orDash(L.formatDate(t.treatmentDate)),
    orDash(L.formatDate(t.nextDueDate)),
    duePill(t.nextDueDate, now, L),
    txt(t.dosage),
    txt(t.notes),
  ]);

  const tbl = table(
    [
      { label: L.t('treatments.category'), width: '15%' },
      { label: L.t('treatments.product'), width: '20%' },
      { label: L.t('treatments.date'), width: '13%' },
      { label: L.t('treatments.nextDue'), width: '13%' },
      { label: L.t('export.colStatus'), width: '14%' },
      { label: L.t('treatments.dosage'), width: '10%' },
      { label: L.t('common.notes') },
    ],
    rows
  );
  return `<section class="sec">${head}${tbl}</section>`;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

function apptColumns(L: ReportLabels): Column[] {
  return [
    { label: L.t('appointments.date'), width: '17%' },
    { label: L.t('appointments.titleField'), width: '18%' },
    { label: L.t('appointments.veterinarian'), width: '13%' },
    { label: L.t('appointments.clinic'), width: '15%' },
    { label: L.t('appointments.clinicPhone'), width: '12%' },
    { label: L.t('appointments.status'), width: '10%' },
    { label: L.t('appointments.completionNotes') },
  ];
}

function apptRows(appts: ReportAppointment[], L: ReportLabels): string[][] {
  return appts.map((a) => [
    orDash(L.formatDateTime(a.scheduledDate)),
    `<b>${escapeHtml(a.title)}</b>`,
    txt(a.veterinarian),
    txt(a.clinic),
    txt(a.clinicPhone),
    pill(L.t(`appointments.${a.status}`), apptTone(a.status)),
    txt(a.completionNotes || a.notes),
  ]);
}

function buildAppointments(appts: ReportAppointment[], L: ReportLabels): string {
  if (appts.length === 0) {
    return `<section class="sec">${sectionHead(L.t('appointments.title'))}${emptyLine(L)}</section>`;
  }
  const scheduled = appts.filter((a) => a.status === 'scheduled');
  const history = appts.filter((a) => a.status !== 'scheduled');

  let html = '';
  if (scheduled.length > 0) {
    html +=
      '<section class="sec">' +
      sectionHead(L.t('export.scheduledAppointments'), L.t('export.recordCount', { count: scheduled.length })) +
      table(apptColumns(L), apptRows(scheduled, L)) +
      '</section>';
  }
  if (history.length > 0) {
    html +=
      '<section class="sec">' +
      sectionHead(L.t('export.pastAppointments'), L.t('export.recordCount', { count: history.length })) +
      table(apptColumns(L), apptRows(history, L)) +
      '</section>';
  }
  return html;
}

// ─── Food ─────────────────────────────────────────────────────────────────────

function buildFood(section: MedicalReportData['food'], L: ReportLabels): string {
  const { records, totalCount, limit } = section;
  const meta =
    totalCount > records.length
      ? L.t('export.foodRecent', { shown: records.length, total: totalCount })
      : L.t('export.recordCount', { count: totalCount });
  const head = sectionHead(L.t('food.title'), records.length > 0 ? meta : undefined);
  if (records.length === 0) return `<section class="sec">${head}${emptyLine(L)}</section>`;

  const rows = records.map((f) => [
    orDash(L.formatDateTime(f.feedingDate)),
    `<b>${escapeHtml(f.foodName)}</b>${f.foodBrand ? ` · ${escapeHtml(f.foodBrand)}` : ''}`,
    escapeHtml(L.t(`food.${f.foodType}`)),
    amountLabel(f, L),
    txt(f.notes),
  ]);

  const tbl = table(
    [
      { label: L.t('food.date'), width: '20%' },
      { label: L.t('food.name'), width: '28%' },
      { label: L.t('food.type'), width: '12%' },
      { label: L.t('food.amount'), width: '14%' },
      { label: L.t('common.notes') },
    ],
    rows
  );

  // Daily average over the span the shown records actually cover.
  const dated = records.filter((f) => f.feedingDate).map((f) => f.feedingDate as Date);
  const grams = records
    .filter((f) => !f.amountUnit || f.amountUnit === 'gram')
    .reduce((sum, f) => sum + (Number.isFinite(f.amountGrams) ? f.amountGrams : 0), 0);
  const days =
    dated.length > 1
      ? Math.max(
          1,
          daysBetween(new Date(Math.min(...dated.map((d) => d.getTime()))), new Date(Math.max(...dated.map((d) => d.getTime())))) + 1
        )
      : 1;

  const byType = new Map<string, number>();
  for (const f of records) byType.set(f.foodType, (byType.get(f.foodType) ?? 0) + 1);
  const typeRows = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => [escapeHtml(L.t(`food.${type}`)), String(count)]);

  const aside =
    '<div class="foodside">' +
    tile(L.t('export.dailyAverage'), `${num(grams / days, 0)} <span class="unit">${escapeHtml(L.t('food.gram'))}</span>`) +
    table([{ label: L.t('food.type') }, { label: L.t('export.records'), width: '30%' }], typeRows) +
    '</div>';

  return `<section class="sec">${head}<div class="foodgrid">${tbl}${aside}</div></section>`;
}

// ─── Documents ────────────────────────────────────────────────────────────────

function buildDocuments(docs: ReportDocument[], L: ReportLabels): string {
  const head = sectionHead(
    L.t('medicalFile.title'),
    docs.length > 0 ? `${L.t('export.recordCount', { count: docs.length })} · ${L.t('export.documentsNote')}` : undefined
  );
  if (docs.length === 0) return `<section class="sec">${head}${emptyLine(L)}</section>`;

  const rows = docs.map((d) => [
    `<b>${escapeHtml(d.name)}</b>`,
    pill(docTypeLabel(d.fileType, L)),
    orDash(L.formatDate(d.uploadedAt)),
    txt(d.notes),
  ]);

  const tbl = table(
    [
      { label: L.t('export.colName'), width: '28%' },
      { label: L.t('export.colType'), width: '12%' },
      { label: L.t('export.colUploadedAt'), width: '15%' },
      { label: L.t('common.notes') },
    ],
    rows
  );
  return `<section class="sec">${head}${tbl}</section>`;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(data: MedicalReportData, L: ReportLabels): string {
  const all: (Date | null)[] = [
    ...data.weights.map((r) => r.date),
    ...data.vaccines.map((r) => r.vaccinationDate),
    ...data.treatments.map((r) => r.treatmentDate),
    ...data.appointments.map((r) => r.scheduledDate),
    ...data.medications.map((r) => r.startDate),
    ...data.food.records.map((r) => r.feedingDate),
    ...data.documents.map((r) => r.uploadedAt),
  ];
  const times = all.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  const range =
    times.length > 0
      ? `${L.formatDate(new Date(Math.min(...times)))} – ${L.formatDate(new Date(Math.max(...times)))}`
      : DASH;

  const activeCount = data.medications.filter((m) => m.isActive).length;
  const row = (l1: string, v1: string, l2: string, v2: string) =>
    `<tr><td class="k">${escapeHtml(l1)}</td><td>${escapeHtml(v1)}</td><td class="k">${escapeHtml(l2)}</td><td>${escapeHtml(v2)}</td></tr>`;

  return (
    '<section class="sec summary">' +
    sectionHead(L.t('export.summary')) +
    '<table class="tb kv"><tbody>' +
    row(
      L.t('weight.title'),
      String(data.weights.length),
      L.t('medications.title'),
      `${data.medications.length} (${activeCount} ${L.t('medications.active')})`
    ) +
    row(L.t('vaccines.title'), String(data.vaccines.length), L.t('treatments.title'), String(data.treatments.length)) +
    row(L.t('appointments.title'), String(data.appointments.length), L.t('food.title'), String(data.food.totalCount)) +
    row(L.t('medicalFile.title'), String(data.documents.length), L.t('export.dataRange'), range) +
    '</tbody></table>' +
    '</section>'
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────

function styles(isRTL: boolean): string {
  return `
@page { size: A4 portrait; margin: 15mm 14mm 20mm; }
* { box-sizing: border-box; }
html { direction: ${isRTL ? 'rtl' : 'ltr'}; }
body {
  margin: 0;
  font-family: 'Heebo', 'Noto Sans Hebrew', 'Noto Sans', Roboto, Arial, sans-serif;
  font-size: 10px;
  line-height: 1.45;
  color: #212121;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.phead {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #E0E0E0; padding-bottom: 7px; margin-bottom: 14px;
  border-top: 4px solid #4CAF50; padding-top: 9px;
}
.plogo { font-size: 12.5px; font-weight: 700; color: #388E3C; }
.pmeta { font-size: 9.5px; color: #757575; }
.cover { page-break-after: always; }
.sec { page-break-inside: auto; margin-bottom: 15px; }
.sech {
  display: flex; align-items: center; gap: 8px;
  background: #EDF7ED; border-inline-start: 4px solid #4CAF50;
  padding: 5px 9px; margin: 0 0 8px; page-break-after: avoid; page-break-inside: avoid;
}
.sech b { font-size: 12.5px; color: #2E6B31; }
.sech span { font-size: 9.5px; color: #757575; margin-inline-start: auto; }
.tb { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 10px; }
.tb th {
  background: #F3F5F3; color: #4B5B4C; font-weight: 500; text-align: start;
  padding: 5px 7px; border-bottom: 1px solid #D8DED8; font-size: 9px;
}
.tb td { padding: 5px 7px; border-bottom: 0.5px solid #ECEFEC; vertical-align: top; text-align: start; }
.tb tbody tr:nth-child(even) td { background: #FAFBFA; }
.tb tr { page-break-inside: avoid; }
.tb thead { display: table-header-group; }
.tb .k { color: #757575; width: 19%; }
.kv td { border-bottom: 0.5px solid #ECEFEC; }
.mono { font-family: 'Courier New', monospace; }
.sub2 { font-size: 8px; color: #757575; }
.empty { font-size: 10px; color: #9A9A9A; margin: 2px 0 12px; }
.pill {
  display: inline-block; padding: 1px 7px; border-radius: 9px;
  font-size: 8.5px; font-weight: 500; white-space: nowrap;
}
.p-ok { background: #E4F3E5; color: #265C29; }
.p-warn { background: #FDEEDC; color: #8A4E06; }
.p-bad { background: #FBE3E3; color: #8E2020; }
.p-neutral { background: #EDEFF1; color: #4A5257; }
.tone-ok { color: #2E7D32; }
.tone-bad { color: #C62828; }
.tone-warn { color: #EF6C00; }
.idcard {
  display: flex; gap: 16px; align-items: center;
  background: #F7FAF7; border: 1px solid #E3EBE3; border-radius: 10px;
  padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid;
}
.avatar {
  width: 88px; height: 88px; border-radius: 50%; flex: none;
  border: 3px solid #4CAF50; object-fit: cover; background: #C8E6C9;
}
.avatar.emoji {
  display: flex; align-items: center; justify-content: center;
  font-size: 42px; line-height: 1;
}
.idmain { flex: 1; }
.pname { font-size: 26px; font-weight: 700; line-height: 1.15; }
.psub { font-size: 12px; color: #5C6B5D; margin-top: 2px; }
.chips { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.idside { text-align: end; flex: none; }
.slabel { font-size: 8.5px; color: #9A9A9A; margin-top: 5px; }
.svalue { font-size: 9.5px; color: #666; }
.tiles { display: flex; gap: 8px; margin-bottom: 12px; page-break-inside: avoid; }
.tiles > .tile { flex: 1; background: #F3F6F3; border-radius: 8px; padding: 9px; min-width: 0; }
.tlabel { font-size: 8.5px; color: #757575; }
.tval { font-size: 17px; font-weight: 700; margin-top: 1px; }
.tval .unit { font-size: 9.5px; font-weight: 400; }
.sub { font-size: 8.5px; color: #757575; }
.alert { border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
.alert.bad { border: 1px solid #F3C9C9; background: #FDF3F3; }
.alert.warn { border: 1px solid #F5DCBB; background: #FEF8F0; }
.alert .atitle { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
.alert.bad .atitle { color: #8E2020; }
.alert.warn .atitle { color: #8A4E06; }
.alert .abody { font-size: 9.5px; line-height: 1.7; }
.alert.bad .abody { color: #6B3333; }
.alert.warn .abody { color: #6B5030; }
.toc {
  font-size: 9px; color: #8A8A8A; line-height: 1.6;
  border-top: 0.5px dashed #DDD; padding-top: 7px; margin-top: 10px;
}
.chartbox { border: 1px solid #E6EBE6; border-radius: 8px; padding: 10px 8px 4px; margin-bottom: 12px; page-break-inside: avoid; }
.chart { width: 100%; height: auto; display: block; }
.foodgrid { display: flex; gap: 12px; align-items: flex-start; }
.foodgrid > .tb { flex: 2; min-width: 0; }
.foodside { flex: 1; min-width: 0; }
.foodside .tile { background: #F3F6F3; border-radius: 8px; padding: 9px; margin-bottom: 8px; }
.summary { page-break-inside: avoid; }
.pfoot {
  position: fixed; bottom: 0; inset-inline: 0;
  border-top: 1px solid #E0E0E0; padding-top: 5px;
  font-size: 8px; color: #9A9A9A;
}
.pfoot .frow { display: flex; justify-content: space-between; }
.fdis { font-size: 7.5px; color: #B0B0B0; text-align: center; margin-top: 2px; line-height: 1.4; }
`.trim();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildMedicalReportHtml(data: MedicalReportData, L: ReportLabels): string {
  const now = data.generatedAt;
  const generated = L.t('export.generatedAt', { date: L.formatDateTime(now) });

  const header =
    '<div class="phead">' +
    `<div class="plogo">PetControl · ${escapeHtml(L.t('export.title'))}</div>` +
    `<div class="pmeta">${escapeHtml(generated)}</div>` +
    '</div>';

  const footer =
    '<div class="pfoot">' +
    `<div class="frow"><div>${escapeHtml(data.pet.name)} · ${escapeHtml(L.t('export.title'))}</div><div>${escapeHtml(generated)}</div></div>` +
    `<div class="fdis">${escapeHtml(L.t('export.disclaimer'))}</div>` +
    '</div>';

  const body = [
    buildCover(data, L),
    buildWeight(data.weights, L),
    buildMedications(data.medications, L),
    buildVaccines(data.vaccines, now, L),
    buildTreatments(data.treatments, now, L),
    buildAppointments(data.appointments, L),
    buildFood(data.food, L),
    buildDocuments(data.documents, L),
    buildSummary(data, L),
  ].join('');

  return (
    '<!DOCTYPE html><html lang="' +
    escapeHtml(L.lang) +
    `" dir="${L.isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(L.t('export.title'))} – ${escapeHtml(data.pet.name)}</title>` +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">' +
    `<style>${styles(L.isRTL)}</style></head><body>` +
    header +
    footer +
    body +
    '</body></html>'
  );
}
