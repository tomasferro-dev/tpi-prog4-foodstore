import { useState } from "react";
import { useCartStore } from "../stores/cartStore";
import CarritoModal from "./CarritoModal";

export default function CarritoIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const items = useCartStore((s) => s.items);

  const itemCount = items.length;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-xl border border-[#007aff]/40 bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff] hover:bg-[#007aff]/20 transition-colors"
        title="Carrito"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>

        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#ff3b30] dark:bg-[#ff453a] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </button>

      {isOpen && <CarritoModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
