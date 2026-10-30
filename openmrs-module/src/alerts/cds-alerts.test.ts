import { deriveCdsAlerts } from './cds-alerts';
import type { Encounter, PatientFull } from '../cds/case-builder/openmrs-api';

const patient = {
  uuid: 'patient-1',
  display: 'Test patient',
  person: {
    uuid: 'person-1',
    gender: 'F',
    age: 42,
    birthdate: '1984-01-01',
    preferredName: { givenName: 'Test', familyName: 'Patient' },
    attributes: [
      { attributeType: { display: 'Drug Allergy' }, display: 'Penicillin', value: 'Penicillin' },
    ],
  },
  identifiers: [],
} as PatientFull;

const encounter = (obs: any[]): Encounter => ({
  uuid: 'enc-1',
  encounterDatetime: '2026-10-30T10:00:00',
  encounterType: { display: 'Outpatient' },
  location: null,
  obs,
});

describe('deriveCdsAlerts', () => {
  it('flags a medication mention that exactly matches a recorded allergy', () => {
    const alerts = deriveCdsAlerts(patient, [encounter([{
      uuid: 'obs-1',
      display: 'Medication',
      concept: { uuid: 'c-1', display: 'Medication', datatype: { display: 'Text' }, conceptClass: { display: 'Misc' }, mappings: [] },
      value: 'Penicillin',
      groupMembers: [],
    } as any])]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('allergy');
    expect(alerts[0].severity).toBe('critical');
  });

  it('flags only laboratory observations with an explicit pending status', () => {
    const alerts = deriveCdsAlerts(patient, [encounter([{
      uuid: 'obs-2',
      display: 'Creatinine',
      concept: { uuid: 'c-2', display: 'Creatinine', datatype: { display: 'Text' }, conceptClass: { display: 'Test' }, mappings: [] },
      value: { status: 'pending' },
      groupMembers: [],
    } as any])]);
    expect(alerts.some((alert) => alert.kind === 'lab')).toBe(true);
  });

  it('does not treat a missing lab value as proof that a result is pending', () => {
    const alerts = deriveCdsAlerts(patient, [encounter([{
      uuid: 'obs-3',
      display: 'Creatinine',
      concept: { uuid: 'c-3', display: 'Creatinine', datatype: { display: 'Numeric' }, conceptClass: { display: 'Test' }, mappings: [] },
      value: null,
      groupMembers: [],
    } as any])]);
    expect(alerts).toHaveLength(0);
  });
});
