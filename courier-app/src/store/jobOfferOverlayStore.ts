import { create } from 'zustand';
import type { JobRequestPayload } from '../lib/api/types';

type JobOfferOverlayState = {
  activeOffer: JobRequestPayload | null;
  show: (p: JobRequestPayload) => void;
  dismiss: () => void;
};

export const useJobOfferOverlayStore = create<JobOfferOverlayState>((set, get) => ({
  activeOffer: null,
  show: (p) => {
    const cur = get().activeOffer;
    if (cur?.orderId === p.orderId) {
      return;
    }
    set({ activeOffer: p });
  },
  dismiss: () => set({ activeOffer: null }),
}));
