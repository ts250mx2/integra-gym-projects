// Definición de alerta tal como vive en la tabla maestra tblAlertas.
export interface AlertDefinition {
    IdAlerta: number;
    Clave: string;
    Tipo: string;                 // 'sql' | 'ai'
    Titulo: string;
    Descripcion: string | null;
    Icono: string;
    ConsultaSQL: string | null;
    Prompt: string | null;
    Formato: string;              // number | currency | percent | text
    Direccion: string;            // asc | desc | neutro
    UmbralExito: number | null;
    UmbralAdvertencia: number | null;
    EstatusNeutro: string;        // success | warning | danger | info
    MensajeExito: string | null;
    MensajeAdvertencia: string | null;
    MensajePeligro: string | null;
    Orden: number;
    Activa: number;
}

export type AlertStatus = 'success' | 'warning' | 'danger' | 'info';
