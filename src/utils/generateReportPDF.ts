import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta un reporte del Agente Integra Gym (el que se abre en /wa-report) a PDF:
 * encabezado con branding, la respuesta, las GRÁFICAS (dibujadas nativamente con
 * jsPDF a partir de los datos — determinista, sin capturar el SVG) y las TABLAS
 * (jspdf-autotable, texto seleccionable).
 */

type RGB = [number, number, number];
const BRAND: RGB = [37, 99, 235];   // #2563eb
const DARK:  RGB = [15, 23, 42];    // slate-900
const GRAY:  RGB = [100, 116, 139]; // slate-500
const LIGHT: RGB = [241, 245, 249]; // slate-100
const GRID:  RGB = [226, 232, 240]; // slate-200
const SERIES2: RGB = [148, 163, 184]; // slate-400

const PALETTE: RGB[] = [
    [59, 130, 246], [6, 182, 212], [34, 197, 94], [168, 85, 247], [245, 158, 11], [236, 72, 153],
    [20, 184, 166], [100, 116, 139], [234, 179, 8], [14, 165, 233], [132, 204, 22], [239, 68, 68],
];

export interface ReportPdfChart {
    type: 'bar' | 'line' | 'pie';
    title?: string;
    data: { name: string; value: number; value2?: number }[];
    format?: 'currency' | 'number' | 'percent';
    seriesLabels?: string[];
}
export interface ReportPdfTable { title?: string; columns: string[]; rows: any[][]; }
export interface ReportPdfData {
    title?: string | null;
    gymName?: string;
    fecha?: string;
    question?: string;
    answer?: string;
    charts: ReportPdfChart[];
    tables: ReportPdfTable[];
}

function cleanText(s: string): string {
    return String(s || '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s+\n/g, '\n')
        .trim();
}
function fmtVal(v: number, format?: string): string {
    if (typeof v !== 'number' || !isFinite(v)) return String(v ?? '');
    if (format === 'currency') return '$' + v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    if (format === 'percent') return v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%';
    return v.toLocaleString('es-MX');
}
function fmtCompact(v: number, format?: string): string {
    if (typeof v !== 'number' || !isFinite(v)) return String(v ?? '');
    const abs = Math.abs(v);
    let s: string;
    if (abs >= 1e6) s = (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (abs >= 1e3) s = (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    else s = String(Math.round(v));
    if (format === 'currency') return '$' + s;
    if (format === 'percent') return s + '%';
    return s;
}
function fmtCell(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && isFinite(v)) return v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    return cleanText(String(v));
}
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ── Dibujo nativo de gráficas ───────────────────────────────────────────────
function drawBarOrLine(doc: jsPDF, spec: ReportPdfChart, x: number, y: number, w: number, h: number): number {
    const data = (spec.data || []).slice(0, 12);
    if (data.length === 0) return y;
    const hasV2 = data.some(d => typeof d.value2 === 'number');
    const padL = 48, padB = 26, padT = 10;
    const plotX = x + padL, plotW = w - padL - 8;
    const plotY = y + padT, plotH = h - padT - padB, plotB = plotY + plotH;

    let maxV = 0;
    for (const d of data) maxV = Math.max(maxV, Number(d.value) || 0, hasV2 ? Number(d.value2) || 0 : 0);
    if (maxV <= 0) maxV = 1;

    // Gridlines + etiquetas Y
    doc.setDrawColor(...GRID); doc.setLineWidth(0.5);
    doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    for (let g = 0; g <= 4; g++) {
        const gy = plotB - plotH * g / 4;
        doc.line(plotX, gy, plotX + plotW, gy);
        doc.text(fmtCompact(maxV * g / 4, spec.format), plotX - 4, gy + 2.4, { align: 'right' });
    }

    const groups = data.length;
    const gw = plotW / groups;

    if (spec.type === 'line') {
        const pts1: [number, number][] = [];
        const pts2: [number, number][] = [];
        data.forEach((d, i) => {
            const cx = plotX + gw * i + gw / 2;
            pts1.push([cx, plotB - plotH * ((Number(d.value) || 0) / maxV)]);
            if (hasV2) pts2.push([cx, plotB - plotH * ((Number(d.value2) || 0) / maxV)]);
        });
        const poly = (pts: [number, number][], col: RGB) => {
            doc.setDrawColor(...col); doc.setLineWidth(1.6);
            for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
            doc.setFillColor(...col);
            for (const p of pts) doc.circle(p[0], p[1], 1.6, 'F');
        };
        poly(pts1, PALETTE[0]);
        if (hasV2) poly(pts2, PALETTE[2]);
    } else {
        const barW = hasV2 ? Math.min(gw * 0.3, 26) : Math.min(gw * 0.55, 40);
        data.forEach((d, i) => {
            const cx = plotX + gw * i + gw / 2;
            const v1 = Number(d.value) || 0, bh1 = plotH * (v1 / maxV);
            if (hasV2) {
                const v2 = Number(d.value2) || 0, bh2 = plotH * (v2 / maxV);
                doc.setFillColor(...PALETTE[0]); doc.rect(cx - barW - 1, plotB - bh1, barW, bh1, 'F');
                doc.setFillColor(...SERIES2); doc.rect(cx + 1, plotB - bh2, barW, bh2, 'F');
            } else {
                doc.setFillColor(...PALETTE[0]); doc.rect(cx - barW / 2, plotB - bh1, barW, bh1, 'F');
                doc.setFontSize(7); doc.setTextColor(...DARK);
                doc.text(fmtCompact(v1, spec.format), cx, plotB - bh1 - 3, { align: 'center' });
            }
        });
    }

    // Etiquetas X
    doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    data.forEach((d, i) => {
        const cx = plotX + gw * i + gw / 2;
        doc.text(short(String(d.name), groups > 7 ? 7 : 11), cx, plotB + 10, { align: 'center' });
    });

    let endY = plotB + padB;
    if (hasV2 && spec.seriesLabels) {
        doc.setFontSize(8);
        const l1 = spec.seriesLabels[0] || 'Serie 1', l2 = spec.seriesLabels[1] || 'Serie 2';
        const c2: RGB = spec.type === 'line' ? PALETTE[2] : SERIES2;
        doc.setFillColor(...PALETTE[0]); doc.rect(plotX, endY, 8, 8, 'F');
        doc.setTextColor(...DARK); doc.text(l1, plotX + 12, endY + 7);
        const off = plotX + 12 + doc.getTextWidth(l1) + 16;
        doc.setFillColor(...c2); doc.rect(off, endY, 8, 8, 'F');
        doc.text(l2, off + 12, endY + 7);
        endY += 16;
    }
    return endY;
}

function drawPie(doc: jsPDF, spec: ReportPdfChart, x: number, y: number, w: number, h: number): number {
    const data = (spec.data || []).filter(d => Number(d.value) > 0).slice(0, 12);
    if (data.length === 0) return y;
    const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
    const r = Math.min(h / 2 - 8, 78);
    const cx = x + r + 8, cy = y + h / 2;

    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
        const a1 = a0 + (Number(d.value) / total) * Math.PI * 2;
        const col = PALETTE[i % PALETTE.length];
        doc.setFillColor(...col);
        const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 36)));
        for (let s = 0; s < steps; s++) {
            const t0 = a0 + (a1 - a0) * s / steps, t1 = a0 + (a1 - a0) * (s + 1) / steps;
            doc.triangle(cx, cy, cx + r * Math.cos(t0), cy + r * Math.sin(t0), cx + r * Math.cos(t1), cy + r * Math.sin(t1), 'F');
        }
        a0 = a1;
    });

    // Leyenda a la derecha
    const lx = cx + r + 22;
    let ly = y + 12;
    doc.setFontSize(9);
    data.forEach((d, i) => {
        const col = PALETTE[i % PALETTE.length];
        doc.setFillColor(...col); doc.rect(lx, ly - 7, 9, 9, 'F');
        doc.setTextColor(...DARK);
        const pct = (Number(d.value) / total * 100).toFixed(1);
        const label = `${short(String(d.name), 22)}: ${fmtVal(Number(d.value), spec.format)} (${pct}%)`;
        doc.text(label, lx + 14, ly);
        ly += 16;
    });
    return Math.max(y + h, ly);
}

export function generateReportPDF(data: ReportPdfData): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentW = pageW - margin * 2;
    const bottom = pageH - 56;

    let y = 0;
    const ensure = (need: number) => { if (y + need > bottom) { doc.addPage(); y = margin + 8; } };

    // Header band
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 64, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('Integra Gym', margin, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('Reporte del agente del gimnasio', margin, 47);
    const dateStr = data.fecha
        ? new Date(data.fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
        : new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    doc.text(dateStr, pageW - margin, 30, { align: 'right' });
    if (data.gymName) doc.text(cleanText(data.gymName), pageW - margin, 47, { align: 'right' });

    y = 64 + 28;

    if (data.title) {
        doc.setTextColor(...BRAND); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
        const tLines = doc.splitTextToSize(cleanText(data.title), contentW) as string[];
        ensure(tLines.length * 17); doc.text(tLines, margin, y); y += tLines.length * 17 + 4;
    }
    if (data.question) {
        doc.setTextColor(...GRAY); doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5);
        const qLines = doc.splitTextToSize(`“${cleanText(data.question)}”`, contentW) as string[];
        ensure(qLines.length * 14 + 8); doc.text(qLines, margin, y); y += qLines.length * 14 + 10;
    }
    if (data.answer) {
        const answer = cleanText(data.answer).replace(/Ver gráfica y detalle:.*$/gim, '').trim();
        if (answer) {
            doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
            const aLines = doc.splitTextToSize(answer, contentW) as string[];
            for (const line of aLines) { ensure(14); doc.text(line, margin, y); y += 14; }
            y += 10;
        }
    }

    // Gráficas (dibujadas nativamente)
    for (const ch of data.charts || []) {
        if (!ch || !Array.isArray(ch.data) || ch.data.length === 0) continue;
        const chartH = ch.type === 'pie' ? 170 : 200;
        ensure((ch.title ? 18 : 0) + chartH + 14);
        if (ch.title) {
            doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
            doc.text(cleanText(ch.title), margin, y); y += 16;
        }
        doc.setFont('helvetica', 'normal');
        const endY = ch.type === 'pie'
            ? drawPie(doc, ch, margin, y, contentW, chartH)
            : drawBarOrLine(doc, ch, margin, y, contentW, chartH);
        y = endY + 14;
    }

    // Tablas
    for (const t of data.tables || []) {
        if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows)) continue;
        if (t.title) {
            ensure(18);
            doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
            doc.text(cleanText(t.title), margin, y); y += 14;
        }
        autoTable(doc, {
            head: [t.columns.map(c => cleanText(String(c)))],
            body: t.rows.map(r => r.map(fmtCell)),
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: GRID, lineWidth: 0.5 },
            headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: LIGHT },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text('Integra Gym · Puede cometer errores, verifica cifras importantes', margin, pageH - 28);
        doc.text(`${p} / ${pages}`, pageW - margin, pageH - 28, { align: 'right' });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`integra-gym-reporte-${stamp}.pdf`);
}
