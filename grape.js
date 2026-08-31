/* ============================================================
   GRAPE — motion + interaction
   ============================================================ */
(function () {
  'use strict';

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('header');
  var heroEl = document.getElementById('hero');

  /* ---------- Header state ---------- */
  function headerScroll() {
    if (window.scrollY > 30) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  headerScroll();
  window.addEventListener('scroll', headerScroll, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Hero: night → light scrub ---------- */
  if (window.gsap && window.ScrollTrigger && heroEl) {
    gsap.registerPlugin(ScrollTrigger);

    var night = document.getElementById('heroNight');
    var day = document.getElementById('heroDay');
    var grade = heroEl.querySelector('.hero__grade');
    var warm = heroEl.querySelector('.hero__warm');
    var bloom = document.getElementById('heroBloom');
    var content = document.getElementById('heroContent');
    var lineA = document.getElementById('heroLineA');
    var lineB = document.getElementById('heroLineB');
    var sub = document.getElementById('heroSub');
    var cue = document.getElementById('heroCue');
    var chip1 = document.getElementById('chip1');
    var chip2 = document.getElementById('chip2');

    if (!reduce) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate: function (self) {
            // header switches from light-on-dark to normal as the room blooms to cream
            if (self.progress > 0.8) header.classList.remove('over-dark');
            else header.classList.add('over-dark');
          }
        },
        defaults: { ease: 'none' }
      });

      // 100-unit virtual timeline
      // cue fades almost immediately
      tl.to(cue, { autoAlpha: 0, duration: 6 }, 2);
      // lights come up — nighttime grade lifts
      tl.to(grade, { opacity: 0.15, duration: 36 }, 10);
      tl.to(warm, { opacity: 0.85, duration: 30 }, 16);
      // gentle ken-burns on the night layer
      tl.to(night, { scale: 1.0, duration: 60 }, 0);
      // cross-fade dim room → bright room
      tl.to(night, { autoAlpha: 0, duration: 26 }, 42);
      tl.to(day, { autoAlpha: 1, scale: 1.04, duration: 30 }, 40);
      // headline morph: "Welcome home." → "It already knows."
      tl.to(lineA, { autoAlpha: 0, y: -12, duration: 10 }, 44);
      tl.fromTo(lineB, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 12 }, 52);
      tl.to(sub, { autoAlpha: 0.0, duration: 8 }, 44);
      tl.to(sub, { autoAlpha: 0.9, duration: 8 }, 56);
      // glass status chips drift in over the bright reveal
      tl.fromTo(chip1, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 12 }, 50);
      tl.fromTo(chip2, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 12 }, 56);
      // resolve into the light world: content lifts away, cream blooms
      tl.to([content, chip1, chip2], { autoAlpha: 0, duration: 12 }, 74);
      tl.to(bloom, { opacity: 1, duration: 16 }, 82);

      var rs;
      window.addEventListener('resize', function () {
        clearTimeout(rs); rs = setTimeout(function () { ScrollTrigger.refresh(); }, 160);
      });
    }
  } else if (heroEl) {
    // No GSAP / reduced motion — show the resolved light state, no pin needed
    header.classList.remove('over-dark');
  }

  /* ---------- Consultation form ---------- */
  var form = document.getElementById('consultForm');
  if (form) {
    var required = ['f-name', 'f-phone', 'f-email', 'f-type'];
    var fill = document.getElementById('progressFill');
    var count = document.getElementById('progressCount');
    var btn = document.getElementById('submitBtn');
    var err = document.getElementById('formError');
    var thanks = document.getElementById('thanks');

    function updateProgress() {
      var done = 0;
      required.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value.trim() !== '') done++;
      });
      fill.style.width = (done / required.length * 100) + '%';
      count.textContent = done + ' of ' + required.length;
      count.classList.toggle('done', done === required.length);
    }
    form.addEventListener('input', updateProgress);
    form.addEventListener('change', updateProgress);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.remove('show');
      // validate required
      for (var i = 0; i < required.length; i++) {
        var el = document.getElementById(required[i]);
        if (!el.value.trim()) {
          err.textContent = 'Please fill in your name, phone, email and property type.';
          err.classList.add('show');
          el.focus();
          return;
        }
      }
      var emailEl = document.getElementById('f-email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
        err.textContent = 'Please enter a valid email address.';
        err.classList.add('show'); emailEl.focus(); return;
      }

      var action = form.getAttribute('action') || '';
      var showThanks = function () {
        form.style.display = 'none';
        thanks.classList.add('show');
        thanks.scrollIntoView ? null : null;
      };

      // Submit whenever a real endpoint is configured; otherwise show success (demo).
      var configured = /^https?:/i.test(action) && action.indexOf('YOUR_FORM_ID') === -1 && action.indexOf('PASTE_YOUR') === -1;
      if (configured) {
        btn.setAttribute('disabled', '');
        btn.querySelector('span').textContent = 'Sending…';
        fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
          .then(function (d) {
            if (d && d.success === true) { showThanks(); }
            else { throw new Error('bad response'); }
          })
          .catch(function () {
            btn.removeAttribute('disabled');
            btn.querySelector('span').textContent = 'Send inquiry';
            err.textContent = 'Something went wrong. Please WhatsApp us instead — we reply fast.';
            err.classList.add('show');
          });
      } else {
        // Demo mode (no endpoint yet)
        showThanks();
      }
    });

    updateProgress();
  }
})();
