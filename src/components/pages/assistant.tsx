'use client';
import { useState } from 'react';
import { Sparkles, ArrowUp, ArrowUpRight } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, ErrorNotice, ReadAloud, VoiceInput, useAction } from '../ui';
import { api, useResource, type Config } from '@/lib/client';
import { CompanionActions } from '../companion-actions';
type Answer = { text: string; mode: string; sources: { id: string; type: string }[] };
export default function Assistant() {
  const { data, user } = useCare(),
    { t } = useLocale(),
    action = useAction();
  const [question, setQuestion] = useState(''),
    [useAI, setUseAI] = useState(false),
    [messages, setMessages] = useState<{ question: string; answer: Answer }[]>([]);
  const config = useResource<Config>('config');
  async function ask(value: string) {
    if (!value.trim()) return;
    await action.run(
      () =>
        api<Answer>(`patients/${data.patient.id}/companion`, 'POST', { question: value, useAI }),
      (answer) => {
        setMessages((old) => [...old, { question: value, answer }]);
        setQuestion('');
      },
    );
  }
  return (
    <div className="assistant-container">
      <div className="companion-welcome">
        <span className="round-icon lavender">
          <Sparkles size={34} />
        </span>
        <span className="eyebrow" style={{ justifyContent: 'center' }}>
          SAHAAYA COMPANION
        </span>
        <h1>{t('aiIntro')}</h1>
        <p>{t('dashboardIntro')}</p>
      </div>
      <div className="suggested-questions">
        {['todaySchedule', 'nextAppointment', 'estimatedStock', 'visitSummary'].map((key) => (
          <button key={key} disabled={action.busy} onClick={() => ask(t(key))}>
            {t(key)}
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {messages.map((message, i) => (
          <div key={i}>
            <div className="chat-message">{message.question}</div>
            <div className="chat-message answer">
              <div>{message.answer.text}</div>
              <small>
                {t(message.answer.mode)} · {message.answer.sources.length} {t('records')}
              </small>
              <ReadAloud text={message.answer.text} />
            </div>
          </div>
        ))}
      </div>
      <ErrorNotice code={action.error} />
      <CompanionActions />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="chat-input"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label={t('ask')}
          placeholder={t('askPlaceholder')}
          required
          maxLength={2000}
        />
        <VoiceInput onResult={setQuestion} />
        <Button type="submit" aria-label={t('send')} busy={action.busy}>
          <ArrowUp size={21} />
        </Button>
      </form>
      {!user.demo && config.data?.integrations.gemini && (
        <label className="check-label section-space">
          <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
          {t('aiConsent')}
        </label>
      )}
      <p className="privacy-note">{t('medicalCaution')}</p>
    </div>
  );
}
