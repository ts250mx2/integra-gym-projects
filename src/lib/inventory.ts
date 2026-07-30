import { cookies } from 'next/headers';
import { getProjectConnectionPoolRaw } from './projectDb';

/**
 * Motor de inventario y compras.
 *
 * Los modulos de Inventarios y Compras trabajan UNICAMENTE con productos:
 * en tblCuotas, TipoCuota = 2 es producto y TipoCuota = 1 es cuota/membresia.
 * Las cuotas nunca entran al inventario ni a una compra.
 *
 * Las tablas se crean bajo demanda (lazy migration) en la BD de cada proyecto,
 * igual que tblProveedores, porque las BDs de los gimnasios viven en varios
 * servidores y no existe una migracion central.
 */

export const PRODUCT_TIPO_CUOTA = 2;

export const MOVEMENT_TYPES = {
    INITIAL: 'INICIAL',
    PURCHASE: 'COMPRA',
    PURCHASE_CANCEL: 'CANCELA_COMPRA',
    SALE: 'VENTA',
    ADJUSTMENT: 'AJUSTE',
    WASTE: 'MERMA'
} as const;

export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

export interface InventorySession {
    projectId: number;
    branchId: number;
    userId: number;
    isAdmin: number;
}

export interface StockMovementInput {
    branchId: number;
    idCuota: number;
    /** Cantidad con signo: positiva entra al almacen, negativa sale. */
    cantidad: number;
    tipo: MovementType;
    costo?: number;
    referencia?: string | null;
    idReferencia?: number;
    idUsuario?: number;
    notas?: string | null;
}

const CHARSET = 'ENGINE=MyISAM DEFAULT CHARSET=latin1';

const TABLE_DDL: string[] = [
    `CREATE TABLE IF NOT EXISTS tblInventario (
        IdInventario INT NOT NULL AUTO_INCREMENT,
        IdSucursal INT NOT NULL DEFAULT 0,
        IdCuota INT NOT NULL DEFAULT 0,
        Existencia DOUBLE NOT NULL DEFAULT 0,
        StockMinimo DOUBLE NOT NULL DEFAULT 0,
        CostoPromedio DOUBLE NOT NULL DEFAULT 0,
        FechaAct DATETIME DEFAULT NULL,
        PRIMARY KEY (IdInventario),
        UNIQUE KEY uq_inventario_sucursal_cuota (IdSucursal, IdCuota)
    ) ${CHARSET}`,

    `CREATE TABLE IF NOT EXISTS tblMovimientosInventario (
        IdMovimientoInv INT NOT NULL AUTO_INCREMENT,
        IdSucursal INT NOT NULL DEFAULT 0,
        IdCuota INT NOT NULL DEFAULT 0,
        Fecha DATETIME DEFAULT NULL,
        Tipo VARCHAR(20) DEFAULT NULL,
        Cantidad DOUBLE NOT NULL DEFAULT 0,
        Costo DOUBLE NOT NULL DEFAULT 0,
        ExistenciaAnterior DOUBLE NOT NULL DEFAULT 0,
        ExistenciaNueva DOUBLE NOT NULL DEFAULT 0,
        Referencia VARCHAR(100) DEFAULT NULL,
        IdReferencia INT NOT NULL DEFAULT 0,
        IdUsuario INT NOT NULL DEFAULT 0,
        Notas VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (IdMovimientoInv),
        KEY idx_mov_producto (IdSucursal, IdCuota, Fecha),
        KEY idx_mov_referencia (Tipo, IdReferencia)
    ) ${CHARSET}`,

    `CREATE TABLE IF NOT EXISTS tblCompras (
        IdCompra INT NOT NULL AUTO_INCREMENT,
        IdSucursal INT NOT NULL DEFAULT 0,
        IdProveedor INT NOT NULL DEFAULT 0,
        Proveedor VARCHAR(245) DEFAULT NULL,
        Folio VARCHAR(45) DEFAULT NULL,
        Referencia VARCHAR(100) DEFAULT NULL,
        FechaCompra DATETIME DEFAULT NULL,
        Subtotal DOUBLE NOT NULL DEFAULT 0,
        Iva DOUBLE NOT NULL DEFAULT 0,
        Total DOUBLE NOT NULL DEFAULT 0,
        Notas VARCHAR(500) DEFAULT NULL,
        IdUsuario INT NOT NULL DEFAULT 0,
        Status INT NOT NULL DEFAULT 0,
        FechaAct DATETIME DEFAULT NULL,
        UUID VARCHAR(45) DEFAULT NULL,
        PRIMARY KEY (IdCompra),
        KEY idx_compra_sucursal (IdSucursal, FechaCompra)
    ) ${CHARSET}`,

    `CREATE TABLE IF NOT EXISTS tblDetalleCompras (
        IdDetalleCompra INT NOT NULL AUTO_INCREMENT,
        IdCompra INT NOT NULL DEFAULT 0,
        IdSucursal INT NOT NULL DEFAULT 0,
        IdCuota INT NOT NULL DEFAULT 0,
        Producto VARCHAR(245) DEFAULT NULL,
        Cantidad DOUBLE NOT NULL DEFAULT 0,
        Costo DOUBLE NOT NULL DEFAULT 0,
        Iva DOUBLE NOT NULL DEFAULT 0,
        Importe DOUBLE NOT NULL DEFAULT 0,
        PRIMARY KEY (IdDetalleCompra),
        KEY idx_detalle_compra (IdCompra)
    ) ${CHARSET}`,

    `CREATE TABLE IF NOT EXISTS tblProveedores (
        IdProveedor INT NOT NULL AUTO_INCREMENT,
        Proveedor VARCHAR(255) NOT NULL,
        RFC VARCHAR(20) DEFAULT NULL,
        Contacto VARCHAR(255) DEFAULT NULL,
        Direccion1 VARCHAR(255) DEFAULT NULL,
        Direccion2 VARCHAR(255) DEFAULT NULL,
        Pais VARCHAR(100) DEFAULT NULL,
        Estado VARCHAR(100) DEFAULT NULL,
        Localidad VARCHAR(100) DEFAULT NULL,
        CodigoPostal VARCHAR(20) DEFAULT NULL,
        Telefono VARCHAR(50) DEFAULT NULL,
        CorreoElectronico VARCHAR(255) DEFAULT NULL,
        Status INT DEFAULT 0,
        FechaAct DATETIME DEFAULT NULL,
        PRIMARY KEY (IdProveedor)
    ) ${CHARSET}`
];

/** Proyectos cuyo esquema ya se verifico en este proceso; evita correr DDL en cada request. */
const ensuredProjects = new Set<number>();

export function round2(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Pool directo del proyecto de la sesion. No usa projectQuery porque el modo
 * integrado (ProyectosIntegrados) replica los SELECT en todos los gimnasios y
 * fusiona resultados: para operar inventario y compras siempre hay que escribir
 * y leer en la BD del gimnasio activo.
 */
async function getPool(projectId: number) {
    return await getProjectConnectionPoolRaw(projectId);
}

export async function ensureInventorySchema(projectId: number): Promise<void> {
    if (ensuredProjects.has(projectId)) return;

    const pool = await getPool(projectId);
    for (const ddl of TABLE_DDL) {
        await pool.query(ddl);
    }
    ensuredProjects.add(projectId);
}

export async function inventoryQuery(projectId: number, sql: string, params: any[] = []): Promise<any[]> {
    const pool = await getPool(projectId);
    const [rows] = await pool.execute(sql, params);
    return rows as any[];
}

/** Igual que inventoryQuery pero devuelve el ResultSetHeader (para leer insertId). */
export async function inventoryExecute(projectId: number, sql: string, params: any[] = []): Promise<any> {
    const pool = await getPool(projectId);
    const [result] = await pool.execute(sql, params);
    return result;
}

export async function getSession(): Promise<InventorySession | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        if (!session.projectId) return null;
        return {
            projectId: Number(session.projectId),
            branchId: Number(session.branchId) || 0,
            // El super admin no existe en tblUsuarios del gimnasio; se le atribuye el admin local.
            userId: session.isAdmin === 2 ? 1 : Number(session.userId) || 0,
            isAdmin: Number(session.isAdmin) || 0
        };
    } catch {
        return null;
    }
}

/**
 * La sesion puede traer IdSucursal 0 (admin central). El inventario siempre vive
 * en una sucursal concreta, asi que se resuelve a la primera sucursal activa.
 */
export async function resolveBranchId(projectId: number, requestedBranchId?: number | null): Promise<number> {
    const requested = Number(requestedBranchId) || 0;
    if (requested > 0) return requested;

    const branches = await inventoryQuery(
        projectId,
        'SELECT IdSucursal FROM tblSucursales WHERE Status = 0 ORDER BY IdSucursal ASC LIMIT 1'
    );
    return Number(branches[0]?.IdSucursal) || 0;
}

/** Devuelve el producto si existe y es producto (TipoCuota = 2); null en cualquier otro caso. */
export async function findProduct(projectId: number, idCuota: number): Promise<any | null> {
    const rows = await inventoryQuery(
        projectId,
        `SELECT IdCuota, Cuota, CodigoBarras, Precio, Costo, IVA, TipoCuota
         FROM tblCuotas
         WHERE IdCuota = ? AND TipoCuota = ? AND Status = 0`,
        [idCuota, PRODUCT_TIPO_CUOTA]
    );
    return rows[0] || null;
}

async function getStockRow(projectId: number, branchId: number, idCuota: number) {
    const rows = await inventoryQuery(
        projectId,
        'SELECT IdInventario, Existencia, CostoPromedio, StockMinimo FROM tblInventario WHERE IdSucursal = ? AND IdCuota = ?',
        [branchId, idCuota]
    );
    return rows[0] || null;
}

/**
 * Mantiene tblCuotas.Exi como la existencia global del producto (suma de todas
 * las sucursales). Es el campo que lee el sistema de escritorio heredado.
 */
async function syncLegacyStock(projectId: number, idCuota: number): Promise<void> {
    const totals = await inventoryQuery(
        projectId,
        'SELECT COALESCE(SUM(Existencia), 0) AS total FROM tblInventario WHERE IdCuota = ?',
        [idCuota]
    );
    const total = Number(totals[0]?.total) || 0;
    await inventoryQuery(projectId, 'UPDATE tblCuotas SET Exi = ? WHERE IdCuota = ?', [round2(total), idCuota]);
}

/** Costo promedio ponderado: solo lo mueven las entradas con costo declarado. */
function nextAverageCost(prevStock: number, prevCost: number, cantidad: number, costo: number): number {
    if (cantidad <= 0 || costo <= 0) return prevCost;

    const baseStock = Math.max(prevStock, 0);
    const newStock = baseStock + cantidad;
    if (newStock <= 0) return costo;

    return round2((baseStock * prevCost + cantidad * costo) / newStock);
}

/**
 * Aplica un movimiento de stock: actualiza existencia, recalcula costo promedio,
 * escribe el kardex y sincroniza la existencia legada.
 * Devuelve la existencia resultante.
 */
export async function applyStockMovement(projectId: number, input: StockMovementInput): Promise<number> {
    const {
        branchId,
        idCuota,
        cantidad,
        tipo,
        costo = 0,
        referencia = null,
        idReferencia = 0,
        idUsuario = 0,
        notas = null
    } = input;

    const existing = await getStockRow(projectId, branchId, idCuota);
    const prevStock = Number(existing?.Existencia) || 0;
    const prevCost = Number(existing?.CostoPromedio) || 0;

    const newStock = round2(prevStock + cantidad);
    const newCost = nextAverageCost(prevStock, prevCost, cantidad, Number(costo) || 0);

    if (existing) {
        await inventoryQuery(
            projectId,
            'UPDATE tblInventario SET Existencia = ?, CostoPromedio = ?, FechaAct = NOW() WHERE IdInventario = ?',
            [newStock, newCost, existing.IdInventario]
        );
    } else {
        await inventoryQuery(
            projectId,
            `INSERT INTO tblInventario (IdSucursal, IdCuota, Existencia, StockMinimo, CostoPromedio, FechaAct)
             VALUES (?, ?, ?, 0, ?, NOW())`,
            [branchId, idCuota, newStock, newCost]
        );
    }

    await inventoryQuery(
        projectId,
        `INSERT INTO tblMovimientosInventario
         (IdSucursal, IdCuota, Fecha, Tipo, Cantidad, Costo, ExistenciaAnterior, ExistenciaNueva, Referencia, IdReferencia, IdUsuario, Notas)
         VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            branchId,
            idCuota,
            tipo,
            round2(cantidad),
            round2(Number(costo) || 0),
            prevStock,
            newStock,
            referencia,
            idReferencia,
            idUsuario,
            notas
        ]
    );

    await syncLegacyStock(projectId, idCuota);

    return newStock;
}

/**
 * Descuenta del inventario los productos de una venta. Nunca lanza: una venta ya
 * cobrada no debe fallar porque el inventario no cuadre, y las cuotas
 * (TipoCuota = 1) simplemente se ignoran.
 */
export async function registerSaleStockExit(params: {
    projectId: number;
    branchId: number;
    userId: number;
    saleId: number;
    folio?: string | null;
    items: Array<{ idCuota: number; cantidad: number }>;
}): Promise<void> {
    const { projectId, branchId, userId, saleId, folio = null, items } = params;
    if (!items.length) return;

    try {
        await ensureInventorySchema(projectId);

        // Evita registrar existencias en una sucursal 0 si la sesion venia sin sucursal.
        const targetBranch = await resolveBranchId(projectId, branchId);
        if (!targetBranch) return;

        for (const item of items) {
            const product = await findProduct(projectId, item.idCuota);
            if (!product) continue;

            await applyStockMovement(projectId, {
                branchId: targetBranch,
                idCuota: item.idCuota,
                cantidad: -Math.abs(Number(item.cantidad) || 0),
                tipo: MOVEMENT_TYPES.SALE,
                costo: Number(product.Costo) || 0,
                referencia: folio,
                idReferencia: saleId,
                idUsuario: userId
            });
        }
    } catch (error) {
        console.error('[inventory] No se pudo descontar el stock de la venta', saleId, error);
    }
}
