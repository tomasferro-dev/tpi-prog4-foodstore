import { apiClient } from "./client";
import type { FiltrosProductos, Paginado, Producto, ProductoFormData, ProductoIngrediente } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductoIngrediente(pi: any): ProductoIngrediente {
  return {
    ingredienteId: pi.ingredienteId,
    cantidad: pi.cantidad,
    unidadMedidaId: pi.unidadMedidaId,
    esRemovible: pi.esRemovible ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProducto(p: any): Producto {
  const categoriaIds: number[] = Array.isArray(p.categorias)
    ? p.categorias.map((c: any) => c.categoriaId as number)
    : (p.categoriaIds ?? []);

  const ingredientes: ProductoIngrediente[] = Array.isArray(p.ingredientes)
    ? p.ingredientes.map(mapProductoIngrediente)
    : [];

  const tieneAlergenos = Array.isArray(p.ingredientes)
    ? p.ingredientes.some((pi: any) => pi.ingrediente?.esAlergeno === true)
    : false;

  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    imagenUrl: p.imagenUrl ?? "",
    precioBase: p.precioBase ?? 0,
    precioSugerido: p.costoEstimado ?? 0,
    tieneAlergenos,
    stockCantidad: p.stockCantidad ?? 0,
    disponible: p.disponible ?? true,
    tipoProducto: (p.tipoProducto ?? "terminado") as "elaborado" | "terminado",
    unidadVentaId: p.unidadVentaId ?? null,
    categoriaIds,
    ingredientes,
    creadoEn: p.creadoEn ?? "",
    actualizadoEn: p.actualizadoEn ?? p.creadoEn ?? "",
    eliminadoEn: p.eliminadoEn ?? null,
  };
}

// Campos básicos del producto (sin categorías ni ingredientes)
function outbound(data: Partial<ProductoFormData>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { categoriaIds: _c, ingredientes: _i, ...rest } = data as any;
  return rest;
}

/** Convierte los filtros del frontend al formato que espera el backend. */
function toBackendParams(filtros: FiltrosProductos) {
  const { skip, categoriaId, precioMin, precioMax, sinAlergenos, incluirEliminados, ...rest } = filtros;
  return {
    ...rest,
    offset: skip ?? 0,
    ...(categoriaId !== undefined && { categoria_id: categoriaId }),
    ...(precioMin !== undefined && { precio_min: precioMin }),
    ...(precioMax !== undefined && { precio_max: precioMax }),
    ...(sinAlergenos !== undefined && { sin_alergenos: sinAlergenos }),
    ...(incluirEliminados !== undefined && { include_deleted: incluirEliminados }),
  };
}

/** Obtiene el detalle completo de un producto (con categorías e ingredientes). */
async function fetchDetalle(id: number): Promise<Producto> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiClient.get<any>(`/productos/${id}`).then(r => mapProducto(r.data));
}

/** Sincroniza categorías: agrega las que faltan, elimina las que sobran. */
async function syncCategorias(id: number, nuevas: number[], actuales: number[]) {
  const set = new Set(actuales);
  const nuevasSet = new Set(nuevas);
  await Promise.all([
    ...[...nuevasSet].filter(c => !set.has(c)).map(c =>
      apiClient.post(`/admin/productos/${id}/categorias`, { categoriaId: c })
    ),
    ...[...set].filter(c => !nuevasSet.has(c)).map(c =>
      apiClient.delete(`/admin/productos/${id}/categorias/${c}`)
    ),
  ]);
}

/** Sincroniza ingredientes: agrega, elimina o reemplaza si cambió la cantidad. */
async function syncIngredientes(id: number, nuevos: ProductoIngrediente[], actuales: ProductoIngrediente[]) {
  const mapActual = new Map(actuales.map(i => [i.ingredienteId, i]));
  const mapNuevo  = new Map(nuevos.map(i => [i.ingredienteId, i]));

  // Eliminar los que ya no están
  await Promise.all(
    [...mapActual.keys()].filter(iid => !mapNuevo.has(iid)).map(iid =>
      apiClient.delete(`/admin/productos/${id}/ingredientes/${iid}`)
    )
  );

  // Agregar los nuevos; si cambió cantidad/removible, borrar y re-agregar
  for (const [iid, ing] of mapNuevo) {
    const actual = mapActual.get(iid);
    if (!actual) {
      await apiClient.post(`/admin/productos/${id}/ingredientes`, ing);
    } else if (actual.cantidad !== ing.cantidad || actual.esRemovible !== ing.esRemovible) {
      await apiClient.delete(`/admin/productos/${id}/ingredientes/${iid}`);
      await apiClient.post(`/admin/productos/${id}/ingredientes`, ing);
    }
  }
}

export const productosApi = {
  listar(filtros: FiltrosProductos = {}): Promise<Paginado<Producto>> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .get<any>("/productos", { params: toBackendParams(filtros) })
      .then(r => ({ ...r.data, items: r.data.items.map(mapProducto) }));
  },

  obtener(id: number): Promise<Producto> {
    return fetchDetalle(id);
  },

  listarAdmin(filtros: FiltrosProductos = {}): Promise<Paginado<Producto>> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .get<any>("/admin/productos", { params: toBackendParams(filtros) })
      .then(r => ({ ...r.data, items: r.data.items.map(mapProducto) }));
  },

  async crear(data: ProductoFormData): Promise<Producto> {
    // Endpoint atómico: crea producto + categorías + ingredientes en una sola transacción.
    // El backend valida que productos elaborados tengan al menos 1 ingrediente.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await apiClient.post<any>("/admin/productos/completo", {
      ...outbound(data),
      categoriaIds: data.categoriaIds,
      ingredientes: data.ingredientes,
    }).then(r => r.data);
    return mapProducto(result);
  },

  async editar(id: number, data: Partial<ProductoFormData>): Promise<Producto> {
    // 1. Actualizar campos básicos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await apiClient.patch<any>(`/admin/productos/${id}`, outbound(data));

    // 2. Sincronizar categorías e ingredientes si vienen en el form
    const actual = await fetchDetalle(id);
    await Promise.all([
      data.categoriaIds !== undefined
        ? syncCategorias(id, data.categoriaIds, actual.categoriaIds)
        : Promise.resolve(),
      data.ingredientes !== undefined
        ? syncIngredientes(id, data.ingredientes, actual.ingredientes)
        : Promise.resolve(),
    ]);

    return fetchDetalle(id);
  },

  ajustarStock(id: number, stockCantidad: number): Promise<Producto> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .patch<any>(`/admin/productos/${id}/stock`, { stockCantidad })
      .then(r => mapProducto(r.data));
  },

  eliminar(id: number): Promise<void> {
    return apiClient.delete(`/admin/productos/${id}`).then(() => undefined);
  },

  reactivar(id: number): Promise<Producto> {
    return apiClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post<any>(`/admin/productos/${id}/reactivar`)
      .then(r => mapProducto(r.data));
  },
};
