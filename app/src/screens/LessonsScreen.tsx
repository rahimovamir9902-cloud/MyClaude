import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card } from '../components/Card';
import { lessons } from '../data/hsk';
import { tj } from '../i18n/tj';
import { colors, radius, spacing } from '../theme/colors';
import type { LessonsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export function LessonsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <FlatList
      style={styles.container}
      data={lessons}
      keyExtractor={(l) => l.id}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.xl,
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{tj.lessons.title}</Text>
          <Text style={styles.subtitle}>{tj.lessons.subtitle}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card
          style={styles.card}
          onPress={() =>
            navigation.navigate('LessonDetail', { lessonId: item.id })
          }
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.level}</Text>
          </View>
          <Text style={styles.lessonTitle}>{item.title}</Text>
          <Text style={styles.lessonDesc}>{item.description}</Text>
          <Text style={styles.count}>
            {item.words.length} {tj.lessons.words}
          </Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  card: { marginBottom: spacing.md },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  lessonTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  lessonDesc: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  count: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
