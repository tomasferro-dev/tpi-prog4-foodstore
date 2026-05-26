// Toggle estilo iOS — verde cuando esta activo, gris cuando no.

import { useThemeStore } from "../stores/themeStore";

export default function DarkModeToggle() {
  const { dark, toggle } = useThemeStore();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo oscuro"
      onClick={toggle}
      className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none
        w-[51px] h-[31px]
        ${dark ? "bg-[#34c759]" : "bg-[#e5e5ea] dark:bg-[#39393d]"}`}
    >
      <span
        className={`inline-block w-[27px] h-[27px] bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out
          ${dark ? "translate-x-[22px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}
