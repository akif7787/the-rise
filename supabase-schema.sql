-- The Rise BD (therisebd.com) — Supabase Database, Auth & Storage Schema
-- Run this once in Supabase SQL Editor: https://supabase.com/dashboard/project/ptomtfvwhhocaxgpvesg/sql/new

-- 1. Newsroom Team & Roles (Admin / Editor / Moderator)
create table if not exists public.team_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('Admin', 'Editor', 'Moderator')) default 'Editor',
  created_at timestamptz not null default now()
);
alter table public.team_roles enable row level security;

-- Helper function (non-recursive check for authenticated team members)
create or replace function public.is_newsroom_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_roles
    where email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

create or replace function public.is_newsroom_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_roles
    where email = coalesce(auth.jwt() ->> 'email', '')
      and role = 'Admin'
  );
$$;

create policy "Team members can view team_roles"
  on public.team_roles for select
  to authenticated
  using ( public.is_newsroom_member() or email = coalesce(auth.jwt() ->> 'email', '') );

create policy "Admins can manage team_roles"
  on public.team_roles for all
  to authenticated
  using ( public.is_newsroom_admin() )
  with check ( public.is_newsroom_admin() );

-- 2. Published News Articles
create table if not exists public.news_articles (
  id text primary key,
  topic text not null default 'Policy & Society',
  badge_class text not null default 'policy',
  headline text not null,
  dek text not null default '',
  author_id text,
  author text not null,
  affiliation text default '',
  date_label text not null,
  read_time text default '5 min read',
  image_url text default '',
  image_caption text default '',
  body jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  in_rise_select boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.news_articles enable row level security;

create policy "Public can read published articles"
  on public.news_articles for select
  to anon, authenticated
  using ( true );

create policy "Newsroom can manage articles"
  on public.news_articles for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 3. Published Achiever Spotlights
create table if not exists public.spotlights (
  id text primary key,
  name text not null,
  category text not null default 'Research',
  cats text not null default 'Research',
  achievement text not null,
  image_url text default '',
  monogram text default '',
  color text default '#111827',
  summary text not null default '',
  headline text not null,
  featured_date text not null,
  journey jsonb not null default '[]'::jsonb,
  body jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  in_rise_select boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.spotlights enable row level security;

create policy "Public can read spotlights"
  on public.spotlights for select
  to anon, authenticated
  using ( true );

create policy "Newsroom can manage spotlights"
  on public.spotlights for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 4. Authors Directory
create table if not exists public.authors (
  id text primary key,
  name text not null,
  role text not null,
  institution text default '',
  photo_url text default '',
  bio text default '',
  email text default '',
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.authors enable row level security;

create policy "Public can read authors"
  on public.authors for select
  to anon, authenticated
  using ( true );

create policy "Newsroom can manage authors"
  on public.authors for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 5. Pending Article Submissions (from submit-article.html)
create table if not exists public.article_submissions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  author text not null,
  email text not null,
  whatsapp text default '',
  affiliation text default '',
  topic text not null,
  city text default '',
  headline text not null,
  dek text default '',
  body_text text not null,
  sources text default '',
  submitted_at timestamptz not null default now()
);
alter table public.article_submissions enable row level security;

create policy "Anyone can submit articles"
  on public.article_submissions for insert
  to anon, authenticated
  with check ( true );

create policy "Newsroom can review article submissions"
  on public.article_submissions for select
  to authenticated
  using ( public.is_newsroom_member() );

create policy "Newsroom can update article submissions"
  on public.article_submissions for update
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 6. Pending Nominations (from nominate.html)
create table if not exists public.nomination_submissions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  name text not null,
  email text not null,
  whatsapp text default '',
  address text default '',
  category text not null,
  achievement text not null,
  headline text default '',
  body_text text not null,
  proof_link text default '',
  submitted_at timestamptz not null default now()
);
alter table public.nomination_submissions enable row level security;

create policy "Anyone can submit nominations"
  on public.nomination_submissions for insert
  to anon, authenticated
  with check ( true );

create policy "Newsroom can review nominations"
  on public.nomination_submissions for select
  to authenticated
  using ( public.is_newsroom_member() );

create policy "Newsroom can update nominations"
  on public.nomination_submissions for update
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 7. Advertiser & Contact Inquiries (from advertise.html & contact.html)
create table if not exists public.ad_inquiries (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (status in ('new', 'contacted', 'active')),
  name text not null,
  company text default '',
  slot text default '',
  message text not null,
  submitted_at timestamptz not null default now()
);
alter table public.ad_inquiries enable row level security;

create policy "Anyone can submit inquiries"
  on public.ad_inquiries for insert
  to anon, authenticated
  with check ( true );

create policy "Newsroom can manage inquiries"
  on public.ad_inquiries for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 8. Newsletter Subscribers (with chosen topics)
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'index.html',
  topics jsonb not null default '["Latest Stories"]'::jsonb,
  subscribed_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check ( true );

create policy "Newsroom can view and manage subscribers"
  on public.newsletter_subscribers for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 9. Meta-Style Ad Campaigns
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  advertiser text not null,
  run_by text default 'Admin',
  targets jsonb not null default '["home_top"]'::jsonb,
  banner_size text default '1280x120',
  media_type text default 'image',
  media_url text default '',
  title text not null,
  description text default '',
  cta text default 'Learn More',
  href text not null,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused')),
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ad_campaigns enable row level security;

create policy "Public can view active ad campaigns"
  on public.ad_campaigns for select
  to anon, authenticated
  using ( true );

create policy "Newsroom can manage ad campaigns"
  on public.ad_campaigns for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 10. Site Settings (Social Links, Popups, Custom Sections, Ticker, Partnership Stats)
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;

create policy "Public can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using ( true );

create policy "Newsroom can update site settings"
  on public.site_settings for all
  to authenticated
  using ( public.is_newsroom_member() )
  with check ( public.is_newsroom_member() );

-- 11. Live Analytics Events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  item_id text default '',
  event_type text not null default 'pageview',
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;

create policy "Anyone can log pageviews"
  on public.analytics_events for insert
  to anon, authenticated
  with check ( true );

create policy "Newsroom can read analytics"
  on public.analytics_events for select
  to authenticated
  using ( public.is_newsroom_member() );

-- 12. Media Storage Bucket (Images & Videos)
insert into storage.buckets (id, name, public)
values ('newsroom-media', 'newsroom-media', true)
on conflict (id) do nothing;

create policy "Public can view newsroom media"
  on storage.objects for select
  to anon, authenticated
  using ( bucket_id = 'newsroom-media' );

create policy "Newsroom can upload and update media"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'newsroom-media' and public.is_newsroom_member() );

create policy "Newsroom can update media"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'newsroom-media' and public.is_newsroom_member() )
  with check ( bucket_id = 'newsroom-media' and public.is_newsroom_member() );

create policy "Newsroom can delete media"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'newsroom-media' and public.is_newsroom_member() );

-- 13. Seed Initial Admin Account (replace email with your own if different)
insert into public.team_roles (name, email, role)
values ('Mohammed Ahanaf Akif Rahman', 'admin@therisebd.com', 'Admin')
on conflict (email) do nothing;
