-- Run this once in Supabase SQL Editor.
-- IMPORTANT: raw uploaded CSV/XLS/XLSX files are intentionally NOT stored in Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','supreme','premier')),
  monthly_email_credits bigint not null default 0,
  credits_used bigint not null default 0,
  credits_period_start timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_count integer not null check (email_count > 0 and email_count <= 50000),
  plan text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "users read own usage" on public.usage_events;
create policy "users read own usage" on public.usage_events
for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, plan)
  values (new.id, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.reserve_email_credits(p_emails integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  lim bigint;
  used bigint;
  new_used bigint;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'message', 'Authentication required.');
  end if;

  select * into p from public.profiles where id = uid for update;

  if not found then
    insert into public.profiles(id, plan) values(uid,'free')
    on conflict (id) do nothing;
    select * into p from public.profiles where id = uid for update;
  end if;

  if p.plan = 'premier' then lim := 50000;
  elsif p.plan = 'supreme' then lim := 25000;
  else lim := 200;
  end if;

  if p.plan in ('supreme','premier') and p.credits_period_start < date_trunc('month', now()) then
    update public.profiles
      set credits_used = 0,
          credits_period_start = date_trunc('month', now()),
          updated_at = now()
      where id = uid;
    used := 0;
  else
    used := p.credits_used;
  end if;

  if used + p_emails > lim then
    return jsonb_build_object(
      'allowed', false,
      'message', format('Quota exceeded. %s credits remain.', greatest(0, lim-used))
    );
  end if;

  if p.plan in ('supreme','premier') then
    new_used := used + p_emails;
    update public.profiles
      set credits_used = new_used, updated_at = now()
      where id = uid;
  else
    insert into public.usage_events(user_id,email_count,plan)
    values(uid,p_emails,p.plan);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'quota', jsonb_build_object(
      'limit', lim,
      'used', used + p_emails,
      'remaining', greatest(0, lim-used-p_emails)
    )
  );
end;
$$;

revoke all on function public.reserve_email_credits(integer) from public;
grant execute on function public.reserve_email_credits(integer) to authenticated;
