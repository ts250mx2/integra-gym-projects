import { cache } from 'react';
import type { Pool } from 'mysql2/promise';
import { query } from './db';
import { getProjectConnectionPoolRaw, type ProjectMetadata } from './projectDb';

/**
 * Reporte público (por UUID de proyecto) de los cobros recurrentes con Stripe que hace
 * integra-recurrencia: suscripciones de tblSuscripcionesStripe con su historial de
 * intentos de cobro en tblPagosStripe.
 */

// Ventana de pagos del reporte. Acota la consulta: una tarjeta rechazada deja un intento
// por cada corrida de integra-recurrencia, así que tblPagosStripe crece a diario.
export const PAYMENT_WINDOW_MONTHS = 12;

// integra-recurrencia (main.py) solo cobra las suscripciones con Status < 2.
const AUTO_CHARGE_MAX_STATUS = 2;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIPE_REQUEST_PREFIX_RE = /^Request req_\w+:\s*/;

export interface RecurringPayment {
    id: number;
    date: string; // 'YYYY-MM-DD HH:mm:ss', hora del servidor de BD
    amount: number;
    isPaid: boolean;
    movementId: number; // 0 = cobrado pero sin movimiento registrado en caja
    paymentIntent: string;
    message: string;
    fee: string | null;
}

export interface PaymentStats {
    paidCount: number;
    paidTotal: number;
    failedCount: number;
    lastPaidAt: string | null;
    lastAttempt: RecurringPayment | null;
}

interface MemberRef {
    memberId: number;
    memberName: string | null;
    branch: string | null;
}

export interface Subscription extends MemberRef {
    id: number;
    fee: string | null;
    amount: number;
    status: number;
    isAutoCharged: boolean;
    isOverdue: boolean;
    daysOverdue: number;
    nextChargeAt: string | null;
    payments: RecurringPayment[];
    stats: PaymentStats;
}

export interface OrphanPayments extends MemberRef {
    key: string;
    payments: RecurringPayment[];
    stats: PaymentStats;
}

export interface ReportSummary {
    autoChargedCount: number;
    monthlyRecurring: number;
    overdueCount: number;
    overdueMonthly: number;
    paidThisMonth: number;
    paidThisMonthCount: number;
    failedThisMonthCount: number;
    failedThisMonthMembers: number;
    paidInWindow: number;
    paidInWindowCount: number;
}

export interface RecurringReport {
    projectName: string;
    generatedAt: string;
    currentMonth: string; // 'YYYY-MM'
    summary: ReportSummary;
    overdue: Subscription[];
    upToDate: Subscription[];
    withoutAutoCharge: Subscription[];
    orphans: OrphanPayments[];
}

export type RecurringReportResult =
    | { kind: 'ok'; report: RecurringReport }
    | { kind: 'not-configured'; projectName: string }
    | { kind: 'not-found' };

interface MemberKeyFields {
    IdSocio: number;
    IdSucursalSocio: number;
    IdSucursal: number;
}

export interface SubscriptionRow extends MemberKeyFields {
    IdSuscripcionStripe: number;
    PagoRecurrente: number | null;
    Status: number | null;
    Socio: string | null;
    Sucursal: string | null;
    Cuota: string | null;
    FechaProximoPago: string | null;
    Atrasada: number | null;
    DiasAtraso: number | null;
}

export interface PaymentRow extends MemberKeyFields {
    IdPagoStripe: number;
    Pago: number | null;
    Pagado: number | null;
    IdMovimiento: number | null;
    PaymentIntent: string | null;
    Mensaje: string | null;
    FechaPago: string;
    Socio: string | null;
    Sucursal: string | null;
    Cuota: string | null;
}

// Fechas como texto (DATE_FORMAT) para que el servidor web no las recorra de zona horaria.
const NOW_SQL = `SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now`;

const SUBSCRIPTIONS_SQL = `
    SELECT s.IdSuscripcionStripe, s.IdSocio, s.IdSucursalSocio, s.IdSucursal, s.PagoRecurrente, s.Status,
           TRIM(CONCAT_WS(' ', so.Nombres, so.Apellidos)) AS Socio,
           su.Sucursal, c.Cuota,
           DATE_FORMAT(s.FechaProximoPago, '%Y-%m-%d %H:%i:%s') AS FechaProximoPago,
           s.FechaProximoPago < NOW() AS Atrasada,
           DATEDIFF(NOW(), s.FechaProximoPago) AS DiasAtraso
    FROM tblSuscripcionesStripe s
    LEFT JOIN tblSocios so ON so.IdSocio = s.IdSocio AND so.IdSucursal = s.IdSucursalSocio
    LEFT JOIN tblSucursales su ON su.IdSucursal = s.IdSucursal
    LEFT JOIN tblCuotas c ON c.IdCuota = s.IdCuotaRecurrente`;

const PAYMENTS_SQL = `
    SELECT p.IdPagoStripe, p.IdSocio, p.IdSucursalSocio, p.IdSucursal, p.Pago, p.Pagado, p.IdMovimiento,
           p.PaymentIntent, LEFT(p.Error, 400) AS Mensaje,
           DATE_FORMAT(p.FechaPago, '%Y-%m-%d %H:%i:%s') AS FechaPago,
           TRIM(CONCAT_WS(' ', so.Nombres, so.Apellidos)) AS Socio,
           su.Sucursal, c.Cuota
    FROM tblPagosStripe p
    LEFT JOIN tblSocios so ON so.IdSocio = p.IdSocio AND so.IdSucursal = p.IdSucursalSocio
    LEFT JOIN tblSucursales su ON su.IdSucursal = p.IdSucursal
    LEFT JOIN tblCuotas c ON c.IdCuota = p.IdCuota
    WHERE p.FechaPago >= DATE_SUB(NOW(), INTERVAL ? MONTH)
    ORDER BY p.FechaPago DESC, p.IdPagoStripe DESC`;

export function isValidUuid(value: string): boolean {
    return UUID_RE.test(value);
}

// Los pagos se ligan a la suscripción por socio + sucursal, no por UUID: pay/finalize reescribe
// el UUID de la suscripción cada vez que el socio vuelve a pagar en línea, y los pagos
// anteriores se quedan con el UUID viejo.
function memberKey(row: MemberKeyFields): string {
    return `${row.IdSocio}-${row.IdSucursalSocio}-${row.IdSucursal}`;
}

function blankToNull(value: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function sumAmounts(items: { amount: number }[]): number {
    return items.reduce((total, item) => total + item.amount, 0);
}

function toPayment(row: PaymentRow): RecurringPayment {
    const isPaid = Number(row.Pagado) === 1;
    return {
        id: row.IdPagoStripe,
        date: row.FechaPago,
        amount: Number(row.Pago) || 0,
        isPaid,
        movementId: Number(row.IdMovimiento) || 0,
        paymentIntent: row.PaymentIntent || '',
        // En cobros exitosos integra-recurrencia guarda "Exito", que no aporta nada.
        message: isPaid ? '' : (row.Mensaje || '').replace(STRIPE_REQUEST_PREFIX_RE, '').trim(),
        fee: blankToNull(row.Cuota),
    };
}

// `payments` llega del más reciente al más antiguo.
export function summarizePayments(payments: RecurringPayment[]): PaymentStats {
    const paid = payments.filter((payment) => payment.isPaid);
    return {
        paidCount: paid.length,
        paidTotal: sumAmounts(paid),
        failedCount: payments.length - paid.length,
        lastPaidAt: paid[0]?.date ?? null,
        lastAttempt: payments[0] ?? null,
    };
}

function groupByMember(rows: PaymentRow[]): Map<string, PaymentRow[]> {
    const groups = new Map<string, PaymentRow[]>();
    for (const row of rows) {
        const key = memberKey(row);
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }
    return groups;
}

function toSubscription(row: SubscriptionRow, paymentRows: PaymentRow[]): Subscription {
    const payments = paymentRows.map(toPayment);
    const status = Number(row.Status) || 0;
    return {
        id: row.IdSuscripcionStripe,
        memberId: row.IdSocio,
        memberName: blankToNull(row.Socio),
        branch: blankToNull(row.Sucursal),
        fee: blankToNull(row.Cuota),
        amount: Number(row.PagoRecurrente) || 0,
        status,
        isAutoCharged: status < AUTO_CHARGE_MAX_STATUS,
        isOverdue: Number(row.Atrasada) === 1,
        daysOverdue: Math.max(Number(row.DiasAtraso) || 0, 0),
        nextChargeAt: row.FechaProximoPago,
        payments,
        stats: summarizePayments(payments),
    };
}

function toOrphan(key: string, rows: PaymentRow[]): OrphanPayments {
    const [latest] = rows;
    const payments = rows.map(toPayment);
    return {
        key,
        memberId: latest.IdSocio,
        memberName: blankToNull(latest.Socio),
        branch: blankToNull(latest.Sucursal),
        payments,
        stats: summarizePayments(payments),
    };
}

function summarize(now: string, subscriptions: Subscription[], paymentRows: PaymentRow[]): ReportSummary {
    const autoCharged = subscriptions.filter((s) => s.isAutoCharged);
    const overdue = autoCharged.filter((s) => s.isOverdue);
    const isPaid = (row: PaymentRow) => Number(row.Pagado) === 1;
    const paid = paymentRows.filter(isPaid).map(toPayment);
    const monthRows = paymentRows.filter((row) => row.FechaPago.startsWith(now.slice(0, 7)));
    const paidThisMonth = monthRows.filter(isPaid).map(toPayment);
    const failedThisMonth = monthRows.filter((row) => !isPaid(row));

    return {
        autoChargedCount: autoCharged.length,
        monthlyRecurring: sumAmounts(autoCharged),
        overdueCount: overdue.length,
        overdueMonthly: sumAmounts(overdue),
        paidThisMonth: sumAmounts(paidThisMonth),
        paidThisMonthCount: paidThisMonth.length,
        failedThisMonthCount: failedThisMonth.length,
        failedThisMonthMembers: new Set(failedThisMonth.map(memberKey)).size,
        paidInWindow: sumAmounts(paid),
        paidInWindowCount: paid.length,
    };
}

export function buildRecurringReport(input: {
    projectName: string;
    now: string;
    subscriptionRows: SubscriptionRow[];
    paymentRows: PaymentRow[];
}): RecurringReport {
    const { projectName, now, subscriptionRows, paymentRows } = input;
    const paymentsByMember = groupByMember(paymentRows);
    const subscriptions = subscriptionRows.map((row) =>
        toSubscription(row, paymentsByMember.get(memberKey(row)) ?? [])
    );

    const subscribedKeys = new Set(subscriptionRows.map(memberKey));
    const orphans = [...paymentsByMember.entries()]
        .filter(([key]) => !subscribedKeys.has(key))
        .map(([key, rows]) => toOrphan(key, rows));

    const autoCharged = subscriptions.filter((s) => s.isAutoCharged);

    return {
        projectName,
        generatedAt: now,
        currentMonth: now.slice(0, 7),
        summary: summarize(now, subscriptions, paymentRows),
        overdue: autoCharged.filter((s) => s.isOverdue).sort((a, b) => b.daysOverdue - a.daysOverdue),
        upToDate: autoCharged
            .filter((s) => !s.isOverdue)
            .sort((a, b) => (a.nextChargeAt ?? '9999').localeCompare(b.nextChargeAt ?? '9999')),
        withoutAutoCharge: subscriptions.filter((s) => !s.isAutoCharged),
        orphans,
    };
}

async function selectRows<T>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await pool.query(sql, params);
    return rows as unknown as T[];
}

async function findProject(uuid: string): Promise<ProjectMetadata | null> {
    const rows = await query(
        'SELECT IdProyecto, Proyecto, BaseDatos, Servidor, UsuarioBD, PasswordBD FROM tblProyectos WHERE UUID = ? LIMIT 1',
        [uuid]
    ) as ProjectMetadata[];
    return rows[0] ?? null;
}

function isMissingTable(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_NO_SUCH_TABLE';
}

// cache(): generateMetadata y la página piden el mismo reporte dentro de un mismo request.
export const getRecurringReport = cache(async (projectUuid: string): Promise<RecurringReportResult> => {
    const project = await findProject(projectUuid);
    if (!project) return { kind: 'not-found' };

    // Pool directo del proyecto: la página es pública y no debe depender de la cookie de
    // sesión (con ProyectosIntegrados, projectQuery mezclaría los pagos de todos los gimnasios).
    const pool = await getProjectConnectionPoolRaw(project.IdProyecto, project);
    try {
        const [nowRows, subscriptionRows, paymentRows] = await Promise.all([
            selectRows<{ now: string }>(pool, NOW_SQL),
            selectRows<SubscriptionRow>(pool, SUBSCRIPTIONS_SQL),
            selectRows<PaymentRow>(pool, PAYMENTS_SQL, [PAYMENT_WINDOW_MONTHS]),
        ]);
        return {
            kind: 'ok',
            report: buildRecurringReport({
                projectName: project.Proyecto,
                now: nowRows[0].now,
                subscriptionRows,
                paymentRows,
            }),
        };
    } catch (error) {
        if (isMissingTable(error)) return { kind: 'not-configured', projectName: project.Proyecto };
        throw error;
    }
});
