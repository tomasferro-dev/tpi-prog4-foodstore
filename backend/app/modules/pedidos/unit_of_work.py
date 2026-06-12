from sqlmodel import Session
from app.core.unit_of_work import UnitOfWork
from app.modules.pedidos.repository import (
    PedidoRepository, DetallePedidoRepository, HistorialEstadoRepository,
    EstadoPedidoRepository, FormaPagoRepository, PagoRepository,
)
from app.modules.productos.repository import ProductoRepository, ProductoIngredienteRepository
from app.modules.ingredientes.repository import IngredienteRepository
from app.modules.usuarios.repository import UsuarioRepository


class PedidoUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        super().__init__(session)
        self.pedidos = PedidoRepository(session)
        self.detalles = DetallePedidoRepository(session)
        self.historial = HistorialEstadoRepository(session)
        self.estados = EstadoPedidoRepository(session)
        self.formas_pago = FormaPagoRepository(session)
        self.pagos = PagoRepository(session)
        self.productos = ProductoRepository(session)
        self.producto_ingredientes = ProductoIngredienteRepository(session)
        self.ingredientes = IngredienteRepository(session)
        self.usuarios = UsuarioRepository(session)
