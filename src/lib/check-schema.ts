import pool from './db';

async function checkSchema() {
    try {
        console.log('--- tblUsuarios Schema ---');
        const [usersCols] = await pool.query('DESCRIBE IM_IntegraMembers.tblUsuarios');
        (usersCols as any[]).forEach(col => console.log(`${col.Field}: ${col.Type}`));

        console.log('\n--- tblProyectos Schema ---');
        const [projectCols] = await pool.query('DESCRIBE BDIntegraProjects.tblProyectos');
        (projectCols as any[]).forEach(col => console.log(`${col.Field}: ${col.Type}`));
        console.log('\n--- tblSucursales Schema ---');
        const [branchCols] = await pool.query('DESCRIBE IM_IntegraMembers.tblSucursales');
        (branchCols as any[]).forEach(col => console.log(`${col.Field}: ${col.Type}`));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
