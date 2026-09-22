import { buildWeightChartSvg, canRenderWeightChart, MIN_CHART_POINTS } from '../weightChartSvg';
import { ReportWeight } from '../types';

function w(id: string, weightKg: number, iso: string | null): ReportWeight {
  return { id, weightKg, date: iso ? new Date(iso) : null };
}

describe('canRenderWeightChart', () => {
  it('needs at least two dated records', () => {
    expect(MIN_CHART_POINTS).toBe(2);
    expect(canRenderWeightChart([])).toBe(false);
    expect(canRenderWeightChart([w('a', 4, '2026-01-01')])).toBe(false);
    expect(canRenderWeightChart([w('a', 4, '2026-01-01'), w('b', 5, '2026-02-01')])).toBe(true);
  });

  it('ignores records with no date', () => {
    expect(canRenderWeightChart([w('a', 4, '2026-01-01'), w('b', 5, null)])).toBe(false);
  });
});

describe('buildWeightChartSvg', () => {
  const series = [
    w('a', 3.6, '2025-03-10'),
    w('b', 4.0, '2025-09-10'),
    w('c', 4.2, '2026-03-10'),
    w('d', 4.3, '2026-09-10'),
  ];

  it('returns an empty string when there is not enough data', () => {
    expect(buildWeightChartSvg([])).toBe('');
    expect(buildWeightChartSvg([w('a', 4, '2026-01-01')])).toBe('');
  });

  it('emits a well-formed svg with one polyline point per record', () => {
    const svg = buildWeightChartSvg(series);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);

    const points = svg.match(/<polyline points="([^"]+)"/);
    expect(points).not.toBeNull();
    expect((points as RegExpMatchArray)[1].split(' ')).toHaveLength(series.length);
  });

  it('plots oldest to newest regardless of input order', () => {
    const ascending = buildWeightChartSvg(series);
    const descending = buildWeightChartSvg([...series].reverse());
    expect(descending).toBe(ascending);
  });

  it('produces finite coordinates when every weight is identical', () => {
    const flat = [
      w('a', 4.2, '2026-01-01'),
      w('b', 4.2, '2026-02-01'),
      w('c', 4.2, '2026-03-01'),
    ];
    const svg = buildWeightChartSvg(flat);
    expect(svg).not.toBe('');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('never emits NaN for a two-point series', () => {
    const svg = buildWeightChartSvg([w('a', 0, '2026-01-01'), w('b', 0, '2026-02-01')]);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('caps the number of x-axis labels so they do not collide', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      w(`r${i}`, 4 + i * 0.01, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`)
    );
    const svg = buildWeightChartSvg(many);
    // 4 grid-line value labels + at most 4 date labels.
    expect((svg.match(/<text /g) ?? []).length).toBeLessThanOrEqual(8);
  });

  it('escapes nothing into the aria-label that could break the attribute', () => {
    const svg = buildWeightChartSvg(series, 'Weight');
    expect(svg).toContain('aria-label="Weight"');
  });
});
