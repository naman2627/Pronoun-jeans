import { create } from 'zustand';
import api from '../api/axios';

export const useCartStore = create((set) => ({
  cartCount:       0,
  cartTotal:       0,
  eligibleBuyers:  [],
  selectedBuyerId: null,

  fetchCart: async () => {
    try {
      const res   = await api.get('orders/cart/');
      const items = res.data?.items ?? [];
      const count = items.reduce((s, i) => s + i.quantity, 0);
      const total = items.reduce((s, i) => s + parseFloat(i.variation?.b2b_price ?? 0) * i.quantity, 0);
      set({ cartCount: count, cartTotal: total });
    } catch {
      // silently fail
    }
  },

  fetchEligibleBuyers: async () => {
    try {
      const res = await api.get('orders/agent/eligible-buyers/');
      set({ eligibleBuyers: res.data ?? [] });
    } catch {
      set({ eligibleBuyers: [] });
    }
  },

  setSelectedBuyer: (buyerId) => set({ selectedBuyerId: buyerId }),
  clearSelectedBuyer: ()      => set({ selectedBuyerId: null }),
}));