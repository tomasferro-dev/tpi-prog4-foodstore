import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ingredientesApi } from "../api/ingredientes.api";
import type { FiltrosIngredientes, Ingrediente } from "../types";

const KEY = "ingredientes";

export function useIngredientesQuery(filtros: FiltrosIngredientes = {}) {
  return useQuery({
    queryKey: [KEY, filtros],
    queryFn: () => ingredientesApi.listar(filtros),
    staleTime: 1000 * 30,
  });
}

export function useIngredienteMutations() {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    // El stock de productos se calcula desde los insumos, hay que refrescar ambos
    qc.invalidateQueries({ queryKey: ["productos"] });
  };

  const crear = useMutation({
    mutationFn: (data: Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">) =>
      ingredientesApi.crear(data),
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">>;
    }) => ingredientesApi.editar(id, data),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => ingredientesApi.eliminar(id),
    onSuccess: invalidar,
  });

  const reactivar = useMutation({
    mutationFn: (id: number) => ingredientesApi.reactivar(id),
    onSuccess: invalidar,
  });

  return { crear, editar, eliminar, reactivar };
}
