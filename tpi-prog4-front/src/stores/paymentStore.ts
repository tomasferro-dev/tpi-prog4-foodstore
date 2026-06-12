// paymentStore (Zustand) — estado transitorio del proceso de pago con MP.
// SIN persistencia: se resetea al recargar (el estado de verdad vive en el backend).

import { create } from "zustand";

export type CheckoutStep =
  | "idle"
  | "creando_preferencia"
  | "redirigiendo"
  | "verificando"
  | "completado"
  | "error";

export type PaymentStatus = "idle" | "pending" | "approved" | "rejected" | "in_process";

interface PaymentState {
  checkoutStep: CheckoutStep;
  initPoint: string | null;
  paymentStatus: PaymentStatus;
  error: string | null;

  startCheckout: () => void;
  setInitPoint: (initPoint: string) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const ESTADO_INICIAL = {
  checkoutStep: "idle" as CheckoutStep,
  initPoint: null,
  paymentStatus: "idle" as PaymentStatus,
  error: null,
};

export const usePaymentStore = create<PaymentState>((set) => ({
  ...ESTADO_INICIAL,

  startCheckout: () => set({ checkoutStep: "creando_preferencia", error: null }),
  setInitPoint: (initPoint) => set({ initPoint, checkoutStep: "redirigiendo" }),
  setPaymentStatus: (paymentStatus) => set({ paymentStatus }),
  setError: (error) => set({ error, checkoutStep: "error" }),
  reset: () => set({ ...ESTADO_INICIAL }),
}));
