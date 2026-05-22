create table if not exists public.shared_news_articles (
  id text primary key,
  review_month text not null check (review_month ~ '^\d{4}-\d{2}$'),
  symbol text not null,
  title text not null,
  summary text,
  url text not null,
  source text not null,
  provider text not null,
  published_at timestamptz,
  collected_at timestamptz,
  cached_at timestamptz,
  last_fetched_at timestamptz,
  signal text not null check (signal in ('positive', 'neutral', 'negative')),
  signal_score double precision not null,
  matched_terms jsonb not null default '[]'::jsonb,
  raw jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists shared_news_articles_symbol_review_month_idx
  on public.shared_news_articles (symbol, review_month);

create index if not exists shared_news_articles_symbol_last_fetched_idx
  on public.shared_news_articles (symbol, last_fetched_at desc);

create table if not exists public.shared_news_analyses (
  id text primary key,
  article_id text not null,
  review_month text not null check (review_month ~ '^\d{4}-\d{2}$'),
  symbol text not null,
  url text not null,
  title text not null,
  source text not null,
  published_at timestamptz,
  analyzed_at timestamptz not null,
  analysis_mode text not null check (analysis_mode in ('testing', 'performance')),
  primary_model text not null,
  final_model text not null,
  escalated_model text,
  article_text_status text not null check (article_text_status in ('read', 'summaryOnly', 'unavailable')),
  signal text not null check (signal in ('positive', 'neutral', 'negative')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  materiality text not null check (materiality in ('low', 'medium', 'high')),
  thesis_impact_score double precision not null,
  category text not null,
  time_horizon text not null,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  should_escalate boolean not null default false,
  escalation_reason text not null default '',
  raw jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists shared_news_analyses_symbol_review_month_idx
  on public.shared_news_analyses (symbol, review_month);

create index if not exists shared_news_analyses_article_id_idx
  on public.shared_news_analyses (article_id);

alter table public.shared_news_articles enable row level security;
alter table public.shared_news_analyses enable row level security;
