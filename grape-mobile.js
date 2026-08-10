/* ============================================================
   GRAPE — Mobile experience engine
   Scroll scrubs the room footage; beats fade; resolves to CTA.
   ------------------------------------------------------------
   The film is driven by scrubbing the actual <video> element's
   currentTime. (An earlier build pre-extracted frames with
   createImageBitmap — that fails on iOS Safari, leaving the room
   stuck on the dark "everything off" first frame.)
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var v = document.getElementById('filmV');
  var canvas = document.getElementById('filmCanvas');
  var loader = document.getElementById('mload');
  var film = document.getElementById('mfilm');
  var endEl = document.getElementById('mend');

  if (!v) return;

  // Show the video itself and retire the (opaque) frame canvas.
  if (canvas) canvas.style.display = 'none';
  v.style.opacity = '1';

  /* ---- Event timings (fractions of the film's runtime) ----
     Tune these three numbers to the exact moments in the footage:
     lights coming on, the AC activating, the curtains beginning to part.
     Everything (captions + ticks) is derived from them. */
  /* The desktop film is a different cut, so its event fractions differ. Source
     and timings are chosen together here so the two can never drift apart. */
  var DESKTOP = window.matchMedia('(min-width:1024px)').matches;
  var FILM_SRC = DESKTOP ? 'assets/film-room-desktop.mp4' : 'assets/film-room-1080.mp4';
  var EV = DESKTOP
    ? { lights: 0.141, climate: 0.276, curtains: 0.359 }
    : { lights: 0.07,  climate: 0.17,  curtains: 0.34  };
  var TAIL = DESKTOP ? 0.52 : 0.62;

  /* Crossing the breakpoint mid-session would leave the wrong film loaded with
     the wrong timings; rebuild the page once the resize settles. */
  (function () {
    var t, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;   // height-only resize (mobile URL bar) — ignore
      clearTimeout(t);
      t = setTimeout(function () {
        lastW = window.innerWidth;
        if (window.matchMedia('(min-width:1024px)').matches !== DESKTOP) location.reload();
      }, 600);
    }, { passive: true });
  })();
  // matching progress thresholds for the ticks (timeline total ≈ 96; pos = 4 + f*92)
  var EVT = {
    lightsP:   (4 + ((EV.lights   + EV.climate ) / 2) * 92) / 96,
    climateP:  (4 + ((EV.climate  + EV.curtains) / 2) * 92) / 96,
    curtainsP: (4 + ((EV.curtains + TAIL)        / 2) * 92) / 96
  };

  /* bar CTA → open the "Book your visit" sheet */
  var cta = document.getElementById('mbarCta');
  if (cta) cta.addEventListener('click', function (e) {
    e.preventDefault();
    var vb = document.getElementById('visitBtn');
    if (vb) vb.click();
  });

  /* "Begin the experience" → smooth-scroll into the scrub */
  var begin = document.getElementById('beginBtn');
  if (begin) begin.addEventListener('click', function () {
    var target = Math.round(window.innerHeight * 0.95);
    window.scrollTo({ top: target, behavior: 'smooth' });
  });

  /* end-of-film "Our solutions" cue → scroll so the FULL Solutions section
     is in view (bottom-aligned when it's taller than the viewport, which also
     matches the magnetic-hold position), showing the GET IN TOUCH cue. */
  var solCue = document.getElementById('solutionsCue');
  if (solCue) solCue.addEventListener('click', function () {
    var s = document.getElementById('solutions');
    if (!s) return;
    var top = s.getBoundingClientRect().top + (window.pageYOffset || 0);
    var over = s.offsetHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(top + (over > 0 ? over : 0)), behavior: 'smooth' });
  });

  /* Solutions "Book your visit now" cue → release the Solutions hold (scrolls to consultation) */
  var consultCue = document.getElementById('consultCue');
  if (consultCue) consultCue.addEventListener('click', function () {
    if (window.__solRelease) { window.__solRelease(); return; }
    var c = document.getElementById('consult');
    if (!c) return;
    var top = c.getBoundingClientRect().top + (window.pageYOffset || 0);
    window.scrollTo({ top: Math.round(top), behavior: 'smooth' });
  });

  /* header condenses (a touch more scrim) once past the opening frame */
  var bar = document.getElementById('mbar');
  if (bar) {
    var onScroll = function () {
      if (window.scrollY > window.innerHeight * 0.6) bar.classList.add('condensed');
      else bar.classList.remove('condensed');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var duration = 0;     // video length once known
  var scrubTween = null; // the currentTime tween — invalidated once duration is real
  var noScrub = false;  // true when GSAP/ScrollTrigger is unavailable
  var priming = false;  // true only during the one-shot decoder wake-up play

  // iOS won't paint a seeked frame until the video has played once. We do that
  // ONE controlled play here, guarded by the `priming` flag so the permanent
  // play-watchdog (added in init) doesn't fight it; the moment priming ends the
  // watchdog pauses any stray playback.
  function prime() {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; priming = false; try { v.pause(); } catch (e) {} resolve(); }
      try {
        priming = true;
        var p = v.play();
        if (p && p.then) {
          p.then(function () { try { v.pause(); } catch (e) {} try { v.currentTime = 0; } catch (e) {} fin(); })
           .catch(function () { try { v.currentTime = 0; } catch (e) {} fin(); });
        } else {
          try { v.pause(); } catch (e) {}
          try { v.currentTime = 0; } catch (e) {}
          fin();
        }
      } catch (e) { fin(); }
      setTimeout(fin, 1500);
    });
  }

  // Resolve once we know the duration / have a decodable frame.
  function ready() {
    return new Promise(function (resolve) {
      if (v.readyState >= 1 && v.duration) return resolve();
      var done = false;
      function fin() { if (done) return; done = true; resolve(); }
      v.addEventListener('loadedmetadata', fin, { once: true });
      v.addEventListener('loadeddata', fin, { once: true });
      v.addEventListener('canplay', fin, { once: true });
      setTimeout(fin, 12000);
    });
  }

  (function init() {
    var hidden = false;
    function hideLoader() {
      if (hidden) return; hidden = true;
      if (loader) {
        loader.classList.add('hide');
        setTimeout(function () { if (loader.parentNode) loader.remove(); }, 700);
      }
    }
    setTimeout(hideLoader, 120000); // safety net only — the loader normally hides once everything is fully loaded

    v.muted = true;
    v.playsInline = true;
    v.autoplay = false;
    try { v.setAttribute('playsinline', ''); v.removeAttribute('autoplay'); } catch (e) {}

    // Permanent watchdog: the film is a scroll-scrubbed still surface — it must
    // NEVER play on its own. Any play that isn't our one-shot decoder prime is
    // paused instantly, keeping it fixed on the first frame until the user
    // scrolls. (GSAP scrubbing sets currentTime directly and fires no 'play',
    // so scrubbing is unaffected.)
    function stopStrayPlay() { if (!priming) { try { v.pause(); } catch (e) {} } }
    v.addEventListener('play', stopStrayPlay);
    v.addEventListener('playing', stopStrayPlay);

    // Build the scroll choreography immediately — it does NOT depend on the
    // video being decoded, so it must never wait on it.
    build();

    // Hold the loader until the ENTIRE experience is ready: the film fully
    // downloaded (so it never loads in while the customer is watching) and every
    // image decoded. A thin progress bar under the logo reassures during the
    // download; only then does the loader fade away.
    var fillEl = document.getElementById('mloadFill');
    function setProg(p) { if (fillEl) fillEl.style.width = Math.max(5, Math.min(100, Math.round(p * 100))) + '%'; }

    function waitImages() {
      var imgs = [].slice.call(document.images || []);
      return Promise.all(imgs.map(function (im) {
        if (im.complete && im.naturalWidth) return Promise.resolve();
        return new Promise(function (res) { im.addEventListener('load', res, { once: true }); im.addEventListener('error', res, { once: true }); });
      }));
    }

    async function fetchFilm(url) {
      var resp = await fetch(url);
      if (!resp || !resp.ok) throw new Error('film fetch failed');
      var total = +(resp.headers.get('content-length') || 0);
      if (!resp.body || !resp.body.getReader) { var b = await resp.blob(); setProg(0.92); return b; }
      var reader = resp.body.getReader(); var received = 0; var chunks = [];
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        chunks.push(r.value); received += r.value.length;
        // Reserve the tail for decode + images. Without content-length (our host
        // sends none) fall back to progress against an assumed ~5MB so the bar
        // still moves instead of sitting at 5% for the whole download.
        setProg(Math.min(0.9, (received / (total || 5e6)) * 0.9));
      }
      return new Blob(chunks, { type: 'video/mp4' });
    }

    (async function loadVideo() {
      try {
        setProg(0.05);
        var srcEl = v.querySelector('source');
        var srcUrl = FILM_SRC || (srcEl && srcEl.getAttribute('src')) || v.getAttribute('src') || v.currentSrc;
        // Fully download the film up front so it's 100% ready before the reveal.
        if (srcUrl && srcUrl.indexOf('blob:') !== 0) {
          try {
            var blob = await fetchFilm(srcUrl);
            if (srcEl) srcEl.remove();
            v.preload = 'auto';                       // markup says "none" so nothing
            v.setAttribute('preload', 'auto');        // downloads before this point
            v.src = URL.createObjectURL(blob);
          } catch (e) { if (!v.getAttribute('src')) v.setAttribute('src', srcUrl); }
        }
        v.load();
        await ready();
        if (!v.duration && srcUrl) {                 // metadata never landed — one clean retry on the blob
          try {
            v.preload = 'auto'; v.setAttribute('preload', 'auto');
            var blob2 = await fetchFilm(srcUrl);
            v.src = URL.createObjectURL(blob2); v.load(); await ready();
          } catch (e) {}
          if (!v.duration) { try { v.preload = 'auto'; v.setAttribute('preload', 'auto'); v.src = srcUrl; v.load(); await ready(); } catch (e) {} }
        }
        duration = v.duration || 0;
        if (scrubTween) { try { scrubTween.invalidate(); } catch (e) {} }
        await prime();
        // The film is scrubbed by scroll, never played — keep it paused, and
        // halt any stray autoplay (the prime() step plays once to wake the
        // decoder and can leave it running on some browsers).
        try { v.pause(); } catch (e) {}
        try { v.currentTime = noScrub ? duration * 0.96 : 0.03; } catch (e) {} // dim lights-off frame behind the hero ring
        setProg(0.96);
        await waitImages();   // every photo decoded too
        setProg(1);
        if (window.ScrollTrigger) {
          ScrollTrigger.refresh();
          // force the scrub to re-render at the CURRENT scroll position, so a
          // reload deep in the page lands on the right frame rather than frame 0
          ScrollTrigger.getAll().forEach(function (st) { if (st.scrub || st.animation) st.update(); });
        }
      } catch (e) {}
      // If the film never became decodable, the panels above must not stay
      // transparent — there is no held frame behind them to show through.
      if (!v.duration) document.documentElement.classList.add('film-failed');
      hideLoader();
    })();
  })();

  function setTick(n) {
    for (var i = 1; i <= 3; i++) {
      var t = document.getElementById('tick' + i);
      if (t) t.classList.toggle('on', i === n);
    }
  }

  function build() {
    // Only the scroll choreography needs GSAP. The video scrub is independent
    // (renderLoop reads targetT and applies it once the duration is known).
    if (!window.gsap || !window.ScrollTrigger || reduce) {
      noScrub = true;
      if (endEl) { endEl.style.opacity = 1; endEl.classList.add('live'); }
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: film, start: 'top top', end: function(){ return '+=' + (window.innerHeight * 2); }, scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var pr = self.progress;
          // progress → tick, aligned to the event fractions below
          if (pr < EVT.lightsP) setTick(0);
          else if (pr < EVT.climateP) setTick(1);   // 01 Lighting
          else if (pr < EVT.curtainsP) setTick(2);  // 02 Climate
          else setTick(3);                          // 03 Shades & Curtains
          if (pr > 0.72) endEl.classList.add('live'); else endEl.classList.remove('live');
        }
      },
      defaults: { ease: 'none' }
    });

    // ---- Scrub the actual video by tweening currentTime across virtual 4→96.
    // Tweening the property directly is self-healing: every tick re-sets
    // currentTime, so a seek dropped while the decoder is busy is re-issued
    // next tick — robust against the iOS decoder dropping a seek.
    scrubTween = gsap.to(v, {
      currentTime: function () { return (v.duration || 8) * 0.999; },
      duration: 92, ease: 'none', paused: true
    });
    tl.add(scrubTween, 4);
    scrubTween.paused(false);

    // Beats are pinned to moments in the FOOTAGE, expressed as video-time
    // fractions, then mapped onto the scrub timeline by P(). Because the scrub
    // is linear over [4,96], position P(f) = 4 + f*92 always shows video
    // fraction f — so a caption fades in exactly as its event plays, and holds
    // until the next begins, regardless of scroll speed.
    function P(f) { return 4 + f * 92; }
    var FADE = 3;

    // opening hero (ring) fades out as scrubbing begins
    tl.to('#filmCue', { autoAlpha: 0, duration: 5 }, 3);


    // Beat 01 — Lighting  (fades in at EV.lights, holds to EV.climate)
    tl.fromTo('#beat1', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: FADE }, P(EV.lights));
    tl.to('#beat1', { autoAlpha: 0, y: -12, duration: FADE }, P(EV.climate) - FADE);
    // Beat 02 — Climate  (fades in at EV.climate, holds to EV.curtains)
    tl.fromTo('#beat2', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: FADE }, P(EV.climate));
    tl.to('#beat2', { autoAlpha: 0, y: -12, duration: FADE }, P(EV.curtains) - FADE);
    // Beat 03 — Shades & Curtains  (fades in at EV.curtains, holds to the reveal)
    tl.fromTo('#beat3', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: FADE }, P(EV.curtains));
    tl.to('#beat3', { autoAlpha: 0, y: -12, duration: FADE }, P(0.72) - FADE);

    // end / hand-off CTA over the fully revealed room
    tl.fromTo('#mend', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 5 }, P(0.72));

    // As the Solutions panel rises over the frozen final frame, fade the
    // end-of-film cue out so it doesn't sit behind the rising cards.
    ScrollTrigger.create({
      trigger: '#solutions', start: 'top bottom', end: 'top 55%', scrub: true,
      onUpdate: function (self) {
        if (!endEl) return;
        var o = 1 - self.progress;
        endEl.style.opacity = o.toFixed(3);
        endEl.style.pointerEvents = o < 0.5 ? 'none' : '';
      }
    });

    var rs;
    window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { ScrollTrigger.refresh(); }, 160); });
  }
})();

/* ---------- Consultation: reveals + form ---------- */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { if (!el.classList.contains('cj__step')) io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  var form = document.getElementById('consultForm');
  if (!form) return;
  var required = ['f-name', 'f-phone', 'f-email', 'f-type'];
  var fill = document.getElementById('progressFill');
  var count = document.getElementById('progressCount');
  var btn = document.getElementById('submitBtn');
  var err = document.getElementById('formError');
  var thanks = document.getElementById('thanks');

  function progress() {
    var done = 0;
    required.forEach(function (id) { var el = document.getElementById(id); if (el && el.value.trim()) done++; });
    fill.style.width = (done / required.length * 100) + '%';
    count.textContent = done + ' of ' + required.length;
    count.classList.toggle('done', done === required.length);
  }
  form.addEventListener('input', progress);
  form.addEventListener('change', progress);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.classList.remove('show');
    for (var i = 0; i < required.length; i++) {
      var el = document.getElementById(required[i]);
      if (!el.value.trim()) { err.textContent = 'Please fill in your name, phone, email and property type.'; err.classList.add('show'); el.focus(); return; }
    }
    var em = document.getElementById('f-email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)) { err.textContent = 'Please enter a valid email address.'; err.classList.add('show'); em.focus(); return; }
    var action = form.getAttribute('action') || '';
    var ok = function () { form.style.display = 'none'; thanks.classList.add('show'); };
    var configured = /^https?:/i.test(action) && action.indexOf('YOUR_FORM_ID') === -1 && action.indexOf('PASTE_YOUR') === -1;
    if (configured) {
      btn.setAttribute('disabled', ''); btn.querySelector('span').textContent = 'Sending…';
      fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
        .then(function (d) { if (d && d.success === true) ok(); else throw new Error(); })
        .catch(function () { btn.removeAttribute('disabled'); btn.querySelector('span').textContent = 'Send inquiry'; err.textContent = 'Something went wrong. Please WhatsApp us instead — we reply fast.'; err.classList.add('show'); });
    } else { ok(); }
  });
  progress();
})();

/* ---------- Book-a-visit bottom sheet + form reveal ---------- */
(function () {
  'use strict';
  function init() {
    var openBtn = document.getElementById('visitBtn');
    var sheet = document.getElementById('visitSheet');
    if (!openBtn || !sheet) return;
    var _sT=sheet.querySelector('.sheet__title'), _sS=sheet.querySelector('.sheet__sub');
    function setSheetMode(m){ if(m==='support'){ if(_sT)_sT.textContent='How can we help?'; if(_sS)_sS.textContent='Reach our team — we’re here for you.'; } else { if(_sT)_sT.textContent='Book your smart-home visit'; if(_sS)_sS.textContent='Choose how you’d like to start.'; } }
    window.__grapeSheetMode=setSheetMode;
    var fillBtn = document.getElementById('fillFormBtn');
    var formWrap = document.getElementById('formWrap');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var closeTimer;

    function openSheet() {
      clearTimeout(closeTimer);
      sheet.hidden = false;
      if (reduce) { sheet.classList.add('open'); }
      else { requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('open'); }); }); }
      openBtn.setAttribute('aria-expanded', 'true');
    }
    function closeSheet() {
      sheet.classList.remove('open');
      openBtn.setAttribute('aria-expanded', 'false');
      if (reduce) { sheet.hidden = true; }
      else { closeTimer = setTimeout(function () { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 420); }
    }

    openBtn.addEventListener('click', function (e) { e.stopPropagation(); setSheetMode('sales'); openSheet(); });
    if (location.hash === '#book') { setTimeout(openSheet, 500); }
    sheet.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closeSheet); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });
    sheet.querySelectorAll('a.sheet__opt').forEach(function (a) { a.addEventListener('click', function () { closeSheet(); }); });

    if (fillBtn) fillBtn.addEventListener('click', function () {
      closeSheet();
      if (!formWrap) return;
      formWrap.hidden = false;
      document.documentElement.classList.add('form-open');
      var mcTitle = document.querySelector('.cj__intro .mc__title');
      if (mcTitle) mcTitle.textContent = 'Fill Inquiry';
      requestAnimationFrame(function () {
        var top = formWrap.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - 96;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
        var first = document.getElementById('f-name');
        if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, reduce ? 0 : 460);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ---------- Journey: reversible per-step reveal (open on scroll down, hide on scroll up) ---------- */
(function () {
  'use strict';
  function init() {
    var cj = document.getElementById('cj');
    if (!cj) return;
    var steps = [].slice.call(cj.querySelectorAll('.cj__step'));
    if (!steps.length) return;
    var n = steps.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var vis = [];
    var beatT1, beatT2;
    function beat() {
      clearTimeout(beatT1); clearTimeout(beatT2);
      beatT1 = setTimeout(function () {
        cj.classList.add('cj--complete');
        beatT2 = setTimeout(function () { cj.classList.remove('cj--complete'); }, 1050);
      }, 420);
    }
    function reveal(i) {
      if (vis[i]) return; vis[i] = true;
      steps[i].classList.add('in');                 // fade/slide in + node glow
      if (i > 0) steps[i - 1].classList.add('line'); // draw the segment into this step
      if (i === n - 1) beat();
    }
    function hide(i) {
      if (!vis[i]) return; vis[i] = false;
      steps[i].classList.remove('in');               // fades/slides back out
      if (i > 0) steps[i - 1].classList.remove('line'); // line recedes
      if (i === n - 1) { clearTimeout(beatT1); clearTimeout(beatT2); cj.classList.remove('cj--complete'); }
    }
    if (reduce || !('IntersectionObserver' in window)) { for (var k = 0; k < n; k++) reveal(k); return; }
    // Reversible: a step opens when its own place enters view, and hides again
    // once it fully leaves — so scrolling back to the top re-hides everything.
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var i = steps.indexOf(e.target);
        if (i === -1) return;
        if (e.isIntersecting && e.intersectionRatio >= 0.25) reveal(i);
        else if (!e.isIntersecting) hide(i);
      });
    }, { threshold: [0, 0.25], rootMargin: '0px 0px -10% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* ---------- Header burger menu ---------- */
(function () {
  'use strict';
  function init() {
    var btn = document.getElementById('menuBtn');
    var menu = document.getElementById('navMenu');
    if (!btn || !menu) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var closeTimer;
    function open() {
      clearTimeout(closeTimer); menu.hidden = false;
      if (reduce) menu.classList.add('open');
      else requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.add('open'); }); });
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      if (reduce) menu.hidden = true;
      else closeTimer = setTimeout(function () { if (!menu.classList.contains('open')) menu.hidden = true; }, 420);
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
    menu.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) close(); });
    menu.querySelectorAll('.navmenu__links a, .navmenu__line, .navmenu__support').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        if (a.hasAttribute('data-book')) { e.preventDefault(); close(); var support=a.classList.contains('navmenu__support'); setTimeout(function () { var vb = document.getElementById('visitBtn'); if (vb) vb.click(); if(support&&window.__grapeSheetMode)window.__grapeSheetMode('support'); }, reduce ? 0 : 320); return; }
        if (href === '#') { e.preventDefault(); close(); return; }
        if (a.hasAttribute('data-nav') && href.charAt(0) === '#') {
          e.preventDefault();
          close();
          setTimeout(function () {
            if (href === '#top') { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
            else { var t = document.querySelector(href); if (t) { var y = t.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop); window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); } }
          }, reduce ? 0 : 280);
        } else { close(); }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* ---------- Mini-stop + one-shot reveal at the Solutions → How-it-works boundary ----------
   When the Solutions section fills the screen (How-it-works just below the fold),
   the page briefly CATCHES (~50ms) so the user feels a stop — then the very next
   downward scroll snaps the whole How-it-works section into view in one motion,
   instead of a continuous step-by-step reveal. Scrolling back up re-arms it. */
(function () {
  'use strict';
  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var consult = document.getElementById('consult');
    var solutions = document.getElementById('solutions');
    if (!consult || !solutions) return;
    // No mini-stop on desktop — Solutions releases straight into How it works.
    if (window.matchMedia('(min-width:1024px)').matches) return;

    function y() { return window.pageYOffset || document.documentElement.scrollTop || 0; }
    function docTop(el) { return el.getBoundingClientRect().top + y(); }
    function holdY() { return Math.round(docTop(consult) - window.innerHeight); }    function relTarget() { return Math.round(docTop(consult)); }

    var released = false, caught = false, caughtAt = 0;
    var CATCH_MS = 50; // the mini-stop the user feels

    var sraf = null, sAnim = false;
    function smoothTo(to) {
      if (sraf) cancelAnimationFrame(sraf);
      var from = y(), d = to - from; if (Math.abs(d) < 2) return;
      var t0 = performance.now(), D = 520; sAnim = true;
      (function s(n) {
        var p = Math.min(1, (n - t0) / D), e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2,3)/2;
        window.scrollTo(0, from + d * e);
        if (p < 1 && sAnim) sraf = requestAnimationFrame(s); else { sAnim = false; sraf = null; }
      })(performance.now());
    }
    function release() { released = true; caught = false; } // scroll-driven — unlock only, no snap
    window.__solRelease = function () { released = true; caught = false; smoothTo(relTarget()); }; // cue click still glides in

    window.addEventListener('scroll', function () {
      if (y() < holdY() - 6) { released = false; caught = false; }
    }, { passive: true });

    function atGate() { return y() >= holdY() - 2; }
    function handleDown(e) {
      if (released || sAnim) return;
      if (!atGate()) return;
      if (!caught) {                                   // first arrival → catch here
        if (e && e.cancelable) e.preventDefault();
        window.scrollTo(0, holdY());
        caught = true; caughtAt = performance.now();
        return;
      }
      if (performance.now() - caughtAt < CATCH_MS) {   // hold through the brief catch
        if (e && e.cancelable) e.preventDefault();
        window.scrollTo(0, holdY());
        return;
      }
      release();                                        // continue → unlock; natural scroll reveals each step slowly
    }

    window.addEventListener('wheel', function (e) { if (e.deltaY > 0) handleDown(e); }, { passive: false });
    var tY = null;
    window.addEventListener('touchstart', function (e) { tY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (tY == null) return;
      var cy = e.touches[0].clientY, dd = tY - cy; tY = cy;
      if (dd > 0) handleDown(e);
    }, { passive: false });
    window.addEventListener('touchend', function () { tY = null; }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
