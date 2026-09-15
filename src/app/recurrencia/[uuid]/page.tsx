import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    getRecurringReport,
    isValidUuid,
    PAYMENT_WINDOW_MONTHS,
    type RecurringReport,
    type RecurringReportResult,
    type Subscription,
} from '@/lib/recurring-payments';
import { OrphanItem, SubscriptionItem } from './ReportItems';
import { formatDateTime, formatMoney, formatMonthName, plural } from './format';
import styles from './recurrencia.module.css';

/**
 * GET /recurrencia/<uuid del proyecto>
 *
 * Reporte público de cobros recurrentes con Stripe. Sin login: el UUID del proyecto
 * (tblProyectos.UUID) es la llave, igual que ticket-web y las páginas de pago.
 */
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ uuid: string }> };

const DEFAULT_TITLE = 'Pagos recurrentes';
const EYEBROW = 'Pagos recurrentes con tarjeta';
const ROBOTS = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { uuid } = await params;
    if (!isValidUuid(uuid)) return { title: DEFAULT_TITLE, robots: ROBOTS };
    try {
        const result = await getRecurringReport(uuid);
        if (result.kind === 'ok') return { title: result.report.projectName, robots: ROBOTS };
        if (result.kind === 'not-configured') return { title: result.projectName, robots: ROBOTS };
    } catch {
        // La página registra y muestra el error; el título se queda genérico.
    }
    return { title: DEFAULT_TITLE, robots: ROBOTS };
}

export default async function RecurringPaymentsPage({ params }: PageProps) {
    const { uuid } = await params;
    if (!isValidUuid(uuid)) notFound();

    let result: RecurringReportResult;
    try {
        result = await getRecurringReport(uuid);
    } catch (error) {
        console.error('[recurrencia] error al generar el reporte:', error);
        return <Notice title="No se pudo cargar el reporte" text="Hubo un problema al consultar los pagos. Intenta de nuevo en unos minutos." />;
    }

    if (result.kind === 'not-found') notFound();
    if (result.kind === 'not-configured') {
        return <Notice title={result.projectName} text="Este proyecto no tiene cobros recurrentes con tarjeta configurados." />;
    }
    return <Report report={result.report} />;
}

function Report({ report }: { report: RecurringReport }) {
    const { projectName, generatedAt, currentMonth, summary, overdue, upToDate, withoutAutoCharge, orphans } = report;
    const month = formatMonthName(currentMonth);

    return (
        <main className={styles.page}>
            <div className={styles.wrap}>
                <header>
                    <p className={styles.eyebrow}>{EYEBROW}</p>
                    <h1 className={styles.title}>{projectName}</h1>
                    <p className={styles.meta}>
                        Corte al {formatDateTime(generatedAt)} · {formatMoney(summary.paidInWindow)} cobrados en los
                        últimos {PAYMENT_WINDOW_MONTHS} meses ({plural(summary.paidInWindowCount, 'cobro', 'cobros')})
                    </p>
                </header>

                <section className={styles.kpis} aria-label="Resumen">
                    <Kpi
                        label="Suscripciones con cargo automático"
                        value={String(summary.autoChargedCount)}
                        note={`${formatMoney(summary.monthlyRecurring)} al mes`}
                    />
                    <Kpi
                        label={`Cobrado en ${month}`}
                        value={formatMoney(summary.paidThisMonth)}
                        note={plural(summary.paidThisMonthCount, 'cobro', 'cobros')}
                        toneClass={styles.kpiOk}
                    />
                    <Kpi
                        label={`Rechazos en ${month}`}
                        value={String(summary.failedThisMonthCount)}
                        note={plural(summary.failedThisMonthMembers, 'socio', 'socios')}
                        toneClass={summary.failedThisMonthCount > 0 ? styles.kpiBad : undefined}
                    />
                    <Kpi
                        label="Con cobro atrasado"
                        value={String(summary.overdueCount)}
                        note={`${formatMoney(summary.overdueMonthly)} al mes sin cobrar`}
                        toneClass={summary.overdueCount > 0 ? styles.kpiWarn : undefined}
                    />
                </section>

                <SubscriptionSection
                    title="Con cobro atrasado"
                    hint="La fecha de cobro ya pasó y el cargo no ha entrado; el cobro automático lo reintenta en cada corrida."
                    subscriptions={overdue}
                />
                <SubscriptionSection title="Al corriente" subscriptions={upToDate} showWhenEmpty />
                <SubscriptionSection
                    title="Sin cobro automático"
                    hint="Suscripciones que el cobro automático ya no intenta cobrar."
                    subscriptions={withoutAutoCharge}
                />
                {orphans.length > 0 && (
                    <Section
                        title="Pagos sin suscripción actual"
                        count={orphans.length}
                        hint="Intentos de cobro de socios cuya suscripción ya no existe."
                    >
                        {orphans.map((group) => <OrphanItem key={group.key} group={group} />)}
                    </Section>
                )}

                <footer className={styles.footer}>Integra Members · Horas del servidor del gimnasio</footer>
            </div>
        </main>
    );
}

function Kpi({ label, value, note, toneClass }: { label: string; value: string; note: string; toneClass?: string }) {
    return (
        <div className={toneClass ? `${styles.kpi} ${toneClass}` : styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
            <div className={styles.kpiNote}>{note}</div>
        </div>
    );
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
    return (
        <section className={styles.section}>
            <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{title}</h2>
                <span className={styles.sectionCount}>{count}</span>
            </div>
            {hint && <p className={styles.sectionHint}>{hint}</p>}
            <div className={styles.list}>{children}</div>
        </section>
    );
}

function SubscriptionSection({ title, hint, subscriptions, showWhenEmpty = false }: {
    title: string;
    hint?: string;
    subscriptions: Subscription[];
    showWhenEmpty?: boolean;
}) {
    if (subscriptions.length === 0 && !showWhenEmpty) return null;
    return (
        <Section title={title} count={subscriptions.length} hint={hint}>
            {subscriptions.length === 0
                ? <p className={styles.sectionHint}>No hay suscripciones en este grupo.</p>
                : subscriptions.map((subscription) => <SubscriptionItem key={subscription.id} subscription={subscription} />)}
        </Section>
    );
}

function Notice({ title, text }: { title: string; text: string }) {
    return (
        <main className={styles.page}>
            <div className={styles.notice}>
                <p className={styles.eyebrow}>{EYEBROW}</p>
                <h1 className={styles.noticeTitle}>{title}</h1>
                <p className={styles.meta}>{text}</p>
            </div>
        </main>
    );
}
