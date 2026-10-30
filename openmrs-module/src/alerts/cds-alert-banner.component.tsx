import React, { useCallback, useEffect, useState } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { fetchEncounters, fetchPatient } from '../cds/case-builder/openmrs-api';
import type { CdsAlert } from './cds-alerts';
import { deriveCdsAlerts } from './cds-alerts';
import styles from './cds-alert-banner.scss';

interface CdsAlertBannerProps {
  patientUuid: string;
}

const REFRESH_INTERVAL_MS = 30_000;

const CdsAlertBanner: React.FC<CdsAlertBannerProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<CdsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!patientUuid) return;
    try {
      const [patient, encounters] = await Promise.all([
        fetchPatient(patientUuid),
        fetchEncounters(patientUuid, 50),
      ]);
      setAlerts(deriveCdsAlerts(patient, encounters));
      setError(false);
    } catch {
      // Do not retain stale warnings as if they were current clinical state.
      setAlerts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patientUuid]);

  useEffect(() => {
    let active = true;
    const runRefresh = async () => {
      if (active) await refresh();
    };
    void runRefresh();
    const interval = window.setInterval(runRefresh, REFRESH_INTERVAL_MS);
    const onFocus = () => void runRefresh();
    const onOnline = () => void runRefresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  if (loading) {
    return <div className={styles.loading} aria-label={t('loadingClinicalAlerts', 'Loading clinical alerts')}>
      <SkeletonText heading width="30%" />
      <SkeletonText width="70%" />
    </div>;
  }

  if (error) {
    return <div className={styles.banner}>
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('clinicalAlertsUnavailable', 'Clinical alerts unavailable')}
        subtitle={t('clinicalAlertsUnavailableDetail', 'The patient record could not be refreshed. Review allergies and outstanding investigations directly in the clinical record.')}
      />
    </div>;
  }

  if (alerts.length === 0) return null;

  return (
    <section className={styles.banner} aria-label={t('clinicalAlerts', 'Clinical alerts')}>
      {alerts.map((alert) => (
        <InlineNotification
          key={alert.id}
          kind={alert.severity === 'critical' ? 'error' : 'warning'}
          lowContrast={false}
          hideCloseButton
          title={t(alert.kind === 'allergy' ? 'potentialDrugAllergyConflict' : 'pendingLabResult', alert.title)}
          subtitle={alert.detail}
        />
      ))}
      <p className={styles.disclaimer}>
        {t('clinicalAlertsDisclaimer', 'Decision-support prompts only. Confirm against the complete clinical record and local prescribing guidance.')}
      </p>
    </section>
  );
};

export default CdsAlertBanner;
