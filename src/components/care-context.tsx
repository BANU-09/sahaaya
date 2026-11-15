'use client';
import { createContext, useContext } from 'react';
import type { DashboardData } from '@/server/services/dashboard';
import type { Serialized, PublicUser } from '@/lib/client';
export type CareData = Serialized<DashboardData>;
export type CareContextType = {
  data: CareData;
  user: PublicUser;
  refresh: () => void;
  can: (key: string) => boolean;
};
export const CareContext = createContext<CareContextType | null>(null);
export function useCare() {
  const context = useContext(CareContext);
  if (!context) throw new Error('Care context missing');
  return context;
}
