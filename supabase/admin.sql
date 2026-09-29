begin;
alter table public.target_pulse_counter add column if not exists target integer not null default 165;
alter table public.target_pulse_counter drop constraint if exists target_pulse_counter_remaining_check;
alter table public.target_pulse_counter add constraint target_pulse_counter_bounds check (target between 1 and 1000000 and remaining between 0 and target);
create schema if not exists target_pulse_private;
revoke all on schema target_pulse_private from public, anon, authenticated;
create table if not exists target_pulse_private.admins(email text primary key);
alter table target_pulse_private.admins enable row level security;
insert into target_pulse_private.admins values ('samirsabri51talk@gmail.com') on conflict do nothing;
create or replace function public.target_pulse_admin_set(p_target integer, p_remaining integer, p_expected_updated_at timestamptz)
returns setof public.target_pulse_counter language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from target_pulse_private.admins where email = lower(auth.jwt()->>'email')) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_target is null or p_remaining is null or p_target < 1 or p_target > 1000000 or p_remaining < 0 or p_remaining > p_target then
    raise exception 'Target must be 1–1000000; remaining must be between zero and target';
  end if;
  perform 1 from public.target_pulse_counter where id = 1 for update;
  if p_expected_updated_at is null or not exists(select 1 from public.target_pulse_counter where id = 1 and updated_at = p_expected_updated_at) then
    raise exception 'The count changed. Reload current values before saving.' using errcode = '40001';
  end if;
  update public.target_pulse_counter set target = p_target, remaining = p_remaining, updated_at = clock_timestamp() where id = 1;
  return query select * from public.target_pulse_counter where id = 1;
end;
$$;
revoke all on function public.target_pulse_admin_set(integer, integer, timestamptz) from public, anon;
grant execute on function public.target_pulse_admin_set(integer, integer, timestamptz) to authenticated;
commit;
