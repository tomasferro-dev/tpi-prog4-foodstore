// Modal de confirmación genérico para borrados / reactivaciones.

interface Props {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  variante?: "peligro" | "info";
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  variante = "info",
  onConfirmar,
  onCancelar,
}: Props) {
  if (!abierto) return null;

  const colorBoton =
    variante === "peligro" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{titulo}</h3>
        <p className="text-gray-600 mb-6">{mensaje}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className={`px-4 py-2 ${colorBoton} text-white rounded-lg`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
