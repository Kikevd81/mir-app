import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Database, Table, ArrowLeft, Trash2, RefreshCw, Clock, Power, Globe } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';

const INTERVAL_OPTIONS = [1, 5, 10, 15, 20];

const Admin = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [importLog, setImportLog] = useState([]);
    const [stats, setStats] = useState(null);
    const fileInputRef = useRef(null);

    // Estado del Scraper Config
    const [scraperConfig, setScraperConfig] = useState(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isScrapingNow, setIsScrapingNow] = useState(false);

    // Cargar configuración del scraper al montar
    useEffect(() => {
        const loadConfig = async () => {
            setIsLoadingConfig(true);
            try {
                const { data, error } = await supabase
                    .from('scraper_config')
                    .select('*')
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                    console.error('Error cargando scraper config:', error);
                }
                setScraperConfig(data || null);
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setIsLoadingConfig(false);
            }
        };
        loadConfig();
    }, []);

    // Guardar configuración del scraper
    const saveScraperConfig = async (updates) => {
        setIsSavingConfig(true);
        try {
            const newConfig = { ...scraperConfig, ...updates, updated_at: new Date().toISOString() };

            if (scraperConfig?.id) {
                const { error } = await supabase
                    .from('scraper_config')
                    .update(newConfig)
                    .eq('id', scraperConfig.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('scraper_config')
                    .insert([newConfig])
                    .select()
                    .single();
                if (error) throw error;
                newConfig.id = data.id;
            }

            setScraperConfig(newConfig);
        } catch (err) {
            console.error('Error guardando config:', err);
            alert('Error guardando configuración: ' + err.message);
        } finally {
            setIsSavingConfig(false);
        }
    };

    // Forzar scrape manual - Llama a la Edge Function
    const forceScrapNow = async () => {
        setIsScrapingNow(true);
        try {
            // Llamar a la Edge Function directamente
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-ministry`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Usando la anon key ya que las Edge Functions la aceptan
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    }
                }
            );

            const result = await response.json();
            console.log('Resultado scrape manual:', result);

            if (result.status === 'success') {
                alert('✅ Scraping completado con éxito.\n\nAdjudicaciones procesadas: ' + (result.adjudications_processed || 0));
            } else if (result.status === 'disabled') {
                alert('⏸️ El scraper está desactivado.\n\nActívalo primero con el switch.');
            } else if (result.status === 'skipped') {
                alert('⏳ Aún no ha pasado el intervalo configurado.\n\nEspera un poco más o reduce el intervalo.');
            } else {
                alert('⚠️ Resultado: ' + (result.message || JSON.stringify(result)));
            }

            // Recargar configuración para ver el nuevo estado
            const { data: updatedConfig } = await supabase
                .from('scraper_config')
                .select('*')
                .limit(1)
                .single();

            if (updatedConfig) {
                setScraperConfig(updatedConfig);
            }

        } catch (err) {
            console.error('Error en scrape manual:', err);
            alert('❌ Error al ejecutar scraping: ' + err.message);
        } finally {
            setIsScrapingNow(false);
        }
    };

    const processExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setImportLog(['INICIANDO LECTURA DE ARCHIVO...']);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    throw new Error("EL ARCHIVO ESTÁ VACÍO O NO TIENE EL FORMATO CORRECTO.");
                }

                setImportLog(prev => [...prev, `ARCHIVO LEÍDO: ${data.length} FILAS DETECTADAS.`]);
                setImportLog(prev => [...prev, "PROCESANDO DATOS PARA SUPABASE..."]);

                // LÓGICA DE PROCESAMIENTO
                const newSpecialties = new Map();
                const newHospitals = new Map();
                const newSlots = [];
                let plazasTotales = 0;

                // Helpers para normalización
                const normalizeText = (text) => {
                    return String(text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                };

                const generateId = (text) => {
                    return normalizeText(text).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                };

                // Helper para encontrar columnas de forma flexible
                const findColumnValue = (row, possibleKeys) => {
                    const rowKeys = Object.keys(row);
                    for (const key of rowKeys) {
                        const normalizedKey = normalizeText(key);
                        if (possibleKeys.some(pk => normalizeText(pk) === normalizedKey)) {
                            return row[key];
                        }
                    }
                    return null;
                };

                data.forEach((row, index) => {
                    const province = findColumnValue(row, ['Provincia', 'PROVINCIA', 'Prov']) || 'DESCONOCIDA';
                    const hospitalName = findColumnValue(row, ['Hospital', 'HOSPITAL', 'Centro', 'Nombre']) || 'SIN NOMBRE';
                    const specialtyName = findColumnValue(row, ['especialidad', 'ESPECIALIDAD', 'Nombre especialidad']) || 'SIN ESPECIALIDAD';

                    const rawPlazas = findColumnValue(row, ['plazas', 'PLAZAS', 'Total plazas', 'Cupo']);
                    const plazas = rawPlazas ? parseInt(rawPlazas) : 0;

                    plazasTotales += (isNaN(plazas) ? 0 : plazas);

                    // Generar IDs únicos y robustos
                    const hospId = generateId(`${province} -${hospitalName} `);
                    const specId = generateId(specialtyName);

                    if (!newHospitals.has(hospId)) {
                        newHospitals.set(hospId, { id: hospId, name: hospitalName, province: province });
                    }

                    if (!newSpecialties.has(specId)) {
                        newSpecialties.set(specId, { id: specId, name: specialtyName });
                    }

                    newSlots.push({
                        hospital_id: hospId,
                        specialty_id: specId,
                        available: isNaN(plazas) ? 0 : plazas,
                        total: isNaN(plazas) ? 0 : plazas
                    });
                });

                const hospitalsArray = Array.from(newHospitals.values());
                const specialtiesArray = Array.from(newSpecialties.values());

                setImportLog(prev => [...prev, `DETECTADOS: ${hospitalsArray.length} HOSPITALES Y ${specialtiesArray.length} ESPECIALIDADES.`]);
                setImportLog(prev => [...prev, "SUBIENDO A LA NUBE (ESTO PUEDE TARDAR)..."]);

                // BULK INSERT (UPSERT) POR LOTES (BATCHING)
                const upsertInBatches = async (table, items, batchSize = 100, label = '') => {
                    for (let i = 0; i < items.length; i += batchSize) {
                        const batch = items.slice(i, i + batchSize);
                        const { error } = await supabase.from(table).upsert(batch, { onConflict: table === 'slots' ? 'hospital_id, specialty_id' : 'id' });
                        if (error) throw error;
                        if (i % 1000 === 0) {
                            setImportLog(prev => [...prev, `SUBIENDO ${label}: ${Math.min(i + batchSize, items.length)} / ${items.length}...`]);
                        }
                    }
                    setImportLog(prev => [...prev, `${label} COMPLETADOS.`]);
                };

                setImportLog(prev => [...prev, "INICIANDO SUBIDA POR LOTES..."]);

                await upsertInBatches('hospitals', hospitalsArray, 100, 'HOSPITALES');
                await upsertInBatches('specialties', specialtiesArray, 100, 'ESPECIALIDADES');
                await upsertInBatches('slots', newSlots, 100, 'PLAZAS');

                setImportLog(prev => [...prev, "¡SUBIDA COMPLETADA CON ÉXITO!"]);
                setImportLog(prev => [...prev, "DATOS SINCRONIZADOS. PUEDES NAVEGAR AL DASHBOARD."]);

                setStats({
                    count: data.length,
                    hospitals: hospitalsArray.length,
                    specialties: specialtiesArray.length,
                    plazas: plazasTotales
                });

                setIsProcessing(false);

            } catch (err) {
                console.error(err);
                setImportLog(prev => [...prev, `ERROR CRÍTICO: ${err.message || JSON.stringify(err)} `]);
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Nunca';
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        const styles = {
            success: { bg: '#dcfce7', color: '#166534', text: '✅ Éxito' },
            error: { bg: '#fee2e2', color: '#991b1b', text: '❌ Error' },
            pending: { bg: '#fef3c7', color: '#92400e', text: '⏳ Pendiente' },
            disabled: { bg: '#f1f5f9', color: '#64748b', text: '⏸️ Desactivado' }
        };
        const s = styles[status] || styles.pending;
        return (
            <span style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: '800',
                backgroundColor: s.bg,
                color: s.color
            }}>
                {s.text}
            </span>
        );
    };

    return (
        <div style={{ padding: '0 0.5rem', maxWidth: '800px', margin: '0 auto' }} className="animate-fade">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '950', letterSpacing: '-0.04em', margin: '0 0 8px 0', color: '#0f172a' }}>Administración</h2>
                <p style={{ fontSize: '1rem', color: '#64748b', fontWeight: '500', margin: 0 }}>Gestión de datos y configuración del sistema.</p>
            </div>

            {/* ========== SECCIÓN SCRAPER CONFIG ========== */}
            <div className="card-premium" style={{ padding: '2rem', marginBottom: '2rem', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Globe size={24} color="#2563eb" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Scraper del Ministerio</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Configuración de la sincronización automática con la web oficial.</p>
                    </div>
                </div>

                {isLoadingConfig ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Loader2 size={32} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
                        <p style={{ color: '#64748b', marginTop: '1rem' }}>Cargando configuración...</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: URL + Intervalo */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>URL del Ministerio</label>
                                <input
                                    type="text"
                                    value={scraperConfig?.ministry_url || ''}
                                    onChange={(e) => setScraperConfig({ ...scraperConfig, ministry_url: e.target.value })}
                                    onBlur={() => saveScraperConfig({ ministry_url: scraperConfig?.ministry_url })}
                                    placeholder="https://..."
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.9rem',
                                        fontFamily: 'monospace',
                                        backgroundColor: '#f8fafc'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Intervalo</label>
                                <select
                                    value={scraperConfig?.polling_interval_minutes || 5}
                                    onChange={(e) => saveScraperConfig({ polling_interval_minutes: parseInt(e.target.value) })}
                                    disabled={isSavingConfig}
                                    style={{
                                        padding: '12px 24px 12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.9rem',
                                        fontWeight: '700',
                                        backgroundColor: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {INTERVAL_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt} min</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Toggle + Estado + Botón Forzar */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '16px' }}>
                            {/* Toggle On/Off */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => saveScraperConfig({ is_enabled: !scraperConfig?.is_enabled })}
                                    disabled={isSavingConfig}
                                    style={{
                                        width: '56px',
                                        height: '32px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        backgroundColor: scraperConfig?.is_enabled ? '#2563eb' : '#cbd5e1',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        position: 'absolute',
                                        top: '4px',
                                        left: scraperConfig?.is_enabled ? '28px' : '4px',
                                        transition: 'left 0.2s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </button>
                                <span style={{ fontWeight: '700', color: scraperConfig?.is_enabled ? '#2563eb' : '#64748b' }}>
                                    {scraperConfig?.is_enabled ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>

                            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

                            {/* Estado */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} color="#94a3b8" />
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Último: <strong>{formatDate(scraperConfig?.last_scrape_at)}</strong>
                                </span>
                                {getStatusBadge(scraperConfig?.is_enabled ? scraperConfig?.last_scrape_status : 'disabled')}
                            </div>

                            <div style={{ flex: 1 }} />

                            {/* Botón Forzar */}
                            <button
                                onClick={forceScrapNow}
                                disabled={isScrapingNow || isSavingConfig}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    fontWeight: '800',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    opacity: isScrapingNow ? 0.7 : 1
                                }}
                            >
                                {isScrapingNow ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Forzar Ahora
                            </button>
                        </div>

                        {/* Error Message (if any) */}
                        {scraperConfig?.last_error_message && (
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: '#fee2e2',
                                borderRadius: '12px',
                                color: '#991b1b',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px'
                            }}>
                                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>{scraperConfig.last_error_message}</span>
                            </div>
                        )}

                        {/* Stats (if available) */}
                        {scraperConfig?.total_adjudications_processed > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                📊 Total adjudicaciones procesadas: <strong>{scraperConfig.total_adjudications_processed}</strong>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ========== SEPARADOR ========== */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                margin: '2rem 0',
                color: '#94a3b8'
            }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Importación Manual</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            </div>

            {/* ========== SECCIÓN IMPORTACIÓN EXCEL ========== */}
            <div className="card-premium" style={{ padding: '2.5rem', marginBottom: '2rem', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                <div
                    onClick={() => !isProcessing && fileInputRef.current.click()}
                    style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '20px',
                        padding: '3rem',
                        textAlign: 'center',
                        cursor: isProcessing ? 'wait' : 'pointer',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem'
                    }}
                    className="hover:border-blue-400 hover:bg-slate-50"
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={processExcel}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        disabled={isProcessing}
                    />

                    {isProcessing ? (
                        <>
                            <Loader2 size={48} className="animate-spin text-blue-600" />
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>Procesando...</h3>
                                <p style={{ color: '#64748b' }}>Sincronizando con la nube</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileSpreadsheet size={32} color="#2563eb" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>Subir Archivo Excel (BOE)</h3>
                                <p style={{ color: '#64748b', maxWidth: '300px', margin: '0 auto', fontSize: '0.9rem' }}>
                                    Importación inicial de plazas. El scraper actualizará automáticamente las disponibles.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Terminal Log */}
                <div style={{
                    marginTop: '2rem',
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isProcessing ? '#fbbf24' : '#10b981' }} />
                        <span style={{ fontWeight: 'bold', letterSpacing: '0.1em', fontSize: '0.75rem', color: '#94a3b8' }}>SYSTEM_LOG</span>
                        {isProcessing && <Loader2 size={12} className="animate-spin ml-auto text-slate-500" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {importLog.map((log, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                                <span style={{ color: '#475569', userSelect: 'none' }}>{'>'}</span>
                                <span style={{ color: log.startsWith('ERROR') ? '#f87171' : (log.includes('ÉXITO') ? '#34d399' : '#94a3b8') }}>{log}</span>
                            </div>
                        ))}
                        {importLog.length === 0 && <div style={{ color: '#334155' }}>ESPERANDO ARCHIVO...</div>}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}
                    >
                        <div className="card-premium" style={{ padding: '1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>FILAS</p>
                            <p style={{ fontSize: '2rem', fontWeight: '950', color: '#1e293b', margin: 0 }}>{stats.count}</p>
                        </div>
                        <div className="card-premium" style={{ padding: '1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>CENTROS</p>
                            <p style={{ fontSize: '2rem', fontWeight: '950', color: '#1e293b', margin: 0 }}>{stats.hospitals}</p>
                        </div>
                        <div className="card-premium" style={{ padding: '1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>ESPECIALIDADES</p>
                            <p style={{ fontSize: '2rem', fontWeight: '950', color: '#1e293b', margin: 0 }}>{stats.specialties}</p>
                        </div>
                        <div className="card-premium" style={{ padding: '1.5rem', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: '4px' }}>PLAZAS TOTALES</p>
                            <p style={{ fontSize: '2rem', fontWeight: '950', color: '#2563eb', margin: 0 }}>{stats.plazas}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Admin;

