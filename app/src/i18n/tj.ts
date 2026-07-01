// All user-facing strings, in Tajik (Cyrillic script).
// Centralised here so the whole app speaks one language and text is easy to edit.
export const tj = {
  appName: 'Хитоӣ',
  appTagline: 'Забони хитоиро бо ёрии зеҳни сунъӣ омӯзед',

  tabs: {
    home: 'Хона',
    lessons: 'Дарсҳо',
    tutor: 'Устод',
  },

  home: {
    welcome: 'Хуш омадед!',
    subtitle: 'Имрӯз биёед забони хитоиро якҷоя омӯзем.',
    startTutor: 'Бо устоди сунъӣ сӯҳбат кунед',
    startTutorDesc: 'Саволҳоятонро диҳед, ҳама чиз ба тоҷикӣ шарҳ дода мешавад.',
    browseLessons: 'Дарсҳоро тамошо кунед',
    browseLessonsDesc: 'Аз сатҳи HSK 1 сар карда, қадам ба қадам пеш равед.',
    tipTitle: 'Маслиҳати рӯз',
    tip: 'Ҳар рӯз 10 дақиқа машқ кардан аз як соат дар як ҳафта беҳтар аст.',
  },

  lessons: {
    title: 'Дарсҳо',
    subtitle: 'Сатҳи HSK 1 — калимаҳои аввалин',
    words: 'калима',
    open: 'Кушодан',
    level: 'Сатҳ',
  },

  lessonDetail: {
    words: 'Калимаҳо',
    practiceWithTutor: 'Бо устод машқ кунед',
    pinyin: 'Пиньин',
    meaning: 'Маънӣ',
  },

  tutor: {
    title: 'Устоди Хитоӣ',
    placeholder: 'Саволатонро нависед...',
    send: 'Фиристодан',
    greeting:
      'Салом! 你好 (nǐ hǎo). Ман устоди шумо оид ба забони хитоӣ ҳастам. Чиро мехоҳед имрӯз омӯзед? Метавонед савол диҳед ё калимае пурсед.',
    thinking: 'Устод фикр карда истодааст...',
    error: 'Хатогӣ рӯй дод. Лутфан дубора кӯшиш кунед.',
    offlineHint:
      'Ба сервер пайваст шуда наметавонем. Мутмаин шавед, ки сервер кор мекунад ва суроға дуруст аст.',
    suggestions: [
      'Чӣ тавр «салом» гӯям?',
      'Рақамҳоро аз 1 то 5 омӯзонед',
      'Оҳангҳо (тонҳо) чист?',
    ],
  },

  common: {
    retry: 'Аз нав',
    close: 'Пӯшидан',
  },
};

export type Strings = typeof tj;
