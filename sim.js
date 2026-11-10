/* NIDS Lab — hero mesh, live intrusion sketch, precision/recall demo */
(function () {
  const C = { bg: '#161b26', teal: '#3ddbb8', amber: '#ffb547', red: '#ff5d6c', blue: '#6ea8ff', pink: '#e58bff', text: '#e6ebf5', muted: '#8d9ab3', line: '#2f3a52' };
  const CLS = { normal: C.teal, dos: C.red, probe: C.blue, r2l: C.amber, u2r: C.pink, zero: '#ffffff' };
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fitCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  function whenVisible(el, cb) { const io = new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), { threshold: 0.02 }); io.observe(el); }

  /* ---------------- Hero mesh ---------------- */
  (function hero() {
    const cv = document.getElementById('heroCanvas'); if (!cv) return;
    let { ctx, w, h } = fitCanvas(cv); let visible = true;
    const pts = Array.from({ length: 70 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, bad: false, t: 0 }));
    let scan = { x: w * 0.7, y: h * 0.5, r: 0 };
    pts.forEach((p) => { p.bx = p.vx; p.by = p.vy; });
    const mouse = { x: -999, y: -999 };
    window.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    document.documentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = -999; });
    const spawnAttack = (x, y) => { let best = null, bd = 1e9; for (const p of pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } if (best) { best.bad = true; best.t = 0; scan = { x: best.x, y: best.y, r: 0 }; } };
    window.addEventListener('fx:attack', () => spawnAttack(Math.random() * w, Math.random() * h));
    (cv.closest('.hero') || cv.parentElement).addEventListener('click', (e) => { if (e.target.closest('a,button,.term,.kpi,.team')) return; const r = cv.getBoundingClientRect(); spawnAttack(e.clientX - r.left, e.clientY - r.top); });
    window.addEventListener('resize', () => ({ ctx, w, h } = fitCanvas(cv)));
    whenVisible(cv, (v) => (visible = v));
    setInterval(() => { const p = pts[Math.floor(Math.random() * pts.length)]; p.bad = true; p.t = 0; scan = { x: p.x, y: p.y, r: 0 }; }, 2200);
    function frame() {
      requestAnimationFrame(frame); if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) { if (!prefersReduced) { const mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = Math.hypot(mdx, mdy); if (md < 130 && md > 0.1) { p.vx += (mdx / md) * 0.06; p.vy += (mdy / md) * 0.06; } p.vx += (p.bx - p.vx) * 0.02; p.vy += (p.by - p.vy) * 0.02; p.x += p.vx; p.y += p.vy; } if (p.x < 0 || p.x > w) { p.vx *= -1; p.bx *= -1; p.x = Math.max(0, Math.min(w, p.x)); } if (p.y < 0 || p.y > h) { p.vy *= -1; p.by *= -1; p.y = Math.max(0, Math.min(h, p.y)); } if (p.bad) { p.t++; if (p.t > 160) p.bad = false; } }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j]; const dx = a.x - b.x, dy = a.y - b.y; const dist = Math.hypot(dx, dy);
        if (dist < 120) { ctx.strokeStyle = a.bad || b.bad ? `rgba(255,93,108,${0.35 * (1 - dist / 120)})` : `rgba(61,219,184,${0.16 * (1 - dist / 120)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      if (mouse.y >= 0 && mouse.y <= h) for (const p of pts) { const d = Math.hypot(p.x - mouse.x, p.y - mouse.y); if (d < 150) { ctx.strokeStyle = `rgba(255,181,71,${0.45 * (1 - d / 150)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
      for (const p of pts) { ctx.fillStyle = p.bad ? C.red : 'rgba(151,214,201,0.7)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.bad ? 3.2 : 1.8, 0, Math.PI * 2); ctx.fill(); }
      scan.r += 1.6; if (scan.r < 90) { ctx.strokeStyle = `rgba(255,181,71,${0.8 * (1 - scan.r / 90)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(scan.x, scan.y, scan.r, 0, Math.PI * 2); ctx.stroke(); }
    }
    frame();
  })();

  /* ---------------- Live intrusion sketch ---------------- */
  (function sketch() {
    const cv = document.getElementById('simCanvas'); if (!cv) return;
    const tl = document.getElementById('scoreCanvas');
    let { ctx, w, h } = fitCanvas(cv); let T = fitCanvas(tl);
    let visible = true, paused = false;
    const $ = (id) => document.getElementById(id);
    const state = { mode: 'hybrid', ips: true, truth: true, rate: 8, thr: 0.5 };
    const N = {
      internet: { x: 0.07, y: 0.5, label: 'Internet', kind: 'cloud', info: 'Untrusted external traffic. Benign clients and attackers both arrive from here.' },
      router: { x: 0.22, y: 0.5, label: 'Edge Router', kind: 'box', info: 'Routes packets into the organisation. Exports flow records (NetFlow/IPFIX) — the raw material of modern flow-based NIDS datasets.' },
      firewall: { x: 0.36, y: 0.5, label: 'Firewall', kind: 'wall', info: 'Stateful port/IP rules. Blocks obviously disallowed traffic but cannot judge behaviour inside allowed sessions.' },
      nids: { x: 0.52, y: 0.5, label: 'NIDS Sensor', kind: 'hex', info: 'Our hybrid detector: a supervised track (LR / RF / XGBoost) for known signatures plus an autoencoder that scores reconstruction error to catch the unknown.' },
      sw: { x: 0.66, y: 0.5, label: 'Core Switch', kind: 'box', info: 'Distributes traffic to internal hosts. In passive mode a SPAN/mirror port feeds the sensor instead.' },
      web: { x: 0.88, y: 0.13, label: 'Web', kind: 'srv', info: 'HTTP server — typical target of floods (DoS) like neptune or apache2.' },
      mail: { x: 0.88, y: 0.38, label: 'Mail', kind: 'srv', info: 'SMTP/IMAP server — target of password guessing and other remote-to-local (R2L) attacks.' },
      dns: { x: 0.88, y: 0.63, label: 'DNS', kind: 'srv', info: 'Resolver — commonly abused by novel tunnelling attacks that no signature describes.' },
      db: { x: 0.88, y: 0.87, label: 'Database', kind: 'srv', info: 'Crown jewels. User-to-root (U2R) escalation attempts end here.' },
    };
    const targets = ['web', 'mail', 'dns', 'db'];
    const attackers = []; const packets = []; const sparks = []; const flashes = {};
    const scores = []; const stats = { total: 0, tp: 0, fp: 0, fn: 0, tn: 0, blocked: 0 };
    const P = (n) => ({ x: n.x * w, y: n.y * h });
    const ip = (a) => `${a}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const ATK = {
      dos: { name: 'SYN flood (neptune)', cls: 'dos', rate: 26, dur: 5, tgt: () => 'web' },
      probe: { name: 'Port sweep (satan)', cls: 'probe', rate: 9, dur: 6, tgt: (k) => targets[k % 4] },
      r2l: { name: 'Password guessing', cls: 'r2l', rate: 5, dur: 6, tgt: () => 'mail' },
      u2r: { name: 'Buffer overflow → root', cls: 'u2r', rate: 2.5, dur: 6, tgt: () => 'db' },
      zero: { name: 'Zero-day (unseen)', cls: 'zero', rate: 7, dur: 6, tgt: () => (Math.random() < 0.6 ? 'dns' : 'web') },
    };

    function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function spawn(src, tgt, cls, meta) {
      if (packets.length > 320) return;
      const zero = cls === 'zero'; const attack = cls !== 'normal';
      const score = Math.max(0, Math.min(1, attack ? (zero ? 0.62 + gauss() * 0.15 : 0.74 + gauss() * 0.13) : 0.25 + gauss() * 0.12));
      packets.push({ path: [src, 'router', 'firewall', 'nids', 'sw', tgt], seg: 0, t: 0, speed: 0.9 + Math.random() * 0.5, cls, attack, zero, score, flagged: false, inspected: false, meta, srcIP: meta?.ip || ip(Math.random() < 0.5 ? '203.0' : '198.51'), jitter: (Math.random() - 0.5) * 10 });
      stats.total++;
    }
    function decide(p) {
      const s = state.mode, known = p.attack && !p.zero;
      const sig = known ? Math.random() < 0.96 : !p.attack && Math.random() < 0.003;
      const sup = known ? Math.random() < 0.97 : p.zero ? Math.random() < 0.37 : Math.random() < 0.01;
      const ae = p.score > state.thr;
      if (s === 'signature') return sig; if (s === 'supervised') return sup; if (s === 'anomaly') return ae; return sup || ae;
    }

    function launch(kind) {
      const a = ATK[kind]; const slot = attackers.length % 3;
      const node = { x: 0.07, y: [0.14, 0.86, 0.26][slot], label: a.name, kind: 'attacker', cls: a.cls, info: `Attacker running “${a.name}”.`, ip: ip('45.155') };
      const id = 'atk' + Date.now() + Math.random(); N[id] = node;
      const atk = { id, kind, a, start: performance.now(), sent: 0, acc: 0 }; attackers.push(atk);
      logLine({ type: 'info', text: `Attack started · ${a.name} from ${node.ip}` });
    }
    document.querySelectorAll('[data-attack]').forEach((b) => b.addEventListener('click', () => launch(b.dataset.attack)));
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b)); updateModeNote(); }));
    $('simRate').addEventListener('input', (e) => { state.rate = +e.target.value; $('simRateVal').textContent = `${state.rate} pkt/s`; });
    $('simThr').addEventListener('input', (e) => { state.thr = +e.target.value; $('simThrVal').textContent = state.thr.toFixed(2); });
    $('simIps').addEventListener('change', (e) => (state.ips = e.target.checked));
    $('simTruth').addEventListener('change', (e) => (state.truth = e.target.checked));
    $('simPause').addEventListener('click', (e) => { paused = !paused; e.currentTarget.textContent = paused ? 'Resume' : 'Pause'; e.currentTarget.setAttribute('aria-pressed', paused); });
    $('simReset').addEventListener('click', () => { packets.length = 0; scores.length = 0; Object.keys(stats).forEach((k) => (stats[k] = 0)); attackers.length = 0; Object.keys(N).filter((k) => k.startsWith('atk')).forEach((k) => delete N[k]); $('alertLog').innerHTML = ''; renderStats(); });
    const notes = { signature: 'Signature mode: near-perfect on known attacks, blind to anything new. Watch zero-day packets slip through.', supervised: 'Supervised ML: generalises a bit beyond exact signatures, but on NSL-KDD unseen attacks only ~27–47% are caught.', anomaly: 'Autoencoder: learns “normal” only. Anything that reconstructs badly (score above threshold) is flagged — including zero-days, at the cost of some false alarms.', hybrid: 'Hybrid (our proposal): flag if either the supervised track OR the autoencoder fires. Best recall, tune the threshold to trade off false alarms.' };
    function updateModeNote() { $('modeNote').textContent = notes[state.mode]; }
    updateModeNote();

    const log = $('alertLog');
    function logLine({ type, text }) {
      const li = document.createElement('li'); li.className = `log-${type}`;
      const t = new Date(); li.innerHTML = `<time>${t.toTimeString().slice(0, 8)}</time><span>${text}</span>`;
      log.prepend(li); while (log.children.length > 60) log.lastChild.remove();
    }
    function renderStats() {
      const prec = stats.tp + stats.fp ? stats.tp / (stats.tp + stats.fp) : 0; const rec = stats.tp + stats.fn ? stats.tp / (stats.tp + stats.fn) : 0;
      $('stTotal').textContent = stats.total; $('stTP').textContent = stats.tp; $('stFP').textContent = stats.fp; $('stFN').textContent = stats.fn;
      $('stPrec').textContent = (prec * 100).toFixed(1) + '%'; $('stRec').textContent = (rec * 100).toFixed(1) + '%'; $('stBlk').textContent = stats.blocked;
    }

    // tooltip
    const tip = $('simTip');
    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      let hit = null; for (const k in N) { const p = P(N[k]); if (Math.hypot(p.x - mx, p.y - my) < 26) hit = N[k]; }
      if (hit) { tip.hidden = false; tip.innerHTML = `<strong>${hit.label}</strong><span>${hit.info}</span>`; tip.style.left = Math.min(mx + 14, w - 240) + 'px'; tip.style.top = my + 14 + 'px'; } else tip.hidden = true;
    });
    cv.addEventListener('mouseleave', () => (tip.hidden = true));

    window.addEventListener('resize', () => { ({ ctx, w, h } = fitCanvas(cv)); T = fitCanvas(tl); });
    whenVisible(cv, (v) => (visible = v));

    let last = performance.now(), acc = 0, dash = 0;
    function step(dt) {
      acc += dt * state.rate; while (acc >= 1) { acc--; spawn('internet', targets[Math.floor(Math.random() * 4)], 'normal'); }
      const now = performance.now();
      for (let i = attackers.length - 1; i >= 0; i--) {
        const a = attackers[i]; const el = (now - a.start) / 1000;
        if (el < a.a.dur) { a.acc += dt * a.a.rate; while (a.acc >= 1) { a.acc--; spawn(a.id, a.a.tgt(a.sent++), a.a.cls, { ip: N[a.id].ip, name: a.a.name }); } }
        else if (el > a.a.dur + 3) { delete N[a.id]; attackers.splice(i, 1); }
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]; const A = N[p.path[p.seg]] || N.internet, B = N[p.path[p.seg + 1]];
        const len = Math.hypot((B.x - A.x) * w, (B.y - A.y) * h) || 1;
        p.t += (dt * 260 * p.speed) / len;
        if (p.t >= 1) {
          p.t = 0; p.seg++;
          const at = p.path[p.seg];
          if (at === 'nids' && !p.inspected) {
            p.inspected = true; p.flagged = decide(p);
            scores.push({ s: p.score, attack: p.attack, zero: p.zero, flagged: p.flagged }); if (scores.length > 240) scores.shift();
            if (p.flagged) {
              flashes.nids = 1;
              if (p.attack) stats.tp++; else stats.fp++;
              logLine({ type: p.attack ? 'hit' : 'fp', text: `${p.attack ? 'ALERT' : 'False alarm'} · ${p.srcIP} → ${N[p.path[5]].label} · score ${p.score.toFixed(2)}${p.attack ? ' · ' + (p.zero ? 'zero-day' : p.cls.toUpperCase()) : ''}` });
              if (state.ips) { stats.blocked++; burst(P(N.nids), p.attack ? C.red : C.amber); packets.splice(i, 1); renderStats(); continue; }
            } else if (!p.attack) stats.tn++;
            renderStats();
          }
          if (p.seg >= p.path.length - 1) {
            const tgt = p.path[p.path.length - 1];
            if (p.attack && !p.flagged) { stats.fn++; flashes[tgt] = 1; logLine({ type: 'miss', text: `Missed · ${p.zero ? 'zero-day' : p.cls.toUpperCase()} reached ${N[tgt].label} from ${p.srcIP}` }); renderStats(); }
            packets.splice(i, 1);
          }
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx * dt * 60; s.y += s.vy * dt * 60; s.life -= dt * 1.6; if (s.life <= 0) sparks.splice(i, 1); }
      for (const k in flashes) { flashes[k] -= dt * 1.8; if (flashes[k] <= 0) delete flashes[k]; }
    }
    function burst(p, col) { for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, life: 1, col }); } }

    function drawNode(key, n) {
      const { x, y } = P(n); const f = flashes[key] || 0;
      ctx.save();
      if (n.kind === 'hex') {
        const r = 30; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i + Math.PI / 6; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath();
        ctx.fillStyle = f ? `rgba(255,181,71,${0.25 + 0.4 * f})` : 'rgba(61,219,184,0.12)'; ctx.fill(); ctx.strokeStyle = f ? C.amber : C.teal; ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([4, 6]); ctx.lineDashOffset = -dash * 0.6; ctx.strokeStyle = 'rgba(61,219,184,0.5)'; ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        const a = dash * 0.03; ctx.strokeStyle = 'rgba(61,219,184,0.85)'; ctx.beginPath(); ctx.arc(x, y, 42, a, a + 0.6); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '600 11px Geist, system-ui'; ctx.textAlign = 'center'; ctx.fillText('AI', x, y + 4);
      } else if (n.kind === 'cloud') {
        ctx.fillStyle = 'rgba(110,168,255,0.14)'; ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x - 10, y + 4, 14, 0, 7); ctx.arc(x + 8, y - 6, 16, 0, 7); ctx.arc(x + 14, y + 8, 12, 0, 7); ctx.fill(); ctx.stroke();
      } else if (n.kind === 'wall') {
        ctx.fillStyle = 'rgba(255,181,71,0.12)'; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 12, y - 24, 24, 48, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(x - 12, y - 24 + i * 12); ctx.lineTo(x + 12, y - 24 + i * 12); } ctx.stroke();
      } else if (n.kind === 'attacker') {
        const pulse = 1 + Math.sin(dash * 0.15) * 0.15;
        ctx.fillStyle = 'rgba(255,93,108,0.18)'; ctx.beginPath(); ctx.arc(x, y, 18 * pulse, 0, 7); ctx.fill(); ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
        ctx.fillStyle = C.red; ctx.font = '700 11px Geist, system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', x, y + 4);
      } else {
        const col = f ? C.red : n.kind === 'srv' ? C.teal : C.muted;
        ctx.fillStyle = f ? `rgba(255,93,108,${0.2 + 0.5 * f})` : 'rgba(34,42,61,0.95)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - 20, y - 15, 40, 30, 7); ctx.fill(); ctx.stroke();
        if (n.kind === 'srv') { ctx.fillStyle = col; for (let i = 0; i < 3; i++) ctx.fillRect(x - 12, y - 8 + i * 6, 16, 2); ctx.beginPath(); ctx.arc(x + 11, y, 2.5, 0, 7); ctx.fill(); }
        else { ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 9 + i * 6, y, 2, 0, 7); ctx.fill(); } }
      }
      ctx.fillStyle = n.kind === 'attacker' ? C.red : C.muted; ctx.font = '500 11px Geist, system-ui'; ctx.textAlign = 'center';
      const lbl = n.kind === 'attacker' ? n.ip : n.label;
      ctx.fillText(lbl, x, n.kind === 'hex' ? y + 58 : y + (n.kind === 'wall' ? 38 : 32));
      ctx.restore();
    }
    function link(a, b, active) {
      const A = P(a), B = P(b); ctx.strokeStyle = active ? 'rgba(61,219,184,0.35)' : C.line; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]); ctx.lineDashOffset = -dash; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      link(N.internet, N.router, 1); link(N.router, N.firewall, 1); link(N.firewall, N.nids, 1); link(N.nids, N.sw, 1); targets.forEach((t) => link(N.sw, N[t], 1));
      for (const a of attackers) if (N[a.id]) link(N[a.id], N.router, 0);
      for (const p of packets) {
        const A = N[p.path[p.seg]], B = N[p.path[p.seg + 1]]; if (!A || !B) continue;
        const x = (A.x + (B.x - A.x) * p.t) * w, y = (A.y + (B.y - A.y) * p.t) * h + (p.seg < 4 ? p.jitter : 0) * Math.sin(p.t * Math.PI);
        let col = state.truth ? CLS[p.cls] : 'rgba(200,210,230,0.85)';
        if (p.inspected) col = p.flagged ? C.red : state.truth ? CLS[p.cls] : C.teal;
        ctx.fillStyle = col;
        if (p.attack && state.truth) { ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.beginPath(); ctx.arc(x, y, p.attack ? 3.6 : 2.6, 0, 7); ctx.fill();
        if (p.flagged) { ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke(); }
        if (p.zero && state.truth) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.stroke(); }
      }
      for (const s of sparks) { ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
      for (const k in N) drawNode(k, N[k]);
      drawTimeline();
    }
    function drawTimeline() {
      const c = T.ctx, W = T.w, H = T.h; c.clearRect(0, 0, W, H);
      const pad = 6; const yv = (s) => H - pad - s * (H - pad * 2);
      c.strokeStyle = 'rgba(255,181,71,0.8)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(0, yv(state.thr)); c.lineTo(W, yv(state.thr)); c.stroke(); c.setLineDash([]);
      c.fillStyle = C.amber; c.font = '500 10px Geist Mono, monospace'; c.fillText(`threshold ${state.thr.toFixed(2)}`, 6, yv(state.thr) - 4);
      const n = scores.length; scores.forEach((s, i) => { const x = W - (n - i) * (W / 240); c.fillStyle = s.attack ? (s.zero ? '#ffffff' : C.red) : C.teal; c.globalAlpha = s.flagged ? 1 : 0.55; c.beginPath(); c.arc(x, yv(s.s), s.attack ? 2.6 : 1.8, 0, 7); c.fill(); });
      c.globalAlpha = 1;
    }
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible || paused) return;
      dash += dt * 30; step(dt); draw();
    }
    renderStats(); requestAnimationFrame(loop);
  })();

  /* ---------------- Precision / recall demo ---------------- */
  (function prDemo() {
    const cv = document.getElementById('prCanvas'); if (!cv) return;
    const R = window.NIDS.mulberry32(42); const g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const dots = [];
    for (let i = 0; i < 70; i++) dots.push({ s: Math.min(0.98, Math.max(0.02, 0.3 + g() * 0.14)), a: 0, r: R() });
    for (let i = 0; i < 22; i++) dots.push({ s: Math.min(0.98, Math.max(0.02, 0.7 + g() * 0.15)), a: 1, r: R() });
    let thr = 0.5; let F = fitCanvas(cv);
    const slider = document.getElementById('prThr');
    function render() {
      const { ctx, w, h } = F; ctx.clearRect(0, 0, w, h);
      const x = (s) => 16 + s * (w - 32);
      ctx.fillStyle = 'rgba(255,93,108,0.08)'; ctx.fillRect(x(thr), 0, w - x(thr), h);
      let tp = 0, fp = 0, fn = 0;
      for (const d of dots) {
        const flagged = d.s >= thr; if (d.a && flagged) tp++; else if (!d.a && flagged) fp++; else if (d.a) fn++;
        const y = 14 + d.r * (h - 28);
        ctx.fillStyle = d.a ? C.red : C.teal; ctx.globalAlpha = flagged ? 1 : 0.45; ctx.beginPath(); ctx.arc(x(d.s), y, d.a ? 5 : 4, 0, 7); ctx.fill();
        if (flagged) { ctx.strokeStyle = C.amber; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x(d.s), y, 7.5, 0, 7); ctx.stroke(); }
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(thr), 0); ctx.lineTo(x(thr), h); ctx.stroke();
      const p = tp + fp ? tp / (tp + fp) : 1, r = tp / (tp + fn), f1 = p + r ? (2 * p * r) / (p + r) : 0;
      document.getElementById('prP').textContent = (p * 100).toFixed(0) + '%'; document.getElementById('prR').textContent = (r * 100).toFixed(0) + '%';
      document.getElementById('prF').textContent = f1.toFixed(2); document.getElementById('prCounts').textContent = `TP ${tp} · FP ${fp} · FN ${fn}`;
      document.getElementById('prThrVal').textContent = thr.toFixed(2);
    }
    slider.addEventListener('input', (e) => { thr = +e.target.value; render(); });
    window.addEventListener('resize', () => { F = fitCanvas(cv); render(); });
    render();
  })();

  /* ---------------- Signature vs anomaly grid ---------------- */
  (function sigGrid() {
    const grid = document.getElementById('sigGrid'); if (!grid) return;
    const R = window.NIDS.mulberry32(9); const tiles = [];
    for (let i = 0; i < 40; i++) tiles.push({ unseen: i >= 24, r: R(), r2: R() });
    tiles.sort((a, b) => a.r - b.r);
    grid.innerHTML = tiles.map((t) => `<span class="tile ${t.unseen ? 'unseen' : 'known'}" title="${t.unseen ? 'Unseen / zero-day attack' : 'Known attack signature'}"></span>`).join('');
    const els = [...grid.children];
    function apply(mode) {
      let caught = 0, caughtU = 0;
      els.forEach((el, i) => {
        const t = tiles[i];
        const hit = mode === 'signature' ? !t.unseen && t.r2 < 0.96 : mode === 'ml' ? (t.unseen ? t.r2 < 0.37 : t.r2 < 0.97) : mode === 'ae' ? (t.unseen ? t.r2 < 0.78 : t.r2 < 0.86) : t.unseen ? t.r2 < 0.8 : t.r2 < 0.99;
        el.classList.toggle('caught', hit); el.style.transitionDelay = `${i * 12}ms`;
        if (hit) { caught++; if (t.unseen) caughtU++; }
      });
      document.getElementById('sigStat').innerHTML = `<b>${caught}/40</b> attacks caught · <b>${caughtU}/16</b> zero-days`;
    }
    document.querySelectorAll('[data-sig]').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('[data-sig]').forEach((x) => x.setAttribute('aria-pressed', x === b)); apply(b.dataset.sig); }));
    apply('signature');
  })();
})();
