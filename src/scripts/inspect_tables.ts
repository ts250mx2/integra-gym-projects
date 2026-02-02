
import { projectQuery } from '../lib/projectDb';

async function inspect() {
    // Hardcoded project ID for inspection (usually 1 or derived if possible, but 1 is safe for testing)
    const projectId = 1;

    try {
        console.log('--- Inspecting tblCuotas ---');
        try {
            const cuotasCols = await projectQuery(projectId, 'DESCRIBE tblCuotas');
            console.log(JSON.stringify(cuotasCols, null, 2));
        } catch (e: any) { console.log('tblCuotas error:', e.message); }

        console.log('--- Inspecting tblDetalleVentas ---');
        try {
            const detalleCols = await projectQuery(projectId, 'DESCRIBE tblDetalleVentas');
            console.log(JSON.stringify(detalleCols, null, 2));
        } catch (e: any) { console.log('tblDetalleVentas error:', e.message); }

        console.log('--- Inspecting tblVentasDetalle ---');
        try {
            const ventasDetalleCols = await projectQuery(projectId, 'DESCRIBE tblVentasDetalle');
            console.log(JSON.stringify(ventasDetalleCols, null, 2));
        } catch (e: any) { console.log('tblVentasDetalle error:', e.message); }

    } catch (error) {
        console.error('Inspection failed:', error);
    }
    process.exit(0);
}

inspect();
