import { lessons } from '../data/hsk';
import type { ChatMessage, Lesson, Word } from '../types';

// A fully offline "demo tutor". It returns pre-written Tajik answers so the app
// is usable with no API key and no backend. Answers are keyword-matched to the
// user's message and, when present, the current lesson's vocabulary.
//
// This is intentionally simple (no real AI) — it exists so the app works out of
// the box and during Play Store review before a live backend is configured.

function formatWord(w: Word): string {
  return `${w.hanzi} (${w.pinyin}) — ${w.tj}`;
}

function wordsBlock(words: Word[]): string {
  return words.map((w) => `• ${formatWord(w)}`).join('\n');
}

const DEMO_NOTE =
  '\n\n(Ҳолати намоишӣ: ин ҷавоби тайёр аст. Барои устоди зиндаи сунъӣ калиди Claude API-ро дар сервер танзим кунед.)';

type Rule = {
  match: RegExp;
  reply: (lesson?: Lesson | null) => string;
};

const rules: Rule[] = [
  {
    // greetings
    match: /салом|нӣ ?ҳао|nǐ|hǎo|привет|hello|шинос/i,
    reply: () =>
      'Барои «салом» гуфтан мегӯем:\n\n你好 (nǐ hǎo) — салом\n\n你 (nǐ) яъне «ту», 好 (hǎo) яъне «хуб». Пас маънои таҳтуллафзӣ «ту хуб» аст.\n\nҶавоб низ ҳамин тавр: 你好！Кӯшиш кунед худатон бигӯед. 😊',
  },
  {
    // numbers
    match: /рақам|шумор|адад|number|1|2|3|4|5|як|ду|се|чор|панҷ/i,
    reply: () =>
      'Рақамҳо аз 1 то 5:\n\n' +
      '一 (yī) — як\n二 (èr) — ду\n三 (sān) — се\n四 (sì) — чор\n五 (wǔ) — панҷ\n\n' +
      'Машқ: 三 чанд аст? 🤔',
  },
  {
    // tones
    match: /оҳанг|тон|tone|талаффуз|садо/i,
    reply: () =>
      'Дар забони хитоӣ 4 оҳанг (тон) ҳаст, ва як оҳанги «холӣ»:\n\n' +
      '1) баланд ва ҳамвор: mā (妈 — модар)\n' +
      '2) баланшаванда: má (麻)\n' +
      '3) поён ва боло: mǎ (马 — асп)\n' +
      '4) тез ва пастшаванда: mà (骂)\n\n' +
      'Ҳамон ҳиҷо бо оҳанги гуногун маънои дигар дорад — барои ҳамин оҳанг хеле муҳим аст.',
  },
  {
    // thanks
    match: /ташаккур|раҳмат|xiè|谢/i,
    reply: () =>
      'Барои «ташаккур» мегӯем:\n\n谢谢 (xièxie) — ташаккур\n\nҶавоб: 不客气 (bú kèqi) — саломат бошед / хоҳиш мекунам.',
  },
];

function pickDemoReply(userText: string, lesson?: Lesson | null): string {
  // If we're inside a lesson, prefer teaching that lesson's words.
  if (lesson && /калим|дарс|машқ|омӯз|ёд|такрор|word/i.test(userText)) {
    return (
      `Биёед калимаҳои дарси «${lesson.title}»-ро якҷоя такрор кунем:\n\n` +
      wordsBlock(lesson.words) +
      '\n\nЯктояшро интихоб кунед ва бо овози баланд бигӯед. Кадомаш барои шумо душвортар аст?' +
      DEMO_NOTE
    );
  }

  for (const rule of rules) {
    if (rule.match.test(userText)) {
      return rule.reply(lesson) + DEMO_NOTE;
    }
  }

  // Default: friendly nudge + a sample word (from the lesson if any).
  const sample = (lesson?.words?.[0] ?? lessons[0].words[0]) as Word;
  return (
    'Саволи хубе! Ман метавонам калимаҳо, рақамҳо, оҳангҳо ва ҷумлаҳои соддаро шарҳ диҳам.\n\n' +
    `Барои оғоз ин калимаро ёд гиред:\n${formatWord(sample)}\n\n` +
    'Аз ман пурсед, масалан: «Чӣ тавр «ташаккур» гӯям?»' +
    DEMO_NOTE
  );
}

/** Returns a demo tutor reply for the latest user message. */
export function demoReply(messages: ChatMessage[], lesson?: Lesson | null): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return pickDemoReply(lastUser?.content ?? '', lesson);
}
