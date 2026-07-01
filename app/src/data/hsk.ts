import type { Lesson } from '../types';

// Starter lesson set based on HSK 1 vocabulary.
// Each word: hanzi (汉字), pinyin with tones, and Tajik meaning.
export const lessons: Lesson[] = [
  {
    id: 'hsk1-greetings',
    level: 'HSK 1',
    title: 'Салом ва шиносоӣ',
    description: 'Аввалин калимаҳо барои салом додан ва шиносшавӣ.',
    words: [
      { hanzi: '你好', pinyin: 'nǐ hǎo', tj: 'салом' },
      { hanzi: '你', pinyin: 'nǐ', tj: 'ту / шумо' },
      { hanzi: '好', pinyin: 'hǎo', tj: 'хуб' },
      { hanzi: '谢谢', pinyin: 'xièxie', tj: 'ташаккур' },
      { hanzi: '不客气', pinyin: 'bú kèqi', tj: 'саломат бошед (хоҳиш мекунам)' },
      { hanzi: '再见', pinyin: 'zàijiàn', tj: 'то дидор' },
      { hanzi: '对不起', pinyin: 'duìbuqǐ', tj: 'бубахшед' },
      { hanzi: '没关系', pinyin: 'méi guānxi', tj: 'ҳеҷ гап не / муҳим нест' },
    ],
  },
  {
    id: 'hsk1-numbers',
    level: 'HSK 1',
    title: 'Рақамҳо аз 1 то 10',
    description: 'Шумориши асосӣ бо забони хитоӣ.',
    words: [
      { hanzi: '一', pinyin: 'yī', tj: 'як (1)' },
      { hanzi: '二', pinyin: 'èr', tj: 'ду (2)' },
      { hanzi: '三', pinyin: 'sān', tj: 'се (3)' },
      { hanzi: '四', pinyin: 'sì', tj: 'чор (4)' },
      { hanzi: '五', pinyin: 'wǔ', tj: 'панҷ (5)' },
      { hanzi: '六', pinyin: 'liù', tj: 'шаш (6)' },
      { hanzi: '七', pinyin: 'qī', tj: 'ҳафт (7)' },
      { hanzi: '八', pinyin: 'bā', tj: 'ҳашт (8)' },
      { hanzi: '九', pinyin: 'jiǔ', tj: 'нӯҳ (9)' },
      { hanzi: '十', pinyin: 'shí', tj: 'даҳ (10)' },
    ],
  },
  {
    id: 'hsk1-people',
    level: 'HSK 1',
    title: 'Одамон ва оила',
    description: 'Калимаҳо дар бораи одамон ва аъзои оила.',
    words: [
      { hanzi: '我', pinyin: 'wǒ', tj: 'ман' },
      { hanzi: '他', pinyin: 'tā', tj: 'ӯ (мард)' },
      { hanzi: '她', pinyin: 'tā', tj: 'ӯ (зан)' },
      { hanzi: '爸爸', pinyin: 'bàba', tj: 'падар' },
      { hanzi: '妈妈', pinyin: 'māma', tj: 'модар' },
      { hanzi: '儿子', pinyin: 'érzi', tj: 'писар' },
      { hanzi: '女儿', pinyin: 'nǚ’ér', tj: 'духтар' },
      { hanzi: '朋友', pinyin: 'péngyou', tj: 'дӯст' },
      { hanzi: '老师', pinyin: 'lǎoshī', tj: 'муаллим / устод' },
      { hanzi: '学生', pinyin: 'xuésheng', tj: 'донишҷӯ / хонанда' },
    ],
  },
  {
    id: 'hsk1-time',
    level: 'HSK 1',
    title: 'Вақт ва рӯзҳо',
    description: 'Калимаҳои асосӣ дар бораи вақт.',
    words: [
      { hanzi: '今天', pinyin: 'jīntiān', tj: 'имрӯз' },
      { hanzi: '明天', pinyin: 'míngtiān', tj: 'фардо' },
      { hanzi: '昨天', pinyin: 'zuótiān', tj: 'дирӯз' },
      { hanzi: '现在', pinyin: 'xiànzài', tj: 'ҳозир' },
      { hanzi: '年', pinyin: 'nián', tj: 'сол' },
      { hanzi: '月', pinyin: 'yuè', tj: 'моҳ' },
      { hanzi: '日', pinyin: 'rì', tj: 'рӯз' },
      { hanzi: '星期', pinyin: 'xīngqī', tj: 'ҳафта' },
    ],
  },
  {
    id: 'hsk1-food',
    level: 'HSK 1',
    title: 'Хӯрок ва нӯшокӣ',
    description: 'Калимаҳо барои хӯрокхӯрӣ ва нӯшидан.',
    words: [
      { hanzi: '吃', pinyin: 'chī', tj: 'хӯрдан' },
      { hanzi: '喝', pinyin: 'hē', tj: 'нӯшидан' },
      { hanzi: '米饭', pinyin: 'mǐfàn', tj: 'биринҷ (палав/оши биринҷ)' },
      { hanzi: '水', pinyin: 'shuǐ', tj: 'об' },
      { hanzi: '茶', pinyin: 'chá', tj: 'чой' },
      { hanzi: '苹果', pinyin: 'píngguǒ', tj: 'себ' },
      { hanzi: '菜', pinyin: 'cài', tj: 'таом / сабзавот' },
      { hanzi: '水果', pinyin: 'shuǐguǒ', tj: 'мева' },
    ],
  },
  {
    id: 'hsk1-verbs',
    level: 'HSK 1',
    title: 'Феълҳои асосӣ',
    description: 'Феълҳои пуркорбурд барои ҷумласозӣ.',
    words: [
      { hanzi: '是', pinyin: 'shì', tj: 'будан (аст)' },
      { hanzi: '有', pinyin: 'yǒu', tj: 'доштан' },
      { hanzi: '看', pinyin: 'kàn', tj: 'нигоҳ кардан / дидан' },
      { hanzi: '说', pinyin: 'shuō', tj: 'гуфтан' },
      { hanzi: '去', pinyin: 'qù', tj: 'рафтан' },
      { hanzi: '来', pinyin: 'lái', tj: 'омадан' },
      { hanzi: '学习', pinyin: 'xuéxí', tj: 'омӯхтан' },
      { hanzi: '爱', pinyin: 'ài', tj: 'дӯст доштан' },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
