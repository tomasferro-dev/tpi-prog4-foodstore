// App — v4: agrega Panel de Pedidos para rol PEDIDOS.

import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CatalogoPage from "./pages/CatalogoPage";
import CheckoutPage from "./pages/CheckoutPage";
import PedidoConfirmadoPage from "./pages/PedidoConfirmadoPage";
import MisPedidosPage from "./pages/MisPedidosPage";
import PagoSuccessPage from "./pages/PagoSuccessPage";
import PagoFailurePage from "./pages/PagoFailurePage";
import PagoPendingPage from "./pages/PagoPendingPage";
import ProductosAdminPage from "./pages/ProductosAdminPage";
import InsumosAdminPage from "./pages/InsumosAdminPage";
import CategoriasAdminPage from "./pages/CategoriasAdminPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import PanelPedidosPage from "./pages/PanelPedidosPage";
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

        {/* Carrito y Checkout: solo CLIENT */}
        <Route
          path="/checkout"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <CheckoutPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/pedido-confirmado"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <PedidoConfirmadoPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/mis-pedidos"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <MisPedidosPage />
            </PrivateRoute>
          }
        />

        {/* Retorno de Mercado Pago — requiere estar logueado como CLIENT */}
        <Route
          path="/pago/success"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <PagoSuccessPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/pago/failure"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <PagoFailurePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/pago/pending"
          element={
            <PrivateRoute roles={["CLIENT"]}>
              <PagoPendingPage />
            </PrivateRoute>
          }
        />

        {/* Panel de pedidos: ADMIN o PEDIDOS */}
        <Route
          path="/admin/pedidos"
          element={
            <PrivateRoute roles={["ADMIN", "PEDIDOS"]}>
              <PanelPedidosPage />
            </PrivateRoute>
          }
        />

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
