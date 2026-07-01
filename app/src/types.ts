export type Word = {
  hanzi: string; // Chinese characters, e.g. 你好
  pinyin: string; // pinyin with tones, e.g. nǐ hǎo
  tj: string; // Tajik translation
};

export type Lesson = {
  id: string;
  level: string; // e.g. "HSK 1"
  title: string; // Tajik title
  description: string; // Tajik description
  words: Word[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
