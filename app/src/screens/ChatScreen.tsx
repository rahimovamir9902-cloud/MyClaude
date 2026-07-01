import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '../components/ChatBubble';
import { sendChat } from '../api/client';
import { DEMO_MODE } from '../config';
import { tj } from '../i18n/tj';
import { colors, radius, spacing } from '../theme/colors';
import type { ChatMessage, Lesson } from '../types';

type Props = {
  lesson?: Lesson | null;
};

/**
 * The AI tutor chat. Works standalone (Tutor tab) or scoped to a lesson
 * (when opened from a lesson's "practice" button).
 */
export function ChatScreen({ lesson }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: tj.tutor.greeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: 'user', content: trimmed },
      ];
      setMessages(nextMessages);
      setInput('');
      setLoading(true);
      scrollToEnd();

      try {
        const { reply } = await sendChat(nextMessages, lesson);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch (err) {
        // sendChat degrades to the demo tutor internally, so this is a rare
        // last-resort safety net.
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${tj.tutor.offlineHint}` },
        ]);
      } finally {
        setLoading(false);
        scrollToEnd();
      }
    },
    [messages, loading, lesson, scrollToEnd]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      {DEMO_MODE && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>ℹ️ {tj.tutor.demoBanner}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <ChatBubble role={item.role} content={item.content} />
        )}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={scrollToEnd}
        ListFooterComponent={
          loading ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.thinkingText}>{tj.tutor.thinking}</Text>
            </View>
          ) : null
        }
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {tj.tutor.suggestions.map((s) => (
            <Pressable
              key={s}
              style={styles.chip}
              onPress={() => submit(s)}
            >
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={tj.tutor.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={() => submit(input)}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendDisabled]}
          onPress={() => submit(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>{tj.tutor.send}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  demoBanner: {
    backgroundColor: '#FFF3D6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3D98A',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  demoBannerText: { color: '#7A5A00', fontSize: 13 },
  listContent: { padding: spacing.md, paddingBottom: spacing.md },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  thinkingText: { color: colors.textMuted, fontStyle: 'italic' },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.primary, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
