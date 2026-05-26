// useConfirm — reemplaza window.confirm() con un alert estilo iOS.
// Uso:
//   const { confirmar, ConfirmDialog } = useConfirm();
//   const ok = await confirmar({ titulo: "Eliminar", mensaje: "...", destructivo: true });
//   if (ok) hacer();
//   // en el JSX: {ConfirmDialog}

import { useState, useCallback } from "react";

interface Opciones {
  titulo: string;
  mensaje?: string;
  labelConfirmar?: string;
  labelCancelar?: string;
  destructivo?: boolean;
}

interface Estado {
  opciones: Opciones;
  resolver: (v: boolean) => void;
}

export function useConfirm() {
  const [estado, setEstado] = useState<Estado | null>(null);

  const confirmar = useCallback((opciones: Opciones): Promise<boolean> => {
    return new Promise((resolver) => {
      setEstado({ opciones, resolver });
    });
  }, []);

  function aceptar() {
    estado?.resolver(true);
    setEstado(null);
  }

  function cancelar() {
    estado?.resolver(false);
    setEstado(null);
  }

  const ConfirmDialog = estado ? (
    <IOSAlert
      titulo={estado.opciones.titulo}
      mensaje={estado.opciones.mensaje}
      labelConfirmar={estado.opciones.labelConfirmar ?? (estado.opciones.destructivo ? "Eliminar" : "Aceptar")}
      labelCancelar={estado.opciones.labelCancelar ?? "Cancelar"}
      destructivo={estado.opciones.destructivo ?? false}
      onConfirmar={aceptar}
      onCancelar={cancelar}
    />
  ) : null;

  return { confirmar, ConfirmDialog };
}

// ---------- Componente visual ----------

interface AlertProps {
  titulo: string;
  mensaje?: string;
  labelConfirmar: string;
  labelCancelar: string;
  destructivo: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

function IOSAlert({ titulo, mensaje, labelConfirmar, labelCancelar, destructivo, onConfirmar, onCancelar }: AlertProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="w-[270px] bg-white/95 dark:bg-[#2c2c2e]/95 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ backdropFilter: "blur(40px)" }}
      >
        {/* Contenido */}
        <div className="px-4 pt-5 pb-4 text-center">
          <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
            {titulo}
          </p>
          {mensaje && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
              {mensaje}
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="border-t border-gray-200 dark:border-[#3a3a3c] flex">
          {/* Cancelar */}
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-3 text-sm font-medium text-[#007aff] dark:text-[#0a84ff] hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors border-r border-gray-200 dark:border-[#3a3a3c]"
          >
            {labelCancelar}
          </button>

          {/* Confirmar */}
          <button
            type="button"
            onClick={onConfirmar}
            className={`flex-1 py-3 text-sm font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-[#3a3a3c] ${
              destructivo
                ? "text-[#ff3b30] dark:text-[#ff453a]"
                : "text-[#007aff] dark:text-[#0a84ff]"
            }`}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
