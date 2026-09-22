import { NextRequest, NextResponse } from 'next/server';
import { getSession, resolveBranchId } from '@/lib/inventory';
import { applyImport, describeDbError, getBranch, getMemberColumns, loadBranchMembers } from '@/lib/members-import';
import { MAX_FILE_BYTES, MAX_ROWS, buildImportPlan, parseTemplate } from '@/lib/members-template';

/**
 * POST /api/members/import  (multipart: file, branchId, mode)
 *
 * mode = 'preview' revisa el archivo y dice que haria con cada renglon.
 * mode = 'apply'   aplica el plan en una transaccion: actualiza los renglones con
 *                  IdSocio y da de alta los que vienen sin el.
 */
const PREVIEW_ROWS = 300;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const form = await req.formData();
        const file = form.get('file');
        const mode = String(form.get('mode') || 'preview') === 'apply' ? 'apply' : 'preview';

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Falta el archivo de la plantilla' }, { status: 400 });
        }
        const name = file.name.toLowerCase();
        if (!ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
            return NextResponse.json({ error: 'El archivo debe ser .xlsx o .csv' }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ error: 'El archivo pesa mas de 5 MB' }, { status: 413 });
        }

        const branchId = await resolveBranchId(session.projectId, Number(form.get('branchId')) || session.branchId);
        if (!branchId) {
            return NextResponse.json({ error: 'No hay sucursal para importar' }, { status: 400 });
        }

        const columns = await getMemberColumns(session.projectId);
        const branch = await getBranch(session.projectId, branchId, columns);
        if (!branch) {
            return NextResponse.json({ error: 'La sucursal no existe en este gimnasio' }, { status: 404 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const { rows, missing, truncated } = parseTemplate(buffer);

        if (missing.length > 0) {
            return NextResponse.json(
                { error: `Al archivo le faltan columnas de la plantilla: ${missing.join(', ')}` },
                { status: 400 }
            );
        }
        if (rows.length === 0) {
            return NextResponse.json({ error: 'El archivo no trae ningun socio' }, { status: 400 });
        }

        const existing = await loadBranchMembers(session.projectId, branchId, columns);
        const plan = buildImportPlan(rows, existing);

        const summary = {
            total: plan.rows.length,
            updates: plan.updates,
            creates: plan.creates,
            skipped: plan.skipped,
            errors: plan.errors
        };
        const context = {
            branchId,
            branchName: branch.Sucursal,
            schema: columns.isLegacy ? 'anterior' : 'nuevo',
            truncated,
            maxRows: MAX_ROWS
        };

        if (mode === 'preview') {
            return NextResponse.json({
                mode,
                ...context,
                summary,
                rows: plan.rows.slice(0, PREVIEW_ROWS),
                moreRows: Math.max(plan.rows.length - PREVIEW_ROWS, 0)
            });
        }

        const result = await applyImport(session.projectId, branchId, branch.Prefijo || '', columns, plan);

        return NextResponse.json({
            mode,
            ...context,
            summary,
            result,
            // Solo regresan los renglones que NO se aplicaron, para corregirlos.
            rows: plan.rows.filter((row) => row.action === 'error' || row.action === 'skip').slice(0, PREVIEW_ROWS)
        });
    } catch (error) {
        console.error('[members/import] error:', error);
        return NextResponse.json(
            { error: 'No se pudo importar el archivo', detail: describeDbError(error) },
            { status: 500 }
        );
    }
}
