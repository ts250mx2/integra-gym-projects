import { query, execute } from './db';

const MASTER_DB = 'IM_IntegraMembers';

/**
 * Synchronizes the target database schema with the master template.
 * Adds missing tables and missing columns to existing tables.
 */
export async function syncDatabaseSchema(targetDb: string) {
    try {
        console.log(`[SchemaSync] Starting sync for ${targetDb}`);

        // 1. Get all tables from master
        const masterTables = await query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
            [MASTER_DB]
        ) as any[];

        const targetTables = await query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
            [targetDb]
        ) as any[];

        const targetTableNames = new Set(targetTables.map(t => t.TABLE_NAME));

        for (const { TABLE_NAME: tableName } of masterTables) {
            if (!targetTableNames.has(tableName)) {
                // Table is missing, create it
                console.log(`[SchemaSync] Creating missing table: ${tableName} in ${targetDb}`);

                const createResult = await query(`SHOW CREATE TABLE \`${MASTER_DB}\`.\`${tableName}\``) as any[];
                let createSql = createResult[0]['Create Table'];

                // Execute the CREATE TABLE statement in the target DB
                // We just need to make sure we are not referencing the old DB name in the statement which is unlikely but let's be safe
                await execute(`CREATE TABLE \`${targetDb}\`.\`${tableName}\` ${createSql.substring(createSql.indexOf('('))}`);

                // Custom logic: Copy data for tblParametros if newly created
                if (tableName === 'tblParametros') {
                    console.log(`[SchemaSync] Copying data for ${tableName} from ${MASTER_DB} to ${targetDb}`);
                    await execute(`INSERT INTO \`${targetDb}\`.\`${tableName}\` SELECT * FROM \`${MASTER_DB}\`.\`${tableName}\``);
                }
            } else {
                // Table exists, check for missing columns
                const masterCols = await query(
                    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                    [MASTER_DB, tableName]
                ) as any[];

                const targetCols = await query(
                    `SELECT COLUMN_NAME 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                    [targetDb, tableName]
                ) as any[];

                const targetColNames = new Set(targetCols.map(c => c.COLUMN_NAME));

                for (const col of masterCols) {
                    if (!targetColNames.has(col.COLUMN_NAME)) {
                        console.log(`[SchemaSync] Adding missing column: ${col.COLUMN_NAME} to ${tableName} in ${targetDb}`);

                        let alterSql = `ALTER TABLE \`${targetDb}\`.\`${tableName}\` ADD COLUMN \`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE}`;

                        if (col.IS_NULLABLE === 'NO') {
                            alterSql += ' NOT NULL';
                        }

                        if (col.COLUMN_DEFAULT !== null) {
                            alterSql += ` DEFAULT ${typeof col.COLUMN_DEFAULT === 'string' ? `'${col.COLUMN_DEFAULT}'` : col.COLUMN_DEFAULT}`;
                        } else if (col.IS_NULLABLE === 'YES') {
                            alterSql += ' DEFAULT NULL';
                        }

                        if (col.EXTRA) {
                            alterSql += ` ${col.EXTRA}`;
                        }

                        await execute(alterSql);
                    }
                }
            }
        }

        console.log(`[SchemaSync] Sync completed for ${targetDb}`);

        // 2. Check tblGruposHorarios specifically (outside main loop to ensure it runs even if table exists)
        // Check if table exists first (it should now)
        const groupsTableExists = await query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblGruposHorarios'`,
            [targetDb]
        ) as any[];

        if (groupsTableExists.length > 0) {
            // Check if empty
            const countRes = await query(`SELECT COUNT(*) as count FROM \`${targetDb}\`.tblGruposHorarios`) as any[];
            const count = countRes[0].count;

            if (count === 0) {
                console.log(`[SchemaSync] Syncing tblGruposHorarios from ${MASTER_DB} to ${targetDb} (table was empty)`);
                // Insert from master
                await execute(`INSERT INTO \`${targetDb}\`.tblGruposHorarios SELECT * FROM \`${MASTER_DB}\`.tblGruposHorarios`);
            }
        }
    } catch (error) {
        console.error(`[SchemaSync] Error syncing ${targetDb}:`, error);
        // We don't throw here to avoid blocking login if sync fails, but we log the error
    }
}
