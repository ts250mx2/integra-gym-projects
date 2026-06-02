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

  ⚠️ RENOVACIONES Y VENCIMIENTOS HISTÓRICOS — REGLA OBLIGATORIA (error #1):
  tblSocios.FechaVencimiento es el vencimiento ACTUAL y la renovación lo SOBRESCRIBE
  empujándolo al futuro. Por eso NUNCA uses tblSocios.FechaVencimiento para responder
  "quién venció en el mes/período X" ni "cuántos renovaron/no renovaron": los que
  renovaron ya no aparecen como vencidos y el conteo sale mal.
  El historial real de coberturas vive en tblDetalleMovimientos (FechaInicio, FechaFin,
  TipoCuota=1 = membresía). Usa SIEMPRE FechaFin, no FechaVencimiento, para vencimientos
  históricos. Patrón canónico (ajusta el rango del período):
    WITH bounds AS (
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AS lmStart,
             DATE_FORMAT(CURDATE(), '%Y-%m-01')                    AS thisStart
    ),
    mem AS (                       -- coberturas de membresía vendidas
      SELECT d.IdSocio, d.FechaFin
      FROM tblDetalleMovimientos d
      JOIN tblMovimientos m ON m.IdMovimiento = d.IdMovimiento AND m.IdSucursal = d.IdSucursal
      WHERE m.Status <> 2 AND d.TipoCuota = 1 AND d.FechaFin IS NOT NULL
    ),
    ult AS (                       -- última cobertura terminada antes de este mes
      SELECT mem.IdSocio, MAX(mem.FechaFin) AS ultimoFin
      FROM mem CROSS JOIN bounds b WHERE mem.FechaFin < b.thisStart GROUP BY mem.IdSocio
    ),
    vencieron AS (                 -- esa última cobertura cayó EN el período pasado
      SELECT u.IdSocio, u.ultimoFin FROM ult u CROSS JOIN bounds b
      WHERE u.ultimoFin >= b.lmStart AND u.ultimoFin < b.thisStart
    ),
    renov AS (                     -- tienen cobertura de este mes en adelante = renovaron
      SELECT DISTINCT mem.IdSocio FROM mem CROSS JOIN bounds b WHERE mem.FechaFin >= b.thisStart
    )
    SELECT COUNT(*) AS vencieron, SUM(r.IdSocio IS NOT NULL) AS renovaron,
           SUM(r.IdSocio IS NULL) AS no_renovaron
    FROM vencieron v LEFT JOIN renov r ON r.IdSocio = v.IdSocio;
  - "vencieron en el período" = su última cobertura (FechaFin) que terminó antes del mes
    actual cae dentro del período pedido.
  - "renovaron" = de esos, los que tienen otra membresía con FechaFin que se extiende al
    mes actual o después (volvieron a tener cobertura). "no renovaron" = el resto.
  - Para la LISTA de los que no renovaron (cobranza): mismos CTE + JOIN tblSocios y trae
    Socio + OtroTelefono + DATE(ultimoFin); filtra r.IdSocio IS NULL.
  - Para otro período (ej. "abril"), cambia lmStart/thisStart por el inicio del período y el
    inicio del período siguiente. Para una sucursal, agrega AND m.IdSucursal = <id> en mem.
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
  • REGLA OBLIGATORIA PARA RUTINAS Y PLANES DE ENTRENAMIENTO:
    1. Si el usuario te pregunta por su rutina o plan de entrenamiento registrado (ej. "dame mi rutina", "ver mi plan"):
       - Consulta 'tblPlanesEntrenamiento' buscando coincidencia por 'Socio' (nombre) o 'CodigoSocio' (código del socio).
       - Si encuentras un registro:
         - Si tiene 'PlanEntrenamiento' con contenido, preséntale un resumen claro y motivador del plan, y proporciónale el enlace directo para que pueda verlo, editarlo o descargarlo en PDF: \`[Ver, Editar e Imprimir mi Plan de Entrenamiento](/training-plan?projectUuid=[projectUuid]&planUuid=[UUID])\` (obteniendo el projectUuid de los datos del proyecto activo).
         - Si está vacío, dile de forma entusiasta que tiene un perfil listo para generar su rutina y dale el enlace para que lo genere con un solo clic en la plataforma: /training-plan?projectUuid=[projectUuid]&planUuid=[UUID].
    2. Si el usuario te pide directamente que le diseñes, recomiendes o hagas una rutina en el chat (ej. "hazme una rutina de 3 días para ganar masa muscular", "rutina de pierna"):
       - Asume el rol de un Entrenador Personal de Élite de Integra Gym.
       - Diseña una rutina altamente profesional, detallada y estructurada día por día, con calentamiento, ejercicios específicos en negrita, series, repeticiones, tiempos de descanso, estiramiento y consejos de nutrición/motivación directamente en el chat.

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
