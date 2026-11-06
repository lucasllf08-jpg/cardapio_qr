'use client';
import { createContext, useContext } from 'react';
import type { Establishment, Role } from './types';

export type Profile = { name: string | null; avatar_url: string | null };
export type PanelCtx = {
  est: Establishment; role: Role; userId: string; email: string;
  profile: Profile;
  setEst: (e: Establishment) => void;
  setProfile: (p: Profile) => void;
};
export const Ctx = createContext<PanelCtx | null>(null);
export const usePanel = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePanel fora do painel');
  return c;
};
