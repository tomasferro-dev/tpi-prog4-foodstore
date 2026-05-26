import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi } from "../api/config.api";
import type { ConfigPrecio } from "../types";

const KEY = "configPrecio";

export function useConfigQuery() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => configApi.obtener(),
    staleTime: 1000 * 60,
  });
}

export function useConfigMutation() {
  const qc = useQueryClient();

  return useMutation<ConfigPrecio, Error, Partial<ConfigPrecio>>({
    mutationFn: (data: Partial<ConfigPrecio>) => configApi.actualizar(data),
    onSuccess: (nueva: ConfigPrecio) => {
      qc.setQueryData([KEY], nueva);
      qc.invalidateQueries({ queryKey: ["productos"] });
    },
  });
}
