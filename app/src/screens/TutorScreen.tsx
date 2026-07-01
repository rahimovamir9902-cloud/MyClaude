import React from 'react';
import { ChatScreen } from './ChatScreen';

// The standalone tutor tab: an open-ended chat with no specific lesson.
export function TutorScreen() {
  return <ChatScreen lesson={null} />;
}
