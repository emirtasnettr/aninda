import { create } from 'zustand';

export type CourierInAppNotice = {
  id: string;
  title: string;
  body: string;
  orderId?: string;
};

type State = {
  queue: CourierInAppNotice[];
  /** Bildirim API’si yoksa veya başarısız olunca kısa süreli banner */
  enqueue: (n: Omit<CourierInAppNotice, 'id'>) => void;
  dismiss: (id?: string) => void;
};

export const useCourierInAppNoticeStore = create<State>((set, get) => ({
  queue: [],
  enqueue: (n) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ queue: [...s.queue, { ...n, id }] }));
  },
  dismiss: (id) => {
    const q = get().queue;
    if (!id) {
      set({ queue: q.slice(1) });
      return;
    }
    set({ queue: q.filter((x) => x.id !== id) });
  },
}));
