'use client';
import { useState } from 'react';
import { Check, Clock, HeartHandshake, Pill } from 'lucide-react';
import { useCare, type CareData } from './care-context';
import { useLocale } from './locale-provider';
import { Button, ErrorNotice, Modal, Status, useAction, ReadAloud } from './ui';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
export function DoseCard({
  dose,
  featured = false,
}: {
  dose: CareData['doses'][number];
  featured?: boolean;
}) {
  const { data, refresh, can } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [confirm, setConfirm] = useState(false),
    [witnessed, setWitnessed] = useState(false);
  const terminal = ['TAKEN', 'NOT_TAKEN', 'CANCELLED'].includes(dose.status);
  const available =
    new Date(dose.scheduledAt).getTime() < new Date(data.serverNow).getTime() + 3600000;
  async function record(value: string) {
    await action.run(
      () =>
        api(`patients/${data.patient.id}/doses/${dose.id}`, 'POST', { action: value, witnessed }),
      () => {
        setConfirm(false);
        refresh();
      },
    );
  }
  return (
    <article
      className={`dose-card ${featured ? 'featured' : ''} ${terminal ? 'dose-complete' : ''}`}
    >
      <div className="dose-time">
        <Clock size={16} />
        <time dateTime={dose.scheduledAt}>
          {formatDate(dose.scheduledAt, locale, data.patient.timezone, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
      </div>
      <div className="dose-main">
        <span className={`round-icon ${terminal ? 'mint' : 'peach'}`}>
          {terminal ? <Check size={23} /> : <Pill size={24} />}
        </span>
        <div>
          <h3>
            {dose.medication.name} <span>{dose.medication.strength}</span>
          </h3>
          <p>
            {dose.medication.dosage}
            <span className="middot">·</span>
            {dose.medication.instructions}
          </p>
        </div>
        <ReadAloud
          text={`${dose.medication.name}, ${dose.medication.strength}, ${dose.medication.dosage}. ${dose.medication.instructions}`}
        />
      </div>
      <div className="dose-actions">
        {terminal ? (
          <Status value={dose.status} />
        ) : can('doses.confirm') ? (
          <>
            <Button disabled={!available} busy={action.busy} onClick={() => setConfirm(true)}>
              <Check size={19} />
              {t('taken')}
            </Button>
            <Button
              variant="secondary"
              disabled={!available}
              busy={action.busy}
              onClick={() => record('SNOOZED')}
            >
              <Clock size={17} />
              {t('later')}
            </Button>
            <button
              className="text-link"
              disabled={!available || action.busy}
              onClick={() => record('HELP')}
            >
              <HeartHandshake size={17} />
              {t('needHelp')}
            </button>
          </>
        ) : (
          <Status value={dose.status} />
        )}
      </div>
      <ErrorNotice code={action.error} />
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t('taken')}
        description={`${dose.medication.name} ${dose.medication.strength} · ${dose.medication.dosage}`}
      >
        <div className="form-stack">
          {data.role !== 'PATIENT' && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={witnessed}
                onChange={(e) => setWitnessed(e.target.checked)}
              />
              {t('witnessed')}
            </label>
          )}
          <ErrorNotice code={action.error} />
          <Button
            busy={action.busy}
            disabled={data.role !== 'PATIENT' && !witnessed}
            onClick={() => record('TAKEN')}
          >
            {t('confirm')}
          </Button>
          <Button busy={action.busy} variant="secondary" onClick={() => record('NOT_TAKEN')}>
            {t('notTaken')}
          </Button>
        </div>
      </Modal>
    </article>
  );
}
