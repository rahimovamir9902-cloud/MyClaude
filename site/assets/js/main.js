/* ============================================================================
   main.js — config injection, demo conversation, ROI calculator, lead form.
   No dependencies. Runs from the bottom of <body>, so the DOM is ready.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lang = function () { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- money */
  function money(n) {
    var locale = lang() === 'ru' ? 'ru-RU' : 'en-US';
    var num = Math.round(n).toLocaleString(locale);
    return CFG.currencyAfter ? num + ' ' + CFG.currency : CFG.currency + num;
  }

  /* ------------------------------------------------------- config → page */
  // The city is the one value with a per-language spelling.
  function value(key) {
    if (key === 'city' && lang() === 'ru' && CFG.cityRu) return CFG.cityRu;
    return CFG[key];
  }

  function injectConfig() {
    $$('[data-cfg]').forEach(function (el) {
      var v = value(el.dataset.cfg);
      if (v != null && v !== '') el.textContent = v;
    });

    $$('[data-price]').forEach(function (el) {
      var v = (CFG.pricing || {})[el.dataset.price];
      if (v != null) el.textContent = money(v);
    });

    var plan = $('#calcPlan');
    if (plan && CFG.pricing) plan.textContent = money(CFG.pricing.growthMonthly);

    // Contact links
    var waText = encodeURIComponent(
      lang() === 'ru'
        ? 'Здравствуйте! Хочу узнать про автоматизацию для своего бизнеса.'
        : "Hi! I'd like to know about automation for my business."
    );
    $$('[data-link="whatsapp"]').forEach(function (a) {
      if (CFG.whatsapp) a.href = 'https://wa.me/' + String(CFG.whatsapp).replace(/\D/g, '') + '?text=' + waText;
    });
    $$('[data-link="telegram"]').forEach(function (a) {
      if (CFG.telegram) {
        a.href = CFG.telegram;
        if (a.closest('.contact__direct')) a.textContent = '@' + CFG.telegram.split('/').pop();
      }
    });
    $$('[data-link="email"]').forEach(function (a) {
      if (CFG.email) a.href = 'mailto:' + CFG.email;
    });

    // Primary CTAs point at the booking tool when there is one.
    if (CFG.bookingUrl) {
      $$('[data-cta]').forEach(function (a) {
        a.href = CFG.bookingUrl;
        a.target = '_blank';
        a.rel = 'noopener';
      });
    }

    // Document title follows the brand.
    if (CFG.brand) {
      document.title = lang() === 'ru'
        ? CFG.brand + ' — ИИ-автоматизация для бизнеса, ' + value('city')
        : CFG.brand + ' — AI automation for local businesses in ' + value('city');
    }

    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------ nav */
  function initNav() {
    var nav = $('#nav');
    var burger = $('.nav__burger');

    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
      var fab = $('.fab');
      if (fab) fab.classList.toggle('is-on', window.scrollY > window.innerHeight * .8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (burger) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
      });
      $$('.nav__links a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  /* -------------------------------------------------------------- reveals */
  function initReveal() {
    var items = $$('.reveal');
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------- demo chat */
  var SCENES = {
    en: {
      restaurant: { clock: '02:14', reply: '4s', lines: [
        ['them', 'Hi — any chance of a table for 6 tomorrow around 8?'],
        ['us',   'Hello! Yes, 20:00 tomorrow works for 6. Window side, or the quieter back room?'],
        ['them', 'Back room please. Anything vegetarian?'],
        ['us',   'Plenty — the whole grill section plus four mains. So: 6 people, 20:00, back room. What name shall I put it under?'],
        ['them', 'Sabina'],
        ['sys',  'Booked · added to your calendar · you were notified']
      ]},
      salon: { clock: '23:47', reply: '6s', lines: [
        ['them', 'how much is balayage and do you have anything saturday'],
        ['us',   'Balayage starts at 350 and takes about three hours. On Saturday, 11:00 and 15:30 are free with Nilufar.'],
        ['them', '11 works'],
        ['us',   'Saturday 11:00 with Nilufar, booked. I\'ll send a reminder Friday evening. Is this your first visit with us?'],
        ['them', 'yes it is'],
        ['sys',  'Booked · new client card created · reminder set']
      ]},
      clinic: { clock: '06:05', reply: '3s', lines: [
        ['them', 'My son has bad toothache. Could he be seen today?'],
        ['us',   'Sorry to hear it. We hold two emergency slots each morning — 09:20 and 10:40 are both open today. Which suits you?'],
        ['them', '09:20. Do you see children under 10?'],
        ['us',   'Yes, Dr. Karimova treats children. Bring any recent X-rays if you have them. Name and age, please?'],
        ['them', 'Amir, he\'s 8'],
        ['sys',  'Booked · emergency slot · duty doctor alerted']
      ]},
      auto: { clock: '21:32', reply: '5s', lines: [
        ['them', 'brakes are squealing, what does a check cost?'],
        ['us',   'Diagnostics are free if you go ahead with the repair, 80 on their own. We could look tomorrow at 09:00 or 14:00 — about 40 minutes.'],
        ['them', '14:00. Camry, 2015'],
        ['us',   'Noted: Camry 2015, tomorrow at 14:00. If it turns out to be just pads, we normally finish the same day — we have them in stock. Your name?'],
        ['them', 'Firuz'],
        ['sys',  'Booked · parts confirmed in stock · quote sent']
      ]}
    },
    ru: {
      restaurant: { clock: '02:14', reply: '4 c', lines: [
        ['them', 'Здравствуйте, есть стол на 6 человек завтра часов в 8?'],
        ['us',   'Здравствуйте! Да, завтра в 20:00 на шестерых свободно. У окна или в тихом дальнем зале?'],
        ['them', 'В дальнем. И есть что-то вегетарианское?'],
        ['us',   'Достаточно — весь гриль-раздел и четыре горячих. Итого: 6 человек, 20:00, дальний зал. На какое имя записать?'],
        ['them', 'Сабина'],
        ['sys',  'Записано · внесено в календарь · вам отправлено уведомление']
      ]},
      salon: { clock: '23:47', reply: '6 c', lines: [
        ['them', 'сколько стоит балаяж и есть что-нибудь на субботу'],
        ['us',   'Балаяж от 350, занимает около трёх часов. В субботу свободны 11:00 и 15:30 у Нилуфар.'],
        ['them', 'давайте 11'],
        ['us',   'Суббота, 11:00, Нилуфар — записала. В пятницу вечером пришлю напоминание. Вы у нас впервые?'],
        ['them', 'да'],
        ['sys',  'Записано · создана карточка клиента · напоминание поставлено']
      ]},
      clinic: { clock: '06:05', reply: '3 c', lines: [
        ['them', 'У сына сильно болит зуб. Можно сегодня попасть?'],
        ['us',   'Сочувствую. Каждое утро мы держим два экстренных окна — сегодня свободны 09:20 и 10:40. Какое удобнее?'],
        ['them', '09:20. Детей до 10 лет принимаете?'],
        ['us',   'Да, доктор Каримова принимает детей. Если есть свежие снимки — возьмите с собой. Имя и возраст?'],
        ['them', 'Амир, 8 лет'],
        ['sys',  'Записано · экстренное окно · дежурный врач предупреждён']
      ]},
      auto: { clock: '21:32', reply: '5 c', lines: [
        ['them', 'тормоза скрипят, сколько стоит посмотреть?'],
        ['us',   'Диагностика бесплатная, если делаете ремонт у нас, отдельно — 80. Можем посмотреть завтра в 09:00 или в 14:00, это минут 40.'],
        ['them', '14:00. Камри 2015'],
        ['us',   'Записал: Камри 2015, завтра в 14:00. Если дело только в колодках, обычно успеваем в тот же день — они есть на складе. Как вас зовут?'],
        ['them', 'Фируз'],
        ['sys',  'Записано · наличие деталей подтверждено · смета отправлена']
      ]}
    }
  };

  var chatToken = 0;

  function bubble(kind, text) {
    var el = document.createElement('div');
    el.className = 'msg msg--' + kind;
    el.textContent = text;
    return el;
  }

  function playScene(name) {
    var box = $('#chat');
    if (!box) return;

    var scene = (SCENES[lang()] || SCENES.en)[name] || SCENES.en.restaurant;
    var token = ++chatToken;

    box.innerHTML = '';
    var clock = $('#demoClock'); if (clock) clock.textContent = scene.clock;
    var rt = $('#replyTime');    if (rt) rt.textContent = scene.reply;

    if (reduced) {
      scene.lines.forEach(function (l) { box.appendChild(bubble(l[0], l[1])); });
      return;
    }

    var i = 0;
    function next() {
      if (token !== chatToken) return;          // a newer scene took over
      if (i >= scene.lines.length) {
        setTimeout(function () { if (token === chatToken) playScene(name); }, 7000);
        return;
      }
      var line = scene.lines[i++];

      if (line[0] === 'us') {
        // Show a typing indicator before the assistant answers.
        var t = document.createElement('div');
        t.className = 'msg msg--us';
        t.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        box.appendChild(t);
        setTimeout(function () {
          if (token !== chatToken) return;
          t.remove();
          box.appendChild(bubble(line[0], line[1]));
          setTimeout(next, 1100 + line[1].length * 8);
        }, 700);
      } else {
        box.appendChild(bubble(line[0], line[1]));
        setTimeout(next, line[0] === 'sys' ? 1200 : 700 + line[1].length * 6);
      }
    }
    setTimeout(next, 350);
  }

  function initDemo() {
    var tabs = $$('.panel__tabs button');
    var current = 'restaurant';

    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        tabs.forEach(function (x) {
          x.classList.toggle('is-active', x === b);
          x.setAttribute('aria-selected', String(x === b));
        });
        current = b.dataset.scene;
        playScene(current);
      });
    });

    var replay = $('#replay');
    if (replay) replay.addEventListener('click', function () { playScene(current); });

    document.addEventListener('langchange', function () { playScene(current); });

    // Only start once the panel is on screen, so the first message isn't
    // already gone by the time someone looks at it.
    var panel = $('#demo');
    if (panel && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { playScene(current); io.disconnect(); }
      }, { threshold: .25 });
      io.observe(panel);
    } else {
      playScene(current);
    }
  }

  /* ------------------------------------------------------------ calculator */
  function initCalc() {
    var sEnq = $('#s-enq'), sMiss = $('#s-miss'), sJob = $('#s-job');
    if (!sEnq) return;

    var d = CFG.calculator || {};
    sEnq.value  = d.enquiriesPerMonth || sEnq.value;
    sMiss.value = d.missedPercent     || sMiss.value;
    sJob.value  = d.averageJobValue   || sJob.value;

    var shown = 0;

    function paint() {
      var enq = +sEnq.value, miss = +sMiss.value, job = +sJob.value;
      var close = (d.closeRate == null ? 30 : d.closeRate) / 100;
      var lost = enq * (miss / 100) * close * job;

      $('#v-enq').textContent  = enq.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US');
      $('#v-miss').textContent = miss + '%';
      $('#v-job').textContent  = money(job);
      $('#calcBar').style.width = miss + '%';

      // Count up to the new figure rather than snapping to it.
      var from = shown, to = lost, t0 = performance.now(), dur = reduced ? 0 : 420;
      shown = lost;
      (function step(now) {
        var p = dur ? Math.min(1, (now - t0) / dur) : 1;
        var eased = 1 - Math.pow(1 - p, 3);
        $('#calcMoney').textContent = money(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    [sEnq, sMiss, sJob].forEach(function (s) { s.addEventListener('input', paint); });
    document.addEventListener('langchange', function () { shown = 0; paint(); });
    paint();
  }

  /* ------------------------------------------------------------------ form */
  function initForm() {
    var form = $('#leadForm');
    if (!form) return;

    // Simple spam trap — bots fill it, humans never see it.
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1;
    hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;width:0';
    form.appendChild(hp);

    var status = $('#formStatus');

    var SAY = {
      en: {
        missing: 'Please fill in your name, business and phone.',
        sending: 'Sending…',
        ok: 'Got it. We\'ll reply today.',
        fail: 'That didn\'t send — write to us on WhatsApp instead.',
        wa: 'Opening WhatsApp with your details…'
      },
      ru: {
        missing: 'Заполните имя, название бизнеса и телефон.',
        sending: 'Отправляем…',
        ok: 'Получили. Ответим сегодня.',
        fail: 'Не отправилось — напишите нам в WhatsApp.',
        wa: 'Открываем WhatsApp с вашими данными…'
      }
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var say = SAY[lang()];
      if (hp.value) return;                       // bot

      var bad = false;
      ['name', 'business', 'phone'].forEach(function (n) {
        var input = form.elements[n];
        var ok = input.value.trim().length > 1;
        input.closest('.field').classList.toggle('is-bad', !ok);
        if (!ok && !bad) { input.focus(); bad = true; }
      });
      if (bad) { status.textContent = say.missing; return; }

      var data = {
        name:     form.elements.name.value.trim(),
        business: form.elements.business.value.trim(),
        type:     form.elements.type.value,
        phone:    form.elements.phone.value.trim(),
        message:  form.elements.message.value.trim(),
        language: lang(),
        page:     location.href
      };

      // No endpoint configured → hand the lead over via WhatsApp so the site
      // still converts on day one.
      if (!CFG.formEndpoint) {
        var text = (lang() === 'ru' ? 'Заявка с сайта' : 'Enquiry from the website') + '\n' +
          '— ' + data.name + ', ' + data.business + ' (' + data.type + ')\n' +
          '— ' + data.phone + (data.message ? '\n— ' + data.message : '');
        status.textContent = say.wa;
        window.open('https://wa.me/' + String(CFG.whatsapp).replace(/\D/g, '') +
                    '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        form.reset();
        return;
      }

      status.textContent = say.sending;
      fetch(CFG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        status.textContent = say.ok;
        form.reset();
      }).catch(function () {
        status.textContent = say.fail;
      });
    });
  }

  /* ------------------------------------------------------------------ boot */
  document.addEventListener('langchange', injectConfig);

  injectConfig();
  initNav();
  initReveal();
  initDemo();
  initCalc();
  initForm();
})();
