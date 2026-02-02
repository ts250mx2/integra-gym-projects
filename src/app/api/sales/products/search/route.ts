import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { projectQuery } from '@/lib/projectDb';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const session = JSON.parse(sessionCookie.value);
        const { projectId } = session;
        const searchParams = req.nextUrl.searchParams;
        const query = searchParams.get('q') || '';

        if (!query) {
            // Default: Return top 15 ordered by IdCuota DESC (newest first) or as requested "ordenados por IdCuota"
            const defaults = await projectQuery(
                projectId,
                `SELECT IdCuota AS IdProducto, Cuota AS Producto, CodigoBarras, Precio, IVA, TipoCuota, TipoMembresia, Vigencia, TipoVigencia 
                 FROM tblCuotas 
                 WHERE Status = 0 
                 ORDER BY IdCuota DESC 
                 LIMIT 15`
            );
            return NextResponse.json(defaults);
        }

        // Search by Code or Name or Price in tblCuotas
        // Check if query is numeric to attempt exact price match
        const isNumeric = !isNaN(Number(query));
        const limit = 50;

        // Base wildcard search
        let sql = `SELECT IdCuota AS IdProducto, Cuota AS Producto, CodigoBarras, Precio, IVA, TipoCuota, TipoMembresia, Vigencia, TipoVigencia
                   FROM tblCuotas 
                   WHERE (Cuota LIKE ? OR CodigoBarras LIKE ?`;

        let params: any[] = [`%${query}%`, `%${query}%`];

        if (isNumeric) {
            // Add exact price match AND partial string match for price
            sql += ` OR Precio = ? OR CONCAT(Precio, '') LIKE ?`;
            params.push(query); // Exact match (handles 37 == 37.00)
            params.push(`%${query}%`); // Partial match
        } else {
            // Just partial string match for price (if it even makes sense for non-numeric, but "100" is numeric)
            // If it's valid text like "abc", Price LIKE is useless, but harmless.
            sql += ` OR CONCAT(Precio, '') LIKE ?`;
            params.push(`%${query}%`);
        }

        sql += `) AND Status = 0 ORDER BY IdCuota DESC LIMIT ${limit}`;

        const products = await projectQuery(projectId, sql, params);

        return NextResponse.json(products);

    } catch (error: any) {
        console.error('Product search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
