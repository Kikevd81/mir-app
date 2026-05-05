import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, Building2, Stethoscope, Activity, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ label, value, icon: Icon, colorClass, subtitle }) => (
    <div className="card-premium h-full" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div className={colorClass} style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} />
            </div>
            {subtitle && <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{subtitle}</span>}
        </div>
        <div>
            <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
            <p className="stat-v3-value" style={{ margin: 0 }}>{value}</p>
        </div>
    </div>
);

const SpecialtyRow = ({ specialty, hospitalIds, slots, hospitals }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const specialtySlots = slots.filter(s => s.specialtyId === specialty.id && hospitalIds.includes(s.hospitalId));
    const available = specialtySlots.reduce((acc, curr) => acc + curr.available, 0);
    const total = specialtySlots.reduce((acc, curr) => acc + curr.total, 0);

    const followedHospitalsData = hospitals.filter(h => hospitalIds.includes(h.id));

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
                    gap: '1.5rem',
                    width: '100%',
                    cursor: 'pointer',
                    borderRadius: isExpanded ? '20px 20px 0 0' : '20px',
                    borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
            >
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
                        flexShrink: 0,
                        transition: 'all 0.2s ease'
                    }}>
                        <Stethoscope size={24} color={isExpanded ? '#fff' : '#2563eb'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.1rem', margin: 0, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {specialty.name}
                        </h4>
                        <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '800', marginTop: '4px', letterSpacing: '0.05em' }}>
                            {hospitalIds.length} HOSPITALES SEGUIDOS
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4" style={{ flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '950', fontSize: '1.5rem', color: available > 0 ? '#2563eb' : '#ef4444', lineHeight: 1 }}>{available}</p>
                        <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>PLAZAS</p>
                    </div>
                    {isExpanded ? <ChevronDown size={20} className="text-blue-600" /> : <ChevronRight size={20} className="text-slate-300" />}
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
                            padding: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {followedHospitalsData.map(hosp => {
                                    const hospSlots = slots.find(s => s.specialtyId === specialty.id && s.hospitalId === hosp.id);
                                    const hospAvailable = hospSlots ? hospSlots.available : 0;
                                    const hospTotal = hospSlots ? hospSlots.total : 0;

                                    return (
                                        <div key={hosp.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #f1f5f9'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                    <Building2 size={14} className="text-slate-400" />
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                                                    <p style={{
                                                        fontSize: '0.85rem',
                                                        fontWeight: '800',
                                                        color: '#334155',
                                                        marginBottom: '0',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: 'block',
                                                        maxWidth: '100%'
                                                    }}>
                                                        {hosp.name}
                                                    </p>
                                                    <p style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>{hosp.province}</p>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <span style={{ fontSize: '1rem', fontWeight: '900', color: hospAvailable > 0 ? '#2563eb' : '#ef4444' }}>{hospAvailable}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>/{hospTotal}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Dashboard = ({ slots, followedSpecialties, followedHospitals, specialties, hospitals }) => {
    // Calcular estadísticas globales
    const totalSlots = slots.reduce((acc, curr) => acc + curr.total, 0);
    // const availableSlots = slots.reduce((acc, curr) => acc + curr.available, 0); // Not used currently

    // Calcular plazas de "Mi Selección"
    const mySelectionSlots = useMemo(() => {
        let count = 0;
        followedSpecialties.forEach(specId => {
            const hospIds = followedHospitals[specId] || [];
            hospIds.forEach(hospId => {
                const slot = slots.find(s => s.specialtyId === specId && s.hospitalId === hospId);
                if (slot) count += slot.available;
            });
        });
        return count;
    }, [slots, followedSpecialties, followedHospitals]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }} className="animate-fade">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <StatCard
                    label="Plazas Totales"
                    value={totalSlots}
                    icon={Activity}
                    colorClass="bg-blue-50 text-blue-600"
                    subtitle="NACIONAL"
                />
                <StatCard
                    label="Mi Selección"
                    value={mySelectionSlots}
                    icon={TrendingUp}
                    colorClass="bg-emerald-50 text-emerald-600"
                    subtitle="DISPONIBLES"
                />
            </div>

            <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '0.5rem' }}>Estado en Tiempo Real</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>Monitorización en vivo de adjudicación de plazas.</p>
            </div>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: 'fit-content', maxWidth: '100%' }}>
                {followedSpecialties.length > 0 ? (
                    followedSpecialties.map(specId => {
                        const spec = specialties.find(s => s.id === specId);
                        if (!spec) return null;
                        return (
                            <SpecialtyRow
                                key={specId}
                                specialty={spec}
                                hospitalIds={followedHospitals[specId] || []}
                                slots={slots}
                                hospitals={hospitals}
                            />
                        );
                    })
                ) : (
                    <div className="card-premium" style={{ borderStyle: 'dashed', padding: '3rem', textAlign: 'center' }}>
                        <AlertCircle size={48} color="#e2e8f0" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: '#94a3b8', fontWeight: '800', fontSize: '1rem' }}>Configura especialidades para iniciar el seguimiento.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
