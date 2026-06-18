


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."frage_status" AS ENUM (
    'neu',
    'bei_fachstelle',
    'antwort_eingegangen',
    'freigegeben'
);


ALTER TYPE "public"."frage_status" OWNER TO "postgres";


CREATE TYPE "public"."karten_typ" AS ENUM (
    'polygon',
    'linie',
    'punkt',
    'kreis'
);


ALTER TYPE "public"."karten_typ" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aktuelle_behoerde_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.behoerde_id
    from profile p
    join behoerde b on b.id = p.behoerde_id
   where p.id = auth.uid()
     and p.aktiv = true
     and b.status <> 'gesperrt'
   limit 1;
$$;


ALTER FUNCTION "public"."aktuelle_behoerde_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."aktuelle_behoerde_id"() IS 'Behörde des eingeloggten Nutzers; NULL wenn die Behörde gesperrt ist. Einzige Quelle der Mandanten-Isolation; in jeder RLS-Policy und jeder fachlichen SECURITY-DEFINER-Funktion genutzt. Die Sperre wirkt dadurch zentral (Phase 6).';



CREATE OR REPLACE FUNCTION "public"."archive_faq_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if (OLD.frage is distinct from NEW.frage)
     or (OLD.antwort is distinct from NEW.antwort)
     or (OLD.interne_notiz is distinct from NEW.interne_notiz) then
    insert into faq_version (faq_id, version, frage, antwort, interne_notiz, geaendert_von, behoerde_id)
    values (OLD.id, OLD.version, OLD.frage, OLD.antwort, OLD.interne_notiz, auth.uid(), OLD.behoerde_id);
    NEW.version = OLD.version + 1;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."archive_faq_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."beende_aktive_lage"() RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  if not hat_recht('lage.verwalten') then
    raise exception 'Keine Berechtigung, Lagen zu beenden';
  end if;
  update lage set aktiv = false, beendet_at = now()
   where aktiv = true and behoerde_id = aktuelle_behoerde_id();
  return true;
end $$;


ALTER FUNCTION "public"."beende_aktive_lage"() OWNER TO "postgres";


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profile" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "aktiv" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid",
    "ist_plattform_admin" boolean DEFAULT false NOT NULL,
    "rolle_id" "uuid"
);


ALTER TABLE "public"."profile" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile"() RETURNS SETOF "public"."profile"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_email   text;
  v_profile public.profile;
begin
  if v_user_id is null then
    raise exception 'Nicht eingeloggt' using errcode = '28000';
  end if;

  select * into v_profile from public.profile where id = v_user_id;
  if found then
    return next v_profile;
    return;
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'Auth-User existiert nicht' using errcode = '23503';
  end if;

  v_profile := public.onboarde_nutzer(v_user_id, v_email, null);
  return next v_profile;
end $$;


ALTER FUNCTION "public"."ensure_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_behoerde uuid := aktuelle_behoerde_id();
  v_email    text;
  v_zb       uuid;
  v_konfig_count integer;
  v_ziel_konfig boolean;
begin
  if not public.hat_recht('nutzer.sperren') then
    raise exception 'Kein Recht zum Entfernen' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Man kann sich nicht selbst entfernen' using errcode = '22023';
  end if;

  select email, behoerde_id into v_email, v_zb
    from public.profile where id = p_user_id;
  if v_zb is null or v_zb <> v_behoerde then
    raise exception 'Nutzer gehört nicht zu deiner Behörde' using errcode = '42501';
  end if;

  -- Lockout-Schutz: nicht die letzte Person mit behoerde.konfigurieren entfernen.
  select exists (
    select 1 from public.profile p
    join public.rolle r on r.id = p.rolle_id
    where p.id = p_user_id and 'behoerde.konfigurieren' = any (r.permissions)
  ) into v_ziel_konfig;
  if v_ziel_konfig then
    select count(*) into v_konfig_count
      from public.profile p
      join public.rolle r on r.id = p.rolle_id
      where p.behoerde_id = v_behoerde
        and 'behoerde.konfigurieren' = any (r.permissions);
    if v_konfig_count <= 1 then
      raise exception 'Die letzte Person mit Konfigurationsrecht kann nicht entfernt werden'
        using errcode = '22023';
    end if;
  end if;

  update public.profile
     set behoerde_id = null, rolle_id = null
   where id = p_user_id;

  insert into public.behoerde_ausschluss (behoerde_id, email, erstellt_von)
  values (v_behoerde, v_email, auth.uid())
  on conflict (behoerde_id, lower(email)) do nothing;
end $$;


ALTER FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") IS 'Entfernt einen Nutzer aus der eigenen Behörde (Profil entkoppelt + Ausschluss). Recht: nutzer.sperren. Schützt die letzte Konfig-Person.';



CREATE TABLE IF NOT EXISTS "public"."behoerde" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "typ" "text",
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'aktiv'::"text" NOT NULL,
    "ablauf_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "behoerde_status_check" CHECK (("status" = ANY (ARRAY['aktiv'::"text", 'gesperrt'::"text"]))),
    CONSTRAINT "behoerde_typ_gueltig" CHECK ((("typ" IS NULL) OR ("typ" = ANY (ARRAY['Kommune'::"text", 'Landkreis'::"text", 'Regierung'::"text"]))))
);


ALTER TABLE "public"."behoerde" OWNER TO "postgres";


COMMENT ON TABLE "public"."behoerde" IS 'Mandant. Oberste Klammer: jede fachliche Zeile gehört zu genau einer Behörde.';



COMMENT ON COLUMN "public"."behoerde"."slug" IS 'Stabiler, URL-tauglicher Kurzname (z. B. stadt-musterhausen). Eindeutig.';



COMMENT ON COLUMN "public"."behoerde"."ablauf_at" IS 'Optionaler Verfallszeitpunkt einer Behörde (z. B. zeitlich befristete Instanzen).';



CREATE OR REPLACE FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text" DEFAULT NULL::"text") RETURNS "public"."behoerde"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user     uuid := auth.uid();
  v_email    text;
  v_eigene   text;
  v_slug     text;
  v_behoerde public.behoerde;
  v_admin_id uuid;
begin
  if v_user is null then
    raise exception 'Nicht eingeloggt' using errcode = '28000';
  end if;

  -- Berechtigung aus der einen Schaltzentrale ableiten. Nur wer gründen darf,
  -- darf gründen (unbekannte Nicht-Freemail-Domain, kein Mitglied, kein Antrag).
  if public.mein_onboarding_status() <> 'kann_gruenden' then
    raise exception 'Keine Berechtigung, eine Behörde anzulegen'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Name der Behörde fehlt' using errcode = '22023';
  end if;

  select email into v_email from public.profile where id = v_user;
  v_eigene := lower(split_part(coalesce(v_email, ''), '@', 2));
  if v_eigene = '' then
    raise exception 'Keine gültige E-Mail-Domain' using errcode = '22023';
  end if;

  -- 1. Behörde anlegen (sofort aktiv -> kein Plattform-Oversight)
  v_slug := public.slugify_behoerde(p_name);
  insert into public.behoerde (name, typ, slug, status)
  values (trim(p_name), nullif(trim(coalesce(p_typ, '')), ''), v_slug, 'aktiv')
  returning * into v_behoerde;

  -- 2. Eigene Domain (per Magic-Link bewiesen) der Behörde zuordnen
  insert into public.behoerde_domain (behoerde_id, domain)
  values (v_behoerde.id, v_eigene);

  -- 3. Default-Rollen für die neue Behörde
  perform public.seed_default_rollen(v_behoerde.id);

  -- 4. Gründer wird Administrator:in dieser Behörde
  select id into v_admin_id
    from public.rolle
   where behoerde_id = v_behoerde.id and name = 'Administrator:in'
   limit 1;

  update public.profile
     set behoerde_id = v_behoerde.id,
         rolle_id    = v_admin_id
   where id = v_user;

  return v_behoerde;
end $$;


ALTER FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") IS 'Onboarding-Wizard: legt eine neue Behörde an (sofort nutzbar) + macht den Aufrufer zur Administrator:in anhand seiner per Magic-Link bewiesenen E-Mail-Domain. Erlaubt nur, wenn mein_onboarding_status()=kann_gruenden.';



CREATE OR REPLACE FUNCTION "public"."guard_profile_self_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- Nur direkte Schreibzugriffe der App-Rollen absichern.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Nur die EIGENE Zeile ist relevant. Leitung, die fremde Profile pflegt
  -- (rolle_id/aktiv), trifft new.id <> auth.uid() und passiert ungehindert.
  if new.id is distinct from (select auth.uid()) then
    return new;
  end if;

  if new.ist_plattform_admin is distinct from old.ist_plattform_admin then
    raise exception 'Selbst-Änderung von ist_plattform_admin ist nicht erlaubt'
      using errcode = '42501';
  end if;
  if new.behoerde_id is distinct from old.behoerde_id then
    raise exception 'Selbst-Änderung der Behörde ist nicht erlaubt'
      using errcode = '42501';
  end if;
  if new.rolle_id is distinct from old.rolle_id then
    raise exception 'Selbst-Änderung der Rolle ist nicht erlaubt'
      using errcode = '42501';
  end if;
  if new.aktiv is distinct from old.aktiv then
    raise exception 'Selbst-Änderung des Aktiv-Status ist nicht erlaubt'
      using errcode = '42501';
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."guard_profile_self_escalation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_profile_self_escalation"() IS 'Wächter gegen Selbst-Eskalation: blockt direkte Updates (authenticated/anon) der eigenen profile-Zeile auf ist_plattform_admin/behoerde_id/rolle_id/aktiv. SECURITY-DEFINER-Pfade (Onboarding/Verwaltung als postgres) bleiben frei. Session 87.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.onboarde_nutzer(NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  return NEW;
end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hat_recht"("p_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profile pr
    join public.rolle r on r.id = pr.rolle_id
    where pr.id = auth.uid()
      and pr.aktiv = true
      and p_permission = any (r.permissions)
  );
$$;


ALTER FUNCTION "public"."hat_recht"("p_permission" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hat_recht"("p_permission" "text") IS 'VOX 2 — true, wenn die Rolle des eingeloggten Nutzers die Permission hat (RBAC).';



CREATE OR REPLACE FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  update faq set klick_zaehler = klick_zaehler + 1
   where id = p_faq_id and behoerde_id = aktuelle_behoerde_id();
end;
$$;


ALTER FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ist_freemail"("p_domain" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.freemail_domain where domain = lower(p_domain));
$$;


ALTER FUNCTION "public"."ist_freemail"("p_domain" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ist_freemail"("p_domain" "text") IS 'true, wenn die Domain ein privater Freemail-Anbieter ist (Sperrliste). Konzept 4.3.';



CREATE OR REPLACE FUNCTION "public"."ist_plattform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (select ist_plattform_admin from profile where id = auth.uid() and aktiv = true limit 1),
    false
  );
$$;


ALTER FUNCTION "public"."ist_plattform_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ist_plattform_admin"() IS 'Sonderflag Plattform-Betreiber. Eigene, klar getrennte Policies (Teil C) — weicht die Mandanten-Policies NICHT auf.';



CREATE OR REPLACE FUNCTION "public"."load_buergerfrage_by_token"("p_token" "text") RETURNS TABLE("id" "uuid", "frage_text" "text", "fachstelle_email" "text", "lage_name" "text", "bereits_beantwortet" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_frage_id uuid;
  v_eingeloest timestamptz;
begin
  select t.buergerfrage_id, t.eingeloest_at
    into v_frage_id, v_eingeloest
    from fachstellen_token t
   where t.token = p_token
     and t.ablauf_at > now();

  if v_frage_id is null then
    return;
  end if;

  -- Phase 6: gesperrte Behörde -> nichts ausliefern
  if exists (
    select 1 from buergerfrage bf
      join behoerde b on b.id = bf.behoerde_id
     where bf.id = v_frage_id and b.status = 'gesperrt'
  ) then
    return;
  end if;

  return query
  select bf.id,
         bf.frage_text,
         bf.fachstelle_email,
         l.name,
         (v_eingeloest is not null
          or bf.status in ('antwort_eingegangen', 'freigegeben'))
           as bereits_beantwortet
    from buergerfrage bf
    join lage l on l.id = bf.lage_id
   where bf.id = v_frage_id;
end;
$$;


ALTER FUNCTION "public"."load_buergerfrage_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."load_fachstellen_dialog"("p_token" "text") RETURNS TABLE("richtung" "text", "inhalt" "text", "wann" timestamp with time zone, "autor_name" "text", "autor_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_frage_id uuid;
  v_frage_text text;
  v_erfasst_at timestamptz;
begin
  select t.buergerfrage_id
    into v_frage_id
    from fachstellen_token t
   where t.token = p_token
     and t.ablauf_at > now();

  if v_frage_id is null then
    return;
  end if;

  -- Phase 6: gesperrte Behörde -> kein Dialog
  if exists (
    select 1 from buergerfrage bf
      join behoerde b on b.id = bf.behoerde_id
     where bf.id = v_frage_id and b.status = 'gesperrt'
  ) then
    return;
  end if;

  select bf.frage_text, bf.erfasst_at
    into v_frage_text, v_erfasst_at
    from buergerfrage bf
   where bf.id = v_frage_id;

  return query
  select 'frage'::text, v_frage_text, v_erfasst_at, null::text, null::text
  union all
  select n.richtung, n.text, n.created_at, n.autor_name, n.autor_email
    from fachstellen_nachricht n
   where n.buergerfrage_id = v_frage_id
  order by 3 asc;
end;
$$;


ALTER FUNCTION "public"."load_fachstellen_dialog"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_was text;
  v_id uuid;
  v_alt jsonb;
  v_neu jsonb;
  v_behoerde uuid;
begin
  if TG_OP = 'INSERT' then
    v_was := TG_OP; v_id := NEW.id; v_alt := null; v_neu := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_was := TG_OP; v_id := NEW.id; v_alt := to_jsonb(OLD); v_neu := to_jsonb(NEW);
  else
    v_was := TG_OP; v_id := OLD.id; v_alt := to_jsonb(OLD); v_neu := null;
  end if;

  v_behoerde := coalesce((v_neu->>'behoerde_id')::uuid, (v_alt->>'behoerde_id')::uuid);

  insert into audit_log (wer, was, tabelle, zeile_id, vorher, nachher, behoerde_id)
  values (auth.uid(), v_was, TG_TABLE_NAME, v_id, v_alt, v_neu, v_behoerde);

  return coalesce(NEW, OLD);
end;
$$;


ALTER FUNCTION "public"."log_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."markiere_anfrage_gesehen"("p_buergerfrage_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not hat_recht('anfrage.freigeben') then raise exception 'Keine Berechtigung'; end if;
  update public.buergerfrage
     set gelesen_von_leitung_at = now()
   where id = p_buergerfrage_id
     and behoerde_id = aktuelle_behoerde_id()
     and gelesen_von_leitung_at is null;
end;
$$;


ALTER FUNCTION "public"."markiere_anfrage_gesehen"("p_buergerfrage_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_user uuid := auth.uid();
  v_behoerde uuid := aktuelle_behoerde_id();
begin
  if v_user is null then raise exception 'Nicht eingeloggt'; end if;
  if not exists (select 1 from faq where id = p_faq_id and behoerde_id = v_behoerde) then
    raise exception 'FAQ nicht in eigener Behörde';
  end if;
  insert into faq_gelesen (faq_id, user_id, behoerde_id, gelesen_at)
  values (p_faq_id, v_user, v_behoerde, now())
  on conflict (faq_id, user_id)
    do update set gelesen_at = excluded.gelesen_at;
end;
$$;


ALTER FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mein_onboarding_status"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user     uuid := auth.uid();
  v_behoerde uuid;
  v_rolle    uuid;
  v_email    text;
  v_domain   text;
begin
  if v_user is null then
    return 'nicht_eingeloggt';
  end if;

  select behoerde_id, rolle_id, email
    into v_behoerde, v_rolle, v_email
    from public.profile where id = v_user;

  if v_behoerde is not null and v_rolle is not null then
    return 'mitglied';
  end if;

  v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));
  if v_domain = '' or public.ist_freemail(v_domain) then
    return 'gesperrt';
  end if;

  -- Aus der Behörde dieser Domain ausgeschlossen?
  if exists (
    select 1 from public.behoerde_ausschluss a
    join public.behoerde_domain d on d.behoerde_id = a.behoerde_id
    where d.domain = v_domain and lower(a.email) = lower(v_email)
  ) then
    return 'gesperrt';
  end if;

  return 'kann_gruenden';
end $$;


ALTER FUNCTION "public"."mein_onboarding_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mein_onboarding_status"() IS 'Onboarding-Zustand: mitglied | gesperrt (Freemail/keine Domain/ausgeschlossen) | kann_gruenden | nicht_eingeloggt.';



CREATE OR REPLACE FUNCTION "public"."meine_behoerde_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select behoerde_id from profile where id = auth.uid() and aktiv = true limit 1;
$$;


ALTER FUNCTION "public"."meine_behoerde_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."meine_behoerde_id"() IS 'Behörde des eingeloggten Nutzers OHNE Sperr-Check. Nur für Stellen, die den Bezug zur eigenen Behörde unabhängig vom Sperrstatus brauchen (behoerde_select -> gesperrt-Screen). Für die Mandanten-Isolation gilt aktuelle_behoerde_id().';



CREATE OR REPLACE FUNCTION "public"."notiz_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notiz_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text" DEFAULT NULL::"text") RETURNS "public"."profile"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_domain   text;
  v_behoerde uuid;
  v_count    integer;
  v_rolle_id uuid;
  v_name     text;
  v_profile  public.profile;
begin
  -- Schon vorhanden? Dann unverändert zurückgeben (idempotent).
  select * into v_profile from public.profile where id = p_user_id;
  if found then
    return v_profile;
  end if;

  v_domain := lower(split_part(p_email, '@', 2));
  v_name := coalesce(
    nullif(trim(p_meta_name), ''),
    initcap(replace(replace(split_part(p_email, '@', 1), '.', ' '), '_', ' '))
  );

  select behoerde_id into v_behoerde
    from public.behoerde_domain where domain = v_domain limit 1;

  if v_behoerde is not null then
    select count(*) into v_count from public.profile where behoerde_id = v_behoerde;

    if v_count = 0 then
      -- Erste Person einer (frisch angelegten) Behörde -> Administrator:in.
      select id into v_rolle_id from public.rolle
        where behoerde_id = v_behoerde and name = 'Administrator:in' limit 1;

      insert into public.profile (id, email, name, rolle_id, aktiv, behoerde_id)
      values (p_user_id, p_email, v_name, v_rolle_id, true, v_behoerde)
      on conflict (id) do nothing
      returning * into v_profile;

    elsif exists (
      select 1 from public.behoerde_ausschluss
       where behoerde_id = v_behoerde and lower(email) = lower(p_email)
    ) then
      -- Aus dieser Behörde ausgeschlossen -> rechtlos, keine Aufnahme.
      insert into public.profile (id, email, name, rolle_id, aktiv, behoerde_id)
      values (p_user_id, p_email, v_name, null, true, null)
      on conflict (id) do nothing
      returning * into v_profile;

    else
      -- Bekannte Domain mit Mitgliedern -> automatisch Telefonist:in. Fallback
      -- auf die unterste Rolle (höchste reihenfolge), falls umbenannt.
      select id into v_rolle_id from public.rolle
        where behoerde_id = v_behoerde and name = 'Telefonist:in' limit 1;
      if v_rolle_id is null then
        select id into v_rolle_id from public.rolle
          where behoerde_id = v_behoerde
          order by reihenfolge desc limit 1;
      end if;

      insert into public.profile (id, email, name, rolle_id, aktiv, behoerde_id)
      values (p_user_id, p_email, v_name, v_rolle_id, true, v_behoerde)
      on conflict (id) do nothing
      returning * into v_profile;
    end if;
  else
    -- Unbekannte Domain: Gründer-Kandidat oder Freemail. Rechtlos anlegen,
    -- die Unterscheidung trifft mein_onboarding_status().
    insert into public.profile (id, email, name, rolle_id, aktiv, behoerde_id)
    values (p_user_id, p_email, v_name, null, true, null)
    on conflict (id) do nothing
    returning * into v_profile;
  end if;

  -- Falls ON CONFLICT zuschlug (Race), Profil sicher nachladen.
  if v_profile.id is null then
    select * into v_profile from public.profile where id = p_user_id;
  end if;

  return v_profile;
end $$;


ALTER FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") IS 'Onboarding-Zuordnung: leere Behörde -> Admin; bekannte Domain -> Auto-Telefonist:in (außer ausgeschlossen); unbekannte Domain -> rechtlos.';



CREATE OR REPLACE FUNCTION "public"."plattform_behoerden"() RETURNS TABLE("id" "uuid", "name" "text", "typ" "text", "slug" "text", "status" "text", "ablauf_at" timestamp with time zone, "created_at" timestamp with time zone, "mitglieder" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.ist_plattform_admin() then
    raise exception 'Kein Plattform-Admin' using errcode = '42501';
  end if;

  return query
    select
      b.id, b.name, b.typ, b.slug, b.status,
      b.ablauf_at, b.created_at,
      (select count(*) from public.profile p where p.behoerde_id = b.id) as mitglieder
    from public.behoerde b
    order by b.created_at desc;
end $$;


ALTER FUNCTION "public"."plattform_behoerden"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."plattform_behoerden"() IS 'Plattform-Admin-Übersicht: alle Behörden + Mitgliederzahl, neueste zuerst. Nur ist_plattform_admin (sonst 42501).';



CREATE OR REPLACE FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_token text;
  v_email text;
  v_behoerde uuid := aktuelle_behoerde_id();
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  if not hat_recht('anfrage.an_fachstelle') then
    raise exception 'Keine Berechtigung, Anfragen an Fachstellen zu senden';
  end if;

  if p_email is not null and length(trim(p_email)) > 0 then
    v_email := trim(p_email);
    if position('@' in v_email) = 0 then
      raise exception 'Empfänger-E-Mail ungültig';
    end if;
    -- Existenz/Behörde der Frage trotzdem prüfen
    if not exists (select 1 from buergerfrage where id = p_buergerfrage_id and behoerde_id = v_behoerde) then
      raise exception 'Bürgerfrage nicht gefunden';
    end if;
  else
    select fachstelle_email into v_email
    from buergerfrage where id = p_buergerfrage_id and behoerde_id = v_behoerde;
    if not found then raise exception 'Bürgerfrage nicht gefunden'; end if;
    if v_email is null or v_email = '' then
      raise exception 'Bürgerfrage hat keine Fachstellen-E-Mail';
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  insert into fachstellen_token (buergerfrage_id, token, ablauf_at, empfaenger_email, behoerde_id)
  values (p_buergerfrage_id, v_token, now() + interval '7 days', v_email, v_behoerde);

  update buergerfrage set status = 'bei_fachstelle'
   where id = p_buergerfrage_id and behoerde_id = v_behoerde and status in ('neu', 'bei_fachstelle');

  return v_token;
end;
$$;


ALTER FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_rollen"("p_behoerde_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_admin uuid;
  v_leitung uuid;
begin
  insert into public.rolle (behoerde_id, name, beschreibung, permissions, parent_rolle_id, reihenfolge, ist_system)
  values (
    p_behoerde_id, 'Administrator:in',
    'Vollzugriff inklusive Nutzer- und Behördenverwaltung.',
    array[
      'faq.lesen', 'faq.erstellen', 'faq.bearbeiten', 'faq.loeschen', 'faq.sichtbarkeit',
      'anfrage.erfassen', 'anfrage.an_fachstelle', 'anfrage.freigeben',
      'karte.ansehen', 'karte.zeichnen', 'karte.bearbeiten',
      'lage.verwalten', 'vorlage.verwalten',
      'nutzer.einladen', 'nutzer.rollen_verwalten', 'nutzer.sperren',
      'behoerde.konfigurieren', 'audit.einsehen'
    ]::text[],
    null, 1, true
  )
  returning id into v_admin;

  insert into public.rolle (behoerde_id, name, beschreibung, permissions, parent_rolle_id, reihenfolge, ist_system)
  values (
    p_behoerde_id, 'Leitung Bürgertelefon',
    'Fachliche Leitung: FAQ, Anfragen, Karte, Lage und Vorlagen verwalten.',
    array[
      'faq.lesen', 'faq.erstellen', 'faq.bearbeiten', 'faq.loeschen', 'faq.sichtbarkeit',
      'anfrage.erfassen', 'anfrage.an_fachstelle', 'anfrage.freigeben',
      'karte.ansehen', 'karte.zeichnen', 'karte.bearbeiten',
      'lage.verwalten', 'vorlage.verwalten', 'audit.einsehen'
    ]::text[],
    v_admin, 2, true
  )
  returning id into v_leitung;

  insert into public.rolle (behoerde_id, name, beschreibung, permissions, parent_rolle_id, reihenfolge, ist_system)
  values (
    p_behoerde_id, 'Telefonist:in',
    'Nimmt Bürgeranfragen auf, liest FAQ und sieht die Lagekarte.',
    array['faq.lesen', 'anfrage.erfassen', 'karte.ansehen']::text[],
    v_leitung, 3, true
  );
end $$;


ALTER FUNCTION "public"."seed_default_rollen"("p_behoerde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_behoerde"("p_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_base text;
  v_slug text;
  v_n    integer := 1;
begin
  v_base := lower(coalesce(p_name, ''));
  v_base := replace(v_base, 'ä', 'ae');
  v_base := replace(v_base, 'ö', 'oe');
  v_base := replace(v_base, 'ü', 'ue');
  v_base := replace(v_base, 'ß', 'ss');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'behoerde';
  end if;

  v_slug := v_base;
  while exists (select 1 from public.behoerde where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  return v_slug;
end $$;


ALTER FUNCTION "public"."slugify_behoerde"("p_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."slugify_behoerde"("p_name" "text") IS 'Erzeugt einen in public.behoerde eindeutigen, URL-tauglichen Slug aus einem Namen. Nur intern (von gruende_behoerde) genutzt.';



CREATE OR REPLACE FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_behoerde uuid := aktuelle_behoerde_id();
  v_lage_id uuid;
  v_vorlage record;
  v_kat jsonb;
  v_faq jsonb;
  v_kat_map jsonb := '{}'::jsonb;
  v_kat_id uuid;
begin
  if v_user is null then raise exception 'Nicht eingeloggt'; end if;
  if not hat_recht('lage.verwalten') then
    raise exception 'Keine Berechtigung, Lagen zu starten';
  end if;

  select * into v_vorlage from lage_vorlage
   where id = p_vorlage_id and behoerde_id = v_behoerde;
  if v_vorlage is null then raise exception 'Vorlage nicht gefunden'; end if;

  update lage set aktiv = false, beendet_at = now()
   where aktiv = true and behoerde_id = v_behoerde;

  insert into lage (name, aktiv, gestartet_at, behoerde_id)
  values (
    coalesce(nullif(trim(p_name), ''), v_vorlage.name),
    true, now(), v_behoerde
  )
  returning id into v_lage_id;

  for v_kat in select * from jsonb_array_elements(v_vorlage.kategorien)
  loop
    insert into kategorie (lage_id, name, reihenfolge, behoerde_id)
    values (
      v_lage_id, v_kat->>'name',
      coalesce((v_kat->>'reihenfolge')::int, 0), v_behoerde
    )
    returning id into v_kat_id;
    v_kat_map := v_kat_map || jsonb_build_object(v_kat->>'name', v_kat_id::text);
  end loop;

  for v_faq in select * from jsonb_array_elements(v_vorlage.standard_faqs)
  loop
    insert into faq (lage_id, kategorie_id, frage, antwort, autor_id, sichtbar, behoerde_id)
    values (
      v_lage_id,
      case
        when v_kat_map ? (v_faq->>'kategorie')
          then ((v_kat_map->>(v_faq->>'kategorie'))::uuid)
        else null
      end,
      v_faq->>'frage', v_faq->>'antwort', v_user, false, v_behoerde
    );
  end loop;

  return v_lage_id;
end $$;


ALTER FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."starte_leere_lage"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_behoerde uuid := aktuelle_behoerde_id();
  v_lage_id uuid;
begin
  if v_user is null then raise exception 'Nicht eingeloggt'; end if;
  if not hat_recht('lage.verwalten') then
    raise exception 'Keine Berechtigung, Lagen zu starten';
  end if;

  update lage set aktiv = false, beendet_at = now()
   where aktiv = true and behoerde_id = v_behoerde;

  insert into lage (name, aktiv, gestartet_at, behoerde_id)
  values (
    coalesce(nullif(trim(p_name), ''), 'Neue Lage'),
    true, now(), v_behoerde
  )
  returning id into v_lage_id;

  return v_lage_id;
end $$;


ALTER FUNCTION "public"."starte_leere_lage"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_token text;
  v_status frage_status;
  v_antwort_text text;
  v_antwort_email text;
  v_antwort_name text;
  v_antwort_at timestamptz;
  v_email text;
  v_leitung_email text;
  v_leitung_name text;
  v_behoerde uuid := aktuelle_behoerde_id();
begin
  if not hat_recht('anfrage.freigeben') then
    raise exception 'Keine Berechtigung, Rückfragen zu stellen.';
  end if;
  if p_rueckfrage is null or length(trim(p_rueckfrage)) < 5 then
    raise exception 'Rückfrage zu kurz.';
  end if;

  select email, name into v_leitung_email, v_leitung_name
    from profile where id = auth.uid();

  select status, antwort_text, antwort_von_email, antwort_von_name, antwort_at, fachstelle_email
    into v_status, v_antwort_text, v_antwort_email, v_antwort_name, v_antwort_at, v_email
    from buergerfrage
   where id = p_buergerfrage_id and behoerde_id = v_behoerde;

  if v_status is null then
    raise exception 'Bürgerfrage nicht gefunden.';
  end if;
  if v_status <> 'antwort_eingegangen' then
    raise exception 'Rückfrage ist nur bei eingegangenen Antworten möglich.';
  end if;

  if p_email is not null and length(trim(p_email)) > 0 then
    if position('@' in p_email) = 0 then
      raise exception 'Empfänger-E-Mail ungültig';
    end if;
    v_email := trim(p_email);
  end if;
  if v_email is null or v_email = '' then
    raise exception 'Keine Fachstellen-E-Mail hinterlegt.';
  end if;

  if v_antwort_text is not null and length(trim(v_antwort_text)) > 0 then
    insert into fachstellen_nachricht (buergerfrage_id, richtung, text, autor_email, autor_name, created_at, behoerde_id)
    values (p_buergerfrage_id, 'antwort', v_antwort_text, v_antwort_email, v_antwort_name, coalesce(v_antwort_at, now()), v_behoerde);
  end if;

  insert into fachstellen_nachricht (buergerfrage_id, richtung, text, autor_email, autor_name, behoerde_id)
  values (p_buergerfrage_id, 'frage', trim(p_rueckfrage), v_leitung_email, v_leitung_name, v_behoerde);

  update buergerfrage
     set antwort_text = null, antwort_von_email = null, antwort_von_name = null,
         antwort_at = null, antwort_redaktion = null,
         status = 'bei_fachstelle', fachstelle_email = v_email
   where id = p_buergerfrage_id and behoerde_id = v_behoerde;

  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  insert into fachstellen_token (buergerfrage_id, token, ablauf_at, empfaenger_email, behoerde_id)
  values (p_buergerfrage_id, v_token, now() + interval '7 days', v_email, v_behoerde);

  return v_token;
end;
$$;


ALTER FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_fachstellen_antwort"("p_token" "text", "p_antwort" "text", "p_email" "text", "p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_frage_id uuid;
begin
  if p_antwort is null or length(trim(p_antwort)) < 5 then
    raise exception 'Antwort zu kurz';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'E-Mail ungültig';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Bitte Ihren Namen angeben.';
  end if;

  -- Phase 6: gesperrte Behörde blockt die Einreichung (Token bleibt unverbraucht)
  if exists (
    select 1 from fachstellen_token t
      join buergerfrage bf on bf.id = t.buergerfrage_id
      join behoerde b on b.id = bf.behoerde_id
     where t.token = p_token and b.status = 'gesperrt'
  ) then
    raise exception 'Diese Behörde ist derzeit gesperrt. Eine Antwort ist nicht möglich.';
  end if;

  update fachstellen_token
     set eingeloest_at = now()
   where token = p_token
     and ablauf_at > now()
     and eingeloest_at is null
  returning buergerfrage_id into v_frage_id;

  if v_frage_id is null then
    raise exception 'Token ungültig oder bereits eingelöst';
  end if;

  update buergerfrage
     set antwort_text = p_antwort,
         antwort_von_email = p_email,
         antwort_von_name = trim(p_name),
         antwort_at = now(),
         status = 'antwort_eingegangen'
   where id = v_frage_id
     and status in ('neu', 'bei_fachstelle');

  if not found then
    raise exception 'Diese Bürgerfrage wurde bereits von einer anderen Stelle beantwortet.';
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."submit_fachstellen_antwort"("p_token" "text", "p_antwort" "text", "p_email" "text", "p_name" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wer" "uuid",
    "was" "text" NOT NULL,
    "tabelle" "text",
    "zeile_id" "uuid",
    "vorher" "jsonb",
    "nachher" "jsonb",
    "wann" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."behoerde_ausschluss" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "behoerde_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "erstellt_von" "uuid",
    "erstellt_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."behoerde_ausschluss" OWNER TO "postgres";


COMMENT ON TABLE "public"."behoerde_ausschluss" IS 'Aus einer Behörde entfernte E-Mail-Adressen. Verhindert die automatische Wiederaufnahme per Domain-Login. Pflege über entferne_nutzer() bzw. delete (nutzer.sperren).';



CREATE TABLE IF NOT EXISTS "public"."behoerde_domain" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "behoerde_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."behoerde_domain" OWNER TO "postgres";


COMMENT ON TABLE "public"."behoerde_domain" IS 'Dienstliche E-Mail-Domains einer Behörde. Vertrauensanker fürs Self-Service-Onboarding (Phase 4).';



CREATE TABLE IF NOT EXISTS "public"."buergerfrage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lage_id" "uuid" NOT NULL,
    "frage_text" "text" NOT NULL,
    "kategorie_id" "uuid",
    "fachstelle_email" "text",
    "status" "public"."frage_status" DEFAULT 'neu'::"public"."frage_status" NOT NULL,
    "antwort_text" "text",
    "antwort_von_email" "text",
    "antwort_at" timestamp with time zone,
    "erfasst_von" "uuid" NOT NULL,
    "erfasst_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "freigegeben_von" "uuid",
    "freigegeben_at" timestamp with time zone,
    "ins_faq_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "antwort_redaktion" "text",
    "gelesen_von_leitung_at" timestamp with time zone,
    "bezug_faq_id" "uuid",
    "antwort_von_name" "text",
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."buergerfrage" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."buergerfrage_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "lage_id",
    "frage_text",
    "kategorie_id",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "fachstelle_email"
            ELSE NULL::"text"
        END AS "fachstelle_email",
    "status",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "antwort_text"
            ELSE NULL::"text"
        END AS "antwort_text",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "antwort_von_email"
            ELSE NULL::"text"
        END AS "antwort_von_email",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "antwort_at"
            ELSE NULL::timestamp with time zone
        END AS "antwort_at",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "antwort_redaktion"
            ELSE NULL::"text"
        END AS "antwort_redaktion",
        CASE
            WHEN ("status" = 'freigegeben'::"public"."frage_status") THEN COALESCE("antwort_redaktion", "antwort_text")
            ELSE NULL::"text"
        END AS "antwort_oeffentlich",
    "erfasst_von",
    "erfasst_at",
    "freigegeben_von",
    "freigegeben_at",
    "ins_faq_id",
    "updated_at",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN ("status")::"text"
            WHEN ("status" = 'antwort_eingegangen'::"public"."frage_status") THEN 'bei_fachstelle'::"text"
            ELSE ("status")::"text"
        END AS "anzeige_status",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "gelesen_von_leitung_at"
            ELSE NULL::timestamp with time zone
        END AS "gelesen_von_leitung_at",
    "bezug_faq_id",
        CASE
            WHEN "public"."hat_recht"('anfrage.freigeben'::"text") THEN "antwort_von_name"
            ELSE NULL::"text"
        END AS "antwort_von_name"
   FROM "public"."buergerfrage" "bf";


ALTER VIEW "public"."buergerfrage_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fachstellen_nachricht" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buergerfrage_id" "uuid" NOT NULL,
    "richtung" "text" NOT NULL,
    "text" "text" NOT NULL,
    "autor_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autor_name" "text",
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL,
    CONSTRAINT "fachstellen_nachricht_richtung_check" CHECK (("richtung" = ANY (ARRAY['frage'::"text", 'antwort'::"text"])))
);


ALTER TABLE "public"."fachstellen_nachricht" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fachstellen_token" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buergerfrage_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "ablauf_at" timestamp with time zone NOT NULL,
    "eingeloest_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "empfaenger_email" "text",
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."fachstellen_token" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lage_id" "uuid" NOT NULL,
    "kategorie_id" "uuid",
    "frage" "text" NOT NULL,
    "antwort" "text" NOT NULL,
    "interne_notiz" "text",
    "stand_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autor_id" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sichtbar" boolean DEFAULT true NOT NULL,
    "klick_zaehler" integer DEFAULT 0 NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."faq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_gelesen" (
    "faq_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gelesen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."faq_gelesen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "aktiv" boolean DEFAULT false NOT NULL,
    "gestartet_at" timestamp with time zone,
    "beendet_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "map_center_lat" numeric,
    "map_center_lon" numeric,
    "map_default_zoom" integer,
    "map_focus_city" "text",
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL,
    CONSTRAINT "lage_map_center_complete" CHECK (((("map_center_lat" IS NULL) AND ("map_center_lon" IS NULL)) OR (("map_center_lat" IS NOT NULL) AND ("map_center_lon" IS NOT NULL)))),
    CONSTRAINT "lage_map_center_lat_range" CHECK ((("map_center_lat" IS NULL) OR (("map_center_lat" >= ('-90'::integer)::numeric) AND ("map_center_lat" <= (90)::numeric)))),
    CONSTRAINT "lage_map_center_lon_range" CHECK ((("map_center_lon" IS NULL) OR (("map_center_lon" >= ('-180'::integer)::numeric) AND ("map_center_lon" <= (180)::numeric)))),
    CONSTRAINT "lage_map_default_zoom_range" CHECK ((("map_default_zoom" IS NULL) OR (("map_default_zoom" >= 1) AND ("map_default_zoom" <= 18))))
);


ALTER TABLE "public"."lage" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."faq_ungelesen_pro_user" WITH ("security_invoker"='true') AS
 SELECT "f"."id" AS "faq_id",
    "f"."frage",
    "f"."antwort",
    "f"."stand_at",
    "f"."lage_id",
    "l"."aktiv" AS "lage_aktiv",
    "fg"."gelesen_at"
   FROM (("public"."faq" "f"
     JOIN "public"."lage" "l" ON (("l"."id" = "f"."lage_id")))
     LEFT JOIN "public"."faq_gelesen" "fg" ON ((("fg"."faq_id" = "f"."id") AND ("fg"."user_id" = "auth"."uid"()))))
  WHERE (("f"."sichtbar" = true) AND ("l"."aktiv" = true) AND (("fg"."gelesen_at" IS NULL) OR ("fg"."gelesen_at" < "f"."stand_at")));


ALTER VIEW "public"."faq_ungelesen_pro_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_version" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faq_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "frage" "text" NOT NULL,
    "antwort" "text" NOT NULL,
    "interne_notiz" "text",
    "geaendert_von" "uuid",
    "geaendert_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."faq_version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."freemail_domain" (
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."freemail_domain" OWNER TO "postgres";


COMMENT ON TABLE "public"."freemail_domain" IS 'Sperrliste privater E-Mail-Anbieter. Solche Domains dürfen keine Behörde anlegen (Konzept 4.3). Vom Plattform-Admin pflegbar.';



CREATE TABLE IF NOT EXISTS "public"."kartenobjekt" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lage_id" "uuid" NOT NULL,
    "typ" "public"."karten_typ" NOT NULL,
    "geometry" "jsonb" NOT NULL,
    "titel" "text" NOT NULL,
    "beschreibung" "text",
    "autor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "radius_m" numeric,
    "farbe" "text" DEFAULT 'rot'::"text" NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL,
    CONSTRAINT "kartenobjekt_farbe_check" CHECK (("farbe" = ANY (ARRAY['rot'::"text", 'orange'::"text", 'gelb'::"text", 'gruen'::"text", 'blau'::"text", 'lila'::"text", 'grau'::"text"])))
);


ALTER TABLE "public"."kartenobjekt" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kategorie" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lage_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."kategorie" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lage_vorlage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "kategorien" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "standard_faqs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL
);


ALTER TABLE "public"."lage_vorlage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notiz" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "inhalt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "behoerde_id" "uuid" DEFAULT "public"."aktuelle_behoerde_id"() NOT NULL,
    CONSTRAINT "notiz_inhalt_check" CHECK (("length"(TRIM(BOTH FROM "inhalt")) > 0))
);


ALTER TABLE "public"."notiz" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rolle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "behoerde_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "beschreibung" "text",
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "parent_rolle_id" "uuid",
    "reihenfolge" integer DEFAULT 0 NOT NULL,
    "ist_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rolle_permissions_gueltig" CHECK (("permissions" <@ ARRAY['faq.lesen'::"text", 'faq.erstellen'::"text", 'faq.bearbeiten'::"text", 'faq.loeschen'::"text", 'faq.sichtbarkeit'::"text", 'anfrage.erfassen'::"text", 'anfrage.an_fachstelle'::"text", 'anfrage.freigeben'::"text", 'karte.ansehen'::"text", 'karte.zeichnen'::"text", 'karte.bearbeiten'::"text", 'lage.verwalten'::"text", 'vorlage.verwalten'::"text", 'nutzer.einladen'::"text", 'nutzer.rollen_verwalten'::"text", 'nutzer.sperren'::"text", 'behoerde.konfigurieren'::"text", 'audit.einsehen'::"text"]))
);


ALTER TABLE "public"."rolle" OWNER TO "postgres";


COMMENT ON TABLE "public"."rolle" IS 'VOX 2 — pro Behörde definierbare Rolle mit Permission-Set (RBAC, Phase 3).';



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behoerde_ausschluss"
    ADD CONSTRAINT "behoerde_ausschluss_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behoerde_domain"
    ADD CONSTRAINT "behoerde_domain_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behoerde_domain"
    ADD CONSTRAINT "behoerde_domain_unique" UNIQUE ("domain");



ALTER TABLE ONLY "public"."behoerde"
    ADD CONSTRAINT "behoerde_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behoerde"
    ADD CONSTRAINT "behoerde_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fachstellen_nachricht"
    ADD CONSTRAINT "fachstellen_nachricht_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fachstellen_token"
    ADD CONSTRAINT "fachstellen_token_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fachstellen_token"
    ADD CONSTRAINT "fachstellen_token_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."faq_gelesen"
    ADD CONSTRAINT "faq_gelesen_pkey" PRIMARY KEY ("faq_id", "user_id");



ALTER TABLE ONLY "public"."faq"
    ADD CONSTRAINT "faq_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_version"
    ADD CONSTRAINT "faq_version_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."freemail_domain"
    ADD CONSTRAINT "freemail_domain_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."kartenobjekt"
    ADD CONSTRAINT "kartenobjekt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kategorie"
    ADD CONSTRAINT "kategorie_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lage"
    ADD CONSTRAINT "lage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lage_vorlage"
    ADD CONSTRAINT "lage_vorlage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notiz"
    ADD CONSTRAINT "notiz_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rolle"
    ADD CONSTRAINT "rolle_name_pro_behoerde_unique" UNIQUE ("behoerde_id", "name");



ALTER TABLE ONLY "public"."rolle"
    ADD CONSTRAINT "rolle_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_log_wann_idx" ON "public"."audit_log" USING "btree" ("wann" DESC);



CREATE INDEX "audit_log_wer_idx" ON "public"."audit_log" USING "btree" ("wer");



CREATE INDEX "behoerde_ausschluss_behoerde_idx" ON "public"."behoerde_ausschluss" USING "btree" ("behoerde_id");



CREATE UNIQUE INDEX "behoerde_ausschluss_unq" ON "public"."behoerde_ausschluss" USING "btree" ("behoerde_id", "lower"("email"));



CREATE INDEX "behoerde_domain_behoerde_idx" ON "public"."behoerde_domain" USING "btree" ("behoerde_id");



CREATE INDEX "buergerfrage_behoerde_idx" ON "public"."buergerfrage" USING "btree" ("behoerde_id");



CREATE INDEX "buergerfrage_bezug_faq_id_idx" ON "public"."buergerfrage" USING "btree" ("bezug_faq_id");



CREATE INDEX "buergerfrage_erfasst_idx" ON "public"."buergerfrage" USING "btree" ("erfasst_von");



CREATE INDEX "buergerfrage_freigegeben_von_idx" ON "public"."buergerfrage" USING "btree" ("freigegeben_von");



CREATE INDEX "buergerfrage_ins_faq_id_idx" ON "public"."buergerfrage" USING "btree" ("ins_faq_id");



CREATE INDEX "buergerfrage_kategorie_id_idx" ON "public"."buergerfrage" USING "btree" ("kategorie_id");



CREATE INDEX "buergerfrage_lage_idx" ON "public"."buergerfrage" USING "btree" ("lage_id");



CREATE INDEX "buergerfrage_status_idx" ON "public"."buergerfrage" USING "btree" ("lage_id", "status");



CREATE INDEX "fachstellen_nachricht_bf_idx" ON "public"."fachstellen_nachricht" USING "btree" ("buergerfrage_id", "created_at");



CREATE INDEX "fachstellen_token_buergerfrage_idx" ON "public"."fachstellen_token" USING "btree" ("buergerfrage_id");



CREATE INDEX "faq_antwort_trgm_idx" ON "public"."faq" USING "gin" ("antwort" "extensions"."gin_trgm_ops");



CREATE INDEX "faq_autor_id_idx" ON "public"."faq" USING "btree" ("autor_id");



CREATE INDEX "faq_behoerde_idx" ON "public"."faq" USING "btree" ("behoerde_id");



CREATE INDEX "faq_frage_trgm_idx" ON "public"."faq" USING "gin" ("frage" "extensions"."gin_trgm_ops");



CREATE INDEX "faq_gelesen_user_id_idx" ON "public"."faq_gelesen" USING "btree" ("user_id");



CREATE INDEX "faq_kategorie_id_idx" ON "public"."faq" USING "btree" ("kategorie_id");



CREATE INDEX "faq_klick_zaehler_idx" ON "public"."faq" USING "btree" ("lage_id", "klick_zaehler" DESC);



CREATE INDEX "faq_lage_idx" ON "public"."faq" USING "btree" ("lage_id");



CREATE INDEX "faq_version_faq_idx" ON "public"."faq_version" USING "btree" ("faq_id");



CREATE INDEX "faq_version_geaendert_von_idx" ON "public"."faq_version" USING "btree" ("geaendert_von");



CREATE UNIQUE INDEX "faq_version_unique" ON "public"."faq_version" USING "btree" ("faq_id", "version");



CREATE INDEX "kartenobjekt_autor_id_idx" ON "public"."kartenobjekt" USING "btree" ("autor_id");



CREATE INDEX "kartenobjekt_behoerde_idx" ON "public"."kartenobjekt" USING "btree" ("behoerde_id");



CREATE INDEX "kartenobjekt_lage_idx" ON "public"."kartenobjekt" USING "btree" ("lage_id");



CREATE INDEX "kategorie_behoerde_idx" ON "public"."kategorie" USING "btree" ("behoerde_id");



CREATE INDEX "kategorie_lage_idx" ON "public"."kategorie" USING "btree" ("lage_id");



CREATE INDEX "lage_behoerde_idx" ON "public"."lage" USING "btree" ("behoerde_id");



CREATE INDEX "lage_vorlage_behoerde_idx" ON "public"."lage_vorlage" USING "btree" ("behoerde_id");



CREATE INDEX "notiz_behoerde_idx" ON "public"."notiz" USING "btree" ("behoerde_id");



CREATE INDEX "notiz_user_id_idx" ON "public"."notiz" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "nur_eine_aktive_lage" ON "public"."lage" USING "btree" ("behoerde_id") WHERE ("aktiv" = true);



CREATE INDEX "profile_behoerde_idx" ON "public"."profile" USING "btree" ("behoerde_id");



CREATE INDEX "profile_rolle_id_idx" ON "public"."profile" USING "btree" ("rolle_id");



CREATE INDEX "rolle_behoerde_id_idx" ON "public"."rolle" USING "btree" ("behoerde_id");



CREATE INDEX "rolle_parent_idx" ON "public"."rolle" USING "btree" ("parent_rolle_id");



CREATE OR REPLACE TRIGGER "buergerfrage_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."buergerfrage" FOR EACH ROW EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "buergerfrage_updated_at" BEFORE UPDATE ON "public"."buergerfrage" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "faq_audit_iud" AFTER INSERT OR DELETE ON "public"."faq" FOR EACH ROW EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "faq_audit_upd" AFTER UPDATE ON "public"."faq" FOR EACH ROW WHEN ((("old"."frage" IS DISTINCT FROM "new"."frage") OR ("old"."antwort" IS DISTINCT FROM "new"."antwort") OR ("old"."interne_notiz" IS DISTINCT FROM "new"."interne_notiz") OR ("old"."sichtbar" IS DISTINCT FROM "new"."sichtbar") OR ("old"."kategorie_id" IS DISTINCT FROM "new"."kategorie_id") OR ("old"."autor_id" IS DISTINCT FROM "new"."autor_id"))) EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "faq_updated_at" BEFORE UPDATE ON "public"."faq" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "faq_version_archive" BEFORE UPDATE ON "public"."faq" FOR EACH ROW EXECUTE FUNCTION "public"."archive_faq_version"();



CREATE OR REPLACE TRIGGER "kartenobjekt_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."kartenobjekt" FOR EACH ROW EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "kartenobjekt_updated_at" BEFORE UPDATE ON "public"."kartenobjekt" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "lage_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."lage" FOR EACH ROW EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "lage_updated_at" BEFORE UPDATE ON "public"."lage" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "lage_vorlage_updated_at" BEFORE UPDATE ON "public"."lage_vorlage" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "notiz_set_updated_at_trg" BEFORE UPDATE ON "public"."notiz" FOR EACH ROW EXECUTE FUNCTION "public"."notiz_set_updated_at"();



CREATE OR REPLACE TRIGGER "profile_audit" AFTER DELETE OR UPDATE ON "public"."profile" FOR EACH ROW EXECUTE FUNCTION "public"."log_change"();



CREATE OR REPLACE TRIGGER "profile_self_escalation_guard" BEFORE UPDATE ON "public"."profile" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_self_escalation"();



CREATE OR REPLACE TRIGGER "profile_updated_at" BEFORE UPDATE ON "public"."profile" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "rolle_set_updated_at" BEFORE UPDATE ON "public"."rolle" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_wer_fkey" FOREIGN KEY ("wer") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."behoerde_ausschluss"
    ADD CONSTRAINT "behoerde_ausschluss_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."behoerde_ausschluss"
    ADD CONSTRAINT "behoerde_ausschluss_erstellt_von_fkey" FOREIGN KEY ("erstellt_von") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."behoerde_domain"
    ADD CONSTRAINT "behoerde_domain_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_bezug_faq_id_fkey" FOREIGN KEY ("bezug_faq_id") REFERENCES "public"."faq"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_erfasst_von_fkey" FOREIGN KEY ("erfasst_von") REFERENCES "public"."profile"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_freigegeben_von_fkey" FOREIGN KEY ("freigegeben_von") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_ins_faq_id_fkey" FOREIGN KEY ("ins_faq_id") REFERENCES "public"."faq"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_kategorie_id_fkey" FOREIGN KEY ("kategorie_id") REFERENCES "public"."kategorie"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buergerfrage"
    ADD CONSTRAINT "buergerfrage_lage_id_fkey" FOREIGN KEY ("lage_id") REFERENCES "public"."lage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fachstellen_nachricht"
    ADD CONSTRAINT "fachstellen_nachricht_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fachstellen_nachricht"
    ADD CONSTRAINT "fachstellen_nachricht_buergerfrage_id_fkey" FOREIGN KEY ("buergerfrage_id") REFERENCES "public"."buergerfrage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fachstellen_token"
    ADD CONSTRAINT "fachstellen_token_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fachstellen_token"
    ADD CONSTRAINT "fachstellen_token_buergerfrage_id_fkey" FOREIGN KEY ("buergerfrage_id") REFERENCES "public"."buergerfrage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq"
    ADD CONSTRAINT "faq_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."faq"
    ADD CONSTRAINT "faq_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_gelesen"
    ADD CONSTRAINT "faq_gelesen_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_gelesen"
    ADD CONSTRAINT "faq_gelesen_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "public"."faq"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_gelesen"
    ADD CONSTRAINT "faq_gelesen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq"
    ADD CONSTRAINT "faq_kategorie_id_fkey" FOREIGN KEY ("kategorie_id") REFERENCES "public"."kategorie"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."faq"
    ADD CONSTRAINT "faq_lage_id_fkey" FOREIGN KEY ("lage_id") REFERENCES "public"."lage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_version"
    ADD CONSTRAINT "faq_version_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_version"
    ADD CONSTRAINT "faq_version_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "public"."faq"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_version"
    ADD CONSTRAINT "faq_version_geaendert_von_fkey" FOREIGN KEY ("geaendert_von") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kartenobjekt"
    ADD CONSTRAINT "kartenobjekt_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kartenobjekt"
    ADD CONSTRAINT "kartenobjekt_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kartenobjekt"
    ADD CONSTRAINT "kartenobjekt_lage_id_fkey" FOREIGN KEY ("lage_id") REFERENCES "public"."lage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kategorie"
    ADD CONSTRAINT "kategorie_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kategorie"
    ADD CONSTRAINT "kategorie_lage_id_fkey" FOREIGN KEY ("lage_id") REFERENCES "public"."lage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lage"
    ADD CONSTRAINT "lage_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lage_vorlage"
    ADD CONSTRAINT "lage_vorlage_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notiz"
    ADD CONSTRAINT "notiz_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notiz"
    ADD CONSTRAINT "notiz_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_rolle_id_fkey" FOREIGN KEY ("rolle_id") REFERENCES "public"."rolle"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rolle"
    ADD CONSTRAINT "rolle_behoerde_id_fkey" FOREIGN KEY ("behoerde_id") REFERENCES "public"."behoerde"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rolle"
    ADD CONSTRAINT "rolle_parent_rolle_id_fkey" FOREIGN KEY ("parent_rolle_id") REFERENCES "public"."rolle"("id") ON DELETE SET NULL;



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select_leitung" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('audit.einsehen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."behoerde" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "behoerde_admin_all" ON "public"."behoerde" TO "authenticated" USING ("public"."ist_plattform_admin"()) WITH CHECK ("public"."ist_plattform_admin"());



ALTER TABLE "public"."behoerde_ausschluss" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "behoerde_ausschluss_delete" ON "public"."behoerde_ausschluss" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('nutzer.sperren'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "behoerde_ausschluss_select" ON "public"."behoerde_ausschluss" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('nutzer.sperren'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."behoerde_domain" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "behoerde_domain_select" ON "public"."behoerde_domain" FOR SELECT TO "authenticated" USING (("behoerde_id" = "public"."aktuelle_behoerde_id"()));



CREATE POLICY "behoerde_select" ON "public"."behoerde" FOR SELECT TO "authenticated" USING (("id" = "public"."meine_behoerde_id"()));



ALTER TABLE "public"."buergerfrage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buergerfrage_delete_leitung" ON "public"."buergerfrage" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('anfrage.freigeben'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "buergerfrage_insert" ON "public"."buergerfrage" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('anfrage.erfassen'::"text") AND ("erfasst_von" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "buergerfrage_select" ON "public"."buergerfrage" FOR SELECT TO "authenticated" USING ((("behoerde_id" = "public"."aktuelle_behoerde_id"()) AND ("public"."hat_recht"('anfrage.erfassen'::"text") OR "public"."hat_recht"('anfrage.freigeben'::"text"))));



CREATE POLICY "buergerfrage_update_leitung" ON "public"."buergerfrage" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('anfrage.freigeben'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('anfrage.freigeben'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."fachstellen_nachricht" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fachstellen_nachricht_insert_leitung" ON "public"."fachstellen_nachricht" FOR INSERT WITH CHECK (("public"."hat_recht"('anfrage.freigeben'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "fachstellen_nachricht_select_leitung" ON "public"."fachstellen_nachricht" FOR SELECT USING (("public"."hat_recht"('anfrage.freigeben'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."fachstellen_token" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fachstellen_token_default_deny" ON "public"."fachstellen_token" USING (false) WITH CHECK (false);



ALTER TABLE "public"."faq" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faq_delete_leitung" ON "public"."faq" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('faq.loeschen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."faq_gelesen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faq_gelesen_insert_self" ON "public"."faq_gelesen" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "faq_gelesen_select_self" ON "public"."faq_gelesen" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "faq_gelesen_update_self" ON "public"."faq_gelesen" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "faq_insert_leitung" ON "public"."faq" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('faq.erstellen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "faq_select" ON "public"."faq" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('faq.lesen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "faq_update_leitung" ON "public"."faq" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('faq.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('faq.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."faq_version" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faq_version_select" ON "public"."faq_version" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('faq.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."freemail_domain" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "freemail_domain_plattform_admin" ON "public"."freemail_domain" TO "authenticated" USING ("public"."ist_plattform_admin"()) WITH CHECK ("public"."ist_plattform_admin"());



CREATE POLICY "freemail_domain_select" ON "public"."freemail_domain" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."kartenobjekt" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kartenobjekt_delete_leitung" ON "public"."kartenobjekt" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('karte.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kartenobjekt_insert_leitung" ON "public"."kartenobjekt" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('karte.zeichnen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kartenobjekt_select" ON "public"."kartenobjekt" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('karte.ansehen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kartenobjekt_update_leitung" ON "public"."kartenobjekt" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('karte.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('karte.bearbeiten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."kategorie" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kategorie_delete_leitung" ON "public"."kategorie" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kategorie_insert_leitung" ON "public"."kategorie" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kategorie_select" ON "public"."kategorie" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('faq.lesen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "kategorie_update_leitung" ON "public"."kategorie" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."lage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lage_delete_leitung" ON "public"."lage" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "lage_insert_leitung" ON "public"."lage" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "lage_select" ON "public"."lage" FOR SELECT TO "authenticated" USING (("behoerde_id" = "public"."aktuelle_behoerde_id"()));



CREATE POLICY "lage_update_leitung" ON "public"."lage" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('lage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."lage_vorlage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lage_vorlage_delete_leitung" ON "public"."lage_vorlage" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('vorlage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "lage_vorlage_insert_leitung" ON "public"."lage_vorlage" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('vorlage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "lage_vorlage_select_leitung" ON "public"."lage_vorlage" FOR SELECT TO "authenticated" USING (("public"."hat_recht"('vorlage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "lage_vorlage_update_leitung" ON "public"."lage_vorlage" FOR UPDATE TO "authenticated" USING (("public"."hat_recht"('vorlage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('vorlage.verwalten'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."notiz" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notiz_delete_eigene" ON "public"."notiz" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "notiz_insert_eigene" ON "public"."notiz" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "notiz_select_eigene" ON "public"."notiz" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "notiz_update_eigene" ON "public"."notiz" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



ALTER TABLE "public"."profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_delete_leitung" ON "public"."profile" FOR DELETE TO "authenticated" USING (("public"."hat_recht"('nutzer.sperren'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "profile_insert_leitung" ON "public"."profile" FOR INSERT TO "authenticated" WITH CHECK (("public"."hat_recht"('nutzer.einladen'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "profile_select" ON "public"."profile" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "profile_update" ON "public"."profile" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (("public"."hat_recht"('nutzer.rollen_verwalten'::"text") OR "public"."hat_recht"('nutzer.sperren'::"text")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())))) WITH CHECK (((("public"."hat_recht"('nutzer.rollen_verwalten'::"text") OR "public"."hat_recht"('nutzer.sperren'::"text")) AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())) OR ("id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."rolle" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rolle_konfigurieren" ON "public"."rolle" TO "authenticated" USING (("public"."hat_recht"('behoerde.konfigurieren'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"()))) WITH CHECK (("public"."hat_recht"('behoerde.konfigurieren'::"text") AND ("behoerde_id" = "public"."aktuelle_behoerde_id"())));



CREATE POLICY "rolle_select" ON "public"."rolle" FOR SELECT TO "authenticated" USING (("behoerde_id" = "public"."aktuelle_behoerde_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."buergerfrage";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."faq";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."kartenobjekt";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































































































































REVOKE ALL ON FUNCTION "public"."aktuelle_behoerde_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aktuelle_behoerde_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."aktuelle_behoerde_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."aktuelle_behoerde_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_faq_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_faq_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_faq_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_faq_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."beende_aktive_lage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."beende_aktive_lage"() TO "anon";
GRANT ALL ON FUNCTION "public"."beende_aktive_lage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."beende_aktive_lage"() TO "service_role";



GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."behoerde" TO "authenticated";
GRANT ALL ON TABLE "public"."behoerde" TO "service_role";



REVOKE ALL ON FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_profile_self_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_self_escalation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."hat_recht"("p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hat_recht"("p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hat_recht"("p_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inkrementiere_faq_klick"("p_faq_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ist_freemail"("p_domain" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ist_freemail"("p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ist_freemail"("p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ist_freemail"("p_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ist_plattform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ist_plattform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."ist_plattform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ist_plattform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."load_buergerfrage_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."load_buergerfrage_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."load_buergerfrage_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."load_fachstellen_dialog"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."load_fachstellen_dialog"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."load_fachstellen_dialog"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."markiere_anfrage_gesehen"("p_buergerfrage_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."markiere_anfrage_gesehen"("p_buergerfrage_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."markiere_anfrage_gesehen"("p_buergerfrage_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."markiere_faq_gelesen"("p_faq_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mein_onboarding_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mein_onboarding_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."mein_onboarding_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mein_onboarding_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."meine_behoerde_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."meine_behoerde_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."meine_behoerde_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meine_behoerde_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notiz_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."notiz_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notiz_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."plattform_behoerden"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."plattform_behoerden"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."plattform_behoerden"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_rollen"("p_behoerde_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_rollen"("p_behoerde_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_rollen"("p_behoerde_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."slugify_behoerde"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."slugify_behoerde"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."starte_lage_aus_vorlage"("p_vorlage_id" "uuid", "p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."starte_leere_lage"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."starte_leere_lage"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."starte_leere_lage"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stelle_rueckfrage"("p_buergerfrage_id" "uuid", "p_rueckfrage" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_fachstellen_antwort"("p_token" "text", "p_antwort" "text", "p_email" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_fachstellen_antwort"("p_token" "text", "p_antwort" "text", "p_email" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_fachstellen_antwort"("p_token" "text", "p_antwort" "text", "p_email" "text", "p_name" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."behoerde_ausschluss" TO "authenticated";
GRANT ALL ON TABLE "public"."behoerde_ausschluss" TO "service_role";



GRANT ALL ON TABLE "public"."behoerde_domain" TO "authenticated";
GRANT ALL ON TABLE "public"."behoerde_domain" TO "service_role";



GRANT ALL ON TABLE "public"."buergerfrage" TO "authenticated";
GRANT ALL ON TABLE "public"."buergerfrage" TO "service_role";



GRANT ALL ON TABLE "public"."buergerfrage_view" TO "authenticated";
GRANT ALL ON TABLE "public"."buergerfrage_view" TO "service_role";



GRANT ALL ON TABLE "public"."fachstellen_nachricht" TO "authenticated";
GRANT ALL ON TABLE "public"."fachstellen_nachricht" TO "service_role";



GRANT ALL ON TABLE "public"."fachstellen_token" TO "authenticated";
GRANT ALL ON TABLE "public"."fachstellen_token" TO "service_role";



GRANT ALL ON TABLE "public"."faq" TO "authenticated";
GRANT ALL ON TABLE "public"."faq" TO "service_role";



GRANT ALL ON TABLE "public"."faq_gelesen" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_gelesen" TO "service_role";



GRANT ALL ON TABLE "public"."lage" TO "authenticated";
GRANT ALL ON TABLE "public"."lage" TO "service_role";



GRANT ALL ON TABLE "public"."faq_ungelesen_pro_user" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_ungelesen_pro_user" TO "service_role";



GRANT ALL ON TABLE "public"."faq_version" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_version" TO "service_role";



GRANT ALL ON TABLE "public"."freemail_domain" TO "authenticated";
GRANT ALL ON TABLE "public"."freemail_domain" TO "service_role";



GRANT ALL ON TABLE "public"."kartenobjekt" TO "authenticated";
GRANT ALL ON TABLE "public"."kartenobjekt" TO "service_role";



GRANT ALL ON TABLE "public"."kategorie" TO "authenticated";
GRANT ALL ON TABLE "public"."kategorie" TO "service_role";



GRANT ALL ON TABLE "public"."lage_vorlage" TO "authenticated";
GRANT ALL ON TABLE "public"."lage_vorlage" TO "service_role";



GRANT ALL ON TABLE "public"."notiz" TO "authenticated";
GRANT ALL ON TABLE "public"."notiz" TO "service_role";



GRANT ALL ON TABLE "public"."rolle" TO "authenticated";
GRANT ALL ON TABLE "public"."rolle" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- Auth-Hook (auth-Schema wird vom CLI-Schema-Dump ausgelassen):
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Haertung: anon/authenticated-Grants + Default-Privilegien entziehen, die
-- pg_dump nicht abbildet (Reset erzeugt sie neu; produktiv wurden sie entzogen).
REVOKE ALL ON TABLE "public"."profile" FROM "anon";
REVOKE ALL ON FUNCTION "public"."entferne_nutzer"("p_user_id" "uuid") FROM "anon";
REVOKE ALL ON TABLE "public"."behoerde" FROM "anon";
REVOKE ALL ON FUNCTION "public"."gruende_behoerde"("p_name" "text", "p_typ" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."guard_profile_self_escalation"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."onboarde_nutzer"("p_user_id" "uuid", "p_email" "text", "p_meta_name" "text") FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."plattform_behoerden"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."request_fachstellen_link"("p_buergerfrage_id" "uuid", "p_email" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."slugify_behoerde"("p_name" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."slugify_behoerde"("p_name" "text") FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."starte_leere_lage"("p_name" "text") FROM "anon";
REVOKE ALL ON TABLE "public"."audit_log" FROM "anon";
REVOKE ALL ON TABLE "public"."behoerde_ausschluss" FROM "anon";
REVOKE ALL ON TABLE "public"."behoerde_domain" FROM "anon";
REVOKE ALL ON TABLE "public"."buergerfrage" FROM "anon";
REVOKE ALL ON TABLE "public"."buergerfrage_view" FROM "anon";
REVOKE ALL ON TABLE "public"."fachstellen_nachricht" FROM "anon";
REVOKE ALL ON TABLE "public"."fachstellen_token" FROM "anon";
REVOKE ALL ON TABLE "public"."faq" FROM "anon";
REVOKE ALL ON TABLE "public"."faq_gelesen" FROM "anon";
REVOKE ALL ON TABLE "public"."lage" FROM "anon";
REVOKE ALL ON TABLE "public"."faq_ungelesen_pro_user" FROM "anon";
REVOKE ALL ON TABLE "public"."faq_version" FROM "anon";
REVOKE ALL ON TABLE "public"."freemail_domain" FROM "anon";
REVOKE ALL ON TABLE "public"."kartenobjekt" FROM "anon";
REVOKE ALL ON TABLE "public"."kategorie" FROM "anon";
REVOKE ALL ON TABLE "public"."lage_vorlage" FROM "anon";
REVOKE ALL ON TABLE "public"."notiz" FROM "anon";
REVOKE ALL ON TABLE "public"."rolle" FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";
