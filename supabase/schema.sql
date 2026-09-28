create table if not exists public.target_pulse_counter (
  id integer primary key check (id = 1),
  remaining integer not null check (remaining between 0 and 165),
  updated_at timestamptz not null default now()
);
insert into public.target_pulse_counter (id, remaining) values (1, 165) on conflict do nothing;
create table if not exists public.target_pulse_events (
  request_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.target_pulse_counter enable row level security;
alter table public.target_pulse_events enable row level security;
revoke all on public.target_pulse_counter, public.target_pulse_events from anon, authenticated;
grant select on public.target_pulse_counter to anon, authenticated;
drop policy if exists "Public countdown display" on public.target_pulse_counter;
create policy "Public countdown display" on public.target_pulse_counter for select to anon, authenticated using (id = 1);

-- Intentionally public collaborative counter. No direct table editing allowed.
create or replace function public.target_pulse_record_win(p_request_id uuid)
returns setof public.target_pulse_counter
language plpgsql security definer set search_path = '' as $$
begin
  if p_request_id is null then raise exception 'Request ID required'; end if;
  perform 1 from public.target_pulse_counter where id = 1 for update;
  if exists (select 1 from public.target_pulse_events where request_id = p_request_id) then
    return query select * from public.target_pulse_counter where id = 1;
    return;
  end if;
  if exists (select 1 from public.target_pulse_counter where id = 1 and remaining > 0) then
    insert into public.target_pulse_events (request_id) values (p_request_id);
    update public.target_pulse_counter set remaining = remaining - 1, updated_at = clock_timestamp() where id = 1;
  end if;
  return query select * from public.target_pulse_counter where id = 1;
end;
$$;
revoke all on function public.target_pulse_record_win(uuid) from public;
grant execute on function public.target_pulse_record_win(uuid) to anon, authenticated;
