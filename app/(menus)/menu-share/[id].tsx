//////////////////////////////////////////////////////////////////////////
//                        👥 MenuShare.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Partage d'un menu de la semaine : liste des membres (propriétaire et
 * invités, tous éditeurs du menu), recherche d'inscrits pour inviter,
 * retrait d'un membre par le propriétaire ou départ volontaire.
 * Le partage nécessite un compte : en mode invité, l'écran invite à se
 * connecter plutôt que de laisser croire à un partage enregistré.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { IconAction } from '@/components/IconAction';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useWeeklyMenu } from '@/hooks/useWeeklyMenu';
import { useAuth, useAlert } from '@/template';
import { getAvatarColor, getInitials } from '@/utils/avatar';
import { searchUsers, UserProfile } from '@/services/social/followService';
import { MenuMemberInfo, getMenuMembers, getMenuOwnerProfile, inviteMember, removeMember } from '@/services/menus/weeklyMenuService';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function MenuShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { menus } = useWeeklyMenu();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const menu = useMemo(() => menus.find(m => m.id === id), [menus, id]);

  const [members, setMembers] = useState<MenuMemberInfo[]>([]);
  const [owner, setOwner] = useState<{ username: string | null; email: string } | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const isOwner = !!(menu && user && menu.ownerId === user.id);

  // Recherche d'inscrits à inviter (comme l'onglet Personnes), avec un léger
  // délai pour ne pas interroger Supabase à chaque frappe.
  useEffect(() => {
    if (!user || !query.trim() || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      void (async () => {
        const found = await searchUsers(query.trim(), user.id);
        setResults(found);
        setSearching(false);
      })();
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, user]);

  const loadMembers = async () => {
    if (!id) return;
    setLoadingMembers(true);
    const [list, ownerProfile] = await Promise.all([getMenuMembers(id), menu ? getMenuOwnerProfile(menu.ownerId) : Promise.resolve(null)]);
    setMembers(list);
    setOwner(ownerProfile);
    setLoadingMembers(false);
  };

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const handleInvite = async (profile: UserProfile) => {
    if (!id) return;
    setBusy(profile.id);
    const ok = await inviteMember(id, profile.id);
    setBusy(null);
    if (!ok) {
      showAlert("Invitation impossible", "L'invitation n'a pas pu être enregistrée. Vérifiez votre connexion, puis réessayez.");
      return;
    }
    setResults(prev => prev.filter(r => r.id !== profile.id));
    await loadMembers();
  };

  const handleRemoveMember = (member: MenuMemberInfo) => {
    showAlert(
      member.memberId === user?.id ? 'Quitter le menu ?' : 'Retirer ce membre ?',
      member.memberId === user?.id
        ? "Vous n'aurez plus accès à ce menu partagé."
        : `${member.username || member.email} n'aura plus accès à ce menu.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: member.memberId === user?.id ? 'Quitter' : 'Retirer',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              if (!id) return;
              setBusy(member.memberId);
              const ok = await removeMember(id, member.memberId);
              setBusy(null);
              if (!ok) {
                showAlert('Action impossible', 'Le retrait n’a pas pu être enregistré. Vérifiez votre connexion, puis réessayez.');
                return;
              }
              if (member.memberId === user?.id) {
                router.back();
                return;
              }
              await loadMembers();
            })(),
        },
      ],
    );
  };

  const memberIds = useMemo(() => new Set(members.map(m => m.memberId)), [members]);

  if (!menu) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Menu introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <ScreenContainer style={{ width: '100%' }}>
          <View style={[styles.header, { borderBottomColor: Colors.border }]}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: Colors.text }]}>Partager le menu</Text>
            <View style={{ width: 24 }} />
          </View>
        </ScreenContainer>
        <ScreenContainer style={{ flex: 1, width: '100%' }}>
          <View style={styles.centerState}>
            <MaterialIcons name="lock-outline" size={56} color={Colors.textMuted} />
            <Text style={[styles.centerTitle, { color: Colors.text }]}>Connexion requise</Text>
            <Text style={[styles.centerHint, { color: Colors.textMuted }]}>
              Créez un compte ou connectez-vous pour partager « {menu.name} » avec vos proches.
            </Text>
            <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/login')}>
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        <View style={[styles.header, { borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: Colors.text }]}>Partager le menu</Text>
            <Text style={[styles.headerSubtitle, { color: Colors.textMuted }]} numberOfLines={1}>{menu.name}</Text>
          </View>
          <IconAction icon="info-outline" label="Les membres invités peuvent aussi modifier ce menu" size={20} />
        </View>
      </ScreenContainer>

      <ScreenContainer style={{ flex: 1, width: '100%' }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {isOwner ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Inviter des proches</Text>
              <View style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <MaterialIcons name="search" size={18} color={Colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: Colors.text }]}
                  placeholder="Pseudo ou e-mail d'un inscrit..."
                  placeholderTextColor={Colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {searching ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
              ) : results.length > 0 ? (
                <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                  {results.map(profile => {
                    const alreadyInvited = memberIds.has(profile.id);
                    return (
                      <View key={profile.id} style={[styles.userRow, { backgroundColor: Colors.surface }]}>
                        <View style={[styles.avatar, { backgroundColor: getAvatarColor(profile.id) }]}>
                          <Text style={styles.avatarText}>{getInitials({ username: profile.username, email: profile.email })}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userName, { color: Colors.text }]} numberOfLines={1}>
                            {profile.username || profile.email}
                          </Text>
                          {profile.username ? (
                            <Text style={[styles.userEmail, { color: Colors.textMuted }]} numberOfLines={1}>{profile.email}</Text>
                          ) : null}
                        </View>
                        {alreadyInvited ? (
                          <MaterialIcons name="check-circle" size={22} color={Colors.success} />
                        ) : (
                          <Pressable
                            style={[styles.inviteBtn, { backgroundColor: Colors.primary }]}
                            onPress={() => void handleInvite(profile)}
                            disabled={busy === profile.id}
                          >
                            {busy === profile.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.inviteBtnText}>Inviter</Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : query.trim().length >= 2 ? (
                <Text style={[styles.searchEmpty, { color: Colors.textMuted }]}>Aucun inscrit trouvé pour « {query.trim()} ».</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>
              Membres ({members.length + 1})
            </Text>
            <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>
              {isOwner
                ? 'Vous gérez ce menu ; les invités peuvent aussi y ajouter ou déplacer des plats.'
                : 'Ce menu est partagé : chaque membre peut y ajouter ou déplacer des plats.'}
            </Text>

            {loadingMembers ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
            ) : (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                {/* Propriétaire toujours en tête de liste (il n'est pas dans
                    la table des membres, son profil est chargé à part) */}
                <View style={[styles.userRow, { backgroundColor: Colors.surface }]}>
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(menu.ownerId) }]}>
                    <Text style={styles.avatarText}>{isOwner ? '👑' : getInitials(owner)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: Colors.text }]} numberOfLines={1}>
                      {isOwner ? 'Vous' : owner?.username || owner?.email || 'Propriétaire'}
                    </Text>
                    <Text style={[styles.userEmail, { color: Colors.textMuted }]}>Propriétaire du menu</Text>
                  </View>
                </View>
                {members
                  .filter(m => m.memberId !== user.id)
                  .map(member => (
                    <View key={member.memberId} style={[styles.userRow, { backgroundColor: Colors.surface }]}>
                      <View style={[styles.avatar, { backgroundColor: getAvatarColor(member.memberId) }]}>
                        <Text style={styles.avatarText}>{getInitials({ username: member.username, email: member.email })}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userName, { color: Colors.text }]} numberOfLines={1}>
                          {member.username || member.email}
                        </Text>
                        {member.username ? (
                          <Text style={[styles.userEmail, { color: Colors.textMuted }]} numberOfLines={1}>{member.email}</Text>
                        ) : null}
                      </View>
                      {isOwner ? (
                        <Pressable
                          onPress={() => handleRemoveMember(member)}
                          hitSlop={8}
                          disabled={busy === member.memberId}
                          accessibilityLabel="Retirer ce membre du menu"
                        >
                          {busy === member.memberId ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <MaterialIcons name="person-remove" size={22} color={Colors.error} />
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  ))}

                {!isOwner ? (
                  <Pressable
                    style={[styles.leaveRow, { backgroundColor: Colors.surface }]}
                    onPress={() =>
                      handleRemoveMember({ memberId: user.id, username: user.username ?? null, email: user.email, createdAt: '' })
                    }
                  >
                    <MaterialIcons name="logout" size={20} color={Colors.error} />
                    <Text style={[styles.leaveText, { color: Colors.error }]}>Quitter ce menu</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { FontSize } = t;
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    headerSubtitle: { fontSize: FontSize.xs, marginTop: 1 },

    section: { gap: Spacing.xs },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    sectionHint: { fontSize: FontSize.xs, lineHeight: 16 },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      marginTop: Spacing.sm,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.md },
    searchEmpty: { fontSize: FontSize.sm, marginTop: Spacing.sm },

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    userName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    userEmail: { fontSize: FontSize.xs, marginTop: 1 },

    inviteBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.round,
      minWidth: 76,
      alignItems: 'center',
    },
    inviteBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },

    leaveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.lg,
      padding: Spacing.md,
    },
    leaveText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
    centerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    centerHint: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    primaryBtn: { paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: Radius.round, marginTop: Spacing.sm },
    primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  });
};
