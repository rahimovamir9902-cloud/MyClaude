# Overtime AI — marketing site

A one-page site for selling AI automation to local businesses. Plain HTML, CSS
and JavaScript — no build step, no framework, no dependencies. Open
`index.html` and it works.

```
site/
├── index.html
├── robots.txt
└── assets/
    ├── css/
    │   ├── styles.css
    │   └── fonts.css   ← @font-face for the self-hosted fonts
    ├── fonts/          ← Unbounded, Golos Text, Martian Mono (woff2)
    └── js/
        ├── config.js   ← the only file you need to edit
        ├── i18n.js     ← Russian translation layer
        └── main.js     ← demo chat, calculator, form
```

The three typefaces are **self-hosted**, not loaded from Google Fonts: no
third-party request, nothing to break if Google is slow or blocked, and all
three carry full Cyrillic so the Russian version keeps the same design. The
browser only downloads the subsets it needs — about 90 KB for an English
visitor.

---

## 1. Make it yours (5 minutes)

Everything personal lives in **`assets/js/config.js`**. Nothing else needs
touching to launch.

| Field | What it does |
|---|---|
| `brand`, `city` | Written into the headline, nav, footer and page title |
| `whatsapp` | Digits only, full international format. Powers every WhatsApp link and the floating button |
| `telegram`, `instagram`, `email`, `phoneDisplay` | Contact block and footer |
| `bookingUrl` | Calendly / Cal.com link. If set, every "Book a free audit" button opens it. Leave `''` to send people to the form instead |
| `formEndpoint` | Where the form POSTs. Leave `''` and the form opens a pre-filled WhatsApp message instead — so the site converts before you've set up any backend |
| `currency`, `currencyAfter` | `'$'` → `$190`. Set `currency: 'с.'` and `currencyAfter: true` → `190 с.` |
| `pricing` | The three plans. Numbers only — formatting is automatic |
| `calculator` | Starting positions of the ROI sliders, and the close rate the maths assumes |

**Before you launch, check the copy is true for you.** A few lines make promises
you have to keep — the week-long build time, month-to-month billing, the
first-month refund in the last FAQ, and "we reply the same day". Edit or delete
any you don't want to stand behind. They are in `index.html` (English) and
`assets/js/i18n.js` (Russian).

---

## 2. Languages

The site ships **English + Russian** with a switch in the header. On a first
visit it follows the browser's language, then remembers the choice.

- English copy lives in `index.html`.
- Russian copy lives in the `ru` object in `assets/js/i18n.js`.

Change an English line and the Russian keeps working; the two are matched by the
`data-i18n` key on the element.

**To add Tajik:** copy the whole `ru: { … }` object in `i18n.js` to `tj: { … }`,
translate the values, then add one button in `index.html`:

```html
<button type="button" data-lang="tj" aria-pressed="false">TJ</button>
```

**To drop Russian entirely:** delete the two `.langswitch` buttons from
`index.html` and the `i18n.js` script tag.

---

## 3. Where the leads go

The form works in one of two modes, decided by `formEndpoint`:

**Empty (default)** — the form validates, then opens WhatsApp with the lead
already typed out. Zero setup, works offline of any service.

**Set** — the form POSTs JSON to your endpoint. Tested shapes:

- **Formspree** — sign up, create a form, paste `https://formspree.io/f/xxxxxxxx`
- **Basin**, **Getform**, **Formcarry** — same idea, paste the endpoint URL
- **Netlify Forms** — see the Netlify note below
- **Your own** — you'll receive JSON: `name`, `business`, `type`, `phone`,
  `message`, `language`, `page`

A hidden honeypot field is added automatically; submissions that fill it are
silently dropped.

---

## 4. Deploy

It's static files, so anything works.

**Netlify** — drag the `site/` folder onto app.netlify.com, or connect the repo
and set publish directory to `site`.

**Vercel** — `vercel --cwd site`, or import the repo and set the root directory
to `site`.

**Cloudflare Pages** — connect the repo, build command empty, output directory
`site`.

**GitHub Pages** — push, then Settings → Pages → deploy from branch. Pages
serves from the repo root or `/docs`, so either move the contents of `site/` up
a level or rename the folder to `docs`.

**Any shared host** — upload the contents of `site/` by FTP.

Then point your domain at it and turn on HTTPS (all four hosts above do this
for free, automatically).

---

## 5. Things worth doing after launch

- **Add real proof.** There are no fake testimonials or client logos in here on
  purpose. As soon as you have one happy customer, ask for two sentences and a
  photo, and add a testimonial block under the services section.
- **Add an OG image.** Drop a 1200×630 PNG in `assets/img/` and add
  `<meta property="og:image" content="assets/img/og.png">` in the `<head>` so
  links look right when shared in WhatsApp and Telegram.
- **Set up analytics.** Plausible or Umami, one script tag in the `<head>`.
- **Record a real demo.** The chat panel in the hero is a scripted sample — the
  conversations are in `SCENES` in `main.js`. Rewrite them with real messages
  from your first client (with permission) and it gets far more persuasive.
- **Make a landing page per industry.** Copy `index.html` to `salon.html`,
  change the headline and the demo scene, and point your ads at it.

---

## Accessibility & performance notes

- Single page, no framework, no third-party requests at all.
- Full keyboard navigation, visible focus rings, skip link, live regions on the
  demo and form status.
- Respects `prefers-reduced-motion`: the ticker stops, the chat prints instantly,
  reveals are disabled.
- Works without JavaScript, in English, with static contact links.
