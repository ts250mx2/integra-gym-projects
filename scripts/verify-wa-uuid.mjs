#!/usr/bin/env node
/**
 * Verifica que el endpoint de WhatsApp (/api/whatsapp/ask) devuelva SOLO links de
 * reporte con UUID y que el TEXTO no traiga links inventados (slugs tipo weekly-...).
 *
 * Uso (tras redeployar):
 *   WHATSAPP_API_KEY=tu_key node scripts/verify-wa-uuid.mjs https://www.integramembers.com
 *   WHATSAPP_API_KEY=tu_key node scripts/verify-wa-uuid.mjs https://www.integramembers.com 5218186921848 "ventas de la semana del 16 al 22 de junio por sucursal"
 *
 * NOTA: genera un reporte real (hace una consulta de IA y guarda una fila). Es solo lectura de negocio.
 */

const baseUrl = (process.argv[2] || process.env.APP_PUBLIC_URL || 'http://localhost:3010').replace(/\/$/, '');
const phone = process.argv[3] || '5218186921848';
const question = process.argv[4] || 'ventas de la semana del 16 al 22 de junio por sucursal';
const apiKey = process.env.WHATSAPP_API_KEY;

if (!apiKey) {
    console.error('Falta WHATSAPP_API_KEY en el entorno.');
    process.exit(2);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_RE = /wa-report\?r=([^\s)]+)/gi;

console.log(`POST ${baseUrl}/api/whatsapp/ask  (from=${phone})`);
console.log(`Pregunta: "${question}"\n`);

const res = await fetch(`${baseUrl}/api/whatsapp/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ question, from_phone: phone }),
});

if (!res.ok) {
    console.error('HTTP', res.status, await res.text());
    process.exit(1);
}

const data = await res.json();
const answer = data.answer || '';
const reportUrl = data.reportUrl || '';

console.log('--- answer ---');
console.log(answer);
console.log('\nreportUrl:', reportUrl || '(ninguno)');

let ok = true;

// 1) El TEXTO (answer) NO debe contener ningún link de wa-report (el guard los quita).
const inAnswer = [...answer.matchAll(LINK_RE)].map(m => m[1]);
if (inAnswer.length) { ok = false; console.log('\nFAIL: el texto contiene links de reporte (no debería):', inAnswer); }

// 2) Si hay reportUrl, su id debe ser UUID.
if (reportUrl) {
    const id = (reportUrl.match(/r=([^\s&)]+)/) || [])[1] || '';
    if (!UUID_RE.test(id)) { ok = false; console.log('FAIL: reportUrl no es UUID:', id); }
}

// 3) Cualquier id encontrado (texto o reportUrl) que NO sea UUID es un slug inventado.
const allIds = [...`${answer}\n${reportUrl}`.matchAll(LINK_RE)].map(m => m[1]);
const slugs = allIds.filter(id => !UUID_RE.test(id));
if (slugs.length) { ok = false; console.log('FAIL: ids no-UUID (slugs inventados):', slugs); }

console.log(ok
    ? '\nPASS: solo links UUID y sin links en el texto. ✔'
    : '\nFALLO: revisa lo anterior.');
process.exit(ok ? 0 : 1);
