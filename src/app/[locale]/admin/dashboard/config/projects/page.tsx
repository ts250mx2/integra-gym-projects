'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Building2, Settings2, Search, BellRing } from 'lucide-react';
import { getCountries, getCountryCallingCode } from 'react-phone-number-input';
import { languages } from '@/i18n/locales';
import Select, { components, SingleValueProps, OptionProps } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import ProjectAlertsModal from '@/components/admin/ProjectAlertsModal';

const getFlagUrl = (countryCode: string) => `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`;
const countryCodes = getCountries();
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

const countries = countryCodes.map(code => ({
    value: code,
    label: regionNames.of(code) || code,
    flagUrl: getFlagUrl(code)
})).sort((a, b) => a.label.localeCompare(b.label));

const dialCodes = countryCodes.map(code => {
    try {
        const callingCode = getCountryCallingCode(code);
        return {
            value: `+${callingCode}`,
            code: code,
            label: `+${callingCode} (${code})`,
            flagUrl: getFlagUrl(code)
        };
    } catch (e) {
        return null;
    }
}).filter((x): x is any => x !== null)
  .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));

const selectStyles = {
    control: (base: any) => ({ ...base, background: 'rgba(26, 26, 26, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', padding: '2px', borderRadius: '8px', boxShadow: 'none', '&:hover': { borderColor: 'var(--neon-blue)' } }),
    menu: (base: any) => ({ ...base, background: '#1a1a1a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', zIndex: 100 }),
    option: (base: any, state: any) => ({ ...base, background: state.isFocused ? 'rgba(0, 243, 255, 0.1)' : 'transparent', color: state.isSelected ? 'var(--neon-blue)' : 'white', '&:active': { background: 'rgba(0, 243, 255, 0.2)' } }),
    singleValue: (base: any) => ({ ...base, color: 'white' }),
    input: (base: any) => ({ ...base, color: 'white' })
};

const CustomOption = (props: OptionProps<any>) => (<components.Option {...props}> <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> <img src={props.data.flagUrl} alt={props.data.label} style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }} /> {props.data.label} </div> </components.Option>);
const CustomSingleValue = (props: SingleValueProps<any>) => (<components.SingleValue {...props}> <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> <img src={props.data.flagUrl} alt={props.data.label} style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }} /> {props.data.label} </div> </components.SingleValue>);

const customDialOption = (props: OptionProps<any>) => (
    <components.Option {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={props.data.flagUrl} alt={props.data.code} style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '1px' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{props.data.value}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>({props.data.code})</span>
        </div>
    </components.Option>
);

const customDialSingleValue = (props: SingleValueProps<any>) => (
    <components.SingleValue {...props}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src={props.data.flagUrl} alt={props.data.code} style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '1px' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{props.data.value}</span>
        </div>
    </components.SingleValue>
);

interface Project {
    IdProyecto: number;
    Proyecto: string;
    BaseDatos: string;
    DominioIM: string;
    Servidor?: string;
    UsuarioBD?: string;
    PasswordBD?: string;
    Version?: string;
    Idioma?: string;
    Pais?: string;
    Status: number;
}

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [dbVersions, setDbVersions] = useState<{ Version: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        Proyecto: '',
        BaseDatos: '',
        DominioIM: '',
        Servidor: '',
        UsuarioBD: '',
        PasswordBD: '',
        Version: '',
        Idioma: 'es',
        Pais: 'MX'
    });

    // Alerts Modal State
    const [alertsProject, setAlertsProject] = useState<Project | null>(null);

    // Parameters Modal State
    const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [projectParams, setProjectParams] = useState<any[]>([]);
    const [paramsLoading, setParamsLoading] = useState(false);
    const [paramFormData, setParamFormData] = useState({
        Grupo: '',
        Campo: '',
        Valor: '',
        IdParametro: null as number | null
    });

    const languageOptions = languages.map(l => ({ value: l.code, label: l.name }));

    // Tab switching state
    const [activeTab, setActiveTab] = useState<'general' | 'phones'>('general');

    // Phones access state
    const [selectedDialCode, setSelectedDialCode] = useState('+52');
    const [phonesList, setPhonesList] = useState<any[]>([]);
    const [phonesLoading, setPhonesLoading] = useState(false);
    const [phoneFormData, setPhoneFormData] = useState({
        IdProyectoTelefono: null as number | null,
        Telefono: '',
        Nombre: '',
        EsAdministrador: false
    });

    const resetPhoneForm = () => {
        setSelectedDialCode('+52');
        setPhoneFormData({
            IdProyectoTelefono: null,
            Telefono: '',
            Nombre: '',
            EsAdministrador: false
        });
    };

    const parseSavedPhone = (savedPhone: string) => {
        const clean = (savedPhone || '').trim();
        if (clean.startsWith('+')) {
            const sortedCodes = [...dialCodes].sort((a, b) => b.value.length - a.value.length);
            for (const item of sortedCodes) {
                if (clean.startsWith(item.value)) {
                    return {
                        dialCode: item.value,
                        localPhone: clean.slice(item.value.length)
                    };
                }
            }
        }
        return {
            dialCode: '+52',
            localPhone: clean
        };
    };

    const fetchPhones = async (idProyecto: number) => {
        setPhonesLoading(true);
        try {
            const res = await fetch(`/api/admin/projects/phones?idProyecto=${idProyecto}`);
            if (res.ok) {
                const data = await res.json();
                setPhonesList(data);
            }
        } catch (error) {
            console.error('Error fetching phones:', error);
        } finally {
            setPhonesLoading(false);
        }
    };

    const lookupPhone = async (phone: string) => {
        const cleanPhone = phone.trim();
        if (cleanPhone.length < 8) return;

        const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `${selectedDialCode}${cleanPhone}`;

        try {
            const res = await fetch(`/api/admin/projects/phones?phone=${encodeURIComponent(fullPhone)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.found && data.Nombre) {
                    setPhoneFormData(prev => ({ ...prev, Nombre: data.Nombre }));
                }
            }
        } catch (error) {
            console.error('Error looking up phone:', error);
        }
    };

    const handleSavePhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;

        const cleanPhone = phoneFormData.Telefono.trim();
        const fullPhone = cleanPhone.startsWith('+') ? cleanPhone : `${selectedDialCode}${cleanPhone}`;

        try {
            const payload = {
                IdProyecto: editingId,
                ...phoneFormData,
                Telefono: fullPhone
            };

            const res = await fetch('/api/admin/projects/phones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchPhones(editingId);
                resetPhoneForm();
            } else {
                const errData = await res.json();
                alert(errData.message || 'Error al guardar el teléfono');
            }
        } catch (error) {
            console.error('Error saving phone:', error);
        }
    };

    const handleDeletePhone = async (idProyectoTelefono: number) => {
        if (!confirm('¿Estás seguro de que deseas retirar el acceso a este teléfono?')) return;

        try {
            const res = await fetch(`/api/admin/projects/phones?id=${idProyectoTelefono}`, {
                method: 'DELETE'
            });

            if (res.ok && editingId) {
                fetchPhones(editingId);
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error('Error deleting phone:', error);
        }
    };

    const handleEditPhone = (phone: any) => {
        const { dialCode, localPhone } = parseSavedPhone(phone.Telefono || '');
        setSelectedDialCode(dialCode);
        setPhoneFormData({
            IdProyectoTelefono: phone.IdProyectoTelefono,
            Telefono: localPhone,
            Nombre: phone.Nombre || '',
            EsAdministrador: phone.EsAdministrador === 1
        });
    };

    useEffect(() => {
        fetchProjects();
        fetchVersions();
    }, []);

    useEffect(() => {
        if (!editingId && formData.Version === '2.0' && isModalOpen) {
            const cleanProjectName = formData.Proyecto.replace(/\s+/g, '');
            const expectedBaseDatos = formData.Proyecto ? `IM_${formData.Proyecto.replace(/\s+/g, '_')}` : '';

            if (
                formData.BaseDatos !== expectedBaseDatos ||
                formData.DominioIM !== cleanProjectName ||
                formData.Servidor !== '74.208.192.90' ||
                formData.UsuarioBD !== 'kyk' ||
                formData.PasswordBD !== 'merkurio'
            ) {
                setFormData(prev => ({
                    ...prev,
                    BaseDatos: expectedBaseDatos,
                    DominioIM: cleanProjectName,
                    Servidor: '74.208.192.90',
                    UsuarioBD: 'kyk',
                    PasswordBD: 'merkurio'
                }));
            }
        }
    }, [formData.Proyecto, formData.Version, editingId, isModalOpen, formData.BaseDatos, formData.DominioIM, formData.Servidor, formData.UsuarioBD, formData.PasswordBD]);

    const fetchVersions = async () => {
        try {
            const res = await fetch('/api/admin/versions');
            if (res.ok) {
                const data = await res.json();
                setDbVersions(data);
            }
        } catch (error) {
            console.error('Error fetching versions:', error);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/admin/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (project?: Project) => {
        setActiveTab('general');
        resetPhoneForm();
        if (project) {
            setEditingId(project.IdProyecto);
            setFormData({
                Proyecto: project.Proyecto || '',
                BaseDatos: project.BaseDatos || '',
                DominioIM: project.DominioIM || '',
                Servidor: project.Servidor || '',
                UsuarioBD: project.UsuarioBD || '',
                PasswordBD: project.PasswordBD || '',
                Version: project.Version || '',
                Idioma: project.Idioma || 'es',
                Pais: project.Pais || 'MX'
            });
        } else {
            setEditingId(null);
            setFormData({
                Proyecto: '',
                BaseDatos: '',
                DominioIM: '',
                Servidor: '',
                UsuarioBD: '',
                PasswordBD: '',
                Version: '',
                Idioma: 'es',
                Pais: 'MX'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setActiveTab('general');
        resetPhoneForm();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingId ? 'PUT' : 'POST';
            const payload = editingId ? { ...formData, IdProyecto: editingId } : formData;

            const res = await fetch('/api/admin/projects', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchProjects();
                handleCloseModal();
            } else {
                alert('Error al guardar el proyecto');
            }
        } catch (error) {
            console.error('Error saving project:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este proyecto?')) return;

        try {
            const res = await fetch(`/api/admin/projects?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchProjects();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    // Parameters Logic
    const fetchParams = async (idProyecto: number) => {
        setParamsLoading(true);
        try {
            const res = await fetch(`/api/admin/projects/parameters?idProyecto=${idProyecto}`);
            if (res.ok) {
                const data = await res.json();
                setProjectParams(data);
            }
        } catch (error) {
            console.error('Error fetching params:', error);
        } finally {
            setParamsLoading(false);
        }
    };

    const handleOpenParams = (project: Project) => {
        setSelectedProject(project);
        setProjectParams([]);
        setParamFormData({ Grupo: '', Campo: '', Valor: '', IdParametro: null });
        setIsParamsModalOpen(true);
        fetchParams(project.IdProyecto);
    };

    const handleSaveParam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject) return;

        try {
            const res = await fetch('/api/admin/projects/parameters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdProyecto: selectedProject.IdProyecto,
                    ...paramFormData
                })
            });

            if (res.ok) {
                fetchParams(selectedProject.IdProyecto);
                setParamFormData({ Grupo: paramFormData.Grupo, Campo: '', Valor: '', IdParametro: null });
            } else {
                const errorData = await res.json();
                alert(errorData.message || 'Error al guardar el parámetro');
            }
        } catch (error) {
            console.error('Error saving param:', error);
        }
    };

    const handleDeleteParam = async (id: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este parámetro?')) return;
        try {
            const res = await fetch(`/api/admin/projects/parameters?id=${id}`, { method: 'DELETE' });
            if (res.ok && selectedProject) {
                fetchParams(selectedProject.IdProyecto);
            }
        } catch (error) {
            console.error('Error deleting param:', error);
        }
    };

    const handleEditParam = (param: any) => {
        setParamFormData({
            Grupo: param.Grupo,
            Campo: param.Campo,
            Valor: param.Valor,
            IdParametro: param.IdParametro
        });
    };

    // Filter projects based on searchQuery (Proyecto, BaseDatos, Servidor)
    const filteredProjects = projects.filter(project => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            (project.Proyecto || '').toLowerCase().includes(query) ||
            (project.BaseDatos || '').toLowerCase().includes(query) ||
            (project.Servidor || '').toLowerCase().includes(query)
        );
    });

    const thStyle: React.CSSProperties = {
        position: 'sticky',
        top: 0,
        backgroundColor: '#161616',
        zIndex: 10,
        padding: '0.75rem 0.8rem',
        textAlign: 'left',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: '0 1px 0 0 var(--glass-border)'
    };

    return (
        <div style={{ padding: '0.25rem 0' }}>
            {/* Page Header with Integrated Search and Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-container" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.6rem', borderRadius: '10px' }}>
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.35rem', fontWeight: 'bold', lineHeight: '1.2' }}>Proyectos</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Administración global y bases de datos</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1', justifyContent: 'flex-end', maxWidth: '650px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar proyecto, base de datos o servidor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field"
                            style={{ marginTop: 0, paddingLeft: '36px', paddingRight: '36px', background: 'rgba(26, 26, 26, 0.6)', borderColor: 'rgba(255, 255, 255, 0.1)', height: '38px', fontSize: '0.85rem', borderRadius: '6px' }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1.25rem', fontSize: '0.85rem', borderRadius: '6px' }}>
                        <Plus size={16} /> Nuevo Proyecto
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', position: 'relative' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ ...thStyle, width: '60px' }}>ID</th>
                                <th style={thStyle}>Proyecto</th>
                                <th style={thStyle}>Base de Datos</th>
                                <th style={thStyle}>Servidor</th>
                                <th style={{ ...thStyle, width: '110px' }}>Versión</th>
                                <th style={{ ...thStyle, textAlign: 'right', width: '150px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {projects.length === 0 ? 'No hay proyectos registrados.' : 'No se encontraron proyectos para tu búsqueda.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProjects.map((project) => (
                                    <tr key={project.IdProyecto} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}>{project.IdProyecto}</td>
                                        <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontWeight: 500 }}>{project.Proyecto}</td>
                                        <td style={{ padding: '0.6rem 0.8rem' }}>
                                            <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {project.BaseDatos}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{project.Servidor || '-'}</td>
                                        <td style={{ padding: '0.6rem 0.8rem' }}>
                                            <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {project.Version || 'Sin versión'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => setAlertsProject(project)}
                                                    className="btn-action-blue"
                                                    title="Configurar Alertas"
                                                >
                                                    <BellRing size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenParams(project)}
                                                    className="btn-action-green"
                                                    title="Configurar Parámetros"
                                                >
                                                    <Settings2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(project)}
                                                    className="btn-action-blue"
                                                    title="Editar Proyecto"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(project.IdProyecto)}
                                                    className="btn-action-red"
                                                    title="Eliminar Proyecto"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer showing total records */}
                <div style={{ 
                    padding: '1rem', 
                    borderTop: '1px solid var(--glass-border)', 
                    background: 'rgba(0,0,0,0.2)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                }}>
                    <div>
                        {searchQuery.trim() ? (
                            <span>Mostrando <strong>{filteredProjects.length}</strong> de <strong>{projects.length}</strong> proyectos filtrados</span>
                        ) : (
                            <span>Total: <strong>{projects.length}</strong> proyectos registrados</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '800px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                            </h2>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Tabs Selector */}
                        {editingId && (
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.75rem', gap: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('general')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === 'general' ? '2px solid var(--neon-blue)' : '2px solid transparent',
                                        color: activeTab === 'general' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                                        padding: '0.5rem 1rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s ease',
                                        textShadow: activeTab === 'general' ? '0 0 8px rgba(0, 243, 255, 0.3)' : 'none'
                                    }}
                                >
                                    Datos Generales
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('phones');
                                        fetchPhones(editingId);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === 'phones' ? '2px solid var(--neon-blue)' : '2px solid transparent',
                                        color: activeTab === 'phones' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                                        padding: '0.5rem 1rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s ease',
                                        textShadow: activeTab === 'phones' ? '0 0 8px rgba(0, 243, 255, 0.3)' : 'none'
                                    }}
                                >
                                    Teléfonos con Acceso
                                </button>
                            </div>
                        )}

                        {/* Tab 1: Datos Generales */}
                        {(activeTab === 'general' || !editingId) && (
                            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nombre del Proyecto *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.Proyecto}
                                            onChange={(e) => setFormData({ ...formData, Proyecto: e.target.value })}
                                            required
                                            placeholder="Ej: Gym Power"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Versión del Proyecto *</label>
                                        <select
                                            className="input-field"
                                            value={formData.Version}
                                            onChange={(e) => setFormData({ ...formData, Version: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecciona una versión</option>
                                            {dbVersions.map((v, i) => (
                                                <option key={i} value={v.Version}>{v.Version}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>País *</label>
                                        <Select
                                            options={countries}
                                            styles={selectStyles}
                                            components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
                                            value={countries.find(c => c.value === formData.Pais)}
                                            onChange={(opt: any) => setFormData({ ...formData, Pais: opt?.value || 'MX' })}
                                            placeholder="Selecciona país"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Idioma *</label>
                                        <Select
                                            options={languageOptions}
                                            styles={selectStyles}
                                            value={languageOptions.find(l => l.value === formData.Idioma)}
                                            onChange={(opt: any) => setFormData({ ...formData, Idioma: opt?.value || 'es' })}
                                            placeholder="Selecciona idioma"
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Base de Datos *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.BaseDatos}
                                            onChange={(e) => setFormData({ ...formData, BaseDatos: e.target.value })}
                                            required
                                            disabled={!editingId && formData.Version === '2.0'}
                                            style={!editingId && formData.Version === '2.0' ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                                            placeholder="Ej: BDGymPower"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                            {formData.Version === '2.0' ? 'Dominio IM *' : 'Dominio IM (Opcional)'}
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.DominioIM}
                                            onChange={(e) => setFormData({ ...formData, DominioIM: e.target.value })}
                                            required={formData.Version === '2.0'}
                                            placeholder="Ej: gympower"
                                        />
                                        <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                            Prefijo para login tipo usuario@gympower.im
                                        </small>
                                    </div>
                                </div>

                                <hr style={{ borderColor: 'var(--glass-border)', margin: '0.5rem 0' }} />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Servidor (Host) *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.Servidor}
                                            onChange={(e) => setFormData({ ...formData, Servidor: e.target.value })}
                                            required
                                            placeholder="Ej: 127.0.0.1 o localhost"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Usuario de BD *</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.UsuarioBD}
                                            onChange={(e) => setFormData({ ...formData, UsuarioBD: e.target.value })}
                                            required
                                            placeholder="Ej: root"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contraseña de BD *</label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            value={formData.PasswordBD}
                                            onChange={(e) => setFormData({ ...formData, PasswordBD: e.target.value })}
                                            required
                                            placeholder="············"
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" className="btn-secondary" onClick={handleCloseModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <X size={18} /> Cancelar
                                    </button>
                                    <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Save size={18} /> Guardar
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Tab 2: Teléfonos con Acceso */}
                        {activeTab === 'phones' && editingId && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Phone Add/Edit Sub-Form */}
                                <form onSubmit={handleSavePhone} className="glass-card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--neon-blue)' }}>
                                        {phoneFormData.IdProyectoTelefono ? 'Editar Teléfono de Acceso' : 'Agregar Teléfono de Acceso'}
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div>
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Teléfono *</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
                                                <div style={{ width: '125px' }}>
                                                    <Select
                                                        options={dialCodes}
                                                        styles={selectStyles}
                                                        components={{ Option: customDialOption, SingleValue: customDialSingleValue }}
                                                        value={dialCodes.find(d => d.value === selectedDialCode)}
                                                        onChange={(opt: any) => setSelectedDialCode(opt?.value || '+52')}
                                                        placeholder="Lada"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={phoneFormData.Telefono}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPhoneFormData(prev => ({ ...prev, Telefono: val }));
                                                        if (val.length >= 10) {
                                                            lookupPhone(val);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        lookupPhone(phoneFormData.Telefono);
                                                    }}
                                                    required
                                                    placeholder="Ej: 5512345678"
                                                    style={{ marginTop: 0, height: '38px', fontSize: '0.85rem', flex: 1 }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nombre del Titular *</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={phoneFormData.Nombre}
                                                onChange={(e) => setPhoneFormData({ ...phoneFormData, Nombre: e.target.value })}
                                                required
                                                placeholder="Ej: Juan Pérez"
                                                style={{ marginTop: '0.4rem', height: '36px', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '42px', height: '22px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={phoneFormData.EsAdministrador}
                                                    onChange={(e) => setPhoneFormData({ ...phoneFormData, EsAdministrador: e.target.checked })}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span style={{
                                                    position: 'absolute',
                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: phoneFormData.EsAdministrador ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                    border: phoneFormData.EsAdministrador ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                                                    borderRadius: '22px',
                                                    transition: '0.3s ease',
                                                    boxShadow: phoneFormData.EsAdministrador ? '0 0 8px rgba(0, 243, 255, 0.4)' : 'none'
                                                }}>
                                                    <span style={{
                                                        position: 'absolute',
                                                        height: '14px', width: '14px',
                                                        left: phoneFormData.EsAdministrador ? '22px' : '4px',
                                                        bottom: '3px',
                                                        backgroundColor: phoneFormData.EsAdministrador ? 'var(--neon-blue)' : 'var(--light-gray)',
                                                        borderRadius: '50%',
                                                        transition: '0.3s ease'
                                                    }} />
                                                </span>
                                            </label>
                                            <span style={{ fontSize: '0.825rem', fontWeight: 500, color: phoneFormData.EsAdministrador ? 'var(--neon-blue)' : 'var(--text-secondary)' }}>
                                                ¿Es Administrador del Proyecto?
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {phoneFormData.IdProyectoTelefono && (
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={resetPhoneForm}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.75rem', fontSize: '0.8rem', height: '32px', borderRadius: '6px' }}
                                                >
                                                    <X size={14} /> Cancelar
                                                </button>
                                            )}
                                            <button
                                                type="submit"
                                                className="btn-primary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 1rem', fontSize: '0.8rem', height: '32px', borderRadius: '6px' }}
                                            >
                                                <Save size={14} /> {phoneFormData.IdProyectoTelefono ? 'Guardar Cambios' : 'Agregar Teléfono'}
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                {/* Phones List Grid */}
                                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '12px' }}>
                                    <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--glass-border)' }}>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 600 }}>Teléfono</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 600 }}>Nombre del Titular</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', width: '120px', fontWeight: 600 }}>Administrador</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', width: '100px', fontWeight: 600 }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {phonesLoading ? (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            Cargando teléfonos...
                                                        </td>
                                                    </tr>
                                                ) : phonesList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            No hay teléfonos asociados a este proyecto.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    phonesList.map((p) => (
                                                        <tr key={p.IdProyectoTelefono} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{p.Telefono}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: 500 }}>{p.Nombre}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                                {p.EsAdministrador === 1 ? (
                                                                    <span style={{ background: 'rgba(0, 243, 255, 0.1)', color: 'var(--neon-blue)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 600, border: '1px solid rgba(0, 243, 255, 0.2)' }}>
                                                                        SÍ
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--light-gray)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 500 }}>
                                                                        NO
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditPhone(p)}
                                                                        className="btn-action-blue"
                                                                        style={{ padding: '0.35rem', borderRadius: '6px' }}
                                                                        title="Editar"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeletePhone(p.IdProyectoTelefono)}
                                                                        className="btn-action-red"
                                                                        style={{ padding: '0.35rem', borderRadius: '6px' }}
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Parameters Modal */}
            {isParamsModalOpen && selectedProject && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1001
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Parámetros: {selectedProject.Proyecto}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Configuración personalizada del proyecto</p>
                            </div>
                            <button onClick={() => setIsParamsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveParam} className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Grupo *</label>
                                    <CreatableSelect
                                        isClearable
                                        options={Array.from(new Set(projectParams.map(p => p.Grupo))).map(g => ({ value: g, label: g }))}
                                        styles={selectStyles}
                                        value={paramFormData.Grupo ? { value: paramFormData.Grupo, label: paramFormData.Grupo } : null}
                                        onChange={(opt: any) => setParamFormData({ ...paramFormData, Grupo: opt?.value || '' })}
                                        placeholder="Selecciona o escribe..."
                                        formatCreateLabel={(inputValue) => `Crear grupo "${inputValue}"`}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Campo *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={paramFormData.Campo}
                                        onChange={(e) => setParamFormData({ ...paramFormData, Campo: e.target.value })}
                                        required
                                        placeholder="Ej: MaxUsers"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Valor</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={paramFormData.Valor}
                                        onChange={(e) => setParamFormData({ ...paramFormData, Valor: e.target.value })}
                                        placeholder="Ej: 100"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="submit" className="btn-primary" style={{ padding: '0.75rem' }}>
                                        {paramFormData.IdParametro ? <Save size={18} /> : <Plus size={18} />}
                                    </button>
                                    {paramFormData.IdParametro && (
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{ padding: '0.75rem' }}
                                            onClick={() => setParamFormData({ Grupo: '', Campo: '', Valor: '', IdParametro: null })}
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Grupo</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Campo</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Valor</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paramsLoading ? (
                                        <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}>Cargando parámetros...</td></tr>
                                    ) : projectParams.length === 0 ? (
                                        <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin parámetros registrados</td></tr>
                                    ) : (
                                        projectParams.map((param) => (
                                            <tr key={param.IdParametro} style={{ borderBottom: '1px solid var(--glass-border)', background: param.IdParametro === paramFormData.IdParametro ? 'rgba(0, 243, 255, 0.05)' : 'transparent' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                                                        {param.Grupo}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', fontWeight: 500 }}>{param.Campo}</td>
                                                <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {param.Valor || '-'}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => handleEditParam(param)} className="btn-secondary" style={{ padding: '0.4rem' }}><Edit2 size={14} /></button>
                                                        <button onClick={() => handleDeleteParam(param.IdParametro)} className="btn-danger" style={{ padding: '0.4rem' }}><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts Modal */}
            {alertsProject && (
                <ProjectAlertsModal
                    project={alertsProject}
                    onClose={() => setAlertsProject(null)}
                />
            )}
        </div>
    );
}
