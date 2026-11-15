'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ShieldPlus, Phone, Printer, MapPin } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Modal, ErrorNotice, Loading, useAction } from '../ui';
import { api, useResource, type Config } from '@/lib/client';
export type Passport = {
  name: string;
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  emergencyName: string | null;
  emergencyPhone: string | null;
  hospital?: string | null;
  primaryDoctor?: string | null;
  medications?: { name: string; strength: string; dosage: string }[];
};
export function PassportCard({
  profile,
  medications,
}: {
  profile: Passport;
  medications: { name: string; strength: string; dosage: string }[];
}) {
  const { t } = useLocale();
  return (
    <article className="passport-card">
      <header className="passport-header">
        <div>
          <p>SAHAAYA · {t('emergency')}</p>
          <h2>{profile.name}</h2>
        </div>
        <ShieldPlus size={39} strokeWidth={1.3} />
      </header>
      <div className="passport-body">
        <dl className="passport-grid">
          {[
            { key: 'bloodGroup', value: profile.bloodGroup },
            { key: 'allergies', value: profile.allergies.join(', ') },
            { key: 'conditions', value: profile.conditions.join(', ') },
            { key: 'emergencyContact', value: profile.emergencyName },
            { key: 'hospital', value: profile.hospital },
            { key: 'doctor', value: profile.primaryDoctor },
          ].map((field) => (
            <div key={field.key}>
              <dt>{t(field.key)}</dt>
              <dd>{field.value || t('unknown')}</dd>
            </div>
          ))}
        </dl>
        <h3 className="section-space">{t('medicines')}</h3>
        {medications.map((med, i) => (
          <p key={i} className="inline-summary">
            {med.name} {med.strength} · {med.dosage}
          </p>
        ))}
        {profile.emergencyPhone && (
          <a className="button primary section-space" href={`tel:${profile.emergencyPhone}`}>
            <Phone size={17} />
            {t('call')} · {profile.emergencyPhone}
          </a>
        )}
      </div>
    </article>
  );
}
export default function Emergency() {
  const { data } = useCare(),
    { t } = useLocale(),
    action = useAction();
  const profile = useResource<Passport>(`patients/${data.patient.id}/profile`),
    config = useResource<Config>('config');
  const [share, setShare] = useState<{ url: string; qr: string } | null>(null),
    [places, setPlaces] = useState<
      { displayName: { text: string }; formattedAddress: string; googleMapsUri: string }[]
    >([]);
  async function createShare() {
    await action.run(async () => {
      const result = await api<{ url: string }>(
        `patients/${data.patient.id}/emergency-share`,
        'POST',
        {},
      );
      const QR = await import('qrcode');
      return { url: result.url, qr: await QR.toDataURL(result.url, { width: 220, margin: 2 }) };
    }, setShare);
  }
  async function nearby() {
    await action.run(
      async () => {
        const location = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
        );
        return api<{ places?: typeof places }>(`patients/${data.patient.id}/nearby`, 'POST', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      },
      (result) => setPlaces(result.places || []),
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('emergency')}</h1>
          <p>{t('emergencyHelp')}</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={18} />
          {t('print')}
        </Button>
      </div>
      <ErrorNotice code={profile.error || action.error} />
      {profile.data ? (
        <PassportCard
          profile={profile.data}
          medications={data.medications.filter((m) => m.status === 'ACTIVE')}
        />
      ) : (
        <Loading />
      )}
      <div className="row wrap section-space no-print" style={{ justifyContent: 'center' }}>
        {config.data?.emergencyNumber && (
          <a className="button danger" href={`tel:${config.data.emergencyNumber}`}>
            <Phone size={18} />
            {config.data.emergencyNumber}
          </a>
        )}
        {data.role === 'PATIENT' && (
          <>
            <Button onClick={createShare} busy={action.busy}>
              {t('sharePassport')}
            </Button>
            <Button
              variant="secondary"
              busy={action.busy}
              onClick={() =>
                action.run(
                  () => api(`patients/${data.patient.id}/emergency-share`, 'DELETE'),
                  () => setShare(null),
                )
              }
            >
              {t('revoke')}
            </Button>
          </>
        )}
        {config.data?.integrations.maps && (
          <Button variant="secondary" busy={action.busy} onClick={nearby}>
            <MapPin size={17} />
            {t('findNearby')}
          </Button>
        )}
      </div>
      {places.map((place, i) => (
        <article className="panel section-space no-print" key={i}>
          <h3>{place.displayName.text}</h3>
          <p>{place.formattedAddress}</p>
          <a href={place.googleMapsUri} target="_blank" rel="noreferrer" className="text-link">
            {t('directions')}
          </a>
        </article>
      ))}
      <Modal
        open={Boolean(share)}
        onOpenChange={() => setShare(null)}
        title={t('sharePassport')}
        description={t('privacyText')}
      >
        {share && (
          <>
            <Image
              src={share.qr}
              width={180}
              height={180}
              alt={t('emergency')}
              className="qr-code"
            />
            <p className="share-link">{share.url}</p>
            <Button onClick={() => action.run(() => navigator.clipboard.writeText(share.url))}>
              {t('copyLink')}
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
