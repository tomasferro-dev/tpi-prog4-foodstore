from sqlmodel import Session, select
from app.core.database import engine
from app.core.security import hash_password
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from app.modules.unidad_medida.models import UnidadMedida
from app.modules.pedidos.models import EstadoPedido, FormaPago
from app.modules.categorias.models import Categoria
from app.modules.ingredientes.models import Ingrediente
from app.modules.productos.models import Producto, ProductoCategoria, ProductoIngrediente

# roles del sistema según el UML
ROLES_SEED = [
    Rol(codigo="ADMIN",   nombre="Administrador",  descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Stock",           descripcion="Actualiza stock y disponibilidad"),
    Rol(codigo="PEDIDOS", nombre="Pedidos",         descripcion="Avanza estados confirmado → entregado"),
    Rol(codigo="CLIENT",  nombre="Cliente",         descripcion="Opera solo sus propios datos"),
]

# unidades de medida del catálogo inicial (masa, volumen, unidad)
UNIDADES_SEED = [
    UnidadMedida(nombre="gramo",     simbolo="g",   tipo="masa"),
    UnidadMedida(nombre="kilogramo", simbolo="kg",  tipo="masa"),
    UnidadMedida(nombre="mililitro", simbolo="mL",  tipo="volumen"),
    UnidadMedida(nombre="litro",     simbolo="L",   tipo="volumen"),
    UnidadMedida(nombre="unidad",    simbolo="u",   tipo="unidad"),
    UnidadMedida(nombre="docena",    simbolo="doc", tipo="unidad"),
]

# estados del pedido con su orden en la FSM
ESTADOS_SEED = [
    EstadoPedido(codigo="pendiente",      descripcion="Pendiente de confirmación", orden=1, es_terminal=False),
    EstadoPedido(codigo="confirmado",     descripcion="Confirmado",               orden=2, es_terminal=False),
    EstadoPedido(codigo="en_preparacion", descripcion="En preparación",           orden=3, es_terminal=False),
    EstadoPedido(codigo="en_camino",      descripcion="En camino",                orden=4, es_terminal=False),
    EstadoPedido(codigo="entregado",      descripcion="Entregado",                orden=5, es_terminal=True),
    EstadoPedido(codigo="cancelado",      descripcion="Cancelado",                orden=6, es_terminal=True),
]

# formas de pago disponibles
FORMAS_PAGO_SEED = [
    FormaPago(codigo="MERCADOPAGO",   descripcion="Mercado Pago",                    habilitado=True),
    FormaPago(codigo="EFECTIVO",      descripcion="Retiro en local",                 habilitado=True),
    FormaPago(codigo="TRANSFERENCIA", descripcion="Transferencia bancaria",          habilitado=True),
]


def _seed_categorias(session: Session) -> dict[str, Categoria]:
    if session.exec(select(Categoria)).first():
        return {c.nombre: c for c in session.exec(select(Categoria)).all()}

    raices_nombres = ["Comidas Preparadas", "Bebidas", "Postres"]
    cats: dict[str, Categoria] = {}
    for nombre in raices_nombres:
        c = Categoria(nombre=nombre)
        session.add(c)
        cats[nombre] = c
    session.flush()

    hijos = [
        ("Pizzas",        "Comidas Preparadas"),
        ("Hamburguesas",  "Comidas Preparadas"),
        ("Empanadas",     "Comidas Preparadas"),
        ("Sandwiches",    "Comidas Preparadas"),
        ("Cervezas",      "Bebidas"),
        ("Jugos",         "Bebidas"),
        ("Helados",       "Postres"),
        ("Tortas",        "Postres"),
    ]
    for nombre, padre in hijos:
        c = Categoria(nombre=nombre, parent_id=cats[padre].id)
        session.add(c)
        cats[nombre] = c
    session.flush()

    return cats


def _seed_ingredientes(session: Session) -> dict[str, Ingrediente]:
    if session.exec(select(Ingrediente)).first():
        return {i.nombre: i for i in session.exec(select(Ingrediente)).all()}

    # (nombre, descripcion, es_alergeno, stock_cantidad, precio_por_unidad, simbolo_um)
    # stocks en kg/L/u — precios por kg/L/u
    defs = [
        ("Queso mozzarella",  "Mozzarella entera",              True,    5.0, 20000.0, "kg"),
        ("Salsa de tomate",   "Salsa casera de tomate",          False,   8.0,  3000.0, "L"),
        ("Base de pizza",     "Prepizza cruda lista para usar",  True,   15.0,   500.0, "u"),
        ("Lechuga",           "Lechuga fresca",                  False,   3.0,  5000.0, "kg"),
        ("Carne vacuna",      "Medallón de carne molida",        False,   5.0, 35000.0, "kg"),
        ("Pan de hamburguesa","Pan brioche",                     True,   20.0,   200.0, "u"),
        ("Mayonesa",          "Mayonesa casera",                 False,   2.0,  8000.0, "L"),
        ("Queso cheddar",     "Fetas de cheddar",                True,    3.0, 18000.0, "kg"),
        ("Coca Cola 500mL",   "Botella de Coca Cola",            False,  50.0,   600.0, "u"),
        ("Agua mineral 500mL","Botella de agua sin gas",         False,  80.0,   200.0, "u"),
        ("Jamón cocido",      "Fetas de jamón",                  False,   4.0, 25000.0, "kg"),
        ("Huevo",             "Huevo fresco",                    True,  100.0,   150.0, "u"),
        ("Aceitunas",         "Aceitunas verdes",                False,   2.0, 10000.0, "kg"),
        ("Cerveza 1L",        "Botella cerveza",                 False,  60.0,  1200.0, "u"),
        ("Jugo de naranja",   "Jugo natural",                    False,   5.0,  4000.0, "L"),
        ("Helado vainilla",   "Helado artesanal",                True,    3.0, 12000.0, "kg"),
        ("Pan lactal",        "Pan para sandwich",               True,   30.0,   180.0, "u"),
        ("Tomate",            "Tomate fresco",                   False,   4.0,  6000.0, "kg"),
    ]
    ums = {u.simbolo: u for u in session.exec(select(UnidadMedida)).all()}
    ings: dict[str, Ingrediente] = {}
    for nombre, desc, alergeno, stock, precio, simbolo in defs:
        i = Ingrediente(
            nombre=nombre,
            descripcion=desc,
            es_alergeno=alergeno,
            stock_cantidad=stock,
            precio_por_unidad=precio,
            unidad_medida_id=ums[simbolo].id,
        )
        session.add(i)
        ings[nombre] = i
    session.flush()
    return ings


IMAGENES_PRODUCTOS: dict[str, str] = {
    "Pizza Muzzarella":       "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80",
    "Pizza Napolitana":       "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80",
    "Pizza Fugazzeta":        "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=500&q=80",
    "Hamburguesa Completa":   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
    "Hamburguesa con Queso":  "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80",
    "Empanada de Jamón y Queso": "https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=500&q=80",
    "Sandwich Mixto":         "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80",
    "Coca Cola 500mL":        "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80",
    "Agua Mineral 500mL":     "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500&q=80",
    "Cerveza 1L":             "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&q=80",
    "Jugo de Naranja":        "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&q=80",
    "Helado de Vainilla":     "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&q=80",
    "Torta de Chocolate":     "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80",
}


def _actualizar_imagenes(session: Session) -> None:
    """Asigna imagen_url a productos existentes que todavía no tienen una."""
    for nombre, url in IMAGENES_PRODUCTOS.items():
        p = session.exec(select(Producto).where(Producto.nombre == nombre)).first()
        if p and not p.imagen_url:
            p.imagen_url = url
            session.add(p)


def _seed_productos(
    session: Session,
    cats: dict[str, Categoria],
    ings: dict[str, Ingrediente],
    ums: dict[str, UnidadMedida],
) -> None:
    if session.exec(select(Producto)).first():
        return

    # (nombre, descripcion, precio_base, disponible, tipo_producto,
    #  stock_cantidad_inicial,   ← solo relevante para "terminado"
    #  categorias[(nombre, es_principal)],
    #  ingredientes[(nombre_ing, cantidad, simbolo_um, es_removible)])
    defs = [
        (
            "Pizza Muzzarella",
            "Clásica pizza con salsa de tomate y abundante muzzarella.",
            12000.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Pizzas", True)],
            [("Queso mozzarella", 0.2,  "kg", False),
             ("Salsa de tomate",  0.15, "L",  False),
             ("Base de pizza",    1.0,  "u",  False)],
        ),
        (
            "Pizza Napolitana",
            "Pizza con tomate fresco, muzzarella y un toque de aceitunas.",
            13000.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Pizzas", True)],
            [("Queso mozzarella", 0.2, "kg", False),
             ("Salsa de tomate",  0.2, "L",  False),
             ("Base de pizza",    1.0, "u",  False)],
        ),
        (
            "Hamburguesa Completa",
            "Medallón de carne, lechuga, tomate y mayonesa.",
            15000.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Hamburguesas", True)],
            [("Carne vacuna",       0.2,  "kg", False),
             ("Lechuga",            0.03, "kg", True),
             ("Mayonesa",           0.03, "L",  True),
             ("Pan de hamburguesa", 1.0,  "u",  False)],
        ),
        (
            "Hamburguesa con Queso",
            "Medallón de carne con cheddar derretido, lechuga y mayonesa.",
            16500.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Hamburguesas", True)],
            [("Carne vacuna",       0.2,  "kg", False),
             ("Queso cheddar",      0.05, "kg", True),
             ("Lechuga",            0.03, "kg", True),
             ("Mayonesa",           0.03, "L",  True),
             ("Pan de hamburguesa", 1.0,  "u",  False)],
        ),
        (
            "Coca Cola 500mL",
            "Gaseosa cola en botella de 500mL.",
            1500.0, True, "terminado", 50,
            [("Bebidas", True)],
            [],   # terminado: sin ingredientes, el stock se gestiona manualmente
        ),
        (
            "Agua Mineral 500mL",
            "Agua mineral sin gas.",
            800.0, True, "terminado", 80,
            [("Bebidas", True)],
            [],
        ),
        (
            "Pizza Fugazzeta",
            "Fugazzeta clásica con cebolla y muzzarella.",
            14000.0, False, "elaborado", 0,
            [("Comidas Preparadas", False), ("Pizzas", True)],
            [("Queso mozzarella", 0.25, "kg", False),
             ("Base de pizza",    1.0,  "u",  False)],
        ),
        (
            "Empanada de Jamón y Queso",
            "Empanada rellena de jamón y queso.",
            2500.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Empanadas", True)],
            [("Jamón cocido",     0.05, "kg", False),
             ("Queso mozzarella", 0.05, "kg", False)],
        ),
        (
            "Sandwich Mixto",
            "Sandwich de jamón y queso.",
            6000.0, True, "elaborado", 0,
            [("Comidas Preparadas", False), ("Sandwiches", True)],
            [("Pan lactal",       2.0,  "u",  False),
             ("Jamón cocido",     0.06, "kg", False),
             ("Queso mozzarella", 0.06, "kg", False)],
        ),
        (
            "Cerveza 1L",
            "Cerveza rubia en botella de 1 litro.",
            2500.0, True, "terminado", 60,
            [("Bebidas", False), ("Cervezas", True)],
            [],
        ),
        (
            "Jugo de Naranja",
            "Jugo exprimido natural.",
            1800.0, True, "elaborado", 0,
            [("Bebidas", False), ("Jugos", True)],
            [("Jugo de naranja", 0.3, "L", False)],
        ),
        (
            "Helado de Vainilla",
            "Porción de helado artesanal.",
            3000.0, True, "elaborado", 0,
            [("Postres", False), ("Helados", True)],
            [("Helado vainilla", 0.2, "kg", False)],
        ),
        (
            "Torta de Chocolate",
            "Porción de torta húmeda de chocolate.",
            4500.0, True, "elaborado", 0,
            [("Postres", False), ("Tortas", True)],
            [("Huevo", 2.0, "u", False)],
        ),
    ]

    for nombre, desc, precio, disponible, tipo, stock_inicial, cat_defs, ing_defs in defs:
        p = Producto(
            nombre=nombre, descripcion=desc, precio_base=precio,
            disponible=disponible, tipo_producto=tipo,
            stock_cantidad=stock_inicial,
            imagen_url=IMAGENES_PRODUCTOS.get(nombre),
        )
        session.add(p)
        session.flush()

        for cat_nombre, es_principal in cat_defs:
            session.add(ProductoCategoria(
                producto_id=p.id,
                categoria_id=cats[cat_nombre].id,
                es_principal=es_principal,
            ))

        for ing_nombre, cantidad, simbolo, es_removible in ing_defs:
            session.add(ProductoIngrediente(
                producto_id=p.id,
                ingrediente_id=ings[ing_nombre].id,
                cantidad=cantidad,
                unidad_medida_id=ums[simbolo].id,
                es_removible=es_removible,
            ))


def run_seed() -> None:
    with Session(engine) as session:
        for rol in ROLES_SEED:
            if not session.get(Rol, rol.codigo):
                session.add(rol)

        existentes_u = {u.simbolo for u in session.exec(select(UnidadMedida)).all()}
        for unidad in UNIDADES_SEED:
            if unidad.simbolo not in existentes_u:
                session.add(unidad)

        for estado in ESTADOS_SEED:
            if not session.get(EstadoPedido, estado.codigo):
                session.add(estado)

        for forma in FORMAS_PAGO_SEED:
            if not session.get(FormaPago, forma.codigo):
                session.add(forma)

        USUARIOS_SEED = [
            ("Administrador", "Sistema",  "admin@admin.com",   "admin1234",   "ADMIN"),
            ("Carlos",        "Stock",    "stock@admin.com",   "stock1234",   "STOCK"),
            ("Laura",         "Pedidos",  "pedidos@admin.com", "pedidos1234", "PEDIDOS"),
            ("Marcos",        "Cliente",  "cliente@admin.com", "cliente1234", "CLIENT"),
        ]
        for nombre, apellido, email, password, rol in USUARIOS_SEED:
            u = session.exec(select(Usuario).where(Usuario.email == email)).first()
            if not u:
                u = Usuario(
                    nombre=nombre, apellido=apellido,
                    email=email, hashed_password=hash_password(password),
                )
                session.add(u)
                session.flush()
                session.add(UsuarioRol(usuario_id=u.id, rol_codigo=rol))

        session.flush()

        cats = _seed_categorias(session)
        ings = _seed_ingredientes(session)

        ums = {u.simbolo: u for u in session.exec(select(UnidadMedida)).all()}
        _seed_productos(session, cats, ings, ums)
        _actualizar_imagenes(session)

        session.commit()
        print("Seed completado.")


if __name__ == "__main__":
    run_seed()
