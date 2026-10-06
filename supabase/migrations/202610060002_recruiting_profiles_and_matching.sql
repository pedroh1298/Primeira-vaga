-- Perfis profissionais, dados de recrutamento e compatibilidade entre vaga e candidato.

alter table public.profiles
  add column if not exists headline text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists education_level text,
  add column if not exists course text,
  add column if not exists institution text,
  add column if not exists graduation_year integer,
  add column if not exists availability text[] not null default '{}',
  add column if not exists preferred_work_models text[] not null default '{}',
  add column if not exists skills text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists linkedin_url text,
  add column if not exists portfolio_url text,
  add column if not exists experience_summary text;

alter table public.companies
  add column if not exists industry text,
  add column if not exists company_size text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists culture text,
  add column if not exists benefits text[] not null default '{}',
  add column if not exists contact_name text,
  add column if not exists contact_role text;

alter table public.jobs
  add column if not exists area text,
  add column if not exists employment_type text,
  add column if not exists education_level text,
  add column if not exists required_skills text[] not null default '{}',
  add column if not exists optional_skills text[] not null default '{}',
  add column if not exists work_schedule text,
  add column if not exists slots integer not null default 1,
  add column if not exists application_deadline date,
  add column if not exists is_active boolean not null default true;

alter table public.applications
  add column if not exists compatibility_score integer not null default 0,
  add column if not exists compatibility_breakdown jsonb not null default '{}'::jsonb;

create unique index if not exists companies_user_id_unique on public.companies (user_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_graduation_year_valid') then
    alter table public.profiles add constraint profiles_graduation_year_valid
      check (graduation_year is null or graduation_year between 1950 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_slots_valid') then
    alter table public.jobs add constraint jobs_slots_valid check (slots between 1 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_score_valid') then
    alter table public.applications add constraint applications_score_valid
      check (compatibility_score between 0 and 100);
  end if;
end $$;

create or replace function public.education_rank(value text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(value, ''))
    when 'fundamental' then 1
    when 'medio_cursando' then 2
    when 'medio_completo' then 3
    when 'tecnico_cursando' then 4
    when 'tecnico_completo' then 5
    when 'superior_cursando' then 6
    when 'superior_completo' then 7
    when 'pos_graduacao' then 8
    else 0
  end;
$$;

create or replace function public.calculate_job_compatibility(job_id_input uuid, applicant_id_input uuid)
returns table(score integer, breakdown jsonb)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  candidate public.profiles%rowtype;
  vacancy public.jobs%rowtype;
  required_count integer := 0;
  matched_count integer := 0;
  skills_points integer := 0;
  area_points integer := 0;
  education_points integer := 0;
  model_points integer := 0;
  location_points integer := 0;
  profile_points integer := 0;
begin
  select * into candidate from public.profiles where id = applicant_id_input;
  select * into vacancy from public.jobs where id = job_id_input;

  if candidate.id is null or vacancy.id is null then
    return query select 0, jsonb_build_object('erro', 'Perfil ou vaga não encontrado');
    return;
  end if;

  select count(*) into required_count
  from unnest(coalesce(vacancy.required_skills, '{}')) required_skill
  where trim(required_skill) <> '';

  if required_count = 0 then
    skills_points := 35;
  else
    select count(*) into matched_count
    from unnest(vacancy.required_skills) required_skill
    where exists (
      select 1 from unnest(coalesce(candidate.skills, '{}')) candidate_skill
      where lower(trim(candidate_skill)) = lower(trim(required_skill))
    );
    skills_points := round(35.0 * matched_count / required_count);
  end if;

  if coalesce(trim(vacancy.area), '') = '' then
    area_points := 20;
  elsif lower(trim(candidate.area)) = lower(trim(vacancy.area)) then
    area_points := 20;
  end if;

  if coalesce(trim(vacancy.education_level), '') = '' then
    education_points := 15;
  elsif public.education_rank(candidate.education_level) >= public.education_rank(vacancy.education_level) then
    education_points := 15;
  end if;

  if cardinality(coalesce(candidate.preferred_work_models, '{}')) = 0 then
    model_points := 8;
  elsif exists (
    select 1 from unnest(candidate.preferred_work_models) preferred_model
    where lower(trim(preferred_model)) = lower(trim(vacancy.type))
  ) then
    model_points := 15;
  end if;

  if lower(coalesce(vacancy.type, '')) = 'remoto' then
    location_points := 10;
  elsif coalesce(trim(candidate.city), '') <> ''
    and lower(vacancy.location) like '%' || lower(trim(candidate.city)) || '%' then
    location_points := 10;
  end if;

  profile_points :=
    case when coalesce(trim(candidate.headline), '') <> '' then 1 else 0 end +
    case when coalesce(trim(candidate.bio), '') <> '' then 1 else 0 end +
    case when coalesce(trim(candidate.education_level), '') <> '' then 1 else 0 end +
    case when cardinality(coalesce(candidate.availability, '{}')) > 0 then 1 else 0 end +
    case when coalesce(trim(candidate.resume_url), '') <> '' then 1 else 0 end;

  score := least(100, skills_points + area_points + education_points + model_points + location_points + profile_points);
  breakdown := jsonb_build_object(
    'habilidades', jsonb_build_object('pontos', skills_points, 'maximo', 35, 'correspondencias', matched_count, 'requisitos', required_count),
    'area', jsonb_build_object('pontos', area_points, 'maximo', 20),
    'escolaridade', jsonb_build_object('pontos', education_points, 'maximo', 15),
    'modelo_trabalho', jsonb_build_object('pontos', model_points, 'maximo', 15),
    'localizacao', jsonb_build_object('pontos', location_points, 'maximo', 10),
    'perfil', jsonb_build_object('pontos', profile_points, 'maximo', 5)
  );
  return next;
end;
$$;

create or replace function public.set_application_compatibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  result record;
begin
  select * into result from public.calculate_job_compatibility(new.job_id, new.applicant_id);
  new.compatibility_score := coalesce(result.score, 0);
  new.compatibility_breakdown := coalesce(result.breakdown, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists applications_calculate_compatibility on public.applications;
create trigger applications_calculate_compatibility
  before insert or update of job_id, applicant_id on public.applications
  for each row execute function public.set_application_compatibility();

create or replace function public.refresh_profile_application_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications
  set applicant_id = applicant_id
  where applicant_id = new.id;
  return new;
end;
$$;

create or replace function public.refresh_job_application_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications
  set job_id = job_id
  where job_id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_refresh_compatibility on public.profiles;
create trigger profiles_refresh_compatibility
  after update of headline, bio, area, city, state, education_level, availability,
    preferred_work_models, skills, resume_url
  on public.profiles
  for each row execute function public.refresh_profile_application_scores();

drop trigger if exists jobs_refresh_compatibility on public.jobs;
create trigger jobs_refresh_compatibility
  after update of area, type, location, education_level, required_skills
  on public.jobs
  for each row execute function public.refresh_job_application_scores();

-- Recalcula candidaturas existentes.
update public.applications set applicant_id = applicant_id;

create index if not exists applications_job_score_idx
  on public.applications (job_id, compatibility_score desc, created_at desc);
create index if not exists jobs_active_created_idx
  on public.jobs (is_active, created_at desc);

grant execute on function public.calculate_job_compatibility(uuid, uuid) to authenticated;
