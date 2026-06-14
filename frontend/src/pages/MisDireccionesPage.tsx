import { useState } from "react";
import { useDireccionesQuery, useDireccionesMutations } from "../hooks/useDirecciones";
import { useConfirm } from "../hooks/useConfirm";
import DireccionFormModal from "../components/DireccionFormModal";
import type { Direccion, DireccionFormData } from "../api/direcciones.api";

export default function MisDireccionesPage() {
  const { data: direcciones = [], isLoading, isError } = useDireccionesQuery();
  const { crear, editar, eliminar } = useDireccionesMutations();
  const { confirmar, ConfirmDialog } = useConfirm();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Direccion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abrirNueva = () => { setEditando(null); setError(null); setModalAbierto(true); };
  const abrirEditar = (d: Direccion) => { setEditando(d); setError(null); setModalAbierto(true); };

  const handleGuardar = async (data: DireccionFormData) => {
    try {
      if (editando) await editar.mutateAsync({ id: editando.id, data });
      else await crear.mutateAsync(data);
      setModalAbierto(false);
      setEditando(null);
    } catch (err: any) {
      setError(err?.detail ?? "No se pudo guardar la dirección");
    }
  };

  const handleEliminar = async (d: Direccion) => {
    const ok = await confirmar({
      titulo: "Eliminar dirección",
      mensaje: `¿Eliminar "${d.alias ?? d.linea1}"?`,
      destructivo: true,
    });
    if (ok) eliminar.mutate(d.id);
  };

  const inicial: DireccionFormData | null = editando
    ? {
        alias: editando.alias,
        linea1: editando.linea1,
        linea2: editando.linea2,
        ciudad: editando.ciudad,
        provincia: editando.provincia,
        codigoPostal: editando.codigoPostal,
        esPrincipal: editando.esPrincipal,
      }
    : null;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mis Direcciones</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestioná tus direcciones de entrega.</p>
        </div>
        <button
          onClick={abrirNueva}
          className="bg-[#007aff] dark:bg-[#0a84ff] hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-opacity"
        >
          + Nueva
        </button>
      </header>

      {isLoading && <p className="text-center text-gray-500 dark:text-gray-400 py-12">Cargando…</p>}
      {isError && <p className="text-center text-[#ff3b30] dark:text-[#ff453a] py-12">Error al cargar las direcciones.</p>}

      {!isLoading && !isError && direcciones.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="mb-3">Todavía no tenés direcciones cargadas.</p>
          <button onClick={abrirNueva} className="text-[#007aff] dark:text-[#0a84ff] font-medium">
            Agregar tu primera dirección
          </button>
        </div>
      )}

      <div className="space-y-3">
        {direcciones.map((d) => (
          <div
            key={d.id}
            className="bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#3a3a3c] rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                  {d.alias || d.linea1}
                </h2>
                {d.esPrincipal && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#34c759]/15 text-[#34c759] dark:text-[#30d158]">
                    Predeterminada
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{d.linea1}{d.linea2 ? `, ${d.linea2}` : ""}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {[d.ciudad, d.provincia, d.codigoPostal].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => abrirEditar(d)}
                className="text-sm text-[#007aff] dark:text-[#0a84ff] hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => handleEliminar(d)}
                className="text-sm text-[#ff3b30] dark:text-[#ff453a] hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-[#ff3b30] dark:text-[#ff453a] text-center">{error}</p>
      )}

      {modalAbierto && (
        <DireccionFormModal
          inicial={inicial}
          onGuardar={handleGuardar}
          onCancelar={() => { setModalAbierto(false); setEditando(null); }}
          cargando={crear.isPending || editar.isPending}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}
