
import { query } from '../lib/db';

async function inspect() {
    try {
        console.log(`Checking schema for tblGruposHorarios...`);
        try {
            const cols = await query(`DESCRIBE tblGruposHorarios`) as any[];
            console.log(cols.map((c: any) => `${c.Field} (${c.Type})`).join('\n'));
        } catch (e: any) {
            console.log(`Error describing tblGruposHorarios: ${e.message}`);
        }

        console.log(`\nChecking schema for tblInterfaceHorariosDiasZK...`);
        try {
            const cols = await query(`DESCRIBE tblInterfaceHorariosDiasZK`) as any[];
            console.log(cols.map((c: any) => `${c.Field} (${c.Type})`).join('\n'));
        } catch (e: any) {
            console.log(`Error describing tblInterfaceHorariosDiasZK: ${e.message}`);
        }

        console.log(`\nChecking schema for tblGruposHorariosDias (if exists)...`);
        try {
            const cols = await query(`DESCRIBE tblGruposHorariosDias`) as any[];
            console.log(cols.map((c: any) => `${c.Field} (${c.Type})`).join('\n'));
        } catch (e: any) {
            console.log(`Error describing tblGruposHorariosDias: ${e.message}`);
        }

    } catch (error) {
        console.error('Script error:', error);
    }
    process.exit(0);
}

inspect();
