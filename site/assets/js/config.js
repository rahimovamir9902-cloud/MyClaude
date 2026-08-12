/* ============================================================================
   SITE CONFIG — edit this file and nothing else to make the site yours.
   Every value here is injected into the page at load time.
   ========================================================================== */

window.SITE_CONFIG = {
  /* ---- Identity ---------------------------------------------------------- */
  brand: 'Overtime AI',
  city: 'Dushanbe',
  // Optional: how the city is spelled in Russian. Falls back to `city`.
  cityRu: 'Душанбе',
  // Used in the footer and in the legal line.
  legalName: 'Overtime AI',

  /* ---- Contact ----------------------------------------------------------- */
  // Full international format, digits only — used to build the wa.me link.
  whatsapp: '992900000000',
  // Displayed to humans.
  phoneDisplay: '+992 90 000 00 00',
  // tel: link
  phoneLink: '+992900000000',
  telegram: 'https://t.me/your_username',
  instagram: 'https://instagram.com/your_username',
  email: 'hello@example.com',

  // Booking link for the primary CTA (Calendly, Cal.com, TidyCal…).
  // Leave empty ('') to send the CTA to the contact form instead.
  bookingUrl: '',

  /* ---- Lead form --------------------------------------------------------- */
  // Where the contact form POSTs. Works with Formspree, Basin, Netlify Forms,
  // Getform, or your own endpoint.
  //   e.g. 'https://formspree.io/f/xxxxxxxx'
  // Leave empty ('') and the form will instead open a pre-filled WhatsApp
  // message — so the site converts from day one, with zero backend.
  formEndpoint: '',

  /* ---- Money ------------------------------------------------------------- */
  currency: '$',            // 'с.' for somoni, '₽', '€', etc.
  currencyAfter: false,     // true renders "1 200 с." instead of "$1,200"

  pricing: {
    starterSetup: 390,
    starterMonthly: 90,
    growthSetup: 890,
    growthMonthly: 190,
    customFrom: 2400
  },

  /* ---- ROI calculator defaults ------------------------------------------- */
  calculator: {
    enquiriesPerMonth: 120,   // incoming calls + messages per month
    missedPercent: 35,        // % that go unanswered or answered too late
    averageJobValue: 60,      // average value of one customer
    closeRate: 30             // % of rescued enquiries that become customers
  },

  /* ---- Misc -------------------------------------------------------------- */
  // Shown in the footer.
  foundedYear: 2026
};
