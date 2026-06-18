// Configuración de conexión a la BD MAESTRA para los scripts de migración.
// NO hardcodea credenciales: las toma de variables de entorno o del archivo .env
// (ignorado por git). Para correr los scripts define en el entorno o en .env:
//   DB_HOST, DB_USER, DB_PASSWORD  (y opcional DB_NAME, default BDIntegraProjects)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseEnv(file) {
    const out = {};
    try {
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
            if (!m) continue;
            let v = m[2].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            out[m[1]] = v;
        }
    } catch { /* sin .env */ }
    return out;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileEnv = parseEnv(path.join(root, '.env'));
const get = (k) => process.env[k] ?? fileEnv[k];

export const DB = {
    host: get('DB_HOST'),
    user: get('DB_USER'),
    password: get('DB_PASSWORD'),
    database: get('DB_NAME') || 'BDIntegraProjects',
    charset: 'latin1',
};

if (!DB.host || !DB.user || !DB.password) {
    console.error('Faltan credenciales de BD. Define DB_HOST, DB_USER y DB_PASSWORD en el entorno o en .env.');
    process.exit(1);
}
