'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Users, Building2, Search } from 'lucide-react';

interface ProjectInfo {
    IdProyecto: number;
    Proyecto: string;
}

interface User {
    IdUsuario: number;
    Usuario: string;
    CorreoElectronico: string;
    Telefono: string;
    Status: number;
    EsAdmin: number;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        Usuario: '',
        CorreoElectronico: '',
        Telefono: '',
        passwd: '',
        EsAdmin: 0
    });

    // States for Project Assignments
    const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
    const [assignedProjectIds, setAssignedProjectIds] = useState<Set<number>>(new Set());
    const [savingProjects, setSavingProjects] = useState(false);
    const [projectSearchTerm, setProjectSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
        fetchAllProjects();
    }, []);

    const fetchAllProjects = async () => {
        try {
            const res = await fetch('/api/admin/projects');
            if (res.ok) {
                const data = await res.json();
                setAllProjects(data);
            }
        } catch (error) {
            console.error('Error fetching all projects:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user?: User) => {
        if (user) {
            setEditingId(user.IdUsuario);
            setFormData({
                Usuario: user.Usuario || '',
                CorreoElectronico: user.CorreoElectronico || '',
                Telefono: user.Telefono || '',
                passwd: '', // Don't populate password for security, leave blank to not update
                EsAdmin: user.EsAdmin || 1
            });
        } else {
            setEditingId(null);
            setFormData({
                Usuario: '',
                CorreoElectronico: '',
                Telefono: '',
                passwd: '',
                EsAdmin: 0
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

            // If editing and password is blank, don't send it to preserve current
            const payload = editingId ? { ...formData, IdUsuario: editingId } : formData;
            if (editingId && !payload.passwd) {
                delete (payload as any).passwd;
            }

            const res = await fetch('/api/admin/users', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchUsers();
                handleCloseModal();
            } else {
                alert('Error al guardar el usuario');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este administrador?')) return;

        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleOpenProjectsModal = async (userId: number) => {
        setSelectedUserId(userId);
        setIsProjectsModalOpen(true);
        setAssignedProjectIds(new Set()); // Reset while loading
        setProjectSearchTerm('');

        try {
            const res = await fetch(`/api/admin/users/projects?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                const ids = new Set<number>(data.map((p: any) => p.IdProyecto));
                setAssignedProjectIds(ids);
            }
        } catch (error) {
            console.error('Error fetching user projects:', error);
        }
    };

    const handleCloseProjectsModal = () => {
        setIsProjectsModalOpen(false);
        setSelectedUserId(null);
    };

    const handleToggleProject = (projectId: number) => {
        setAssignedProjectIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    const handleSaveProjects = async () => {
        if (!selectedUserId) return;
        setSavingProjects(true);

        try {
            const res = await fetch('/api/admin/users/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdUsuario: selectedUserId,
                    projectIds: Array.from(assignedProjectIds)
                })
            });

            if (res.ok) {
                handleCloseProjectsModal();
            } else {
                alert('Error al guardar asignaciones');
            }
        } catch (error) {
            console.error('Error saving projects:', error);
        } finally {
            setSavingProjects(false);
        }
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="icon-container" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--neon-blue)', padding: '0.75rem', borderRadius: '12px' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Usuarios Administradores</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Administración de cuentas con acceso global (EsAdmin = 1 o 2)</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} /> Nuevo Administrador
                </button>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Usuario</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Correo</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Teléfono</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Nivel Admin</th>
                                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No hay usuarios registrados.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.IdUsuario} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '1rem' }}>{user.IdUsuario}</td>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--neon-blue)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                                    {user.Usuario.substring(0, 2).toUpperCase()}
                                                </div>
                                                {user.Usuario}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{user.CorreoElectronico}</td>
                                        <td style={{ padding: '1rem' }}>{user.Telefono || '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                background: user.EsAdmin === 2 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                                color: user.EsAdmin === 2 ? '#c084fc' : '#38bdf8',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                Nivel {user.EsAdmin}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleOpenProjectsModal(user.IdUsuario)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.5rem' }}
                                                    title="Asignar Proyectos"
                                                >
                                                    <Building2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.5rem' }}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.IdUsuario !== 1 && (
                                                    <button
                                                        onClick={() => handleDelete(user.IdUsuario)}
                                                        className="btn-danger"
                                                        style={{ padding: '0.5rem' }}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
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
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {editingId ? 'Editar Administrador' : 'Nuevo Administrador'}
                            </h2>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.Usuario}
                                    onChange={(e) => setFormData({ ...formData, Usuario: e.target.value })}
                                    required
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Correo Electrónico *</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={formData.CorreoElectronico}
                                    onChange={(e) => setFormData({ ...formData, CorreoElectronico: e.target.value })}
                                    required
                                    placeholder="usuario@dominio.com"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Teléfono</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.Telefono}
                                    onChange={(e) => setFormData({ ...formData, Telefono: e.target.value })}
                                    placeholder="Ej: +52 123 456 7890"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Contraseña {editingId && '(Dejar en blanco para no cambiar)'} {!editingId && '*'}
                                </label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={formData.passwd}
                                    onChange={(e) => setFormData({ ...formData, passwd: e.target.value })}
                                    required={!editingId}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nivel de Administrador</label>
                                <select
                                    className="input-field"
                                    value={formData.EsAdmin}
                                    onChange={(e) => setFormData({ ...formData, EsAdmin: parseInt(e.target.value) })}
                                >
                                    <option value={0}>0 - Super admin de proyecto</option>
                                    <option value={1}>1 - Administrador de Proyectos</option>
                                </select>
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

            {/* Projects Assignment Modal */}
            {isProjectsModalOpen && (
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
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Building2 size={24} className="neon-text" />
                                Asignar Proyectos
                            </h2>
                            <button onClick={handleCloseProjectsModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '1rem', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar proyecto..."
                                className="input-field"
                                style={{ paddingLeft: '2.5rem', margin: 0 }}
                                value={projectSearchTerm}
                                onChange={(e) => setProjectSearchTerm(e.target.value)}
                            />
                        </div>

                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                            {allProjects.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                                    No hay proyectos disponibles en el sistema.
                                </p>
                            ) : (() => {
                                const filteredProjects = allProjects.filter(p => p.Proyecto.toLowerCase().includes(projectSearchTerm.toLowerCase()));
                                if (filteredProjects.length === 0) {
                                    return (
                                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                                            No se encontraron proyectos.
                                        </p>
                                    );
                                }
                                return filteredProjects.map(project => (
                                    <label
                                        key={project.IdProyecto}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '1rem',
                                            background: assignedProjectIds.has(project.IdProyecto) ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${assignedProjectIds.has(project.IdProyecto) ? 'var(--neon-blue)' : 'var(--glass-border)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={assignedProjectIds.has(project.IdProyecto)}
                                            onChange={() => handleToggleProject(project.IdProyecto)}
                                            style={{
                                                marginRight: '1rem',
                                                transform: 'scale(1.2)',
                                                accentColor: 'var(--neon-blue)',
                                                cursor: 'pointer'
                                            }}
                                        />
                                        <span style={{
                                            fontWeight: 500,
                                            color: assignedProjectIds.has(project.IdProyecto) ? '#fff' : 'var(--text-secondary)'
                                        }}>
                                            {project.Proyecto}
                                        </span>
                                    </label>
                                ));
                            })()}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleCloseProjectsModal}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                disabled={savingProjects}
                            >
                                <X size={18} /> Cancelar
                            </button>
                            <button
                                onClick={handleSaveProjects}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                disabled={savingProjects}
                            >
                                <Save size={18} /> {savingProjects ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
