# 🔄 Sistema de Scraping del Ministerio

## Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   cron-job.org  │───▶│  Edge Function   │───▶│  Web Ministerio │
│   (cada 1 min)  │    │ scrape-ministry  │    │                 │
└─────────────────┘    └────────┬─────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    Supabase     │
                       │ ┌─────────────┐ │
                       │ │ adjudications│ │
                       │ │ slots       │ │
                       │ │ scraper_cfg │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## Despliegue de la Edge Function

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login y Link

```bash
supabase login
supabase link --project-ref cdajcwesevcvaehjsqdg
```

### 3. Desplegar la función

```bash
cd c:\Users\evila\Documents\AI\MIR
supabase functions deploy scrape-ministry
```

### 4. Probar manualmente

```bash
curl -X POST https://cdajcwesevcvaehjsqdg.supabase.co/functions/v1/scrape-ministry \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```

## Configuración del Cron Job

### 1. Crear cuenta en cron-job.org

Ve a [https://cron-job.org](https://cron-job.org) y crea una cuenta gratuita.

### 2. Crear un nuevo Cronjob

- **URL:** `https://cdajcwesevcvaehjsqdg.supabase.co/functions/v1/scrape-ministry`
- **Schedule:** Cada 1 minuto (`* * * * *`)
- **Request method:** POST
- **Headers:**
  ```
  Authorization: Bearer <TU_SUPABASE_SERVICE_ROLE_KEY>
  Content-Type: application/json
  ```

### 3. Guardar y activar

El cron llamará a la función cada minuto. La función internamente comprobará si ha pasado el intervalo configurado en el Admin Panel antes de ejecutar el scrape real.

## Cómo funciona

1. **cron-job.org** invoca la Edge Function cada minuto.
2. La función lee la configuración de `scraper_config`:
   - Si `is_enabled = false` → Sale sin hacer nada.
   - Si no ha pasado el `polling_interval_minutes` → Sale.
3. Hace fetch a la URL del Ministerio.
4. Parsea los datos de adjudicaciones (número de orden, especialidad, hospital, etc.).
5. Inserta las nuevas adjudicaciones en `adjudications` (evita duplicados por `order_number`).
6. Llama a `update_available_slots()` para restar las plazas adjudicadas del total.
7. Actualiza `scraper_config` con el estado del último scrape.

## Pendiente

- [ ] Implementar el parser real cuando se conozca la estructura de la web del Ministerio (HTML/JSON).
- [ ] Añadir notificaciones push cuando se detecten nuevas adjudicaciones.
