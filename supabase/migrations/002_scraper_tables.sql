-- =============================================================
-- FASE 2: SISTEMA DE SCRAPING DEL MINISTERIO
-- =============================================================

-- 1. TABLA DE CONFIGURACIÓN DEL SCRAPER
create table if not exists scraper_config (
  id uuid primary key default gen_random_uuid(),
  ministry_url text default 'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
  polling_interval_minutes integer default 5,
  last_scrape_at timestamp with time zone,
  last_scrape_status text default 'pending',
  last_error_message text,
  is_enabled boolean default false,
  total_adjudications_processed integer default 0,
  updated_at timestamp with time zone default now()
);

-- 2. TABLA DE ADJUDICACIONES
create table if not exists adjudications (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null,
  specialty_name text not null,
  hospital_name text not null,
  region text,
  province text,
  locality text,
  adjudication_datetime timestamp with time zone,
  scraped_at timestamp with time zone default now(),
  specialty_id text,
  hospital_id text
);

create unique index if not exists idx_adjudications_order_unique on adjudications(order_number);
create index if not exists idx_adjudications_specialty on adjudications(specialty_id);
create index if not exists idx_adjudications_hospital on adjudications(hospital_id);

-- 3. FUNCIÓN PARA ACTUALIZAR PLAZAS DISPONIBLES
create or replace function update_available_slots()
returns void as $$
begin
  update slots s
  set available = s.total - coalesce(
    (select count(*) 
     from adjudications a 
     where a.hospital_id = s.hospital_id 
     and a.specialty_id = s.specialty_id),
    0
  )
  where s.id is not null; -- Evita el error de Safe Update en Supabase
end;
$$ language plpgsql security definer;
