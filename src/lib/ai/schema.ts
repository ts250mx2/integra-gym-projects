/**
 * Esquema ENRIQUECIDO de la base de datos de un proyecto Integra Gym.
 *
 * IMPORTANTE — ARQUITECTURA MULTI-TENANT:
 * Cada proyecto (gimnasio) tiene su PROPIA base de datos con esta MISMA
 * estructura, pero con datos y catálogos distintos. Por eso este archivo
 * describe solo la ESTRUCTURA (igual para todos). Los VALORES reales de cada
 * proyecto (sucursales, formas de pago, cuotas, grupos horarios, qué tabla de
 * ventas está en uso, rangos de fecha, etc.) se inyectan en tiempo de ejecución
 * desde `buildProjectCatalog()` (catalog.ts), que consulta la BD del proyecto
 * de la sesión activa.
 *
 * Reconstruido por introspección del código de la app (rutas /api) — 2026-06.
 */

export const DATABASE_SCHEMA = `
ESQUEMA DE DATOS (estructura común a todos los gimnasios)
═══════════════════════════════════════════════════════════

REGLA DE FECHAS (clave — más simple que en otros sistemas):
  Las fechas son DATETIME reales. Filtra SIEMPRE con funciones de fecha sobre la
  columna de fecha de cada tabla. NO existe una columna "Mes" numérica engañosa.
    • Hoy:            DATE(FechaX) = CURDATE()
    • Mes en curso:   YEAR(FechaX) = YEAR(CURDATE()) AND MONTH(FechaX) = MONTH(CURDATE())
    • Rango:          FechaX BETWEEN '2026-05-01 00:00:00' AND '2026-05-31 23:59:59'
  MySQL: LIMIT obligatorio en listados. Nunca TOP.

REGLA DE STATUS (en casi todas las tablas):
  • Status = 0 → activo / vigente
  • Status = 2 → cancelado / anulado / eliminado / dado de baja
  Filtra registros válidos con "Status = 0" (o "Status <> 2"). En socios,
  ventas, cuotas, etc. esto excluye los cancelados/eliminados.

───────────────────────────────────────────────────────────
VENTAS — FUENTE OFICIAL Y EXCLUSIVA DE ESTE GIMNASIO
───────────────────────────────────────────────────────────
Las ventas del gimnasio se obtienen exclusivamente de la familia de tablas de movimientos
(POS de escritorio/legacy). NUNCA uses tblVentas ni tblDetalleVentas ni tblVentasPagos.

• Tablas de Ventas:
  tblMovimientos: IdMovimiento, IdSucursal, FolioMovimiento, FechaMovimiento(datetime),
             IdSocio, FormaPago(texto resumen de la forma de pago), Total, Status(0=activo, 2=cancelado)
  tblDetalleMovimientos: IdDetalleMovimiento, IdMovimiento, IdSucursal, IdSocio, IdCuota,
             Cantidad, Precio, Iva, FechaInicio, FechaFin, TipoCuota, Vigencia, TipoVigencia,
             Periodo, DescripcionCuota(nombre del concepto vendido)
  tblMovimientosPagos: IdMovimientoPago, IdSucursal, IdMovimiento, IdFormaPago, Pago(monto),
             Comision(%), TotalPago, FechaAct
             → desglose por forma de pago de cada movimiento.

• Reglas de Negocio de Ventas:
  • Total de ventas de un período = SUM(Total) WHERE Status = 0 (o <> 2) sobre tblMovimientos,
    filtrando por FechaMovimiento.
  • "Tickets"/"operaciones" = COUNT del IdMovimiento.
  • Ticket promedio = SUM(Total)/COUNT(*).
  • Comisión de una forma de pago = SUM(Pago) * (Comision/100) en tblMovimientosPagos.

───────────────────────────────────────────────────────────
SOCIOS / CLIENTES
───────────────────────────────────────────────────────────
tblSocios: IdSocio, IdSucursal, Socio(nombre)/Nombres, CodigoSocio, CodigoBarras,
           TarjetaRFID, Telefono, OtroTelefono, CorreoElectronico, Sexo(0,1=Hombre, 2=Mujer), Pais, Estado,
           Localidad, CodigoPostal, ContactoEmergencia, FechaAlta/FechaAct,
           FechaVencimiento(datetime — fin de su membresía), Status(0=activo,2=baja),
           ArchivoFoto, FotoActiva
  • NOTA CLAVE: Los CLIENTES del gimnasio son los socios. Si te preguntan por clientes o socios,
    debes consultar siempre en tblSocios.
  • SOCIO/CLIENTE ACTIVO (membresía vigente): Status = 0 AND FechaVencimiento >= CURDATE().
  • SOCIO/CLIENTE VENCIDO: Status = 0 AND FechaVencimiento < CURDATE().
  • "Por vencer en N días": FechaVencimiento BETWEEN CURDATE() AND CURDATE()+INTERVAL N DAY.
  • REGLA OBLIGATORIA DE CONTACTO: Para el agente, el dato de contacto principal y prioritario de un socio es siempre su teléfono en la columna 'OtroTelefono' (tiene mayor prioridad que su correo electrónico 'CorreoElectronico'). Al consultar, listar o reportar socios (especialmente los que vencen, por vencer o vencidos) para efectos de contacto o cobranza, la consulta SQL generada DEBE incluir SIEMPRE la columna 'OtroTelefono' como canal de contacto prioritario.
  • CONSULTA DE HOMBRES / MUJERES (GÉNERO/SEXO): Si se pide una consulta de Hombres/Mujeres, debes consultar en tblSocios la columna 'Sexo', donde: 0 o 1 = Hombre, y 2 = Mujer.
  • ALTAS/NUEVOS socios del período: filtra por su fecha de alta (FechaAlta o FechaAct).
  • La membresía se renueva al vender una cuota con TipoMembresia=1: la venta
    actualiza tblSocios.FechaVencimiento.
tblSociosFotos: IdSocio, IdSucursal, Foto(blob), EsUltimaFoto(1=vigente).

───────────────────────────────────────────────────────────
VISITAS / ACCESOS DE SOCIOS / CLIENTES (check-ins en el torniquete/recepción)
───────────────────────────────────────────────────────────
tblVisitas: IdVisita, IdSocio, IdUsuario, IdSucursal, FechaVisita(datetime)
  • Visita de SOCIO/CLIENTE: asistencia de miembros al gimnasio (IdSocio > 0).
  • Frecuencia de asistencia = visitas de socios / socios activos en el período.
  • Horas/días pico: agrupa por HOUR(FechaVisita) o DAYOFWEEK(FechaVisita).
  • REGLA DE BÚSQUEDA DE ASISTENCIA INDIVIDUAL: Al preguntar por la asistencia o accesos de una persona específica por su nombre (ej. "asistencia de Juan"):
    1. Primero debes buscar a la persona en 'tblSocios'.
    2. Si la encuentras en 'tblSocios', debes realizar la consulta de sus entradas/salidas en 'tblVisitas' relacionando por 'IdSocio'.
    3. Si NO encuentras a la persona en 'tblSocios', debes buscarla en 'tblUsuarios' (usuarios/empleados).
    4. Si la encuentras en 'tblUsuarios', debes realizar la consulta de su asistencia en 'tblAsistencias' relacionando por 'IdUsuario'.
tblVisitasRecientes: feed reciente para el dashboard. Para análisis histórico usa tblVisitas.

───────────────────────────────────────────────────────────
ASISTENCIAS DE EMPLEADOS / PERSONAL (checada de entrada/salida)
───────────────────────────────────────────────────────────
tblAsistencias: IdAsistencia, FechaAsistencia(datetime), IdUsuario, EsSalida(0=Entrada, 1=Salida),
                IdSucursal, RechazoHuella, IdLector, FechaAct
  • Asistencia de EMPLEADOS: checada de personal del staff (IdUsuario > 0). Relacionar por IdUsuario con tblUsuarios.

───────────────────────────────────────────────────────────
CUOTAS / MEMBRESÍAS Y PRODUCTOS (catálogo unificado de productos)
───────────────────────────────────────────────────────────
tblCuotas: IdCuota, Cuota(nombre), Descripcion, Precio, IVA, CodigoBarras, Status,
           TipoCuota, TipoMembresia, Vigencia, TipoVigencia, Sesiones, IdGrupoHorario,
           Multisucursal
  • NOTA CLAVE: tblCuotas indica los PRODUCTOS (tanto membresías/cuotas como artículos físicos).
    En la base de datos, IdCuota es IdProducto, y Cuota es el nombre del Producto.
  • TipoCuota = 1 → MEMBRESÍA / CUOTA (mensualidad, visita, semana, clase…).
  • TipoCuota = 2 → PRODUCTO de tienda (suplementos, agua, ropa, etc.).
  • TipoMembresia = 1 → al venderse extiende la FechaVencimiento del socio.
  • Vigencia + TipoVigencia: duración. TipoVigencia 1=días, 2=semanas, 3=meses.
  • Sesiones → nº de accesos incluidos (planes por sesiones).
  • IdGrupoHorario → restringe el horario de acceso (ver tblGruposHorarios).
  En ventas, el concepto vendido queda en tblDetalleMovimientos.DescripcionCuota y el
  vínculo es tblDetalleMovimientos.IdCuota → tblCuotas.IdCuota.

───────────────────────────────────────────────────────────
SUCURSALES, USUARIOS (empleados), PUESTOS
───────────────────────────────────────────────────────────
tblSucursales: IdSucursal, Sucursal(nombre), Clave(prefijo de folios), Status
tblUsuarios:   IdUsuario, Usuario(nombre), Login, IdSucursal, IdPuesto,
               CorreoElectronico, Status, EsAdmin/EsAdministrador, ArchivoFoto
  • Empleados/staff del gimnasio. Instructores de clase se referencian por IdUsuario.
tblPuestos:    IdPuesto, Puesto(nombre), EsAdministrador, Status

───────────────────────────────────────────────────────────
FORMAS DE PAGO
───────────────────────────────────────────────────────────
tblFormasPago: IdFormaPago, FormaPago(nombre: Efectivo, Tarjeta, Transferencia…),
               Comision(% que cobra la terminal/medio), Status
  • Mezcla de formas de pago: agrupa tblMovimientosPagos por IdFormaPago.
  • Costo por comisiones = SUM(Pago * Comision/100).

───────────────────────────────────────────────────────────
GRUPOS HORARIOS, CLASES Y EVENTOS
───────────────────────────────────────────────────────────
tblGruposHorarios: IdGrupoHorario, GrupoHorario(nombre), Status
tblGruposHorariosDias: días/horas permitidos por grupo horario.
tblClases: IdClase, Clase(nombre), EsEvento(0=clase recurrente,1=evento puntual),
           FechaEvento, HoraInicio, HoraFin, IdUsuarioInstructor(→tblUsuarios),
           IdSucursal, ArchivoImagen, Status(<2 activa)
tblClasesDias: IdClase, día de la semana + horario de cada clase recurrente.

───────────────────────────────────────────────────────────
PROVEEDORES, COMPRAS E INVENTARIO  (gastos)
───────────────────────────────────────────────────────────
tblProveedores: IdProveedor, Proveedor, RFC, Contacto, Telefono, CorreoElectronico,
                Estado, Localidad, Status
  Las compras e inventario de productos de tienda pueden no existir en todos los
  proyectos. Si una tabla de compras/inventario/gastos no aparece en el catálogo,
  NO la asumas: explora con SHOW TABLES o avisa que ese módulo no tiene datos.

───────────────────────────────────────────────────────────
PLANES DE ENTRENAMIENTO
───────────────────────────────────────────────────────────
tblPlanesEntrenamiento: Socio, CodigoSocio, Genero, Edad, Peso, Estatura, Dias,
                Minutos, Observaciones, PlanEntrenamiento(texto IA), FechaPlanEntrenamiento, UUID

───────────────────────────────────────────────────────────
JOINS CLAVE
───────────────────────────────────────────────────────────
tblMovimientos.IdMovimiento      → tblDetalleMovimientos.IdMovimiento (+ IdSucursal)
tblMovimientos.IdMovimiento      → tblMovimientosPagos.IdMovimiento (+ IdSucursal)
tblMovimientosPagos.IdFormaPago  → tblFormasPago.IdFormaPago
tblDetalleMovimientos.IdCuota    → tblCuotas.IdCuota
tblMovimientos.IdSocio / tblVisitas.IdSocio  → tblSocios.IdSocio
tblAsistencias.IdUsuario / tblVisitas.IdUsuario / tblClases.IdUsuarioInstructor / tblUsuarios.IdUsuario
tblUsuarios.IdPuesto             → tblPuestos.IdPuesto
tblCuotas.IdGrupoHorario         → tblGruposHorarios.IdGrupoHorario
Casi todas las tablas operativas tienen IdSucursal → tblSucursales.IdSucursal
`;
