import { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, Linking,
} from 'react-native';
import {
  Text, FAB, Card, Button, TextInput, HelperText,
  Dialog, Portal, IconButton, Chip, ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../src/services/firebase/config';
import {
  subscribeToCollection, addRecord, deleteRecord, paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { MedicalDocument, DocumentFileType } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';
import { Timestamp } from 'firebase/firestore';

// Try to import expo-document-picker if installed
let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DocumentPicker = require('expo-document-picker');
} catch {
  // not installed
}

interface PickedFile {
  uri: string;
  mimeType: string;
  fileType: DocumentFileType;
  fileName: string;
}

function fileTypeIcon(ft: DocumentFileType): string {
  if (ft === 'pdf') return 'file-pdf-box';
  if (ft === 'image') return 'image';
  return 'file-document';
}

function fileTypeColor(ft: DocumentFileType): string {
  if (ft === 'pdf') return Colors.danger;
  if (ft === 'image') return Colors.info;
  return Colors.textSecondary;
}

export default function MedicalFileScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [docs, setDocs] = useState<MedicalDocument[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<MedicalDocument>(
      paths.documents(familyId, petId),
      [orderBy('uploadedAt', 'desc')],
      setDocs
    );
  }, [familyId, petId]);

  function reset() {
    setNameInput('');
    setNotesInput('');
    setPickedFile(null);
    setError('');
  }

  async function handleSave() {
    if (!nameInput.trim()) { setError(t('common.required')); return; }
    if (!pickedFile) { setError(t('medicalFile.noFileSelected')); return; }

    setUploading(true);
    setError('');
    try {
      const response = await fetch(pickedFile.uri);
      const blob = await response.blob();

      const ext = pickedFile.mimeType?.split('/')[1] ?? 'bin';
      const storagePath = `families/${familyId}/pets/${petId}/documents/${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: pickedFile.mimeType });
      const fileUrl = await getDownloadURL(storageRef);

      await addRecord<MedicalDocument>(paths.documents(familyId, petId), {
        petId,
        familyId,
        name: nameInput.trim(),
        fileUrl,
        fileType: pickedFile.fileType,
        mimeType: pickedFile.mimeType,
        notes: notesInput.trim() || undefined,
        uploadedBy: user!.uid,
        uploadedAt: Timestamp.now(),
      });

      setDialogVisible(false);
      reset();
    } catch (e: any) {
      setError(e.message ?? t('common.error'));
    } finally {
      setUploading(false);
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPickedFile({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileType: 'image',
      fileName: asset.fileName ?? 'image',
    });
    setError('');
  }

  async function handlePickDocument() {
    if (!DocumentPicker) {
      Alert.alert(
        t('medicalFile.docPickerMissing'),
        t('medicalFile.docPickerInstall')
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const fileType: DocumentFileType = mimeType === 'application/pdf' ? 'pdf' : mimeType.startsWith('image/') ? 'image' : 'other';
    setPickedFile({
      uri: asset.uri,
      mimeType,
      fileType,
      fileName: asset.name,
    });
    setError('');
  }

  async function handleDelete(doc: MedicalDocument) {
    Alert.alert(
      t('medicalFile.deleteTitle'),
      t('medicalFile.deleteConfirm', { name: doc.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteRecord(paths.documents(familyId, petId), doc.id);
          },
        },
      ]
    );
  }

  function openDoc(doc: MedicalDocument) {
    Linking.openURL(doc.fileUrl).catch(() => {});
  }

  return (
    <>
      <Stack.Screen options={{ title: t('medicalFile.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {docs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>{t('medicalFile.noDocs')}</Text>
              <Text style={styles.emptyHint}>{t('medicalFile.hint')}</Text>
            </View>
          ) : (
            docs.map((doc) => (
              <Card key={doc.id} style={styles.card} onPress={() => openDoc(doc)}>
                <Card.Title
                  title={doc.name}
                  subtitle={formatDate(doc.uploadedAt)}
                  left={(props) => (
                    <IconButton
                      {...props}
                      icon={fileTypeIcon(doc.fileType)}
                      iconColor={fileTypeColor(doc.fileType)}
                    />
                  )}
                  right={() => (
                    <View style={styles.cardRight}>
                      <Chip compact style={styles.typeChip}>
                        {doc.fileType.toUpperCase()}
                      </Chip>
                      <IconButton
                        icon="delete"
                        size={18}
                        iconColor={Colors.danger}
                        onPress={() => handleDelete(doc)}
                      />
                    </View>
                  )}
                />
                {doc.notes ? (
                  <Card.Content>
                    <Text style={styles.notes}>{doc.notes}</Text>
                  </Card.Content>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => { reset(); setDialogVisible(true); }} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('medicalFile.add')}</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label={t('medicalFile.docName')}
                value={nameInput}
                onChangeText={setNameInput}
                mode="outlined"
                style={styles.input}
                placeholder={t('medicalFile.docNameHint')}
              />
              <TextInput
                label={`${t('common.notes')} (${t('common.optional')})`}
                value={notesInput}
                onChangeText={setNotesInput}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={2}
              />

              {/* File picker buttons */}
              {!uploading && (
                <View style={styles.pickRow}>
                  <Button
                    mode={pickedFile?.fileType === 'image' ? 'contained' : 'outlined'}
                    icon="image"
                    onPress={handlePickImage}
                    style={styles.pickButton}
                    buttonColor={pickedFile?.fileType === 'image' ? Colors.primary : undefined}
                    textColor={pickedFile?.fileType === 'image' ? '#fff' : Colors.primary}
                  >
                    {t('medicalFile.pickImage')}
                  </Button>
                  <Button
                    mode={pickedFile?.fileType === 'pdf' ? 'contained' : 'outlined'}
                    icon="file-pdf-box"
                    onPress={handlePickDocument}
                    style={styles.pickButton}
                    buttonColor={pickedFile?.fileType === 'pdf' ? Colors.danger : undefined}
                    textColor={pickedFile?.fileType === 'pdf' ? '#fff' : Colors.danger}
                  >
                    {t('medicalFile.pickPDF')}
                  </Button>
                </View>
              )}

              {/* Selected file name */}
              {pickedFile && !uploading && (
                <Text style={styles.selectedFile}>
                  ✓ {pickedFile.fileName}
                </Text>
              )}

              {uploading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.uploadingText}>{t('medicalFile.uploading')}</Text>
                </View>
              )}

              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setDialogVisible(false); reset(); }}>{t('common.cancel')}</Button>
              <Button
                onPress={handleSave}
                loading={uploading}
                disabled={!pickedFile || uploading}
                textColor={Colors.primary}
              >
                {t('common.save')}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 8 },
  cardRight: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  typeChip: { backgroundColor: Colors.primaryLight },
  emptyContainer: { marginTop: 40, alignItems: 'center' },
  empty: { textAlign: 'center', color: Colors.textSecondary, fontSize: 16 },
  emptyHint: { textAlign: 'center', color: Colors.textDisabled, fontSize: 13, marginTop: 8 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  notes: { color: Colors.textSecondary, fontSize: 13 },
  pickRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pickButton: { flex: 1, borderColor: Colors.border },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  uploadingText: { color: Colors.textSecondary },
  selectedFile: { color: Colors.success, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
});
