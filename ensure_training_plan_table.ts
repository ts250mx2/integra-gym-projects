import { query } from './src/lib/db';
import { getProjectConnectionPool } from './src/lib/projectDb';

async function main() {
    try {
        const projects = await query('SELECT IdProyecto, Proyecto FROM tblProyectos') as any[];
        console.log(`Found ${projects.length} projects.`);

        for (const project of projects) {
            console.log(`\nProcessing Project: ${project.Proyecto} (${project.IdProyecto})`);
            try {
                const pool = await getProjectConnectionPool(project.IdProyecto);

                // 1. Create table if not exists
                const createTableSql = `
                    CREATE TABLE IF NOT EXISTS tblPlanesEntrenamiento (
                        IdPlanEntrenamiento INT AUTO_INCREMENT PRIMARY KEY,
                        Socio VARCHAR(255) NULL,
                        CodigoSocio VARCHAR(50) NULL,
                        Genero TINYINT NULL,
                        Edad INT NULL,
                        Peso DECIMAL(5,2) NULL,
                        Estatura DECIMAL(4,2) NULL,
                        Dias INT NULL,
                        Minutos INT NULL,
                        Observaciones TEXT NULL,
                        PlanEntrenamiento LONGTEXT NULL,
                        FechaPlanEntrenamiento DATETIME NULL,
                        UUID CHAR(36) NOT NULL,
                        UNIQUE KEY idx_uuid (UUID)
                    ) ENGINE=InnoDB DEFAULT CHARSET=latin1
                `;
                await pool.execute(createTableSql);
                console.log(`  Table tblPlanesEntrenamiento guaranteed.`);

                // 2. Double check and add UUID unique index if missing or columns
                // Check existing columns to avoid duplicate/missing issues
                const [columns] = await pool.execute('SHOW COLUMNS FROM tblPlanesEntrenamiento') as any[];
                const colNames = columns.map((c: any) => c.Field);
                
                const expectedColumns = [
                    { name: 'Socio', def: 'VARCHAR(255) NULL' },
                    { name: 'CodigoSocio', def: 'VARCHAR(50) NULL' },
                    { name: 'Genero', def: 'TINYINT NULL' },
                    { name: 'Edad', def: 'INT NULL' },
                    { name: 'Peso', def: 'DECIMAL(5,2) NULL' },
                    { name: 'Estatura', def: 'DECIMAL(4,2) NULL' },
                    { name: 'Dias', def: 'INT NULL' },
                    { name: 'Minutos', def: 'INT NULL' },
                    { name: 'Observaciones', def: 'TEXT NULL' },
                    { name: 'PlanEntrenamiento', def: 'LONGTEXT NULL' },
                    { name: 'FechaPlanEntrenamiento', def: 'DATETIME NULL' },
                    { name: 'UUID', def: 'CHAR(36) NOT NULL' }
                ];

                for (const col of expectedColumns) {
                    if (!colNames.includes(col.name)) {
                        await pool.execute(`ALTER TABLE tblPlanesEntrenamiento ADD COLUMN ${col.name} ${col.def}`);
                        console.log(`  Added missing column: ${col.name}`);
                    }
                }

            } catch (err: any) {
                console.error(`  Failed to process project ${project.IdProyecto}:`, err.message);
            }
        }
        console.log('\nFinished ensuring tblPlanesEntrenamiento table in all projects.');
    } catch (err) {
        console.error('Main error:', err);
    }
}

main();
