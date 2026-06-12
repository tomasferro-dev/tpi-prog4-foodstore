import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { getCarritoActual } from "../api/pedidos.api";

/**
 * Hook que inicializa el carrito desde el backend al montar.
 * Se ejecuta cuando el usuario está autenticado como CLIENT.
 */
export function useInitializeCart() {
  const user = useAuthStore((s) => s.user);
  const setCarrito = useCartStore((s) => s.setCarrito);
  const setIsLoading = useCartStore((s) => s.setIsLoading);

  useEffect(() => {
    const initCart = async () => {
      // Solo inicializar si el usuario está logueado y es CLIENT
      if (!user?.roles.includes("CLIENT")) {
        return;
      }

      try {
        setIsLoading(true);
        const carrito = await getCarritoActual();
        setCarrito(carrito);
      } catch (error) {
        console.error("Error al cargar carrito:", error);
        // Si hay error, simplemente continúa con el estado actual
      } finally {
        setIsLoading(false);
      }
    };

    initCart();
  }, [user, setCarrito, setIsLoading]);
}
