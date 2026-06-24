create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  account_type text not null default 'driver'
    check (account_type in ('owner', 'driver', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_normalized check (username = lower(username))
);

alter table public.profiles enable row level security;

alter table public.app_state
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists account_type text not null default 'driver'
    check (account_type in ('owner', 'driver', 'demo'));

create unique index if not exists app_state_user_id_key
  on public.app_state(user_id)
  where user_id is not null;

drop policy if exists "Top1Group app state insert" on public.app_state;
drop policy if exists "Top1Group app state read" on public.app_state;
drop policy if exists "Top1Group app state update" on public.app_state;

create policy "Users read own app state"
  on public.app_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own app state"
  on public.app_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own app state"
  on public.app_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_driver_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text;
  new_display_name text;
  new_account_type text;
  empty_state jsonb;
begin
  new_username := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  ));
  new_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    initcap(replace(new_username, '.', ' '))
  );
  new_account_type := coalesce(
    nullif(new.raw_app_meta_data ->> 'account_type', ''),
    nullif(new.raw_user_meta_data ->> 'account_type', ''),
    'driver'
  );
  if new_account_type not in ('owner', 'driver', 'demo') then
    new_account_type := 'driver';
  end if;

  empty_state := jsonb_build_object(
    'businesses', jsonb_build_array(
      jsonb_build_object('id', 'business_driver', 'name', 'Driver', 'type', 'service', 'color', 'green', 'active', true),
      jsonb_build_object('id', 'business_solar', 'name', 'Solar', 'type', 'sales', 'color', 'blue', 'active', false)
    ),
    'people', '[]'::jsonb,
    'events', '[]'::jsonb,
    'tasks', '[]'::jsonb,
    'incomeEntries', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'activityLogs', '[]'::jsonb,
    'driverRawRecords', '[]'::jsonb,
    'driverAnalytics', '{}'::jsonb,
    'grabSettings', jsonb_build_object(
      'carRentalTarget', 390,
      'housingLoanTarget', 1000,
      'grabWalletBase', 500,
      'pettyCashOpening', 0,
      'cashAtHomeOpening', 0,
      'defaultPetrolStation', 'Petron',
      'defaultPetrolPaymentMethod', 'Credit Card',
      'cashCategories', jsonb_build_array('bank in', 'pocket money', 'service car')
    ),
    'cashLedger', '[]'::jsonb,
    'pendingCashActions', '[]'::jsonb,
    'bankTransfers', '[]'::jsonb,
    'petrolCardPayments', '[]'::jsonb,
    'driverSessions', '[]'::jsonb,
    'solarEvents', '[]'::jsonb,
    'updatedAt', now()
  );

  insert into public.profiles (id, username, display_name, account_type)
  values (new.id, new_username, new_display_name, new_account_type)
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    account_type = excluded.account_type,
    updated_at = now();

  insert into public.app_state (id, user_id, account_type, state)
  values (new.id::text, new.id, new_account_type, empty_state)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_driver_user() from public;

drop trigger if exists on_auth_user_created_driver_os on auth.users;
create trigger on_auth_user_created_driver_os
  after insert on auth.users
  for each row execute procedure public.handle_new_driver_user();
