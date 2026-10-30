import type { Encounter, Obs, PatientFull } from '../cds/case-builder/openmrs-api';

export type CdsAlert = {
  id: string;
  kind: 'allergy' | 'lab';
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  date?: string;
};

const MEDICATION_TERMS = /\b(medication|medicine|drug|prescription|prescribed|active medication)\b/i;
const LAB_TERMS = /\b(lab|laboratory|test result|culture|blood test|urine test|haemoglobin|hemoglobin|creatinine|glucose|potassium|sodium|bilirubin|platelet|wbc|fbc|full blood count)\b/i;
const PENDING = /^(pending|ordered|requested|in progress|not resulted|awaiting result)$/i;

function valueText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value.display ?? value.name ?? value.value ?? value.status ?? '');
  }
  return String(value);
}

function flattenObs(observations: Obs[] = []): Obs[] {
  return observations.flatMap((obs) => [obs, ...flattenObs(obs.groupMembers ?? [])]);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function allergyEntries(patient: PatientFull): Array<{ allergen: string }> {
  return (patient.person?.attributes ?? [])
    .filter((attribute) => /allerg/i.test(attribute.attributeType?.display ?? ''))
    .map((attribute) => {
      const allergen = valueText(attribute.value) || attribute.display || '';
      return { allergen: allergen.trim() };
    })
    .filter((entry) => entry.allergen.length > 1);
}

/**
 * Conservative, explainable banner rules based only on structured OpenMRS
 * patient attributes and encounter observations already loaded by ClinicDx.
 * These are screening prompts, not a substitute for a validated interaction
 * knowledge base or clinician review.
 */
export function deriveCdsAlerts(patient: PatientFull, encounters: Encounter[]): CdsAlert[] {
  const alerts: CdsAlert[] = [];
  const allergies = allergyEntries(patient);
  const observations = flattenObs(encounters.flatMap((encounter) => encounter.obs ?? []));

  const medicationMentions = observations
    .filter((obs) => MEDICATION_TERMS.test(obs.concept?.display ?? ''))
    .map((obs) => valueText(obs.value))
    .filter(Boolean);

  for (const allergy of allergies) {
    const allergen = normalise(allergy.allergen);
    if (!allergen) continue;
    const matchedMedication = medicationMentions.find((medication) => {
      const candidate = normalise(medication);
      return candidate === allergen;
    });
    if (matchedMedication) {
      alerts.push({
        id: `allergy-${allergen}`,
        kind: 'allergy',
        severity: 'critical',
        title: 'Potential drug–allergy conflict',
        detail: `Recorded allergy “${allergy.allergen}” matches medication information in the patient record: “${matchedMedication}”. Verify before prescribing or administering.`,
      });
    }
  }

  for (const obs of observations) {
    const concept = obs.concept?.display ?? obs.display ?? 'Laboratory test';
    const value = valueText(obs.value);
    const explicitStatus = typeof obs.value === 'object'
      ? String(obs.value.status ?? obs.value.resultStatus ?? obs.value.orderStatus ?? obs.value.display ?? '')
      : '';
    const isExplicitlyPending = PENDING.test(explicitStatus.trim());
    if (LAB_TERMS.test(concept) && isExplicitlyPending) {
      alerts.push({
        id: `lab-${obs.uuid}`,
        kind: 'lab',
        severity: 'warning',
        title: 'Laboratory result pending',
        detail: `${concept.replace(/\s*\(CIEL:\d+\)/g, '')} is marked “${explicitStatus}” in the patient record.`,
      });
    }
  }

  return alerts;
}
