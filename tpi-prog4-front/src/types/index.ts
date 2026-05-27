// =====================================================================
// Tipos del dominio Food Store — v2
// Basados en el UML actualizado (uml-modelo-dominio.md).
// camelCase en el frontend; el backend usa snake_case (se mapea en el
// interceptor axios cuando el backend este listo).
// =====================================================================

// ---------- Auth ----------

export type RolNombre = "ADMIN" | "STOCK" | "PEDIDOS" | "CLIENT";

export interface Usuario {
  id: number;
  nombre: string;
  apellido?: string;
  email: string;
  celular?: string | null;
  roles: RolNombre[];
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  user: Usuario;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  celular?: string;
}

export interface JwtPayload {
  sub: number;
  email: string;
  roles: RolNombre[];
  exp: number;
  iat: number;
}

// ---------- Catalogo ----------

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  padreId: number | null;
  eliminadoEn: string | null;
}

// ---------- Unidad de Medida (catalogo seed) ----------

export interface UnidadMedida {
  id: number;
  nombre: string;   // "gramo", "mililitro", "pieza"
  simbolo: string;  // "g", "mL", "u"
  tipo: string;     // "masa" | "volumen" | "unidad" | "area"
}

// ---------- Ingrediente (Insumo) ----------
// CAMBIO v2: agrega stockDisponible, costoUnitario, unidadMedidaId
// El stock es ingresado por el usuario (ej: "tengo 5000g de queso").
// El costo es por unidad de esa medida (ej: "$15 por gramo").

export interface Ingrediente {
  id: number;
  nombre: string;
  descripcion?: string | null;
  esAlergeno: boolean;
  // --- NUEVO v2 ---
  stockDisponible: number;    // cantidad fisica en stock (en la unidad elegida)
  costoUnitario: number;      // costo por 1 unidad de medida (en pesos)
  unidadMedidaId: number;     // FK a UnidadMedida
  // --- Timestamps ---
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn: string | null;
}

// ---------- ProductoIngrediente (tabla intermedia con cantidad) ----------
// CAMBIO v2: ya no es solo una lista de IDs.
// Cada ingrediente tiene cantidad requerida por unidad de producto y
// una flag de si el cliente puede pedirlo sin ese ingrediente.

export interface ProductoIngrediente {
  ingredienteId: number;
  cantidad: number;         // cuanto se usa por unidad de producto (ej: 200)
  unidadMedidaId: number;   // unidad de esa cantidad (ej: 1 = gramo)
  esRemovible: boolean;     // el cliente puede pedirlo sin este ingrediente
}

// ---------- Producto ----------
// CAMBIO v2:
//   - stockCantidad es CALCULADO (min de stocks de ingredientes / cantidades)
//     No se ingresa manualmente. Solo lectura desde el backend/mock.
//   - precioBase es el precio de venta real (editable por el usuario).
//   - precioSugerido es calculado: Σ(costo_ingrediente) + costo_op/unidad,
//     con el margen de ganancia configurado. Solo lectura, referencial.
//   - ingredientes: ahora es ProductoIngrediente[] (con cantidad), no solo ids.
//   - unidadVentaId: FK a UnidadMedida (para mostrar "$ X / kg" o "$ X / u").

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  imagenUrl: string;
  precioBase: number;         // precio de venta real (pesos, 2 dec.)
  precioSugerido: number;     // calculado (solo lectura)
  tieneAlergenos: boolean;    // calculado: true si algun ingrediente es alergeno
  stockCantidad: number;      // calculado desde ingredientes (solo lectura)
  disponible: boolean;
  tipoProducto: "elaborado" | "terminado";
  unidadVentaId: number | null;
  categoriaIds: number[];
  ingredientes: ProductoIngrediente[];
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn: string | null;
}

// Tipo para crear/editar un producto (sin campos calculados ni de sistema)
export type ProductoFormData = Omit<
  Producto,
  "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn" | "stockCantidad" | "precioSugerido" | "tieneAlergenos"
>;

// ---------- Configuracion de Precios ----------
// NUEVO v2: costos operativos mensuales y margen de ganancia.
// Se usan para calcular el precio sugerido de cada producto.
//
// Formula:
//   costo_ing       = Σ (ingrediente.costoUnitario * productoIngrediente.cantidad)
//   costo_op/unidad = (salario + gas + luz + alquiler + otros) / unidadesMesEstimadas
//   precio_sugerido = (costo_ing + costo_op/unidad) * (1 + porcentajeGanancia / 100)

export interface CostosOperativos {
  salario: number;    // sueldos mensuales totales
  gas: number;        // gas mensual
  luz: number;        // electricidad mensual
  alquiler: number;   // alquiler mensual
  otros: number;      // otros costos fijos
}

export interface ConfigPrecio {
  porcentajeGanancia: number;       // ej: 50 → ganancia del 50%
  unidadesMesEstimadas: number;     // produccion mensual estimada (para prorratear costos)
  costos: CostosOperativos;
}

// ---------- Paginacion ----------

export interface Paginado<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// ---------- Filtros ----------

export interface FiltrosProductos {
  busqueda?: string;
  categoriaId?: number;
  precioMin?: number;
  precioMax?: number;
  disponible?: boolean;
  incluirEliminados?: boolean;
  skip?: number;
  limit?: number;
}

export interface FiltrosIngredientes {
  busqueda?: string;
  esAlergeno?: boolean;
  incluirEliminados?: boolean;
  skip?: number;
  limit?: number;
}

// ---------- Errores RFC 7807 ----------

export interface ApiError {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
