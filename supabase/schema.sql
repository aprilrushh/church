-- 디지털 추모관(가칭) — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전)

create extension if not exists pgcrypto;

-- 1) 추모관(한 사람 = 한 기록관)
create table if not exists public.memorials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  title text,                      -- 직분/호칭 (예: 권사)
  birth_date date,
  death_date date,                 -- 생전 기록이면 비워 둠
  hometown text,
  verse text,                      -- 애송 말씀
  verse_ref text,
  hymn text,                       -- 애송 찬송
  intro text,                      -- 짧은 소개
  portrait_path text,              -- storage 경로
  visibility text not null default 'private' check (visibility in ('private','church','public')),
  consent_at timestamptz,          -- 본인/가족 동의 일시
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 가족 구성원(같이 편집할 사람)
create table if not exists public.memorial_members (
  memorial_id uuid references public.memorials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer')),
  primary key (memorial_id, user_id)
);

-- 3) 녹음(질문 + 실제 육성 + 받아쓰기)
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  question text not null,
  audio_path text not null,
  duration_sec int,
  transcript text,
  recorded_on date default current_date,
  created_at timestamptz not null default now()
);

-- 4) 생애의 장(자서전)
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  period text,                     -- 예: 1938 ~ 1956
  title text not null,
  body text,
  recording_id uuid references public.recordings(id) on delete set null,
  sort int not null default 0,
  approved boolean not null default false,  -- 가족 확인 완료
  created_at timestamptz not null default now()
);

-- 5) 사진
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  path text not null,
  year text,
  caption text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 6) 추모의 글
create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

-- 권한 도우미 함수
create or replace function public.can_edit(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from memorials where id = m and owner_id = auth.uid())
      or exists(select 1 from memorial_members where memorial_id = m and user_id = auth.uid() and role = 'editor');
$$;

create or replace function public.can_view(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_edit(m)
      or exists(select 1 from memorial_members where memorial_id = m and user_id = auth.uid())
      or exists(select 1 from memorials where id = m and (
            visibility = 'public'
         or (visibility = 'church' and auth.uid() is not null)));
$$;

alter table public.memorials enable row level security;
alter table public.memorial_members enable row level security;
alter table public.recordings enable row level security;
alter table public.chapters enable row level security;
alter table public.photos enable row level security;
alter table public.guestbook enable row level security;

-- memorials
drop policy if exists m_select on public.memorials;
create policy m_select on public.memorials for select using (owner_id = auth.uid() or public.can_view(id));
drop policy if exists m_insert on public.memorials;
create policy m_insert on public.memorials for insert with check (owner_id = auth.uid());
drop policy if exists m_update on public.memorials;
create policy m_update on public.memorials for update using (public.can_edit(id));
drop policy if exists m_delete on public.memorials;
create policy m_delete on public.memorials for delete using (owner_id = auth.uid());

-- members (소유자만 관리)
drop policy if exists mm_all on public.memorial_members;
create policy mm_all on public.memorial_members for all
  using (exists(select 1 from memorials where id = memorial_id and owner_id = auth.uid()) or user_id = auth.uid())
  with check (exists(select 1 from memorials where id = memorial_id and owner_id = auth.uid()));

-- recordings / chapters / photos : 보기는 can_view, 쓰기는 can_edit
do $$
declare t text;
begin
  foreach t in array array['recordings','chapters','photos'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (public.can_view(memorial_id))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all using (public.can_edit(memorial_id)) with check (public.can_edit(memorial_id))', t);
  end loop;
end $$;

-- guestbook : 볼 수 있는 사람은 로그인 후 작성 가능, 본인 글/편집자만 삭제
drop policy if exists g_select on public.guestbook;
create policy g_select on public.guestbook for select using (public.can_view(memorial_id));
drop policy if exists g_insert on public.guestbook;
create policy g_insert on public.guestbook for insert with check (auth.uid() is not null and author_id = auth.uid() and public.can_view(memorial_id));
drop policy if exists g_delete on public.guestbook;
create policy g_delete on public.guestbook for delete using (author_id = auth.uid() or public.can_edit(memorial_id));

-- 저장소(사진·녹음): 비공개 버킷, 경로 첫 폴더 = memorial_id
insert into storage.buckets (id, name, public) values ('memorial-media','memorial-media', false)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select
  using (bucket_id = 'memorial-media' and public.can_view(((storage.foldername(name))[1])::uuid));
drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects for insert
  with check (bucket_id = 'memorial-media' and public.can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update
  using (bucket_id = 'memorial-media' and public.can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete
  using (bucket_id = 'memorial-media' and public.can_edit(((storage.foldername(name))[1])::uuid));

-- 부고장 정보(상주·장례 일정)
alter table public.memorials add column if not exists chief_mourners text;
alter table public.memorials add column if not exists funeral_info text;

-- 남기신 말씀 / 방문자 추억(사진 포함)
create table if not exists public.sayings (id uuid primary key default gen_random_uuid(), memorial_id uuid not null references public.memorials(id) on delete cascade, body text not null default '', context text, sort int not null default 0, created_at timestamptz not null default now());
alter table public.sayings enable row level security;
drop policy if exists sayings_select on public.sayings; create policy sayings_select on public.sayings for select using (public.can_view(memorial_id));
drop policy if exists sayings_write on public.sayings; create policy sayings_write on public.sayings for all using (public.can_edit(memorial_id)) with check (public.can_edit(memorial_id));
alter table public.guestbook add column if not exists kind text not null default 'comfort';
alter table public.guestbook add column if not exists photo_path text;
alter table public.guestbook add column if not exists memory_when text;
drop policy if exists media_guest_write on storage.objects; create policy media_guest_write on storage.objects for insert with check (bucket_id = 'memorial-media' and (storage.foldername(name))[2] = 'guest' and (storage.foldername(name))[3] = auth.uid()::text and public.can_view(((storage.foldername(name))[1])::uuid));
drop policy if exists media_guest_delete on storage.objects; create policy media_guest_delete on storage.objects for delete using (bucket_id = 'memorial-media' and (storage.foldername(name))[2] = 'guest' and (storage.foldername(name))[3] = auth.uid()::text);

-- 무료 모바일 부고장
alter table public.memorials add column if not exists obit_enabled boolean not null default false;
alter table public.memorials add column if not exists obit_style text not null default 'christian';
alter table public.memorials add column if not exists obit_message text;
alter table public.memorials add column if not exists obit_place text;
alter table public.memorials add column if not exists obit_contact text;
alter table public.memorials add column if not exists obit_account text;
alter table public.memorials add column if not exists obit_portrait text;
insert into storage.buckets (id, name, public) values ('obit-public','obit-public', true) on conflict (id) do nothing;
drop policy if exists obit_pub_write on storage.objects; create policy obit_pub_write on storage.objects for insert with check (bucket_id = 'obit-public' and public.can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists obit_pub_update on storage.objects; create policy obit_pub_update on storage.objects for update using (bucket_id = 'obit-public' and public.can_edit(((storage.foldername(name))[1])::uuid));
drop policy if exists obit_pub_delete on storage.objects; create policy obit_pub_delete on storage.objects for delete using (bucket_id = 'obit-public' and public.can_edit(((storage.foldername(name))[1])::uuid));
create or replace function public.get_obituary(mid uuid) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id',m.id,'name',m.name,'title',m.title,'birth_date',m.birth_date,'death_date',m.death_date,'chief_mourners',m.chief_mourners,'funeral_info',m.funeral_info,'verse',m.verse,'verse_ref',m.verse_ref,'style',m.obit_style,'message',m.obit_message,'place',m.obit_place,'contact',m.obit_contact,'account',m.obit_account,'portrait',m.obit_portrait,'visibility',m.visibility,
    'comforts',coalesce((select json_agg(json_build_object('name',g.author_name,'body',g.body,'at',g.created_at) order by g.created_at desc) from (select * from guestbook where memorial_id=m.id and kind='comfort' order by created_at desc limit 100) g),'[]'::json))
  from memorials m where m.id = mid and m.obit_enabled;
$$;
grant execute on function public.get_obituary(uuid) to anon, authenticated;
create or replace function public.post_comfort(mid uuid, aname text, abody text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if not exists(select 1 from memorials where id=mid and obit_enabled) then raise exception '부고장을 찾을 수 없습니다'; end if;
  if char_length(coalesce(abody,'')) < 1 or char_length(abody) > 1000 then raise exception '내용을 1000자 이내로 적어 주세요'; end if;
  insert into guestbook(memorial_id,author_id,author_name,body,kind) values (mid,auth.uid(),left(coalesce(nullif(trim(aname),''),'익명'),20),abody,'comfort');
end $$;
grant execute on function public.post_comfort(uuid,text,text) to authenticated;
