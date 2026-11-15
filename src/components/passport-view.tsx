'use client';
import { PassportCard, type Passport } from './pages/emergency';
import { useResource } from '@/lib/client';
import { LanguageSelect } from './locale-provider';
import { ErrorNotice, Loading } from './ui';
export function PassportView({ token }: { token: string }) {
  const result = useResource<Passport>(`passport/${encodeURIComponent(token)}`);
  return (
    <main className="document-page">
      <LanguageSelect />
      <ErrorNotice code={result.error} />
      {result.data ? (
        <PassportCard profile={result.data} medications={result.data.medications || []} />
      ) : (
        !result.error && <Loading />
      )}
    </main>
  );
}
