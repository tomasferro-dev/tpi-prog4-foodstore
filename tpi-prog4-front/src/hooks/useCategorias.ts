import { useQuery } from "@tanstack/react-query";
import { categoriasApi } from "../api/categorias.api";

const KEY = "categorias";

export function useCategoriasQuery() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => categoriasApi.listar(),
    staleTime: 1000 * 60 * 5,
  });
}
