import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { Card } from '../components/Card';
import { tj } from '../i18n/tj';
import { colors, radius, spacing } from '../theme/colors';
import type { RootTabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg },
      ]}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>汉语</Text>
        <Text style={styles.appName}>{tj.appName}</Text>
        <Text style={styles.tagline}>{tj.appTagline}</Text>
      </View>

      <Text style={styles.welcome}>{tj.home.welcome}</Text>
      <Text style={styles.subtitle}>{tj.home.subtitle}</Text>

      <Card style={styles.action} onPress={() => navigation.navigate('Tutor')}>
        <Text style={styles.actionEmoji}>💬</Text>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>{tj.home.startTutor}</Text>
          <Text style={styles.actionDesc}>{tj.home.startTutorDesc}</Text>
        </View>
      </Card>

      <Card
        style={styles.action}
        onPress={() => navigation.navigate('Lessons', { screen: 'LessonsList' })}
      >
        <Text style={styles.actionEmoji}>📚</Text>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>{tj.home.browseLessons}</Text>
          <Text style={styles.actionDesc}>{tj.home.browseLessonsDesc}</Text>
        </View>
      </Card>

      <View style={styles.tip}>
        <Text style={styles.tipTitle}>💡 {tj.home.tipTitle}</Text>
        <Text style={styles.tipText}>{tj.home.tip}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  logo: {
    fontSize: 56,
    color: colors.primary,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.text },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  welcome: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  actionEmoji: { fontSize: 34 },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  actionDesc: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  tip: {
    backgroundColor: '#FFF3D6',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#F3D98A',
  },
  tipTitle: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  tipText: { color: colors.text, lineHeight: 21 },
});
