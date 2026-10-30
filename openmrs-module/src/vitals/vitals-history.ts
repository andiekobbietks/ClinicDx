import type { Encounter, Obs, ObsConcept } from '../cds/case-builder/openmrs-api';

export interface VitalsPoint {
  date: string;
  weightKg?: number;
  systolic?: number;
  diastolic?: number;
  glucose?: number;
}

function cielCodes(concept: ObsConcept): string[] {
  return (concept.mappings ?? [])
    .filter((mapping) => {
      const source = mapping.conceptReferenceTerm?.conceptSource?.display ?? '';
      return source.toLowerCase() === 'ciel' || source.toLowerCase().includes('columbia');
    })
    .map((mapping) => mapping.conceptReferenceTerm.code);
}

function flatten(observations: Obs[] = []): Obs[] {
  return observations.flatMap((observation) => [
    observation,
    ...flatten(observation.groupMembers ?? []),
  ]);
}

function numericValue(value: any): number | undefined {
  const raw = value && typeof value === 'object'
    ? value.display ?? value.value
    : value;
  if (raw === null || raw === undefined || raw === '') return undefined;
  const parsed = Number.parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

type VitalKind = 'weightKg' | 'systolic' | 'diastolic' | 'glucose';

function classify(concept: ObsConcept): VitalKind | undefined {
  const name = (concept.display ?? '').replace(/\s*\(CIEL:\d+\)/g, '').toLowerCase();
  const codes = cielCodes(concept);

  if (codes.includes('5089') || /\b(weight|body weight)\b/.test(name)) return 'weightKg';
  if (codes.includes('5085') || /systolic blood pressure|\bsystolic\b/.test(name)) return 'systolic';
  if (codes.includes('5086') || /diastolic blood pressure|\bdiastolic\b/.test(name)) return 'diastolic';
  if (codes.includes('887') || /\b(glucose|blood sugar|fasting blood sugar|random blood sugar)\b/.test(name)) return 'glucose';
  return undefined;
}

/** Converts the existing OpenMRS encounter/obs structure into chart-ready time series. */
export function buildVitalsHistory(encounters: Encounter[]): VitalsPoint[] {
  const byDate = new Map<string, VitalsPoint>();

  for (const encounter of encounters) {
    const timestamp = new Date(encounter.encounterDatetime);
    if (Number.isNaN(timestamp.getTime())) continue;
    const date = timestamp.toISOString().slice(0, 10);
    const point = byDate.get(date) ?? { date };
    for (const observation of flatten(encounter.obs ?? [])) {
      if (!observation.concept) continue;
      const kind = classify(observation.concept);
      const value = numericValue(observation.value);
      if (!kind || value === undefined) continue;
      // Preserve the last observation of each type recorded on a given date.
      point[kind] = value;
    }
    byDate.set(date, point);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
