import { getProjectByUUID, projectQuery } from '@/lib/projectDb';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TicketWebPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const projectUuid = params.projectUuid as string;
    const ticketUuid = params.ticketUuid as string;

    if (!projectUuid || !ticketUuid) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                    <p className="text-gray-700">Faltan parámetros requeridos (projectUuid o ticketUuid).</p>
                </div>
            </div>
        );
    }

    try {
        // 1. Obtener datos del proyecto
        const project = await getProjectByUUID(projectUuid);

        // 2. Consultar el ticket en la base de datos del proyecto
        const sql = 'SELECT Ticket FROM tblTicketsWeb WHERE UUID = ?';
        const results: any = await projectQuery(project.IdProyecto, sql, [ticketUuid], project);

        if (!results || results.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans bg-gray-100">
                    <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
                        <h1 className="text-2xl font-bold text-orange-600 mb-4">No Encontrado</h1>
                        <p className="text-gray-700">No se encontró el ticket solicitado.</p>
                        <p className="text-sm text-gray-400 mt-2">UUID: {ticketUuid}</p>
                    </div>
                </div>
            );
        }

        const ticketContent = results[0].Ticket;

        // 3. Renderizar el contenido en un textarea de 40 columnas (limpio)
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-0 bg-white">
                <textarea 
                    readOnly
                    cols={40}
                    rows={30}
                    className="font-mono text-sm border-none p-4 focus:outline-none bg-white overflow-hidden"
                    style={{ width: '40ch', minHeight: '100vh', resize: 'none', lineHeight: '1.2' }}
                    value={ticketContent}
                />

                <style dangerouslySetInnerHTML={{ __html: `
                    textarea {
                        white-space: pre;
                        overflow-wrap: normal;
                        overflow-x: auto;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                `}} />
            </div>
        );

    } catch (error: any) {
        console.error('Error loading web ticket:', error);
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error de Sistema</h1>
                    <p className="text-gray-700">Hubo un problema al conectar con la base de datos o recuperar el ticket.</p>
                    <p className="text-xs text-gray-500 mt-4 text-left overflow-auto max-h-24">
                        {error.message}
                    </p>
                </div>
            </div>
        );
    }
}
