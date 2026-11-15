'use client';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, LoaderCircle, Heart, ShieldCheck, Volume2, Mic } from 'lucide-react';
import { useLocale } from './locale-provider';
import { ClientError } from '@/lib/client';
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg aria-hidden="true" viewBox="0 0 48 48" width="43" height="43">
        <rect width="48" height="48" rx="16" fill="currentColor" />
        <path
          d="M24 30c-3-3-11-7-11-13 0-6 8-7 11-2 3-5 11-4 11 2 0 6-8 10-11 13Z"
          fill="#fff8ed"
        />
        <path
          d="M9 29c4 7 11 10 15 10s11-3 15-10M10 28l5-3m23 3-5-3"
          stroke="#a9dcc4"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {!compact && (
        <span>
          sahaaya<span className="brand-dot">.</span>
          <small>care that connects</small>
        </span>
      )}
    </span>
  );
}
export function Button({
  children,
  variant = 'primary',
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${props.className || ''}`}
      aria-busy={busy}
    >
      {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Modal({
  title,
  description,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t('close')}>
              <X size={22} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? 'muted' : 'sr-only'}>
            {description || title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useLocale();
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <span aria-hidden="true">
        {['TAKEN', 'ACTIVE', 'COMPLETED', 'CONFIRMED'].includes(value)
          ? '✓'
          : value === 'ESCALATED'
            ? '!'
            : '•'}
      </span>
      {t(value)}
    </span>
  );
}
export function Empty({ text }: { text?: string }) {
  const { t } = useLocale();
  return (
    <div className="empty">
      <Heart size={30} strokeWidth={1.5} />
      <p>{text || t('empty')}</p>
    </div>
  );
}
export function ErrorNotice({ code }: { code: string | null }) {
  const { t } = useLocale();
  return code ? (
    <div className="notice error" role="alert">
      {t(code)}
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useLocale();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      {t('loading')}
    </div>
  );
}
export function PrivacyNote() {
  const { t } = useLocale();
  return (
    <div className="privacy-note">
      <ShieldCheck size={16} />
      <span>{t('privacy')}</span>
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  async function run<T>(action: () => Promise<T>, onSuccess?: (value: T) => void) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage('saved');
      onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err instanceof ClientError ? err.code : 'serverError');
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    run,
    clear: () => {
      setError(null);
      setMessage(null);
    },
  };
}
export function ReadAloud({ text }: { text: string }) {
  const { locale, t } = useLocale();
  const [error, setError] = useState(false);
  function speak() {
    if (!('speechSynthesis' in window)) {
      setError(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = `${locale}-IN`;
    window.speechSynthesis.speak(utterance);
  }
  return (
    <>
      <button type="button" className="icon-button" onClick={speak} aria-label={t('readAloud')}>
        <Volume2 size={20} />
      </button>
      {error && <span role="status">{t('voiceUnavailable')}</span>}
    </>
  );
}
type SpeechResultEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export function VoiceInput({ onResult }: { onResult: (text: string) => void }) {
  const { locale, t } = useLocale();
  const [error, setError] = useState(false);
  const [consent, setConsent] = useState(false);
  function listen() {
    const Speech =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionInstance;
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
      ).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;
    if (!Speech) {
      setError(true);
      return;
    }
    const recognition = new Speech();
    recognition.lang = `${locale}-IN`;
    recognition.interimResults = false;
    recognition.onresult = (event) => onResult(event.results[0][0].transcript);
    recognition.onerror = () => setError(true);
    recognition.start();
  }
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={t('voice')}
        onClick={() => setConsent(true)}
      >
        <Mic size={20} />
      </button>
      <Modal
        open={consent}
        onOpenChange={setConsent}
        title={t('voice')}
        description={t('voicePrivacy')}
      >
        <Button
          type="button"
          onClick={() => {
            setConsent(false);
            listen();
          }}
        >
          {t('confirm')}
        </Button>
      </Modal>
      {error && <small role="status">{t('voiceUnavailable')}</small>}
    </>
  );
}
