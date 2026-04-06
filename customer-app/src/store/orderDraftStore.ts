import { create } from 'zustand';

interface OrderDraftState {
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  setPickup: (lat: number, lng: number) => void;
  setDelivery: (lat: number, lng: number) => void;
  reset: () => void;
}

export const useOrderDraftStore = create<OrderDraftState>((set) => ({
  pickupLat: null,
  pickupLng: null,
  deliveryLat: null,
  deliveryLng: null,
  setPickup: (lat, lng) => set({ pickupLat: lat, pickupLng: lng }),
  setDelivery: (lat, lng) => set({ deliveryLat: lat, deliveryLng: lng }),
  reset: () =>
    set({
      pickupLat: null,
      pickupLng: null,
      deliveryLat: null,
      deliveryLng: null,
    }),
}));
