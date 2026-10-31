begin;
create table public.target_pulse_draw (
  id integer primary key check (id=1),
  visible boolean not null default false,
  revision integer not null default 0,
  spin_id uuid,
  prize integer check (prize in (50,100,200)),
  starts_at timestamptz,
  ends_at timestamptz
);
alter table public.target_pulse_draw enable row level security;
revoke all on public.target_pulse_draw from public, anon, authenticated;
grant select on public.target_pulse_draw to anon, authenticated;
create policy "Read shared wheel" on public.target_pulse_draw for select to anon, authenticated using(id=1);
insert into public.target_pulse_draw(id) values(1);

create function public.target_pulse_draw_state() returns jsonb
language sql volatile security invoker set search_path='' as $$
 select to_jsonb(d) || jsonb_build_object('server_now',clock_timestamp()) from public.target_pulse_draw d where id=1;
$$;
revoke all on function public.target_pulse_draw_state() from public;
grant execute on function public.target_pulse_draw_state() to anon,authenticated;

-- Same deliberately public control model as the owner's existing admin panel.
-- Row locking and revision checks prevent duplicate or concurrent spins.
create function public.target_pulse_draw_control(p_action text,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.target_pulse_draw; t timestamptz := clock_timestamp();
begin
 select * into d from public.target_pulse_draw where id=1 for update;
 if p_revision is null or p_revision<>d.revision then raise exception 'The wheel changed. Reload its current state and try again.'; end if;
 if p_action is null or p_action not in ('show','spin','hide') then raise exception 'Invalid wheel action'; end if;
 if p_action='spin' then
   if not d.visible then raise exception 'Show the wheel first'; end if;
   if d.ends_at is not null and d.ends_at>t then raise exception 'A spin is already in progress'; end if;
   update public.target_pulse_draw set spin_id=gen_random_uuid(), prize=(array[50,100,200])[1+floor(random()*3)::integer], starts_at=t+interval '3 seconds', ends_at=t+interval '11 seconds',revision=revision+1 where id=1;
 elsif p_action='show' then
   if d.ends_at is not null and d.ends_at>t then raise exception 'A spin is already in progress'; end if;
   update public.target_pulse_draw set visible=true,spin_id=null,prize=null,starts_at=null,ends_at=null,revision=revision+1 where id=1;
 else
   update public.target_pulse_draw set visible=false,revision=revision+1 where id=1;
 end if;
 return public.target_pulse_draw_state();
end;
$$;
revoke all on function public.target_pulse_draw_control(text,integer) from public;
grant execute on function public.target_pulse_draw_control(text,integer) to anon,authenticated;
commit;
