// Tipos del módulo Pedidos basados en el UML

export type EstadoPedidoCodigo =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado";

export type FormaPagoCodigo =
  | "MERCADOPAGO"
  | "EFECTIVO"
  | "TRANSFERENCIA";

// ====== Catalogos ======

export interface EstadoPedido {
  codigo: EstadoPedidoCodigo;
  descripcion: string;
  orden: number;
  esTerminal: boolean;
}

export interface FormaPago {
  codigo: FormaPagoCodigo;
  descripcion: string;
  habilitado: boolean;
}

// ====== Detalle Pedido (items) ======

export interface DetallePedidoPublic {
  productoId: number;
  cantidad: number;
  nombreSnapshot: string;
  precioSnapshot: number;
  subtotalSnap: number;
  personalizacion?: number[] | null;
}

// ====== Historial de Estado ======

export interface HistorialEstadoPublic {
  id: number;
  estadoDesde?: string | null;
  estadoHacia: EstadoPedidoCodigo;
  usuarioId?: number | null;
  usuarioNombre?: string | null;   // nombre completo resuelto por el backend
  motivo?: string | null;
  creadoEn: string;
}

// ====== Pedido ======

export interface PedidoConDetalle {
  id: number;
  usuarioId: number;
  direccionId?: number | null;
  estadoCodigo: EstadoPedidoCodigo;
  formaPagoCodigo: FormaPagoCodigo;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  notas?: string | null;
  creadoEn: string;
  items: DetallePedidoPublic[];
  historial: HistorialEstadoPublic[];
}

export interface PedidoPublic {
  id: number;
  usuarioId: number;
  direccionId?: number | null;
  estadoCodigo: EstadoPedidoCodigo;
  formaPagoCodigo: FormaPagoCodigo;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  notas?: string | null;
  creadoEn: string;
}

export interface PedidoList {
  data: PedidoPublic[];
  total: number;
}

// ====== Requests ======

export interface ItemPedidoRequest {
  productoId: number;
  cantidad: number;
  personalizacion?: number[] | null;
}

export interface PedidoCreateRequest {
  formaPagoCodigo: FormaPagoCodigo;
  direccionId?: number | null;
  notas?: string | null;
  items: ItemPedidoRequest[];
}

export interface ConfirmarCompraRequest {
  formaPagoCodigo: FormaPagoCodigo;
  direccionId?: number | null;
  notas?: string | null;
}

export interface AvanzarEstadoRequest {
  estadoHacia: EstadoPedidoCodigo;
  motivo?: string | null;
}

// ====== Pago ======

export interface Pago {
  id: number;
  pedidoId: number;
  mpPaymentId?: number | null;
  mpStatus: string;
  mpStatusDetail?: string | null;
  externalReference: string;
  idempotencyKey: string;
  transactionAmount: number;
  paymentMethodId?: string | null;
  creadoEn: string;
  actualizadoEn: string;
}
