/* NIDS Lab — interaction layer: inertial scroll, cursor effects, live feed, shortcuts */
(() => {
  'use strict';
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const smooth = fine && !reduce;

  /* ================= 1. Inertial smooth scrolling ================= */
  let cur = scrollY, tgt = scrollY, raf = 0, tween = null;
  const maxY = () => doc.scrollHeight - innerHeight;
  if (smooth) doc.classList.add('fx-js');

  function loop() {
    const d = tgt - cur;
    if (Math.abs(d) < 0.4) { cur = tgt; scrollTo(0, cur); raf = 0; return; }
    cur += d * 0.11; scrollTo(0, cur); raf = requestAnimationFrame(loop);
  }
  function inScrollable(el, dy) {
    for (let n = el; n && n !== document.body && n !== doc; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  }
  function stopMotion() { if (raf) cancelAnimationFrame(raf); raf = 0; tween = null; cur = tgt = scrollY; }
  function scrollToY(y, dur) {
    y = clamp(y, 0, maxY());
    const from = scrollY, dist = y - from;
    if (!smooth || Math.abs(dist) < 2) { scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); return; }
    if (raf) cancelAnimationFrame(raf); raf = 0;
    dur = dur || clamp(Math.abs(dist) * 0.45, 650, 1400);
    const me = tween = {}, t0 = performance.now();
    (function step(t) {
      if (tween !== me) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, from + dist * e);
      if (k < 1) requestAnimationFrame(step); else { tween = null; cur = tgt = scrollY; }
    })(t0);
  }
  if (smooth) {
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (inScrollable(e.target, e.deltaY)) return;
      e.preventDefault();
      if (tween) { tween = null; cur = tgt = scrollY; }
      if (!raf) cur = tgt = scrollY;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      tgt = clamp(tgt + dy, 0, maxY());
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: false });
    addEventListener('scroll', () => { if (!raf && !tween) cur = tgt = scrollY; }, { passive: true });
    ['keydown', 'mousedown', 'touchstart'].forEach((ev) => addEventListener(ev, stopMotion, { passive: true }));
  }
  const goTo = (id) => {
    const el = document.getElementById(id); if (!el) return;
    scrollToY(el.getBoundingClientRect().top + scrollY - 16);
  };
  // our eased tween replaces the page's native smooth scrollIntoView
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]'); if (!a || !smooth) return;
    e.preventDefault(); e.stopImmediatePropagation(); goTo(a.dataset.goto);
  }, true);

  /* ================= 2. Nav: sliding pill + scrolled state ================= */
  const nav = $('.nav'), navUl = $('.nav ul');
  let pill = null;
  if (navUl) {
    pill = document.createElement('span'); pill.className = 'fx-pill'; navUl.prepend(pill);
    const place = () => {
      const a = $('a.active', navUl);
      if (!a) { pill.style.opacity = 0; return; }
      pill.style.opacity = 1; pill.style.width = a.offsetWidth + 'px'; pill.style.transform = `translateX(${a.offsetLeft}px)`;
    };
    new MutationObserver(place).observe(navUl, { subtree: true, attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', place); addEventListener('load', place); place();
  }

  /* ================= 3. Back-to-top, toast, shortcuts ================= */
  const top = document.createElement('button');
  top.className = 'fx-top'; top.type = 'button'; top.setAttribute('aria-label', 'Back to top');
  top.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="trk" cx="22" cy="22" r="19"/><circle class="bar" cx="22" cy="22" r="19"/></svg><span>↑</span>';
  document.body.append(top);
  const ring = $('.bar', top);
  top.addEventListener('click', () => scrollToY(0));
  const toast = document.createElement('div'); toast.className = 'fx-toast'; toast.setAttribute('role', 'status'); document.body.append(toast);
  let toastT = 0;
  const say = (html) => { toast.innerHTML = html; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 1500); };

  const SECTIONS = [['problem', 'Problem'], ['system', 'System'], ['live', 'Live sketch'], ['lab', 'Dataset lab'], ['concepts', 'Concepts'], ['results', 'Results'], ['research', 'Research'], ['journey', 'Journey'], ['refs-sec', 'References']];
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === '0') { say('<kbd>0</kbd> Top'); scrollToY(0); return; }
    const i = '123456789'.indexOf(e.key);
    if (i >= 0 && SECTIONS[i]) { say(`<kbd>${e.key}</kbd> ${SECTIONS[i][1]}`); goTo(SECTIONS[i][0]); }
  });

  /* ================= 4. Scroll-linked state (rAF throttled) ================= */
  const hero = $('.hero');
  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const y = scrollY, p = maxY() > 0 ? clamp(y / maxY(), 0, 1) : 0;
    if (hero) hero.style.setProperty('--hs', clamp(y / Math.max(1, hero.offsetHeight), 0, 1).toFixed(3));
    if (ring) ring.style.strokeDashoffset = (119.4 * (1 - p)).toFixed(1);
    top.classList.toggle('show', y > 700);
    if (nav) nav.classList.toggle('scrolled', y > 24);
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ================= 5. Pointer effects: glow, spotlight, tilt, magnet, hero parallax ================= */
  if (fine && !reduce) {
    const glow = document.createElement('div'); glow.className = 'fx-glow'; document.body.prepend(glow);
    let px = innerWidth / 2, py = innerHeight / 2, gx = px, gy = py, glowRaf = 0, pe = null, queued = false;
    function glowLoop() {
      gx += (px - gx) * 0.14; gy += (py - gy) * 0.14;
      glow.style.transform = `translate(${gx}px,${gy}px)`;
      glowRaf = (Math.abs(px - gx) + Math.abs(py - gy) > 0.5) ? requestAnimationFrame(glowLoop) : 0;
    }
    let tiltEl = null, magEl = null;
    const TILT = { '.term': 5, '.paper': 6, '.hero .kpi': 7 };
    const resetTilt = (el) => { if (el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); } };
    const resetMag = (el) => { if (el) { el.style.setProperty('--bx', '0px'); el.style.setProperty('--by', '0px'); } };
    function onMove() {
      queued = false;
      glow.classList.add('on');
      if (!glowRaf) glowRaf = requestAnimationFrame(glowLoop);
      const t = pe && pe.closest ? pe : null;
      // spotlight
      const c = t && t.closest('.card,.paper,.hero .kpi,.pipe-step');
      if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (px - r.left) + 'px'); c.style.setProperty('--my', (py - r.top) + 'px'); }
      // tilt
      let te = null, max = 0;
      if (t) for (const sel in TILT) { const m = t.closest(sel); if (m) { te = m; max = TILT[sel]; break; } }
      if (tiltEl && tiltEl !== te) resetTilt(tiltEl);
      tiltEl = te;
      if (te) { const r = te.getBoundingClientRect(); const x = (px - r.left) / r.width, y = (py - r.top) / r.height; te.style.setProperty('--rx', ((0.5 - y) * max).toFixed(2) + 'deg'); te.style.setProperty('--ry', ((x - 0.5) * max).toFixed(2) + 'deg'); }
      // magnetic buttons
      const mb = t && t.closest('.cta .btn,.term-btn');
      if (magEl && magEl !== mb) resetMag(magEl);
      magEl = mb;
      if (mb) { const r = mb.getBoundingClientRect(); mb.style.setProperty('--bx', clamp((px - (r.left + r.width / 2)) * 0.22, -10, 10).toFixed(1) + 'px'); mb.style.setProperty('--by', clamp((py - (r.top + r.height / 2)) * 0.3, -8, 8).toFixed(1) + 'px'); }
      // hero parallax
      if (hero) {
        const r = hero.getBoundingClientRect();
        if (py >= r.top && py <= r.bottom) { hero.style.setProperty('--px', ((px / innerWidth) - 0.5).toFixed(3)); hero.style.setProperty('--py', (((py - r.top) / r.height) - 0.5).toFixed(3)); }
      }
    }
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY; pe = e.target;
      if (!queued) { queued = true; requestAnimationFrame(onMove); }
    }, { passive: true });
    doc.addEventListener('mouseleave', () => {
      glow.classList.remove('on'); resetTilt(tiltEl); resetMag(magEl); tiltEl = magEl = null;
      if (hero) { hero.style.setProperty('--px', 0); hero.style.setProperty('--py', 0); }
    });
  }

  /* ================= 6. Click ripple ================= */
  document.addEventListener('click', (e) => {
    if (reduce) return;
    const el = e.target.closest('.btn,.atk,.chip,[role=tab],.seg button,.copy,.term-btn'); if (!el) return;
    const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    const d = document.createElement('span'); d.className = 'fx-ripple';
    d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    el.append(d); setTimeout(() => d.remove(), 700);
  });

  /* ================= 7. Staggered reveals ================= */
  $$('.reveal').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    if (sibs.length > 1) el.style.setProperty('--rd', sibs.indexOf(el) * 90 + 'ms');
  });
  const doneObs = new MutationObserver((ms) => ms.forEach((m) => {
    const el = m.target; if (el.classList.contains('in') && !el.dataset.rd) { el.dataset.rd = 1; setTimeout(() => el.classList.add('rd-done'), 1800); }
  }));
  $$('.reveal').forEach((el) => doneObs.observe(el, { attributes: true, attributeFilter: ['class'] }));
  const pipe = $('#pipeline');
  if (pipe) {
    [...pipe.children].forEach((c, i) => c.style.setProperty('--i', i));
    if (reduce) pipe.classList.add('fx-in');
    else new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { pipe.classList.add('fx-in'); o.disconnect(); } }), { threshold: 0.15 }).observe(pipe);
  }

  /* ================= 8. Live detection feed (simulated) ================= */
  const feed = $('#termFeed'), term = $('.term');
  if (feed && term) {
    const svcs = ['http', 'smtp', 'dns', 'ftp', 'ssh', 'https', 'pop3'];
    const EV = [
      { w: 9, tag: 'OK', cls: 'ok', text: () => `10.0.${rnd(0, 9)}.${rnd(2, 250)} → ${pick(svcs)} · normal`, detail: () => `score 0.0${rnd(1, 9)} · classifier: normal · AE error ${(Math.random() * 0.02 + 0.005).toFixed(3)}` },
      { w: 2, tag: 'DoS', cls: 'bad', text: () => `172.16.${rnd(0, 9)}.${rnd(2, 250)} → 80 · known signature`, detail: () => `RF + SVM agree · flood ${rnd(900, 9000)} conn/s · action: block` },
      { w: 1.2, tag: 'PROBE', cls: 'bad', text: () => `172.16.${rnd(0, 9)}.${rnd(2, 250)} → scan · known`, detail: () => `port sweep across ${rnd(200, 1200)} ports · action: rate-limit` },
      { w: 0.8, tag: 'R2L', cls: 'bad', text: () => `203.0.113.${rnd(2, 250)} → ftp · known`, detail: () => `failed auth ×${rnd(8, 40)} · action: alert` },
      { w: 0.5, tag: 'U2R', cls: 'bad', text: () => `10.0.${rnd(0, 9)}.${rnd(2, 250)} → root shell · known`, detail: () => 'privilege escalation pattern · action: isolate host' },
      { w: 1, tag: '0-DAY', cls: 'zero', text: () => `192.168.${rnd(0, 9)}.${rnd(2, 250)} · anomaly 0.${rnd(81, 99)}`, detail: () => `no signature match · AE recon error ${(Math.random() * 0.1 + 0.07).toFixed(3)} · action: quarantine` }
    ];
    const total = EV.reduce((a, e) => a + e.w, 0);
    const weighted = () => { let r = Math.random() * total; for (const e of EV) { if ((r -= e.w) <= 0) return e; } return EV[0]; };
    const cnt = { scan: 0, block: 0, zero: 0 };
    const out = { scan: $('#tScan'), block: $('#tBlock'), zero: $('#tZero') };
    const paint = () => { for (const k in out) if (out[k]) out[k].textContent = cnt[k].toLocaleString(); };
    function add(ev, instant) {
      const li = document.createElement('li');
      if (ev.cls === 'zero') li.classList.add('zero-row');
      li.innerHTML = `<b class="${ev.cls}">${ev.tag}</b>${ev.text()}<small>${ev.detail()}</small>`;
      if (instant) li.style.animation = 'none';
      feed.append(li);
      while (feed.children.length > 7) feed.firstElementChild.remove();
      cnt.scan++; if (ev.cls !== 'ok') cnt.block++; if (ev.cls === 'zero') { cnt.zero++; window.dispatchEvent(new Event('fx:attack')); }
      paint();
    }
    for (let i = 0; i < 6; i++) add(i === 4 ? EV[5] : weighted(), true);
    feed.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) li.classList.toggle('open'); });
    let hovering = false, inView = true;
    term.addEventListener('pointerenter', () => (hovering = true));
    term.addEventListener('pointerleave', () => (hovering = false));
    new IntersectionObserver((es) => es.forEach((e) => (inView = e.isIntersecting)), { threshold: 0.1 }).observe(term);
    (function tick() {
      if (!hovering && inView && !document.hidden) add(weighted());
      setTimeout(tick, reduce ? rnd(2600, 3600) : rnd(900, 1900));
    })();
    const inject = $('#tInject');
    if (inject) inject.addEventListener('click', () => {
      add(EV[5]);
      if (!reduce && term.animate) term.animate([{ scale: 1, boxShadow: '0 0 0 0 rgba(255,181,71,.6)' }, { scale: 1.03, boxShadow: '0 0 0 14px rgba(255,181,71,0)' }, { scale: 1 }], { duration: 650, easing: 'ease-out' });
    });
  }
})();
