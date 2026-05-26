import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f2f2f7] dark:bg-black">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
