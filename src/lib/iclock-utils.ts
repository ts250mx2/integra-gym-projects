import { query as globalQuery, execute as globalExecute } from './db';
import { getProjectConnectionPool } from './projectDb';
import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';

interface Lector extends RowDataPacket {
    IdLector: number;
    SerialNumber: string;
    IdProyecto?: number;
}

interface InterfaceDia extends RowDataPacket {
    Dia: number;
}

interface InterfaceHorarioZK extends RowDataPacket {
    IdGrupoHorario: number;
    PorDia: number;
    HoraEntrada: string;
    HoraSalida: string;
    ModificadoLector: number;
}

interface InterfaceHorarioDiaZK extends RowDataPacket {
    DiaSemanaMySQL: number;
    HoraEntrada: string;
    HoraSalida: string;
}

interface Visita extends RowDataPacket {
    MaxFechaVisita: Date;
}

interface InterfaceZK extends RowDataPacket {
    IdSocio: number;
    IdSucursalSocio: number;
    IdZK: number;
    Socio: string;
    IdGrupoHorario: number;
    FechaVencimiento: Date;
    ModificadoLector: number;
    IdCuota: number;
    TarjetaRFID: string;
    Dias: number;
    EsEmpleado: number;
}

export class IntegraDatabase {
    private sn: string;
    public idLector: string = "1";
    private idSucursal: string = "1";
    private leerVisitasManual: string = "0";
    private borrarSocios: number = 1;
    private sinValidarHorarios: string = "0";
    private usarGrupoHorario: string = "0";
    private diasBorrar: number = 30;

    private projectId: number = 0;
    private projectUuid: string = "";
    private projectPool: Pool | null = null;

    constructor(sn: string) {
        this.sn = sn;
        this.idSucursal = process.env.ID_SUCURSAL || "1";
    }

    public async init() {
        await this.asignarIdLector(this.sn);

        if (this.projectId > 0) {
            try {
                this.projectPool = await getProjectConnectionPool(this.projectId);

                // Fetch config from DB
                const configParams = [
                    { key: 'borrarSocios', section: 'Integra', param: 'BorrarSocios', default: "0" },
                    { key: 'leerVisitasManual', section: 'Integra', param: 'LeerVisitasManual', default: "0" },
                    { key: 'usarGrupoHorario', section: 'Integra', param: 'UsarGrupoHorario', default: "0" },
                    { key: 'sinValidarHorarios', section: 'Integra', param: 'SinValidarHorarios', default: "0" },
                    { key: 'diasBorrar', section: 'Integra', param: 'DiasBorrar', default: "30" }
                ];

                for (const p of configParams) {
                    const val = await this.getConfig(p.section, p.param);
                    if (val) {
                        if (p.key === 'borrarSocios') this.borrarSocios = parseInt(val);
                        if (p.key === 'diasBorrar') this.diasBorrar = parseInt(val);
                        if (p.key === 'leerVisitasManual') this.leerVisitasManual = val;
                        if (p.key === 'usarGrupoHorario') this.usarGrupoHorario = val;
                        if (p.key === 'sinValidarHorarios') this.sinValidarHorarios = val;
                    } else {
                        // Fallback to defaults or env if needed, but per request we replace env logic mainly.
                        // But keeping env as fallback or hardcoded defaults from user prompt.
                        if (p.key === 'borrarSocios') this.borrarSocios = parseInt(process.env.BORRAR_SOCIOS || p.default);
                        if (p.key === 'diasBorrar') this.diasBorrar = parseInt(process.env.DIAS_BORRAR || p.default);
                        if (p.key === 'leerVisitasManual') this.leerVisitasManual = process.env.LEER_VISITAS_MANUAL || p.default;
                        if (p.key === 'usarGrupoHorario') this.usarGrupoHorario = process.env.USAR_GRUPO_HORARIO || p.default;
                        if (p.key === 'sinValidarHorarios') this.sinValidarHorarios = process.env.SIN_VALIDAR_HORARIOS || p.default;
                    }
                }

                await this.sincronizarGruposHorarios();
            } catch (error) {
                console.error(`Failed to connect to project ID ${this.projectId}`, error);
            }
        }
    }

    private async pExecute(sql: string, params?: any[]) {
        if (!this.projectPool) return;
        return await this.projectPool.execute(sql, params);
    }

    private async pQuery(sql: string, params?: any[]) {
        if (!this.projectPool) return [];
        const [rows] = await this.projectPool.execute(sql, params);
        return rows as any[];
    }

    private async getConfig(section: string, parameter: string): Promise<string> {
        try {
            const rows = await this.pQuery(
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
    }

    private async asignarIdLector(sn: string) {
        try {
            this.idLector = "0";
            // Check Global DB for Reader
            const rows = await globalQuery(`SELECT * FROM tblLectores WHERE SerialNumber = ?`, [sn]) as Lector[];

            if (rows.length > 0) {
                this.idLector = rows[0].IdLector.toString();
                this.projectId = rows[0].IdProyecto || 0;

                if (this.projectId > 0) {
                    const projRows = await globalQuery('SELECT UUID FROM tblProyectos WHERE IdProyecto = ?', [this.projectId]) as any[];
                    if (projRows.length > 0) {
                        this.projectUuid = projRows[0].UUID;
                    }
                }
            }

            /*if (this.idLector === "0") {
                const emptyRows = await globalQuery(`SELECT IdLector, IdProyecto FROM tblLectores WHERE SerialNumber = '' OR SerialNumber IS NULL`) as Lector[];

                if (emptyRows.length > 0) {
                    this.idLector = emptyRows[0].IdLector.toString();
                    this.projectId = emptyRows[0].IdProyecto || 0;
                    await globalExecute(`UPDATE tblLectores SET SerialNumber = ? WHERE IdLector = ?`, [sn, this.idLector]);
                } else {
                    const maxRows = await globalQuery(`SELECT MAX(IdLector) AS MaxIdLector FROM tblLectores`) as RowDataPacket[];
                    let id = 1;
                    if (maxRows.length > 0 && maxRows[0].MaxIdLector) {
                        id = maxRows[0].MaxIdLector + 1;
                    }
                    this.idLector = id.toString();
                    // New readers created dynamically usually don't have a project assigned yet unless we have logic for it.
                    // Leaving projectId as 0. 
                    await globalExecute(`INSERT INTO tblLectores(IdLector, Lector, SerialNumber, Status) VALUES (?, ?, ?, 0)`,
                        [this.idLector, `LECTOR ${this.idLector}`, sn]);
                }
            }*/
        } catch (ex) {
            console.error("Error assigning reader ID:", ex);
            this.idLector = "1";
        }

        // Daily maintenance check (Global DB? or Project DB?)
        // tblInterfaceDias, tblInterfaceZK seem to be Project-specific synchronization tables.
        // Assuming they are in Project DB.
        if (this.projectPool) {
            try {
                // We need to make sure projectPool is available. 
                // But init() calls asignarIdLector BEFORE getting pool.
                // Refactoring: we can't run maintenance here if pool isn't ready.
                // I'll move maintenance to init() or separate method AFTER pool init.
            } catch (ex) {
                console.error("Error in maintenance setup:", ex);
            }
        }
    }

    private async mantenimientoDiario() {
        if (!this.projectPool) return;
        try {
            const dateCheck = await this.pQuery(`
                SELECT * FROM tblInterfaceDias 
                WHERE Dia = DAY(NOW()) AND Mes = MONTH(NOW()) AND Anio = YEAR(NOW())
            `) as InterfaceDia[];

            if (dateCheck.length === 0) {
                await this.pExecute(`
                    UPDATE tblInterfaceZK 
                    SET ModificadoLector1 = 2, ModificadoLector2 = 2, ModificadoLector3 = 2, ModificadoLector4 = 2, ModificadoLector5 = 2 
                    WHERE FechaVencimiento < DATE_SUB(NOW(), INTERVAL 1 DAY)
                `);

                await this.pExecute(`
                    INSERT INTO tblInterfaceDias(Dia, Mes, Anio, FechaAct) 
                    VALUES(DAY(NOW()), MONTH(NOW()), YEAR(NOW()), NOW())
                `);
            }
        } catch (ex) {
            console.error("Error in maintenance check:", ex);
        }
    }

    // Call this from init()
    public async runMaintenance() {
        await this.mantenimientoDiario();
    }

    public async leerHorarios(): Promise<string> {
        if (!this.projectPool) return "";

        let cadenaHorarios = "";
        let n = 1;

        try {
            const colModificado = `ModificadoLector${this.idLector}`;
            // Use Project DB
            const sql = `SELECT IdGrupoHorario, GrupoHorario, HoraInicio, HoraFin, TieneDias, LunesHoraInicio, LunesHoraFin, MartesHoraInicio, MartesHoraFin, MiercolesHoraInicio, MiercolesHoraFin, JuevesHoraInicio, JuevesHoraFin, ViernesHoraInicio, ViernesHoraFin, SabadoHoraInicio, SabadoHoraFin, DomingoHoraInicio, DomingoHoraFin FROM tblGruposHorarios WHERE ${colModificado} = 1 ORDER BY IdGrupoHorario`;
            const rows = await this.pQuery(sql) as InterfaceHorarioZK[];

            for (const row of rows) {
                let sDiaHora = new Array(7).fill("00002359");
                let sDiaHoraInicio = new Array(7).fill("0000");
                let sDiaHoraFin = new Array(7).fill("2359");

                if (row.IdGrupoHorario > 2) {
                    if (row.TieneDias === 0) {
                        for (let i = 0; i < 7; i++) {
                            sDiaHora[i] = this.horaZK(row.HoraInicio) + this.horaZK(row.HoraFin);
                            sDiaHoraInicio[i] = this.horaZK(row.HoraInicio);
                            sDiaHoraFin[i] = this.horaZK(row.HoraFin);
                        }
                    } else {

                        for (let i = 0; i < 7; i++) {
                            sDiaHora[i] = "00000001";
                            sDiaHoraInicio[i] = "0000";
                            sDiaHoraFin[i] = "0001";
                        }


                        sDiaHora[1] = this.horaZK(row.LunesHoraInicio) + this.horaZK(row.LunesHoraFin);
                        sDiaHoraInicio[1] = this.horaZK(row.LunesHoraInicio);
                        sDiaHoraFin[1] = this.horaZK(row.LunesHoraFin);

                        sDiaHora[2] = this.horaZK(row.MartesHoraInicio) + this.horaZK(row.MartesHoraFin);
                        sDiaHoraInicio[2] = this.horaZK(row.MartesHoraInicio);
                        sDiaHoraFin[2] = this.horaZK(row.MartesHoraFin);

                        sDiaHora[3] = this.horaZK(row.MiercolesHoraInicio) + this.horaZK(row.MiercolesHoraFin);
                        sDiaHoraInicio[3] = this.horaZK(row.MiercolesHoraInicio);
                        sDiaHoraFin[3] = this.horaZK(row.MiercolesHoraFin);

                        sDiaHora[4] = this.horaZK(row.JuevesHoraInicio) + this.horaZK(row.JuevesHoraFin);
                        sDiaHoraInicio[4] = this.horaZK(row.JuevesHoraInicio);
                        sDiaHoraFin[4] = this.horaZK(row.JuevesHoraFin);

                        sDiaHora[5] = this.horaZK(row.ViernesHoraInicio) + this.horaZK(row.ViernesHoraFin);
                        sDiaHoraInicio[5] = this.horaZK(row.ViernesHoraInicio);
                        sDiaHoraFin[5] = this.horaZK(row.ViernesHoraFin);

                        sDiaHora[6] = this.horaZK(row.SabadoHoraInicio) + this.horaZK(row.SabadoHoraFin);
                        sDiaHoraInicio[6] = this.horaZK(row.SabadoHoraInicio);
                        sDiaHoraFin[6] = this.horaZK(row.SabadoHoraFin);

                        sDiaHora[0] = this.horaZK(row.DomingoHoraInicio) + this.horaZK(row.DomingoHoraFin);
                        sDiaHoraInicio[0] = this.horaZK(row.DomingoHoraInicio);
                        sDiaHoraFin[0] = this.horaZK(row.DomingoHoraFin);

                    }
                }

                if (row.IdGrupoHorario === 2) {
                    for (let i = 0; i < 7; i++) {
                        sDiaHora[i] = "00000001";
                        sDiaHoraInicio[i] = "0000";
                        sDiaHoraFin[i] = "0001";
                    }
                }

                let cadenaDias = "";
                for (let i = 0; i < 7; i++) {
                    switch (i) {
                        case 0: cadenaDias += `\tSunStart=${sDiaHoraInicio[i]}\tSunEnd=${sDiaHoraFin[i]}`; break;
                        case 1: cadenaDias += `\tMonStart=${sDiaHoraInicio[i]}\tMonEnd=${sDiaHoraFin[i]}`; break;
                        case 2: cadenaDias += `\tTuesStart=${sDiaHoraInicio[i]}\tTuesEnd=${sDiaHoraFin[i]}`; break;
                        case 3: cadenaDias += `\tWedStart=${sDiaHoraInicio[i]}\tWedEnd=${sDiaHoraFin[i]}`; break;
                        case 4: cadenaDias += `\tThursStart=${sDiaHoraInicio[i]}\tThursEnd=${sDiaHoraFin[i]}`; break;
                        case 5: cadenaDias += `\tFriStart=${sDiaHoraInicio[i]}\tFriEnd=${sDiaHoraFin[i]}`; break;
                        case 6: cadenaDias += `\tSatStart=${sDiaHoraInicio[i]}\tSatEnd=${sDiaHoraFin[i]}\n`; break;
                    }
                }

                cadenaHorarios += `C:${n}:DATA UPDATE AccTimeZone UID=${row.IdGrupoHorario}${cadenaDias}`;
                n++;

                let tz1 = 0;
                switch (row.IdGrupoHorario) {
                    case 1: tz1 = 1; break;
                    case 2: tz1 = 2; break;
                    default: tz1 = row.IdGrupoHorario; break;
                }
                const tz2 = 0;
                const tz3 = 0;

                cadenaHorarios += `C:${n}:DATA UPDATE AccGroup ID=${row.IdGrupoHorario}\tID=${row.IdGrupoHorario}\tVerify=0\tValidHoliday=0\tTZ=${tz1};${tz2};${tz3}\n`;
                n++;
            }

            if (n > 1) {
                await this.pExecute(`UPDATE tblGruposHorarios SET ${colModificado} = 0 WHERE ${colModificado} = 1`);
            }

        } catch (ex) {
            console.error("Error reading schedules:", ex);
            throw ex;
        }

        return cadenaHorarios;
    }

    public async leerSocios(): Promise<string> {
        if (!this.projectPool) return "";
        let cadenaSocios = "";
        let n = 1;

        try {
            const colModificado = `ModificadoLector${this.idLector}`;
            const sql = `
            SELECT IdUsuario, Usuario, TarjetaRFID, '2100-01-01' AS FechaVencimiento, CASE WHEN B.EsAdministrador IS NULL THEN 0 ELSE 1 END AS EsAdministrador, CASE WHEN A.Status = 2 THEN 2 ELSE 1 END AS IdGrupoHorario, 10 As Dias, ${colModificado} FROM tblUsuarios A
            INNER JOIN tblPuestos B ON A.IdPuesto = B.IdPuesto
            WHERE ${colModificado} IN (1,2) 
            ORDER BY A.FechaAct DESC 
            LIMIT 10
        `;

            console.log("sql:", sql);
            const rows = await this.pQuery(sql) as InterfaceZK[];

            for (let row of rows) {
                let usuario = row.Usuario;
                let idUsuario = row.IdUsuario;
                let tarjetaRFID = row.TarjetaRFID;
                let dias = row.Dias;
                let idGrupoHorario = row.IdGrupoHorario;
                let esAdministrador = row.EsAdministrador;

                console.log("esAdministrador:", esAdministrador);

                if (usuario.length > 20) {
                    usuario = usuario.substring(0, 19);
                }

                /*
                if (this.sinValidarHorarios === "0") {
                    try {
                        const cuotaCheck1 = await this.pQuery(
                            `SELECT * FROM tblLectoresCuotas WHERE IdLector <> ? AND IdCuota = ?`,
                            [this.idLector, row.IdCuota]
                        ) as RowDataPacket[];

                        if (cuotaCheck1.length > 0) {
                            idGrupoHorario = 2;
                        }

                        const cuotaCheck2 = await this.pQuery(
                            `SELECT * FROM tblLectoresCuotas WHERE IdLector = ? AND IdCuota = ?`,
                            [this.idLector, row.IdCuota]
                        ) as RowDataPacket[];

                        if (cuotaCheck2.length > 0) {
                            idGrupoHorario = row.IdGrupoHorario;
                        }
                    } catch (ex) {
                        console.error("Error validating quota:", ex);
                    }
                }
                */
                if (this.sinValidarHorarios === "1" && idGrupoHorario !== 2) {
                    idGrupoHorario = 1;
                }

                let fechaVencimientoStr = "20000101";
                if (row.FechaVencimiento) {
                    const fv = new Date(row.FechaVencimiento);
                    const yyyy = fv.getFullYear();
                    const mm = String(fv.getMonth() + 1).padStart(2, '0');
                    const dd = String(fv.getDate()).padStart(2, '0');
                    fechaVencimientoStr = `${yyyy}${mm}${dd}`;
                }

                const modVal = row[colModificado];

                if (modVal === 1) {
                    let pri = 0;
                    if (esAdministrador > 0) {
                        pri = 14;
                    }

                    if (this.usarGrupoHorario === "0") {
                        if (idGrupoHorario > 9) {
                            cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idUsuario}\tName=${usuario}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=1\tTZ=000100${idGrupoHorario}00${idGrupoHorario}00${idGrupoHorario}\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        } else {
                            cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idUsuario}\tName=${usuario}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=1\tTZ=0001000${idGrupoHorario}000${idGrupoHorario}000${idGrupoHorario}\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        }
                    } else {
                        cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idUsuario}\tName=${usuario}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=${idGrupoHorario}\tTZ=0000000000000000\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                    }
                    n++;
                    cadenaSocios += `C:${n}:DATA UPDATE BIOPHOTO PIN=${idUsuario}\tType=9\tFormat=1\tPasswd=0\tUrl=photosu/${this.projectUuid}/${idUsuario}.jpg\n`;
                    n++;
                } else {

                    console.log("borrarSocios:", this.borrarSocios);
                    if (this.borrarSocios === 1 || (dias > this.diasBorrar && this.diasBorrar > 0)) {
                        cadenaSocios += `C:${n}:DATA DELETE BIOPHOTO PIN=${idUsuario}\tType=0\n`;
                        n++;
                        cadenaSocios += `C:${n}:DATA DELETE USERINFO PIN=${idUsuario}\n`;
                        n++;
                    } else {
                        cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idUsuario}\tName=${usuario}\tPri=0\tPasswd=0\tCard=${tarjetaRFID}\tGrp=2\tTZ=0001000200020002\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        n++;
                    }
                }
                console.log("cadenaSocios:", cadenaSocios);
                await this.pExecute(`UPDATE tblUsuarios SET ${colModificado} = 0 WHERE IdUsuario = ?`, [idUsuario]);
            }

        } catch (ex) {
            console.error("Error reading members:", ex);
        }

        try {
            const colModificado = `ModificadoLector${this.idLector}`;
            const sql = `
            SELECT A.IdVenta, A.IdSucursal, A.IdSocio, B.FechaInicio AS FechaInicio, B.FechaFin AS FechaVencimiento, D.IdGrupoHorario, C.Socio, C.TarjetaRFID, A.${colModificado}
            FROM tblVentas A
            INNER JOIN tblDetalleVentas B ON A.IdVenta = B.IdVenta AND A.IdSucursal = B.IdSucursal
            INNER JOIN tblSocios C ON A.IdSocio = C.IdSocio
            INNER JOIN tblCuotas D ON B.IdCuota = D.IdCuota
            WHERE B.FechaInicio < Now() AND B.FechaFin > Now() AND D.TipoMembresia = 1 AND A.Status = 0
            AND A.${colModificado} IN (1,2) 
            ORDER BY A.FechaAct DESC 
            LIMIT 10
        `;

            console.log("sql:", sql);
            const rows = await this.pQuery(sql) as InterfaceZK[];

            for (let row of rows) {
                let Socio = row.Socio;
                let idSocio = row.IdSocio;
                let idVenta = row.IdVenta;
                let idSucursal = row.IdSucursal;
                let tarjetaRFID = row.TarjetaRFID;
                let dias = row.Dias;
                let idGrupoHorario = row.IdGrupoHorario;
                let esAdministrador = 0;

                if (Socio.length > 20) {
                    Socio = Socio.substring(0, 19);
                }

                /*
                if (this.sinValidarHorarios === "0") {
                    try {
                        const cuotaCheck1 = await this.pQuery(
                            `SELECT * FROM tblLectoresCuotas WHERE IdLector <> ? AND IdCuota = ?`,
                            [this.idLector, row.IdCuota]
                        ) as RowDataPacket[];

                        if (cuotaCheck1.length > 0) {
                            idGrupoHorario = 2;
                        }

                        const cuotaCheck2 = await this.pQuery(
                            `SELECT * FROM tblLectoresCuotas WHERE IdLector = ? AND IdCuota = ?`,
                            [this.idLector, row.IdCuota]
                        ) as RowDataPacket[];

                        if (cuotaCheck2.length > 0) {
                            idGrupoHorario = row.IdGrupoHorario;
                        }
                    } catch (ex) {
                        console.error("Error validating quota:", ex);
                    }
                }
                */
                if (this.sinValidarHorarios === "1" && idGrupoHorario !== 2) {
                    idGrupoHorario = 1;
                }

                let fechaVencimientoStr = "20000101";
                if (row.FechaVencimiento) {
                    const fv = new Date(row.FechaVencimiento);
                    const yyyy = fv.getFullYear();
                    const mm = String(fv.getMonth() + 1).padStart(2, '0');
                    const dd = String(fv.getDate()).padStart(2, '0');
                    fechaVencimientoStr = `${yyyy}${mm}${dd}`;
                }

                const modVal = row[colModificado];
                let idSocioZK = idSocio * 10000;

                if (modVal === 1) {
                    let pri = 0;


                    if (this.usarGrupoHorario === "0") {
                        if (idGrupoHorario > 9) {
                            cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idSocioZK}\tName=${Socio}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=1\tTZ=000100${idGrupoHorario}00${idGrupoHorario}00${idGrupoHorario}\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        } else {
                            cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idSocioZK}\tName=${Socio}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=1\tTZ=0001000${idGrupoHorario}000${idGrupoHorario}000${idGrupoHorario}\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        }
                    } else {
                        cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idSocioZK}\tName=${Socio}\tPri=${pri}\tPasswd=0\tCard=${tarjetaRFID}\tGrp=${idGrupoHorario}\tTZ=0000000000000000\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                    }
                    n++;
                    cadenaSocios += `C:${n}:DATA UPDATE BIOPHOTO PIN=${idSocioZK}\tType=9\tFormat=1\tPasswd=0\tUrl=photosm/${this.projectUuid}/${idSocio}.jpg\n`;
                    n++;
                } else {

                    console.log("borrarSocios:", this.borrarSocios);
                    if (this.borrarSocios === 1 || (dias > this.diasBorrar && this.diasBorrar > 0)) {
                        cadenaSocios += `C:${n}:DATA DELETE BIOPHOTO PIN=${idSocioZK}\tType=0\n`;
                        n++;
                        cadenaSocios += `C:${n}:DATA DELETE USERINFO PIN=${idSocioZK}\n`;
                        n++;
                    } else {
                        cadenaSocios += `C:${n}:DATA UPDATE USERINFO PIN=${idSocioZK}\tName=${Socio}\tPri=0\tPasswd=0\tCard=${tarjetaRFID}\tGrp=2\tTZ=0001000200020002\tVerify=0\t\tStartDatetime=20000101\tEndDateTime=${fechaVencimientoStr}\n`;
                        n++;
                    }
                }
                console.log("cadenaSocios:", cadenaSocios);
                await this.pExecute(`UPDATE tblVentas SET ${colModificado} = 0 WHERE IdVenta = ? AND IdSucursal = ?`, [idVenta, idSucursal]);
            }

        } catch (ex) {
            console.error("Error reading members:", ex);
        }

        if (cadenaSocios === "") return "OK";
        return cadenaSocios;
    }

    public async leerUltimasVisitas(): Promise<string> {
        if (!this.projectPool) return "OK";
        if (this.leerVisitasManual === "0") {
            return "OK";
        }

        let fechaInicio = new Date("2000-01-01T00:00:00");
        const fechaFin = new Date();

        try {
            const rows = await this.pQuery(`SELECT MAX(FechaVisita) AS MaxFechaVisita FROM tblVisitas WHERE IdLector = ?`, [this.idLector]) as Visita[];
            if (rows.length > 0 && rows[0].MaxFechaVisita) {
                const lastDate = new Date(rows[0].MaxFechaVisita);
                lastDate.setSeconds(lastDate.getSeconds() + 1);
                fechaInicio = lastDate;
            }
        } catch (ex) {
            // keep default
        }

        const fmt = (d: Date) => {
            const yyyy = d.getFullYear();
            const MM = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
        };

        return `C:1:DATA QUERY ATTLOG StartTime=${fmt(fechaInicio)}\tEndTime=${fmt(fechaFin)}\n`;
    }

    private async sincronizarGruposHorarios() {
        if (!this.projectPool) return;
        try {
            const createSql = `CREATE TABLE IF NOT EXISTS tblGruposHorarios (
                IdGrupoHorario INT NOT NULL,
                GrupoHorario VARCHAR(45) NULL,
                HoraInicio VARCHAR(45) NULL,
                HoraFin VARCHAR(45) NULL,
                TieneDias INT NULL DEFAULT 0,
                Status INT NULL DEFAULT 0,
                FechaAct DATETIME NULL,
                LunesHoraInicio VARCHAR(10) NULL,
                LunesHoraFin VARCHAR(10) NULL,
                MartesHoraInicio VARCHAR(10) NULL,
                MartesHoraFin VARCHAR(10) NULL,
                MiercolesHoraInicio VARCHAR(10) NULL,
                MiercolesHoraFin VARCHAR(10) NULL,
                JuevesHoraInicio VARCHAR(10) NULL,
                JuevesHoraFin VARCHAR(10) NULL,
                ViernesHoraInicio VARCHAR(10) NULL,
                ViernesHoraFin VARCHAR(10) NULL,
                SabadoHoraInicio VARCHAR(10) NULL,
                SabadoHoraFin VARCHAR(10) NULL,
                DomingoHoraInicio VARCHAR(10) NULL,
                DomingoHoraFin VARCHAR(10) NULL,
                ModificadoLector1 INT NULL DEFAULT 0,
                ModificadoLector2 INT NULL DEFAULT 0,
                ModificadoLector3 INT NULL DEFAULT 0,
                ModificadoLector4 INT NULL DEFAULT 0,
                ModificadoLector5 INT NULL DEFAULT 0,
                ModificadoLector6 INT NULL DEFAULT 0,
                ModificadoLector7 INT NULL DEFAULT 0,
                ModificadoLector8 INT NULL DEFAULT 0,
                ModificadoLector9 INT NULL DEFAULT 0,
                ModificadoLector10 INT NULL DEFAULT 0,
                PRIMARY KEY (IdGrupoHorario)
            )`;
            await this.pExecute(createSql);


            const countRows = await this.pQuery(`SELECT COUNT(*) as count FROM tblGruposHorarios`) as RowDataPacket[];
            const count = countRows[0]?.count || 0;

            if (count > 0) {
                return;
            }

            // Sync from Global IM_IntegraMembers to Project DB
            // Assuming IM_IntegraMembers is visible from Global Connection
            const sourceRows = await globalQuery(`SELECT * FROM IM_IntegraMembers.tblGruposHorarios`) as RowDataPacket[];

            for (const row of sourceRows) {
                const upsertSql = `
                    INSERT INTO tblGruposHorarios (IdGrupoHorario, GrupoHorario, HoraInicio, HoraFin, TieneDias)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    GrupoHorario = VALUES(GrupoHorario),
                    HoraInicio = VALUES(HoraInicio),
                    HoraFin = VALUES(HoraFin),
                    TieneDias = VALUES(TieneDias)
                `;
                await this.pExecute(upsertSql, [row.IdGrupoHorario, row.GrupoHorario, row.HoraInicio, row.HoraFin, row.TieneDias]);
            }
        } catch (ex) {
            console.error("Error syncing tblGruposHorarios:", ex);
        }
    }

    private horaZK(hora: string): string {
        return hora ? hora.replace(/:/g, "") : "0000";
    }
}
