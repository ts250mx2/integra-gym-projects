
/**
 * Utility to print sales ticket by fetching data from API
 */
export async function printTicket(saleId: number) {
    try {
        const res = await fetch(`/api/sales/${saleId}/ticket`);
        if (!res.ok) {
            console.error('Failed to fetch ticket data');
            alert('Error al obtener datos del ticket');
            return;
        }

        const { data } = await res.json();
        if (!data) return;

        // Construct Ticket HTML
        const ticketHtml = `
            <html>
            <head>
                <title>Ticket de Venta</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; width: 300px; color: black; background: white; }
                    .header { text-align: center; margin-bottom: 5px; }
                    .header img { max-width: 150px; } 
                    .branch-info { text-align: center; margin-bottom: 5px; font-size: 10px; }
                    .divider { border-top: 1px dashed black; margin: 5px 0; }
                    .info-row { display: flex; align-items: center; margin-bottom: 2px; }
                    .info-label { width: 60px; font-weight: normal; } /* Fixed width for alignment if needed, or just auto */
                    .info-value { font-weight: normal; }
                    .items-table { width: 100%; text-align: left; margin-top: 5px; font-size: 10px; } /* Smaller font */
                    .items-table th { border-bottom: 1px dashed black; }
                    .total-section { text-align: right; margin-top: 5px; font-weight: bold; font-size: 14px; }
                    .footer { text-align: center; margin-top: 5px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <!-- Gym Name -->
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
                        ${data.GymName || 'Integra Gym'}
                    </div>

                    <!-- Dynamic Logo -->
                    <img src="${data.ProjectLogo || '/images/logo_black.png'}" alt="LOGO" style="width: 100px; max-height: 100px; object-fit: contain;"/>
                </div>

                <div class="branch-info">
                   ${data.Direccion1 || ''}<br/>
                   ${data.Direccion2 || ''}<br/>
                   ${data.Estado || ''}<br/>
                   ${data.Localidad || ''} ${data.CodigoPostal || ''}<br/>
                   Tel: ${data.Telefono || 'N/A'}<br/>
                   ${data.CorreoElectronico || ''}
                </div>

                <div class="divider"></div>
                
                <div class="info-row">
                    <span style="font-weight: normal; margin-right: 5px;">Apertura #:</span>
                    <span style="text-align: left;">${data.IdApertura || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span style="font-weight: normal; margin-right: 5px;">Folio:</span>
                    <strong style="text-align: left;">${data.FolioVenta}</strong>
                </div>
                <div class="info-row">
                    <span style="font-weight: normal; margin-right: 5px;">Fecha:</span>
                    <span style="font-weight: bold; text-align: left;">${new Date(data.FechaVenta).toLocaleString()}</span>
                </div>
                <div class="info-row">
                    <span style="font-weight: normal; margin-right: 5px;">Cliente:</span>
                    <strong style="text-align: left;">${(data.CodigoSocio ? data.CodigoSocio + ' - ' : '') + data.Cliente}</strong>
                </div>

                <div class="divider"></div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Cant</th>
                            <th>Prod</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map((item: any) => `
                        <tr>
                            <td>${item.Cantidad}</td>
                            <td>${item.Producto} ${item.Periodo ? `(${item.Periodo})` : ''}</td>
                            <td>$${(item.Precio * item.Cantidad).toFixed(2)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="divider"></div>

                <div class="total-section">
                    TOTAL: $${Number(data.Total).toFixed(2)}
                </div>

                <div class="divider"></div>

                <div style="font-size: 10px;">
                    <strong>Formas de Pago:</strong><br/>
                    ${data.payments?.map((p: any) => `
                        <div style="display: flex; justify-content: space-between;">
                            <span>${p.FormaPago}</span>
                            <span>$${Number(p.Pago).toFixed(2)}</span>
                        </div>
                    `).join('') || ''}
                </div>

                <div class="footer">
                    <br/>
                    Le atendió: ${data.Vendedor || 'Sistema'}
                </div>
                
                <script>
                    window.print();
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '', 'width=400,height=600');
        if (printWindow) {
            printWindow.document.write(ticketHtml);
            printWindow.document.close();
        }

    } catch (error) {
        console.error('Error printing ticket:', error);
        alert('Error al imprimir ticket');
    }
}
