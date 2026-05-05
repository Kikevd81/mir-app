import React, { useState } from 'react';
import { Plus, Trash2, Building2, Stethoscope, Search, ArrowLeft, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { SPECIALTIES, HOSPITALS } from '../data/mockData';
import { motion, AnimatePresence } from 'framer-motion';

const SpecialtyRadarRow = ({ specId, followedHospitals, toggleHospital, removeSpecialty, specialties, hospitals, moveSpecialty, isFirst, isLast }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hospSearch, setHospSearch] = useState('');
    const spec = specialties.find(s => s.id === specId);
    const followedIds = followedHospitals[specId] || [];
    const selectedCount = followedIds.length;

    const normalizeText = (text) => {
        return String(text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const filteredHospitals = hospitals.filter(h => {
        if (hospSearch === '') {
            return followedIds.includes(h.id);
        }

        const searchNorm = normalizeText(hospSearch);
        const nameNorm = normalizeText(h.name);
        const provNorm = normalizeText(h.province);

        return nameNorm.includes(searchNorm) || provNorm.includes(searchNorm);
    });

    if (!spec) return null;

    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <motion.div
                whileHover={{ x: 4 }}
                className="card-premium"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    width: '100%',
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    borderRadius: isExpanded ? '20px 20px 0 0' : '20px',
                    borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                }}
            >
                {/* Botones de Reordenamiento - Izquierda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); moveSpecialty(specId, 'up'); }}
                        disabled={isFirst}
                        style={{
                            border: 'none', background: 'none', cursor: isFirst ? 'default' : 'pointer',
                            color: isFirst ? '#e2e8f0' : '#94a3b8', padding: '0'
                        }}
                    >
                        <ChevronUp size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); moveSpecialty(specId, 'down'); }}
                        disabled={isLast}
                        style={{
                            border: 'none', background: 'none', cursor: isLast ? 'default' : 'pointer',
                            color: isLast ? '#e2e8f0' : '#94a3b8', padding: '0'
                        }}
                    >
                        <ChevronDown size={16} />
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        backgroundColor: isExpanded ? '#2563eb' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #e2e8f0',
                        flexShrink: 0
                    }}>
                        <Stethoscope size={24} color={isExpanded ? '#fff' : '#2563eb'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.15rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {spec.name}
                        </h4>
                        <p style={{ fontSize: '11px', color: '#2563eb', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                            {selectedCount} CENTROS ACTIVOS
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>


                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeSpecialty(specId);
                        }}
                        style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: '#fff', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s' }}
                        title="Eliminar especialidad"
                    >
                        <Trash2 size={16} />
                    </button>
                    {isExpanded ? <ChevronDown size={20} color="#2563eb" /> : <ChevronRight size={20} color="#cbd5e1" />}
                </div>
            </motion.div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderTop: 'none',
                            borderRadius: '0 0 20px 20px',
                            padding: '1.25rem'
                        }}>
                            {/* Buscador de Hospitales Integrado */}
                            <div style={{
                                marginBottom: '1rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                padding: '0.5rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                <Search size={14} color="#94a3b8" />
                                <input
                                    type="text"
                                    placeholder={`AÑADIR O BUSCAR HOSPITAL...`}
                                    value={hospSearch}
                                    onChange={(e) => setHospSearch(e.target.value)}
                                    style={{
                                        flex: 1,
                                        background: 'none',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        color: '#1e293b',
                                        textTransform: 'uppercase'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {hospSearch && (
                                    <button onClick={() => setHospSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cbd5e1' }}>
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {filteredHospitals.length > 0 ? (
                                    filteredHospitals.map(hosp => {
                                        const isActive = followedIds.includes(hosp.id);
                                        return (
                                            <div
                                                key={hosp.id}
                                                onClick={() => {
                                                    const isAdding = !isActive;
                                                    toggleHospital(specId, hosp.id);
                                                    if (isAdding) {
                                                        setHospSearch('');
                                                    }
                                                }}
                                                className="card-hover-effect"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    backgroundColor: '#f8fafc',
                                                    border: '1px solid',
                                                    borderColor: isActive ? '#e2e8f0' : '#f1f5f9',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ flex: 1, paddingRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                        <Building2 size={14} color={isActive ? '#2563eb' : '#94a3b8'} />
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <p style={{ fontWeight: '800', fontSize: '0.85rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155' }}>
                                                            {hosp.name}
                                                        </p>
                                                        <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px', color: '#94a3b8' }}>
                                                            {hosp.province}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#fff',
                                                        border: '1px solid',
                                                        borderColor: isActive ? '#fee2e2' : '#e2e8f0',
                                                        color: isActive ? '#ef4444' : '#2563eb',
                                                        pointerEvents: 'none', // Click passes to parent
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {isActive ? <Trash2 size={14} /> : <Plus size={16} />}
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700', padding: '1rem' }}>
                                        {hospSearch === '' ? 'Sin hospitales activos.' : 'No hay resultados.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Configuration = ({ specialties, hospitals, followedSpecialties, followedHospitals, setFollowedSpecialties, setFollowedHospitals }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const addSpecialty = (id) => {
        if (!followedSpecialties.includes(id)) {
            setFollowedSpecialties([...followedSpecialties, id]);
            setFollowedHospitals({ ...followedHospitals, [id]: [] });
        }
    };

    const removeSpecialty = (id) => {
        setFollowedSpecialties(followedSpecialties.filter(s => s !== id));
        const newHospitals = { ...followedHospitals };
        delete newHospitals[id];
        setFollowedHospitals(newHospitals);
    };

    const moveSpecialty = (id, direction) => {
        const index = followedSpecialties.indexOf(id);
        if (index === -1) return;

        const newOrder = [...followedSpecialties];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setFollowedSpecialties(newOrder);
    };

    const toggleHospital = (specId, hospId) => {
        const currentHospitals = followedHospitals[specId] || [];
        const newHospitals = currentHospitals.includes(hospId)
            ? currentHospitals.filter(h => h !== hospId)
            : [...currentHospitals, hospId];

        setFollowedHospitals({
            ...followedHospitals,
            [specId]: newHospitals
        });
    };

    const normalizeText = (text) => {
        return String(text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const availableSpecialties = specialties.filter(s =>
        normalizeText(s.name).includes(normalizeText(searchTerm)) &&
        !followedSpecialties.includes(s.id)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }} className="animate-fade">
            <header>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '950', letterSpacing: '-0.04em', margin: '0 0 8px 0', color: '#0f172a' }}>Gestionar Radar</h2>
                <p style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: '500', margin: 0 }}>Configura tus especialidades y activa tus centros.</p>
            </header>

            {!isAdding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: 'fit-content', maxWidth: '100%' }}>
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            width: '100%',
                            padding: '1.25rem',
                            backgroundColor: '#fff',
                            border: '2px dashed #e2e8f0',
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginBottom: '0.5rem'
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <Plus size={20} />
                        </div>
                        <span style={{ fontWeight: '900', color: '#2563eb', fontSize: '1.1rem' }}>Añadir Especialidad</span>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <div style={{ width: '4px', height: '18px', backgroundColor: '#0f172a', borderRadius: '2px' }} />
                            <h3 style={{ fontSize: '11px', fontWeight: '950', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>En seguimiento actual</h3>
                        </div>

                        {followedSpecialties.map((specId, index) => (
                            <SpecialtyRadarRow
                                key={specId}
                                specId={specId}
                                followedHospitals={followedHospitals}
                                toggleHospital={toggleHospital}
                                removeSpecialty={removeSpecialty}
                                specialties={specialties}
                                hospitals={hospitals}
                                moveSpecialty={moveSpecialty}
                                isFirst={index === 0}
                                isLast={index === followedSpecialties.length - 1}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                    <button
                        onClick={() => setIsAdding(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: '900', fontSize: '10px', letterSpacing: '0.2em', cursor: 'pointer', marginBottom: '1rem' }}
                    >
                        <ArrowLeft size={18} /> VOLVER AL RADAR
                    </button>

                    <div className="card-premium" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#fff', borderRadius: '20px' }}>
                        <Search size={24} color="#2563eb" />
                        <input
                            type="text"
                            placeholder="ESCRIBE ESPECIALIDAD..."
                            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.02em', textTransform: 'uppercase' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {availableSpecialties.map(spec => (
                            <button
                                key={spec.id}
                                onClick={() => {
                                    addSpecialty(spec.id);
                                    setIsAdding(false);
                                    setSearchTerm('');
                                }}
                                className="card-premium"
                                style={{ width: '100%', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: '1px solid #f1f5f9', borderRadius: '20px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', border: '1px solid #e2e8f0' }}>
                                        <Plus size={24} />
                                    </div>
                                    <span style={{ fontWeight: '900', color: '#0f172a', fontSize: '1.15rem', textTransform: 'uppercase' }}>{spec.name}</span>
                                </div>
                                <ChevronRight size={24} color="#f1f5f9" />
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default Configuration;
