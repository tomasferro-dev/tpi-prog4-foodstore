// cartStore (Zustand) — carrito 100% client-side (RN-CR01).
// No existe carrito en el backend: el pedido se crea recién en el checkout.
// Persiste items + costoEnvio en localStorage; sobrevive refresh/cierre/logout.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  personalizacion?: number[];
}

interface CartStore {
  items: CartItem[];
  subtotal: number;
  costoEnvio: number;
  total: number;

  addItem: (item: CartItem) => void;
  updateItem: (productoId: number, cantidad: number) => void;
  removeItem: (productoId: number) => void;
  clearCart: () => void;
  setCostoEnvio: (costo: number) => void;
  recalcular: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,
      costoEnvio: 50,
      total: 0,

      addItem: (newItem) => {
        const { items } = get();
        const idx = items.findIndex((i) => i.producto_id === newItem.producto_id);

        let updated: CartItem[];
        if (idx > -1) {
          updated = [...items];
          updated[idx].cantidad += newItem.cantidad;
          updated[idx].subtotal = updated[idx].precio_unitario * updated[idx].cantidad;
          if (newItem.personalizacion) updated[idx].personalizacion = newItem.personalizacion;
        } else {
          updated = [
            ...items,
            {
              ...newItem,
              precio_unitario: Number(newItem.precio_unitario) || 0,
              cantidad: Number(newItem.cantidad) || 1,
              subtotal: Number(newItem.subtotal) || 0,
            },
          ];
        }
        set({ items: updated });
        get().recalcular();
      },

      updateItem: (productoId, cantidad) => {
        const { items } = get();
        const updated = items.map((item) =>
          item.producto_id === productoId
            ? {
                ...item,
                cantidad: Math.max(1, cantidad),
                subtotal: item.precio_unitario * Math.max(1, cantidad),
              }
            : item
        );
        set({ items: updated });
        get().recalcular();
      },

      removeItem: (productoId) => {
        set({ items: get().items.filter((i) => i.producto_id !== productoId) });
        get().recalcular();
      },

      clearCart: () => set({ items: [], subtotal: 0, costoEnvio: 50, total: 0 }),

      setCostoEnvio: (costo) => {
        set({ costoEnvio: costo });
        get().recalcular();
      },

      recalcular: () => {
        const { items, costoEnvio } = get();
        const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
        set({ subtotal, total: subtotal + costoEnvio });
      },
    }),
    {
      name: "cart-store",
      partialize: (state) => ({ items: state.items, costoEnvio: state.costoEnvio }),
      onRehydrateStorage: () => () => {
        // Recalcular subtotal/total (no se persisten) tras restaurar items
        useCartStore.getState().recalcular();
      },
    }
  )
);
