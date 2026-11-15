'use client';
import { useEffect, useState } from 'react';
import { FolderHeart, Upload, FileText, Search } from 'lucide-react';
import { useCare } from '../care-context';
import { useLocale } from '../locale-provider';
import { Button, Modal, Field, Empty, ErrorNotice, Loading, useAction } from '../ui';
import { api, useResource } from '@/lib/client';
import { formatDate } from '@/lib/i18n';
import { DocumentHistory } from '../document-history';
type DocumentList = {
  items: {
    id: string;
    title: string;
    category: string;
    mimeType: string;
    size: number;
    createdAt: string;
    notes: string | null;
  }[];
  total: number;
  page: number;
};
export default function Records() {
  const { data, can } = useCare(),
    { t, locale } = useLocale(),
    action = useAction();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);
  const documents = useResource<DocumentList>(
    can('records.view')
      ? `patients/${data.patient.id}/documents?q=${encodeURIComponent(search)}&category=${category}&page=${page}`
      : null,
    version,
  );
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () => api(`patients/${data.patient.id}/documents`, 'POST', form),
      () => {
        setOpen(false);
        setVersion((v) => v + 1);
      },
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{t('records')}</h1>
          <p>{t('privacyText')}</p>
        </div>
        {can('records.upload') && (
          <Button onClick={() => setOpen(true)}>
            <Upload size={17} />
            {t('upload')}
          </Button>
        )}
      </div>
      {!can('records.view') ? (
        <Empty text={t('permissionRequired')} />
      ) : (
        <>
          <div className="search-bar">
            <Search size={20} />
            <input
              aria-label={t('search')}
              placeholder={t('search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label={t('category')}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('viewAll')}</option>
              {[
                'prescription',
                'report',
                'scan',
                'discharge',
                'consultation',
                'insurance',
                'other',
              ].map((key) => (
                <option key={key} value={key}>
                  {t(key)}
                </option>
              ))}
            </select>
          </div>
          <ErrorNotice code={documents.error} />
          <section className="panel">
            {!documents.data ? (
              <Loading />
            ) : documents.data.items.length ? (
              documents.data.items.map((document) => (
                <article className="record-row" key={document.id}>
                  <span className="round-icon sky">
                    <FileText size={23} />
                  </span>
                  <div>
                    <h3>{document.title}</h3>
                    <p>
                      {t(document.category)} ·{' '}
                      {formatDate(document.createdAt, locale, data.patient.timezone)} ·{' '}
                      {Math.ceil(document.size / 1024)} KB
                    </p>
                    {document.notes && <p>{document.notes}</p>}
                  </div>
                  <a
                    className="button secondary"
                    href={`/api/patients/${data.patient.id}/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('download')}
                  </a>
                  <DocumentHistory
                    path={`patients/${data.patient.id}/documents/${document.id}`}
                    edit={can('records.upload')}
                    timezone={data.patient.timezone}
                    refresh={() => setVersion((v) => v + 1)}
                  />
                </article>
              ))
            ) : (
              <Empty />
            )}
          </section>
          {documents.data && documents.data.total > 12 && (
            <div className="row between section-space">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                {t('previous')}
              </Button>
              <span>
                {page} / {Math.ceil(documents.data.total / 12)}
              </span>
              <Button
                variant="secondary"
                disabled={page * 12 >= documents.data.total}
                onClick={() => setPage((v) => v + 1)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </>
      )}
      <div className="privacy-note">
        <FolderHeart size={16} />
        {t('privacy')}
      </div>
      <Modal open={open} onOpenChange={setOpen} title={t('upload')} description={t('uploadHelp')}>
        <form className="form-stack" onSubmit={upload}>
          <Field label={t('title')}>
            <input name="title" required maxLength={150} />
          </Field>
          <Field label={t('category')}>
            <select name="category">
              {[
                'prescription',
                'report',
                'scan',
                'discharge',
                'consultation',
                'insurance',
                'other',
              ].map((key) => (
                <option key={key} value={key}>
                  {t(key)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('upload')}>
            <input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required />
          </Field>
          <Field label={t('note')}>
            <textarea name="notes" maxLength={1000} />
          </Field>
          <ErrorNotice code={action.error} />
          <Button busy={action.busy}>{t('upload')}</Button>
        </form>
      </Modal>
    </>
  );
}
