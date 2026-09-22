import { NextRequest, NextResponse } from 'next/server';
import { getSession, resolveBranchId } from '@/lib/inventory';
import { describeDbError, getBranch, getMemberColumns } from '@/lib/members-import';
import { buildTemplateWorkbook } from '@/lib/members-template';

/**
 * GET /api/members/template?branchId=1
 *
 * Descarga la plantilla vacia de socios (.xlsx) con los encabezados que espera
 * el importador, mas una hoja de instrucciones.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const branchId = await resolveBranchId(session.projectId, Number(searchParams.get('branchId')) || session.branchId);

        const columns = await getMemberColumns(session.projectId);
        const branch = await getBranch(session.projectId, branchId, columns);

        const workbook = buildTemplateWorkbook(branch?.Sucursal || '', columns.isLegacy);

        return new NextResponse(new Uint8Array(workbook), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="plantilla-socios.xlsx"',
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        console.error('[members/template] error:', error);
        return NextResponse.json(
            { error: 'No se pudo generar la plantilla', detail: describeDbError(error) },
            { status: 500 }
        );
    }
}
