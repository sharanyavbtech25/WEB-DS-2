/* NIDS Lab — dataset generator, CSV parsing, preprocessing and in-browser models */
(function (global) {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Built-in NSL-KDD-style sample ---------------- */
  function generateSample(seed = 1337) {
    const R = mulberry32(seed);
    const g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const c = (x) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;
    const ri = (a, b) => Math.floor(a + R() * (b - a + 1));
    const logn = (mu, s) => Math.max(0, Math.round(Math.exp(mu + s * g())));
    const pick = (arr, w) => { let r = R() * w.reduce((s, x) => s + x, 0); for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };

    const normal = () => ({
      duration: R() < 0.85 ? 0 : logn(4, 1.5),
      protocol_type: pick(['tcp', 'udp', 'icmp'], [0.8, 0.15, 0.05]),
      service: pick(['http', 'smtp', 'ftp_data', 'domain_u', 'private', 'telnet', 'other'], [0.5, 0.12, 0.1, 0.12, 0.06, 0.02, 0.08]),
      flag: pick(['SF', 'S0', 'REJ', 'RSTO'], [0.93, 0.02, 0.04, 0.01]),
      src_bytes: logn(5.5, 1.2), dst_bytes: logn(7, 1.8),
      logged_in: R() < 0.7 ? 1 : 0, num_failed_logins: 0, root_shell: 0,
      count: ri(1, 14), srv_count: ri(1, 16),
      serror_rate: c(R() * 0.05), rerror_rate: c(R() * 0.06),
      same_srv_rate: c(0.92 + g() * 0.07), diff_srv_rate: c(R() * 0.08),
      dst_host_count: ri(20, 255), dst_host_srv_count: ri(90, 255),
    });

    const A = {
      neptune: { cls: 'dos', f: (r) => Object.assign(r, { duration: 0, protocol_type: 'tcp', service: pick(['private', 'other', 'http', 'telnet'], [0.7, 0.15, 0.1, 0.05]), flag: 'S0', src_bytes: 0, dst_bytes: 0, logged_in: 0, count: ri(100, 511), srv_count: ri(1, 25), serror_rate: c(0.96 + g() * 0.04), same_srv_rate: c(0.06 + g() * 0.04), diff_srv_rate: c(0.07 + g() * 0.03), dst_host_count: 255, dst_host_srv_count: ri(1, 25) }) },
      smurf: { cls: 'dos', f: (r) => Object.assign(r, { duration: 0, protocol_type: 'icmp', service: 'ecr_i', flag: 'SF', src_bytes: pick([1032, 520], [0.8, 0.2]), dst_bytes: 0, logged_in: 0, count: ri(480, 511), srv_count: ri(480, 511), same_srv_rate: 1, dst_host_count: 255, dst_host_srv_count: 255 }) },
      apache2: { cls: 'dos', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'http', flag: pick(['SF', 'RSTO'], [0.6, 0.4]), src_bytes: logn(8.2, 0.6), dst_bytes: logn(3, 1), duration: ri(0, 4), count: ri(20, 90), srv_count: ri(20, 90), rerror_rate: c(0.25 + g() * 0.15), same_srv_rate: c(0.95), dst_host_srv_count: ri(150, 255) }) },
      processtable: { cls: 'dos', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: pick(['http', 'smtp', 'other'], [0.5, 0.2, 0.3]), flag: 'SF', duration: logn(7.2, 0.5), src_bytes: logn(2, 1), dst_bytes: logn(1.5, 1), logged_in: 0, count: ri(8, 40), srv_count: ri(6, 30) }) },
      portsweep: { cls: 'probe', f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'private', flag: pick(['REJ', 'RSTO'], [0.5, 0.5]), src_bytes: R() < 0.8 ? 0 : ri(1, 30), dst_bytes: 0, logged_in: 0, count: ri(1, 6), srv_count: ri(1, 6), rerror_rate: c(0.75 + g() * 0.15), same_srv_rate: c(0.3 + g() * 0.2), diff_srv_rate: c(0.6 + g() * 0.2), dst_host_count: ri(1, 40), dst_host_srv_count: ri(1, 20) }) },
      satan: { cls: 'probe', f: (r) => Object.assign(r, { protocol_type: 'tcp', service: pick(['private', 'other', 'telnet'], [0.6, 0.3, 0.1]), flag: 'REJ', src_bytes: 0, dst_bytes: 0, logged_in: 0, count: ri(60, 300), srv_count: ri(1, 10), rerror_rate: c(0.85 + g() * 0.1), same_srv_rate: c(0.05 + g() * 0.05), diff_srv_rate: c(0.7 + g() * 0.15), dst_host_count: 255, dst_host_srv_count: ri(1, 15) }) },
      mscan: { cls: 'probe', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: pick(['private', 'other', 'http', 'smtp', 'telnet'], [0.3, 0.3, 0.15, 0.15, 0.1]), flag: pick(['S0', 'REJ', 'SF'], [0.4, 0.35, 0.25]), src_bytes: ri(0, 40), dst_bytes: 0, logged_in: 0, count: ri(8, 40), srv_count: ri(1, 8), serror_rate: c(0.4 + g() * 0.2), rerror_rate: c(0.35 + g() * 0.2), same_srv_rate: c(0.25 + g() * 0.15), diff_srv_rate: c(0.45 + g() * 0.15), dst_host_count: 255, dst_host_srv_count: ri(5, 60) }) },
      saint: { cls: 'probe', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: pick(['private', 'other'], [0.7, 0.3]), flag: pick(['REJ', 'SF'], [0.6, 0.4]), src_bytes: ri(0, 10), dst_bytes: 0, logged_in: 0, count: ri(30, 150), srv_count: ri(1, 10), rerror_rate: c(0.6 + g() * 0.15), same_srv_rate: c(0.1 + g() * 0.08), diff_srv_rate: c(0.55 + g() * 0.15), dst_host_count: 255, dst_host_srv_count: ri(1, 30) }) },
      guess_passwd: { cls: 'r2l', f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'telnet', flag: pick(['SF', 'RSTO'], [0.6, 0.4]), duration: ri(2, 6), src_bytes: ri(110, 140), dst_bytes: ri(170, 200), logged_in: 0, num_failed_logins: 1, count: ri(1, 3), srv_count: ri(1, 3), dst_host_count: ri(1, 30), dst_host_srv_count: ri(1, 30) }) },
      warezclient: { cls: 'r2l', f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'ftp_data', flag: 'SF', duration: logn(5, 1), src_bytes: logn(9.5, 0.8), dst_bytes: 0, logged_in: 1, count: ri(1, 4), srv_count: ri(1, 4), dst_host_count: ri(1, 50), dst_host_srv_count: ri(1, 40) }) },
      snmpgetattack: { cls: 'r2l', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'udp', service: 'snmp', flag: 'SF', duration: 0, src_bytes: ri(100, 110), dst_bytes: ri(100, 110), logged_in: 0, count: ri(1, 6), srv_count: ri(1, 6) }) },
      httptunnel: { cls: 'r2l', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'http', flag: 'SF', duration: logn(6.5, 0.8), src_bytes: logn(6.5, 1), dst_bytes: logn(6, 1), logged_in: 1, count: ri(1, 3), srv_count: ri(1, 3), dst_host_count: ri(1, 10), dst_host_srv_count: ri(1, 10) }) },
      buffer_overflow: { cls: 'u2r', f: (r) => Object.assign(r, { protocol_type: 'tcp', service: pick(['telnet', 'ftp_data'], [0.8, 0.2]), flag: 'SF', duration: logn(5, 1), src_bytes: logn(7, 1), dst_bytes: logn(8, 1), logged_in: 1, root_shell: 1, count: 1, srv_count: 1, dst_host_count: ri(1, 30), dst_host_srv_count: ri(1, 30) }) },
      rootkit: { cls: 'u2r', f: (r) => Object.assign(r, { protocol_type: pick(['tcp', 'udp'], [0.7, 0.3]), service: pick(['telnet', 'other'], [0.6, 0.4]), flag: 'SF', duration: logn(4, 1.4), src_bytes: logn(5.5, 1.5), logged_in: 1, root_shell: R() < 0.7 ? 1 : 0, count: 1, srv_count: 1, dst_host_count: ri(1, 20), dst_host_srv_count: ri(1, 10) }) },
      ps: { cls: 'u2r', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'telnet', flag: 'SF', duration: logn(5.5, 0.7), src_bytes: logn(7.5, 0.5), dst_bytes: logn(8.5, 0.5), logged_in: 1, root_shell: R() < 0.5 ? 1 : 0, count: 1, srv_count: 1, dst_host_count: ri(1, 5), dst_host_srv_count: ri(1, 5) }) },
      sqlattack: { cls: 'u2r', unseen: true, f: (r) => Object.assign(r, { protocol_type: 'tcp', service: 'telnet', flag: 'SF', duration: logn(5, 0.6), src_bytes: logn(6.5, 0.6), dst_bytes: logn(7.8, 0.6), logged_in: 1, root_shell: 1, count: 1, srv_count: 1 }) },
    };

    const trainMix = { normal: 800, neptune: 330, smurf: 160, portsweep: 50, satan: 60, guess_passwd: 25, warezclient: 30, buffer_overflow: 10, rootkit: 6 };
    const testMix = { normal: 300, neptune: 80, smurf: 30, apache2: 40, processtable: 25, portsweep: 15, satan: 15, mscan: 30, saint: 15, guess_passwd: 30, warezclient: 5, snmpgetattack: 30, httptunnel: 15, buffer_overflow: 8, ps: 8, sqlattack: 4 };
    const rows = [];
    const build = (mix, split) => {
      for (const [name, n] of Object.entries(mix)) {
        for (let i = 0; i < n; i++) {
          const r = normal();
          if (name !== 'normal') A[name].f(r);
          r.label = name;
          r.category = name === 'normal' ? 'normal' : A[name].cls;
          r.split = split;
          rows.push(r);
        }
      }
    };
    build(trainMix, 'train');
    build(testMix, 'test');
    for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    const columns = Object.keys(rows[0]);
    return { name: 'NSL-KDD-style sample (built-in)', columns, rows: rows.map((r) => columns.map((k) => String(r[k]))), labelCol: 'label', categoryCol: 'category', splitCol: 'split', builtin: true };
  }

  /* ---------------- CSV ---------------- */
  function parseCSV(text) {
    const out = []; let row = []; let field = ''; let q = false;
    const delim = (() => { const first = text.split(/\r?\n/, 1)[0] || ''; const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length]); counts.sort((a, b) => b[1] - a[1]); return counts[0][0]; })();
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') out.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); out.push(row); }
    if (out.length < 2) throw new Error('CSV needs a header row and at least one data row.');
    let header = out[0].map((h, i) => (h.trim() || `col_${i}`));
    const looksNumeric = header.filter((h) => !isNaN(parseFloat(h))).length > header.length / 2;
    let body = out.slice(1);
    if (looksNumeric) { body = out; header = header.map((_, i) => (i === header.length - 1 ? 'label' : `f${i}`)); }
    body = body.filter((r) => r.length === header.length);
    if (!body.length) throw new Error('No rows match the header column count.');
    return { columns: header, rows: body.map((r) => r.map((v) => v.trim())) };
  }

  function guessLabelCol(columns) {
    const pref = ['label', 'class', 'attack', 'attack_cat', 'target', 'y', 'category', 'outcome'];
    for (const p of pref) { const i = columns.findIndex((c) => c.trim().toLowerCase() === p); if (i >= 0) return columns[i]; }
    return columns[columns.length - 1];
  }

  const isNormalValue = (v) => /^(normal|benign|0|0\.0|false|legit|legitimate|no|none|good)$/i.test(String(v).trim());

  /* ---------------- Preprocess ---------------- */
  function prepare(ds, opts) {
    const MAX_ROWS = 6000;
    const R = mulberry32(7);
    let rows = ds.rows;
    if (rows.length > MAX_ROWS) { rows = rows.slice(); for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; } rows = rows.slice(0, MAX_ROWS); }
    const ci = (name) => ds.columns.indexOf(name);
    const li = ci(opts.labelCol);
    const si = ds.splitCol ? ci(ds.splitCol) : -1;
    const exclude = new Set([opts.labelCol, ds.splitCol, ds.categoryCol].filter(Boolean));
    const y = rows.map((r) => (isNormalValue(r[li]) ? 0 : 1));
    const labels = rows.map((r) => r[li]);

    let isTrain;
    if (si >= 0) isTrain = rows.map((r) => /train/i.test(r[si]));
    else {
      isTrain = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) isTrain[i] = R() < 0.7;
    }

    const featNames = []; const cols = [];
    for (let c = 0; c < ds.columns.length; c++) {
      const name = ds.columns[c];
      if (exclude.has(name)) continue;
      const vals = rows.map((r) => r[c]);
      const nonEmpty = vals.filter((v) => v !== '' && v != null);
      const numCount = nonEmpty.filter((v) => isFinite(Number(v))).length;
      if (nonEmpty.length && numCount / nonEmpty.length >= 0.95) {
        const nums = vals.map((v) => (v === '' || !isFinite(Number(v)) ? NaN : Number(v)));
        const sorted = nums.filter((v) => !isNaN(v)).sort((a, b) => a - b);
        const med = sorted[Math.floor(sorted.length / 2)] || 0;
        const min = sorted[0], max = sorted[sorted.length - 1];
        if (min === max) continue;
        const useLog = min >= 0 && max > 1000;
        featNames.push(useLog ? `log(${name})` : name);
        cols.push({ raw: name, values: nums.map((v) => { const x = isNaN(v) ? med : v; return useLog ? Math.log1p(x) : x; }) });
      } else {
        const freq = {};
        for (const v of vals) freq[v] = (freq[v] || 0) + 1;
        const uniq = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
        if (uniq.length <= 1) continue;
        if (uniq.length <= 10) {
          for (const u of uniq.slice(0, uniq.length === 2 ? 1 : uniq.length)) { featNames.push(`${name}=${u}`); cols.push({ raw: name, values: vals.map((v) => (v === u ? 1 : 0)) }); }
        } else {
          featNames.push(`freq(${name})`);
          cols.push({ raw: name, values: vals.map((v) => freq[v] / vals.length) });
        }
      }
    }
    if (!cols.length) throw new Error('No usable feature columns found.');
    const n = rows.length, d = cols.length;
    const X = []; for (let i = 0; i < n; i++) { const row = new Float64Array(d); for (let j = 0; j < d; j++) row[j] = cols[j].values[i]; X.push(row); }

    const trainIdx = [], testIdx = [];
    for (let i = 0; i < n; i++) (isTrain[i] ? trainIdx : testIdx).push(i);
    if (!testIdx.length || !trainIdx.length) throw new Error('Could not form both a training and a test split.');
    const mean = new Float64Array(d), std = new Float64Array(d);
    for (const i of trainIdx) for (let j = 0; j < d; j++) mean[j] += X[i][j];
    for (let j = 0; j < d; j++) mean[j] /= trainIdx.length;
    for (const i of trainIdx) for (let j = 0; j < d; j++) std[j] += (X[i][j] - mean[j]) ** 2;
    for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / trainIdx.length) || 1;
    const Z = X.map((r) => { const z = new Float64Array(d); for (let j = 0; j < d; j++) z[j] = Math.max(-6, Math.min(6, (r[j] - mean[j]) / std[j])); return z; });

    const trainLabels = new Set(trainIdx.map((i) => labels[i]));
    const unseen = testIdx.map((i) => y[i] === 1 && !trainLabels.has(labels[i]));
    return { featNames, X, Z, y, labels, trainIdx, testIdx, unseen, d, n, mean, std };
  }

  /* ---------------- Mutual information ---------------- */
  function mutualInfo(P) {
    const res = [];
    const idx = P.trainIdx;
    for (let j = 0; j < P.d; j++) {
      const vals = idx.map((i) => P.X[i][j]);
      const sorted = vals.slice().sort((a, b) => a - b);
      const edges = []; for (let b = 1; b < 10; b++) edges.push(sorted[Math.floor((b * sorted.length) / 10)]);
      const uniqEdges = [...new Set(edges)];
      const bin = (v) => { let k = 0; while (k < uniqEdges.length && v > uniqEdges[k]) k++; return k; };
      const joint = {}; const px = {}; let py1 = 0;
      idx.forEach((i, t) => { const b = bin(vals[t]); const yy = P.y[i]; joint[b + '_' + yy] = (joint[b + '_' + yy] || 0) + 1; px[b] = (px[b] || 0) + 1; py1 += yy; });
      const N = idx.length; const py = [1 - py1 / N, py1 / N];
      let mi = 0;
      for (const key in joint) { const [b, yy] = key.split('_'); const pxy = joint[key] / N; mi += pxy * Math.log2(pxy / ((px[b] / N) * py[+yy])); }
      res.push({ j, name: P.featNames[j], mi: Math.max(0, mi) });
    }
    return res.sort((a, b) => b.mi - a.mi);
  }

  /* ---------------- Mann-Whitney U ---------------- */
  function mannWhitney(a, b) {
    const all = a.map((v) => [v, 0]).concat(b.map((v) => [v, 1])).sort((p, q) => p[0] - q[0]);
    const ranks = new Array(all.length); let tieSum = 0;
    for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++; const r = (i + j + 2) / 2; const t = j - i + 1; tieSum += t * t * t - t; for (let k = i; k <= j; k++) ranks[k] = r; i = j + 1; }
    let R1 = 0; all.forEach((p, i) => { if (p[1] === 0) R1 += ranks[i]; });
    const n1 = a.length, n2 = b.length, N = n1 + n2;
    const U1 = R1 - (n1 * (n1 + 1)) / 2; const U = Math.min(U1, n1 * n2 - U1);
    const mu = (n1 * n2) / 2; const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieSum / (N * (N - 1))));
    const z = sigma ? (U - mu) / sigma : 0;
    const p = 2 * (1 - normCdf(Math.abs(z)));
    return { U, z, p, effect: 1 - (2 * U) / (n1 * n2) };
  }
  function normCdf(x) { const t = 1 / (1 + 0.2316419 * x); const dd = 0.3989423 * Math.exp((-x * x) / 2); const p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return 1 - p; }

  /* ---------------- Models ---------------- */
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  function trainLR(Xs, y, iters = 300, lr = 0.5, l2 = 1e-3) {
    const n = Xs.length, d = Xs[0].length; const w = new Float64Array(d); let b = 0;
    for (let it = 0; it < iters; it++) {
      const gw = new Float64Array(d); let gb = 0;
      for (let i = 0; i < n; i++) { const x = Xs[i]; let z = b; for (let j = 0; j < d; j++) z += w[j] * x[j]; const e = sigmoid(z) - y[i]; gb += e; for (let j = 0; j < d; j++) gw[j] += e * x[j]; }
      for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
      b -= (lr * gb) / n;
    }
    return { w, b, predict: (x) => { let z = b; for (let j = 0; j < d; j++) z += w[j] * x[j]; return sigmoid(z); } };
  }

  function trainRF(Xs, y, nTrees = 25, maxDepth = 8, seed = 11) {
    const R = mulberry32(seed); const n = Xs.length, d = Xs[0].length; const mtry = Math.max(2, Math.round(Math.sqrt(d)));
    const importance = new Float64Array(d);
    function build(idx, depth) {
      let pos = 0; for (const i of idx) pos += y[i];
      const m = idx.length; const p = pos / m;
      if (depth >= maxDepth || m <= 4 || pos === 0 || pos === m) return { p };
      const parentG = 1 - p * p - (1 - p) * (1 - p);
      let best = null;
      for (let k = 0; k < mtry; k++) {
        const f = Math.floor(R() * d);
        for (let c = 0; c < 8; c++) {
          const t = Xs[idx[Math.floor(R() * m)]][f];
          let ln = 0, lp = 0;
          for (const i of idx) if (Xs[i][f] <= t) { ln++; lp += y[i]; }
          const rn = m - ln; if (!ln || !rn) continue;
          const rp = pos - lp; const pl = lp / ln, pr = rp / rn;
          const gini = (ln / m) * (1 - pl * pl - (1 - pl) ** 2) + (rn / m) * (1 - pr * pr - (1 - pr) ** 2);
          if (!best || gini < best.g) best = { f, t, g: gini };
        }
      }
      if (!best || best.g >= parentG - 1e-9) return { p };
      importance[best.f] += (parentG - best.g) * m;
      const L = [], Rr = []; for (const i of idx) (Xs[i][best.f] <= best.t ? L : Rr).push(i);
      return { f: best.f, t: best.t, l: build(L, depth + 1), r: build(Rr, depth + 1) };
    }
    const trees = [];
    for (let k = 0; k < nTrees; k++) { const boot = new Array(n); for (let i = 0; i < n; i++) boot[i] = Math.floor(R() * n); trees.push(build(boot, 0)); }
    const walk = (node, x) => { while (node.f !== undefined) node = x[node.f] <= node.t ? node.l : node.r; return node.p; };
    const tot = importance.reduce((s, v) => s + v, 0) || 1;
    return { importance: Array.from(importance, (v) => v / tot), predict: (x) => { let s = 0; for (const t of trees) s += walk(t, x); return s / trees.length; } };
  }

  function trainAE(Xs, epochs = 40, seed = 5) {
    const R = mulberry32(seed); const d = Xs[0].length; const h = Math.max(3, Math.round(d / 3));
    const W1 = Array.from({ length: h }, () => Float64Array.from({ length: d }, () => (R() - 0.5) * 0.4));
    const b1 = new Float64Array(h);
    const W2 = Array.from({ length: d }, () => Float64Array.from({ length: h }, () => (R() - 0.5) * 0.4));
    const b2 = new Float64Array(d);
    const hid = new Float64Array(h), out = new Float64Array(d), dh = new Float64Array(h), dOut = new Float64Array(d);
    const forward = (x) => {
      for (let k = 0; k < h; k++) { let z = b1[k]; const w = W1[k]; for (let j = 0; j < d; j++) z += w[j] * x[j]; hid[k] = Math.tanh(z); }
      for (let j = 0; j < d; j++) { let z = b2[j]; const w = W2[j]; for (let k = 0; k < h; k++) z += w[k] * hid[k]; out[j] = z; }
    };
    const order = Xs.map((_, i) => i); const losses = [];
    for (let ep = 0; ep < epochs; ep++) {
      const lr = 0.01 * (1 - ep / (epochs * 1.4));
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let loss = 0;
      for (const i of order) {
        const x = Xs[i]; forward(x);
        for (let j = 0; j < d; j++) { dOut[j] = (out[j] - x[j]) * 2 / d; loss += (out[j] - x[j]) ** 2 / d; }
        dh.fill(0);
        for (let j = 0; j < d; j++) { const w = W2[j]; const g = dOut[j]; for (let k = 0; k < h; k++) { dh[k] += g * w[k]; w[k] -= lr * g * hid[k]; } b2[j] -= lr * g; }
        for (let k = 0; k < h; k++) { const g = dh[k] * (1 - hid[k] * hid[k]); const w = W1[k]; for (let j = 0; j < d; j++) w[j] -= lr * g * x[j]; b1[k] -= lr * g; }
      }
      losses.push(loss / order.length);
    }
    return { hidden: h, losses, error: (x) => { forward(x); let e = 0; for (let j = 0; j < d; j++) e += (out[j] - x[j]) ** 2; return e / d; } };
  }

  function metrics(yTrue, yPred, unseenMask) {
    let tp = 0, fp = 0, tn = 0, fn = 0, ut = 0, uc = 0;
    for (let i = 0; i < yTrue.length; i++) {
      const t = yTrue[i], p = yPred[i];
      if (t && p) tp++; else if (!t && p) fp++; else if (!t && !p) tn++; else fn++;
      if (unseenMask && unseenMask[i]) { ut++; if (p) uc++; }
    }
    const precision = tp + fp ? tp / (tp + fp) : 0; const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { tp, fp, tn, fn, precision, recall, f1, accuracy: (tp + tn) / yTrue.length, unseenRecall: ut ? uc / ut : null, unseenTotal: ut };
  }

  function percentile(arr, p) { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * s.length)))]; }

  global.NIDS = { generateSample, parseCSV, guessLabelCol, isNormalValue, prepare, mutualInfo, mannWhitney, trainLR, trainRF, trainAE, metrics, percentile, mulberry32 };
})(window);
