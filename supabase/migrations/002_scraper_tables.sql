-- =============================================================
-- FASE 2: SISTEMA DE SCRAPING DEL MINISTERIO
-- Ejecutar este script en Supabase SQL Editor
-- =============================================================

-- 1. TABLA DE CONFIGURACIÓN DEL SCRAPER
-- Almacena la configuración y estado del proceso de scraping
create table if not exists scraper_config (
  id uuid primary key default gen_random_uuid(),
  ministry_url text default 'https://placeholder-ministerio.gob.es/adjudicaciones',
  polling_interval_minutes integer default 5,
  last_scrape_at timestamp with time zone,
  last_scrape_status text default 'pending', -- 'success', 'error', 'pending', 'disabled'
  last_error_message text,
  is_enabled boolean default false,
  total_adjudications_processed integer default 0,
  updated_at timestamp with time zone default now()
);

-- Insertar configuración inicial (solo si no existe)
insert into scraper_config (ministry_url, polling_interval_minutes, is_enabled)
select 'https://placeholder-ministerio.gob.es/adjudicaciones', 5, false
where not exists (select 1 from scraper_config limit 1);

-- RLS: Permitir lectura pública pero escritura solo autenticados
alter table scraper_config enable row level security;

create policy "Anyone can read scraper config"
  on scraper_config for select using (true);

create policy "Authenticated users can update scraper config"
  on scraper_config for update using (auth.role() = 'authenticated');

create policy "Authenticated users can insert scraper config"
  on scraper_config for insert with check (auth.role() = 'authenticated');

-- =============================================================

-- 2. TABLA DE ADJUDICACIONES (Plazas ya elegidas por aspirantes)
-- Almacena cada plaza adjudicada según publica el Ministerio
create table if not exists adjudications (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null, -- Número de orden del aspirante
  specialty_name text not null,
  hospital_name text not null,
  region text, -- Comunidad Autónoma
  province text,
  locality text, -- Localidad de la adjudicación
  adjudication_datetime timestamp with time zone, -- Fecha y hora real de la adjudicación
  scraped_at timestamp with time zone default now(),
  -- Claves foráneas opcionales para vincular con nuestras tablas
  specialty_id text,
  hospital_id text
);

-- Índice único para evitar duplicados (mismo número de orden = misma plaza)
create unique index if not exists idx_adjudications_order_unique on adjudications(order_number);

-- Índices para búsquedas rápidas
create index if not exists idx_adjudications_specialty on adjudications(specialty_id);
create index if not exists idx_adjudications_hospital on adjudications(hospital_id);

-- RLS: Lectura pública, escritura solo autenticados
alter table adjudications enable row level security;

create policy "Anyone can read adjudications"
  on adjudications for select using (true);

create policy "Authenticated users can insert adjudications"
  on adjudications for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update adjudications"
  on adjudications for update using (auth.role() = 'authenticated');

-- =============================================================

-- 3. FUNCIÓN PARA ACTUALIZAR PLAZAS DISPONIBLES
-- Esta función resta las plazas adjudicadas del total disponible
create or replace function update_available_slots()
returns void as $$
begin
  -- Para cada combinación hospital/especialidad, contar adjudicaciones
  -- y restar del total disponible
  update slots s
  set available = s.total - coalesce(
    (select count(*) 
     from adjudications a 
     where a.hospital_id = s.hospital_id 
     and a.specialty_id = s.specialty_id),
    0
  );
end;
$$ language plpgsql security definer;

-- =============================================================
-- FIN DEL SCRIPT
-- =============================================================
