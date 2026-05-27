import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriasApi, type CategoriaFormData } from "../api/categorias.api";

const KEY = "categorias";

/** Listado público (sin auth). Usado en dropdowns y catálogo. */
export function useCategoriasQuery() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => categoriasApi.listar(),
    staleTime: 1000 * 60 * 5,
  });
}

/** Listado admin. Soporta incluir dados de baja. */
export function useCategoriasAdminQuery(incluirEliminados = false) {
  return useQuery({
    queryKey: [KEY, "admin", incluirEliminados],
    queryFn: () => categoriasApi.listar(incluirEliminados),
    staleTime: 1000 * 30,
  });
}

/** Mutaciones CRUD para la vista admin. */
export function useCategoriasMutations() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: [KEY] });

  const crear = useMutation({
    mutationFn: (data: CategoriaFormData) => categoriasApi.crear(data),
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoriaFormData> }) =>
      categoriasApi.editar(id, data),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => categoriasApi.eliminar(id),
    onSuccess: invalidar,
  });

  const reactivar = useMutation({
    mutationFn: (id: number) => categoriasApi.reactivar(id),
    onSuccess: invalidar,
  });

  return { crear, editar, eliminar, reactivar };
}
