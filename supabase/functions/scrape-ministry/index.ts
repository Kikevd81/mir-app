// Supabase Edge Function: scrape-ministry
// Este archivo es el esqueleto de la función que será invocada por cron-job.org
// para obtener datos de plazas adjudicadas desde la web del Ministerio.
//
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Instalar Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link al proyecto: supabase link --project-ref <tu-project-ref>
// 4. Deploy: supabase functions deploy scrape-ministry
//
// Para probar localmente: supabase functions serve scrape-ministry

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Headers CORS para permitir llamadas desde cron-job.org
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helpers para normalizar texto (misma lógica que en el frontend)
const normalizeText = (text: string): string => {
    return String(text || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const generateId = (text: string): string => {
    return normalizeText(text).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Crear cliente Supabase con service role (acceso completo)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        console.log('🔄 Iniciando scrape del Ministerio...')

        // 1. Leer configuración
        const { data: config, error: configError } = await supabase
            .from('scraper_config')
            .select('*')
            .limit(1)
            .single()

        if (configError || !config) {
            throw new Error('No se pudo leer la configuración del scraper')
        }

        // 2. Verificar si está habilitado
        if (!config.is_enabled) {
            console.log('⏸️ Scraper desactivado. Saliendo...')
            return new Response(
                JSON.stringify({ status: 'disabled', message: 'Scraper está desactivado' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Verificar si ha pasado el intervalo desde el último scrape
        if (config.last_scrape_at) {
            const lastScrape = new Date(config.last_scrape_at)
            const now = new Date()
            const minutesSinceLastScrape = (now.getTime() - lastScrape.getTime()) / 1000 / 60

            if (minutesSinceLastScrape < config.polling_interval_minutes) {
                console.log(`⏳ Aún no ha pasado el intervalo (${minutesSinceLastScrape.toFixed(1)} min < ${config.polling_interval_minutes} min)`)
                return new Response(
                    JSON.stringify({
                        status: 'skipped',
                        message: `Esperando intervalo (${config.polling_interval_minutes - minutesSinceLastScrape.toFixed(1)} min restantes)`
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 4. Trigger GitHub Action
        console.log('🚀 Desencadenando GitHub Action para el scraper...')
        
        const GITHUB_PAT = Deno.env.get('GITHUB_PAT')
        const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'Kikevd81'
        const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'mir-app'
        const GITHUB_WORKFLOW = 'scraper.yml'

        if (!GITHUB_PAT) {
            throw new Error('GITHUB_PAT no está configurado en las variables de entorno de Supabase')
        }

        const githubResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_PAT}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json',
                    'User-Agent': 'SupabaseEdgeFunction'
                },
                body: JSON.stringify({
                    ref: 'main',
                }),
            }
        )

        if (!githubResponse.ok) {
            const errorText = await githubResponse.text()
            throw new Error(`Error al disparar GitHub Action: ${githubResponse.status} ${errorText}`)
        }

        console.log('✅ GitHub Action disparada con éxito')

        // 5. Actualizar estado del scraper
        await supabase
            .from('scraper_config')
            .update({
                last_scrape_at: new Date().toISOString(),
                last_scrape_status: 'running',
                updated_at: new Date().toISOString()
            })
            .eq('id', config.id)

        return new Response(
            JSON.stringify({
                status: 'success',
                message: 'Scraper iniciado vía GitHub Actions',
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Error en scrape:', error)

        // Intentar guardar el error en la configuración
        try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            const supabase = createClient(supabaseUrl, supabaseServiceKey)

            await supabase
                .from('scraper_config')
                .update({
                    last_scrape_at: new Date().toISOString(),
                    last_scrape_status: 'error',
                    last_error_message: error.message || 'Error desconocido',
                    updated_at: new Date().toISOString()
                })
                .limit(1)
        } catch (e) {
            console.error('Error guardando estado de error:', e)
        }

        return new Response(
            JSON.stringify({ status: 'error', message: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
