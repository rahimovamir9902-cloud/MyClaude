import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LessonsScreen } from '../screens/LessonsScreen';
import { LessonDetailScreen } from '../screens/LessonDetailScreen';
import { LessonChatScreen } from '../screens/LessonChatScreen';
import { tj } from '../i18n/tj';
import { colors } from '../theme/colors';
import type { LessonsStackParamList } from './types';

const Stack = createNativeStackNavigator<LessonsStackParamList>();

export function LessonsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="LessonsList"
        component={LessonsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LessonDetail"
        component={LessonDetailScreen}
        options={{ title: tj.tabs.lessons }}
      />
      <Stack.Screen
        name="LessonChat"
        component={LessonChatScreen}
        options={{ title: tj.tutor.title }}
      />
    </Stack.Navigator>
  );
}
