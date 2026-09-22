/**
 * Inline SVG weight chart for the medical-file PDF.
 *
 * `react-native-chart-kit` renders to the native view tree and cannot be used
 * inside the print WebView, so the chart is built as an SVG string instead.
 * Pure: no react-native / expo imports, so it is unit-testable under jest's
 * node environment.
 */
import { ReportWeight } from './types';

const VIEW_W = 540;
const VIEW_H = 190;
const PAD_LEFT = 44;
const PAD_RIGHT = 10;
const PAD_TOP = 12;
const PLOT_BOTTOM = 152;
const LABEL_Y = 168;

const LINE = '#4CAF50';
const LINE_DARK = '#388E3C';
const GRID = '#EFEFEF';
const AXIS = '#CFCFCF';
const LABEL = '#999999';

/** A chart needs at least two points to mean anything. */
export const MIN_CHART_POINTS = 2;

export function canRenderWeightChart(records: ReportWeight[]): boolean {
  return records.filter((r) => r.date instanceof Date).length >= MIN_CHART_POINTS;
}

function round(n: number, digits = 1): string {
  return Number(n.toFixed(digits)).toString();
}

function shortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

/**
 * Builds the chart SVG. Returns an empty string when there is not enough data,
 * so callers can simply omit the block.
 *
 * `records` may arrive in any order; points are plotted oldest → newest.
 */
export function buildWeightChartSvg(records: ReportWeight[], title = 'Weight'): string {
  const points = records
    .filter((r) => r.date instanceof Date && Number.isFinite(r.weightKg))
    .slice()
    .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());

  if (points.length < MIN_CHART_POINTS) return '';

  const values = points.map((p) => p.weightKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // A flat series has a zero range — pad it so the line lands mid-chart
  // instead of dividing by zero.
  const span = rawMax - rawMin;
  const pad = span === 0 ? Math.max(Math.abs(rawMax) * 0.1, 0.5) : span * 0.15;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = PLOT_BOTTOM - PAD_TOP;

  const x = (i: number) =>
    points.length === 1
      ? PAD_LEFT + plotW / 2
      : PAD_LEFT + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + (1 - (v - yMin) / yRange) * plotH;

  const coords = points.map((p, i) => `${round(x(i), 1)},${round(y(p.weightKg), 1)}`);
  const polyline = coords.join(' ');
  const areaPoints = `${polyline} ${round(x(points.length - 1), 1)},${PLOT_BOTTOM} ${round(x(0), 1)},${PLOT_BOTTOM}`;

  // Four horizontal grid lines with value labels.
  const gridRows = [0, 0.25, 0.5, 0.75].map((f) => {
    const gy = PAD_TOP + f * plotH;
    const value = yMax - f * yRange;
    return (
      `<line x1="${PAD_LEFT}" y1="${round(gy, 1)}" x2="${VIEW_W - PAD_RIGHT}" y2="${round(gy, 1)}" stroke="${GRID}"/>` +
      `<text x="${PAD_LEFT - 6}" y="${round(gy + 4, 1)}" font-size="9" fill="${LABEL}" text-anchor="end">${round(value, 1)}</text>`
    );
  });

  // Dots: first, last, and up to three evenly spaced in between, so a long
  // series does not turn into a solid band of circles.
  const dotIdx = new Set<number>([0, points.length - 1]);
  for (let k = 1; k <= 3; k++) {
    dotIdx.add(Math.round((k / 4) * (points.length - 1)));
  }
  const dots = [...dotIdx]
    .sort((a, b) => a - b)
    .map((i) => {
      const last = i === points.length - 1;
      return `<circle cx="${round(x(i), 1)}" cy="${round(y(points[i].weightKg), 1)}" r="${last ? 3.6 : 3}" fill="${last ? LINE_DARK : LINE}"/>`;
    });

  // X labels: first, last, and two in between — more than four collide.
  const labelIdx = [...new Set([0, Math.round((points.length - 1) / 3), Math.round((2 * (points.length - 1)) / 3), points.length - 1])];
  const xLabels = labelIdx.map((i) => {
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    return `<text x="${round(x(i), 1)}" y="${LABEL_Y}" font-size="8.5" fill="${LABEL}" text-anchor="${anchor}">${shortDate(points[i].date as Date)}</text>`;
  });

  return [
    `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="chart" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg">`,
    ...gridRows,
    `<line x1="${PAD_LEFT}" y1="${PLOT_BOTTOM}" x2="${VIEW_W - PAD_RIGHT}" y2="${PLOT_BOTTOM}" stroke="${AXIS}"/>`,
    `<polygon points="${areaPoints}" fill="${LINE}" opacity="0.08"/>`,
    `<polyline points="${polyline}" fill="none" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...dots,
    ...xLabels,
    '</svg>',
  ].join('');
}
