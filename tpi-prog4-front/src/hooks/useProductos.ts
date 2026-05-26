import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productosApi } from "../api/productos.api";
import type { FiltrosProductos, ProductoFormData } from "../types";

const KEY = "productos";

export function useProductosQuery(filtros: FiltrosProductos = {}) {
  return useQuery({
    queryKey: [KEY, filtros],
    queryFn: () => productosApi.listar(filtros),
    staleTime: 1000 * 30,
  });
}

export function useProductoDetalleQuery(id: number | null) {
  return useQuery({
    queryKey: [KEY, "detalle", id],
    queryFn: () => productosApi.obtener(id!),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useProductoMutations() {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["ingredientes"] });
  };

  const crear = useMutation({
    mutationFn: (data: ProductoFormData) => productosApi.crear(data),
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductoFormData> }) =>
      productosApi.editar(id, data),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => productosApi.eliminar(id),
    onSuccess: invalidar,
  });

  const reactivar = useMutation({
    mutationFn: (id: number) => productosApi.reactivar(id),
    onSuccess: invalidar,
  });

  return { crear, editar, eliminar, reactivar };
}
