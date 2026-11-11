-- Notificaciones push de citas para Melissa.
-- Suscripciones vinculadas a usuario/paciente/clínica y entregas idempotentes.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.pacientes(id) on delete cascade,
  clinic_id uuid not null references public.clinicas(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_unique unique (user_id, endpoint),
  constraint push_subscriptions_subscription_shape check (
    jsonb_typeof(subscription) = 'object' and subscription ? 'endpoint' and subscription ? 'keys'
  )
);
create index if not exists idx_push_subscriptions_patient on public.push_subscriptions (patient_id, clinic_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
drop policy if exists "cliente administra sus suscripciones push" on public.push_subscriptions;
create policy "cliente administra sus suscripciones push"
on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.pacientes p
    where p.id = patient_id and p.perfil_id = (select auth.uid()) and p.clinica_id = clinic_id
  )
);

create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24h', '2h')),
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint push_reminder_delivery_unique unique (cita_id, subscription_id, reminder_type)
);
create index if not exists idx_push_reminder_deliveries_status on public.push_reminder_deliveries (status, created_at);
alter table public.push_reminder_deliveries enable row level security;
grant all on public.push_reminder_deliveries to service_role;
create index if not exists idx_citas_confirmadas_fecha_push on public.citas (fecha_hora) where estado = 'confirmada';

create or replace function public.validar_melissa_push_cron(p_token text)
returns boolean language sql security definer set search_path = public, vault
as $$
  select coalesce(
    (auth.jwt() ->> 'role') = 'service_role'
    and p_token is not null
    and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'melissa_push_cron_secret' limit 1),
    false
  );
$$;
revoke all on function public.validar_melissa_push_cron(text) from public, anon, authenticated;
grant execute on function public.validar_melissa_push_cron(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'melissa_push_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'melissa_push_cron_secret',
      'Token interno para autenticar el cron de recordatorios push de Melissa'
    );
  end if;
end
$$;

select cron.schedule(
  'melissa-send-appointment-reminders',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://mpbfqbixzwcbwipfegmn.supabase.co/functions/v1/send-appointment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-melissa-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'melissa_push_cron_secret' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
