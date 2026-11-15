'use client';
import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useLocale } from '../locale-provider';
import { useCare } from '../care-context';
import { Button, Empty, ErrorNotice, Loading, useAction } from '../ui';
import { api, useResource } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
type Notification = {
  id: string;
  key: string;
  readAt: string | null;
  createdAt: string;
  status: string;
};
export default function Notifications() {
  const { t, locale } = useLocale(),
    { user } = useCare(),
    [version, setVersion] = useState(0),
    action = useAction();
  const result = useResource<Notification[]>('notifications', version);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('notifications')}</h1>
          <p>{t('careReminder')}</p>
        </div>
        <Bell size={26} />
      </div>
      <ErrorNotice code={result.error || action.error} />
      <section className="panel">
        {!result.data ? (
          <Loading />
        ) : result.data.length ? (
          result.data.map((notification) => (
            <article
              className={`notification-item ${notification.readAt ? 'read' : ''}`}
              key={notification.id}
            >
              <span className="round-icon mint">
                <Bell size={22} />
              </span>
              <div>
                <h3>{t(notification.key)}</h3>
                <p>{t('careReminder')}</p>
                <time>
                  {formatDate(notification.createdAt, locale, user.timezone, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
              {!notification.readAt && (
                <Button
                  variant="secondary"
                  busy={action.busy}
                  onClick={() =>
                    action.run(
                      () => api(`notifications/${notification.id}`, 'PATCH', {}),
                      () => setVersion((v) => v + 1),
                    )
                  }
                >
                  <Check size={16} />
                  {t('read')}
                </Button>
              )}
            </article>
          ))
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
