/**
 * Helper mínimo para Server-Sent Events (SSE) en route handlers de Next.js.
 *
 * Cada evento se serializa como `data: <json>\n\n`, donde el JSON lleva un campo
 * `type` que el cliente usa para despachar. El handler recibe una función `emit`
 * y, al terminar (o lanzar), el stream se cierra automáticamente.
 */

export const SSE_HEADERS: Record<string, string> = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Evita que proxies (nginx) o el dev server bufferen el stream.
    'X-Accel-Buffering': 'no',
};

export type SseEvent = Record<string, any> & { type: string };

export function createSseStream(
    handler: (emit: (event: SseEvent) => void) => Promise<void>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            const emit = (event: SseEvent) => {
                if (closed) return;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            try {
                await handler(emit);
            } catch (err: any) {
                emit({ type: 'error', message: err?.message || 'Error en el stream' });
            } finally {
                closed = true;
                try { controller.close(); } catch { /* ya cerrado */ }
            }
        },
    });
}
