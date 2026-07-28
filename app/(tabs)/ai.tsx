import { useState, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Text, TextInput, IconButton, Card, ActivityIndicator, Chip, Menu, Button,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../src/services/firebase/config';
import { useActivePets } from '../../src/hooks/usePets';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';
import { Pet } from '../../src/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS_HE = [
  'מה מינון הנורמלי של...',
  'האם תרופה זו בטוחה לחתול?',
  'מתי לפנות לווטרינר?',
  'מהו לוח חיסונים מומלץ?',
  'כמה פעמים צריך לטפל בפרעושים?',
];

const SUGGESTED_QUESTIONS_EN = [
  'What is the normal dosage of...',
  'Is this medication safe for cats?',
  'When should I see a vet?',
  'What is the recommended vaccine schedule?',
  'How often should I treat for fleas?',
];

export default function AIAssistantScreen() {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const pets = useActivePets();
  const user = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [petMenuVisible, setPetMenuVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const suggestedQuestions = isHe ? SUGGESTED_QUESTIONS_HE : SUGGESTED_QUESTIONS_EN;

  async function sendMessage(text?: string) {
    const messageText = (text ?? inputText).trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const functions = getFunctions(app, 'europe-west1');
      const askAI = httpsCallable<
        { message: string; petContext: string; language: string },
        { response: string }
      >(functions, 'askPetAI');

      let petContext = '';
      if (selectedPet) {
        const speciesInfo = SPECIES_MAP[selectedPet.species];
        const speciesLabel = isHe ? speciesInfo?.labelHe : speciesInfo?.labelEn;
        petContext = `Pet name: ${selectedPet.name}, Species: ${speciesLabel}${selectedPet.breed ? `, Breed: ${selectedPet.breed}` : ''}`;
      }

      const result = await askAI({
        message: messageText,
        petContext,
        language: i18n.language,
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: result.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const limitReached =
        e?.code === 'functions/resource-exhausted' ||
        e?.message === 'DAILY_AI_LIMIT_REACHED';
      const text = limitReached
        ? t('ai.limitReached')
        : isHe
          ? `שגיאה: ${e.message ?? 'לא ניתן לקבל תשובה כרגע. ודא שה-Cloud Function פרוסה.'}`
          : `Error: ${e.message ?? 'Could not get a response. Make sure the Cloud Function is deployed.'}`;
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function clearChat() {
    setMessages([]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            🤖 {t('ai.title')}
          </Text>
          {messages.length > 0 && (
            <IconButton icon="delete-sweep" size={22} iconColor={Colors.textSecondary} onPress={clearChat} />
          )}
        </View>

        {/* Pet selector */}
        <View style={styles.petRow}>
          <Text style={styles.petLabel}>{t('ai.context')}: </Text>
          <Menu
            visible={petMenuVisible}
            onDismiss={() => setPetMenuVisible(false)}
            anchor={
              <Chip
                icon={selectedPet ? undefined : 'paw'}
                onPress={() => setPetMenuVisible(true)}
                style={styles.petChip}
              >
                {selectedPet
                  ? `${SPECIES_MAP[selectedPet.species]?.emoji ?? '🐾'} ${selectedPet.name}`
                  : t('ai.allPets')}
              </Chip>
            }
          >
            <Menu.Item
              title={t('ai.allPets')}
              onPress={() => { setSelectedPet(null); setPetMenuVisible(false); }}
            />
            {pets.map((pet) => (
              <Menu.Item
                key={pet.id}
                title={`${SPECIES_MAP[pet.species]?.emoji ?? '🐾'} ${pet.name}`}
                onPress={() => { setSelectedPet(pet); setPetMenuVisible(false); }}
              />
            ))}
          </Menu>
        </View>

        {/* Chat area */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
        >
          {messages.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>{t('ai.welcome')}</Text>
              <Text style={styles.welcomeSubtitle}>{t('ai.disclaimer')}</Text>
              <Text style={styles.suggestionsLabel}>{t('ai.suggestions')}</Text>
              {suggestedQuestions.map((q, i) => (
                <Chip
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(q)}
                >
                  {q}
                </Chip>
              ))}
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                {msg.role === 'assistant' && (
                  <Text style={styles.roleLabel}>🤖 {t('ai.assistant')}</Text>
                )}
                <Text style={[
                  styles.messageText,
                  msg.role === 'user' ? styles.userText : styles.assistantText,
                ]}>
                  {msg.text}
                </Text>
              </View>
            ))
          )}
          {loading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>{t('ai.thinking')}</Text>
            </View>
          )}
        </ScrollView>

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('ai.inputPlaceholder')}
            mode="outlined"
            style={styles.textInput}
            multiline
            maxLength={1000}
            onSubmitEditing={() => sendMessage()}
            right={
              <TextInput.Icon
                icon="send"
                color={inputText.trim() ? Colors.primary : Colors.textDisabled}
                onPress={() => sendMessage()}
                disabled={!inputText.trim() || loading}
              />
            }
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontWeight: 'bold' },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  petLabel: { color: Colors.textSecondary, fontSize: 13 },
  petChip: { backgroundColor: Colors.primaryLight },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  welcomeContainer: { alignItems: 'center', marginTop: 20 },
  welcomeTitle: {
    fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13, color: Colors.warning, textAlign: 'center', marginBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 8,
  },
  suggestionsLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10, alignSelf: 'flex-start' },
  suggestionChip: { marginBottom: 8, alignSelf: 'flex-start', backgroundColor: Colors.surface },
  messageBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    elevation: 1,
  },
  roleLabel: { color: Colors.textSecondary, fontSize: 11, marginBottom: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  assistantText: { color: Colors.textPrimary },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
    elevation: 1,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  inputRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: { backgroundColor: Colors.surface },
});
