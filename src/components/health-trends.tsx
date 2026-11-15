'use client';
import { useLocale } from './locale-provider';
import { formatDate } from '@/lib/i18n';
import { DOSE_STATES } from '@/lib/analytics';
export type TrendDetails = {
  daily: {
    date: string;
    total: number;
    taken: number;
    notTaken: number;
    unconfirmed: number;
    states: Record<string, number>;
  }[];
  vitals: {
    id: string;
    kind: string;
    value: number;
    secondaryValue: number | null;
    unit: string;
    recordedAt: string;
  }[];
  refills: { id: string; quantity: number; createdAt: string; medication: { name: string } }[];
};
export function HealthTrends({ stats, timezone }: { stats: TrendDetails; timezone: string }) {
  const { t, locale } = useLocale();
  const groups = [...new Set(stats.vitals.map((v) => `${v.kind}|${v.unit}`))];
  return (
    <>
      <section className="panel section-space">
        <h2>{t('dailyHistory')}</h2>
        <div className="adherence-grid">
          {stats.daily.map((day) => (
            <div
              key={day.date}
              className="adherence-cell"
              style={{
                background: !day.total
                  ? '#edf1ef'
                  : day.taken === day.total
                    ? '#006c59'
                    : day.taken
                      ? '#c9e8d9'
                      : '#f6e6c6',
                color: day.total && day.taken === day.total ? '#fff' : '#193a32',
              }}
              title={`${day.date}: ${day.taken}/${day.total}`}
            >
              <small>{day.date.slice(5)}</small>
              <strong>
                {day.taken}/{day.total}
              </strong>
            </div>
          ))}
        </div>
        <details>
          <summary>{t('allStatuses')}</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('dateTime')}</th>
                  {DOSE_STATES.map((k) => (
                    <th key={k}>{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.daily.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    {DOSE_STATES.map((k) => (
                      <td key={k}>{day.states[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      {groups.length > 0 && (
        <section className="panel section-space">
          <h2>{t('vitalTrends')}</h2>
          <p>{t('trendCaution')}</p>
          {groups.map((group) => {
            const values = stats.vitals.filter((v) => `${v.kind}|${v.unit}` === group),
              nums = values.flatMap((v) =>
                v.secondaryValue === null ? [v.value] : [v.value, v.secondaryValue],
              );
            const min = Math.min(...nums),
              max = Math.max(...nums),
              range = max - min || 1;
            const first = new Date(values[0].recordedAt).getTime(),
              duration = new Date(values.at(-1)!.recordedAt).getTime() - first || 1;
            const line = (secondary: boolean) =>
              values
                .filter((v) => !secondary || v.secondaryValue !== null)
                .map(
                  (v) =>
                    `${20 + (560 * (new Date(v.recordedAt).getTime() - first)) / duration},${170 - (140 * ((secondary ? v.secondaryValue! : v.value) - min)) / range}`,
                )
                .join(' ');
            return (
              <div key={group}>
                <h3>
                  {t(values[0].kind)} · {values[0].unit}
                </h3>
                {values.length > 1 && (
                  <svg
                    viewBox="0 0 600 200"
                    role="img"
                    aria-label={`${t(values[0].kind)}: ${min}–${max} ${values[0].unit}`}
                  >
                    <line x1="20" y1="170" x2="580" y2="170" stroke="#cbd5d1" />
                    <polyline fill="none" stroke="#087563" strokeWidth="3" points={line(false)} />
                    {values.some((v) => v.secondaryValue !== null) && (
                      <polyline fill="none" stroke="#7554a6" strokeWidth="3" points={line(true)} />
                    )}
                    <text x="20" y="195" fontSize="12">
                      {formatDate(values[0].recordedAt, locale, timezone)}
                    </text>
                    <text x="580" y="195" textAnchor="end" fontSize="12">
                      {formatDate(values.at(-1)!.recordedAt, locale, timezone)}
                    </text>
                  </svg>
                )}
                <details>
                  <summary>
                    {t('measurements')} · {values.length}
                  </summary>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('dateTime')}</th>
                          <th>{t('value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {values.map((v) => (
                          <tr key={v.id}>
                            <td>
                              {formatDate(v.recordedAt, locale, timezone, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td>
                              {v.value}
                              {v.secondaryValue !== null ? ` / ${v.secondaryValue}` : ''} {v.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            );
          })}
        </section>
      )}
      {stats.refills.length > 0 && (
        <section className="panel section-space">
          <h2>{t('refillHistory')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('dateTime')}</th>
                  <th>{t('medicineName')}</th>
                  <th>{t('quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.refills.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.createdAt, locale, timezone)}</td>
                    <td>{r.medication.name}</td>
                    <td>{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
