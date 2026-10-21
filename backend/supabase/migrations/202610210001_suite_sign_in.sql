-- Email authentication is handled by Supabase Auth. No ratings are installed.
create table public.app_access (
 user_id uuid not null references auth.users(id) on delete cascade,
 app_id text not null check (app_id in ('tma-mail','tma-safe','tma-padlock','tma-cut','tma-socialsmanager','tma-agent-office')),
 enabled boolean not null default false,
 primary key(user_id,app_id)
);
alter table public.app_access enable row level security;
create policy own_access on public.app_access for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,insert,update,delete on public.app_access to authenticated;
revoke all on public.app_access from anon;

create table public.app_handoffs (
 code_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 app_id text not null,
 challenge text not null,
 expires_at timestamptz not null
);
create table public.app_sessions (
 token_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 app_id text not null,
 expires_at timestamptz not null
);
alter table public.app_handoffs enable row level security;
alter table public.app_sessions enable row level security;
revoke all on public.app_handoffs,public.app_sessions from anon,authenticated;

-- The edge function calls this with its service identity. A code is consumed once,
-- under a row lock, only after the requesting app proves its PKCE verifier.
create function public.exchange_app_handoff(p_hash text,p_app text,p_challenge text,p_session_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare entry public.app_handoffs;
begin
 select * into entry from public.app_handoffs where code_hash=p_hash for update;
 if not found or entry.app_id<>p_app or entry.challenge<>p_challenge or entry.expires_at<=now()
 or not exists(select 1 from public.app_access where user_id=entry.user_id and app_id=p_app and enabled) then return null; end if;
 delete from public.app_handoffs where code_hash=p_hash;
 insert into public.app_sessions values(p_session_hash,entry.user_id,p_app,now()+interval '30 days');
 return entry.user_id;
end $$;
revoke all on function public.exchange_app_handoff(text,text,text,text) from public,anon,authenticated;
grant execute on function public.exchange_app_handoff(text,text,text,text) to service_role;

grant all on public.app_access,public.app_handoffs,public.app_sessions to service_role;

create index handoff_expiry on public.app_handoffs(expires_at);
create index handoff_user_app on public.app_handoffs(user_id,app_id);
create index app_session_expiry on public.app_sessions(expires_at);
