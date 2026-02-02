import { query } from './src/lib/db';
import { getProjectConnectionPool } from './src/lib/projectDb';

async function main() {
    try {
        // 1. Get all projects
        const projects = await query('SELECT IdProyecto, Proyecto FROM tblProyectos') as any[];
        console.log(`Found ${projects.length} projects.`);

        for (const project of projects) {
            console.log(`Processing Project: ${project.Proyecto} (${project.IdProyecto})`);
            try {
                const pool = await getProjectConnectionPool(project.IdProyecto);

                const columns = [
                    'LunesHoraInicio VARCHAR(10) NULL', 'LunesHoraFin VARCHAR(10) NULL',
                    'MartesHoraInicio VARCHAR(10) NULL', 'MartesHoraFin VARCHAR(10) NULL',
                    'MiercolesHoraInicio VARCHAR(10) NULL', 'MiercolesHoraFin VARCHAR(10) NULL',
                    'JuevesHoraInicio VARCHAR(10) NULL', 'JuevesHoraFin VARCHAR(10) NULL',
                    'ViernesHoraInicio VARCHAR(10) NULL', 'ViernesHoraFin VARCHAR(10) NULL',
                    'SabadoHoraInicio VARCHAR(10) NULL', 'SabadoHoraFin VARCHAR(10) NULL',
                    'DomingoHoraInicio VARCHAR(10) NULL', 'DomingoHoraFin VARCHAR(10) NULL'
                ];

                for (const colDef of columns) {
                    const colName = colDef.split(' ')[0];
                    try {
                        await pool.execute(`ALTER TABLE tblGruposHorarios ADD COLUMN ${colDef}`);
                        console.log(`  Added ${colName}`);
                    } catch (e: any) {
                        if (e.code === 'ER_DUP_FIELDNAME') {
                            console.log(`  ${colName} already exists.`);
                        } else {
                            console.error(`  Error adding ${colName}:`, e.message);
                        }
                    }
                }

            } catch (err) {
                console.error(`  Failed to connect/update project ${project.IdProyecto}:`, err);
            }
        }
    } catch (err) {
        console.error('Main error:', err);
    }
}

main();
