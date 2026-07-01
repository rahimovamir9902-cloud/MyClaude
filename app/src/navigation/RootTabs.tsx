import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { TutorScreen } from '../screens/TutorScreen';
import { LessonsStack } from './LessonsStack';
import { tj } from '../i18n/tj';
import { colors } from '../theme/colors';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function icon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: tj.tabs.home,
          headerShown: false,
          tabBarIcon: icon('🏠'),
        }}
      />
      <Tab.Screen
        name="Lessons"
        component={LessonsStack}
        options={{
          title: tj.tabs.lessons,
          headerShown: false,
          tabBarIcon: icon('📚'),
        }}
      />
      <Tab.Screen
        name="Tutor"
        component={TutorScreen}
        options={{
          title: tj.tutor.title,
          tabBarIcon: icon('💬'),
        }}
      />
    </Tab.Navigator>
  );
}
