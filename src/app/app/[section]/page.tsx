'use client';
import { use } from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui';
const Home = dynamic(() => import('@/components/pages/home'), { loading: Loading });
const Medicines = dynamic(() => import('@/components/pages/medicines'), { loading: Loading });
const Scan = dynamic(() => import('@/components/pages/scan'), { loading: Loading });
const Appointments = dynamic(() => import('@/components/pages/appointments'), { loading: Loading });
const Family = dynamic(() => import('@/components/pages/family'), { loading: Loading });
const Health = dynamic(() => import('@/components/pages/health'), { loading: Loading });
const Records = dynamic(() => import('@/components/pages/records'), { loading: Loading });
const Assistant = dynamic(() => import('@/components/pages/assistant'), { loading: Loading });
const Emergency = dynamic(() => import('@/components/pages/emergency'), { loading: Loading });
const Settings = dynamic(() => import('@/components/pages/settings'), { loading: Loading });
const Notifications = dynamic(() => import('@/components/pages/notifications'), {
  loading: Loading,
});
const pages: Record<string, React.ComponentType> = {
  home: Home,
  medicines: Medicines,
  scan: Scan,
  appointments: Appointments,
  family: Family,
  health: Health,
  records: Records,
  assistant: Assistant,
  emergency: Emergency,
  settings: Settings,
  notifications: Notifications,
};
export default function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const Component = pages[section] || Home;
  return <Component />;
}
