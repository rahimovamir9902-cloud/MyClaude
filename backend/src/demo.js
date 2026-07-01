// Offline "demo tutor" for the backend: pre-written Tajik answers used when no
// ANTHROPIC_API_KEY is configured, so the service is usable without a key.
// Mirrors the app's src/api/demo.ts.

const DEMO_NOTE =
  '\n\n(Ҳолати намоишӣ: ин ҷавоби тайёр аст. Барои устоди зиндаи сунъӣ калиди Claude API-ро дар сервер танзим кунед.)';

const rules = [
  {
    match: /салом|nǐ|hǎo|hello|шинос/i,
    reply:
      'Барои «салом» гуфтан мегӯем:\n\n你好 (nǐ hǎo) — салом\n\n你 (nǐ) яъне «ту», 好 (hǎo) яъне «хуб».',
  },
  {
    match: /рақам|шумор|адад|number|як|ду|се|чор|панҷ/i,
    reply:
      'Рақамҳо аз 1 то 5:\n\n一 (yī) — як\n二 (èr) — ду\n三 (sān) — се\n四 (sì) — чор\n五 (wǔ) — панҷ',
  },
  {
    match: /оҳанг|тон|tone|талаффуз/i,
    reply:
      'Дар забони хитоӣ 4 оҳанг ҳаст: mā, má, mǎ, mà. Ҳамон ҳиҷо бо оҳанги гуногун маънои дигар дорад.',
  },
  {
    match: /ташаккур|раҳмат|xiè|谢/i,
    reply:
      'Барои «ташаккур»: 谢谢 (xièxie). Ҷавоб: 不客气 (bú kèqi) — саломат бошед.',
  },
];

export function demoReply(messages, lesson) {
  const lastUser = [...(messages || [])]
    .reverse()
    .find((m) => m && m.role === 'user');
  const text = String(lastUser?.content || '');

  if (lesson && /калим|дарс|машқ|омӯз|ёд|такрор|word/i.test(text)) {
    const words = (lesson.words || [])
      .map((w) => `• ${w.hanzi} (${w.pinyin}) — ${w.tj}`)
      .join('\n');
    return (
      `Биёед калимаҳои дарси «${lesson.title}»-ро такрор кунем:\n\n${words}` +
      DEMO_NOTE
    );
  }

  for (const rule of rules) {
    if (rule.match.test(text)) return rule.reply + DEMO_NOTE;
  }

  return (
    'Саволи хубе! Ман калимаҳо, рақамҳо ва оҳангҳоро шарҳ дода метавонам. ' +
    'Масалан бипурсед: «Чӣ тавр «ташаккур» гӯям?»' +
    DEMO_NOTE
  );
}
