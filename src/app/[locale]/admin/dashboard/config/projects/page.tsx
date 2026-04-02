'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Building2, Settings2, Search } from 'lucide-react';
import { getCountries } from 'react-phone-number-input';
import { languages } from '@/i18n/locales';
import Select, { components, SingleValueProps, OptionProps } from 'react-select';
import CreatableSelect from 'react-select/creatable';

const getFlagUrl = (countryCode: string) => `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`;
const countryCodes = getCountries();
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

const countries = countryCodes.map(code => ({
    value: code,
    label: regionNames.of(code) || code,
    flagUrl: getFlagUrl(code)
})).sort((a, b) => a.label.localeCompare(b.label));

const selectStyles = {
    control: (base: any) => ({ ...base, background: 'rgba(26, 26, 26, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', padding: '2px', borderRadius: '8px', boxShadow: 'none', '&:hover': { borderColor: 'var(--neon-blue)' } }),
    menu: (base: any) => ({ ...base, background: '#1a1a1a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', zIndex: 100 }),
    option: (base: any, state: any) => ({ ...base, background: state.isFocused ? 'rgba(0, 243, 255, 0.1)' : 'transparent', color: state.isSelected ? 'var(--neon-blue)' : 'white', '&:active': { background: 'rgba(0, 243, 255, 0.2)' } }),
    singleValue: (base: any) => ({ ...base, color: 'white' }),
    input: (base: any) => ({ ...base, color: 'white' })
};

const CustomOption = (props: OptionProps<any>) => (<components.Option {...props}> <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> <img src={props.data.flagUrl} alt={props.data.label} style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }} /> {props.data.label} </div> </components.Option>);
const CustomSingleValue = (props: SingleValueProps<any>) => (<components.SingleValue {...props}> <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> <img src={props.data.flagUrl} alt={props.data.label} style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }} /> {props.data.label} </div> </components.SingleValue>);

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

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="icon-container" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.75rem', borderRadius: '12px' }}>
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Proyectos</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Administración global de proyectos y bases de datos</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} /> Nuevo Proyecto
                </button>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Proyecto</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Base de Datos</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Servidor</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Versión</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Dominio IM</th>
                                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : projects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No hay proyectos registrados.
                                    </td>
                                </tr>
                            ) : (
                                projects.map((project) => (
                                    <tr key={project.IdProyecto} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '1rem' }}>{project.IdProyecto}</td>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>{project.Proyecto}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                {project.BaseDatos}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{project.Servidor || '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {project.Version || 'Sin versión'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{project.DominioIM || '-'}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleOpenParams(project)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.5rem', color: 'var(--neon-green)' }}
                                                    title="Parámetros"
                                                >
                                                    <Settings2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(project)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.5rem' }}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(project.IdProyecto)}
                                                    className="btn-danger"
                                                    style={{ padding: '0.5rem' }}
                                                    title="Eliminar"
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
                    <div className="glass-card" style={{ width: '100%', maxWidth: '800px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                            </h2>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

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
        </div>
    );
}
