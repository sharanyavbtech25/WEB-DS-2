/* NIDS Lab — dataset lab UI, pipeline, research and references */
(function () {
  const $ = (id) => document.getElementById(id);
  const C = { teal: '#3ddbb8', amber: '#ffb547', red: '#ff5d6c', blue: '#6ea8ff', pink: '#e58bff', text: '#e6ebf5', muted: '#8d9ab3', grid: 'rgba(141,154,179,0.14)' };
  const palette = [C.teal, C.red, C.blue, C.amber, C.pink, '#9be15d', '#ff8f5a', '#7f8cff'];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');

  if (window.Chart) {
    Chart.defaults.color = C.muted; Chart.defaults.font.family = 'Geist, system-ui, sans-serif'; Chart.defaults.borderColor = C.grid;
    Chart.defaults.plugins.legend.labels.boxWidth = 10; Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.animation.duration = 700;
  }
  const charts = {};
  function chart(id, cfg) { if (!window.Chart) return; if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }

  /* ---------------- nav & reveal ---------------- */
  document.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById(a.dataset.goto)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  const navLinks = [...document.querySelectorAll('.nav [data-goto]')];
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) navLinks.forEach((l) => l.classList.toggle('active', l.dataset.goto === e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section[id]').forEach((s) => so.observe(s));
  const co = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; const el = e.target; co.unobserve(el);
    const end = +el.dataset.count; const dec = +(el.dataset.dec || 0); const suf = el.dataset.suffix || ''; const t0 = performance.now();
    const tick = (t) => { const k = Math.min(1, (t - t0) / 1400); const v = end * (1 - Math.pow(1 - k, 3)); el.textContent = v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach((el) => co.observe(el));

  /* ---------------- tabs ---------------- */
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
      if (t.dataset.onshow) window.dispatchEvent(new Event('resize'));
    }));
    list.addEventListener('keydown', (e) => { const i = tabs.indexOf(document.activeElement); if (i < 0) return; let n = null; if (e.key === 'ArrowRight') n = (i + 1) % tabs.length; if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length; if (n != null) { tabs[n].focus(); tabs[n].click(); } });
  });

  /* ---------------- Dataset lab ---------------- */
  let DS = null, PREP = null, MI = null, RESULT = null;
  const labelSel = $('labelCol');

  function loadDataset(ds) {
    DS = ds; RESULT = null;
    labelSel.innerHTML = ds.columns.map((c) => `<option ${c === ds.labelCol ? 'selected' : ''}>${esc(c)}</option>`).join('');
    $('dsName').textContent = ds.name;
    $('trainOut').hidden = true; $('trainEmpty').hidden = false;
    reprocess();
  }
  function reprocess() {
    try {
      PREP = NIDS.prepare(DS, { labelCol: labelSel.value });
      MI = NIDS.mutualInfo(PREP);
      $('dsError').hidden = true;
    } catch (err) { $('dsError').hidden = false; $('dsError').textContent = err.message; return; }
    const atk = PREP.y.reduce((s, v) => s + v, 0);
    const unseenTypes = new Set(PREP.testIdx.filter((_, k) => PREP.unseen[k]).map((i) => PREP.labels[i]));
    $('sRows').textContent = PREP.n.toLocaleString(); $('sFeat').textContent = PREP.d; $('sAtk').textContent = pct(atk / PREP.n);
    $('sSplit').textContent = `${PREP.trainIdx.length} / ${PREP.testIdx.length}`; $('sUnseen').textContent = unseenTypes.size;
    $('kFeat').max = PREP.d; $('kFeat').value = Math.min(+$('kFeat').value || 20, PREP.d); $('kFeatVal').textContent = $('kFeat').value;
    renderPreview(); renderClasses(); renderMI(); renderFeatureSelect();
  }
  labelSel.addEventListener('change', () => { DS.labelCol = labelSel.value; reprocess(); });

  function renderPreview() {
    const cols = DS.columns.slice(0, 14);
    $('preview').innerHTML = `<thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}${DS.columns.length > 14 ? '<th>…</th>' : ''}</tr></thead><tbody>${DS.rows.slice(0, 12).map((r) => `<tr>${cols.map((c, i) => { const v = r[DS.columns.indexOf(c)]; const isL = c === labelSel.value; return `<td${isL ? ` class="${NIDS.isNormalValue(v) ? 'lbl-n' : 'lbl-a'}"` : ''}>${esc(v)}</td>`; }).join('')}${DS.columns.length > 14 ? '<td>…</td>' : ''}</tr>`).join('')}</tbody>`;
  }
  function renderClasses() {
    const col = DS.categoryCol && DS.columns.includes(DS.categoryCol) ? DS.categoryCol : labelSel.value;
    const idx = DS.columns.indexOf(col); const freq = {};
    for (const r of DS.rows) freq[r[idx]] = (freq[r[idx]] || 0) + 1;
    let entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (entries.length > 8) { const rest = entries.slice(7).reduce((s, e) => s + e[1], 0); entries = entries.slice(0, 7).concat([['other', rest]]); }
    $('classTitle').textContent = `Class distribution · ${col}`;
    chart('classChart', { type: 'doughnut', data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: entries.map((e, i) => (NIDS.isNormalValue(e[0]) ? C.teal : palette[(i % 7) + 1])), borderColor: '#1b2131', borderWidth: 3 }] }, options: { cutout: '62%', plugins: { legend: { position: 'right' } }, maintainAspectRatio: false } });
  }
  function renderMI() {
    const top = MI.slice(0, 15);
    chart('miChart', { type: 'bar', data: { labels: top.map((m) => m.name), datasets: [{ label: 'Mutual information (bits)', data: top.map((m) => +m.mi.toFixed(4)), backgroundColor: top.map((_, i) => (i < 5 ? C.teal : 'rgba(61,219,184,0.45)')), borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: C.grid } }, y: { grid: { display: false }, ticks: { font: { family: 'Geist Mono, monospace', size: 11 } } } } } });
  }
  function renderFeatureSelect() {
    const sel = $('featSel'); sel.innerHTML = MI.map((m) => `<option value="${m.j}">${esc(m.name)}</option>`).join(''); renderHist();
  }
  $('featSel').addEventListener('change', renderHist);
  function renderHist() {
    const j = +$('featSel').value; const idx = PREP.trainIdx;
    const vals = idx.map((i) => PREP.X[i][j]); let min = Math.min(...vals), max = Math.max(...vals); if (min === max) max = min + 1;
    const B = 20; const hn = new Array(B).fill(0), ha = new Array(B).fill(0); const a = [], nn = [];
    idx.forEach((i, k) => { const b = Math.min(B - 1, Math.floor(((vals[k] - min) / (max - min)) * B)); (PREP.y[i] ? ha : hn)[b]++; (PREP.y[i] ? a : nn).push(vals[k]); });
    const tn = nn.length || 1, ta = a.length || 1;
    chart('histChart', { type: 'bar', data: { labels: hn.map((_, b) => (min + ((b + 0.5) * (max - min)) / B).toFixed(2)), datasets: [{ label: 'Normal', data: hn.map((v) => v / tn), backgroundColor: 'rgba(61,219,184,0.7)', borderRadius: 3 }, { label: 'Attack', data: ha.map((v) => v / ta), backgroundColor: 'rgba(255,93,108,0.7)', borderRadius: 3 }] }, options: { maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { title: { display: true, text: 'share of class' }, grid: { color: C.grid } } } } });
    const mw = NIDS.mannWhitney(nn, a); const m = MI.find((x) => x.j === j);
    $('mwOut').innerHTML = `<div><span>Mutual info</span><b>${m.mi.toFixed(3)} bits</b></div><div><span>Mann-Whitney U</span><b>${Math.round(mw.U).toLocaleString()}</b></div><div><span>z</span><b>${mw.z.toFixed(2)}</b></div><div><span>p-value</span><b class="${mw.p < 0.05 ? 'ok' : 'warn'}">${mw.p < 1e-4 ? '< 0.0001' : mw.p.toFixed(4)}</b></div><p class="mw-note">${mw.p < 0.05 ? 'Significant: normal and attack traffic differ on this feature by more than chance (p &lt; 0.05).' : 'Not significant: this feature alone does not separate normal from attack traffic.'}</p>`;
  }

  $('kFeat').addEventListener('input', (e) => ($('kFeatVal').textContent = e.target.value));
  $('aeThr').addEventListener('input', (e) => { $('aeThrVal').textContent = `p${e.target.value}`; if (RESULT) evaluate(); });
  $('fusion').addEventListener('change', () => RESULT && evaluate());

  const sleep = () => new Promise((r) => setTimeout(r, 30));
  $('trainBtn').addEventListener('click', async () => {
    if (!PREP) return; const btn = $('trainBtn'); btn.disabled = true;
    const status = $('trainStatus'); const prog = $('trainProg');
    const set = (t, p) => { status.textContent = t; prog.style.width = p + '%'; };
    const k = +$('kFeat').value; const feats = MI.slice(0, k).map((m) => m.j);
    const sub = (i) => Float64Array.from(feats, (j) => PREP.Z[i][j]);
    const Xtr = PREP.trainIdx.map(sub), ytr = PREP.trainIdx.map((i) => PREP.y[i]);
    const Xte = PREP.testIdx.map(sub), yte = PREP.testIdx.map((i) => PREP.y[i]);
    const t0 = performance.now();
    set('Training logistic regression…', 10); await sleep(); const lr = NIDS.trainLR(Xtr, ytr);
    set('Growing random forest (25 trees)…', 35); await sleep(); const rf = NIDS.trainRF(Xtr, ytr, +$('nTrees').value);
    const normIdx = PREP.trainIdx.filter((i) => PREP.y[i] === 0);
    if (normIdx.length < 10) { set('Autoencoder needs at least 10 normal training rows.', 100); btn.disabled = false; return; }
    // The autoencoder only ever sees normal traffic, so scale with normal-only statistics: deviations from "normal" become large inputs.
    const muN = feats.map((j) => normIdx.reduce((s, i) => s + PREP.X[i][j], 0) / normIdx.length);
    const sdN = feats.map((j, t) => Math.max(Math.sqrt(normIdx.reduce((s, i) => s + (PREP.X[i][j] - muN[t]) ** 2, 0) / normIdx.length), 0.1 * PREP.std[j], 1e-6));
    const aeIn = (i) => Float64Array.from(feats, (j, t) => Math.max(-6, Math.min(6, (PREP.X[i][j] - muN[t]) / sdN[t])));
    const normTr = normIdx.map(aeIn);
    set('Training autoencoder on normal traffic only…', 65); await sleep(); const ae = NIDS.trainAE(normTr, 40);
    set('Scoring the held-out test set…', 90); await sleep();
    RESULT = { feats, lr, rf, ae, Xte, yte, unseen: PREP.unseen, pLR: Xte.map(lr.predict), pRF: Xte.map(rf.predict), eAE: PREP.testIdx.map((i) => ae.error(aeIn(i))), eTrN: normTr.map(ae.error), ms: performance.now() - t0 };
    set(`Done in ${(RESULT.ms / 1000).toFixed(2)} s · ${k} features · ${Xtr.length} train / ${Xte.length} test rows`, 100);
    btn.disabled = false; $('trainOut').hidden = false; $('trainEmpty').hidden = true;
    evaluate(); renderLoss(); pickConnection();
  });

  function evaluate() {
    const R = RESULT; const thr = NIDS.percentile(R.eTrN, +$('aeThr').value); R.thr = thr;
    const yLR = R.pLR.map((p) => +(p >= 0.5)), yRF = R.pRF.map((p) => +(p >= 0.5)), yAE = R.eAE.map((e) => +(e > thr));
    const fusionAnd = $('fusion').value === 'and';
    const yHY = yRF.map((v, i) => +(fusionAnd ? v && yAE[i] : v || yAE[i]));
    R.preds = { 'Logistic Reg.': yLR, 'Random Forest': yRF, Autoencoder: yAE, Hybrid: yHY };
    R.m = Object.fromEntries(Object.entries(R.preds).map(([k, y]) => [k, NIDS.metrics(R.yte, y, R.unseen)]));
    const names = Object.keys(R.m); const hasUnseen = R.m.Hybrid.unseenTotal > 0;
    $('metricsBody').innerHTML = names.map((n) => { const m = R.m[n]; return `<tr${n === 'Hybrid' ? ' class="hl"' : ''}><th scope="row">${n}</th><td>${pct(m.accuracy)}</td><td>${pct(m.precision)}</td><td>${pct(m.recall)}</td><td>${m.f1.toFixed(3)}</td><td>${hasUnseen ? pct(m.unseenRecall) : 'n/a'}</td></tr>`; }).join('');
    const sets = [['Precision', 'precision', C.blue], ['Recall', 'recall', C.teal], ['F1', 'f1', C.amber]];
    if (hasUnseen) sets.push(['Unseen-attack recall', 'unseenRecall', C.red]);
    chart('cmpChart', { type: 'bar', data: { labels: names, datasets: sets.map(([l, k, c]) => ({ label: l, data: names.map((n) => +(R.m[n][k] * 100).toFixed(1)), backgroundColor: c, borderRadius: 4 })) }, options: { maintainAspectRatio: false, scales: { y: { max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: C.grid } }, x: { grid: { display: false } } } } });
    renderConfusion(); renderErrHist();
    $('unseenNote').hidden = !hasUnseen;
    if (hasUnseen) $('unseenNote').innerHTML = `<b>${R.m.Hybrid.unseenTotal}</b> test attacks belong to types never seen in training. Autoencoder catches <b>${pct(R.m.Autoencoder.unseenRecall)}</b> of them vs <b>${pct(R.m['Random Forest'].unseenRecall)}</b> for Random Forest${R.m.Autoencoder.unseenRecall > R.m['Random Forest'].unseenRecall ? ' — the same pattern reported on the real NSL-KDD test set.' : '. Try lowering the AE threshold percentile to trade precision for zero-day recall.'} Hybrid reaches <b>${pct(R.m.Hybrid.unseenRecall)}</b>.`;
  }
  const cmSel = $('cmModel'); cmSel.addEventListener('change', renderConfusion);
  function renderConfusion() {
    const m = RESULT.m[cmSel.value]; const tot = m.tp + m.fp + m.tn + m.fn;
    const cell = (v, cls, lbl) => `<div class="cm-cell ${cls}" style="--a:${(0.15 + 0.85 * (v / tot)).toFixed(2)}"><b>${v}</b><span>${lbl}</span></div>`;
    $('cm').innerHTML = `<div class="cm-h"></div><div class="cm-h">Pred. normal</div><div class="cm-h">Pred. attack</div><div class="cm-h side">Actual normal</div>${cell(m.tn, 'good', 'true negative')}${cell(m.fp, 'warn', 'false alarm')}<div class="cm-h side">Actual attack</div>${cell(m.fn, 'bad', 'missed attack')}${cell(m.tp, 'good', 'caught')}`;
  }
  function renderErrHist() {
    const R = RESULT; const all = R.eAE.map((e) => Math.log10(e + 1e-6)); const B = 30;
    const min = Math.min(...all), max = Math.max(...all) + 1e-9; const hn = new Array(B).fill(0), ha = new Array(B).fill(0);
    all.forEach((v, i) => { const b = Math.min(B - 1, Math.floor(((v - min) / (max - min)) * B)); (R.yte[i] ? ha : hn)[b]++; });
    const tb = Math.floor(((Math.log10(R.thr + 1e-6) - min) / (max - min)) * B);
    chart('errChart', { type: 'bar', data: { labels: hn.map((_, b) => (10 ** (min + ((b + 0.5) * (max - min)) / B)).toPrecision(2)), datasets: [{ label: 'Normal', data: hn, backgroundColor: hn.map((_, b) => (b > tb ? 'rgba(255,181,71,0.85)' : 'rgba(61,219,184,0.75)')), borderRadius: 2, stack: 's' }, { label: 'Attack', data: ha, backgroundColor: ha.map((_, b) => (b > tb ? 'rgba(255,93,108,0.9)' : 'rgba(255,93,108,0.35)')), borderRadius: 2, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { title: (it) => `error ≈ ${it[0].label}` } } }, scales: { x: { stacked: true, grid: { display: false }, title: { display: true, text: 'reconstruction error (log scale) · bars right of threshold are flagged' }, ticks: { maxTicksLimit: 7 } }, y: { stacked: true, grid: { color: C.grid } } } } });
    $('thrLabel').textContent = `threshold = ${R.thr.toPrecision(3)} (${$('aeThr').value}th pct. of normal training error)`;
  }
  function renderLoss() {
    chart('lossChart', { type: 'line', data: { labels: RESULT.ae.losses.map((_, i) => i + 1), datasets: [{ label: 'AE training loss (MSE)', data: RESULT.ae.losses, borderColor: C.teal, backgroundColor: 'rgba(61,219,184,0.15)', fill: true, tension: 0.35, pointRadius: 0 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'epoch' }, grid: { display: false } }, y: { grid: { color: C.grid } } } } });
  }

  $('pickConn').addEventListener('click', pickConnection);
  $('pickAttack').addEventListener('click', () => pickConnection(true));
  function pickConnection(wantAttack) {
    if (!RESULT) return; const R = RESULT; let k;
    const pool = R.yte.map((y, i) => i).filter((i) => (wantAttack === true ? R.yte[i] === 1 : true));
    k = pool[Math.floor(Math.random() * pool.length)];
    const rowIdx = PREP.testIdx[k]; const x = R.Xte[k];
    const verdict = (on) => `<span class="pill ${on ? 'pill-bad' : 'pill-ok'}">${on ? 'ATTACK' : 'normal'}</span>`;
    const contrib = R.feats.map((j, t) => ({ name: PREP.featNames[j], c: R.lr.w[t] * x[t], raw: PREP.X[rowIdx][j] })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 7);
    const maxC = Math.max(...contrib.map((c) => Math.abs(c.c))) || 1;
    $('connOut').innerHTML = `
      <div class="conn-head"><div><span class="muted">Ground truth</span><b class="${R.yte[k] ? 'txt-bad' : 'txt-ok'}">${esc(PREP.labels[rowIdx])}${R.unseen[k] ? ' · unseen type' : ''}</b></div>
      <div><span class="muted">LR p(attack)</span><b>${R.pLR[k].toFixed(3)}</b> ${verdict(R.preds['Logistic Reg.'][k])}</div>
      <div><span class="muted">RF vote</span><b>${R.pRF[k].toFixed(2)}</b> ${verdict(R.preds['Random Forest'][k])}</div>
      <div><span class="muted">AE error</span><b>${R.eAE[k].toPrecision(3)}</b> ${verdict(R.preds.Autoencoder[k])}</div>
      <div><span class="muted">Hybrid</span>${verdict(R.preds.Hybrid[k])}</div></div>
      <p class="muted small">Why the linear model decided this (exact SHAP values for a linear model on standardised features, φ<sub>i</sub> = w<sub>i</sub>·x<sub>i</sub>):</p>
      <ul class="shap">${contrib.map((c) => `<li><code>${esc(c.name)}</code><span class="shap-bar"><i class="${c.c > 0 ? 'pos' : 'neg'}" style="--w:${((Math.abs(c.c) / maxC) * 50).toFixed(1)}%"></i></span><em>${c.c > 0 ? '+' : ''}${c.c.toFixed(2)}</em><small>value ${+c.raw.toFixed(3)}</small></li>`).join('')}</ul>
      <p class="muted small"><span class="txt-bad">Red →</span> pushes toward “attack”, <span class="txt-ok">← teal</span> toward “normal”.</p>`;
  }

  // upload
  const drop = $('drop'), file = $('fileIn');
  async function handleFile(f) {
    if (!f) return; $('dsError').hidden = true;
    if (f.size > 25 * 1024 * 1024) { $('dsError').hidden = false; $('dsError').textContent = 'File is larger than 25 MB — please upload a sample.'; return; }
    try {
      const text = await f.text(); const p = NIDS.parseCSV(text);
      const splitCol = p.columns.find((c) => /^split$/i.test(c));
      loadDataset({ name: `${f.name} (${p.rows.length.toLocaleString()} rows${p.rows.length > 6000 ? ', 6,000 sampled' : ''})`, columns: p.columns, rows: p.rows, labelCol: NIDS.guessLabelCol(p.columns), splitCol, builtin: false });
      document.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.src === 'upload'));
    } catch (err) { $('dsError').hidden = false; $('dsError').textContent = 'Could not read CSV: ' + err.message; }
  }
  file.addEventListener('change', (e) => handleFile(e.target.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handleFile(e.dataTransfer.files[0]); });
  $('pasteBtn').addEventListener('click', () => { const t = $('pasteArea').value.trim(); if (!t) return; handleFile(new File([t], 'pasted.csv')); });
  document.querySelector('[data-src="builtin"]').addEventListener('click', (e) => { document.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', b === e.currentTarget)); loadDataset(NIDS.generateSample()); });
  document.querySelector('[data-src="upload"]').addEventListener('click', () => file.click());

  loadDataset(NIDS.generateSample());

  /* ---------------- Results from the mid review ---------------- */
  chart('reviewChart', {
    type: 'bar',
    data: { labels: ['Supervised (lowest)', 'Supervised (best)', 'Autoencoder'], datasets: [{ label: 'Recall on never-before-seen attacks (NSL-KDD test)', data: [27, 47, 78], backgroundColor: ['rgba(110,168,255,0.55)', C.blue, C.teal], borderRadius: 6 }] },
    options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: C.grid } }, y: { grid: { display: false } } } },
  });

  /* ---------------- Pipeline ---------------- */
  const STEPS = [
    { k: 'Data', t: 'NSL-KDD ingestion', d: '125,973 training and 22,544 test connection records, 41 features each. The test set deliberately contains 17 attack types absent from training, which makes it a real test of generalisation.', ref: 'Tavallaee et al., 2009' },
    { k: 'Clean', t: 'Pre-processing', d: 'One-hot encode protocol / service / flag, log-scale heavy-tailed byte counts, z-score normalise using training statistics only (no leakage from the test set).', ref: 'Arp et al., 2022 — pitfalls' },
    { k: 'Select', t: 'Mutual-information feature selection', d: 'Rank all 41 features by how much they reduce uncertainty about the label; keep the top-k. Fewer, stronger features → faster and more robust models.', ref: 'Ambusaidi et al., 2016' },
    { k: 'Known', t: 'Supervised track: LR · RF · XGBoost', d: 'Learn from labelled examples. Excellent at the attack families seen during training (DoS, Probe), weaker on rare R2L/U2R and on novel attacks.', ref: 'Farnaaz & Jabbar, 2016 · Chen & Guestrin, 2016' },
    { k: 'Unknown', t: 'Unsupervised track: Autoencoder', d: 'Trained only on normal traffic to compress and rebuild it. Anything that reconstructs poorly gets a high anomaly score — the safety net for zero-days.', ref: 'Xu et al., 2021 · Mirsky et al., 2018' },
    { k: 'Fuse', t: 'Fusion & alerting', d: 'OR-rule: alert when either track fires, maximising recall (a missed attack costs more than a false alarm). Threshold set as a percentile of normal reconstruction error.', ref: 'Project design' },
    { k: 'Explain', t: 'Explainability (next)', d: 'Per-alert SHAP explanations show analysts which features drove each decision — try it in the Lab with the “Inspect a connection” panel.', ref: 'Lundberg & Lee, 2017' },
  ];
  const pl = $('pipeline'), pd = $('pipeDetail');
  pl.innerHTML = STEPS.map((s, i) => `<button class="pipe-step" data-i="${i}" aria-pressed="${i === 0}"><span class="pipe-n">0${i + 1}</span><span class="pipe-k">${s.k}</span><span class="pipe-t">${s.t}</span></button>`).join('');
  function showStep(i) { const s = STEPS[i]; pd.classList.remove('swap'); void pd.offsetWidth; pd.classList.add('swap'); pd.innerHTML = `<span class="eyebrow">Stage 0${i + 1}</span><h3>${s.t}</h3><p>${s.d}</p><p class="cite">Grounded in: ${s.ref}</p>`; pl.querySelectorAll('.pipe-step').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.i === i)); }
  pl.addEventListener('click', (e) => { const b = e.target.closest('.pipe-step'); if (b) showStep(+b.dataset.i); });
  showStep(0);

  /* ---------------- Research frontier ---------------- */
  const PAPERS = [
    { tag: 'GNN', year: 2025, venue: 'NeurIPS 2025', title: 'GraphIDS — self-supervised graph representations for network intrusion detection', authors: 'Guerra, Chapuis, Duc, Mozharovskyi & Nguyen', idea: 'An inductive GNN embeds each flow with its local topology; a Transformer masked autoencoder reconstructs those embeddings. High reconstruction error = intrusion. Trained without attack labels.', why: 'Same philosophy as our autoencoder, but on the host-communication graph instead of isolated records — a natural upgrade path once we move to flow data.' },
    { tag: 'LLM', year: 2025, venue: 'arXiv survey', title: 'Large Language Models for Network Intrusion Detection Systems: Foundations, Implementations, and Future Directions', authors: 'Yang, Zheng, Zhang, Xu, Li, Xie, Long & Ngai', idea: 'Taxonomy of LLM roles in NIDS: as processors of raw traffic/logs, as detectors, and as reasoners that explain alerts and support analysts.', why: 'Suggests an LLM layer on top of our SHAP output to turn feature attributions into analyst-readable incident summaries.' },
    { tag: 'LLM', year: 2025, venue: 'arXiv review', title: 'Network Intrusion Detection: Evolution from Conventional Approaches to LLM Collaboration and Emerging Risks', authors: 'Feng & Sakurai', idea: 'Traces NIDS from signature rules to ML and LLM collaboration, and highlights new risks — prompt injection, hallucinated alerts, adversarial inputs.', why: 'Reminder that any LLM component must stay advisory; detection decisions remain with our measurable ML models.' },
    { tag: 'LLM', year: 2024, venue: 'IEEE Access 12', title: 'Revolutionizing Cyber Threat Detection with Large Language Models: A Privacy-Preserving BERT-Based Lightweight Model for IoT/IIoT Devices (SecurityBERT)', authors: 'Ferrag, Ndhlovu, Tihanyi, Cordeiro, Debbah, Lestable & Thandi', idea: 'Encodes network features as text tokens and fine-tunes a compact BERT, reaching high multi-class accuracy while fitting on edge hardware.', why: 'Shows transformer-based detectors can be small enough for a streaming (Kafka) deployment like the one on our roadmap.' },
    { tag: 'Data', year: 2024, venue: 'IEEE EuroS&P 2024', title: 'Bad Design Smells in Benchmark NIDS Datasets', authors: 'Flood, Engelen, Aspinall & Desmet', idea: 'Catalogues recurring flaws across popular NIDS datasets — unrealistic traffic, label leakage, poor diversity — that inflate reported accuracy.', why: 'Motivates our cross-dataset plan (NSL-KDD → CICIDS2017/2018) and reporting unseen-attack recall rather than headline accuracy.' },
    { tag: 'Data', year: 2023, venue: 'CRiSIS 2022 · LNCS 13857', title: 'Errors in the CICIDS2017 Dataset and the Significant Differences in Detection Performances It Makes', authors: 'Lanvin, Gimenez, Han, Majorczyk, Mé & Totel', idea: 'Identifies labelling and flow-extraction errors in CICIDS2017 and shows that correcting them significantly changes model rankings.', why: 'When we migrate to CICIDS2017 we should use a corrected release, not the original CSVs.' },
    { tag: 'Data', year: 2021, venue: 'IEEE SPW 2021', title: 'Troubleshooting an Intrusion Detection Dataset: the CICIDS2017 Case Study', authors: 'Engelen, Rimmer & Joosen', idea: 'Re-generates CICIDS2017 flows, fixing the CICFlowMeter bugs and mislabelled attacks; publishes an improved version.', why: 'Source for the cleaned dataset we intend to benchmark on next.' },
    { tag: 'Data', year: 2022, venue: 'Mobile Networks & Applications 27', title: 'Towards a Standard Feature Set for Network Intrusion Detection System Datasets (NF-v2)', authors: 'Sarhan, Layeghy & Portmann', idea: 'Proposes a common NetFlow-based feature set across UNSW-NB15, ToN-IoT, BoT-IoT and CSE-CIC-IDS2018 so models can be compared and transferred.', why: 'A standard feature space would let our pipeline train on one dataset and test on another — the strongest generalisation test.' },
    { tag: 'Data', year: 2023, venue: 'Sensors 23(13)', title: 'CICIoT2023: A Real-Time Dataset and Benchmark for Large-Scale Attacks in IoT Environment', authors: 'Neto, Dadkhah, Ferreira, Zohourian, Lu & Ghorbani', idea: '33 attacks executed on a 105-device IoT topology, covering DDoS, recon, web-based, brute force, spoofing and Mirai.', why: 'Modern IoT attack mix — a candidate third benchmark after CICIDS.' },
    { tag: 'GNN', year: 2022, venue: 'IEEE/IFIP NOMS 2022', title: 'E-GraphSAGE: A Graph Neural Network based Intrusion Detection System for IoT', authors: 'Lo, Layeghy, Sarhan, Gallagher & Portmann', idea: 'Treats flows as edges between IP endpoints and learns edge embeddings, capturing who-talks-to-whom patterns that per-record models miss.', why: 'Topology features would help exactly where our record-based models struggle: slow, distributed probes.' },
    { tag: 'FL', year: 2022, venue: 'Computer Networks 203', title: 'Evaluating Federated Learning for Intrusion Detection in Internet of Things: Review and Challenges', authors: 'Campos, Saura, González, Hernández Ramos, Bernal Bernabé, Baldini & Skarmeta', idea: 'Organisations train locally and only share model weights; analyses the impact of non-IID data across clients on detection quality.', why: 'Path to training our autoencoder across several campus networks without moving raw traffic.' },
    { tag: 'Eval', year: 2022, venue: 'USENIX Security 2022', title: 'Dos and Don’ts of Machine Learning in Computer Security', authors: 'Arp, Quiring, Pendlebury, Warnecke, Pierazzi, Wressnegger, Cavallaro & Rieck', idea: 'Identifies ten pitfalls — sampling bias, data snooping, spurious correlations, base-rate fallacy — present in a large share of security-ML papers.', why: 'Our checklist: train-only normalisation, held-out unseen attacks, reporting precision under realistic base rates.' },
    { tag: 'XAI', year: 2017, venue: 'NeurIPS 2017', title: 'A Unified Approach to Interpreting Model Predictions (SHAP)', authors: 'Lundberg & Lee', idea: 'Shapley-value feature attributions with consistency guarantees; exact and fast for linear and tree models.', why: 'Planned per-alert explanations — already previewed in the Lab for the linear model.' },
    { tag: 'AE', year: 2018, venue: 'NDSS 2018', title: 'Kitsune: An Ensemble of Autoencoders for Online Network Intrusion Detection', authors: 'Mirsky, Doitshman, Elovici & Shabtai', idea: 'Lightweight ensemble of small autoencoders updated online from packet statistics, running in real time on a Raspberry Pi.', why: 'Blueprint for the streaming version of our unsupervised track.' },
  ];
  const tags = ['All', ...new Set(PAPERS.map((p) => p.tag))];
  const tagNames = { GNN: 'Graph neural nets', LLM: 'LLMs', Data: 'Datasets', FL: 'Federated', Eval: 'Evaluation', XAI: 'Explainability', AE: 'Autoencoders' };
  $('paperFilters').innerHTML = tags.map((t, i) => `<button class="chip" data-tag="${t}" aria-pressed="${i === 0}">${tagNames[t] || t}</button>`).join('');
  function renderPapers(tag) {
    const list = PAPERS.filter((p) => tag === 'All' || p.tag === tag).sort((a, b) => b.year - a.year);
    $('papers').innerHTML = list.map((p, i) => `<article class="paper" style="animation-delay:${i * 50}ms"><header><span class="tag tag-${p.tag}">${tagNames[p.tag]}</span><span class="yr">${p.year}${p.year >= 2024 ? ' <i>new</i>' : ''}</span></header><h3>${esc(p.title)}</h3><p class="auth">${esc(p.authors)} · <em>${esc(p.venue)}</em></p><p>${esc(p.idea)}</p><details><summary>Relevance to our NIDS</summary><p>${esc(p.why)}</p></details></article>`).join('');
  }
  $('paperFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-tag]'); if (!b) return; $('paperFilters').querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderPapers(b.dataset.tag); });
  renderPapers('All');

  /* ---------------- References ---------------- */
  const REFS = [
    ['core', 'Tavallaee, M., Bagheri, E., Lu, W., & Ghorbani, A. A. (2009). A detailed analysis of the KDD CUP 99 data set. IEEE Symposium on Computational Intelligence for Security and Defense Applications (CISDA), 1–6.'],
    ['core', 'Ambusaidi, M. A., He, X., Nanda, P., & Tan, Z. (2016). Building an intrusion detection system using a filter-based feature selection algorithm. IEEE Transactions on Computers, 65(10), 2986–2998.'],
    ['core', 'Farnaaz, N., & Jabbar, M. A. (2016). Random forest modeling for network intrusion detection system. Procedia Computer Science, 89, 213–217.'],
    ['core', 'Chen, T., & Guestrin, C. (2016). XGBoost: A scalable tree boosting system. Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining, 785–794.'],
    ['core', 'Xu, W., Jang-Jaccard, J., Singh, A., Wei, Y., & Sabrina, F. (2021). Improving performance of autoencoder-based network anomaly detection on NSL-KDD dataset. IEEE Access, 9, 140136–140146.'],
    ['recent', 'Guerra, L., Chapuis, T., Duc, G., Mozharovskyi, P., & Nguyen, V.-T. (2025). GraphIDS: Self-supervised learning of graph representations for network intrusion detection. Advances in Neural Information Processing Systems (NeurIPS 2025).'],
    ['recent', 'Yang, S., Zheng, X., Zhang, X., Xu, J., Li, J., Xie, D., Long, W., & Ngai, E. C. H. (2025). Large language models for network intrusion detection systems: Foundations, implementations, and future directions. arXiv preprint.'],
    ['recent', 'Feng, Y., & Sakurai, K. (2025). Network intrusion detection: Evolution from conventional approaches to LLM collaboration and emerging risks. arXiv preprint.'],
    ['recent', 'Ferrag, M. A., Ndhlovu, M., Tihanyi, N., Cordeiro, L. C., Debbah, M., Lestable, T., & Thandi, N. S. (2024). Revolutionizing cyber threat detection with large language models: A privacy-preserving BERT-based lightweight model for IoT/IIoT devices. IEEE Access, 12.'],
    ['recent', 'Flood, R., Engelen, G., Aspinall, D., & Desmet, L. (2024). Bad design smells in benchmark NIDS datasets. IEEE 9th European Symposium on Security and Privacy (EuroS&P).'],
    ['recent', 'Lanvin, M., Gimenez, P.-F., Han, Y., Majorczyk, F., Mé, L., & Totel, É. (2023). Errors in the CICIDS2017 dataset and the significant differences in detection performances it makes. CRiSIS 2022, LNCS 13857, Springer.'],
    ['recent', 'Neto, E. C. P., Dadkhah, S., Ferreira, R., Zohourian, A., Lu, R., & Ghorbani, A. A. (2023). CICIoT2023: A real-time dataset and benchmark for large-scale attacks in IoT environment. Sensors, 23(13), 5941.'],
    ['recent', 'Arp, D., Quiring, E., Pendlebury, F., Warnecke, A., Pierazzi, F., Wressnegger, C., Cavallaro, L., & Rieck, K. (2022). Dos and don’ts of machine learning in computer security. 31st USENIX Security Symposium, 3971–3988.'],
    ['recent', 'Sarhan, M., Layeghy, S., & Portmann, M. (2022). Towards a standard feature set for network intrusion detection system datasets. Mobile Networks and Applications, 27, 357–370.'],
    ['recent', 'Lo, W. W., Layeghy, S., Sarhan, M., Gallagher, M., & Portmann, M. (2022). E-GraphSAGE: A graph neural network based intrusion detection system for IoT. IEEE/IFIP Network Operations and Management Symposium (NOMS).'],
    ['recent', 'Campos, E. M., Saura, P. F., González-Vidal, A., Hernández-Ramos, J. L., Bernal Bernabé, J., Baldini, G., & Skarmeta, A. (2022). Evaluating federated learning for intrusion detection in Internet of Things: Review and challenges. Computer Networks, 203, 108661.'],
    ['recent', 'Engelen, G., Rimmer, V., & Joosen, W. (2021). Troubleshooting an intrusion detection dataset: the CICIDS2017 case study. IEEE Security and Privacy Workshops (SPW), 7–12.'],
    ['found', 'Sharafaldin, I., Lashkari, A. H., & Ghorbani, A. A. (2018). Toward generating a new intrusion detection dataset and intrusion traffic characterization. Proceedings of ICISSP, 108–116.'],
    ['found', 'Mirsky, Y., Doitshman, T., Elovici, Y., & Shabtai, A. (2018). Kitsune: An ensemble of autoencoders for online network intrusion detection. Network and Distributed System Security Symposium (NDSS).'],
    ['found', 'Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions. Advances in Neural Information Processing Systems 30 (NeurIPS).'],
  ];
  const refGroups = { core: 'Core project references (from the review deck)', recent: 'Recent research, 2021–2025', found: 'Foundational methods & datasets' };
  $('refs').innerHTML = Object.entries(refGroups).map(([g, title]) => `<div class="ref-group"><h3>${title}</h3><ol>${REFS.filter((r) => r[0] === g).map((r) => `<li><span>${esc(r[1])}</span><button class="copy" aria-label="Copy citation">Copy</button></li>`).join('')}</ol></div>`).join('');
  $('refs').addEventListener('click', async (e) => {
    const b = e.target.closest('.copy'); if (!b) return; const txt = b.previousElementSibling.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied'; } catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; }
    setTimeout(() => (b.textContent = 'Copy'), 1400);
  });
})();
