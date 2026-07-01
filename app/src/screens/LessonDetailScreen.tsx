import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { getLesson } from '../data/hsk';
import { tj } from '../i18n/tj';
import { colors, radius, spacing } from '../theme/colors';
import type { LessonsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonDetail'>;

export function LessonDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const lesson = getLesson(route.params.lessonId);

  if (!lesson) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Дарс ёфт нашуд.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{lesson.level}</Text>
      </View>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.desc}>{lesson.description}</Text>

      <Text style={styles.sectionTitle}>{tj.lessonDetail.words}</Text>
      {lesson.words.map((w, i) => (
        <Card key={`${w.hanzi}-${i}`} style={styles.wordCard}>
          <View style={styles.wordRow}>
            <Text style={styles.hanzi}>{w.hanzi}</Text>
            <View style={styles.wordMeta}>
              <Text style={styles.pinyin}>{w.pinyin}</Text>
              <Text style={styles.meaning}>{w.tj}</Text>
            </View>
          </View>
        </Card>
      ))}

      <PrimaryButton
        label={tj.lessonDetail.practiceWithTutor}
        onPress={() =>
          navigation.navigate('LessonChat', { lessonId: lesson.id })
        }
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  missingText: { color: colors.textMuted, fontSize: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  desc: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  wordCard: { marginBottom: spacing.sm },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hanzi: { fontSize: 32, fontWeight: '700', color: colors.primary, minWidth: 72 },
  wordMeta: { flex: 1 },
  pinyin: { fontSize: 16, color: colors.accent, fontWeight: '700' },
  meaning: { fontSize: 16, color: colors.text, marginTop: 2 },
});
