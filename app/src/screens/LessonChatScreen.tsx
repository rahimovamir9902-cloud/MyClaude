import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ChatScreen } from './ChatScreen';
import { getLesson } from '../data/hsk';
import { colors, spacing } from '../theme/colors';
import type { LessonsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonChat'>;

// Tutor chat scoped to a specific lesson's vocabulary.
export function LessonChatScreen({ route }: Props) {
  const lesson = getLesson(route.params.lessonId);
  if (!lesson) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Дарс ёфт нашуд.</Text>
      </View>
    );
  }
  return <ChatScreen lesson={lesson} />;
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  missingText: { color: colors.textMuted, fontSize: 16 },
});
