import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta un reporte del Agente Integra Gym (el que se abre en /wa-report) a PDF:
 * encabezado con branding, la respuesta, las GRÁFICAS (como imagen capturada del
 * SVG) y las TABLAS (jspdf-autotable, texto seleccionable). Pensado para que el
 * usuario guarde/comparta el detalle que recibió por WhatsApp.
 */

type RGB = [number, number, number];
const BRAND: RGB = [37, 99, 235];   // #2563eb azul Integra
const DARK:  RGB = [15, 23, 42];    // slate-900
const GRAY:  RGB = [100, 116, 139]; // slate-500
const LIGHT: RGB = [241, 245, 249]; // slate-100

export interface ReportPdfTable { title?: string; columns: string[]; rows: any[][]; }
export interface ReportPdfChartImage { title?: string; dataUrl: string; w: number; h: number; }
export interface ReportPdfData {
    title?: string | null;
    gymName?: string;
    fecha?: string;
    question?: string;
    answer?: string;
    tables: ReportPdfTable[];
}

// Quita emojis/símbolos que las fuentes estándar de jsPDF no dibujan.
function cleanText(s: string): string {
    return String(s || '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s+\n/g, '\n')
        .trim();
}

function fmtCell(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && isFinite(v)) return v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    return cleanText(String(v));
}

export function generateReportPDF(data: ReportPdfData, chartImages: ReportPdfChartImage[] = []): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentW = pageW - margin * 2;
    const bottom = pageH - 56;

    const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = margin + 8; } };

    // ── Header band ──
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

    let y = 64 + 28;

    // ── Título del reporte ──
    if (data.title) {
        doc.setTextColor(...BRAND); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
        const tLines = doc.splitTextToSize(cleanText(data.title), contentW) as string[];
        ensure(tLines.length * 17);
        doc.text(tLines, margin, y); y += tLines.length * 17 + 4;
    }

    // ── Pregunta ──
    if (data.question) {
        doc.setTextColor(...GRAY); doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5);
        const qLines = doc.splitTextToSize(`“${cleanText(data.question)}”`, contentW) as string[];
        ensure(qLines.length * 14 + 8);
        doc.text(qLines, margin, y); y += qLines.length * 14 + 10;
    }

    // ── Respuesta ──
    if (data.answer) {
        const answer = cleanText(data.answer).replace(/📊?\s*Ver gráfica y detalle:.*$/gim, '').trim();
        if (answer) {
            doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
            const aLines = doc.splitTextToSize(answer, contentW) as string[];
            for (const line of aLines) { ensure(14); doc.text(line, margin, y); y += 14; }
            y += 8;
        }
    }

    // ── Gráficas (imagen capturada del SVG) ──
    for (const ch of chartImages) {
        if (!ch?.dataUrl || !ch.w || !ch.h) continue;
        const imgW = contentW;
        const imgH = Math.min(320, contentW * (ch.h / ch.w));
        if (ch.title) {
            ensure(18);
            doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
            doc.text(cleanText(ch.title), margin, y); y += 16;
        }
        ensure(imgH + 12);
        try { doc.addImage(ch.dataUrl, 'PNG', margin, y, imgW, imgH); } catch { /* imagen inválida */ }
        y += imgH + 16;
    }

    // ── Tablas ──
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
            styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: [226, 232, 240], lineWidth: 0.5 },
            headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: LIGHT },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
    }

    // ── Footer ──
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
