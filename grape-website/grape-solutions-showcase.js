/* ============================================================
   GRAPE — Solutions page desktop showcase.
   Reads the mobile accordion's own content, builds the sticky
   split layout from it, then removes the accordion so the copy
   exists once in the document. Below 1024px it does nothing.
   ============================================================ */
(function () {
  'use strict';
  if (!window.matchMedia('(min-width:1024px)').matches) return;

  function build() {
    var list = document.querySelector('.svc-list');
    var host = document.getElementById('svcx');
    if (!list || !host) return;

    var accs = [].slice.call(list.querySelectorAll('.acc'));
    if (!accs.length) return;

    var data = accs.map(function (a) {
      var img = a.querySelector('.acc__img');
      return {
        id: a.id,
        num: (a.querySelector('.acc__num') || {}).textContent || '',
        hook: (a.querySelector('.acc__hook') || {}).textContent || '',
        lead: (a.querySelector('.acc__lead') || {}).textContent || '',
        src: img ? img.getAttribute('src') : '',
        alt: img ? (img.getAttribute('alt') || '') : '',
        feats: [].slice.call(a.querySelectorAll('.cards .card')).map(function (c) {
          return {
            ico: (c.querySelector('.card__ico') || { innerHTML: '' }).innerHTML,
            label: ((c.querySelector('.card__title') || {}).textContent || '').trim()
          };
        })
      };
    });

    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

    var frames = data.map(function (d, i) {
      return '<img class="svcx__img' + (i === 0 ? ' is-on' : '') + '" src="' + d.src +
             '" alt="' + esc(d.alt) + '"' + (i === 0 ? '' : ' loading="lazy"') + '>';
    }).join('');

    var rail = data.map(function (d, i) {
      return '<button class="svcx__railitem' + (i === 0 ? ' is-on' : '') + '" type="button" data-i="' + i + '">' +
             '<span class="svcx__railnum">' + esc(d.num) + '</span>' +
             '<span class="svcx__raillabel">' + esc(d.hook) + '</span></button>';
    }).join('');

    var pillars = data.map(function (d, i) {
      return '<article class="svcx__pillar" id="' + d.id + '" data-i="' + i + '" data-screen-label="Services · ' + esc(d.hook) + '">' +
             '<span class="svcx__num">' + esc(d.num) + '</span>' +
             '<h2 class="svcx__title">' + esc(d.hook) + '</h2>' +
             '<p class="svcx__lead">' + esc(d.lead) + '</p>' +
             '<ul class="svcx__feats">' + d.feats.map(function (f) {
               return '<li><span class="svcx__ico" aria-hidden="true">' + f.ico + '</span><span>' + esc(f.label) + '</span></li>';
             }).join('') + '</ul></article>';
    }).join('');

    host.innerHTML =
      '<div class="svcx__inner">' +
        '<div class="svcx__sticky">' +
          '<div class="svcx__frame">' + frames +
            '<span class="svcx__ghost" id="svcxGhost" aria-hidden="true">' + esc(data[0].num) + '</span>' +
          '</div>' +
          '<nav class="svcx__rail" id="svcxRail" aria-label="Solution pillars">' + rail + '</nav>' +
        '</div>' +
        '<div class="svcx__flow">' + pillars + '</div>' +
      '</div>';
    host.hidden = false;

    // the accordion's copy now lives in the showcase — drop the duplicate
    list.parentNode.removeChild(list);

    var imgs = [].slice.call(host.querySelectorAll('.svcx__img'));
    var items = [].slice.call(host.querySelectorAll('.svcx__railitem'));
    var ghost = document.getElementById('svcxGhost');
    var pills = [].slice.call(host.querySelectorAll('.svcx__pillar'));
    var active = 0;

    function setActive(i) {
      if (i === active) return;
      active = i;
      imgs.forEach(function (im, n) { im.classList.toggle('is-on', n === i); });
      items.forEach(function (it, n) { it.classList.toggle('is-on', n === i); });
      if (ghost) ghost.textContent = data[i].num;
    }

    items.forEach(function (it) {
      it.addEventListener('click', function () {
        var i = +it.dataset.i, p = pills[i];
        if (!p) return;
        setActive(i);
        var r = p.getBoundingClientRect();
        /* already close to centre — don't move the page at all */
        var centreOff = (r.top + r.height / 2) - window.innerHeight / 2;
        if (Math.abs(centreOff) < window.innerHeight * 0.35) return;
        var top = r.top + (window.pageYOffset || 0) - Math.max(0, (window.innerHeight - r.height) / 2);
        window.scrollTo(0, Math.round(top));
      });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setActive(+e.target.dataset.i); });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      pills.forEach(function (p) { io.observe(p); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
