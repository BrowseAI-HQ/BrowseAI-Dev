-- Waitlist table for Pro signups
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'landing_page',
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

create policy "Service role can manage waitlist"
  on waitlist for all
  using (true)
  with check (true);

-- Track client type (python-sdk, mcp, web, curl, api) on queries
alter table browse_results add column if not exists client text;
