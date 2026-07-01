import type { NavigatorScreenParams } from '@react-navigation/native';

export type LessonsStackParamList = {
  LessonsList: undefined;
  LessonDetail: { lessonId: string };
  LessonChat: { lessonId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList>;
  Tutor: undefined;
};
