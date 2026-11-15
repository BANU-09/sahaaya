'use client';
import { useEffect, useState } from 'react';
import { useLocale } from './locale-provider';
import { Button, ErrorNotice, useAction } from './ui';
import { api, useResource } from '@/lib/client';
import { enablePush } from '@/lib/push';

export function PushSettings({
  enabled,
  demo,
  onChange,
}: {
  enabled: boolean;
  demo: boolean;
  onChange: () => void;
}) {
  const { t } = useLocale();
  const action = useAction();
  const [testId, setTestId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const result = useResource<{ status: string }>(testId ? `push/test/${testId}` : null, version);
  const status = result.data?.status;
  useEffect(() => {
    if (!testId || status === 'DELIVERED' || status === 'FAILED') return;
    let remaining = 12;
    const timer = setInterval(() => {
      setVersion((v) => v + 1);
      if (--remaining === 0) clearInterval(timer);
    }, 2500);
    return () => clearInterval(timer);
  }, [testId, status]);
  return (
    <div className="form-stack section-space">
      <ErrorNotice code={action.error || result.error} />
      <Button
        variant="secondary"
        disabled={demo}
        busy={action.busy}
        onClick={() => action.run(enablePush, onChange)}
      >
        {t('pushReminders')}
      </Button>
      {demo && <p className="muted">{t('demoExternalDisabled')}</p>}
      {enabled && !demo && (
        <>
          <Button
            variant="secondary"
            busy={action.busy}
            onClick={() =>
              action.run(
                () => api<{ id: string }>('push/test', 'POST', {}),
                (value) => setTestId(value.id),
              )
            }
          >
            {t('testPush')}
          </Button>
          {testId && <p role="status">{t(status || 'PROCESSING')}</p>}
          <Button
            variant="ghost"
            busy={action.busy}
            onClick={() =>
              action.run(async () => {
                await api('push', 'DELETE');
                await api('settings', 'PATCH', { push: false });
                setTestId(null);
              }, onChange)
            }
          >
            {t('revoke')}
          </Button>
        </>
      )}
    </div>
  );
}
