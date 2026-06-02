import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta una respuesta del Agente Integra Gym (texto Markdown) a un PDF con
 * texto seleccionable, tablas reales (jspdf-autotable) y branding. Pensado para
 * que el usuario guarde/comparta un análisis puntual del chat.
 *
 * Soporta del Markdown que produce el agente: encabezados (#..####), negritas
 * (**), listas (- * 1.), tablas GFM (| a | b |) y párrafos. Limpia emojis y
 * sintaxis inline que las fuentes estándar de jsPDF no saben dibujar.
 */

type RGB = [number, number, number];
const BRAND: RGB = [37, 99, 235];   // #2563eb azul Integra
const DARK:  RGB = [15, 23, 42];    // slate-900
const GRAY:  RGB = [100, 116, 139]; // slate-500
const LIGHT: RGB = [241, 245, 249]; // slate-100

export interface AnswerPdfMeta {
    question?: string;
    model?: string;
    branchName?: string;
}

// ── Limpieza inline (quita lo que la fuente no dibuja, conserva el texto) ──────
function inlineClean(s: string): string {
    return s
        .replace(/`([^`]*)`/g, '$1')                       // `code` → code
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')           // [txt](url) → txt
        .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '$1')  // *italic* → italic
        // emojis, dingbats, flechas, símbolos varios y selectores de variación
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s+\n/g, '\n')
        .trimEnd();
}

// Divide un texto con **negritas** en segmentos {text, bold}.
function tokenizeBold(raw: string): { text: string; bold: boolean }[] {
    return raw.split(/\*\*/).map((part, idx) => ({ text: inlineClean(part), bold: idx % 2 === 1 }));
}

// ── Tablas Markdown ───────────────────────────────────────────────────────────
function splitCells(line: string): string[] {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(c => inlineClean(c.replace(/\*\*/g, '')).trim());
}
const isTableRow = (l: string) => l.includes('|') && l.trim().length > 0;
const isTableSeparator = (l: string) =>
    /\|/.test(l) && splitCells(l).every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '');

export function generateAnswerPDF(answer: string, meta: AnswerPdfMeta = {}): void {
    const doc = buildAnswerPdfDoc(answer, meta);
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`integra-gym-analisis-${stamp}.pdf`);
}

/** Construye el documento PDF (sin guardarlo). Separado para poder testearlo. */
export function buildAnswerPdfDoc(answer: string, meta: AnswerPdfMeta = {}): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentW = pageW - margin * 2;
    const bottom = pageH - 56;

    const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = margin + 8; } };

    // Renderiza texto con **negritas** y wrapping; devuelve el baseline para la
    // SIGUIENTE línea. Maneja saltos de página dentro del wrapping.
    const renderRich = (
        raw: string, x: number, startY: number, maxW: number, lh: number, baseBold = false
    ): number => {
        const segs = tokenizeBold(raw);
        const spaceW = doc.getTextWidth(' ');
        let cx = x;
        let y2 = startY;
        let first = true;
        for (const seg of segs) {
            doc.setFont('helvetica', (seg.bold || baseBold) ? 'bold' : 'normal');
            const words = seg.text.split(/\s+/).filter(w => w.length > 0);
            for (const w of words) {
                const ww = doc.getTextWidth(w);
                if (!first && cx + spaceW + ww > x + maxW) {
                    cx = x; y2 += lh; first = true;
                    if (y2 > bottom) { doc.addPage(); y2 = margin + 8; }
                }
                if (!first) cx += spaceW;
                doc.text(w, cx, y2);
                cx += ww;
                first = false;
            }
        }
        return y2 + lh;
    };

    // ── Header band ──
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 64, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('Integra Gym', margin, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('Análisis del agente del gimnasio', margin, 47);
    const dateStr = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    doc.text(dateStr, pageW - margin, 30, { align: 'right' });
    if (meta.branchName) doc.text(meta.branchName, pageW - margin, 47, { align: 'right' });

    let y = 64 + 30;

    // ── Pregunta del usuario ──
    if (meta.question) {
        doc.setTextColor(...GRAY); doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5);
        const qLines = doc.splitTextToSize(`“${inlineClean(meta.question)}”`, contentW) as string[];
        ensure(qLines.length * 14 + 14);
        doc.text(qLines, margin, y); y += qLines.length * 14 + 8;
        doc.setDrawColor(226, 232, 240); doc.line(margin, y, pageW - margin, y); y += 20;
    }

    // ── Cuerpo: parseo de bloques Markdown ──
    const lines = answer.replace(/\r/g, '').split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Bloque cercado ``` … ``` (incluye ```chart → se vuelve tabla)
        const fence = line.match(/^```(\w*)/);
        if (fence) {
            const lang = fence[1];
            const buf: string[] = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].startsWith('```')) { buf.push(lines[j]); j++; }
            i = j + 1; // salta el cierre ```
            const inner = buf.join('\n').trim();

            if (lang === 'chart') {
                try {
                    const spec = JSON.parse(inner);
                    const fmt = (v: any) => typeof v === 'number'
                        ? (spec.format === 'currency' ? '$' + v.toLocaleString('es-MX', { maximumFractionDigits: 2 })
                            : spec.format === 'percent' ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%'
                            : v.toLocaleString('es-MX'))
                        : String(v ?? '');
                    const hasV2 = Array.isArray(spec.data) && spec.data.some((d: any) => typeof d.value2 === 'number');
                    const l1 = spec.seriesLabels?.[0] || 'Valor';
                    const l2 = spec.seriesLabels?.[1] || 'Comparación';
                    const head = hasV2 ? ['', l1, l2] : ['', l1];
                    const body = (spec.data || []).map((d: any) =>
                        hasV2 ? [String(d.name), fmt(d.value), fmt(d.value2)] : [String(d.name), fmt(d.value)]);
                    if (spec.title) {
                        ensure(20);
                        doc.setFontSize(11); doc.setTextColor(...DARK);
                        y = renderRich(spec.title, margin, y, contentW, 14, true) + 2;
                    }
                    autoTable(doc, {
                        head: [head], body, startY: y, margin: { left: margin, right: margin },
                        styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: [226, 232, 240], lineWidth: 0.5 },
                        headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
                        alternateRowStyles: { fillColor: LIGHT },
                    });
                    y = (doc as any).lastAutoTable.finalY + 16;
                } catch { /* JSON inválido → ignora el bloque */ }
            } else if (lang === 'nav') {
                try {
                    const items = JSON.parse(inner)?.items || [];
                    if (items.length) {
                        ensure(16);
                        doc.setFontSize(9.5); doc.setTextColor(...GRAY);
                        y = renderRich('Pantallas sugeridas:', margin, y, contentW, 13, true) + 1;
                        for (const it of items) {
                            const label = `•  ${it.label}${it.reason ? ` — ${it.reason}` : ''}`;
                            ensure(13);
                            y = renderRich(label, margin + 4, y, contentW - 4, 13) + 1;
                        }
                        y += 6;
                    }
                } catch { /* JSON inválido → ignora */ }
            } else if (inner) {
                ensure(14);
                doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK);
                const codeLines = doc.splitTextToSize(inner, contentW) as string[];
                for (const cl of codeLines) { ensure(12); doc.text(cl, margin, y); y += 12; }
                doc.setFont('helvetica', 'normal');
                y += 6;
            }
            continue;
        }

        // Tabla
        if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            const head = splitCells(line);
            const body: string[][] = [];
            let j = i + 2;
            while (j < lines.length && isTableRow(lines[j]) && !isTableSeparator(lines[j])) {
                body.push(splitCells(lines[j])); j++;
            }
            autoTable(doc, {
                head: [head], body,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8.5, cellPadding: 5, textColor: DARK, lineColor: [226, 232, 240], lineWidth: 0.5 },
                headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: LIGHT },
            });
            y = (doc as any).lastAutoTable.finalY + 16;
            i = j;
            continue;
        }

        // Línea en blanco
        if (line.trim() === '') { y += 6; i++; continue; }

        // Encabezado
        const h = line.match(/^(#{1,4})\s+(.*)/);
        if (h) {
            const level = h[1].length;
            const size = level <= 1 ? 14 : level === 2 ? 12.5 : 11.5;
            ensure(size + 12);
            doc.setFontSize(size); doc.setTextColor(...BRAND);
            y = renderRich(h[2], margin, y + size * 0.2, contentW, size + 5, true) + 4;
            i++;
            continue;
        }

        // Lista (viñeta o numerada)
        const bullet = line.match(/^\s*[-*]\s+(.*)/);
        const num = line.match(/^\s*(\d+)\.\s+(.*)/);
        if (bullet || num) {
            const marker = bullet ? '•' : `${num![1]}.`;
            const text = bullet ? bullet[1] : num![2];
            const indent = 18;
            ensure(16);
            doc.setFontSize(10.5); doc.setTextColor(...DARK);
            doc.setFont('helvetica', 'bold'); doc.text(marker, margin + 3, y);
            y = renderRich(text, margin + indent, y, contentW - indent, 14) + 3;
            i++;
            continue;
        }

        // Párrafo
        ensure(14);
        doc.setFontSize(10.5); doc.setTextColor(...DARK);
        y = renderRich(line, margin, y, contentW, 14) + 5;
        i++;
    }

    // ── Footer con paginación ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text('Integra Gym · Puede cometer errores, verifica cifras importantes', margin, pageH - 28);
        doc.text(`${p} / ${pages}`, pageW - margin, pageH - 28, { align: 'right' });
    }

    return doc;
}
