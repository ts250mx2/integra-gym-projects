import {
    PAYMENT_WINDOW_MONTHS,
    type OrphanPayments,
    type PaymentStats,
    type RecurringPayment,
    type Subscription,
} from '@/lib/recurring-payments';
import { formatDate, formatDateTime, formatMoney, plural } from './format';
import styles from './recurrencia.module.css';

function MemberHeading({ memberId, memberName, details }: { memberId: number; memberName: string | null; details: (string | null)[] }) {
    const subtitle = [`Socio ${memberId}`, ...details].filter(Boolean).join(' · ');
    return (
        <span className={styles.who}>
            <span className={styles.name}>{memberName ?? `Socio ${memberId} (no encontrado)`}</span>
            <span className={styles.sub}>{subtitle}</span>
        </span>
    );
}

function StatsLine({ stats }: { stats: PaymentStats }) {
    const { paidCount, paidTotal, failedCount, lastPaidAt, lastAttempt } = stats;
    const lastFailed = lastAttempt && !lastAttempt.isPaid ? lastAttempt : null;
    return (
        <>
            <span className={styles.stats}>
                <span className={paidCount > 0 ? styles.statOk : undefined}>
                    {plural(paidCount, 'cobro', 'cobros')} · {formatMoney(paidTotal)}
                </span>
                {failedCount > 0 && <span className={styles.statBad}>{plural(failedCount, 'rechazo', 'rechazos')}</span>}
                <span>{lastPaidAt ? `Último cobro ${formatDate(lastPaidAt)}` : 'Sin cobros exitosos'}</span>
                <span className={styles.toggle} aria-hidden="true" />
            </span>
            {lastFailed && (
                <span className={styles.lastError} title={lastFailed.message}>
                    Último intento {formatDateTime(lastFailed.date)}: {lastFailed.message || 'rechazado'}
                </span>
            )}
        </>
    );
}

function ChargeBadge({ subscription }: { subscription: Subscription }) {
    const { isAutoCharged, isOverdue, daysOverdue, nextChargeAt, status } = subscription;
    if (!isAutoCharged) {
        return <span className={styles.badgeMuted}>Sin cobro automático · status {status}</span>;
    }
    if (isOverdue) {
        const days = daysOverdue > 0 ? ` · ${plural(daysOverdue, 'día', 'días')}` : '';
        return <span className={styles.badgeWarn}>Atrasado desde {formatDate(nextChargeAt)}{days}</span>;
    }
    return <span className={styles.badgeOk}>Próximo cobro {formatDate(nextChargeAt)}</span>;
}

function MovementCell({ payment }: { payment: RecurringPayment }) {
    if (!payment.isPaid) return <span className={styles.dim}>—</span>;
    if (payment.movementId > 0) return <>Mov. {payment.movementId}</>;
    return (
        <span className={styles.badgeWarn} title="Cobrado en Stripe, pero sin movimiento registrado en caja">
            Sin movimiento
        </span>
    );
}

function PaymentLine({ payment }: { payment: RecurringPayment }) {
    const { date, amount, isPaid, paymentIntent, message, fee } = payment;
    const detail = isPaid ? fee : message || 'Stripe no devolvió detalle';
    return (
        <tr>
            <td className={styles.nowrap}>{formatDateTime(date)}</td>
            <td className={styles.num}>{formatMoney(amount)}</td>
            <td>
                <span className={isPaid ? styles.badgeOk : styles.badgeBad}>{isPaid ? 'Cobrado' : 'Rechazado'}</span>
            </td>
            <td className={styles.nowrap}><MovementCell payment={payment} /></td>
            <td className={styles.detailCell}>
                {detail && <span className={styles.message} title={detail}>{detail}</span>}
                {paymentIntent && <span className={styles.intent}>{paymentIntent}</span>}
            </td>
        </tr>
    );
}

function PaymentsTable({ payments }: { payments: RecurringPayment[] }) {
    if (payments.length === 0) {
        return <p className={styles.empty}>Sin intentos de cobro en los últimos {PAYMENT_WINDOW_MONTHS} meses.</p>;
    }
    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th className={styles.num}>Monto</th>
                        <th>Resultado</th>
                        <th>Caja</th>
                        <th>Detalle</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map((payment) => <PaymentLine key={payment.id} payment={payment} />)}
                </tbody>
            </table>
        </div>
    );
}

export function SubscriptionItem({ subscription }: { subscription: Subscription }) {
    const { memberId, memberName, branch, fee, amount, isAutoCharged, isOverdue, payments, stats } = subscription;
    const className = isAutoCharged && isOverdue ? `${styles.item} ${styles.itemOverdue}` : styles.item;
    return (
        <details className={className}>
            <summary className={styles.summary}>
                <MemberHeading memberId={memberId} memberName={memberName} details={[branch, fee]} />
                <span className={styles.right}>
                    <span className={styles.amount}>
                        {formatMoney(amount)}<span className={styles.per}> /mes</span>
                    </span>
                    <ChargeBadge subscription={subscription} />
                </span>
                <StatsLine stats={stats} />
            </summary>
            <PaymentsTable payments={payments} />
        </details>
    );
}

export function OrphanItem({ group }: { group: OrphanPayments }) {
    const { memberId, memberName, branch, payments, stats } = group;
    return (
        <details className={styles.item}>
            <summary className={styles.summary}>
                <MemberHeading memberId={memberId} memberName={memberName} details={[branch]} />
                <span className={styles.right}>
                    <span className={styles.badgeMuted}>Sin suscripción actual</span>
                </span>
                <StatsLine stats={stats} />
            </summary>
            <PaymentsTable payments={payments} />
        </details>
    );
}
