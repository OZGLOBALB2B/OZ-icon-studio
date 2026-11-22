/* Icon Studio — transitions between two icons (slide, scale, morph). Builds on IconGeo. No DOM needed. */
(function (G) {
  'use strict';
  const IG = G.IconGeo, U = IG.util, { f, esc, clamp, eOut, eInOut, eBack } = U;

  const TRANS = [
    { id: 'slide', he: 'החלקה', en: 'Slide' },
    { id: 'scale', he: 'שינוי גודל', en: 'Scale' },
    { id: 'morph', he: 'מורף', en: 'Morph' },
  ];
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // ---------- timeline ----------
  // Seconds: hold A, A→B (dur), hold B, then (loop) B→A and back to A.
  function timing(tr) {
    const T = tr.dur, H = Math.max(0.35, T * 0.45);
    return tr.loop ? { cycle: 2 * (H + T), H, T } : { cycle: H + T + H * 2, H, T };
  }
  // p: 0..1 of the cycle → { from, u } with from 'A'|'B' and u = raw progress of the current move (0 during holds).
  function phase(tr, p) {
    const { cycle, H, T } = timing(tr), s = p * cycle;
    if (s < H) return { from: 'A', u: 0 };
    if (s < H + T) return { from: 'A', u: (s - H) / T };
    if (!tr.loop) return { from: 'A', u: 1 };
    if (s < 2 * H + T) return { from: 'B', u: 0 };
    if (s < 2 * H + 2 * T) return { from: 'B', u: (s - 2 * H - T) / T };
    return { from: 'A', u: 0 };
  }

  // ---------- frame state ----------
  const idle = () => ({ tx: 0, ty: 0, sc: 1, op: 1, bl: 0 });
  function stateRaw(tr, p) {
    const ph = phase(tr, p), u = ph.u;
    const out = idle(), inn = idle(); inn.op = 0;
    let m = null;
    if (tr.type === 'slide') {
      const [dx, dy] = DIRS[tr.dir] || DIRS.up, D = 15, e = eInOut(u);
      out.tx = dx * D * e; out.ty = dy * D * e; out.op = 1 - clamp((e - 0.35) / 0.55);
      inn.tx = -dx * D * (1 - e); inn.ty = -dy * D * (1 - e); inn.op = clamp((e - 0.1) / 0.55);
    } else if (tr.type === 'scale') {
      // Match cut: one scale curve shared by both icons (shrinking, so nothing leaves the 24px frame), hard cut at the peak of the move.
      const P = 0.6, sc = u < 0.5 ? 1 + (P - 1) * Math.pow(2 * u, 3) : 1 + (P - 1) * Math.pow(1 - (2 * u - 1), 3);
      out.sc = inn.sc = sc; out.op = u < 0.5 ? 1 : 0; inn.op = u < 0.5 ? 0 : 1;
    } else { // morph
      if (u > 0 && u < 1) { out.op = 0; inn.op = 0; m = eInOut(u); }
    }
    if (u >= 1) { out.op = 0; inn.op = 1; }
    const A = ph.from === 'A' ? out : inn, B = ph.from === 'A' ? inn : out;
    let M = null;
    if (m != null) M = { m: ph.from === 'A' ? m : 1 - m };
    return { A, B, M };
  }
  function state(tr, p) {
    const s = stateRaw(tr, p);
    if (tr.blur && tr.type !== 'morph') {
      const { cycle } = timing(tr), h = 0.012 / cycle * 3;
      const a = stateRaw(tr, Math.max(0, p - h)), c = stateRaw(tr, Math.min(1, p + h));
      for (const k of ['A', 'B']) {
        const v = Math.hypot(c[k].tx - a[k].tx, c[k].ty - a[k].ty) * 0.35 + Math.abs(c[k].sc - a[k].sc) * 2.2;
        s[k].bl = Math.min(1.6, v > 0.05 ? v : 0);
      }
    }
    return s;
  }

  // ---------- morph geometry ----------
  const K = 72;
  function bez(p0, q, t) { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * q.c1[0] + 3 * u * t * t * q.c2[0] + t * t * t * q.p[0], u * u * u * p0[1] + 3 * u * u * t * q.c1[1] + 3 * u * t * t * q.c2[1] + t * t * t * q.p[1]]; }
  function sampleSub(sp0, off) {
    const endP = sp0.segs.length ? sp0.segs[sp0.segs.length - 1].p : sp0.start;
    const sp = !sp0.closed && Math.hypot(endP[0] - sp0.start[0], endP[1] - sp0.start[1]) < 0.6 ? { ...sp0, closed: true } : sp0;
    const pts = [[sp.start[0], sp.start[1]]]; let p0 = sp.start;
    for (const q of sp.segs) { for (let i = 1; i <= 24; i++) pts.push(bez(p0, q, i / 24)); p0 = q.p; }
    if (sp.closed) pts.push([sp.start[0], sp.start[1]]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1], out = [], n = sp.closed ? K : K - 1;
    let j = 0;
    for (let i = 0; i < K; i++) {
      const target = L * (i / n);
      while (j < cum.length - 2 && cum[j + 1] < target) j++;
      const seg = cum[j + 1] - cum[j] || 1, t = (target - cum[j]) / seg;
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t + off[0], pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t + off[1]]);
    }
    const c = out.reduce((a, p) => [a[0] + p[0] / K, a[1] + p[1] / K], [0, 0]);
    return { pts: out, closed: !!sp.closed, len: L, c };
  }
  function pieces(icon, b) {
    const g = IG.prep(icon), off = [g.ox || 0, g.oy || 0], out = [];
    for (const e of g.els) { const sh = IG.shapeOf(e, b); for (const sp of sh.subs) if (sp.segs.length) out.push({ ...sampleSub(sp, off), fill: !!e.closed }); }
    return out;
  }
  const d2 = (P, Q) => { let s = 0; for (let i = 0; i < K; i++) s += (P[i][0] - Q[i][0]) ** 2 + (P[i][1] - Q[i][1]) ** 2; return s; };
  function align(a, b) {
    // Rotate / reverse b's samples so its points travel the shortest way to a's (a closed shape may start anywhere).
    const cands = [b.pts, b.pts.slice().reverse()]; let best = null, bv = Infinity;
    for (const c of cands) {
      if (b.closed) { for (let o = 0; o < K; o += 2) { const r = c.slice(o).concat(c.slice(0, o)); const v = d2(a.pts, r); if (v < bv) { bv = v; best = r; } } }
      else { const v = d2(a.pts, c); if (v < bv) { bv = v; best = c; } }
    }
    return best;
  }
  const mcache = new Map();
  function morphPairs(A, B, b) {
    const key = A.n + '>' + B.n + '|' + (b.join || '');
    if (mcache.has(key)) return mcache.get(key);
    const pa = pieces(A, b), pb = pieces(B, b), pairs = [];
    const cost = (x, y) => Math.hypot(x.c[0] - y.c[0], x.c[1] - y.c[1]) + 0.12 * Math.abs(x.len - y.len) + (x.closed !== y.closed ? 1.5 : 0);
    const ua = new Set(pa.keys()), ub = new Set(pb.keys());
    const all = []; pa.forEach((x, i) => pb.forEach((y, j) => all.push([cost(x, y), i, j]))); all.sort((p, q) => p[0] - q[0]);
    for (const [, i, j] of all) if (ua.has(i) && ub.has(j)) { ua.delete(i); ub.delete(j); const flip = pa[i].closed && !pb[j].closed; pairs.push({ a: flip ? align(pb[j], pa[i]) : pa[i].pts, b: flip ? pb[j].pts : align(pa[i], pb[j]), closed: pa[i].closed && pb[j].closed, fa: pa[i].fill && pa[i].closed, fb: pb[j].fill && pb[j].closed }); }
    const dot = (c) => Array.from({ length: K }, () => [c[0], c[1]]);
    for (const i of ua) pairs.push({ a: pa[i].pts, b: dot(pa[i].c), closed: pa[i].closed, fa: pa[i].fill && pa[i].closed, fb: false, ghost: 'a' });
    for (const j of ub) pairs.push({ a: dot(pb[j].c), b: pb[j].pts, closed: pb[j].closed, fa: false, fb: pb[j].fill && pb[j].closed, ghost: 'b' });
    mcache.set(key, pairs); return pairs;
  }
  function morphPath(pr, m) {
    let d = '';
    for (let i = 0; i < K; i++) { const x = pr.a[i][0] + (pr.b[i][0] - pr.a[i][0]) * m, y = pr.a[i][1] + (pr.b[i][1] - pr.a[i][1]) * m; d += (i ? 'L' : 'M') + f(x) + ' ' + f(y); }
    return d + (pr.closed ? 'Z' : '');
  }
  const pairOp = (pr, m) => (pr.ghost === 'a' ? 1 - clamp(m / 0.7) : pr.ghost === 'b' ? clamp((m - 0.3) / 0.7) : 1);
  const pairFill = (pr, m) => (pr.fa ? 1 - m : 0) + (pr.fb ? m : 0);

  // Morph keyframes: [time 0..1, m]; between keys m eases in-out.
  function morphKeys(tr) {
    const { cycle, H, T } = timing(tr), t = (x) => x / cycle;
    return tr.loop ? [[0, 0], [t(H), 0], [t(H + T), 1], [t(2 * H + T), 1], [t(2 * H + 2 * T), 0], [1, 0]] : [[0, 0], [t(H), 0], [t(H + T), 1], [1, 1]];
  }

  // ---------- SVG ----------
  const svgOpen = (b, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(b.primary)}" stroke-width="${f(b.stroke)}" stroke-linecap="${b.cap}" stroke-linejoin="${b.join}">`;
  function glyphInner(icon, b, id, bg) {
    const s = IG.svgStatic(icon, { ...b, container: 'none', containerColor: b.container && b.container !== 'none' ? b.containerColor : undefined }, { size: 24, id, bg: b.container && b.container !== 'none' ? b.containerColor : bg });
    return s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>'));
  }
  const tfOf = (s) => `translate(${f(s.tx)} ${f(s.ty)}) translate(12 12) scale(${f(s.sc)}) translate(-12 -12)`;
  function morphMarkup(pairs, b, m, fo, bgc) {
    return pairs.map((pr) => {
      const op = pairOp(pr, m), fl = pairFill(pr, m) * fo;
      const fill = b.style === 'duotone' && fl > 0.001 ? ` fill="${esc(U.duoFill(b, bgc))}"${fl < 1 ? ` fill-opacity="${f(fl)}"` : ''}` : '';
      return `<path d="${morphPath(pr, m)}"${fill}${op < 1 ? ` opacity="${f(op)}"` : ''}/>`;
    }).join('');
  }
  function wrapOuter(b, inner, opts, size) {
    const cs = U.containerScale(b);
    if (cs !== 1) inner = `<g transform="translate(12 12) scale(${cs}) translate(-12 -12)">${inner}</g>`;
    const bg = opts.bg ? `<rect width="24" height="24" fill="${esc(opts.bg)}" stroke="none"/>` : '';
    return svgOpen(b, size) + bg + U.containerMarkup(b) + inner + '</svg>';
  }
  /* One frame (preview / GIF). */
  function svgFrame(A, B, b, tr, p, opts = {}) {
    b = U.effColors(b);
    const st = state(tr, p), id = opts.id || 'tf', size = opts.size || 24;
    let inner = '', defs = '';
    for (const [k, ic] of [['A', A], ['B', B]]) {
      const s = st[k]; if (s.op <= 0.001) continue;
      let flt = '';
      if (s.bl > 0.02) { defs += `<filter id="${id}${k}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(s.bl)}"/></filter>`; flt = ` filter="url(#${id}${k}b)"`; }
      inner += `<g transform="${tfOf(s)}"${s.op < 1 ? ` opacity="${f(s.op)}"` : ''}${flt}>${glyphInner(ic, b, id + k, opts.bg)}</g>`;
    }
    if (st.M) inner += morphMarkup(morphPairs(A, B, b), b, st.M.m, 1, opts.bg);
    return wrapOuter(b, (defs ? `<defs>${defs}</defs>` : '') + inner, opts, size);
  }
  /* Self-contained animated SVG: CSS keyframes for the two glyphs, SMIL path animation for the morph. */
  function svgAnimated(A, B, b, tr, opts = {}) {
    b = U.effColors(b);
    const { cycle } = timing(tr), STEPS = 90, size = opts.size || 24, id = (opts.id || 'oz') + 't';
    const frames = []; for (let s = 0; s <= STEPS; s++) frames.push(state(tr, s / STEPS));
    const pct = (s) => f((s / STEPS) * 100) + '%', iter = tr.loop ? 'infinite' : '1 both', dur = f(cycle) + 's';
    let css = '', inner = '';
    for (const [k, ic] of [['A', A], ['B', B]]) {
      css += `@keyframes ${id}${k}{` + frames.map((fr, s) => { const x = fr[k]; return `${pct(s)}{transform:translate(${f(x.tx)}px,${f(x.ty)}px) scale(${f(x.sc)});opacity:${f(x.op)}${tr.blur ? `;filter:blur(${f(x.bl)}px)` : ''}}`; }).join('') + '}';
      css += `.${id}${k}{transform-origin:12px 12px;animation:${id}${k} ${dur} linear ${iter}}`;
      inner += `<g class="${id}${k}">${glyphInner(ic, b, id + k, opts.bg)}</g>`;
    }
    if (tr.type === 'morph') {
      const pairs = morphPairs(A, B, b), fo = 1, keys = morphKeys(tr), ms = keys.map((x) => x[1]);
      const kt = keys.map((x) => f(x[0])).join(';'), rep = (tr.loop ? 'repeatCount="indefinite"' : 'fill="freeze"') + ` calcMode="spline" keySplines="${keys.slice(1).map(() => '0.65 0 0.35 1').join(';')}"`;
      css += `@keyframes ${id}M{` + frames.map((fr, s) => `${pct(s)}{opacity:${fr.M ? 1 : 0}}`).join('') + '}';
      css += `.${id}M{animation:${id}M ${dur} step-end ${iter}}`;
      inner += `<g class="${id}M">` + pairs.map((pr) => {
        const dv = ms.map((m) => morphPath(pr, m)).join(';');
        const ov = ms.map((m) => f(pairOp(pr, m))).join(';');
        const fill = b.style === 'duotone' && (pr.fa || pr.fb) ? ` fill="${esc(U.duoFill(b, opts.bg))}"` : '';
        const fa = fill ? `<animate attributeName="fill-opacity" dur="${dur}" ${rep} keyTimes="${kt}" values="${ms.map((m) => f(pairFill(pr, m) * fo)).join(';')}"/>` : '';
        return `<path d="${morphPath(pr, ms[0])}"${fill}><animate attributeName="d" dur="${dur}" ${rep} keyTimes="${kt}" values="${dv}"/><animate attributeName="opacity" dur="${dur}" ${rep} keyTimes="${kt}" values="${ov}"/>${fa}</path>`;
      }).join('') + '</g>';
    }
    return wrapOuter(b, `<defs><style>${css}</style></defs>` + inner, opts, size);
  }

  // ---------- Lottie ----------
  function lottie(A, B, b, tr, opts = {}) {
    b = U.effColors(b);
    const W = opts.size || 512, fr = 30, { cycle } = timing(tr), op = Math.max(2, Math.round(cycle * fr));
    const states = []; for (let t = 0; t <= op; t++) states.push(state(tr, t / op));
    const base = IG.lottie(A, b, { type: 'none' }, { size: W, bg: opts.bg });
    const gB = IG.lottie(B, b, { type: 'none' }, { size: W }).layers[0];
    const gA = base.layers[0], rest = base.layers.slice(1);
    const k = (W / 24) * U.containerScale(b);
    const ks = (key) => ({
      o: U.animProp(states.map((s) => f(s[key].op * 100))), r: U.stat(0),
      p: U.animProp(states.map((s) => [f(W / 2 + s[key].tx * k), f(W / 2 + s[key].ty * k), 0])),
      a: U.stat([W / 2, W / 2, 0]), s: U.animProp(states.map((s) => [f(s[key].sc * 100), f(s[key].sc * 100), 100])),
    });
    const blurEf = (key) => (states.some((s) => s[key].bl > 0) ? [{ ty: 29, nm: 'Motion Blur', np: 5, ix: 1, en: 1, ef: [{ ty: 0, nm: 'Blurriness', ix: 1, v: U.animProp(states.map((s) => f(s[key].bl * (W / 24) * 2))) }, { ty: 7, nm: 'Blur Dimensions', ix: 2, v: U.stat(1) }, { ty: 7, nm: 'Repeat Edge Pixels', ix: 3, v: U.stat(0) }] }] : undefined);
    const LA = { ...gA, nm: A.n, ks: ks('A'), ef: blurEf('A'), op }, LB = { ...gB, nm: B.n, ks: ks('B'), ef: blurEf('B'), op };
    const layers = [LB, LA];
    if (tr.type === 'morph') {
      const pairs = morphPairs(A, B, b), fo = 100;
      const lc = { butt: 1, round: 2, square: 3 }[b.cap] || 2, lj = { miter: 1, round: 2, bevel: 3 }[b.join] || 2;
      const keys = morphKeys(tr);
      const kf = (fn) => ({ a: 1, k: keys.map(([t, m], i) => (i < keys.length - 1 ? { t: Math.round(t * op), s: [].concat(fn(m)), o: { x: [0.65], y: [0] }, i: { x: [0.35], y: [1] } } : { t: Math.round(t * op), s: [].concat(fn(m)) })) });
      const shp = (pr, m) => { const v = []; for (let i = 0; i < K; i++) v.push([f(pr.a[i][0] + (pr.b[i][0] - pr.a[i][0]) * m), f(pr.a[i][1] + (pr.b[i][1] - pr.a[i][1]) * m)]); const z = v.map(() => [0, 0]); return { i: z, o: z, v, c: pr.closed }; };
      const groups = pairs.map((pr, n) => {
        const it = [{ ty: 'sh', nm: 'Path', ks: kf((m) => [shp(pr, m)]) }];
        it.push({ ty: 'st', nm: 'Stroke', c: U.stat(U.rgb01(b.primary)), o: U.stat(100), w: U.stat(f(b.stroke)), lc, lj, ml: 4 });
        if (b.style === 'duotone' && (pr.fa || pr.fb)) it.push({ ty: 'fl', nm: 'Fill', c: U.stat(U.rgb01(U.duoFill(b, opts.bg))), o: kf((m) => f(pairFill(pr, m) * fo)), r: 1 });
        it.push({ ...U.trDefault(), o: kf((m) => f(pairOp(pr, m) * 100)) });
        return { ty: 'gr', nm: `Morph ${n + 1}`, it };
      });
      const glyph = { ty: 'gr', nm: 'Morph', it: [...groups, { ...U.trDefault(), p: U.stat([W / 2, W / 2]), a: U.stat([12, 12]), s: U.stat([f(k * 100), f(k * 100)]) }] };
      const mo = states.map((s) => (s.M ? 100 : 0));
      const oK = { a: 1, k: mo.map((v, t) => ({ t, s: [v], h: 1 })).filter((x, t) => t === 0 || mo[t - 1] !== x.s[0]) };
      layers.unshift({ ddd: 0, ind: 0, ty: 4, nm: 'Morph', sr: 1, ks: { o: oK, r: U.stat(0), p: U.stat([0, 0, 0]), a: U.stat([0, 0, 0]), s: U.stat([100, 100, 100]) }, ao: 0, shapes: [glyph], ip: 0, op, st: 0, bm: 0 });
    }
    const all = [...layers, ...rest.map((l) => ({ ...l, op }))];
    all.forEach((l, i) => { l.ind = i + 1; if (!l.ef) delete l.ef; });
    return { ...base, nm: `${A.n} → ${B.n} · ${tr.type}`, op, layers: all };
  }

  // ---------- morph quality (for recommendations) ----------
  // Coarse version of the morph: how far points travel, how much has to vanish or appear. Lower = smoother.
  const K2 = 24, pc = new Map();
  function coarse(icon, b) {
    const key = icon.n + '|' + (b.join || ''); if (pc.has(key)) return pc.get(key);
    const g = IG.prep(icon), off = [g.ox || 0, g.oy || 0], out = [];
    for (const e of g.els) for (const sp of IG.shapeOf(e, b).subs) {
      if (!sp.segs.length) continue; const s = sampleSub(sp, off);
      const pts = []; for (let i = 0; i < K2; i++) pts.push(s.pts[Math.floor(i * K / K2)]);
      out.push({ pts, closed: s.closed, len: s.len, c: s.c });
    }
    pc.set(key, out); return out;
  }
  function travel(a, b) {
    const dd = (P, Q) => { let s = 0; for (let i = 0; i < K2; i++) s += Math.hypot(P[i][0] - Q[i][0], P[i][1] - Q[i][1]); return s / K2; };
    let best = Infinity;
    for (const c of [b.pts, b.pts.slice().reverse()]) {
      if (a.closed || b.closed) { for (let o = 0; o < K2; o++) best = Math.min(best, dd(a.pts, c.slice(o).concat(c.slice(0, o)))); }
      else best = Math.min(best, dd(a.pts, c));
    }
    return best;
  }
  function morphScore(A, B, b) {
    const pa = coarse(A, b), pb = coarse(B, b); if (!pa.length || !pb.length) return Infinity;
    const cost = (x, y) => Math.hypot(x.c[0] - y.c[0], x.c[1] - y.c[1]) + 0.12 * Math.abs(x.len - y.len) + (x.closed !== y.closed ? 1.5 : 0);
    const all = []; pa.forEach((x, i) => pb.forEach((y, j) => all.push([cost(x, y), i, j]))); all.sort((p, q) => p[0] - q[0]);
    const ua = new Set(pa.keys()), ub = new Set(pb.keys()); let s = 0, tot = 0;
    for (const [, i, j] of all) if (ua.has(i) && ub.has(j)) { ua.delete(i); ub.delete(j); const w = (pa[i].len + pb[j].len) / 2; s += travel(pa[i], pb[j]) * w + Math.abs(pa[i].len - pb[j].len) * 0.25; tot += w; }
    for (const i of ua) { s += pa[i].len * 1.6; tot += pa[i].len * 0.5; }
    for (const j of ub) { s += pb[j].len * 1.6; tot += pb[j].len * 0.5; }
    return s / Math.max(1, tot);
  }

  G.IconTrans = { morphScore, TRANS, DIRS, timing, phase, state, svgFrame, svgAnimated, lottie, morphPairs };
})(typeof window !== 'undefined' ? window : globalThis);
