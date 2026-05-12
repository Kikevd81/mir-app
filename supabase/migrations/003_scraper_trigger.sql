-- Trigger to automatically update available slots whenever adjudications change
create or replace function trigger_update_slots()
returns trigger as $$
begin
  -- Perform the existing update function
  perform update_available_slots();
  return null;
end;
$$ language plpgsql;

-- Add trigger to adjudications table
-- We use 'for each statement' to avoid running it multiple times during a bulk insert
drop trigger if exists trg_update_slots_after_change on adjudications;
create trigger trg_update_slots_after_change
after insert or update or delete on adjudications
for each statement
execute function trigger_update_slots();

-- Ensure total_adjudications_processed is updated in scraper_config
create or replace function update_scraper_stats()
returns trigger as $$
begin
  update scraper_config 
  set total_adjudications_processed = (select count(*) from adjudications),
      updated_at = now()
  where id is not null;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_scraper_stats on adjudications;
create trigger trg_update_scraper_stats
after insert or delete on adjudications
for each statement
execute function update_scraper_stats();
