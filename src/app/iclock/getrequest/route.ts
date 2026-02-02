import { NextRequest, NextResponse } from 'next/server';
import { IntegraDatabase } from '@/lib/iclock-utils';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const sn = searchParams.get('SN');

    if (!sn) {
        return new NextResponse("Error: Serial Number (SN) missing", { status: 400 });
    }

    try {
        const ind = new IntegraDatabase(sn);
        await ind.init();

        let response = "";

        // Paso 2: Leer Horarios
        let horarios = await ind.leerHorarios();

        // Paso 3
        if (horarios === "") {
            // Paso 4: Leer Socios
            let socios = await ind.leerSocios();
            response = socios;

            // Paso 6: Check time and socios status
            // Time check: 0, 10, 20, 30, 40, 50 minutes
            const now = new Date();
            const minutes = now.getMinutes();

            if (socios === "OK" && (minutes % 10 === 0)) {
                response = await ind.leerUltimasVisitas();
            }
        } else {
            // Paso 7
            response = horarios;
        }

        return new NextResponse(response, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
            }
        });

    } catch (ex: any) {
        return new NextResponse(ex.message || "Unknown error", { status: 500 });
    }
}
