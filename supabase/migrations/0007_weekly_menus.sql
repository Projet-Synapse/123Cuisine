-- 123Cuisine — menus de la semaine (planning kanban horaire, partageable)
--
-- ⚠ PAS encore appliquée au projet en ligne : contrairement à 0003-0006,
-- cette migration doit être exécutée dans l'éditeur SQL du tableau de bord
-- Supabase (ou via l'outil MCP) AVANT de déployer une version de l'app qui
-- contient l'onglet « Menu » — sinon les requêtes tomberont sur des tables
-- inexistantes (l'app dégrade proprement : menus vides + alerte à la
-- sauvegarde, le reste de l'app n'est pas affecté).

-- ============================================================
-- Tables
-- ============================================================

-- Un menu = une semaine (lundi -> dimanche). Les plats sont stockés dans
-- `days` : un objet JSONB indexé par jour (0 = lundi ... 6 = dimanche),
-- chaque jour valant la liste de ses plats positionnés sur un créneau
-- horaire ({id, recipeId, hour, title?, image?} — title/image sont un
-- instantané au placement, pour que la carte reste affichable même si la
-- recette n'est plus lisible par le lecteur). Même style que recipe_ids /
-- items ailleurs dans le projet (tableau JSONB plutôt que table de jointure).
create table public.weekly_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  week_start text not null,
  color text not null default '#C0705A',
  days jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index weekly_menus_user_week on public.weekly_menus (user_id, week_start);

-- Membres invités à un menu : ils y accèdent et peuvent le modifier comme
-- le propriétaire (menu commun entre proches). PK composite : un membre ne
-- peut être invité deux fois au même menu.
create table public.weekly_menu_members (
  menu_id uuid not null references public.weekly_menus(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (menu_id, member_id)
);

-- ============================================================
-- Grants (nécessaires en plus de RLS : sans eux, Postgres refuse
-- l'accès aux tables avant même que les policies RLS s'appliquent)
-- ============================================================

grant select, insert, update, delete on public.weekly_menus to authenticated;
grant select, insert, delete on public.weekly_menu_members to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.weekly_menus enable row level security;
alter table public.weekly_menu_members enable row level security;

-- weekly_menus : le propriétaire fait tout ; un membre invité lit et
-- modifie le menu (ajouter/retirer/déplacer des plats) mais ne peut ni le
-- supprimer ni en créer un au nom d'un autre.
create policy "weekly_menus_select_own_or_member" on public.weekly_menus
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.weekly_menu_members m
      where m.menu_id = id and m.member_id = auth.uid()
    )
  );

create policy "weekly_menus_insert_own" on public.weekly_menus
  for insert to authenticated with check (user_id = auth.uid());

create policy "weekly_menus_update_own_or_member" on public.weekly_menus
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.weekly_menu_members m
      where m.menu_id = id and m.member_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.weekly_menu_members m
      where m.menu_id = id and m.member_id = auth.uid()
    )
  );

create policy "weekly_menus_delete_own" on public.weekly_menus
  for delete to authenticated using (user_id = auth.uid());

-- weekly_menu_members : la liste des membres est visible par tous ceux qui
-- accèdent au menu (propriétaire comme invités) ; seuls les invitations du
-- propriétaire créent des membres ; chacun peut retirer sa propre
-- inscription (quitter le menu), le propriétaire peut retirer qui il veut.
create policy "weekly_menu_members_select_with_menu_access" on public.weekly_menu_members
  for select to authenticated
  using (
    exists (
      select 1 from public.weekly_menus w
      where w.id = menu_id
        and (
          w.user_id = auth.uid()
          or exists (
            select 1 from public.weekly_menu_members me
            where me.menu_id = w.id and me.member_id = auth.uid()
          )
        )
    )
  );

create policy "weekly_menu_members_insert_owner" on public.weekly_menu_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.weekly_menus w
      where w.id = menu_id and w.user_id = auth.uid()
    )
  );

create policy "weekly_menu_members_delete_owner_or_self" on public.weekly_menu_members
  for delete to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.weekly_menus w
      where w.id = menu_id and w.user_id = auth.uid()
    )
  );

-- Recettes : un membre d'un menu partagé doit pouvoir ouvrir les plats que
-- le propriétaire y a placés, sinon les cartes du menu resteraient des
-- titres muets pour lui. Cette policy additive accorde la LECTURE des
-- recettes du propriétaire d'un menu dont on est membre (insert / update /
-- delete restent réservés au propriétaire, cf. 0001). Les listes d'écrans
-- filtrent par user_id : cette policy n'élargit donc pas ce qui s'affiche
-- chez le membre, elle permet seulement l'ouverture directe d'une fiche.
create policy "recipes_select_shared_menu_owner_recipes" on public.recipes
  for select to authenticated
  using (
    exists (
      select 1
      from public.weekly_menus w
      join public.weekly_menu_members m on m.menu_id = w.id
      where m.member_id = auth.uid() and w.user_id = recipes.user_id
    )
  );
