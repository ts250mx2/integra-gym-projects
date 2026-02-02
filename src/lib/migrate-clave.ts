import pool from './db';

async function migrate() {
    try {
        console.log('--- Migrating tblSucursales in IM_IntegraMembers ---');
        // Check if column exists first
        const [cols] = await pool.query('SHOW COLUMNS FROM IM_IntegraMembers.tblSucursales LIKE "Clave"');
        if ((cols as any[]).length === 0) {
            await pool.query('ALTER TABLE IM_IntegraMembers.tblSucursales ADD COLUMN Clave VARCHAR(20) NOT NULL AFTER IdSucursal');
            console.log('Column Clave added successfully.');
        } else {
            console.log('Column Clave already exists.');
        }
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        process.exit();
    }
}

migrate();
