// App — v2: rutas actualizadas, agrega /admin/config para ADMIN.

import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CatalogoPage from "./pages/CatalogoPage";
import ProductosAdminPage from "./pages/ProductosAdminPage";
import InsumosAdminPage from "./pages/InsumosAdminPage";
import CategoriasAdminPage from "./pages/CategoriasAdminPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import PrivateRoute from "./routes/PrivateRoute";
import Layout from "./components/Layout";

export default function App() {
  return (
    <Routes>
      {/* Públicas sin Navbar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Con Navbar */}
      <Route element={<Layout />}>
        {/* Catálogo: público */}
        <Route path="/" element={<CatalogoPage />} />

        {/* Gestión productos: ADMIN o STOCK */}
        <Route
          path="/admin/productos"
          element={
            <PrivateRoute roles={["ADMIN", "STOCK"]}>
              <ProductosAdminPage />
            </PrivateRoute>
          }
        />

        {/* Gestión insumos: ADMIN o STOCK */}
        <Route
          path="/admin/insumos"
          element={
            <PrivateRoute roles={["ADMIN", "STOCK"]}>
              <InsumosAdminPage />
            </PrivateRoute>
          }
        />

        {/* Gestión categorías: solo ADMIN */}
        <Route
          path="/admin/categorias"
          element={
            <PrivateRoute roles={["ADMIN"]}>
              <CategoriasAdminPage />
            </PrivateRoute>
          }
        />

        {/* Configuración de precios: solo ADMIN */}
        <Route
          path="/admin/config"
          element={
            <PrivateRoute roles={["ADMIN"]}>
              <AdminConfigPage />
            </PrivateRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
