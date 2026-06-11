# Changelog — Food Store

## feat/mejora-formularios-admin → `main` *(mergeado 27/05/2026)*

### Formularios admin de productos e insumos
- `ProductoFormModal`: rediseño a pantalla completa con layout 2 columnas (info general / precio y categorías), drawer lateral deslizable para ingredientes, combobox con búsqueda, chips toggle para categorías, preview de imagen por URL.
- `IngredienteFormModal`: pantalla completa 2 columnas con resumen de valor total de stock en tiempo real.
- Fix: colores de `<select>` en modo oscuro (texto blanco sobre fondo oscuro).

### Tipo de producto: elaborado vs. terminado
- Backend: campo `tipo_producto` en modelo `Producto`; nuevo endpoint `POST /admin/productos/completo` y `PATCH /admin/productos/{id}/stock`.
- Lógica de stock diferenciada: los **elaborados** calculan su stock disponible a partir de los ingredientes; los **terminados** tienen stock directo ajustable.
- Frontend: selector de tipo en el formulario de creación, `StockAjusteModal` con modo absoluto y delta +/−, badge de tipo en `ProductoCard`, botón de stock solo para terminados.

### Fix unidades de medida y seed
- Unidades reducidas a 3 (kg, L, u); cantidades e ingredientes convertidas (200g → 0,2 kg).
- `ProductosAdminPage`: query dedicada con soporte `include_deleted` para ver productos dados de baja.

### Panel de categorías (solo ADMIN)
- Backend: `GET /categorias` con `include_deleted`, `POST /categorias/{id}/reactivar`, validación de ciclos en `parent_id`, protección contra borrar con hijos activos.
- Frontend: `CategoriasAdminPage` con árbol expandible por nodo, búsqueda, badges de nivel, acciones inline (editar / eliminar / reactivar). `CategoriaFormModal` con selector jerárquico de padre (excluye descendientes). Ruta `/admin/categorias` protegida para ADMIN.

---

## feat/pagos-mercadopago-panel-pedidos *(pendiente de PR)*

### Integración Mercado Pago
- Nuevo módulo `app/modules/pagos/`: crea preferencia con ítems + costo de envío, `back_urls` y `auto_return`; endpoint webhook IPN con logging.
- `PagoSuccessPage`: confirma el carrito al retornar de MP, muestra detalle del pedido (productos, subtotal, envío, total). Fix: `useRef` guard contra doble ejecución por React 18 Strict Mode.
- `PagoFailurePage` y `PagoPendingPage`: pantallas de retorno con mensaje y acción.

### Carrito de compras
- `cartStore` (Zustand persist): items, subtotal, total; recalcular tras rehidratación.
- `CarritoIcon`: badge con contador en el Navbar.
- `CarritoModal`: resumen con cantidades, eliminar ítem, total, botón ir al checkout.
- `AgregarAlCarritoModal`: selector de cantidad antes de agregar al carrito.
- Fix de race condition de hidratación en `PrivateRoute` y `CheckoutPage` usando `persist.hasHydrated()` + `persist.onFinishHydration()`.

### Checkout
- `CheckoutPage`: resumen de ítems, selección de forma de pago (Mercado Pago / Efectivo / Transferencia), campo de notas, botón "Finalizar compra" que crea la preferencia y redirige a MP.

### Mis Pedidos (rol CLIENT)
- `MisPedidosPage`: listado paginado de pedidos propios con fecha (UTC-safe), badge de estado con color y forma de pago. Ruta `/mis-pedidos` en Navbar.

### FSM y gestión de pedidos (backend)
- `avanzar_estado`: validación contra mapa FSM, historial append-only (`HistorialEstadoPedido`), motivo obligatorio al cancelar.
- `GET /pedidos/admin/todos`: filtro opcional por `?estado=` para ADMIN y PEDIDOS.
- `HistorialEstadoPublic`: nuevo campo `usuario_nombre` (nombre completo resuelto con batch lookup, sin N+1).
- `PedidoUnitOfWork`: agrega `UsuarioRepository`.

### Panel de pedidos (roles ADMIN y PEDIDOS)
- `PanelPedidosPage`: tabs de filtro por estado (default: Confirmados), tarjeta por pedido con total e info de cliente.
- Botones de avance de FSM: "Iniciar preparación" → "Despachar" → "Marcar entregado".
- Modal de cancelación con campo de motivo obligatorio.
- Modal de detalle: tabla de productos (nombre snapshot, cantidad, precio unitario, subtotal), resumen financiero (subtotal / descuento / envío / total), timeline del historial de estados con nombre del actor y motivo. Deduplicación de entradas duplicadas en historial existente.
- Ruta `/admin/pedidos` protegida para ADMIN y PEDIDOS; link "Pedidos" en Navbar.

### Infraestructura frontend
- `api/client.ts`: interceptores Axios que convierten automáticamente snake_case ↔ camelCase y renombran `createdAt → creadoEn`. `baseURL` vacía para URLs relativas (compatible con proxy Vite y ngrok sin cambios).
- `vite.config.ts`: proxy hacia `localhost:8000` con `followRedirects: true`, `allowedHosts: true` para ngrok.
