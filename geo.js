/* Icon Studio — geometry, animation model, SVG / Lottie builders. No DOM needed. */
(function (G) {
  'use strict';
  const f = (n) => +(+n).toFixed(3);

  // ---------- element -> path d ----------
  function elToD(tag, a) {
    const n = (k, d = 0) => (a[k] == null ? d : parseFloat(a[k]));
    switch (tag) {
      case 'path': return a.d;
      case 'circle': {
        const cx = n('cx'), cy = n('cy'), r = n('r');
        return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
      }
      case 'ellipse': {
        const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry');
        return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
      }
      case 'rect': {
        const x = n('x'), y = n('y'), w = n('width'), h = n('height');
        let rx = a.rx != null ? n('rx') : (a.ry != null ? n('ry') : 0);
        let ry = a.ry != null ? n('ry') : rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
        return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
      }
      case 'line': return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
      case 'polyline':
      case 'polygon': {
        const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
        let d = '';
        for (let i = 0; i + 1 < p.length; i += 2) d += (i ? 'L' : 'M') + p[i] + ' ' + p[i + 1];
        return d + (tag === 'polygon' ? 'Z' : '');
      }
    }
    return '';
  }

  // ---------- arc -> cubic ----------
  function arcToCubics(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
    if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
    const r = phi * Math.PI / 180, sp = Math.sin(r), cp = Math.cos(r);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
    const rx2 = rx * rx, ry2 = ry * ry;
    let num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p; if (num < 0) num = 0;
    let coef = Math.sqrt(num / (rx2 * y1p * y1p + ry2 * x1p * x1p)); if (fa === fs) coef = -coef;
    const cxp = coef * rx * y1p / ry, cyp = -coef * ry * x1p / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; if (fs && dt < 0) dt += 2 * Math.PI;
    const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
    const d = dt / segs, k = 4 / 3 * Math.tan(d / 4);
    const map = (ux, uy) => [cx + rx * ux * cp - ry * uy * sp, cy + rx * ux * sp + ry * uy * cp];
    const out = []; let t = t1;
    for (let i = 0; i < segs; i++) {
      const c1 = Math.cos(t), s1 = Math.sin(t), c2 = Math.cos(t + d), s2 = Math.sin(t + d);
      const a1 = map(c1 - k * s1, s1 + k * c1), a2 = map(c2 + k * s2, s2 - k * c2), p = map(c2, s2);
      out.push([...a1, ...a2, ...p]); t += d;
    }
    const L = out[out.length - 1]; L[4] = x2; L[5] = y2;
    return out;
  }

  // ---------- path parser -> subpaths of cubic segments ----------
  function parsePath(d) {
    let i = 0; const n = d.length;
    const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
    const numRe = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
    const num = () => { skip(); numRe.lastIndex = i; const m = numRe.exec(d); if (!m) throw new Error('bad path @' + i + ': ' + d); i = numRe.lastIndex; return parseFloat(m[0]); };
    const flag = () => { skip(); const c = d[i++]; return c === '1' ? 1 : 0; };
    const more = () => { skip(); return i < n && /[-+.\d]/.test(d[i]); };
    const subs = []; let cur = [0, 0], start = [0, 0], sp = null, cmd = '', prevC2 = null, prevQ = null, prevCmd = '';
    const ensure = () => { if (!sp) { sp = { start: cur.slice(), segs: [], closed: false }; subs.push(sp); } };
    const cubic = (c1, c2, p) => { ensure(); sp.segs.push({ c1, c2, p }); cur = p; };
    const line = (p) => cubic(cur.slice(), p.slice(), p);
    while (i < n) {
      skip(); if (i >= n) break;
      if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
      const rel = cmd === cmd.toLowerCase() && cmd !== 'z' ? 1 : 0, C = cmd.toUpperCase();
      const ox = rel ? cur[0] : 0, oy = rel ? cur[1] : 0;
      let c2 = null, q = null;
      switch (C) {
        case 'M': { const p = [num() + ox, num() + oy]; cur = p; start = p.slice(); sp = { start: p.slice(), segs: [], closed: false }; subs.push(sp); cmd = rel ? 'l' : 'L'; break; }
        case 'L': line([num() + ox, num() + oy]); break;
        case 'H': line([num() + ox, cur[1]]); break;
        case 'V': line([cur[0], num() + oy]); break;
        case 'C': { const a = [num() + ox, num() + oy], b = [num() + ox, num() + oy], p = [num() + ox, num() + oy]; cubic(a, b, p); c2 = b; break; }
        case 'S': { const a = (prevC2 && /[CS]/.test(prevCmd)) ? [2 * cur[0] - prevC2[0], 2 * cur[1] - prevC2[1]] : cur.slice(); const b = [num() + ox, num() + oy], p = [num() + ox, num() + oy]; cubic(a, b, p); c2 = b; break; }
        case 'Q': { const qq = [num() + ox, num() + oy], p = [num() + ox, num() + oy], p0 = cur; cubic([p0[0] + 2 / 3 * (qq[0] - p0[0]), p0[1] + 2 / 3 * (qq[1] - p0[1])], [p[0] + 2 / 3 * (qq[0] - p[0]), p[1] + 2 / 3 * (qq[1] - p[1])], p); q = qq; break; }
        case 'T': { const qq = (prevQ && /[QT]/.test(prevCmd)) ? [2 * cur[0] - prevQ[0], 2 * cur[1] - prevQ[1]] : cur.slice(); const p = [num() + ox, num() + oy], p0 = cur; cubic([p0[0] + 2 / 3 * (qq[0] - p0[0]), p0[1] + 2 / 3 * (qq[1] - p0[1])], [p[0] + 2 / 3 * (qq[0] - p[0]), p[1] + 2 / 3 * (qq[1] - p[1])], p); q = qq; break; }
        case 'A': { const rx = num(), ry = num(), ph = num(), fa = flag(), fs = flag(); const p = [num() + ox, num() + oy]; const cs = arcToCubics(cur[0], cur[1], rx, ry, ph, fa, fs, p[0], p[1]); for (const s of cs) cubic([s[0], s[1]], [s[2], s[3]], [s[4], s[5]]); if (cs.length === 1 && rx && ry) sp.segs[sp.segs.length - 1].arc = Math.max(Math.abs(rx), Math.abs(ry)); break; }
        case 'Z': { if (sp) sp.closed = true; cur = start.slice(); sp = null; break; }
        default: throw new Error('cmd ' + cmd);
      }
      prevC2 = c2; prevQ = q; prevCmd = C;
      if (C === 'Z') continue;
    }
    return subs;
  }

  // ---------- prepare icon (cache geometry) ----------
  const cache = new Map();
  function prep(icon) {
    let g = cache.get(icon.n); if (g) return g;
    const els = icon.e.map(([tag, a]) => {
      const d = elToD(tag, a); let subs = [];
      try { subs = parsePath(d); } catch (e) { console.warn(icon.n, e.message); }
      const closed = tag === 'circle' || tag === 'ellipse' || tag === 'rect' || tag === 'polygon' || (tag === 'path' && subs.length > 0 && subs.every((s) => s.closed));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const s of subs) for (const p of [s.start, ...s.segs.flatMap((q) => [q.c1, q.c2, q.p])]) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const area = subs.length ? Math.max(0.01, (x1 - x0)) * Math.max(0.01, (y1 - y0)) : 0;
      return { tag, a, d, subs, closed, area };
    });
    let main = 0; els.forEach((e, k) => { if (e.area > els[main].area) main = k; });
    // Visual bounding box (sampled on the curves) so the glyph can be optically centred in its 24×24 frame.
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    const pt = (x, y) => { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); };
    for (const e of els) for (const s of e.subs) {
      let p0 = s.start; pt(p0[0], p0[1]);
      for (const q of s.segs) {
        for (let t = 0.125; t <= 1.0001; t += 0.125) { const u = 1 - t; pt(u * u * u * p0[0] + 3 * u * u * t * q.c1[0] + 3 * u * t * t * q.c2[0] + t * t * t * q.p[0], u * u * u * p0[1] + 3 * u * u * t * q.c1[1] + 3 * u * t * t * q.c2[1] + t * t * t * q.p[1]); }
        p0 = q.p;
      }
    }
    const ox = bx1 > bx0 ? 12 - (bx0 + bx1) / 2 : 0, oy = by1 > by0 ? 12 - (by0 + by1) / 2 : 0;
    g = { els, main, ox: Math.abs(ox) < 0.05 ? 0 : ox, oy: Math.abs(oy) < 0.05 ? 0 : oy }; cache.set(icon.n, g); return g;
  }

  // ---------- corner styles ----------
  // Lucide draws rounded corners as small 90° arcs (and rect rx). "miter" replaces each with a true corner, "bevel" with a chamfer.
  function cornerD(subs, mode) {
    const P = (p) => f(p[0]) + ' ' + f(p[1]);
    let d = '', changed = false;
    for (const sp of subs) {
      d += 'M' + P(sp.start); let prev = sp.start;
      for (const q of sp.segs) {
        if (q.arc && q.arc <= 4.5) {
          changed = true;
          if (mode === 'bevel') d += 'L' + P(q.p);
          else {
            const d1 = [q.c1[0] - prev[0], q.c1[1] - prev[1]], d2 = [q.c2[0] - q.p[0], q.c2[1] - q.p[1]];
            const cr = d1[0] * d2[1] - d1[1] * d2[0];
            if (Math.abs(cr) < 1e-9) d += 'L' + P(q.p);
            else { const t = ((q.p[0] - prev[0]) * d2[1] - (q.p[1] - prev[1]) * d2[0]) / cr; d += 'L' + P([prev[0] + t * d1[0], prev[1] + t * d1[1]]) + 'L' + P(q.p); }
          }
        } else if (q.c1[0] === prev[0] && q.c1[1] === prev[1] && q.c2[0] === q.p[0] && q.c2[1] === q.p[1]) d += 'L' + P(q.p);
        else d += 'C' + P(q.c1) + ' ' + P(q.c2) + ' ' + P(q.p);
        prev = q.p;
      }
      if (sp.closed) d += 'Z';
    }
    return changed ? d : null;
  }
  /* The element as drawn for a brand: original markup for round corners, a rebuilt path for sharp / bevelled ones. */
  function shapeOf(e, b) {
    const mode = b && (b.join === 'miter' || b.join === 'bevel') ? b.join : null;
    if (!mode) return e;
    const key = '_' + mode;
    if (e[key] === undefined) { const d = cornerD(e.subs, mode); e[key] = d ? { tag: 'path', a: { d }, subs: parsePath(d), closed: e.closed } : null; }
    return e[key] || e;
  }
  const centerWrap = (g, inner) => (g.ox || g.oy ? `<g transform="translate(${f(g.ox)} ${f(g.oy)})">${inner}</g>` : inner);

  // ---------- animation model ----------
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const eOut = (t) => 1 - Math.pow(1 - t, 3);
  const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  const ANIMS = [
    { id: 'none', he: 'ללא', en: 'Static' },
    { id: 'appear', he: 'הופעה', en: 'Appear' },
    { id: 'fade', he: 'שקיפות', en: 'Fade' },
    { id: 'grow', he: 'הגדלה', en: 'Grow' },
    { id: 'draw', he: 'ציור קו', en: 'Line draw' },
    { id: 'float', he: 'ריחוף', en: 'Float' },
    { id: 'pulse', he: 'פעימה', en: 'Pulse' },
    { id: 'bounce', he: 'קפיצה', en: 'Bounce' },
    { id: 'wiggle', he: 'נענוע', en: 'Wiggle' },
    { id: 'spin', he: 'סיבוב', en: 'Spin' },
    { id: 'halfspin', he: 'חצי סיבוב', en: 'Half spin' },
  ];

  // p: progress 0..1 within one cycle. n: element count.
  // stagger 0..1: 0 = all strokes draw together, 1 = each stroke finishes before the next starts.
  // type may combine several animations with '+', e.g. "draw+pulse": stroke progress comes from draw, transforms add up, scale and opacity multiply.
  // blur: motion blur strength (viewBox units) from how fast the icon moves around p.
  function animState(type, p, n, loop, stagger, blur) {
    const s = animStateBase(type, p, n, loop, stagger); s.g.bl = 0;
    if (blur) {
      const h = 0.01, a = animStateBase(type, Math.max(0, p - h), n, loop, stagger).g, c = animStateBase(type, Math.min(1, p + h), n, loop, stagger).g;
      const v = Math.abs(c.rot - a.rot) * 0.05 + Math.hypot(c.tx - a.tx, c.ty - a.ty) * 1.5 + Math.abs(c.sc - a.sc) * 6;
      s.g.bl = Math.min(1.4, v > 0.04 ? v : 0);
    }
    return s;
  }
  function animStateBase(type, p, n, loop, stagger) {
    const parts = String(type || 'none').split('+').filter((x) => x && x !== 'none');
    if (parts.length > 1) {
      const out = { g: { tx: 0, ty: 0, rot: 0, sc: 1, op: 1 }, el: [], fill: 1 };
      for (let k = 0; k < n; k++) out.el.push({ d: 1, f: 1 });
      for (const t of parts) {
        const s = animState1(t, p, n, loop, stagger);
        out.g.tx += s.g.tx; out.g.ty += s.g.ty; out.g.rot += s.g.rot; out.g.sc *= s.g.sc; out.g.op = Math.min(out.g.op, s.g.op);
        for (let k = 0; k < n; k++) { out.el[k].d = Math.min(out.el[k].d, s.el[k].d); out.el[k].f = Math.min(out.el[k].f, s.el[k].f ?? 1); }
        out.fill = Math.min(out.fill, s.fill);
      }
      return out;
    }
    return animState1(parts[0] || 'none', p, n, loop, stagger);
  }
  function animState1(type, p, n, loop, stagger) {
    const sg = stagger == null ? 0.6 : Math.max(0, Math.min(1, +stagger));
    const g = { tx: 0, ty: 0, rot: 0, sc: 1, op: 1 }; const el = []; let fill = 1;
    for (let k = 0; k < n; k++) el.push({ d: 1, f: 1 });
    const tail = loop ? 1 - clamp((p - 0.9) / 0.1) : 1;
    switch (type) {
      case 'appear': { const t = clamp(p / 0.6); g.sc = 0.55 + 0.45 * eBack(t); g.op = clamp(p / 0.3) * tail; break; }
      case 'draw': {
        const W = 0.78, L = W / (1 + (n - 1) * sg);
        for (let k = 0; k < n; k++) { const r = (p - k * sg * L) / L; el[k].d = eInOut(clamp(r)); el[k].f = eOut(clamp((r - 0.5) / 0.55)); }
        g.op = tail; break;
      }
      case 'fade': g.op = eOut(clamp(p / 0.5)) * tail; break;
      case 'grow': { const t = clamp(p / 0.55); g.sc = 0.2 + 0.8 * eOut(t); g.op = clamp(p / 0.15) * tail; break; }
      case 'float': g.ty = -1.1 * Math.sin(2 * Math.PI * p); g.rot = 1.5 * Math.sin(2 * Math.PI * p + 0.6); break;
      case 'pulse': { const s = Math.sin(Math.PI * clamp(p / 0.45)); g.sc = 1 + 0.12 * s * s; break; }
      case 'bounce': { const t = clamp(p / 0.7); g.ty = -2.6 * Math.abs(Math.sin(Math.PI * t)) * (1 - t * 0.35) * (t < 1 ? 1 : 0); break; }
      case 'wiggle': g.rot = 11 * Math.sin(6 * Math.PI * p) * (1 - p); break;
      case 'spin': g.rot = 360 * eInOut(p); break;
      case 'halfspin': g.rot = -90 * (1 - eBack(clamp(p / 0.6))); break;
    }
    return { g, el, fill };
  }

  // ---------- color helpers ----------
  function hexToRgb(h) { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function strokeFor(b, g, k, gid) {
    if (b.style === 'gradient') return `url(#${gid})`;
    if (b.style === 'twotone' && k !== g.main) return b.secondary;
    return b.primary;
  }
  // Duotone fill as a solid tint: the secondary colour mixed toward the surface it sits on, so it never looks see-through.
  function duoFill(b, bg) {
    const base = b.container && b.container !== 'none' ? (b.containerColor || '#FFFFFF') : (bg || '#FFFFFF');
    const a = Math.max(0, Math.min(1, b.fillOpacity ?? 0.3)), s = hexToRgb(b.secondary), w = hexToRgb(base);
    return '#' + s.map((c, i) => Math.round(w[i] + (c - w[i]) * a).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const containerScale = (b) => (b.container && b.container !== 'none' ? 0.6 : 1);
  function containerMarkup(b) {
    if (!b.container || b.container === 'none') return '';
    const c = esc(b.containerColor || '#EEF');
    if (b.container === 'circle') return `<circle cx="12" cy="12" r="12" fill="${c}" stroke="none"/>`;
    return `<rect width="24" height="24" rx="6" fill="${c}" stroke="none"/>`;
  }
  const gTransform = (s) => {
    if (!s || (!s.tx && !s.ty && !s.rot && s.sc === 1)) return '';
    return `translate(${f(12 + s.tx)} ${f(12 + s.ty)}) rotate(${f(s.rot)}) scale(${f(s.sc)}) translate(-12 -12)`;
  };
  function attrsOf(a) { return Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' '); }

  /* Static SVG at a given animation state (state null = rest). opts: size, bg (raster background color), id */
  function svgStatic(icon, b, opts = {}) {
    const g = prep(icon), size = opts.size || 24, st = opts.state || null, gid = (opts.id || 'ic') + '-g';
    const cs = containerScale(b);
    let defs = '';
    if (b.style === 'gradient') defs = `<defs><linearGradient id="${gid}" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${esc(b.primary)}"/><stop offset="1" stop-color="${esc(b.secondary)}"/></linearGradient></defs>`;
    const parts = g.els.map((e, k) => {
      const at = [];
      const sc = strokeFor(b, g, k, gid); if (sc !== b.primary) at.push(`stroke="${esc(sc)}"`);
      if (b.style === 'duotone' && e.closed) {
        const fo = st ? st.fill * (st.el[k] ? st.el[k].f ?? 1 : 1) : 1;
        at.push(`fill="${esc(duoFill(b, opts.bg))}"`); if (fo < 1) at.push(`fill-opacity="${f(fo)}"`);
      }
      if (st && st.el[k] && st.el[k].d < 1) {
        const d = st.el[k].d;
        at.push(`pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="${f(1 - d)}"`);
        if (d <= 0.001) at.push('stroke-opacity="0"');
      }
      const sh = shapeOf(e, b); return `<${sh.tag} ${attrsOf(sh.a)}${at.length ? ' ' + at.join(' ') : ''}/>`;
    }).join('');
    const tf = st ? gTransform(st.g) : '';
    const op = st && st.g.op < 1 ? ` opacity="${f(st.g.op)}"` : '';
    let inner = centerWrap(g, parts);
    const bl = st && st.g.bl > 0.02 ? st.g.bl : 0;
    if (bl) defs += `<defs><filter id="${gid}-mb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(bl)}"/></filter></defs>`;
    if (tf || op || bl) inner = `<g${tf ? ` transform="${tf}"` : ''}${op}${bl ? ` filter="url(#${gid}-mb)"` : ''}>${inner}</g>`;
    if (cs !== 1) inner = `<g transform="translate(12 12) scale(${cs}) translate(-12 -12)">${inner}</g>`;
    const bg = opts.bg ? `<rect width="24" height="24" fill="${esc(opts.bg)}" stroke="none"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(b.primary)}" stroke-width="${f(b.stroke)}" stroke-linecap="${b.cap}" stroke-linejoin="${b.join}">${defs}${bg}${containerMarkup(b)}${inner}</svg>`;
  }

  /* Self-contained animated SVG (CSS keyframes sampled from the model). */
  function svgAnimated(icon, b, anim, opts = {}) {
    if (!anim || anim.type === 'none') return svgStatic(icon, b, opts);
    const g = prep(icon), n = g.els.length, size = opts.size || 24, id = (opts.id || 'ic') + '-' + icon.n.replace(/[^a-z0-9]/g, '');
    const STEPS = 30, frames = [];
    for (let s = 0; s <= STEPS; s++) frames.push(animState(anim.type, s / STEPS, n, anim.loop, anim.stagger, anim.blur));
    const pct = (s) => f((s / STEPS) * 100) + '%';
    const varies = (fn) => frames.some((fr) => fn(fr) !== fn(frames[0]));
    const iter = anim.loop ? 'infinite' : '1 both';
    const dur = f(anim.dur) + 's';
    let css = '';
    const gT = (fr) => `translate(${f(fr.g.tx)}px,${f(fr.g.ty)}px) rotate(${f(fr.g.rot)}deg) scale(${f(fr.g.sc)})`;
    const gKey = (fr) => gT(fr) + '|' + f(fr.g.op) + '|' + f(fr.g.bl);
    if (varies(gKey)) {
      css += `@keyframes ${id}-g{` + frames.map((fr, s) => `${pct(s)}{transform:${gT(fr)};opacity:${f(fr.g.op)}${anim.blur ? `;filter:blur(${f(fr.g.bl)}px)` : ''}}`).join('') + '}';
      css += `.${id}-g{transform-origin:12px 12px;animation:${id}-g ${dur} linear ${iter}}`;
    }
    const elCls = [];
    g.els.forEach((e, k) => {
      const dv = varies((fr) => f(fr.el[k].d));
      const fv = b.style === 'duotone' && e.closed && varies((fr) => f(fr.fill * (fr.el[k].f ?? 1)));
      if (!dv && !fv) { elCls.push(''); return; }
      const fo = 1;
      css += `@keyframes ${id}-e${k}{` + frames.map((fr, s) => {
        let r = '';
        if (dv) r += `stroke-dashoffset:${f(1 - fr.el[k].d)};stroke-opacity:${fr.el[k].d <= 0.001 ? 0 : 1};`;
        if (fv) r += `fill-opacity:${f(fo * fr.fill * (fr.el[k].f ?? 1))};`;
        return `${pct(s)}{${r}}`;
      }).join('') + '}';
      css += `.${id}-e${k}{${dv ? 'stroke-dasharray:1 2;' : ''}animation:${id}-e${k} ${dur} linear ${iter}}`;
      elCls.push(`${id}-e${k}`);
    });
    css += `@media (prefers-reduced-motion:reduce){.${id}-g,[class^="${id}-e"]{animation:none}}`;
    const gid = id + '-gr';
    let defs = '';
    if (b.style === 'gradient') defs = `<linearGradient id="${gid}" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${esc(b.primary)}"/><stop offset="1" stop-color="${esc(b.secondary)}"/></linearGradient>`;
    const parts = g.els.map((e, k) => {
      const at = [];
      const sc = strokeFor(b, g, k, gid); if (sc !== b.primary) at.push(`stroke="${esc(sc)}"`);
      if (b.style === 'duotone' && e.closed) { at.push(`fill="${esc(duoFill(b, opts.bg))}"`); }
      if (elCls[k]) { at.push(`class="${elCls[k]}"`); if (css.includes(`.${elCls[k]}{stroke-dasharray`)) at.push('pathLength="1"'); }
      const sh = shapeOf(e, b); return `<${sh.tag} ${attrsOf(sh.a)}${at.length ? ' ' + at.join(' ') : ''}/>`;
    }).join('');
    const cs = containerScale(b);
    let inner = `<g class="${id}-g">${centerWrap(g, parts)}</g>`;
    if (cs !== 1) inner = `<g transform="translate(12 12) scale(${cs}) translate(-12 -12)">${inner}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${esc(b.primary)}" stroke-width="${f(b.stroke)}" stroke-linecap="${b.cap}" stroke-linejoin="${b.join}"><defs><style>${css}</style>${defs}</defs>${opts.bg ? `<rect width="24" height="24" fill="${esc(opts.bg)}" stroke="none"/>` : ''}${containerMarkup(b)}${inner}</svg>`;
  }

  // ---------- Lottie ----------
  function lottieShape(sp) {
    const v = [sp.start.slice()], ii = [[0, 0]], o = [];
    for (const s of sp.segs) {
      const prev = v[v.length - 1];
      o.push([s.c1[0] - prev[0], s.c1[1] - prev[1]]);
      v.push(s.p.slice()); ii.push([s.c2[0] - s.p[0], s.c2[1] - s.p[1]]);
    }
    o.push([0, 0]);
    if (sp.closed && v.length > 2) {
      const L = v[v.length - 1];
      if (Math.hypot(L[0] - v[0][0], L[1] - v[0][1]) < 1e-3) { ii[0] = ii[ii.length - 1]; v.pop(); ii.pop(); o.pop(); }
    }
    const r = (a) => a.map((p) => [f(p[0]), f(p[1])]);
    return { i: r(ii), o: r(o), v: r(v), c: !!sp.closed };
  }
  const rgb01 = (h) => hexToRgb(h).map((x) => f(x / 255)).concat(1);
  const stat = (k) => ({ a: 0, k });
  function animProp(vals, fps) {
    const same = vals.every((v) => JSON.stringify(v) === JSON.stringify(vals[0]));
    if (same) return stat(vals[0]);
    const k = vals.map((v, t) => (t < vals.length - 1 ? { t, s: Array.isArray(v) ? v : [v], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } } : { t, s: Array.isArray(v) ? v : [v] }));
    return { a: 1, k };
  }
  const trDefault = () => ({ ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100), sk: stat(0), sa: stat(0), nm: 'Transform' });

  function lottie(icon, b, anim, opts = {}) {
    const g = prep(icon), n = g.els.length, W = opts.size || 512, fr = 30;
    const type = anim ? anim.type : 'none';
    const dur = type === 'none' ? 1 : anim.dur;
    const op = Math.max(1, Math.round(dur * fr));
    const states = []; for (let t = 0; t <= op; t++) states.push(animState(type, t / op, n, anim && anim.loop, anim && anim.stagger, anim && anim.blur));
    const cs = containerScale(b), k = (W / 24) * cs;
    const lc = { butt: 1, round: 2, square: 3 }[b.cap] || 2, lj = { miter: 1, round: 2, bevel: 3 }[b.join] || 2;
    const elGroups = g.els.map((e, idx) => {
      const it = shapeOf(e, b).subs.map((sp, j) => ({ ty: 'sh', nm: `${e.tag}-${j}`, ks: stat(lottieShape(sp)) }));
      const dvals = states.map((s) => f(s.el[idx].d * 100));
      if (dvals.some((v) => v !== 100)) it.push({ ty: 'tm', nm: 'Draw', s: stat(0), e: animProp(dvals), o: stat(0), m: 1 });
      if (b.style === 'gradient') {
        const c1 = rgb01(b.primary), c2 = rgb01(b.secondary);
        it.push({ ty: 'gs', nm: 'Stroke', o: stat(100), w: stat(f(b.stroke)), g: { p: 2, k: stat([0, c1[0], c1[1], c1[2], 1, c2[0], c2[1], c2[2]]) }, s: stat([2, 2]), e: stat([22, 22]), t: 1, lc, lj, ml: 4 });
      } else {
        const col = b.style === 'twotone' && idx !== g.main ? b.secondary : b.primary;
        it.push({ ty: 'st', nm: 'Stroke', c: stat(rgb01(col)), o: stat(100), w: stat(f(b.stroke)), lc, lj, ml: 4 });
      }
      if (b.style === 'duotone' && e.closed) {
        const fo = 100;
        it.push({ ty: 'fl', nm: 'Fill', c: stat(rgb01(duoFill(b, opts.bg))), o: animProp(states.map((s) => f(fo * s.fill * (s.el[idx].f ?? 1)))), r: 1 });
      }
      it.push(trDefault());
      return { ty: 'gr', nm: `${e.tag} ${idx + 1}`, it };
    }).reverse();
    const glyph = { ty: 'gr', nm: icon.n, it: [...elGroups, { ...trDefault(), p: stat([W / 2, W / 2]), a: stat([f(12 - g.ox), f(12 - g.oy)]), s: stat([f(k * 100), f(k * 100)]) }] };
    const ks = {
      o: animProp(states.map((s) => f(s.g.op * 100))),
      r: animProp(states.map((s) => f(s.g.rot))),
      p: animProp(states.map((s) => [f(W / 2 + s.g.tx * k), f(W / 2 + s.g.ty * k), 0])),
      a: stat([W / 2, W / 2, 0]),
      s: animProp(states.map((s) => [f(s.g.sc * 100), f(s.g.sc * 100), 100])),
    };
    const layers = [{ ddd: 0, ind: 1, ty: 4, nm: icon.n, sr: 1, ks, ao: 0, shapes: [glyph], ip: 0, op, st: 0, bm: 0 }];
    if (states.some((s) => s.g.bl > 0)) layers[0].ef = [{ ty: 29, nm: 'Motion Blur', np: 5, ix: 1, en: 1, ef: [{ ty: 0, nm: 'Blurriness', ix: 1, v: animProp(states.map((s) => f(s.g.bl * (W / 24) * 2))) }, { ty: 7, nm: 'Blur Dimensions', ix: 2, v: stat(1) }, { ty: 7, nm: 'Repeat Edge Pixels', ix: 3, v: stat(0) }] }];
    if (b.container && b.container !== 'none') {
      const shape = b.container === 'circle' ? { ty: 'el', nm: 'Circle', p: stat([W / 2, W / 2]), s: stat([W, W]) } : { ty: 'rc', nm: 'Rect', p: stat([W / 2, W / 2]), s: stat([W, W]), r: stat(W / 4) };
      layers.push({ ddd: 0, ind: 2, ty: 4, nm: 'Container', sr: 1, ks: { o: stat(100), r: stat(0), p: stat([0, 0, 0]), a: stat([0, 0, 0]), s: stat([100, 100, 100]) }, ao: 0, shapes: [{ ty: 'gr', nm: 'Container', it: [shape, { ty: 'fl', c: stat(rgb01(b.containerColor || '#EEEEFF')), o: stat(100), r: 1 }, trDefault()] }], ip: 0, op, st: 0, bm: 0 });
    }
    if (opts.bg) layers.push({ ddd: 0, ind: layers.length + 1, ty: 4, nm: 'Background', sr: 1, ks: { o: stat(100), r: stat(0), p: stat([0, 0, 0]), a: stat([0, 0, 0]), s: stat([100, 100, 100]) }, ao: 0, shapes: [{ ty: 'gr', nm: 'Background', it: [{ ty: 'rc', nm: 'Rect', p: stat([W / 2, W / 2]), s: stat([W, W]), r: stat(0) }, { ty: 'fl', c: stat(rgb01(opts.bg)), o: stat(100), r: 1 }, trDefault()] }], ip: 0, op, st: 0, bm: 0 });
    return { v: '5.7.4', fr, ip: 0, op, w: W, h: W, nm: `${icon.n} · ${type}`, ddd: 0, assets: [], layers, meta: { g: 'OZ Icon Studio' } };
  }

  G.IconGeo = { shapeOf, elToD, parsePath, prep, animState, ANIMS, svgStatic, svgAnimated, lottie, hexToRgb, util: { duoFill, f, esc, clamp, eOut, eInOut, eBack, containerMarkup, containerScale, rgb01, stat, animProp, trDefault } };
})(typeof window !== 'undefined' ? window : globalThis);
