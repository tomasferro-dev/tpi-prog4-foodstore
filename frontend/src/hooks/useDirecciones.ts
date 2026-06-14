import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { direccionesApi, type DireccionFormData } from "../api/direcciones.api";

const KEY = "direcciones";

/** Direcciones del usuario logueado. */
export function useDireccionesQuery() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => direccionesApi.listar(),
    staleTime: 1000 * 60,
  });
}

/** Mutaciones CRUD de direcciones (invalidan el listado al terminar). */
export function useDireccionesMutations() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: [KEY] });

  const crear = useMutation({
    mutationFn: (data: DireccionFormData) => direccionesApi.crear(data),
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DireccionFormData> }) =>
      direccionesApi.editar(id, data),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => direccionesApi.eliminar(id),
    onSuccess: invalidar,
  });

  return { crear, editar, eliminar };
}
