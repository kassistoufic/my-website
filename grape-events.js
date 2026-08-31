/* Grape — analytics events.
   Pushes the site's real conversions into the GTM dataLayer. GTM (container
   GTM-5FNWCN79) turns these into a Custom Event trigger, which you point at the
   Meta pixel tag, Google Ads, or anything else — no further code changes here.

   Events pushed:
     grape_lead          consultation form submitted successfully
     grape_contact       WhatsApp or email tapped   (params: method)
     grape_schedule      "Get in touch" / book-a-visit sheet opened
     grape_pillar_view   a solutions pillar opened  (params: pillar)         */
(function () {
  window.dataLayer = window.dataLayer || [];
  function push(event, params) {
    var o = { event: event };
    if (params) for (var k in params) o[k] = params[k];
    window.dataLayer.push(o);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a,button');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf('wa.me') !== -1) push('grape_contact', { method: 'whatsapp' });
    else if (href.indexOf('mailto:') === 0) push('grape_contact', { method: 'email' });

    if (a.id === 'mbarCta' || a.hasAttribute('data-open-sheet') || a.id === 'consultCue') {
      push('grape_schedule');
    }

    var pillar = a.closest && a.closest('.svcx__railitem, .scard, .acc__card');
    if (pillar) {
      var nm = (pillar.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (nm) push('grape_pillar_view', { pillar: nm });
    }
  }, true);

  /* dispatched by grape-mobile.js only on a confirmed successful submission */
  document.addEventListener('grape:lead', function () {
    push('grape_lead', { form: 'consultation' });
  });
})();
