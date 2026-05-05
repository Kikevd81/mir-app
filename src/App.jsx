import React, { useState, useEffect } from 'react';
import { LayoutGrid, Settings, ExternalLink, Activity, Bell, Database, LayoutDashboard, Radio, Loader2, LogOut } from 'lucide-react';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import Configuration from './pages/Configuration';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`nav-item-v3 ${active ? 'nav-item-v3-active' : ''}`}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      padding: '8px 16px',
      borderRadius: '16px',
      border: 'none',
      background: active ? '#2563eb' : 'transparent',
      color: active ? '#fff' : '#94a3b8',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      minWidth: '80px'
    }}
  >
    <Icon size={20} />
    <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
  </button>
);

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Estado de Datos Globales
  const [slots, setSlots] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  // Estado de Preferencias (Ahora cargadas del perfil)
  const [followedSpecialties, setFollowedSpecialties] = useState([]);
  const [followedHospitals, setFollowedHospitals] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'

  // 1. Gestión de Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Cargar Datos Globales y Perfil de Usuario
  useEffect(() => {
    const fetchAllRows = async (table) => {
      let allData = [];
      let from = 0;
      const limit = 1000;
      let more = true;

      while (more) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + limit - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += limit;
          if (data.length < limit) more = false;
        } else {
          more = false;
        }
      }
      return allData;
    };

    const fetchData = async () => {
      if (!session) return; // Solo cargar si hay sesión

      setLoading(true);
      try {
        setHospitals([]);

        // A. Cargar Datos Globales (Paginación Recursiva)
        const [hospData, specData, slotsData] = await Promise.all([
          fetchAllRows('hospitals'),
          fetchAllRows('specialties'),
          fetchAllRows('slots')
        ]);

        if (hospData) setHospitals(hospData);
        if (specData) setSpecialties(specData);
        if (slotsData) {
          const mappedSlots = slotsData.map(slot => ({
            ...slot,
            hospitalId: slot.hospital_id,
            specialtyId: slot.specialty_id
          }));
          setSlots(mappedSlots);
        }

        // B. Cargar Perfil de Usuario
        console.log("Cargando perfil para:", session.user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          console.log("Perfil cargado:", profile);
          setFollowedSpecialties(profile.followed_specialties || []);
          setFollowedHospitals(profile.followed_hospitals || {});
        } else if (profileError) {
          console.warn("Error cargando perfil (puede ser nuevo):", profileError);
        }

      } catch (error) {
        console.error("Error crítico fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // 3. Guardar Preferencias en Cloud (Profiles)
  useEffect(() => {
    if (!session?.user?.id) return;
    if (loading) return; // No guardar mientras se carga inicialmente

    setSaveStatus('saving');

    // Debounce simple para no saturar la DB
    const timeoutId = setTimeout(async () => {
      try {
        console.log("Guardando perfil...", { followedSpecialties, followedHospitals });
        const updates = {
          id: session.user.id,
          email: session.user.email,
          followed_specialties: followedSpecialties,
          followed_hospitals: followedHospitals,
          updated_at: new Date()
        };

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) {
          throw error;
        }
        setSaveStatus('saved');
        console.log("Perfil guardado correctamente");
      } catch (err) {
        console.error("Error guardando perfil:", err);
        setSaveStatus('error');
        alert("Error al guardar cambios: " + err.message + ". Verifica que la tabla 'profiles' exista en Supabase.");
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [followedSpecialties, followedHospitals, session, loading]);


  // Renderizado Condicional: Login o App
  if (!session) {
    return <Login />;
  }

  // Check Admin
  const isAdmin = session?.user?.email === import.meta.env.VITE_ADMIN_EMAIL;

  // Loader
  if (loading && specialties.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--mir-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="animate-spin text-blue-600" />
          <p className="text-slate-400 font-bold text-sm tracking-wider uppercase">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--mir-bg)] text-[var(--text-primary)] pb-40">
      <div className="max-w-[600px] w-full mx-auto p-4 md:p-6">

        {/* Top Bar Simplificada con Logout y Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={24} className="text-blue-600" />
            <span style={{ fontWeight: '900', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>MIR Tracker</span>
            {saveStatus === 'saving' && <span className="text-xs text-blue-500 font-bold animate-pulse">Guardando...</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-500 font-bold">Error guardando</span>}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>

        <main>
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                <Dashboard
                  slots={slots}
                  followedSpecialties={followedSpecialties}
                  followedHospitals={followedHospitals}
                  specialties={specialties}
                  hospitals={hospitals}
                />
              </motion.div>
            )}
            {activeTab === 'config' && (
              <motion.div key="config" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                <Configuration
                  followedSpecialties={followedSpecialties}
                  setFollowedSpecialties={setFollowedSpecialties}
                  followedHospitals={followedHospitals}
                  setFollowedHospitals={setFollowedHospitals}
                  specialties={specialties}
                  hospitals={hospitals}
                />
              </motion.div>
            )}
            {activeTab === 'admin' && isAdmin && (
              <motion.div key="admin" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                <Admin />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Espaciador explícito para garantizar scroll final */}
        <div style={{ height: '120px', width: '100%' }} />
      </div>

      {/* Floating Nano-Dynamic Island */}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(16px)',
        padding: '6px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        zIndex: 50,
        gap: '4px'
      }}>
        <NavButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <NavButton icon={Settings} label="Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
        {isAdmin && <NavButton icon={Database} label="Admin" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />}
      </div>
    </div>
  );
}

export default App;
