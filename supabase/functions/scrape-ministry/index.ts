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

        // 4. Hacer fetch a la web del Ministerio
        console.log(`📥 Descargando datos de: ${config.ministry_url}`)

        // TODO: Implementar cuando se conozca la estructura real de la web
        // Por ahora, simulamos una respuesta vacía para pruebas
        const ministryUrl = config.ministry_url

        // Placeholder: En producción, esto será un fetch real + parsing HTML/JSON
        // const response = await fetch(ministryUrl)
        // const html = await response.text()
        // const adjudications = parseMinistryHtml(html) // Función a implementar

        // Datos de prueba para desarrollo
        const mockAdjudications: any[] = [
            // Descomentar para probar con datos mock:
            // { order_number: 1, specialty_name: 'OFTALMOLOGÍA', hospital_name: 'HOSPITAL VIRGEN DEL ROCÍO', region: 'ANDALUCÍA', province: 'SEVILLA' },
            // { order_number: 2, specialty_name: 'DERMATOLOGÍA', hospital_name: 'HOSPITAL LA PAZ', region: 'MADRID', province: 'MADRID' },
        ]

        const adjudications = mockAdjudications

        console.log(`📊 Datos obtenidos: ${adjudications.length} adjudicaciones`)

        // 5. Procesar y guardar adjudicaciones
        let newCount = 0
        for (const adj of adjudications) {
            // Generar IDs normalizados para vincular con nuestras tablas
            const specId = generateId(adj.specialty_name)
            const hospId = generateId(`${adj.province}-${adj.hospital_name}`)

            // Insertar (ignorar si ya existe por order_number único)
            const { error: insertError } = await supabase
                .from('adjudications')
                .upsert({
                    order_number: adj.order_number,
                    specialty_name: adj.specialty_name,
                    hospital_name: adj.hospital_name,
                    region: adj.region,
                    province: adj.province,
                    specialty_id: specId,
                    hospital_id: hospId,
                    scraped_at: new Date().toISOString()
                }, { onConflict: 'order_number' })

            if (!insertError) {
                newCount++
            }
        }

        console.log(`✅ Guardadas ${newCount} adjudicaciones nuevas`)

        // 6. Actualizar plazas disponibles (restar adjudicadas del total)
        // Llamar a la función SQL que creamos
        const { error: updateError } = await supabase.rpc('update_available_slots')

        if (updateError) {
            console.error('⚠️ Error actualizando slots:', updateError)
        } else {
            console.log('🔢 Plazas disponibles actualizadas')
        }

        // 7. Actualizar estado del scraper
        await supabase
            .from('scraper_config')
            .update({
                last_scrape_at: new Date().toISOString(),
                last_scrape_status: 'success',
                last_error_message: null,
                total_adjudications_processed: (config.total_adjudications_processed || 0) + newCount,
                updated_at: new Date().toISOString()
            })
            .eq('id', config.id)

        console.log('🎉 Scrape completado con éxito')

        return new Response(
            JSON.stringify({
                status: 'success',
                adjudications_processed: adjudications.length,
                new_adjudications: newCount,
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
