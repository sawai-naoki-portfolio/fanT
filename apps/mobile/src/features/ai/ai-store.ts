import type { Credits } from '@fant/api-types';
import { create } from 'zustand';

import { reportError } from '../analytics/analytics';
import { fetchCredits } from './ai-client';

interface AiState {
  /** The AI credit balance (AI-07); `null` until loaded or when offline. */
  readonly credits: Credits | null;
  readonly refreshCredits: () => Promise<void>;
  readonly setCredits: (credits: Credits) => void;
}

export const useAi = create<AiState>()((set) => ({
  credits: null,
  refreshCredits: async () => {
    try {
      set({ credits: await fetchCredits() });
    } catch (error) {
      reportError(error, 'ai.credits');
    }
  },
  setCredits: (credits) => {
    set({ credits });
  },
}));
