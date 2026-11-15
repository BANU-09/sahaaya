import { PassportView } from '@/components/passport-view';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <PassportView token={(await searchParams).token || ''} />;
}
