import { buildVitalsHistory } from './vitals-history';
import type { Encounter } from '../cds/case-builder/openmrs-api';

const observation = (uuid: string, display: string, value: number, code: string) => ({
  uuid,
  display,
  concept: {
    uuid: `concept-${uuid}`,
    display,
    datatype: { display: 'Numeric' },
    conceptClass: { display: 'Test' },
    mappings: [{ conceptReferenceTerm: { code, conceptSource: { display: 'CIEL' } } }],
  },
  value,
  groupMembers: [],
});

const encounter = (date: string, obs: any[]): Encounter => ({
  uuid: `enc-${date}`,
  encounterDatetime: date,
  encounterType: { display: 'Vitals' },
  location: null,
  obs,
});

describe('buildVitalsHistory', () => {
  it('extracts weight, systolic/diastolic pressure and glucose from CIEL mappings', () => {
    const result = buildVitalsHistory([encounter('2026-01-01T10:00:00', [
      observation('w', 'Weight', 72.4, '5089'),
      observation('s', 'Systolic blood pressure', 122, '5085'),
      observation('d', 'Diastolic blood pressure', 78, '5086'),
      observation('g', 'Glucose', 5.6, '887'),
    ])]);
    expect(result).toEqual([{ date: '2026-01-01', weightKg: 72.4, systolic: 122, diastolic: 78, glucose: 5.6 }]);
  });

  it('sorts observations chronologically and keeps missing values absent', () => {
    const result = buildVitalsHistory([
      encounter('2026-02-01T10:00:00', [observation('w2', 'Weight', 73, '5089')]),
      encounter('2026-01-01T10:00:00', [observation('w1', 'Weight', 72, '5089')]),
    ]);
    expect(result).toEqual([
      { date: '2026-01-01', weightKg: 72 },
      { date: '2026-02-01', weightKg: 73 },
    ]);
  });

  it('reads observations nested inside grouped observations', () => {
    const grouped = {
      ...observation('bp', 'Blood pressure', 0, '0'),
      groupMembers: [observation('s', 'Systolic', 120, '5085')],
    };
    expect(buildVitalsHistory([encounter('2026-03-01T10:00:00', [grouped])])[0].systolic).toBe(120);
  });
});
