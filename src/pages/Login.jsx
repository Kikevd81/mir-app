import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, Loader2, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Usamos Magic Link (Email sin contraseña) que funciona por defecto en Supabase
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
            });
            if (error) throw error;
            setSent(true);
        } catch (error) {
            alert(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            padding: '1rem'
        }}>
            <div className="card-premium" style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: '#fff',
                padding: '3rem 2rem',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2rem'
                }}>
                    <Activity size={32} className="text-blue-600" />
                </div>

                <h1 style={{ fontSize: '2rem', fontWeight: '950', color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
                    MIR Tracker
                </h1>
                <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2.5rem' }}>
                    Monitorización de plazas en tiempo real.
                </p>

                {sent ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '16px', border: '1px solid #bbf7d0', color: '#166534' }}
                    >
                        <ShieldCheck size={48} style={{ margin: '0 auto 1rem', color: '#22c55e' }} />
                        <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>¡Enlace enviado!</h3>
                        <p style={{ fontSize: '0.9rem' }}>Revisa tu correo ({email}). Hemos enviado un enlace mágico para entrar.</p>
                    </motion.div>
                ) : (
                    <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        <div style={{ position: 'relative' }}>
                            <Mail size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="email"
                                placeholder="Tu correo electrónico"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    backgroundColor: '#f8fafc',
                                    transition: 'all 0.2s'
                                }}
                                className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '1rem',
                                borderRadius: '16px',
                                backgroundColor: '#0f172a',
                                color: '#fff',
                                fontWeight: '700',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '1rem',
                                transition: 'all 0.2s'
                            }}
                            className="hover:bg-slate-800"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Entrar <ArrowRight size={18} /></>}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '3rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', width: '100%' }}>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Acceso seguro y privado. Tus datos se guardan en tu cuenta.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
