'use client';
import { useState } from 'react';
import { Pill, Plus, Clock, Package, Archive } from 'lucide-react';
import { useCare, type CareData } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Modal, Status, Field, Empty, ErrorNotice, useAction } from '../ui';
import { MedicineEditor } from '../medicine-editor';
import { DoseCard } from '../dose-card';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
export default function Medicines() {
  const { data, can, refresh } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [create, setCreate] = useState(false),
    [tab, setTab] = useState('today'),
    [selected, setSelected] = useState<CareData['medications'][number] | null>(null),
    [operation, setOperation] = useState('approve'),
    [requestId, setRequestId] = useState(''),
    [verified, setVerified] = useState(false);
  function open(med: CareData['medications'][number], op: string) {
    setSelected(med);
    setOperation(op);
    setVerified(false);
    setRequestId(crypto.randomUUID());
    action.clear();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        operation === 'archive'
          ? api(`patients/${data.patient.id}/medications/${selected.id}`, 'DELETE')
          : api(
              `patients/${data.patient.id}/medications/${selected.id}/${operation}`,
              'POST',
              operation === 'approve'
                ? { verified }
                : operation === 'prn'
                  ? {
                      verified,
                      requestId,
                      witnessed: form.get('witnessed') === 'on',
                      reason: form.get('reason') || undefined,
                    }
                  : { quantity: Number(form.get('quantity')) },
            ),
      () => {
        setSelected(null);
        refresh();
      },
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('medicines')}</h1>
          <p>{t('medicalCaution')}</p>
        </div>
        {can('medications.edit') && (
          <Button onClick={() => setCreate(true)}>
            <Plus size={17} />
            {t('addMedicine')}
          </Button>
        )}
      </div>
      <div className="tabs">
        {[
          { key: 'today', label: 'todaySchedule' },
          { key: 'ACTIVE', label: 'ACTIVE' },
          { key: 'DRAFT', label: 'DRAFT' },
          { key: 'ARCHIVED', label: 'ARCHIVED' },
        ].map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? 'active' : ''}
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
            {item.key === 'DRAFT' &&
              ` (${data.medications.filter((m) => m.status === 'DRAFT').length})`}
          </button>
        ))}
      </div>
      {tab === 'today' ? (
        <section className="panel">
          {data.doses.length ? (
            data.doses.map((dose) => <DoseCard key={dose.id} dose={dose} />)
          ) : (
            <Empty text={t('noDoses')} />
          )}
        </section>
      ) : (
        <div className="cards-grid">
          {data.medications
            .filter((m) => m.status === tab)
            .map((med) => (
              <article key={med.id} className="panel medicine-card">
                <div className="row between">
                  <span className="round-icon mint">
                    <Pill />
                  </span>
                  <Status value={med.status} />
                </div>
                <div>
                  <h2>
                    {med.name}
                    <span>{med.strength}</span>
                  </h2>
                  <p style={{ fontSize: 12, marginTop: 6 }}>
                    {med.dosage} · {med.instructions}
                  </p>
                </div>
                <div className="medicine-meta">
                  <div>
                    <span>
                      <Clock size={12} style={{ display: 'inline', marginRight: 5 }} />
                      {t('frequency')}
                    </span>
                    {t(med.schedule?.frequency || 'PRN')}
                    <br />
                    {med.schedule?.times.join(' · ')}
                  </div>
                  <div>
                    <span>
                      <Package size={12} style={{ display: 'inline', marginRight: 5 }} />
                      {t('estimatedStock')}
                    </span>
                    {med.estimatedStock}
                  </div>
                  <div>
                    <span>{t('doctor')}</span>
                    {med.doctor}
                  </div>
                  <div>
                    <span>{t('startDate')}</span>
                    {med.schedule?.startDate}
                    {med.expiryDate && (
                      <p>
                        {t('expiryDate')}: {formatDate(med.expiryDate, locale)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="card-footer">
                  {med.status === 'DRAFT' && can('medications.edit') && (
                    <Button variant="secondary" onClick={() => open(med, 'edit')}>
                      {t('editDraft')}
                    </Button>
                  )}
                  {med.status === 'ACTIVE' &&
                    med.schedule?.frequency === 'PRN' &&
                    can('doses.confirm') && (
                      <Button onClick={() => open(med, 'prn')}>{t('recordPrn')}</Button>
                    )}
                  {med.status === 'DRAFT' && can('prescriptions.approve') && (
                    <Button onClick={() => open(med, 'approve')}>{t('approve')}</Button>
                  )}
                  {med.status === 'ACTIVE' && can('medications.edit') && (
                    <Button variant="secondary" onClick={() => open(med, 'refill')}>
                      {t('refill')}
                    </Button>
                  )}
                  {med.status !== 'ARCHIVED' && can('prescriptions.approve') && (
                    <Button variant="ghost" onClick={() => open(med, 'archive')}>
                      <Archive size={16} />
                      {t('archive')}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          {!data.medications.some((m) => m.status === tab) && <Empty />}
        </div>
      )}
      <Modal open={create} onOpenChange={setCreate} title={t('addMedicine')}>
        <MedicineEditor
          onSaved={() => {
            setCreate(false);
            setTab('DRAFT');
          }}
        />
      </Modal>
      <Modal
        open={Boolean(selected)}
        onOpenChange={() => setSelected(null)}
        title={t(
          operation === 'approve'
            ? 'approve'
            : operation === 'refill'
              ? 'refill'
              : operation === 'edit'
                ? 'editDraft'
                : operation === 'prn'
                  ? 'recordPrn'
                  : 'archive',
        )}
        description={selected ? `${selected.name} ${selected.strength} · ${selected.dosage}` : ''}
      >
        {operation === 'edit' && selected ? (
          <MedicineEditor
            key={selected.id}
            initial={selected}
            onSaved={() => {
              setSelected(null);
              refresh();
            }}
          />
        ) : (
          <form className="form-stack" onSubmit={submit}>
            {['approve', 'prn'].includes(operation) && (
              <>
                <p>{selected?.instructions}</p>
                <p>{selected?.schedule?.times.join(', ')}</p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    required
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  {t('verifyMedicine')}
                </label>
              </>
            )}
            {operation === 'prn' && (
              <>
                <p>{t('medicalCaution')}</p>
                {data.role !== 'PATIENT' && (
                  <label className="check-label">
                    <input type="checkbox" name="witnessed" required />
                    {t('witnessed')}
                  </label>
                )}
                <Field label={t('note')}>
                  <textarea name="reason" maxLength={500} />
                </Field>
              </>
            )}
            {operation === 'refill' && (
              <Field label={t('quantity')}>
                <input name="quantity" type="number" min="0.01" step="0.01" max="100000" required />
              </Field>
            )}
            {operation === 'archive' && <p>{t('medicalCaution')}</p>}
            <ErrorNotice code={action.error} />
            <Button busy={action.busy}>{t('confirm')}</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
