import React, { useEffect, useState } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchEncounters } from '../cds/case-builder/openmrs-api';
import { buildVitalsHistory, type VitalsPoint } from './vitals-history';
import styles from './vitals-history.scss';

interface VitalsHistoryProps {
  patientUuid: string;
}

const VitalsHistory: React.FC<VitalsHistoryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [points, setPoints] = useState<VitalsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEncounters(patientUuid, 200)
      .then((encounters) => {
        if (active) {
          setPoints(buildVitalsHistory(encounters));
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setPoints([]);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [patientUuid]);

  if (loading) {
    return <section className={styles.panel} aria-label={t('vitalsHistory', 'Vitals history')}>
      <h3 className={styles.heading}>{t('vitalsHistory', 'Vitals history')}</h3>
      <SkeletonText heading width="25%" />
      <SkeletonText width="100%" />
    </section>;
  }

  if (error) {
    return <section className={styles.panel}>
      <h3 className={styles.heading}>{t('vitalsHistory', 'Vitals history')}</h3>
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('vitalsHistoryUnavailable', 'Vitals history unavailable')}
        subtitle={t('vitalsHistoryUnavailableDetail', 'The patient observations could not be loaded.')}
      />
    </section>;
  }

  const hasWeight = points.some((point) => point.weightKg !== undefined);
  const hasBloodPressure = points.some((point) => point.systolic !== undefined || point.diastolic !== undefined);
  const hasGlucose = points.some((point) => point.glucose !== undefined);
  const formatDate = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString();

  const chart = (
    title: string,
    dataKey: 'weightKg' | 'systolic' | 'diastolic' | 'glucose',
    unit: string,
    color: string,
    secondKey?: 'diastolic',
  ) => (
    <div className={styles.chartCard}>
      <h4>{title}</h4>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={28} />
            <YAxis unit={unit} width={64} />
            <Tooltip labelFormatter={(label) => formatDate(String(label))} formatter={(value: number) => [`${value} ${unit}`, undefined]} />
            <Legend />
            <Line type="monotone" dataKey={dataKey} name={title} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            {secondKey && <Line type="monotone" dataKey={secondKey} name="Diastolic" stroke="#8a3ffc" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <section className={styles.panel} aria-label={t('vitalsHistory', 'Vitals history')}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.heading}>{t('vitalsHistory', 'Vitals history')}</h3>
          <p>{t('vitalsHistoryDescription', 'Recorded measurements over time')}</p>
        </div>
        <span className={styles.count}>{points.length} {t('recordedDates', 'recorded dates')}</span>
      </div>
      {points.length === 0 || (!hasWeight && !hasBloodPressure && !hasGlucose) ? (
        <p className={styles.empty}>{t('noVitalsHistory', 'No weight, blood pressure or glucose observations were found in the available encounter history.')}</p>
      ) : (
        <div className={styles.grid}>
          {hasWeight && chart(t('weight', 'Weight'), 'weightKg', 'kg', '#0f62fe')}
          {hasBloodPressure && chart(t('bloodPressure', 'Blood pressure'), 'systolic', 'mmHg', '#24a148', 'diastolic')}
          {hasGlucose && chart(t('glucose', 'Glucose'), 'glucose', 'mmol/L', '#ee5396')}
        </div>
      )}
      <p className={styles.note}>{t('vitalsHistoryNote', 'Charts show recorded values only. Gaps indicate dates without a corresponding observation; no values are estimated.')}</p>
    </section>
  );
};

export default VitalsHistory;
