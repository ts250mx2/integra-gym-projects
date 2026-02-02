import pool from './db';

async function migrate() {
    try {
        console.log('--- Migrating tblUsuarios in IM_IntegraMembers ---');

        // Add TarjetaRFID if it doesn't exist
        const [rfidCols] = await pool.query('SHOW COLUMNS FROM IM_IntegraMembers.tblUsuarios LIKE "TarjetaRFID"');
        if ((rfidCols as any[]).length === 0) {
            await pool.query('ALTER TABLE IM_IntegraMembers.tblUsuarios ADD COLUMN TarjetaRFID VARCHAR(50) AFTER ArchivoFoto');
            console.log('Column TarjetaRFID added.');
        }

        // Add ModificadoLector1 to ModificadoLector10 if they don't exist
        for (let i = 1; i <= 10; i++) {
            const colName = `ModificadoLector${i}`;
            const [lectorCols] = await pool.query(`SHOW COLUMNS FROM IM_IntegraMembers.tblUsuarios LIKE "${colName}"`);
            if ((lectorCols as any[]).length === 0) {
                await pool.query(`ALTER TABLE IM_IntegraMembers.tblUsuarios ADD COLUMN ${colName} TINYINT DEFAULT 0`);
                console.log(`Column ${colName} added.`);
            }
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        process.exit();
    }
}

migrate();
