import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  role: 'user' | 'assistant';
  content: string;
};

export function ChatBubble({ role, content }: Props) {
  const isUser = role === 'user';
  return (
    <View
      style={[styles.row, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.user : styles.tutor,
        ]}
      >
        <Text style={[styles.text, isUser ? styles.userText : styles.tutorText]}>
          {content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs },
  bubble: {
    maxWidth: '85%',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  user: {
    backgroundColor: colors.bubbleUser,
    borderBottomRightRadius: radius.sm,
  },
  tutor: {
    backgroundColor: colors.bubbleTutor,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  text: { fontSize: 16, lineHeight: 23 },
  userText: { color: '#fff' },
  tutorText: { color: colors.text },
});
