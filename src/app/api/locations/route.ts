import { NextRequest, NextResponse } from 'next/server';

const MEXICAN_STATES = [
    { id: 'AGS', name: 'Aguascalientes' },
    { id: 'BCN', name: 'Baja California' },
    { id: 'BCS', name: 'Baja California Sur' },
    { id: 'CAM', name: 'Campeche' },
    { id: 'CHP', name: 'Chiapas' },
    { id: 'CHH', name: 'Chihuahua' },
    { id: 'CMX', name: 'Ciudad de México' },
    { id: 'COA', name: 'Coahuila' },
    { id: 'COL', name: 'Colima' },
    { id: 'DUR', name: 'Durango' },
    { id: 'GUA', name: 'Guanajuato' },
    { id: 'GRO', name: 'Guerrero' },
    { id: 'HID', name: 'Hidalgo' },
    { id: 'JAL', name: 'Jalisco' },
    { id: 'MEX', name: 'Estado de México' },
    { id: 'MIC', name: 'Michoacán' },
    { id: 'MOR', name: 'Morelos' },
    { id: 'NAY', name: 'Nayarit' },
    { id: 'NLE', name: 'Nuevo León' },
    { id: 'OAX', name: 'Oaxaca' },
    { id: 'PUE', name: 'Puebla' },
    { id: 'QUE', name: 'Querétaro' },
    { id: 'ROO', name: 'Quintana Roo' },
    { id: 'SLP', name: 'San Luis Potosí' },
    { id: 'SIN', name: 'Sinaloa' },
    { id: 'SON', name: 'Sonora' },
    { id: 'TAB', name: 'Tabasco' },
    { id: 'TAM', name: 'Tamaulipas' },
    { id: 'TLA', name: 'Tlaxcala' },
    { id: 'VER', name: 'Veracruz' },
    { id: 'YUC', name: 'Yucatán' },
    { id: 'ZAC', name: 'Zacatecas' }
];

// Simplified mapping of some municipalities for each state
const MUNICIPALITIES: Record<string, string[]> = {
    'AGS': ['Aguascalientes', 'Asientos', 'Calvillo', 'Cosío', 'Jesús María', 'Pabellón de Arteaga', 'Rincón de Romos', 'San José de Gracia', 'Tepezalá', 'El Llano', 'San Francisco de los Romo'],
    'BCN': ['Ensenada', 'Mexicali', 'Playas de Rosarito', 'Tecate', 'Tijuana'],
    'NLE': ['Monterrey', 'Guadalupe', 'San Nicolás de los Garza', 'San Pedro Garza García', 'Santa Catarina', 'Apodaca', 'Escobedo', 'Juárez', 'García'],
    'JAL': ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco de Zúñiga', 'Puerto Vallarta'],
    'CMX': ['Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa de Morelos', 'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'],
    'MEX': ['Toluca', 'Naucalpan', 'Tlalnepantla', 'Ecatepec', 'Nezahualcóyotl', 'Metepec', 'Huixquilucan'],
    'QUE': ['Querétaro', 'Corregidora', 'El Marqués', 'San Juan del Río'],
    'YUC': ['Mérida', 'Progreso', 'Tizimín', 'Valladolid'],
    // Adding more defaults for other states to not return empty
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const stateId = searchParams.get('stateId');

    if (stateId) {
        const list = MUNICIPALITIES[stateId] || ['Municipio Genérico 1', 'Municipio Genérico 2']; // Fallback for demo
        return NextResponse.json(list);
    }

    return NextResponse.json(MEXICAN_STATES);
}
