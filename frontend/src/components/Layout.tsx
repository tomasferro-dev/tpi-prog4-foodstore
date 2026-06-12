import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { useInitializeCart } from "../hooks/useInitializeCart";

export default function Layout() {
  // Cargar carrito desde backend al montar
  useInitializeCart();

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f2f7] dark:bg-black">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
