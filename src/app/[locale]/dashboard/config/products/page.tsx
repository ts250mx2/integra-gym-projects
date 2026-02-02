'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, Trash2, Package, Search, ChevronUp, ChevronDown } from 'lucide-react';
import ProductModal from '@/components/ProductModal';

interface Product {
    IdCuota: number;
    CodigoBarras: string;
    Cuota: string;
    Precio: number;
    IVA: number;
    // Index signature for sorting
    [key: string]: any;
}

export default function ProductsPage() {
    const tCommon = useTranslations('Common');

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/products');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setProducts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const [gymCountry, setGymCountry] = useState('MX');

    useEffect(() => {
        fetchProducts();
        fetchGymConfig();
    }, []);

    const fetchGymConfig = async () => {
        try {
            const res = await fetch('/api/gym-config');
            if (res.ok) {
                const data = await res.json();
                setGymCountry(data.country || 'MX');
            }
        } catch (error) {
            console.error('Error fetching gym config:', error);
        }
    };

    const formatCurrency = (amount: number) => {
        const locale = gymCountry === 'MX' ? 'es-MX' : 'en-US';
        const currency = gymCountry === 'MX' ? 'MXN' : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    };

    const handleOpenModal = (product: Product | null = null) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
        try {
            const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchProducts();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredProducts = useMemo(() => {
        let filtered = [...products];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(prod =>
                (prod.CodigoBarras && prod.CodigoBarras.toLowerCase().includes(lowerTerm)) ||
                (prod.Cuota && prod.Cuota.toLowerCase().includes(lowerTerm))
            );
        }

        if (sortConfig) {
            filtered.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [products, searchTerm, sortConfig]);

    if (loading) return <div className="neon-text">{tCommon('loading')}</div>;

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="ml-1 opacity-20">⇅</span>;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 inline" /> : <ChevronDown size={14} className="ml-1 inline" />;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="neon-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Package size={32} />
                    Productos
                </h1>
                <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} />
                    Agregar
                </button>
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                    type="text"
                    placeholder="Buscar por código o producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '3rem', width: '100%', maxWidth: '400px' }}
                />
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('CodigoBarras')}>
                                Código <SortIcon columnKey="CodigoBarras" />
                            </th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('Cuota')}>
                                Producto <SortIcon columnKey="Cuota" />
                            </th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('Precio')}>
                                Precio <SortIcon columnKey="Precio" />
                            </th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--neon-blue)', cursor: 'pointer' }} onClick={() => handleSort('IVA')}>
                                IVA % <SortIcon columnKey="IVA" />
                            </th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--neon-blue)' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map((prod) => (
                            <tr key={prod.IdCuota} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem', opacity: 0.8 }}>
                                    {prod.CodigoBarras}
                                </td>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{prod.Cuota}</td>
                                <td style={{ padding: '1rem' }}>{formatCurrency(prod.Precio)}</td>
                                <td style={{ padding: '1rem' }}>{prod.IVA}%</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleOpenModal(prod)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(prod.IdCuota)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#ff4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                    No se encontraron productos.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchProducts}
                product={selectedProduct}
            />

            <style jsx>{`
                table tr:hover { background: rgba(255,255,255,0.02); }
            `}</style>
        </div>
    );
}
