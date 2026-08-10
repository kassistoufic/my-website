/* Grape — About: scroll timeline.
   One rAF loop maps journey progress (0–1) to:
   - house position/scale (smoothed, cinematic glide)
   - hero exit (fade + rise)
   - stage data-state  (quiet → systems → pulse → alive)  → CSS crossfades
   - stage data-copy   (which story caption is live)
   - stage data-claim  (how many claims have accumulated)
   - the traveling gradient pulse (stroke-dashoffset)
   - progress hairline                                            */
(function(){
  document.documentElement.classList.remove('no-js');

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var journey = document.getElementById('journey');
  var stage   = document.getElementById('stage');
  var wrap    = document.getElementById('houseWrap');
  var hero    = document.getElementById('heroCopy');
  var cue     = document.getElementById('cue');
  var prog    = document.getElementById('prog');
  var pulse   = document.getElementById('vPulse');
  var closeEl = document.getElementById('closing');
  if (!journey || !stage || !wrap) return;

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function seg(p,a,b){ return clamp((p-a)/(b-a),0,1); }
  function smooth(t){ return t*t*(3-2*t); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  /* ---- bands (fractions of the journey run) ---- */
  var B = {
    heroEnd:.09,
    quiet:[.09,.24], systems:[.24,.38], pulseB:[.38,.52], alive:[.52,.64],
    shrink:[.64,.70],
    c1:.70, c2:.755, c3:.81, c4:.865, hold:.92
  };

  /* house keyframes: [p, centerY (fraction of vh), scale] — hero + claims keys
     are computed each frame from real measurements so the house never overlaps
     the copy on short or wide viewports */
  function keys(vh, hH){
    var heroB = hero ? (hero.offsetTop + hero.offsetHeight) : vh*.4;
    var s0 = clamp((vh - heroB - 46) / hH, .5, 1);
    var y0 = (heroB + 30 + hH*s0/2) / vh;
    y0 = Math.min(y0, 1 - (hH*s0/2 + 10)/vh);
    var s1 = Math.min(1.08, vh*.9/hH);
    var s2 = Math.min(.6, vh*.42/hH);
    var y2 = Math.max(.25, (hH*s2/2 + 8)/vh);
    return [
      [0,    y0,  s0],
      [.09,  .44, s1],
      [.64,  .44, s1],
      [.70,  y2,  s2],
      [1,    y2,  s2]
    ];
  }
  function houseAt(HK, p){
    var i = 0;
    while (i < HK.length-2 && p > HK[i+1][0]) i++;
    var a = HK[i], b = HK[i+1];
    var t = smooth(seg(p, a[0], b[0]));
    return [ lerp(a[1],b[1],t), lerp(a[2],b[2],t) ];
  }

  /* ---- pulse path setup ---- */
  var L = 0, dash = 0, pulseOff = 0, lastT = 0;
  if (pulse) {
    L = pulse.getTotalLength();
    dash = L * .16;
    pulse.style.strokeDasharray = dash + ' ' + L;
    pulse.style.strokeDashoffset = dash; /* hidden before the band */
  }

  var ps = 0, first = true;
  var K = reduce ? 1 : .14;

  function frame(now){
    var vh = innerHeight;
    var r  = journey.getBoundingClientRect();
    var run = r.height - vh;
    var p  = clamp(run > 0 ? -r.top / run : 0, 0, 1);
    if (first) { ps = p; first = false; }
    ps += (p - ps) * K;
    var dt = Math.min(.05, (now - lastT) / 1000 || 0); lastT = now;

    /* house */
    var hH = wrap.offsetHeight;
    var h = houseAt(keys(vh, hH), ps);
    var ty = h[0]*vh - hH/2;
    wrap.style.transform = 'translate(-50%,' + ty.toFixed(1) + 'px) scale(' + h[1].toFixed(3) + ')';

    /* hero exit */
    if (hero) {
      var he = smooth(seg(ps, 0, B.heroEnd*.85));
      hero.style.opacity = (1 - he).toFixed(3);
      hero.style.transform = 'translate(-50%,' + (-46*he).toFixed(1) + 'px)';
      hero.style.pointerEvents = he > .6 ? 'none' : '';
    }
    if (cue) cue.style.opacity = p > .015 ? '0' : '';

    /* discrete beats → CSS handles the crossfades */
    var st = p < B.quiet[1] ? 'quiet' : p < B.systems[1] ? 'systems' : p < B.pulseB[1] ? 'pulse' : 'alive';
    if (stage.getAttribute('data-state') !== st) stage.setAttribute('data-state', st);

    var copy = p < .10 ? '' :
               p < B.quiet[1]   ? 's1' :
               p < B.systems[1] ? 's2' :
               p < B.pulseB[1]  ? 's3' :
               p < .62          ? 's4' : '';
    if (stage.getAttribute('data-copy') !== copy) stage.setAttribute('data-copy', copy);

    var cl = p >= B.c4 ? '4' : p >= B.c3 ? '3' : p >= B.c2 ? '2' : p >= B.c1 ? '1' : '0';
    if (stage.getAttribute('data-claim') !== cl) stage.setAttribute('data-claim', cl);

    /* traveling pulse: one full journey across its band, then a slow drift */
    if (pulse && L) {
      if (p >= B.pulseB[0] && p < B.pulseB[1]) {
        var t = smooth(seg(ps, B.pulseB[0], B.pulseB[1]));
        pulseOff = dash - t * (L + 2*dash);
      } else if (p >= B.pulseB[1] && !reduce) {
        pulseOff -= dt * 46;            /* the living system keeps circulating */
        if (pulseOff < -1e6) pulseOff = 0;
      }
      pulse.style.strokeDashoffset = pulseOff.toFixed(1);
    }

    /* progress hairline (whole page) */
    if (prog) {
      var max = document.documentElement.scrollHeight - vh;
      prog.style.width = (clamp(max>0 ? scrollY/max : 0, 0, 1)*100).toFixed(2) + '%';
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* cream closing: gentle entrance */
  if (closeEl && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { closeEl.classList.add('in'); io.disconnect(); } });
    }, {threshold:.3});
    io.observe(closeEl);
  } else if (closeEl) { closeEl.classList.add('in'); }
})();
