/**
 * Catálogo DINÁMICO del proyecto (gimnasio) de la sesión activa.
 *
 * Cada proyecto tiene su propia BD con la misma estructura pero datos distintos:
 * los IDs de sucursales/formas de pago/grupos horarios NO son estables entre
 * proyectos, los nombres cambian, y —lo más importante— unos gimnasios capturan
 * sus ventas en `tblVentas` (POS web) y otros en `tblMovimientos` (POS escritorio).
 * Este módulo consulta el pool del proyecto activo y arma un bloque de texto que
 * se inyecta en el system prompt para que el agente escriba SQL correcto contra
 * ESTE gimnasio en particular (incluyendo QUÉ tabla de ventas usar).
 *
 * Se cachea por proyecto unos minutos porque las dimensiones casi no cambian.
 */

import type { Pool } from 'mysql2/promise';

interface CacheEntry { text: string; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function safeRows(pool: Pool, sql: string): Promise<any[]> {
    try {
        const [rows] = await pool.query(sql);
        return Array.isArray(rows) ? (rows as any[]) : [];
    } catch {
        return [];
    }
}

function listDim(rows: any[], idKey: string, nameKey: string, extra?: (r: any) => string): string {
    if (rows.length === 0) return '  (ninguno activo)';
    return rows.map(r => {
        const tail = extra ? ` ${extra(r)}` : '';
        return `  ${r[idKey]} → ${String(r[nameKey] ?? '').trim()}${tail}`;
    }).join('\n');
}

function fmtDate(v: any): string {
    if (!v) return '?';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString().split('T')[0];
}

async function detectSalesSource(pool: Pool): Promise<string> {
    const [movs] = await safeRows(pool,
        `SELECT COUNT(*) AS n, MIN(FechaMovimiento) AS minF, MAX(FechaMovimiento) AS maxF FROM tblMovimientos WHERE Status <> 2`);

    const nM = Number(movs?.n ?? 0);
    const lineM = `tblMovimientos (POS escritorio): ${nM} movimientos` + (nM ? ` · ${fmtDate(movs?.minF)} → ${fmtDate(movs?.maxF)}` : '');

    const recommendation = 'USA **tblMovimientos** (+ tblDetalleMovimientos, tblMovimientosPagos) — es la fuente de ventas configurada y oficial de este gimnasio. Fecha: FechaMovimiento. Filtra Status <> 2. Las formas de pago se obtienen de tblMovimientosPagos.';

    return `⚠️ FUENTE DE VENTAS ACTIVA:
  • ${lineM}
  → ${recommendation}`;
}

// ─── Builder principal ──────────────────────────────────────────────────────
export async function buildProjectCatalog(
    pool: Pool, cacheKey?: string
): Promise<string> {
    if (cacheKey) {
        const hit = CACHE.get(cacheKey);
        if (hit && hit.expires > Date.now()) return hit.text;
    }

    const CAP = 40;

    const [
        sucursales, formasPago, puestos, gruposHorarios, clases,
        cuotasAll, productosAll, salesSource, sociosResumen, visitasRango,
    ] = await Promise.all([
        safeRows(pool, `SELECT IdSucursal, Sucursal, Clave FROM tblSucursales WHERE COALESCE(Status,0) <> 2 ORDER BY IdSucursal`),
        safeRows(pool, `SELECT IdFormaPago, FormaPago, Comision FROM tblFormasPago WHERE COALESCE(Status,0) <> 2 ORDER BY IdFormaPago`),
        safeRows(pool, `SELECT IdPuesto, Puesto FROM tblPuestos WHERE COALESCE(Status,0) <> 2 ORDER BY IdPuesto`),
        safeRows(pool, `SELECT IdGrupoHorario, GrupoHorario FROM tblGruposHorarios WHERE COALESCE(Status,0) <> 2 ORDER BY IdGrupoHorario`),
        safeRows(pool, `SELECT IdClase, Clase, EsEvento FROM tblClases WHERE COALESCE(Status,0) < 2 ORDER BY IdClase LIMIT 60`),
        safeRows(pool, `SELECT IdCuota, Cuota, Precio, Vigencia, TipoVigencia, TipoMembresia FROM tblCuotas WHERE COALESCE(Status,0) <> 2 AND TipoCuota = 1 ORDER BY Precio`),
        safeRows(pool, `SELECT IdCuota, Cuota, Precio FROM tblCuotas WHERE COALESCE(Status,0) <> 2 AND TipoCuota = 2 ORDER BY Cuota`),
        detectSalesSource(pool),
        safeRows(pool, `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN Status = 0 AND FechaVencimiento >= CURDATE() THEN 1 ELSE 0 END) AS activos,
                SUM(CASE WHEN Status = 0 AND FechaVencimiento < CURDATE() THEN 1 ELSE 0 END) AS vencidos
             FROM tblSocios WHERE Status <> 2`),
        safeRows(pool, `SELECT MIN(FechaVisita) AS minF, MAX(FechaVisita) AS maxF, COUNT(*) AS n FROM tblVisitas`),
    ]);

    const cuotas = cuotasAll.slice(0, CAP);
    const productos = productosAll.slice(0, CAP);
    const soc = sociosResumen[0] || {};
    const vis = visitasRango[0] || {};

    const vigText = (r: any) => {
        const v = Number(r.Vigencia) || 0;
        const t = Number(r.TipoVigencia);
        const u = t === 1 ? 'día(s)' : t === 2 ? 'semana(s)' : t === 3 ? 'mes(es)' : '';
        const dur = v && u ? `${v} ${u}` : '';
        const mem = Number(r.TipoMembresia) === 1 ? ' · membresía' : '';
        const precio = `$${Number(r.Precio || 0).toLocaleString('es-MX')}`;
        return `· ${precio}${dur ? ` · ${dur}` : ''}${mem}`;
    };
    const text = `
CATÁLOGO DEL PROYECTO (datos REALES de la BD del gimnasio activo — úsalos para filtrar y nombrar)
═══════════════════════════════════════════════════════════════════════════

${salesSource}

SOCIOS / CLIENTES (snapshot actual): total ${Number(soc.total) || 0} · activos (vigentes) ${Number(soc.activos) || 0} · vencidos ${Number(soc.vencidos) || 0}
(Nota: Clientes equivale a Socios y se obtienen de tblSocios)
VISITAS registradas: ${Number(vis.n) || 0}${Number(vis.n) ? ` · ${fmtDate(vis.minF)} → ${fmtDate(vis.maxF)}` : ''}

SUCURSALES (IdSucursal → nombre · clave):
${listDim(sucursales, 'IdSucursal', 'Sucursal', r => `· ${String(r.Clave ?? '').trim()}`)}

FORMAS DE PAGO (IdFormaPago → nombre · comisión):
${listDim(formasPago, 'IdFormaPago', 'FormaPago', r => `· ${Number(r.Comision) || 0}%`)}

PUESTOS (IdPuesto → nombre):
${listDim(puestos, 'IdPuesto', 'Puesto')}

GRUPOS HORARIOS (IdGrupoHorario → nombre):
${listDim(gruposHorarios, 'IdGrupoHorario', 'GrupoHorario')}

PRODUCTOS / CUOTAS (TipoCuota=1) (IdCuota [IdProducto] → nombre [Producto] · precio · vigencia)${cuotasAll.length > CAP ? ` — mostrando ${CAP} de ${cuotasAll.length}` : ''}:
${listDim(cuotas, 'IdCuota', 'Cuota', vigText)}

PRODUCTOS DE TIENDA (TipoCuota=2) (IdCuota [IdProducto] → nombre [Producto] · precio)${productosAll.length > CAP ? ` — mostrando ${CAP} de ${productosAll.length}` : ''}:
${listDim(productos, 'IdCuota', 'Cuota', r => `· $${Number(r.Precio || 0).toLocaleString('es-MX')}`)}

CLASES Y EVENTOS (IdClase → nombre · tipo):
${listDim(clases, 'IdClase', 'Clase', r => `· ${Number(r.EsEvento) === 1 ? 'evento' : 'clase'}`)}
`.trim();


    if (cacheKey) CACHE.set(cacheKey, { text, expires: Date.now() + TTL_MS });
    return text;
}
