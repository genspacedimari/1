/*
==========================================================
GENSPACE PLC
Community / School System
==========================================================
*/

----------------------------------------------------------
-- EXTENSION
----------------------------------------------------------

create extension if not exists pgcrypto;

----------------------------------------------------------
-- SCHOOLS
----------------------------------------------------------

create table if not exists public.schools (

    id uuid primary key default gen_random_uuid(),

    name text not null,

    description text,

    logo_url text,

    owner_teacher_id uuid
        references auth.users(id)
        on delete set null,

    invite_code text unique,

    invite_link text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

----------------------------------------------------------
-- SCHOOL REQUESTS
----------------------------------------------------------

create table if not exists public.school_requests (

    id uuid primary key default gen_random_uuid(),

    student_id uuid
        not null
        references auth.users(id)
        on delete cascade,

    school_id uuid
        not null
        references public.schools(id)
        on delete cascade,

    status text
        default 'pending'
        check(status in ('pending','approved','rejected')),

    created_at timestamptz default now(),

    updated_at timestamptz default now(),

    unique(student_id,school_id)

);

----------------------------------------------------------
-- PROFILES
----------------------------------------------------------

alter table profiles
add column if not exists school_id uuid
references schools(id)
on delete set null;

----------------------------------------------------------
-- CLASSES
----------------------------------------------------------

alter table classes
add column if not exists school_id uuid
references schools(id)
on delete set null;

----------------------------------------------------------
-- EXAMS
----------------------------------------------------------

alter table exams
add column if not exists school_id uuid
references schools(id)
on delete set null;

----------------------------------------------------------
-- INDEX
----------------------------------------------------------

create index if not exists idx_school_name
on schools(name);

create index if not exists idx_school_invite
on schools(invite_code);

create index if not exists idx_school_owner
on schools(owner_teacher_id);

create index if not exists idx_profile_school
on profiles(school_id);

create index if not exists idx_class_school
on classes(school_id);

create index if not exists idx_exam_school
on exams(school_id);

----------------------------------------------------------
-- UPDATE TIMESTAMP
----------------------------------------------------------

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as
$$
begin
    new.updated_at=now();
    return new;
end;
$$;

drop trigger if exists trg_school_updated on schools;

create trigger trg_school_updated

before update on schools

for each row

execute function update_updated_at_column();

drop trigger if exists trg_school_request_updated on school_requests;

create trigger trg_school_request_updated

before update on school_requests

for each row

execute function update_updated_at_column();

----------------------------------------------------------
-- RLS
----------------------------------------------------------

alter table schools enable row level security;

alter table school_requests enable row level security;

----------------------------------------------------------
-- SCHOOL SELECT
----------------------------------------------------------

drop policy if exists select_schools_any_authenticated on schools;

create policy select_schools_any_authenticated

on schools

for select

to authenticated

using (true);

----------------------------------------------------------
-- INSERT SCHOOL
----------------------------------------------------------

drop policy if exists insert_school_owner on schools;

create policy insert_school_owner

on schools

for insert

to authenticated

with check (

auth.uid() = owner_teacher_id

);

----------------------------------------------------------
-- UPDATE SCHOOL
----------------------------------------------------------

drop policy if exists update_school_owner on schools;

create policy update_school_owner

on schools

for update

to authenticated

using (

auth.uid() = owner_teacher_id

)

with check (

auth.uid() = owner_teacher_id

);

----------------------------------------------------------
-- DELETE SCHOOL
----------------------------------------------------------

drop policy if exists delete_school_owner on schools;

create policy delete_school_owner

on schools

for delete

to authenticated

using (

auth.uid() = owner_teacher_id

);

----------------------------------------------------------
-- SCHOOL REQUESTS
----------------------------------------------------------

drop policy if exists insert_school_request on school_requests;

create policy insert_school_request

on school_requests

for insert

to authenticated

with check (

auth.uid() = student_id

);

drop policy if exists select_school_request_student on school_requests;

create policy select_school_request_student

on school_requests

for select

to authenticated

using (

auth.uid() = student_id

);

drop policy if exists teacher_manage_school_request on school_requests;

create policy teacher_manage_school_request

on school_requests

for all

to authenticated

using (

exists(

select 1

from schools

where schools.id=school_requests.school_id

and schools.owner_teacher_id=auth.uid()

)

);

----------------------------------------------------------
-- PROFILE UPDATE
----------------------------------------------------------

drop policy if exists update_own_profile_school on profiles;

create policy update_own_profile_school

on profiles

for update

to authenticated

using (

auth.uid()=id

)

with check (

auth.uid()=id

and role = (
select role
from profiles p
where p.id=auth.uid()
)

);

----------------------------------------------------------
-- INVITE CODE GENERATOR
----------------------------------------------------------

create or replace function generate_school_invite_code()

returns text

language plpgsql

as
$$
declare
code text;
begin

loop

code :=
'GEN-'||

upper(substr(md5(random()::text),1,6));

exit when not exists(

select 1

from schools

where invite_code=code

);

end loop;

return code;

end;
$$;

----------------------------------------------------------
-- AUTO INVITE CODE
----------------------------------------------------------

create or replace function school_before_insert()

returns trigger

language plpgsql

as
$$
begin

if new.invite_code is null then

new.invite_code:=generate_school_invite_code();

end if;

return new;

end;
$$;

drop trigger if exists trg_school_before_insert on schools;

create trigger trg_school_before_insert

before insert

on schools

for each row

execute function school_before_insert();
