
import { projectQuery } from '../lib/projectDb';

async function inspect() {
    const projectId = 1;
    try {
        console.log('--- Inspecting tblSucursales ---');
        const cols = await projectQuery(projectId, 'DESCRIBE tblSucursales');
        console.log(JSON.stringify(cols, null, 2));
    } catch (error: any) {
        console.error('Inspection failed:', error.message);
    }
    process.exit(0);
}

inspect();
