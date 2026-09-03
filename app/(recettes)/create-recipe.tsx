//////////////////////////////////////////////////////////////////////////
//                         CreateRecipe.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Formulaire de création d'une nouvelle recette (ingrédients, étapes, photo).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
// expo-image-picker loaded lazily to avoid SimpleCache conflict on Android hot-reload
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { RECIPE_TAGS, UNITS } from '@/constants/config';
import { Ingredient, uploadRecipeImage, generateId } from '@/services/kitchenService';
import { detectCategory } from '@/services/courses/priceService';
import { ScreenContainer } from '@/components/ScreenContainer';

type Difficulty = 'Facile' | 'Moyen' | 'Difficile';

export default function CreateRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors, Radius, FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { addRecipe } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [servings, setServings] = useState('4');
  const [difficulty, setDifficulty] = useState<Difficulty>('Facile');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPublicRecipe, setIsPublicRecipe] = useState(false);

  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('g');

  const Shadow = {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  };

  const pickImage = async () => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setLocalImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission refusée', "L'accès à la caméra est requis.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setLocalImageUri(result.assets[0].uri);
  };

  const showImageOptions = () => {
    showAlert('Ajouter une photo', 'Choisissez une source', [
      { text: 'Galerie', onPress: () => void pickImage() },
      { text: 'Appareil photo', onPress: () => void takePhoto() },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));

  const addIngredient = () => {
    if (!ingName.trim()) return;
    setIngredients(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: ingName.trim(),
        quantity: ingQty,
        unit: ingUnit,
        // Devinée depuis le nom (mêmes règles que l'ajout à une liste de
        // courses) : un « Légumes » fixe pour tout ingrédient faussait le
        // classement par rayon une fois la recette envoyée vers une liste.
        category: detectCategory(ingName.trim()),
      },
    ]);
    setIngName('');
    setIngQty('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('Champ requis', 'Veuillez donner un titre à la recette.');
      return;
    }
    if (ingredients.length === 0) {
      showAlert('Ingrédients requis', 'Ajoutez au moins un ingrédient.');
      return;
    }
    const filledSteps = steps.filter(s => s.trim());
    if (filledSteps.length === 0) {
      showAlert('Étapes requises', 'Ajoutez au moins une étape.');
      return;
    }

    let imageUrl: string | undefined;
    if (localImageUri && user?.id) {
      setUploadingImage(true);
      const { url, error } = await uploadRecipeImage(localImageUri, user.id, generateId());
      setUploadingImage(false);
      if (url) {
        imageUrl = url;
      } else {
        // On prévient au lieu d'enregistrer la recette sans sa photo en
        // silence : c'est ce silence qui faisait croire que l'envoi marchait.
        showAlert('Photo non envoyée', error ?? "La photo n'a pas pu être envoyée.");
        return;
      }
    } else if (localImageUri) {
      imageUrl = localImageUri;
    }

    await addRecipe({
      title: title.trim(),
      description: description.trim(),
      ingredients,
      steps: filledSteps,
      tags: selectedTags,
      duration: parseInt(duration) || 30,
      servings: parseInt(servings) || 4,
      difficulty,
      isFavorite: false,
      image: imageUrl,
      isPublic: isPublicRecipe,
    });
    router.back();
  };

  const inputStyle = {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Colors.border, backgroundColor: Colors.surface }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Nouvelle recette</Text>
          <Pressable
            style={[styles.saveBtn, { backgroundColor: Colors.primary }]}
            onPress={() => void handleSave()}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Créer</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}
        >
          <ScreenContainer style={{ maxWidth: 640 }}>
            {/* Photo */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Photo</Text>
              <Pressable
                style={[styles.photoPicker, { backgroundColor: Colors.surface, borderColor: Colors.border, ...Shadow }]}
                onPress={showImageOptions}
              >
                {localImageUri ? (
                  <>
                    <Image
                      source={{ uri: localImageUri }}
                      style={StyleSheet.absoluteFillObject as any}
                      contentFit="cover"
                    />
                    <View style={styles.photoEditOverlay}>
                      <MaterialIcons name="edit" size={20} color="#fff" />
                      <Text style={styles.photoEditText}>Modifier</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialIcons name="add-a-photo" size={32} color={Colors.textMuted} />
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSubtle }}>
                      Ajouter une photo
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Galerie ou appareil photo</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Info */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Informations</Text>
              <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
                <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Titre *</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="Ex: Gratin dauphinois..."
                  placeholderTextColor={Colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />
                <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Description</Text>
                <TextInput
                  style={[inputStyle, { minHeight: 70, paddingTop: 10 }]}
                  placeholder="Décrivez votre recette..."
                  placeholderTextColor={Colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={{ flexDirection: 'row', marginTop: Spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Durée (min)</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="30"
                      placeholderTextColor={Colors.textMuted}
                      value={duration}
                      onChangeText={setDuration}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ width: Spacing.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Personnes</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="4"
                      placeholderTextColor={Colors.textMuted}
                      value={servings}
                      onChangeText={setServings}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Difficulté</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  {(['Facile', 'Moyen', 'Difficile'] as Difficulty[]).map(d => (
                    <Pressable
                      key={d}
                      style={[
                        styles.diffBtn,
                        {
                          backgroundColor: difficulty === d ? Colors.primary : Colors.surfaceMuted,
                          borderColor: difficulty === d ? Colors.primary : Colors.border,
                        },
                      ]}
                      onPress={() => setDifficulty(d)}
                    >
                      <Text
                        style={{
                          fontSize: FontSize.sm,
                          fontWeight: FontWeight.semibold,
                          color: difficulty === d ? '#fff' : Colors.textSubtle,
                        }}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={[styles.divider, { borderTopColor: Colors.borderLight }]} />
                <View style={styles.publicRow}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={[styles.publicIcon, { backgroundColor: Colors.primary + '15' }]}>
                      <MaterialIcons name={isPublicRecipe ? 'public' : 'lock'} size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: Colors.textSubtle, marginTop: 0, marginBottom: 2 }]}>
                        Recette publique
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>
                        {user
                          ? 'Visible par les autres utilisateurs et dans les recommandations'
                          : 'Connectez-vous pour partager vos recettes'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isPublicRecipe}
                    onValueChange={setIsPublicRecipe}
                    disabled={!user}
                    trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                    thumbColor={isPublicRecipe ? Colors.primary : '#f4f3f4'}
                  />
                </View>
              </View>
            </View>

            {/* Tags */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Tags</Text>
              <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {RECIPE_TAGS.map(tag => (
                    <Pressable
                      key={tag}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: selectedTags.includes(tag) ? Colors.primary : Colors.surfaceMuted,
                          borderColor: selectedTags.includes(tag) ? Colors.primary : Colors.border,
                        },
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={{
                          fontSize: FontSize.xs,
                          color: selectedTags.includes(tag) ? '#fff' : Colors.textSubtle,
                          fontWeight: selectedTags.includes(tag) ? FontWeight.semibold : FontWeight.medium,
                        }}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Ingredients */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Ingrédients</Text>
              <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
                {ingredients.map(ing => (
                  <View key={ing.id} style={[styles.ingRow, { borderBottomColor: Colors.borderLight }]}>
                    <View style={[styles.ingDot, { backgroundColor: Colors.primary }]} />
                    <Text style={{ flex: 1, fontSize: FontSize.md, color: Colors.text }}>{ing.name}</Text>
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textSubtle, marginRight: Spacing.sm }}>
                      {ing.quantity} {ing.unit}
                    </Text>
                    <Pressable onPress={() => setIngredients(p => p.filter(i => i.id !== ing.id))} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
                <View style={{ marginTop: Spacing.md }}>
                  <TextInput
                    style={[inputStyle, { marginBottom: Spacing.sm }]}
                    placeholder="Nom de l'ingrédient"
                    placeholderTextColor={Colors.textMuted}
                    value={ingName}
                    onChangeText={setIngName}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      placeholder="Quantité"
                      placeholderTextColor={Colors.textMuted}
                      value={ingQty}
                      onChangeText={setIngQty}
                      keyboardType="decimal-pad"
                    />
                    <View style={{ width: Spacing.sm }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                      {UNITS.map(u => (
                        <Pressable
                          key={u}
                          style={[
                            styles.unitChip,
                            {
                              backgroundColor: ingUnit === u ? Colors.primary : Colors.surfaceMuted,
                              borderColor: ingUnit === u ? Colors.primary : Colors.border,
                            },
                          ]}
                          onPress={() => setIngUnit(u)}
                        >
                          <Text
                            style={{
                              fontSize: FontSize.xs,
                              color: ingUnit === u ? '#fff' : Colors.textSubtle,
                              fontWeight: ingUnit === u ? FontWeight.semibold : FontWeight.regular,
                            }}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  <Pressable style={[styles.addIngBtn, { backgroundColor: Colors.primary }]} onPress={addIngredient}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.addIngBtnText}>{"Ajouter l'ingrédient"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Steps */}
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Étapes de préparation</Text>
              <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
                {steps.map((step, idx) => (
                  <View key={idx} style={[styles.stepRow, { marginBottom: Spacing.sm }]}>
                    <View style={[styles.stepNumBadge, { backgroundColor: Colors.primary }]}>
                      <Text style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <TextInput
                      style={[inputStyle, { flex: 1, minHeight: 50 }]}
                      placeholder={`Étape ${idx + 1}...`}
                      placeholderTextColor={Colors.textMuted}
                      value={step}
                      onChangeText={val => setSteps(p => p.map((s, i) => (i === idx ? val : s)))}
                      multiline
                      textAlignVertical="top"
                    />
                    {steps.length > 1 ? (
                      <Pressable onPress={() => setSteps(p => p.filter((_, i) => i !== idx))} hitSlop={8}>
                        <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Pressable
                  style={[styles.addStepBtn, { borderColor: Colors.primary }]}
                  onPress={() => setSteps(p => [...p, ''])}
                >
                  <MaterialIcons name="add" size={18} color={Colors.primary} />
                  <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                    Ajouter une étape
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScreenContainer>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    saveBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 8,
      borderRadius: Radius.md,
      minWidth: 60,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
    card: { borderRadius: Radius.lg, padding: Spacing.md },
    photoPicker: {
      height: 180,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoEditOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    photoEditText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
    photoPlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 6 },
    fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6, marginTop: Spacing.sm },
    diffBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1 },
    divider: { borderTopWidth: 1, marginTop: Spacing.md, marginBottom: Spacing.sm },
    publicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: 4,
    },
    publicIcon: { width: 32, height: 32, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
    ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
    ingDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
    unitChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.sm, marginRight: 4, borderWidth: 1 },
    addIngBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.md,
      borderRadius: Radius.md,
      paddingVertical: 10,
    },
    addIngBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    stepNumBadge: {
      width: 28,
      height: 28,
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: 8,
    },
    addStepBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      marginTop: Spacing.sm,
    },
  });
};
