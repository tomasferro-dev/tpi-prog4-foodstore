import { useQuery } from "@tanstack/react-query";
import { unidadesMedidaApi } from "../api/unidadesMedida.api";

const KEY = "unidadesMedida";

export function useUnidadesMedidaQuery() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => unidadesMedidaApi.listar(),
    staleTime: Infinity, // es un catálogo seed, no cambia
  });
}
