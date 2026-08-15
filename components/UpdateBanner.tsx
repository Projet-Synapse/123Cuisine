//////////////////////////////////////////////////////////////////////////
//                          📢 UpdateBanner.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Bandeau + pop-up affichés uniquement dans l'app desktop pour annoncer une mise à jour disponible/téléchargée, sans jamais l'installer automatiquement.
 */

// Powered by OnSpace.AI
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDesktopUpdater } from '@/hooks/useDesktopUpdater';
import { useAlert } from '@/template';

// Bandeau + notification pop-up, affichés uniquement dans l'app desktop
// (Electron) : informent qu'une mise à jour est disponible et laissent
// l'utilisateur décider quand la télécharger / l'installer (jamais
// automatique). Le bandeau seul (discret, en haut de l'écran) passait
// inaperçu — on ajoute donc une vraie pop-up qui interrompt une fois par
// version détectée, en plus du bandeau qui reste pour le suivi du
// téléchargement.
export function UpdateBanner() {
  const { Colors } = useAppTheme();
  const { isDesktop, isPackaged, status, availableVersion, progress, error, downloadUpdate, installUpdate, checkForUpdates, showDownloadedFile } = useDesktopUpdater();
  const { showAlert } = useAlert();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const alertedAvailableVersion = useRef<string | null>(null);
  const alertedDownloaded = useRef<string | null>(null);

  useEffect(() => {
    if (!isDesktop || !isPackaged) return;
    if (status === 'available' && availableVersion && alertedAvailableVersion.current !== availableVersion) {
      alertedAvailableVersion.current = availableVersion;
      showAlert(
        'Nouvelle version disponible',
        `123Cuisine ${availableVersion} est prête à être téléchargée. Voulez-vous la récupérer maintenant ?`,
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Télécharger', onPress: downloadUpdate },
        ]
      );
    }
    if (status === 'downloaded' && availableVersion && alertedDownloaded.current !== availableVersion) {
      alertedDownloaded.current = availableVersion;
      showAlert(
        'Mise à jour prête',
        `123Cuisine ${availableVersion} a été téléchargée. Redémarrer maintenant pour l'installer ?`,
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Installer manuellement', onPress: showDownloadedFile },
          { text: 'Redémarrer et installer', onPress: installUpdate },
        ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, isPackaged, status, availableVersion]);

  if (!isDesktop || !isPackaged) return null;
  if (status === 'idle' || status === 'checking' || status === 'not-available' || status === 'unavailable') return null;
  if (status === 'available' && dismissedVersion === availableVersion) return null;

  const isError = status === 'error';

  return (
    <View style={[styles.container, { backgroundColor: isError ? Colors.error : Colors.primary }]}>
      <MaterialIcons
        name={isError ? 'error-outline' : status === 'downloaded' ? 'check-circle' : 'system-update'}
        size={18}
        color="#fff"
      />
      <View style={styles.textWrap}>
        {status === 'available' ? (
          <Text style={styles.text}>{`Nouvelle version disponible (${availableVersion ?? '?'})`}</Text>
        ) : null}
        {status === 'downloading' ? (
          <Text style={styles.text}>
            {`Téléchargement de la mise à jour…${typeof progress === 'number' ? ` ${Math.round(progress)}%` : ''}`}
          </Text>
        ) : null}
        {status === 'downloaded' ? (
          <Text style={styles.text}>{`Mise à jour ${availableVersion ?? ''} prête à installer`}</Text>
        ) : null}
        {isError ? (
          <Text style={styles.text} numberOfLines={1}>{`Mise à jour : ${error}`}</Text>
        ) : null}
      </View>

      {status === 'available' ? (
        <Pressable style={styles.actionBtn} onPress={downloadUpdate}>
          <Text style={styles.actionText}>Télécharger</Text>
        </Pressable>
      ) : null}

      {status === 'downloading' ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: Spacing.sm }} /> : null}

      {status === 'downloaded' ? (
        <>
          <Pressable style={styles.actionBtn} onPress={showDownloadedFile}>
            <Text style={styles.actionText}>Installer manuellement</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={installUpdate}>
            <Text style={styles.actionText}>Redémarrer et installer</Text>
          </Pressable>
        </>
      ) : null}

      {isError ? (
        <Pressable style={styles.actionBtn} onPress={checkForUpdates}>
          <Text style={styles.actionText}>Réessayer</Text>
        </Pressable>
      ) : null}

      {status === 'available' || isError ? (
        <Pressable
          hitSlop={8}
          style={styles.closeBtn}
          onPress={() => setDismissedVersion(status === 'available' ? (availableVersion ?? 'x') : 'error')}
        >
          <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.85)" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  textWrap: { flex: 1 },
  text: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  actionText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  closeBtn: { padding: 4 },
});
