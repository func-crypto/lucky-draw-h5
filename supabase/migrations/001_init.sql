create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_count integer not null default 0,
  remain_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists draw_records (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  prize_id uuid references prizes(id),
  verify_code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_draw_records_user_key on draw_records(user_key);
