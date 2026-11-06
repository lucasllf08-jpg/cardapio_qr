'use client';
import { createContext, useContext } from 'react';
import type { Establishment, Role } from './types';

export type PanelCtx = {
  est: Establishment; role: Role; userId: string;
  setEst: (e: Establishment) => void;
};
export const Ctx = createContext<PanelCtx | null>(null);
export const usePanel = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePanel fora do painel');
  return c;
};
