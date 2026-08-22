-- 123Cuisine — connexion par pseudo
--
-- Appliquée directement sur le projet via l'outil MCP Supabase, comme les
-- précédentes. Conservée ici pour l'historique / une nouvelle instance.

-- ============================================================
-- 1. Le pseudo devient un identifiant : il doit être unique
-- ============================================================
-- Unicité insensible à la casse : « Flora1311 » et « flora1311 » désignent la
-- même personne, sinon la connexion par pseudo serait ambiguë. Index partiel :
-- les comptes créés avant cette migration ont username = null et peuvent
-- rester plusieurs dans cet état.
create unique index if not exists user_profiles_username_lower_key
  on public.user_profiles (lower(username))
  where username is not null;

-- ============================================================
-- 2. Le pseudo choisi à l'inscription doit arriver jusqu'au profil
-- ============================================================
-- Jusqu'ici le déclencheur écrivait `username = null` en dur : impossible de
-- se connecter par pseudo, puisque personne n'en avait. Il lit maintenant le
-- pseudo passé dans les métadonnées de l'inscription (options.data.username
-- côté supabase-js).
--
-- Le bloc `exception` n'est pas décoratif : si deux personnes valident le même
-- pseudo à quelques millisecondes d'intervalle, l'index unique rejette la
-- seconde. Sans rattrapage, l'inscription entière échouerait avec une erreur
-- serveur incompréhensible. On préfère créer le compte sans pseudo — il reste
-- utilisable par e-mail, et le pseudo se choisit ensuite dans Mon espace.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  begin
    insert into public.user_profiles (id, email, username)
    values (new.id, new.email, wanted)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.user_profiles (id, email, username)
    values (new.id, new.email, null)
    on conflict (id) do nothing;
  end;
  return new;
end;
$function$;
