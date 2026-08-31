/* Desktop-only pointer parallax on the hero diagram. Fine pointers, >=1024px. */
(function(){
  var mq = window.matchMedia('(min-width:1024px) and (pointer:fine)');
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!mq.matches || reduce) return;
  var stage = document.querySelector('.hero2__diagram');
  if (!stage) return;
  var targets = [
    {el: stage.querySelector('.hcard--comfort'),    d: 16},
    {el: stage.querySelector('.hcard--energy'),     d: 22},
    {el: stage.querySelector('.hcard--security'),   d: 22},
    {el: stage.querySelector('.hcard--automation'), d: 16},
    {el: stage.querySelector('.hphone'),            d: 7}
  ].filter(function(t){ return t.el; });
  var host = document.getElementById('filmCue') || stage;
  var raf = 0, nx = 0, ny = 0;
  function apply(){
    raf = 0;
    for (var i = 0; i < targets.length; i++){
      targets[i].el.style.setProperty('--px', (nx * targets[i].d).toFixed(2));
      targets[i].el.style.setProperty('--py', (ny * targets[i].d).toFixed(2));
    }
  }
  function onMove(e){
    var r = stage.getBoundingClientRect();
    nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    nx = Math.max(-1, Math.min(1, nx)); ny = Math.max(-1, Math.min(1, ny));
    if (!raf) raf = requestAnimationFrame(apply);
  }
  function onLeave(){ nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(apply); }
  host.addEventListener('mousemove', onMove, {passive:true});
  host.addEventListener('mouseleave', onLeave, {passive:true});
})();

/* Phone dashboard: the screen is laid out at one fixed design size and scaled
   uniformly to whatever size the phone frame ends up — on short laptop
   viewports the frame shrinks, and fixed-px content used to overflow it. */
(function(){
  if (!window.matchMedia('(min-width:1024px)').matches) return;
  var phone = document.querySelector('.hphone');
  var scr = phone && phone.querySelector('.hphone__scr');
  if (!scr) return;
  var DW = 172, DH = 354, raf = 0;
  function fit(){
    raf = 0;
    var w = phone.clientWidth - 10, h = phone.clientHeight - 10;
    if (w <= 0 || h <= 0) return;
    scr.style.setProperty('--hpz', Math.min(w / DW, h / DH).toFixed(4));
  }
  function queue(){ if (!raf) raf = requestAnimationFrame(fit); }
  fit();
  addEventListener('resize', queue, {passive:true});
  if (window.ResizeObserver) new ResizeObserver(queue).observe(phone);
})();
