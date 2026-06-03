import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PedidoConDetalle } from "../types/pedidos";

interface CartItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  personalizacion?: number[];
}

interface CartStore {
  // Estado
  carrito: PedidoConDetalle | null;
  items: CartItem[];
  subtotal: number;
  costoEnvio: number;
  total: number;
  isLoading: boolean;

  // Acciones
  setCarrito: (carrito: PedidoConDetalle | null) => void;
  addItem: (item: CartItem) => void;
  updateItem: (productoId: number, cantidad: number) => void;
  removeItem: (productoId: number) => void;
  clearCart: () => void;
  setCostoEnvio: (costo: number) => void;
  setIsLoading: (loading: boolean) => void;
  recalcular: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      carrito: null,
      items: [],
      subtotal: 0,
      costoEnvio: 50,
      total: 0,
      isLoading: false,

      setCarrito: (carrito) => {
        if (carrito) {
          const items: CartItem[] = carrito.items.map((item) => {
            const precio = Number(item.precioSnapshot) || 0;
            const cantidad = Number(item.cantidad) || 0;
            const subtotal = precio * cantidad;
            return {
              producto_id: item.productoId,
              nombre: item.nombreSnapshot,
              cantidad,
              precio_unitario: precio,
              subtotal,
              personalizacion: item.personalizacion,
            };
          });

          const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
          const costoEnvio = Number(carrito.costoEnvio) || 0;
          const total = subtotal + costoEnvio;

          set({
            carrito,
            items,
            subtotal,
            costoEnvio,
            total,
          });
        } else {
          set({
            carrito: null,
            items: [],
            subtotal: 0,
            costoEnvio: 50,
            total: 0,
          });
        }
      },

      addItem: (newItem) => {
        const { items } = get();
        const existingIndex = items.findIndex(
          (item) => item.producto_id === newItem.producto_id
        );

        let updatedItems: CartItem[];
        if (existingIndex > -1) {
          // Actualizar cantidad
          updatedItems = [...items];
          updatedItems[existingIndex].cantidad += newItem.cantidad;
          updatedItems[existingIndex].subtotal =
            updatedItems[existingIndex].precio_unitario *
            updatedItems[existingIndex].cantidad;
        } else {
          // Agregar nuevo con valores numéricos garantizados
          const item = {
            ...newItem,
            precio_unitario: Number(newItem.precio_unitario) || 0,
            cantidad: Number(newItem.cantidad) || 1,
            subtotal: Number(newItem.subtotal) || 0,
          };
          updatedItems = [...items, item];
        }

        set({ items: updatedItems });
        get().recalcular();
      },

      updateItem: (productoId, cantidad) => {
        const { items } = get();
        const updatedItems = items.map((item) => {
          if (item.producto_id === productoId) {
            return {
              ...item,
              cantidad: Math.max(1, cantidad),
              subtotal: item.precio_unitario * Math.max(1, cantidad),
            };
          }
          return item;
        });
        set({ items: updatedItems });
        get().recalcular();
      },

      removeItem: (productoId) => {
        const { items } = get();
        const updatedItems = items.filter((item) => item.producto_id !== productoId);
        set({ items: updatedItems });
        get().recalcular();
      },

      clearCart: () => {
        set({
          carrito: null,
          items: [],
          subtotal: 0,
          costoEnvio: 50,
          total: 0,
        });
      },

      setCostoEnvio: (costo) => {
        set({ costoEnvio: costo });
        get().recalcular();
      },

      setIsLoading: (loading) => {
        set({ isLoading: loading });
      },

      recalcular: () => {
        const { items, costoEnvio } = get();
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const total = subtotal + costoEnvio;
        set({ subtotal, total });
      },
    }),
    {
      name: "cart-store",
      partialize: (state) => ({
        items: state.items,
        costoEnvio: state.costoEnvio,
      }),
      onRehydrateStorage: () => () => {
        // Después de restaurar items desde localStorage, recalcular
        // subtotal y total (que no se persisten).
        useCartStore.getState().recalcular();
      },
    }
  )
);
