-- ROME 4.0 reference tables (docs/ROME.md section 11, docs/QUESTIONS.md C45).
-- Natural keys are unique columns; every table still has a uuid id.
-- Read-only for signed-in users, loaded by scripts/import-rome.ts with the secret key.

create table public.rome_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  published_at date,
  validated_at date,
  comment text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rome_grand_domaines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rome_grand_domaines_code_format check (code ~ '^[A-Z]$')
);

create table public.rome_domaines_professionnels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  grand_domaine text not null references public.rome_grand_domaines (code),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rome_domaines_professionnels_code_format check (code ~ '^[A-Z][0-9]{2}$')
);

create table public.rome_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  domaine_professionnel text not null references public.rome_domaines_professionnels (code),
  code_rome_parent text,
  transition_eco text,
  transition_num boolean,
  transition_demo boolean,
  emploi_reglemente boolean,
  emploi_cadre boolean,
  rome_version integer not null references public.rome_versions (version),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rome_codes_code_format check (code ~ '^[A-Z][0-9]{4}$')
);

create table public.rome_appellations (
  id uuid primary key default gen_random_uuid(),
  code_ogr integer not null unique,
  code_rome text not null references public.rome_codes (code),
  label_long text not null,
  label_short text not null,
  classification text not null,
  peu_usite boolean not null default false,
  rome_version integer not null references public.rome_versions (version),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rome_appellations_classification_values check (classification in ('PRINCIPALE', 'SYNONYME'))
);
create index rome_appellations_code_rome_idx on public.rome_appellations (code_rome);

create trigger set_updated_at before update on public.rome_versions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rome_grand_domaines for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rome_domaines_professionnels for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rome_codes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rome_appellations for each row execute function public.set_updated_at();

alter table public.rome_versions enable row level security;
alter table public.rome_grand_domaines enable row level security;
alter table public.rome_domaines_professionnels enable row level security;
alter table public.rome_codes enable row level security;
alter table public.rome_appellations enable row level security;

create policy rome_versions_select_authenticated on public.rome_versions for select to authenticated using (true);
create policy rome_grand_domaines_select_authenticated on public.rome_grand_domaines for select to authenticated using (true);
create policy rome_domaines_professionnels_select_authenticated on public.rome_domaines_professionnels for select to authenticated using (true);
create policy rome_codes_select_authenticated on public.rome_codes for select to authenticated using (true);
create policy rome_appellations_select_authenticated on public.rome_appellations for select to authenticated using (true);

revoke all on table
  public.rome_versions, public.rome_grand_domaines, public.rome_domaines_professionnels,
  public.rome_codes, public.rome_appellations
from anon;
revoke insert, update, delete on table
  public.rome_versions, public.rome_grand_domaines, public.rome_domaines_professionnels,
  public.rome_codes, public.rome_appellations
from authenticated;
