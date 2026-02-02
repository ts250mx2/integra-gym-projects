import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const SN = searchParams.get('SN');
    const devicetype = searchParams.get('devicetype') || '';

    if (!SN) {
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    try {
        // 1. Find the project for this device (SN)
        const devices = await query(
            'SELECT IdProyecto, NumLector FROM tblLectores WHERE SerialNumber = ?',
            [SN]
        ) as any[];

        if (devices.length === 0) {
            console.warn(`Device SN=${SN} not found in tblLectores`);
            return new NextResponse(`Device SN=${SN} not found`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        const projectId = devices[0].IdProyecto;
        const readerId = devices[0].NumLector;

        // Helper to get config from tblParametros
        const getConfig = async (section: string, parameter: string): Promise<string> => {
            try {
                const rows = await projectQuery(
                    projectId,
                    'SELECT Valor FROM tblParametros WHERE Seccion = ? AND Parametro = ?',
                    [section, parameter]
                ) as any[];
                if (rows.length > 0 && rows[0].Valor) {
                    return rows[0].Valor;
                }
                return "";
            } catch (err) {
                console.error(`Error fetching config ${section}:${parameter}:`, err);
                return "";
            }
        };

        let Cadena = "";
        let GetOption = "0";

        try {
            GetOption = await getConfig('Integra', 'GetOption');
            if (!GetOption) GetOption = "0";
        } catch (ex) {
            GetOption = "0";
        }

        if (devicetype === "acc") {
            Cadena = "OK";
        } else {
            if (GetOption === "1") {
                Cadena = "GET OPTION FROM: " + SN + "\n";

                const paramsToFetch = [
                    { key: 'Stamp', section: 'AttOptions', param: 'Stamp' },
                    { key: 'OpStamp', section: 'AttOptions', param: 'OpStamp' },
                    { key: 'ATTLOGStamp', section: 'AttOptions', param: 'ATTLOGStamp' },
                    { key: 'OPERLOGStamp', section: 'AttOptions', param: 'OPERLOGStamp' },
                    { key: 'ATTPHOTOStamp', section: 'AttOptions', param: 'ATTPHOTOStamp' },
                    { key: 'ErrorDelay', section: 'AttOptions', param: 'ErrorDelay' },
                    { key: 'Delay', section: 'AttOptions', param: 'Delay' },
                    { key: 'TransTimes', section: 'AttOptions', param: 'TransTimes' },
                    { key: 'TransInterval', section: 'AttOptions', param: 'TransInterval' },
                    { key: 'TransFlag', section: 'AttOptions', param: 'TransFlag' },
                    { key: 'TimeZone', section: 'AttOptions', param: 'TimeZone' },
                    { key: 'TimeZoneclock', section: 'AttOptions', param: 'TimeZoneclock' },
                    { key: 'Realtime', section: 'AttOptions', param: 'Realtime' },
                    { key: 'Encrypt', section: 'AttOptions', param: 'Encrypt' },
                    { key: 'PushOptionsFlag', section: 'AttOptions', param: 'PushOptionsFlag' },
                    { key: 'PushOptions', section: 'AttOptions', param: 'PushOptions' },
                    { key: 'ServerVer', section: 'AttOptions', param: 'ServerVer' },
                    { key: 'PushProtVer', section: 'AttOptions', param: 'PushProtVer' },
                ];

                const values = await Promise.all(paramsToFetch.map(async (p) => {
                    const val = await getConfig(p.section, p.param);
                    return { ...p, val };
                }));

                for (const item of values) {
                    if (item.val !== "") {
                        Cadena += `${item.key}=${item.val}\n`;
                    }
                }
            } else {
                Cadena = "OK";
            }
        }

        return new NextResponse(Cadena, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain'
            }
        });

    } catch (error) {
        console.error('iclock/cdata error:', error);
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}

export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const SN = searchParams.get('SN');
    const table = searchParams.get('table');

    if (!SN) {
        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    try {
        const bodyText = await req.text();

        if (table === 'ATTLOG') {
            return await handleAttLog(SN, bodyText);
        } else if (table === 'OPERLOG') {
            return new NextResponse('OK:1', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } catch (error) {
        console.error('iclock/cdata POST error:', error);
        return new NextResponse('ERROR', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
}

async function handleAttLog(SN: string, value: string) {
    // 1. Find Project and Config
    const devices = await query(
        'SELECT IdProyecto, IdLector, IdSucursal FROM tblLectores WHERE SerialNumber = ?',
        [SN]
    ) as any[];

    if (devices.length === 0) {
        return new NextResponse('OK:0', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const { IdProyecto, IdLector, IdSucursal } = devices[0];
    let projectId = IdProyecto;
    let branchId = IdSucursal || 0;
    // ensure projectId is number
    projectId = Number(projectId);


    const lines = value.split('\n');
    let n = 0; // The C# code returned total lines processed? No, `n` started at 1 and incremented. C# "OK:" + n. But logic says "OK:" + lineas.Length. I'll return count.
    console.log("lines: ", lines);
    console.log("lines.length: ", lines.length);

    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
        return new NextResponse('OK:0', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }


    let processedCount = 0;

    for (const line of lines) {
        if (!line.trim()) continue;
        processedCount++;
        console.log("line: ", line);

        const cols = line.split('\t'); // ID, Date, Status, Verify...

        console.log("cols.length: ", cols.length);
        // Format: ID \t Time \t ...
        if (cols.length < 2) continue;

        const userIdRaw = cols[0];
        const fechaVisita = cols[1]; // Expected "YYYY-MM-DD HH:mm:ss"

        let IdSocio = parseInt(userIdRaw);
        console.log("IdSocio: ", IdSocio);

        if (IdSocio >= 10000) {

            try {


                await projectQuery(projectId,
                    `DELETE FROM tblVisitasRecientes WHERE (IdSocio = ? AND DATE(FechaVisita) = DATE(?) AND HOUR(FechaVisita) = HOUR(?) AND MINUTE(FechaVisita) = MINUTE(?)) OR FechaAct < DATE_SUB(NOW(), INTERVAL 1 DAY)`,
                    [IdSocio / 10000, fechaVisita, fechaVisita, fechaVisita]
                );

                await projectQuery(projectId,
                    `DELETE FROM tblVisitas WHERE (IdSocio = ? AND DATE(FechaVisita) = DATE(?) AND HOUR(FechaVisita) = HOUR(?) AND MINUTE(FechaVisita) = MINUTE(?))`,
                    [IdSocio / 10000, fechaVisita, fechaVisita, fechaVisita]
                );

                await projectQuery(projectId,
                    `INSERT INTO tblVisitas(IdSocio, IdSucursal, IdUsuario, FechaVisita, FechaAct, IdLector) VALUES(?, ?, 0, ?, Now(), ?)`,
                    [IdSocio / 10000, branchId, fechaVisita, IdLector]
                );

                await projectQuery(projectId,
                    `INSERT INTO tblVisitasRecientes(IdSocio, IdSucursal, IdUsuario, FechaVisita, FechaAct, IdLector) VALUES(?, ?, 0, ?, Now(), ?)`,
                    [IdSocio / 10000, branchId, fechaVisita, IdLector]
                );
            } catch (err) { console.error('Insert visit error:', err); }


        } else {

            try {
                await projectQuery(projectId,
                    `DELETE FROM tblVisitasRecientes WHERE (IdSocio = ? AND DATE(FechaVisita) = DATE(?) AND HOUR(FechaVisita) = HOUR(?) AND MINUTE(FechaVisita) = MINUTE(?)) OR FechaAct < DATE_SUB(NOW(), INTERVAL 1 DAY)`,
                    [IdSocio / 10000, fechaVisita, fechaVisita, fechaVisita]
                );

                await projectQuery(projectId,
                    `DELETE FROM tblVisitas WHERE IdSocio = ? AND DATE(FechaVisita) = DATE(?) AND HOUR(FechaVisita) = HOUR(?) AND MINUTE(FechaVisita) = MINUTE(?)`,
                    [IdSocio / 10000, fechaVisita, fechaVisita, fechaVisita]
                );

                await projectQuery(projectId,
                    `INSERT INTO tblVisitasRecientes(IdSocio, IdSucursal, IdUsuario, FechaVisita, FechaAct, IdLector) VALUES(0, ?, ?, ?, Now(), ?)`,
                    [branchId, IdSocio, fechaVisita, IdLector]
                );


                await projectQuery(projectId,
                    `INSERT INTO tblVisitas(IdSocio, IdSucursal, IdUsuario, FechaVisita, FechaAct, IdLector) VALUES(0, ?, ?, ?, Now(), ?)`,
                    [branchId, IdSocio, fechaVisita, IdLector]
                );


            } catch (err) { console.error('Insert visit error:', err); }

        }
    }

    return new NextResponse('OK:' + processedCount, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
