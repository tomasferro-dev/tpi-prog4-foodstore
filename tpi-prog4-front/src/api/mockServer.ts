// =====================================================================
// MOCK SERVER v2 — Simula el backend usando localStorage + JWT reales
// =====================================================================
// Cambios respecto a v1:
//  - Ingrediente tiene stockDisponible, costoUnitario, unidadMedidaId
//  - Producto tiene ProductoIngrediente[] con cantidad (no solo ids)
//  - stockCantidad se CALCULA desde ingredientes (no se guarda)
//  - precioSugerido se CALCULA: costos + margen (no se guarda)
//  - Nueva entidad: UnidadMedida (catálogo seed)
//  - Nueva entidad: ConfigPrecio (costos operativos + margen)
// =====================================================================

import { jwtDecode } from "jwt-decode";
import type {
  Categoria,
  ConfigPrecio,
  Ingrediente,
  LoginRequest,
  LoginResponse,
  Paginado,
  Producto,
  ProductoFormData,
  ProductoIngrediente,
  RegisterRequest,
  RolNombre,
  JwtPayload,
  UnidadMedida,
  Usuario,
  FiltrosProductos,
  FiltrosIngredientes,
} from "../types";

// =====================================================================
// CONSTANTES
// =====================================================================

const STORAGE_KEYS = {
  usuarios: "fsv2_usuarios",
  productos: "fsv2_productos",
  ingredientes: "fsv2_ingredientes",
  categorias: "fsv2_categorias",
  unidadesMedida: "fsv2_unidades_medida",
  config: "fsv2_config",
  seqs: "fsv2_secuencias",
} as const;

const LATENCIA_MS = 250;
const JWT_SECRET = "food-store-secret-key-v2";
const ACCESS_TOKEN_EXPIRES_SECONDS = 30 * 60;

// =====================================================================
// TIPO INTERNO: ProductoStored
// El producto se guarda SIN stockCantidad ni precioSugerido (calculados).
// stockManual se usa solo cuando el producto no tiene ingredientes.
// =====================================================================

type ProductoStored = Omit<Producto, "stockCantidad" | "precioSugerido" | "tieneAlergenos" | "tipoProducto"> & {
  stockManual: number;
  tipoProducto?: "elaborado" | "terminado"; // opcional para compatibilidad con seed antiguo
};

// =====================================================================
// HELPERS GENERICOS
// =====================================================================

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function leer<T>(key: string, defecto: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return defecto;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defecto;
  }
}

function guardar<T>(key: string, valor: T): void {
  localStorage.setItem(key, JSON.stringify(valor));
}

function ahora(): string {
  return new Date().toISOString();
}

function siguienteId(tabla: string): number {
  const seqs = leer<Record<string, number>>(STORAGE_KEYS.seqs, {});
  const next = (seqs[tabla] ?? 0) + 1;
  seqs[tabla] = next;
  guardar(STORAGE_KEYS.seqs, seqs);
  return next;
}

function generarToken(payload: JwtPayload): string {
  const base64url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = base64url(header);
  const payloadEncoded = base64url(payload);
  const firma = btoa(`${headerEncoded}.${payloadEncoded}.${JWT_SECRET}`)
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .slice(0, 43);

  return `${headerEncoded}.${payloadEncoded}.${firma}`;
}

export class HttpError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// =====================================================================
// LOGICA DE CALCULO DE STOCK Y PRECIO
// =====================================================================

/**
 * Calcula cuántas unidades del producto se pueden hacer con el stock
 * actual de cada ingrediente.
 *
 * Formula: min( floor(stockIngrediente / cantidadNecesaria) ) para cada ing.
 * Si el producto no tiene ingredientes, devuelve stockManual.
 */
export function calcularStockProducto(
  productoIngredientes: ProductoIngrediente[],
  ingredientes: Ingrediente[],
  stockManual: number
): number {
  if (productoIngredientes.length === 0) return stockManual;

  const posibles = productoIngredientes.map((pi) => {
    const ing = ingredientes.find((i) => i.id === pi.ingredienteId && i.eliminadoEn === null);
    if (!ing || pi.cantidad <= 0) return 0;
    return Math.floor(ing.stockDisponible / pi.cantidad);
  });

  return Math.min(...posibles);
}

/**
 * Calcula el precio sugerido de venta para un producto.
 *
 * Formula:
 *   costo_ing       = Σ (ing.costoUnitario × pi.cantidad)
 *   costo_op/unidad = totalCostosOperativos / unidadesMesEstimadas
 *   precio_sugerido = (costo_ing + costo_op/unidad) × (1 + margen/100)
 *
 * Si el producto no tiene ingredientes, precio sugerido = 0.
 */
export function calcularPrecioSugerido(
  productoIngredientes: ProductoIngrediente[],
  ingredientes: Ingrediente[],
  config: ConfigPrecio
): number {
  if (productoIngredientes.length === 0) return 0;

  const costoIngredientes = productoIngredientes.reduce((suma, pi) => {
    const ing = ingredientes.find((i) => i.id === pi.ingredienteId);
    if (!ing) return suma;
    return suma + ing.costoUnitario * pi.cantidad;
  }, 0);

  const { salario, gas, luz, alquiler, otros } = config.costos;
  const totalCostosOp = salario + gas + luz + alquiler + otros;
  const costoOpPorUnidad =
    config.unidadesMesEstimadas > 0 ? totalCostosOp / config.unidadesMesEstimadas : 0;

  const costoTotal = costoIngredientes + costoOpPorUnidad;
  const precio = costoTotal * (1 + config.porcentajeGanancia / 100);
  return Math.round(precio * 100) / 100;
}

/**
 * Toma un ProductoStored y lo enriquece con stockCantidad y precioSugerido calculados.
 */
function enriquecerProducto(
  stored: ProductoStored,
  ingredientes: Ingrediente[],
  config: ConfigPrecio
): Producto {
  const { stockManual, ...resto } = stored;
  return {
    ...resto,
    // Si no tiene tipoProducto explícito, lo inferimos por la presencia de ingredientes
    tipoProducto: stored.tipoProducto ?? (stored.ingredientes.length > 0 ? "elaborado" : "terminado"),
    stockCantidad: calcularStockProducto(stored.ingredientes, ingredientes, stockManual),
    precioSugerido: calcularPrecioSugerido(stored.ingredientes, ingredientes, config),
    tieneAlergenos: stored.ingredientes.some((pi) => ingredientes.find((i) => i.id === pi.ingredienteId)?.esAlergeno ?? false),
  };
}

// =====================================================================
// CONFIG DEFAULT
// =====================================================================

const CONFIG_DEFAULT: ConfigPrecio = {
  porcentajeGanancia: 50,
  unidadesMesEstimadas: 300,
  costos: {
    salario: 350_000,
    gas: 25_000,
    luz: 20_000,
    alquiler: 200_000,
    otros: 30_000,
  },
};

// =====================================================================
// SEED INICIAL
// =====================================================================

export function seedSiHaceFalta(): void {
  if (localStorage.getItem(STORAGE_KEYS.usuarios)) return;

  // ---------- Unidades de Medida (catálogo fijo) ----------
  const unidadesMedida: UnidadMedida[] = [
    { id: 1, nombre: "gramo", simbolo: "g", tipo: "masa" },
    { id: 2, nombre: "kilogramo", simbolo: "kg", tipo: "masa" },
    { id: 3, nombre: "mililitro", simbolo: "mL", tipo: "volumen" },
    { id: 4, nombre: "litro", simbolo: "L", tipo: "volumen" },
    { id: 5, nombre: "pieza", simbolo: "u", tipo: "unidad" },
    { id: 6, nombre: "docena", simbolo: "doc", tipo: "unidad" },
  ];

  // ---------- Usuarios ----------
  const usuarios: (Usuario & { passwordHash: string })[] = [
    {
      id: 1, nombre: "Administrador", email: "admin@foodstore.com",
      celular: null, roles: ["ADMIN"], passwordHash: "admin1234",
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 2, nombre: "Gestor de Stock", email: "stock@foodstore.com",
      celular: null, roles: ["STOCK"], passwordHash: "stock1234",
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 3, nombre: "Cliente Demo", email: "cliente@foodstore.com",
      celular: null, roles: ["CLIENT"], passwordHash: "cliente1234",
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
  ];

  // ---------- Categorías ----------
  const categorias: Categoria[] = [
    { id: 1, nombre: "Comidas Preparadas", padreId: null, eliminadoEn: null },
    { id: 2, nombre: "Bebidas", padreId: null, eliminadoEn: null },
    { id: 3, nombre: "Postres", padreId: null, eliminadoEn: null },
    { id: 4, nombre: "Pizzas", padreId: 1, eliminadoEn: null },
    { id: 5, nombre: "Hamburguesas", padreId: 1, eliminadoEn: null },
    { id: 6, nombre: "Empanadas", padreId: 1, eliminadoEn: null },
    { id: 7, nombre: "Sandwiches", padreId: 1, eliminadoEn: null },
    { id: 8, nombre: "Cervezas", padreId: 2, eliminadoEn: null },
    { id: 9, nombre: "Jugos", padreId: 2, eliminadoEn: null },
    { id: 10, nombre: "Helados", padreId: 3, eliminadoEn: null },
    { id: 11, nombre: "Tortas", padreId: 3, eliminadoEn: null },
  ];

  // ---------- Ingredientes (con stock y costo) ----------
  // Cada ingrediente tiene:
  //   stockDisponible → cantidad fisica en depósito
  //   costoUnitario   → costo por 1 unidad de medida (en pesos)
  //   unidadMedidaId  → referencia a UnidadMedida
  const ingredientes: Ingrediente[] = [
    {
      id: 1, nombre: "Queso mozzarella", descripcion: "Mozzarella entera",
      esAlergeno: true,
      stockDisponible: 5000,   // 5 kg en gramos
      costoUnitario: 20,       // $20 por gramo
      unidadMedidaId: 1,       // gramo
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 2, nombre: "Salsa de tomate", descripcion: "Salsa casera de tomate",
      esAlergeno: false,
      stockDisponible: 8000,   // 8 L en mL
      costoUnitario: 3,        // $3 por mL
      unidadMedidaId: 3,       // mililitro
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 3, nombre: "Base de pizza", descripcion: "Prepizza cruda lista para usar",
      esAlergeno: true,        // contiene gluten
      stockDisponible: 15,     // 15 unidades
      costoUnitario: 500,      // $500 por unidad
      unidadMedidaId: 5,       // pieza
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 4, nombre: "Lechuga", descripcion: "Lechuga fresca",
      esAlergeno: false,
      stockDisponible: 3000,   // 3 kg en gramos
      costoUnitario: 5,        // $5 por gramo
      unidadMedidaId: 1,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 5, nombre: "Carne vacuna", descripcion: "Medallón de carne molida",
      esAlergeno: false,
      stockDisponible: 5000,   // 5 kg en gramos
      costoUnitario: 35,       // $35 por gramo
      unidadMedidaId: 1,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 6, nombre: "Pan de hamburguesa", descripcion: "Pan brioche",
      esAlergeno: true,        // gluten
      stockDisponible: 20,     // 20 unidades
      costoUnitario: 200,      // $200 por unidad
      unidadMedidaId: 5,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 7, nombre: "Mayonesa", descripcion: "Mayonesa casera",
      esAlergeno: false,
      stockDisponible: 2000,   // 2 L en mL
      costoUnitario: 8,        // $8 por mL
      unidadMedidaId: 3,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 8, nombre: "Queso cheddar", descripcion: "Fetas de cheddar",
      esAlergeno: true,
      stockDisponible: 3000,   // 3 kg en gramos
      costoUnitario: 18,       // $18 por gramo
      unidadMedidaId: 1,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 9, nombre: "Coca Cola 500mL", descripcion: "Botella de Coca Cola",
      esAlergeno: false,
      stockDisponible: 50,
      costoUnitario: 600,
      unidadMedidaId: 5,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 10, nombre: "Agua mineral 500mL", descripcion: "Botella de agua sin gas",
      esAlergeno: false,
      stockDisponible: 80,
      costoUnitario: 200,
      unidadMedidaId: 5,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    { id: 11, nombre: "Jamón cocido", descripcion: "Fetas de jamón", esAlergeno: false, stockDisponible: 4000, costoUnitario: 25, unidadMedidaId: 1, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 12, nombre: "Huevo", descripcion: "Huevo fresco", esAlergeno: true, stockDisponible: 100, costoUnitario: 150, unidadMedidaId: 5, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 13, nombre: "Aceitunas", descripcion: "Aceitunas verdes", esAlergeno: false, stockDisponible: 2000, costoUnitario: 10, unidadMedidaId: 1, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 14, nombre: "Cerveza 1L", descripcion: "Botella cerveza", esAlergeno: false, stockDisponible: 60, costoUnitario: 1200, unidadMedidaId: 5, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 15, nombre: "Jugo de naranja", descripcion: "Jugo natural", esAlergeno: false, stockDisponible: 5000, costoUnitario: 4, unidadMedidaId: 3, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 16, nombre: "Helado vainilla", descripcion: "Helado artesanal", esAlergeno: true, stockDisponible: 3000, costoUnitario: 12, unidadMedidaId: 1, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 17, nombre: "Pan lactal", descripcion: "Pan para sandwich", esAlergeno: true, stockDisponible: 30, costoUnitario: 180, unidadMedidaId: 5, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
    { id: 18, nombre: "Tomate", descripcion: "Tomate fresco", esAlergeno: false, stockDisponible: 4000, costoUnitario: 6, unidadMedidaId: 1, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null },
  ];

  // ---------- Productos (sin stockCantidad/precioSugerido — se calculan) ----------
  // Stock de Pizza Muzzarella:
  //   min( floor(5000/200), floor(8000/150), floor(15/1) ) = min(25, 53, 15) = 15
  // Precio sugerido (config default, 50% margen, 300 u/mes):
  //   ing: 200*20 + 150*3 + 1*500 = 4000+450+500 = 4950
  //   op:  625000/300 ≈ 2083
  //   total: (4950+2083)*1.5 ≈ $10,550
  const productos: ProductoStored[] = [
    {
      id: 1,
      nombre: "Pizza Muzzarella",
      descripcion: "Clásica pizza con salsa de tomate y abundante muzzarella.",
      imagenUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400",
      precioBase: 12000,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 4],
      ingredientes: [
        { ingredienteId: 1, cantidad: 200, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 2, cantidad: 150, unidadMedidaId: 3, esRemovible: false },
        { ingredienteId: 3, cantidad: 1,   unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 2,
      nombre: "Pizza Napolitana",
      descripcion: "Pizza con tomate fresco, muzzarella y un toque de aceitunas.",
      imagenUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
      precioBase: 13000,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 4],
      ingredientes: [
        { ingredienteId: 1, cantidad: 200, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 2, cantidad: 200, unidadMedidaId: 3, esRemovible: false },
        { ingredienteId: 3, cantidad: 1,   unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 3,
      nombre: "Hamburguesa Completa",
      descripcion: "Medallón de carne, lechuga, tomate y mayonesa.",
      imagenUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
      precioBase: 15000,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 5],
      ingredientes: [
        { ingredienteId: 5, cantidad: 200, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 4, cantidad: 30,  unidadMedidaId: 1, esRemovible: true },
        { ingredienteId: 7, cantidad: 30,  unidadMedidaId: 3, esRemovible: true },
        { ingredienteId: 6, cantidad: 1,   unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 4,
      nombre: "Hamburguesa con Queso",
      descripcion: "Medallón de carne con cheddar derretido, lechuga y mayonesa.",
      imagenUrl: "https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=400",
      precioBase: 16500,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 5],
      ingredientes: [
        { ingredienteId: 5, cantidad: 200, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 8, cantidad: 50,  unidadMedidaId: 1, esRemovible: true },
        { ingredienteId: 4, cantidad: 30,  unidadMedidaId: 1, esRemovible: true },
        { ingredienteId: 7, cantidad: 30,  unidadMedidaId: 3, esRemovible: true },
        { ingredienteId: 6, cantidad: 1,   unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 5,
      nombre: "Coca Cola 500mL",
      descripcion: "Gaseosa cola en botella de 500mL.",
      imagenUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
      precioBase: 1500,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [2],
      ingredientes: [
        { ingredienteId: 9, cantidad: 1, unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 6,
      nombre: "Agua Mineral 500mL",
      descripcion: "Agua mineral sin gas.",
      imagenUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400",
      precioBase: 800,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [2],
      ingredientes: [
        { ingredienteId: 10, cantidad: 1, unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 7,
      nombre: "Pizza Fugazzeta (descontinuada)",
      descripcion: "Producto de prueba dado de baja.",
      imagenUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
      precioBase: 14000,
      disponible: false,
      unidadVentaId: null,
      categoriaIds: [1, 4],
      ingredientes: [
        { ingredienteId: 1, cantidad: 250, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 3, cantidad: 1,   unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: ahora(),
    },
    {
      id: 8,
      nombre: "Empanada de Jamón y Queso",
      descripcion: "Empanada rellena de jamón y queso.",
      imagenUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400",
      precioBase: 2500,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 6],
      ingredientes: [
        { ingredienteId: 11, cantidad: 50, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 1, cantidad: 50, unidadMedidaId: 1, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 9,
      nombre: "Sandwich Mixto",
      descripcion: "Sandwich de jamón y queso.",
      imagenUrl: "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400",
      precioBase: 6000,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [1, 7],
      ingredientes: [
        { ingredienteId: 17, cantidad: 2, unidadMedidaId: 5, esRemovible: false },
        { ingredienteId: 11, cantidad: 60, unidadMedidaId: 1, esRemovible: false },
        { ingredienteId: 1, cantidad: 60, unidadMedidaId: 1, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 10,
      nombre: "Cerveza 1L",
      descripcion: "Cerveza rubia en botella de 1 litro.",
      imagenUrl: "https://images.unsplash.com/photo-1514361892635-cebb5b7aaf8c?w=400",
      precioBase: 2500,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [2, 8],
      ingredientes: [
        { ingredienteId: 14, cantidad: 1, unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 11,
      nombre: "Jugo de Naranja",
      descripcion: "Jugo exprimido natural.",
      imagenUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400",
      precioBase: 1800,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [2, 9],
      ingredientes: [
        { ingredienteId: 15, cantidad: 300, unidadMedidaId: 3, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 12,
      nombre: "Helado de Vainilla",
      descripcion: "Porción de helado artesanal.",
      imagenUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
      precioBase: 3000,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [3, 10],
      ingredientes: [
        { ingredienteId: 16, cantidad: 200, unidadMedidaId: 1, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
    {
      id: 13,
      nombre: "Torta de Chocolate",
      descripcion: "Porción de torta húmeda de chocolate.",
      imagenUrl: "https://images.unsplash.com/photo-1605475122628-3d9e63b6bdb1?w=400",
      precioBase: 4500,
      disponible: true,
      unidadVentaId: null,
      categoriaIds: [3, 11],
      ingredientes: [
        { ingredienteId: 12, cantidad: 2, unidadMedidaId: 5, esRemovible: false },
      ],
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    },
  ];

  // Inicializar secuencias
  guardar(STORAGE_KEYS.seqs, {
    usuarios: usuarios.length,
    categorias: categorias.length,
    ingredientes: ingredientes.length,
    productos: productos.length,
    unidadesMedida: unidadesMedida.length,
  });

  guardar(STORAGE_KEYS.unidadesMedida, unidadesMedida);
  guardar(STORAGE_KEYS.usuarios, usuarios);
  guardar(STORAGE_KEYS.categorias, categorias);
  guardar(STORAGE_KEYS.ingredientes, ingredientes);
  guardar(STORAGE_KEYS.productos, productos);
  guardar(STORAGE_KEYS.config, CONFIG_DEFAULT);
}

// =====================================================================
// AUTORIZACION
// =====================================================================

function obtenerUsuarioDelToken(token: string | null): Usuario | null {
  if (!token) return null;
  try {
    const payload = jwtDecode<JwtPayload>(token);
    if (payload.exp * 1000 < Date.now()) return null;
    const usuarios = leer<Usuario[]>(STORAGE_KEYS.usuarios, []);
    return usuarios.find((u) => u.id === payload.sub) ?? null;
  } catch {
    return null;
  }
}

function exigirAuth(token: string | null): Usuario {
  const user = obtenerUsuarioDelToken(token);
  if (!user) throw new HttpError(401, "Token inválido o expirado");
  return user;
}

function exigirRol(token: string | null, rolesPermitidos: RolNombre[]): Usuario {
  const user = exigirAuth(token);
  const tieneAlguno = user.roles.some((r) => rolesPermitidos.includes(r));
  if (!tieneAlguno) throw new HttpError(403, "No tenés permisos para esta acción");
  return user;
}

// =====================================================================
// AUTH
// =====================================================================

export const mockAuth = {
  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    await dormir(LATENCIA_MS);
    const usuarios = leer<(Usuario & { passwordHash: string })[]>(STORAGE_KEYS.usuarios, []);
    const u = usuarios.find(
      (x) => x.email.toLowerCase() === email.toLowerCase() && x.eliminadoEn === null
    );

    if (!u || u.passwordHash !== password) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_SECONDS;
    const payload: JwtPayload = {
      sub: u.id, email: u.email, roles: u.roles,
      iat: Math.floor(Date.now() / 1000), exp,
    };
    const accessToken = generarToken(payload);
    const refreshToken = crypto.randomUUID();
    const { passwordHash: _ph, ...userPublico } = u;
    return { accessToken, refreshToken, tokenType: "Bearer", user: userPublico };
  },

  async logout(): Promise<void> {
    await dormir(LATENCIA_MS);
  },

  async registro({ nombre, email, password, celular }: RegisterRequest): Promise<LoginResponse> {
    await dormir(LATENCIA_MS);
    const usuarios = leer<(Usuario & { passwordHash: string })[]>(STORAGE_KEYS.usuarios, []);
    const emailNorm = email.trim().toLowerCase();
    if (usuarios.some((u) => u.email.toLowerCase() === emailNorm && u.eliminadoEn === null)) {
      throw new HttpError(409, "Ya existe una cuenta con ese email");
    }
    const id = siguienteId("usuarios");
    const nuevoUsuario: Usuario & { passwordHash: string } = {
      id, nombre: nombre.trim(), email: emailNorm,
      celular: celular?.trim() ?? null, roles: ["CLIENT"],
      passwordHash: password, creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    };
    usuarios.push(nuevoUsuario);
    guardar(STORAGE_KEYS.usuarios, usuarios);
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_SECONDS;
    const payload: JwtPayload = {
      sub: id, email: nuevoUsuario.email, roles: nuevoUsuario.roles,
      iat: Math.floor(Date.now() / 1000), exp,
    };
    const accessToken = generarToken(payload);
    const refreshToken = crypto.randomUUID();
    const { passwordHash: _ph, ...userPublico } = nuevoUsuario;
    return { accessToken, refreshToken, tokenType: "Bearer", user: userPublico };
  },
};

// =====================================================================
// UNIDADES DE MEDIDA (catálogo read-only)
// =====================================================================

export const mockUnidadesMedida = {
  async listar(): Promise<UnidadMedida[]> {
    await dormir(LATENCIA_MS / 2);
    return leer<UnidadMedida[]>(STORAGE_KEYS.unidadesMedida, []);
  },
};

// =====================================================================
// CATEGORIAS (read-only)
// =====================================================================

export const mockCategorias = {
  async listar(): Promise<Categoria[]> {
    await dormir(LATENCIA_MS / 2);
    const todas = leer<Categoria[]>(STORAGE_KEYS.categorias, []);
    return todas.filter((c) => c.eliminadoEn === null);
  },
};

// =====================================================================
// INGREDIENTES — CRUD con stock y costo
// =====================================================================

export const mockIngredientes = {
  async listar(
    token: string | null,
    filtros: FiltrosIngredientes = {}
  ): Promise<Paginado<Ingrediente>> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    let result = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    if (!filtros.incluirEliminados) result = result.filter((i) => i.eliminadoEn === null);
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      result = result.filter((i) => i.nombre.toLowerCase().includes(q));
    }
    if (filtros.esAlergeno !== undefined) {
      result = result.filter((i) => i.esAlergeno === filtros.esAlergeno);
    }
    const total = result.length;
    const skip = filtros.skip ?? 0;
    const limit = filtros.limit ?? 20;
    return { items: result.slice(skip, skip + limit), total, skip, limit };
  },

  async crear(
    token: string | null,
    data: Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">
  ): Promise<Ingrediente> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    if (!data.nombre?.trim()) throw new HttpError(400, "El nombre es obligatorio");
    const todos = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    if (todos.some((i) => i.nombre.toLowerCase() === data.nombre.toLowerCase() && i.eliminadoEn === null)) {
      throw new HttpError(409, "Ya existe un insumo con ese nombre");
    }
    const nuevo: Ingrediente = {
      ...data,
      nombre: data.nombre.trim(),
      id: siguienteId("ingredientes"),
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    };
    todos.push(nuevo);
    guardar(STORAGE_KEYS.ingredientes, todos);
    return nuevo;
  },

  async editar(
    token: string | null,
    id: number,
    data: Partial<Omit<Ingrediente, "id" | "creadoEn" | "actualizadoEn" | "eliminadoEn">>
  ): Promise<Ingrediente> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const idx = todos.findIndex((i) => i.id === id);
    if (idx === -1) throw new HttpError(404, "Insumo no encontrado");
    if (data.nombre !== undefined) {
      const nombre = data.nombre.trim();
      if (!nombre) throw new HttpError(400, "El nombre no puede estar vacío");
      const colision = todos.find(
        (i) => i.id !== id && i.nombre.toLowerCase() === nombre.toLowerCase() && i.eliminadoEn === null
      );
      if (colision) throw new HttpError(409, "Ya existe otro insumo con ese nombre");
      todos[idx].nombre = nombre;
    }
    if (data.descripcion !== undefined) todos[idx].descripcion = data.descripcion;
    if (data.esAlergeno !== undefined) todos[idx].esAlergeno = data.esAlergeno;
    if (data.stockDisponible !== undefined) {
      if (data.stockDisponible < 0) throw new HttpError(400, "El stock no puede ser negativo");
      todos[idx].stockDisponible = data.stockDisponible;
    }
    if (data.costoUnitario !== undefined) {
      if (data.costoUnitario < 0) throw new HttpError(400, "El costo no puede ser negativo");
      todos[idx].costoUnitario = data.costoUnitario;
    }
    if (data.unidadMedidaId !== undefined) todos[idx].unidadMedidaId = data.unidadMedidaId;
    todos[idx].actualizadoEn = ahora();
    guardar(STORAGE_KEYS.ingredientes, todos);
    return todos[idx];
  },

  async eliminar(token: string | null, id: number): Promise<void> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const idx = todos.findIndex((i) => i.id === id);
    if (idx === -1) throw new HttpError(404, "Insumo no encontrado");
    todos[idx].eliminadoEn = ahora();
    todos[idx].actualizadoEn = ahora();
    guardar(STORAGE_KEYS.ingredientes, todos);
  },

  async reactivar(token: string | null, id: number): Promise<Ingrediente> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const idx = todos.findIndex((i) => i.id === id);
    if (idx === -1) throw new HttpError(404, "Insumo no encontrado");
    todos[idx].eliminadoEn = null;
    todos[idx].actualizadoEn = ahora();
    guardar(STORAGE_KEYS.ingredientes, todos);
    return todos[idx];
  },
};

// =====================================================================
// PRODUCTOS — CRUD con stock y precio calculados
// =====================================================================

export const mockProductos = {
  async listar(
    token: string | null,
    filtros: FiltrosProductos = {}
  ): Promise<Paginado<Producto>> {
    await dormir(LATENCIA_MS);
    if (filtros.incluirEliminados) exigirRol(token, ["ADMIN", "STOCK"]);

    const ingredientes = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const config = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    let stored = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);

    if (!filtros.incluirEliminados) {
      stored = stored.filter((p) => p.eliminadoEn === null && p.disponible);
    }
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      stored = stored.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    if (filtros.categoriaId !== undefined) {
      stored = stored.filter((p) => p.categoriaIds.includes(filtros.categoriaId!));
    }
    if (filtros.disponible !== undefined) {
      stored = stored.filter((p) => p.disponible === filtros.disponible);
    }

    // Enriquecer con stock y precio calculados
    let result = stored.map((p) => enriquecerProducto(p, ingredientes, config));

    if (filtros.precioMin !== undefined) {
      result = result.filter((p) => p.precioBase >= filtros.precioMin!);
    }
    if (filtros.precioMax !== undefined) {
      result = result.filter((p) => p.precioBase <= filtros.precioMax!);
    }

    const total = result.length;
    const skip = filtros.skip ?? 0;
    const limit = filtros.limit ?? 8;
    return { items: result.slice(skip, skip + limit), total, skip, limit };
  },

  async obtener(_token: string | null, id: number): Promise<Producto> {
    await dormir(LATENCIA_MS);
    const stored = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);
    const p = stored.find((x) => x.id === id);
    if (!p) throw new HttpError(404, "Producto no encontrado");
    const ingredientes = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const config = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    return enriquecerProducto(p, ingredientes, config);
  },

  async crear(
    token: string | null,
    data: ProductoFormData
  ): Promise<Producto> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    if (!data.nombre?.trim() || !data.descripcion?.trim()) {
      throw new HttpError(400, "Nombre y descripción son obligatorios");
    }
    if (data.precioBase < 0) throw new HttpError(400, "El precio no puede ser negativo");
    const todos = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);
    const nuevo: ProductoStored = {
      ...data,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim(),
      id: siguienteId("productos"),
      stockManual: 0,
      creadoEn: ahora(), actualizadoEn: ahora(), eliminadoEn: null,
    };
    todos.push(nuevo);
    guardar(STORAGE_KEYS.productos, todos);
    const ingredientes = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const config = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    return enriquecerProducto(nuevo, ingredientes, config);
  },

  async editar(
    token: string | null,
    id: number,
    data: Partial<ProductoFormData>
  ): Promise<Producto> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);
    const idx = todos.findIndex((p) => p.id === id);
    if (idx === -1) throw new HttpError(404, "Producto no encontrado");
    if (data.precioBase !== undefined && data.precioBase < 0) {
      throw new HttpError(400, "El precio no puede ser negativo");
    }
    todos[idx] = { ...todos[idx], ...data, actualizadoEn: ahora() };
    guardar(STORAGE_KEYS.productos, todos);
    const ingredientes = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const config = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    return enriquecerProducto(todos[idx], ingredientes, config);
  },

  async eliminar(token: string | null, id: number): Promise<void> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);
    const idx = todos.findIndex((p) => p.id === id);
    if (idx === -1) throw new HttpError(404, "Producto no encontrado");
    todos[idx].eliminadoEn = ahora();
    todos[idx].disponible = false;
    todos[idx].actualizadoEn = ahora();
    guardar(STORAGE_KEYS.productos, todos);
  },

  async reactivar(token: string | null, id: number): Promise<Producto> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN", "STOCK"]);
    const todos = leer<ProductoStored[]>(STORAGE_KEYS.productos, []);
    const idx = todos.findIndex((p) => p.id === id);
    if (idx === -1) throw new HttpError(404, "Producto no encontrado");
    todos[idx].eliminadoEn = null;
    todos[idx].disponible = true;
    todos[idx].actualizadoEn = ahora();
    guardar(STORAGE_KEYS.productos, todos);
    const ingredientes = leer<Ingrediente[]>(STORAGE_KEYS.ingredientes, []);
    const config = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    return enriquecerProducto(todos[idx], ingredientes, config);
  },
};

// =====================================================================
// CONFIG — Costos operativos y margen de ganancia
// =====================================================================

export const mockConfig = {
  async obtener(_token: string | null): Promise<ConfigPrecio> {
    await dormir(LATENCIA_MS / 2);
    return leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
  },

  async actualizar(token: string | null, data: Partial<ConfigPrecio>): Promise<ConfigPrecio> {
    await dormir(LATENCIA_MS);
    exigirRol(token, ["ADMIN"]);
    const actual = leer<ConfigPrecio>(STORAGE_KEYS.config, CONFIG_DEFAULT);
    const nueva: ConfigPrecio = {
      ...actual,
      ...data,
      costos: { ...actual.costos, ...(data.costos ?? {}) },
    };
    if (nueva.porcentajeGanancia < 0) throw new HttpError(400, "El margen no puede ser negativo");
    if (nueva.unidadesMesEstimadas <= 0) throw new HttpError(400, "Las unidades estimadas deben ser > 0");
    guardar(STORAGE_KEYS.config, nueva);
    return nueva;
  },
};
