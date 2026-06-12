interface Props {
  total: number;
  skip: number;
  limit: number;
  onCambioPagina: (nuevoSkip: number) => void;
}

export default function Pagination({ total, skip, limit, onCambioPagina }: Props) {
  const paginaActual = Math.floor(skip / limit) + 1;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  const desde = total === 0 ? 0 : skip + 1;
  const hasta = Math.min(skip + limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 text-sm">
      <p className="text-gray-600 dark:text-gray-400">
        Mostrando <span className="font-medium">{desde}</span> -{" "}
        <span className="font-medium">{hasta}</span> de{" "}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambioPagina(Math.max(0, skip - limit))}
          disabled={skip === 0}
          className="px-3 py-1 border border-gray-300 dark:border-[#3a3a3c] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>
        <span className="text-gray-700 dark:text-gray-300">
          {paginaActual} / {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => { if (skip + limit < total) onCambioPagina(skip + limit); }}
          disabled={skip + limit >= total}
          className="px-3 py-1 border border-gray-300 dark:border-[#3a3a3c] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
