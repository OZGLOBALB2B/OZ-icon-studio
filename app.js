/* OZ Icon Studio — app */
(function () {
  'use strict';
  const G = window.IconGeo;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-|-$/g, '') || 'brand';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* Fallback presets, used only when the shared brand store is unreachable or empty. */
  const DEFAULT_BRANDS = [
    { id: 'atlantium', order: 1, name: 'Atlantium', primary: '#202657', secondary: '#34B8C5', style: 'duotone', stroke: 1.5, cap: 'round', join: 'round', fillOpacity: 0.35, container: 'none', containerColor: '#E3F5F7', source: 'Brand tokens from the Atlantium site: navy #202657, aqua #34B8C5.', notes: '' },
    { id: 'cust2mate', order: 2, name: 'Cust2Mate', primary: '#412AE8', secondary: '#F29DFF', style: 'gradient', stroke: 2, cap: 'round', join: 'round', fillOpacity: 0.3, container: 'square', containerColor: '#EDE9FD', source: 'Figma design system: primary/500 #412AE8, pink/400 #F29DFF.', notes: '' },
    { id: 'package-ai', order: 3, name: 'Package.ai', primary: '#153B3F', secondary: '#39E5D0', style: 'twotone', stroke: 1.75, cap: 'square', join: 'miter', fillOpacity: 0.3, container: 'circle', containerColor: '#E3FFFB', source: 'Brand guideline palette: #153B3F, #39E5D0, #E3FFFB.', notes: '' },
    { id: 'oz', order: 4, name: 'OZ Global B2B', primary: '#0F0156', secondary: '#82D529', style: 'twotone', stroke: 2.25, cap: 'round', join: 'round', fillOpacity: 0.3, container: 'none', containerColor: '#DCD5FF', source: 'OZ presentation template palette: Navy #0F0156, Green #82D529, Lilac #DCD5FF.', notes: '' },
  ];
  const STYLE_LABELS = { outline: 'קו', duotone: 'דו־טון', twotone: 'שני צבעים', gradient: 'גרדיאנט' };
  const SPECIMEN = ['house', 'droplet', 'chart-line', 'shield-check', 'settings', 'users'];
  const ANIM_GLYPH = { fade: 'circle-dashed', grow: 'maximize-2', none: 'square', appear: 'sparkles', draw: 'pen-line', float: 'cloud', pulse: 'heart', bounce: 'arrow-big-up', wiggle: 'bell', spin: 'refresh-cw', halfspin: 'rotate-cw' };

  const S = {
    icons: [], byName: new Map(), brands: clone(DEFAULT_BRANDS), brandId: 'atlantium', draft: null, dirty: false,
    q: '', limit: 240, cur: 'droplet', anim: { type: 'draw', dur: 1.6, loop: true, stagger: 0.6, blur: false }, set: [],
    trans: { on: false, to: null, type: 'morph', dir: 'up' }, pickTarget: false, lib: 'all', exp: { size: 256, bg: 'white', bgColor: '#FFFFFF' }, mode: 'search', matches: [], db: null, persisted: false,
  };
  try { const s = JSON.parse(localStorage.getItem('iconstudio.session') || 'null'); if (s) { Object.assign(S.anim, s.anim || {}); S.set = s.set || []; S.cur = s.cur || S.cur; if (s.brandId) S.brandId = s.brandId; } } catch (e) {}
  const saveSession = () => { try { localStorage.setItem('iconstudio.session', JSON.stringify({ anim: S.anim, set: S.set, cur: S.cur, brandId: S.brandId })); } catch (e) {} };

  const brand = () => S.draft || S.brands.find((b) => b.id === S.brandId) || S.brands[0];
  const icon = (n) => S.byName.get(n);
  const T = window.IconTrans;
  const trOf = () => ({ type: S.trans.type, dir: S.trans.dir, dur: S.anim.dur, loop: S.anim.loop, blur: S.anim.blur });
  const transTarget = () => { if (!S.trans.on) return null; let n = S.trans.to; if (!n || n === S.cur || !S.byName.has(n)) n = S.set.find((x) => x !== S.cur && S.byName.has(x)) || null; S.trans.to = n; return n ? icon(n) : null; };

  // ---------- capabilities ----------
  const cap = (name) => (window.claude && window.claude.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  async function saveFile(filename, data) {
    const dl = await cap('downloads');
    if (dl) {
      try { await dl.save({ filename, data }); toast('הקובץ נשמר: ' + filename); }
      catch (e) { if (e && e.code === 'declined') return; toast('השמירה לא הצליחה: ' + (e && e.message ? e.message : 'נסו שוב')); }
      return;
    }
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('הקובץ נשמר: ' + filename);
  }
  async function copyText(text, what) {
    try { await navigator.clipboard.writeText(text); toast(what + ' הועתק. הדביקו בפיגמה או בקוד.'); }
    catch (e) {
      const d = $('#copyDlg');
      d.innerHTML = `<div class="dlg"><div class="dlghead"><h3>${esc(what)}</h3><button class="btn ghost" data-close>סגירה</button></div><p class="status">ההעתקה האוטומטית נחסמה. סמנו את הטקסט והעתיקו ידנית.</p><textarea class="text mono" rows="10" readonly>${esc(text)}</textarea></div>`;
      d.showModal(); $('textarea', d).select(); $('[data-close]', d).onclick = () => d.close();
    }
  }
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('לא ניתן לטעון ' + src)); document.head.appendChild(s); }); }
  let jszipP, gifencP, pdfP;
  const loadZip = () => (jszipP ||= loadScript('jszip.min.js').then(() => window.JSZip));
  const loadGif = () => (gifencP ||= import(new URL('gifenc.esm.js', document.baseURI).href));
  const loadPdf = () => (pdfP ||= loadScript('pdf.worker.min.js')
    .then(() => loadScript('pdf.min.js')).then(() => window.pdfjsLib));

  // ---------- brand store ----------
  function setSync(t) { $('#sync').textContent = t; }
  // Without the shared store (e.g. running from the git repo): start from brands.json, then apply anything saved in this browser.
  async function loadLocalBrands() {
    try { const f = await (await fetch('brands.json')).json(); if (Array.isArray(f) && f.length) S.brands = f; } catch (e) {}
    try {
      const l = JSON.parse(localStorage.getItem('iconstudio.brands') || 'null');
      if (Array.isArray(l)) for (const b of l) { const i = S.brands.findIndex((x) => x.id === b.id); if (i >= 0) S.brands[i] = b; else S.brands.push(b); }
    } catch (e) {}
    S.brands.sort((a, b) => (a.order || 99) - (b.order || 99));
    if (!S.brands.find((b) => b.id === S.brandId)) S.brandId = S.brands[0]?.id;
    setSync('נשמר בדפדפן זה בלבד');
  }
  async function initDb() {
    const db = await cap('db');
    if (!db) { await loadLocalBrands(); renderAll(); return; }
    S.db = db; setSync('מתחבר לחברות המשותפות…');
    const timer = setTimeout(() => setSync('החברות המשותפות לא זמינות כרגע'), 10000);
    db.collection('brands').onSnapshot((snap) => {
      if (!snap.metadata.fromCache) clearTimeout(timer);
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      if (list.length) { S.brands = list.sort((a, b) => (a.order || 99) - (b.order || 99)); S.persisted = true; setSync('משותף לכל הצוות'); }
      else if (!snap.metadata.fromCache) { setSync('אין עדיין חברות שמורות. שמירה תשתף אותן עם הצוות'); }
      if (!S.brands.find((b) => b.id === S.brandId)) S.brandId = S.brands[0]?.id;
      if (S.draft && !S.dirty) S.draft = null;
      renderAll();
    }, (e) => { clearTimeout(timer); setSync('החברות המשותפות לא זמינות כרגע'); });
  }
  async function persistBrand(b) {
    const idx = S.brands.findIndex((x) => x.id === b.id);
    if (idx >= 0) S.brands[idx] = b; else S.brands.push(b);
    if (S.db) {
      try { await S.db.collection('brands').doc(b.id).set(b); toast('החברה נשמרה ומשותפת עם הצוות'); }
      catch (e) { toast(e && e.code === 'invalid_argument' ? 'אין לכם הרשאה לשמור חברות בעמוד הזה' : 'השמירה נכשלה, נסו שוב'); }
    } else { try { localStorage.setItem('iconstudio.brands', JSON.stringify(S.brands)); } catch (e) {} toast('החברה נשמרה בדפדפן זה'); }
  }
  async function deleteBrand(id) {
    S.brands = S.brands.filter((b) => b.id !== id); S.draft = null; S.dirty = false; S.brandId = S.brands[0]?.id;
    if (S.db) { try { await S.db.collection('brands').doc(id).delete(); } catch (e) { toast('המחיקה נכשלה'); } }
    else { try { localStorage.setItem('iconstudio.brands', JSON.stringify(S.brands)); } catch (e) {} }
    renderAll();
  }

  // ---------- rendering helpers ----------
  const lum = (hex) => { const [r, g, b] = G.hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  function applyAccent() {
    const b = brand(); if (!b) return;
    document.documentElement.style.setProperty('--accent', b.primary);
    document.documentElement.style.setProperty('--accent-ink', lum(b.primary) > 0.45 ? '#16171C' : '#FFFFFF');
  }
  const svgFor = (n, b, o = {}) => { const ic = icon(n); return ic ? G.svgStatic(ic, b, o) : ''; };
  const neutral = { primary: 'currentColor', secondary: 'currentColor', style: 'outline', stroke: 2, cap: 'round', join: 'round', container: 'none' };

  const PREVIEW_ICONS = ['droplet', 'chart-line', 'shield-check', 'users', 'settings'];
  let brandMenuOpen = false;
  function renderBrands() {
    const cur = brand(), sw = (b) => `<span class="sw"><i style="background:${esc(b.primary)}"></i><i style="background:${esc(b.secondary)}"></i></span>`;
    const prev = (b) => `<span class="bm-icons">${PREVIEW_ICONS.map((n) => svgFor(n, b, { size: 22, id: 'bm' + b.id })).join('')}</span>`;
    $('#brands').innerHTML = `<div class="bmenu">
        <button class="brand-chip bm-btn" id="bmBtn" aria-haspopup="listbox" aria-expanded="${brandMenuOpen}">${sw(cur)}<span class="bm-name">${esc(cur.name)}</span>${prev(cur)}<span class="bm-change">החלפת חברה ▾</span></button>
        <div class="bm-pop" id="bmPop" role="listbox" aria-label="בחירת חברה"${brandMenuOpen ? '' : ' hidden'}>
          ${S.brands.length > 6 ? '<input class="text bm-q" id="bmQ" type="search" placeholder="חיפוש חברה…" aria-label="חיפוש חברה">' : ''}
          <div class="bm-list">${S.brands.map((b) => `<button class="bm-row brand-chip" role="option" data-id="${esc(b.id)}" data-name="${esc(b.name.toLowerCase())}" aria-selected="${b.id === cur.id}" aria-pressed="${b.id === cur.id}">${sw(b)}<span class="bm-name">${esc(b.name)}</span>${prev(b)}</button>`).join('')}</div>
          <button class="brand-chip add" id="addBrand">+ חברה חדשה</button>
        </div></div>`;
    const setOpen = (v) => { brandMenuOpen = v; $('#bmPop').hidden = !v; $('#bmBtn').setAttribute('aria-expanded', v); if (v) { const q = $('#bmQ'); if (q) q.focus(); } };
    $('#bmBtn').onclick = (e) => { e.stopPropagation(); setOpen(!brandMenuOpen); };
    $('#bmPop').onclick = (e) => e.stopPropagation();
    const q = $('#bmQ'); if (q) q.oninput = () => { const v = q.value.trim().toLowerCase(); $$('.bm-row').forEach((r) => { r.hidden = !!v && !r.dataset.name.includes(v); }); };
    $$('#brands .bm-row').forEach((el) => el.onclick = () => {
      if (S.dirty && !confirmLeave()) return;
      brandMenuOpen = false; S.brandId = el.dataset.id; S.draft = null; S.dirty = false; saveSession(); renderAll();
    });
    $('#addBrand').onclick = () => { brandMenuOpen = false; renderBrands(); openBrandDialog(null); };
  }
  function confirmLeave() { toast('יש שינויים שלא נשמרו. שמרו או בטלו אותם קודם.'); return false; }

  function seg(name, opts, val) {
    return `<div class="seg" role="group" data-k="${name}">` + opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join('') + '</div>';
  }
  function colorField(k, label, v) {
    return `<div class="color"><input type="color" id="c-${k}" data-k="${k}" value="${esc(v)}" aria-label="${label}"><input type="text" data-k="${k}" value="${esc(v.toUpperCase())}" aria-label="${label} HEX" maxlength="7"><span>${label}</span></div>`;
  }

  function renderBrandPanel() {
    const b = brand(); const P = $('#brandPanel'); if (!b) { P.innerHTML = ''; return; }
    P.innerHTML = `
      <h2>סגנון המותג</h2>
      <div class="field"><label for="bName">שם החברה</label><input class="text" id="bName" value="${esc(b.name)}"></div>
      ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ''}
      <div class="specimen" aria-label="דוגמה">${SPECIMEN.map((n) => `<div>${svgFor(n, b, { size: 32, id: 'sp' + n })}</div>`).join('')}</div>
      <div class="field"><span class="lbl">צבעים</span>${colorField('primary', 'ראשי', b.primary)}${colorField('secondary', 'משני', b.secondary)}</div>
      <div class="field"><span class="lbl">סגנון</span>${seg('style', Object.entries(STYLE_LABELS), b.style)}</div>
      <div class="field"><label for="r-stroke">עובי קו</label><div class="row"><input type="range" id="r-stroke" data-k="stroke" min="0.75" max="3" step="0.25" value="${b.stroke}"><span class="val">${b.stroke}px</span></div></div>
      ${b.style === 'duotone' ? `<div class="field"><label for="r-fill">עוצמת המילוי</label><div class="row"><input type="range" id="r-fill" data-k="fillOpacity" min="0.1" max="1" step="0.05" value="${b.fillOpacity ?? 0.3}"><span class="val">${Math.round((b.fillOpacity ?? 0.3) * 100)}%</span></div></div>` : ''}
      <div class="field"><span class="lbl">קצה הקו</span>${seg('cap', [['round', 'מעוגל'], ['butt', 'ישר'], ['square', 'מרובע']], b.cap)}</div>
      <div class="field"><span class="lbl">פינות</span>${seg('join', [['round', 'מעוגלות'], ['miter', 'חדות'], ['bevel', 'קטומות']], b.join)}</div>
      <div class="field"><span class="lbl">מסגרת</span>${seg('container', [['none', 'ללא'], ['circle', 'עיגול'], ['square', 'ריבוע']], b.container || 'none')}
        ${b.container && b.container !== 'none' ? colorField('containerColor', 'רקע המסגרת', b.containerColor || '#EEEEEE') : ''}</div>
      ${S.dirty ? '<p class="dirty">יש שינויים שלא נשמרו</p>' : ''}
      <div class="row" style="flex-wrap:wrap">
        <button class="btn primary" id="bSave" ${S.dirty ? '' : 'disabled'}>שמירה לחברה</button>
        <button class="btn" id="bRevert" ${S.dirty ? '' : 'disabled'}>ביטול</button>
      </div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap">
        <button class="btn small" id="bBook">ניתוח brandbook</button>
        <button class="btn small ghost" id="bDel">מחיקת החברה</button>
      </div>
      ${b.source ? `<p class="status" style="margin-top:14px">מקור: ${esc(b.source)}</p>` : ''}`;
    const edit = (k, v) => { if (!S.draft) S.draft = clone(brand()); S.draft[k] = v; S.dirty = true; refreshStyle(); };
    $('#bName').oninput = (e) => { if (!S.draft) S.draft = clone(brand()); S.draft.name = e.target.value; S.dirty = true; $('#bSave').disabled = false; $('#bRevert').disabled = false; };
    $$('.seg[data-k] button', P).forEach((btn) => btn.onclick = () => edit(btn.parentElement.dataset.k, btn.dataset.v));
    $$('input[type=range]', P).forEach((r) => r.oninput = () => edit(r.dataset.k, +r.value));
    $$('input[type=color]', P).forEach((c) => c.oninput = () => edit(c.dataset.k, c.value.toUpperCase()));
    $$('.color input[type=text]', P).forEach((c) => c.onchange = () => { let v = c.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) edit(c.dataset.k, v.toUpperCase()); else { c.value = brand()[c.dataset.k]; toast('צבע צריך להיות בפורמט HEX, למשל #202657'); } });
    $('#bSave').onclick = async () => { const d = S.draft; S.draft = null; S.dirty = false; await persistBrand(d); renderAll(); };
    $('#bRevert').onclick = () => { S.draft = null; S.dirty = false; renderAll(); };
    $('#bBook').onclick = () => openBrandDialog(brand());
    const del = $('#bDel');
    del.onclick = () => { if (del.dataset.arm) deleteBrand(brand().id); else { del.dataset.arm = 1; del.textContent = 'לחצו שוב למחיקה'; del.style.color = 'var(--warn)'; setTimeout(() => { if (del.isConnected) { delete del.dataset.arm; del.textContent = 'מחיקת החברה'; del.style.color = ''; } }, 3000); } };
  }
  let styleRaf = 0;
  function refreshStyle() {
    cancelAnimationFrame(styleRaf);
    styleRaf = requestAnimationFrame(() => {
      const fe = document.activeElement, fid = fe && fe.id, sel = fe && fe.selectionStart;
      renderBrandPanel(); applyAccent(); renderGrid(); renderInspector(); renderTray(); if (S.mode === 'words') renderWordRows();
      if (fid && document.getElementById(fid)) { const el = document.getElementById(fid); el.focus(); try { if (sel != null) el.setSelectionRange(sel, sel); } catch (e) {} }
    });
  }

  // ---------- library ----------
  const IS_HE = /[֐-׿]/;
  let heAI = {}; try { heAI = JSON.parse(localStorage.getItem('oz.heAI') || '{}') || {}; } catch (e) { heAI = {}; }
  const heAsked = new Set(); let heBusy = false;
  function heKeys(term) {
    const D = window.HE_DICT || {}; const t = term.replace(/["'׳״]/g, (c) => (c === '׳' ? "'" : c)).trim();
    const look = (w) => D[w] || HE[w] || heAI[w];
    const tries = [t];
    for (const w of [t, t.replace(/^[והבלמשכ]/, ''), t.replace(/^[והבלמשכ]{2}/, '')]) {
      if (w.length < 2) continue; tries.push(w);
      if (w.endsWith('ים')) tries.push(w.slice(0, -2)); if (w.endsWith('ות')) tries.push(w.slice(0, -2) + 'ה', w.slice(0, -2), w.slice(0, -2) + 'ת');
      if (/[ךםןףץ]$/.test(w)) tries.push(w.slice(0, -1) + { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[w.slice(-1)]);
    }
    for (const w of tries) { const v = look(w); if (v) return (Array.isArray(v) ? v : String(v).split(/\s+/)).map((x) => x.toLowerCase()).filter(Boolean); }
    return null;
  }
  function keyScore(ic, k) {
    if (ic.b === k) return 100; const parts = ic.b.split('-');
    if (parts[0] === k) return 60; if (parts.includes(k)) return 50; if (ic.b.includes(k)) return 25;
    if (ic.t.includes(k)) return 20; if (k.includes('-') && parts.includes(k.split('-')[0])) return 15; if (k.length > 3 && ic.t.some((x) => x.includes(k))) return 8; return 0;
  }
  async function translateHe(terms) {
    terms = terms.filter((t) => !heAsked.has(t)); if (!terms.length || heBusy) return; terms.forEach((t) => heAsked.add(t));
    const sample = await cap('sample'); if (!sample) return;
    heBusy = true; renderGrid();
    try {
      const r = await sample.json(`Translate Hebrew search words into English keywords for the Lucide icon library (names like "droplet", "shield-check", "chart-line", "users", "wrench", "truck").
For each word return 2-5 short lowercase English keywords that name an icon for it, most literal first.
Return ONLY a JSON object {"<hebrew word>": ["kw1","kw2"]}. Words: ${JSON.stringify(terms)}`, { modelTier: 'quick' });
      if (r && typeof r === 'object') { for (const t of terms) if (Array.isArray(r[t]) && r[t].length) heAI[t] = r[t].map(String); try { localStorage.setItem('oz.heAI', JSON.stringify(heAI)); } catch (e) {} }
    } catch (e) {}
    heBusy = false; renderGrid();
  }
  S.heMissing = [];
  function filtered() {
    const q = S.q.trim().toLowerCase(); S.heMissing = []; const POOL = S.lib === 'all' ? S.icons : S.icons.filter((ic) => ic.src === S.lib); if (!q) return POOL;
    if (IS_HE.test(q)) {
      const whole = heKeys(q); let groups;
      if (whole) groups = [whole];
      else {
        groups = q.split(/\s+/).map((t) => (IS_HE.test(t) ? heKeys(t) : [t]));
        S.heMissing = q.split(/\s+/).filter((t, i) => !groups[i]);
        if (S.heMissing.length) { clearTimeout(filtered.t); filtered.t = setTimeout(() => translateHe(S.heMissing.slice()), 500); }
        groups = groups.filter(Boolean); if (!groups.length) return [];
      }
      return POOL.map((ic) => {
        let s = 0;
        for (const g of groups) { let best = 0; g.forEach((k, i) => { best = Math.max(best, keyScore(ic, k) * (1 - Math.min(i, 5) * 0.08)); }); s += best + (best ? 30 : 0); }
        return [s - ic.b.length * 0.05, ic];
      }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    }
    const terms = q.split(/\s+/);
    return POOL.map((ic) => {
      let s = 0;
      for (const t of terms) {
        if (ic.b === t) s += 100; else if (ic.b.startsWith(t)) s += 40; else if (ic.b.includes(t)) s += 25;
        else if (ic.t.some((x) => x === t)) s += 20; else if (ic.t.some((x) => x.includes(t))) s += 8; else return [0, ic];
      }
      return [s - ic.b.length * 0.05, ic];
    }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }
  function renderGrid() {
    if (S.mode !== 'search') return;
    const b = brand(), list = filtered(), shown = list.slice(0, S.limit);
    $('#count').textContent = `${list.length.toLocaleString('he-IL')} אייקונים`;
    $('#grid').innerHTML = shown.map((ic) => `<div class="tile" role="listitem" data-n="${ic.n}" aria-current="${ic.n === S.cur}" tabindex="0" title="${ic.n}">
        <button class="add" data-add="${ic.n}" aria-pressed="${S.set.includes(ic.n)}" aria-label="${S.set.includes(ic.n) ? 'הסרה מהסט' : 'הוספה לסט'} ${ic.n}">${S.set.includes(ic.n) ? '✓' : '+'}</button>
        <div class="ic">${G.svgStatic(ic, b, { size: 40, id: 't' })}</div><span class="nm">${ic.n}</span></div>`).join('')
      + (list.length > shown.length ? `<button class="btn more" id="more">הצגת עוד ${Math.min(240, list.length - shown.length)}</button>` : '')
      + (list.length ? '' : `<p class="empty">${heBusy ? `מתרגם את "${esc(S.q)}" לאנגלית…` : `לא נמצא אייקון עבור "${esc(S.q)}". נסו מילה אחרת, בעברית או באנגלית.`}</p>`);
  }
  $('#grid').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]'); if (add) { toggleSet(add.dataset.add); return; }
    if (e.target.id === 'more') { S.limit += 240; renderGrid(); return; }
    const t = e.target.closest('.tile'); if (t) select(t.dataset.n);
  });
  $('#grid').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tile')) { e.preventDefault(); select(e.target.dataset.n); } });
  let qT; $('#q').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; S.limit = 240; renderGrid(); }, 120); });
  function select(n) { if (S.pickTarget) { S.pickTarget = false; if (n !== S.cur) S.trans.to = n; renderInspector(); return; } S.cur = n; saveSession(); $$('.tile[aria-current="true"]').forEach((t) => t.setAttribute('aria-current', 'false')); const t = $(`.tile[data-n="${n}"]`); if (t) t.setAttribute('aria-current', 'true'); renderInspector(); }
  function toggleSet(n) {
    const i = S.set.indexOf(n); if (i >= 0) S.set.splice(i, 1); else S.set.push(n);
    saveSession(); renderTray();
    const a = $(`[data-add="${n}"]`); if (a) { const on = S.set.includes(n); a.setAttribute('aria-pressed', on); a.textContent = on ? '✓' : '+'; }
    const ib = $('#insAdd'); if (ib && n === S.cur) ib.textContent = S.set.includes(n) ? 'הסרה מהסט' : 'הוספה לסט';
  }

  // ---------- word list ----------
  function setMode(m) {
    S.mode = m; $('#modeSearch').setAttribute('aria-pressed', m === 'search'); $('#modeWords').setAttribute('aria-pressed', m === 'words');
    $('#grid').hidden = m !== 'search'; $('#words').hidden = m !== 'words'; $('#searchBox').hidden = m !== 'search'; $('#count').hidden = m !== 'search'; $('#libSeg').hidden = m !== 'search';
    if (m === 'search') renderGrid(); else renderWordRows();
  }
  $$('#libSeg [data-lib]').forEach((x) => x.onclick = () => { S.lib = x.dataset.lib; S.limit = 240; $$('#libSeg [data-lib]').forEach((y) => y.setAttribute('aria-pressed', y === x)); renderGrid(); });
  $('#modeSearch').onclick = () => setMode('search'); $('#modeWords').onclick = () => setMode('words');
  function rankFor(keys) {
    const scores = new Map();
    for (const raw of keys) {
      const k = raw.toLowerCase().trim(); if (!k) continue; const dash = k.replace(/\s+/g, '-'); const toks = k.split(/[\s-]+/).filter(Boolean);
      for (const ic of S.icons) {
        let s = 0;
        if (ic.b === dash) s = 100;
        else {
          const parts = ic.b.split('-');
          const hit = toks.filter((t) => parts.includes(t)).length;
          if (hit) s = 40 + 15 * hit - (parts.length - hit) * 4;
          if (ic.t.includes(k)) s = Math.max(s, 45);
          const th = toks.filter((t) => ic.t.includes(t)).length; if (th) s = Math.max(s, 18 + 8 * th);
        }
        if (s > 0) scores.set(ic.n, Math.max(scores.get(ic.n) || 0, s - ic.b.length * 0.1 - (ic.src === 'lu' ? 0 : 2)));
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  }
  const HE = {"מים": "water droplet", "טיפה": "droplet", "מנורה": "lamp lightbulb", "נורה": "lightbulb", "שמש": "sun", "חיישן": "radar sensor", "מגן": "shield", "אבטחה": "shield lock", "מנעול": "lock", "לוח בקרה": "dashboard gauge", "דשבורד": "dashboard gauge", "אנרגיה": "zap battery", "חשמל": "zap plug", "ענן": "cloud", "הגדרות": "settings", "התראה": "bell exclamation", "אזהרה": "triangle exclamation", "צוות": "users", "אנשים": "users", "משתמש": "user", "לקוח": "user", "גרף": "chart", "נתונים": "database chart", "תחזוקה": "wrench", "כלים": "wrench hammer", "עלה": "leaf", "סביבה": "leaf", "בית": "house", "בניין": "building", "מפעל": "factory", "משאית": "truck", "משלוח": "truck package", "חבילה": "package", "אריזה": "package box", "עגלה": "shopping-cart", "קנייה": "shopping-cart", "כסף": "banknote", "מחיר": "tag", "תשלום": "credit-card", "טלפון": "phone", "מייל": "mail", "דואר": "mail", "הודעה": "message", "צ'אט": "message-circle", "שיחה": "messages", "מיקום": "map-pin", "מפה": "map", "עולם": "globe", "גלובלי": "globe", "זמן": "clock", "שעון": "clock", "לוח שנה": "calendar", "תאריך": "calendar", "מסמך": "file-text", "קובץ": "file", "תיקייה": "folder", "חיפוש": "search", "מטרה": "target", "יעד": "target", "רעיון": "lightbulb", "חדשנות": "lightbulb rocket", "טיל": "rocket", "צמיחה": "trending-up", "מכירות": "trending-up chart", "בריאות": "heart-pulse", "לב": "heart", "רפואה": "stethoscope", "מעבדה": "flask-conical", "מדע": "atom", "בינה מלאכותית": "brain sparkles", "מוח": "brain", "מחשב": "laptop", "שרת": "server", "ענן נתונים": "cloud database", "רשת": "network", "חיבור": "link", "אינטגרציה": "plug blocks", "קוד": "code", "אפליקציה": "smartphone", "מובייל": "smartphone", "מצלמה": "camera", "וידאו": "video", "תמונה": "image", "מוזיקה": "music", "כוכב": "star", "איכות": "badge-check award", "פרס": "award trophy", "תמיכה": "headset life-buoy", "עזרה": "circle-help", "מידע": "info", "בדיקה": "check", "אישור": "circle-check", "סגירה": "x", "הורדה": "download", "העלאה": "upload", "שיתוף": "share", "אש": "flame", "טמפרטורה": "thermometer", "חום": "thermometer flame", "קור": "snowflake", "רוח": "wind", "גשם": "cloud-rain", "מזג אוויר": "cloud-sun", "מנוע": "engine cog", "גלגל שיניים": "cog", "מכונה": "cog factory", "רכב": "car", "אוניה": "ship", "מטוס": "plane", "חקלאות": "sprout tractor", "צמח": "sprout", "מזון": "utensils", "קפה": "coffee", "חינוך": "graduation-cap", "ספר": "book", "הדרכה": "presentation", "מצגת": "presentation", "יד": "hand", "לחיצת יד": "handshake", "שותפות": "handshake", "מיחזור": "recycle", "קרינה": "radiation", "UV": "sun lamp", "מנורת UV": "lamp sun", "יעילות": "gauge zap", "ביצועים": "gauge activity", "מהירות": "gauge rocket", "פילטר": "filter", "סינון": "filter", "זרימה": "waves", "גלים": "waves", "בקרה": "sliders-horizontal", "מדידה": "ruler gauge"};
  async function matchWords() {
    const words = $('#wordsIn').value.split(/[\n,،;]+/).map((w) => w.trim()).filter(Boolean).slice(0, 40);
    if (!words.length) { $('#matchStatus').textContent = 'הקלידו לפחות מילה אחת'; return; }
    $('#matchBtn').disabled = true; $('#matchStatus').textContent = 'מתאים…';
    let keyMap = {};
    const sample = await cap('sample');
    if (sample) {
      try {
        $('#matchStatus').textContent = 'Claude מתרגם את המילים למושגי אייקונים…';
        keyMap = await sample.json(`You map words to icon search keywords for the Lucide icon library (names like "droplet", "shield-check", "chart-line", "users", "wrench").
For each input word or phrase (any language, often Hebrew), return 2-4 short English keywords that best describe a single icon for it, most literal first.
Return ONLY a JSON object: {"<original word>": ["kw1","kw2",...], ...}.
Words: ${JSON.stringify(words)}`, { modelTier: 'quick' }) || {};
      } catch (e) { keyMap = {}; }
    }
    S.matches = words.map((w) => {
      const keys = [w, ...(Array.isArray(keyMap[w]) ? keyMap[w] : []), ...(HE[w] ? HE[w].split(' ') : []), ...w.split(/\s+/).flatMap((x) => (HE[x] ? HE[x].split(' ') : []))];
      const alts = rankFor(keys);
      return { w, alts, pick: alts[0] || null };
    });
    const miss = S.matches.filter((m) => !m.pick).length;
    $('#matchStatus').textContent = `${S.matches.length - miss} מתוך ${S.matches.length} הותאמו` + (miss ? (sample ? '' : '. למילים בעברית בלי חיבור ל־Claude נסו מילה באנגלית') : '');
    $('#matchBtn').disabled = false; $('#addMatched').disabled = !S.matches.some((m) => m.pick);
    renderWordRows();
  }
  function renderWordRows() {
    const b = brand();
    $('#wordRows').innerHTML = S.matches.map((m, i) => `<div class="wrow"><span class="w">${esc(m.w)}</span>
      <div class="alts">${m.alts.length ? m.alts.map((n) => `<button class="alt" data-i="${i}" data-n="${n}" aria-pressed="${m.pick === n}" title="${n}" aria-label="${n}">${svgFor(n, b, { size: 30, id: 'w' })}</button>`).join('') : '<span class="miss">לא נמצא אייקון מתאים. נסו מילה אחרת.</span>'}</div></div>`).join('');
  }
  $('#matchBtn').onclick = matchWords;
  $('#wordRows').addEventListener('click', (e) => { const a = e.target.closest('.alt'); if (!a) return; S.matches[+a.dataset.i].pick = a.dataset.n; select(a.dataset.n); renderWordRows(); });
  $('#addMatched').onclick = () => { let k = 0; for (const m of S.matches) if (m.pick && !S.set.includes(m.pick)) { S.set.push(m.pick); k++; } saveSession(); renderTray(); toast(`נוספו ${k} אייקונים לסט`); };

  // ---------- inspector ----------
  const SIZES = [24, 32, 48, 64, 128, 256, 512];
  // Morph recommendations: score related icons by how cleanly they morph from the current one.
  let recJob = 0; const recCache = new Map();
  const baseOf = (x) => x.b.split('-')[0];
  function recPool(ic, B) {
    const ba = baseOf(ic), bb = B ? baseOf(B) : null, tags = new Set(ic.t), tok = new Set(ic.b.split('-'));
    const variants = [], other = [];
    for (const x of S.icons) {
      if (x.n === ic.n || baseOf(x) === ba) continue;
      if (bb && baseOf(x) === bb) { if (x.n !== B.n) variants.push(x); continue; }
      let r = 0; if (S.set.includes(x.n)) r += 3; if (tok.has(baseOf(x))) r += 2; for (const t of x.t) if (tags.has(t)) r += 1;
      if (r >= 2) other.push([r, x]);
    }
    return { variants: variants.slice(0, 60), other: other.sort((a, b) => b[0] - a[0]).slice(0, 400).map((x) => x[1]) };
  }
  function showRecs(ic, R) {
    const el = $('#trRecs'); if (!el) return; const b = brand();
    const tiles = (list) => list.map(([s, x]) => `<button class="ti" data-rec="${x.n}" title="${x.n}" aria-label="מעבר אל ${x.n}" aria-current="${x.n === S.trans.to}" style="width:44px;height:44px">${G.svgStatic(x, b, { size: 26, id: 'rc' })}</button>`).join('');
    const B = S.trans.to && icon(S.trans.to);
    el.innerHTML = (R.variants.length > 1 && B ? `<div style="width:100%"><span class="status">גרסאות של ${esc(baseOf(B))}, מהחלקה ביותר:</span><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${tiles(R.variants)}</div></div>` : '')
      + `<div style="width:100%"><span class="status">מעברים חלקים לאייקונים קשורים:</span><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${R.other.length ? tiles(R.other) : '<span class="status">לא נמצאו</span>'}</div></div>`;
    $$('[data-rec]', el).forEach((x) => x.onclick = () => { S.trans.to = x.dataset.rec; renderInspector(); });
  }
  async function recommend(ic) {
    const b = brand(), B = S.trans.to && icon(S.trans.to), key = ic.n + '|' + (B ? baseOf(B) : '') + '|' + b.join; const job = ++recJob;
    if (recCache.has(key)) { showRecs(ic, recCache.get(key)); return; }
    const P = recPool(ic, B), score = async (list) => {
      const res = [];
      for (let i = 0; i < list.length; i++) { try { const v = T.morphScore(ic, list[i], b); if (isFinite(v)) res.push([v, list[i]]); } catch (e) {} if (i % 40 === 39) { await new Promise((r) => setTimeout(r)); if (job !== recJob) return null; } }
      return res.sort((a, c) => a[0] - c[0]);
    };
    const v = await score([...(B ? [B] : []), ...P.variants]); if (!v) return;
    const o = await score(P.other); if (!o) return;
    const seen = new Set(), top = [];
    for (const r of o) { const k = r[1].e.length + ':' + Math.round(r[0] * 20); if (seen.has(k)) continue; seen.add(k); top.push(r); if (top.length >= 8) break; }
    const R = { variants: v.slice(0, 8), other: top }; recCache.set(key, R); if (job === recJob) showRecs(ic, R);
  }
  function transControls(ic) {
    const B = transTarget(), b = brand();
    const others = [...new Set([...(S.trans.to ? [S.trans.to] : []), ...S.set])].filter((x) => x !== ic.n && S.byName.has(x));
    return `<div class="field" style="margin:10px 0 8px"><span class="lbl">מעבר מ־<b class="mono">${ic.n}</b> אל</span>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${B ? `<span class="ti" style="width:40px;height:40px;cursor:default">${G.svgStatic(B, b, { size: 26, id: 'tt' })}</span>` : ''}
          <select class="text" id="trTo" style="flex:1;min-width:120px" aria-label="אייקון היעד">${others.length ? others.map((x) => `<option value="${x}" ${B && x === B.n ? 'selected' : ''}>${x}</option>`).join('') : '<option value="">אין עוד אייקונים בסט</option>'}</select>
          <button class="btn small" id="trPick" aria-pressed="${S.pickTarget}">${S.pickTarget ? 'לחצו על אייקון בספרייה…' : 'בחירה מהספרייה'}</button>
        </div></div>
      <div class="field" style="margin:0 0 8px"><span class="lbl">סוג המעבר</span>${seg('ttype', T.TRANS.map((x) => [x.id, x.he]), S.trans.type)}</div>
      ${S.trans.type === 'slide' ? `<div class="field" style="margin:0 0 8px"><span class="lbl">כיוון</span>${seg('tdir', [['up', 'למעלה'], ['down', 'למטה'], ['right', 'ימינה'], ['left', 'שמאלה']], S.trans.dir)}</div>` : ''}
      ${S.trans.type === 'morph' ? `<div class="field" style="margin:0 0 8px"><span class="lbl">מומלצים למורף מ־${ic.n}</span><div id="trRecs" class="row" style="gap:6px;flex-wrap:wrap"><span class="status">מחשב…</span></div></div>` : ''}
      <p class="status" style="margin:0 0 8px">${S.trans.type === 'morph' ? 'כל קו באייקון זורם לקו הקרוב אליו באייקון השני. קווים עודפים מתכווצים ונעלמים.' : S.trans.type === 'scale' ? 'שני האייקונים עוברים אותו שינוי גודל, והחיתוך ביניהם קורה בשיא התנועה, כמו match cut.' : 'האייקון יוצא מהמסגרת והאייקון הבא נכנס מהצד השני.'} ${S.anim.loop ? 'בלולאה המעבר חוזר גם אחורה.' : ''}</p>`;
  }
  function renderInspector() {
    const P = $('#inspector'), ic = icon(S.cur), b = brand();
    if (!ic) { P.innerHTML = '<p class="empty">בחרו אייקון מהספרייה</p>'; return; }
    const bg = S.exp.bg;
    P.innerHTML = `
      <div class="row" style="justify-content:space-between"><div><h2 style="margin:0">אייקון נבחר</h2><h3 class="mono" style="font-size:18px">${ic.n}</h3></div>
        <button class="btn small" id="insAdd">${S.set.includes(ic.n) ? 'הסרה מהסט' : 'הוספה לסט'}</button></div>
      <div class="stage" data-bg="${bg}" style="--stagebg:${esc(S.exp.bgColor)}"><div id="stageIc" data-live="main"></div>
        <span class="tag">${esc(b.name)} · ${STYLE_LABELS[b.style]} · ${b.stroke}px</span></div>
      <div><h2>הנפשה</h2>${seg('tmode', [['icon', 'הנפשת אייקון'], ['trans', 'מעבר בין אייקונים']], S.trans.on ? 'trans' : 'icon')}
        ${S.trans.on ? transControls(ic) : `<p class="status" style="margin:8px 0 8px">אפשר לבחור כמה הנפשות יחד, למשל ציור קו + הגדלה. "ללא" מנקה.</p><div class="anims">${G.ANIMS.map((a) => `<button class="anim" data-a="${a.id}" aria-pressed="${S.anim.type.split('+').includes(a.id)}"><span data-live="${a.id}"></span>${a.he}</button>`).join('')}</div>`}</div>
      <div class="grid2">
        <div class="field" style="margin:0"><label for="dur">משך</label><div class="row"><input type="range" id="dur" min="0.6" max="4" step="0.1" value="${S.anim.dur}"><span class="val">${S.anim.dur}s</span></div></div>
        <div class="field" id="staggerF" style="margin:0"${!S.trans.on && S.anim.type.split('+').includes('draw') ? '' : ' hidden'}><label for="stagger">השהיה בין קווים</label><div class="row"><input type="range" id="stagger" min="0" max="1" step="0.05" value="${S.anim.stagger ?? 0.6}"><span class="val">${Math.round((S.anim.stagger ?? 0.6) * 100)}%</span></div></div>
        <div class="field" style="margin:0"><span class="lbl">חזרה</span>${seg('loop', [['true', 'בלולאה'], ['false', 'פעם אחת']], S.anim.loop)}</div>
        <div class="field" style="margin:0"><span class="lbl">טשטוש תנועה</span>${seg('blur', [['false', 'בלי טשטוש'], ['true', 'עם טשטוש']], !!S.anim.blur)}</div>
      </div>
      <div><h2>ייצוא</h2>
        <div class="grid2" style="margin-bottom:10px">
          <div class="field" style="margin:0"><label for="expSize">גודל</label><select class="text" id="expSize">${SIZES.map((s) => `<option ${s === S.exp.size ? 'selected' : ''} value="${s}">${s}px</option>`).join('')}</select></div>
        </div>
        <div class="field" style="margin:0 0 10px"><span class="lbl">רקע בקבצים המיוצאים</span>${seg('bg', [['white', 'רקע לבן'], ['transparent', 'ללא רקע'], ['color', 'צבע לבחירה']], bg)}
          ${bg === 'color' ? `<div class="color" style="margin-top:6px"><input type="color" id="bgColor" value="${esc(S.exp.bgColor)}" aria-label="צבע רקע"><input type="text" id="bgHex" value="${esc(S.exp.bgColor)}" aria-label="קוד צבע הרקע" maxlength="7"><span>צבע הרקע</span></div>
          <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${[b.primary, b.secondary, b.containerColor].filter(Boolean).map((c) => `<button type="button" class="btn small" data-bgc="${esc(c)}" style="gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:${esc(c)};border:1px solid var(--line)"></i>${esc(c)}</button>`).join('')}</div>` : ''}
          <span class="status">חל על SVG, SVG מונפש, Lottie, GIF ו־PNG.</span></div>
        <div class="exports">
          <button class="btn" data-x="svg">SVG<small>סטטי, לפיגמה</small></button>
          <button class="btn" data-x="asvg">SVG מונפש<small>CSS מובנה</small></button>
          <button class="btn" data-x="lottie">Lottie<small>JSON</small></button>
          <button class="btn" data-x="gif">GIF<small>סושיאל ומצגות</small></button>
          <button class="btn" data-x="png">PNG<small>סטטי</small></button>
          <button class="btn" data-x="mp">כל הפורמטים<small>ZIP</small></button>
        </div>
        ${bg === 'transparent' ? '<p class="status" style="margin:8px 0 0">ב־GIF רקע שקוף נותן קצוות פחות חלקים. לסושיאל עדיף רקע בצבע.</p>' : ''}
      </div>
      <div class="copies"><button class="btn" id="cpFigma">העתקת SVG לפיגמה</button><button class="btn" id="cpCode">העתקת קוד לאתר</button></div>`;
    $('#insAdd').onclick = () => toggleSet(ic.n);
    $$('.anim', P).forEach((a) => a.onclick = () => {
      const id = a.dataset.a; let cur = S.anim.type.split('+').filter((x) => x && x !== 'none');
      if (id === 'none') cur = []; else cur = cur.includes(id) ? cur.filter((x) => x !== id) : G.ANIMS.map((x) => x.id).filter((x) => x === id || cur.includes(x));
      S.anim.type = cur.join('+') || 'none'; saveSession(); $('#staggerF').hidden = !cur.includes('draw');
      const on = S.anim.type.split('+'); $$('.anim', P).forEach((x) => x.setAttribute('aria-pressed', on.includes(x.dataset.a))); t0 = performance.now(); renderTray(); });
    $('#stagger').oninput = (e) => { S.anim.stagger = +e.target.value; e.target.nextElementSibling.textContent = Math.round(S.anim.stagger * 100) + '%'; saveSession(); };
    $('#dur').oninput = (e) => { S.anim.dur = +e.target.value; e.target.nextElementSibling.textContent = S.anim.dur + 's'; saveSession(); };
    $$('.seg[data-k="loop"] button', P).forEach((x) => x.onclick = () => { S.anim.loop = x.dataset.v === 'true'; saveSession(); renderInspector(); });
    $$('.seg[data-k="blur"] button', P).forEach((x) => x.onclick = () => { S.anim.blur = x.dataset.v === 'true'; saveSession(); renderInspector(); });
    $$('.seg[data-k="tmode"] button', P).forEach((x) => x.onclick = () => { S.trans.on = x.dataset.v === 'trans'; S.pickTarget = false; renderInspector(); });
    $$('.seg[data-k="ttype"] button', P).forEach((x) => x.onclick = () => { S.trans.type = x.dataset.v; renderInspector(); });
    $$('.seg[data-k="tdir"] button', P).forEach((x) => x.onclick = () => { S.trans.dir = x.dataset.v; renderInspector(); });
    if (S.trans.on && S.trans.type === 'morph') recommend(ic);
    const tt = $('#trTo'); if (tt) tt.onchange = () => { if (tt.value) { S.trans.to = tt.value; renderInspector(); } };
    const tp = $('#trPick'); if (tp) tp.onclick = () => { S.pickTarget = !S.pickTarget; renderInspector(); if (S.pickTarget) toast('לחצו על אייקון בספרייה או בסט כדי לבחור את היעד'); };
    $$('.seg[data-k="bg"] button', P).forEach((x) => x.onclick = () => { S.exp.bg = x.dataset.v; renderInspector(); });
    const setBg = (v) => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; S.exp.bgColor = v.toUpperCase(); $('.stage', P).style.setProperty('--stagebg', v); const c = $('#bgColor'), h = $('#bgHex'); if (c && c.value.toLowerCase() !== v.toLowerCase()) c.value = v; if (h && document.activeElement !== h) h.value = S.exp.bgColor; };
    const bc = $('#bgColor'); if (bc) bc.oninput = () => setBg(bc.value);
    const bh = $('#bgHex'); if (bh) bh.oninput = () => setBg(bh.value.trim().startsWith('#') ? bh.value.trim() : '#' + bh.value.trim());
    $$('[data-bgc]', P).forEach((x) => x.onclick = () => setBg(x.dataset.bgc));
    $('#expSize').onchange = (e) => { S.exp.size = +e.target.value; };
    $$('[data-x]', P).forEach((x) => x.onclick = () => exportOne(ic, x.dataset.x, x));
    $('#cpFigma').onclick = () => copyText(G.svgStatic(ic, b, { size: S.exp.size, id: ic.n, bg: rasterBg() }), 'SVG');
    $('#cpCode').onclick = () => { const B = transTarget(); copyText(B ? T.svgAnimated(ic, B, b, trOf(), { size: S.exp.size, id: 'oz', bg: rasterBg() }) : G.svgAnimated(ic, b, S.anim, { size: S.exp.size, id: 'oz', bg: rasterBg() }), 'קוד SVG מונפש'); };
    t0 = performance.now();
  }

  // ---------- live preview loop ----------
  let t0 = performance.now();
  const HOLD = 0.7;
  function progress(type, loop, dur, t) {
    if (type === 'none') return 0;
    const natural = type.split('+').every((x) => ['float', 'pulse', 'wiggle', 'spin', 'bounce'].includes(x));
    if (loop || natural) { const per = loop ? dur : dur + HOLD; const x = (t % per) / dur; return Math.min(1, x); }
    const per = dur + HOLD; return Math.min(1, (t % per) / dur);
  }
  function tick(now) {
    const ic = icon(S.cur), b = brand();
    if (ic && b && !document.hidden) {
      const t = (now - t0) / 1000, n = G.prep(ic).els.length;
      const TB = transTarget();
      if (TB) { const el = $('[data-live="main"]'); if (el) { const c = T.timing(trOf()).cycle; el.innerHTML = T.svgFrame(ic, TB, b, trOf(), (t % c) / c, { size: 200, id: 'lvt' }); } }
      $$(TB ? '[data-live]:not([data-live="main"])' : '[data-live]').forEach((el) => {
        const type = el.dataset.live === 'main' ? S.anim.type : el.dataset.live;
        const st = G.animState(type, progress(type, S.anim.loop, S.anim.dur, t), n, S.anim.loop, S.anim.stagger, S.anim.blur);
        el.innerHTML = G.svgStatic(ic, b, { size: el.dataset.live === 'main' ? 200 : 26, state: st, id: 'lv' + el.dataset.live });
      });
      const sg = $('#setGrid');
      if (sg && $('#setDlg').open) {
        $$('[data-set]', sg).forEach((el, i) => {
          const s = icon(el.dataset.set); if (!s) return;
          const tt = Math.max(0, t - i * 0.08);
          el.innerHTML = G.svgStatic(s, b, { size: 64, state: G.animState(S.anim.type, progress(S.anim.type, S.anim.loop, S.anim.dur, tt), G.prep(s).els.length, S.anim.loop, S.anim.stagger, S.anim.blur), id: 'sg' + i });
        });
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- exports ----------
  const fileBase = (ic, b) => `${slug(b.name)}-${ic.n}`;
  function rasterBg() { return S.exp.bg === 'white' ? '#FFFFFF' : S.exp.bg === 'color' ? S.exp.bgColor : null; }
  function svgImage(svg) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('render')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }); }
  async function makePng(ic, b, size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
    ctx.drawImage(await svgImage(G.svgStatic(ic, b, { size, bg: rasterBg() })), 0, 0, size, size);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
  // Encode RGBA frames: one shared palette (sampled across the clip), and runs of identical frames become one longer frame.
  async function encodeGif(frames, size, delay, loop, lastDelay) {
    const { GIFEncoder, quantize, applyPalette } = await loadGif();
    const bg = rasterBg(), enc = GIFEncoder();
    const same = (a, c) => { if (a.length !== c.length) return false; for (let i = 0; i < a.length; i += 4) if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2] || a[i + 3] !== c[i + 3]) return false; return true; };
    const runs = [];
    for (const f of frames) { const r = runs[runs.length - 1]; if (r && same(r.f, f)) r.d += delay; else runs.push({ f, d: delay }); }
    if (lastDelay) runs[runs.length - 1].d += lastDelay;
    const step = Math.max(1, Math.floor(runs.length / 8)), pick = runs.filter((_, i) => i % step === 0).map((r) => r.f);
    const merged = new Uint8Array(pick.reduce((a, f) => a + f.length, 0)); let o = 0; for (const f of pick) { merged.set(f, o); o += f.length; }
    const pal = bg ? quantize(merged, 64) : quantize(merged, 64, { format: 'rgba4444', oneBitAlpha: true });
    const ti = bg ? -1 : pal.findIndex((q) => q[3] === 0);
    runs.forEach((r, i) => {
      const idx = bg ? applyPalette(r.f, pal) : applyPalette(r.f, pal, 'rgba4444');
      enc.writeFrame(idx, size, size, { palette: i === 0 ? pal : undefined, delay: r.d, repeat: loop ? 0 : -1, ...(bg ? {} : { transparent: ti >= 0, transparentIndex: Math.max(0, ti), dispose: 2 }) });
    });
    enc.finish();
    return new Blob([enc.bytes()], { type: 'image/gif' });
  }
  async function renderFrames(n, svgAt, size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d', { willReadFrequently: true }); const out = [];
    for (let i = 0; i < n; i++) {
      ctx.clearRect(0, 0, size, size); ctx.drawImage(await svgImage(svgAt(i)), 0, 0, size, size);
      out.push(ctx.getImageData(0, 0, size, size).data.slice());
      if (i % 6 === 0) await new Promise((r) => setTimeout(r));
    }
    return out;
  }
  async function makeGif(ic, b, anim, size) {
    const fps = 25, type = anim.type, n = G.prep(ic).els.length, bg = rasterBg();
    const once = !anim.loop && !['float', 'pulse', 'wiggle', 'spin', 'bounce'].includes(type);
    const nf = type === 'none' ? 1 : Math.max(2, Math.round(anim.dur * fps));
    const frames = await renderFrames(nf, (i) => G.svgStatic(ic, b, { size, bg, state: G.animState(type, type === 'none' ? 1 : once ? i / (nf - 1) : i / nf, n, anim.loop, anim.stagger, anim.blur) }), size);
    return encodeGif(frames, size, Math.round(1000 / fps), anim.loop, once ? 1500 : 0);
  }
  async function makeTransGif(A, B, b, size) {
    const tr = trOf(), fps = 25, cyc = T.timing(tr).cycle, nf = Math.max(2, Math.round(cyc * fps)), bg = rasterBg();
    const frames = await renderFrames(nf, (i) => T.svgFrame(A, B, b, tr, tr.loop ? i / nf : i / (nf - 1), { size, bg, id: 'g' }), size);
    return encodeGif(frames, size, Math.round(1000 / fps), tr.loop, 0);
  }
  const animSuffix = () => (S.anim.type === 'none' ? '' : '-' + S.anim.type.replace(/\+/g, '-'));
  async function filesFor(ic, b, fmt, size) {
    const base = fileBase(ic, b), TB = transTarget();
    if (TB && ['asvg', 'lottie', 'gif'].includes(fmt)) {
      const tb = `${base}-to-${TB.n}-${S.trans.type}`;
      if (fmt === 'asvg') return [[`${tb}.svg`, T.svgAnimated(ic, TB, b, trOf(), { size, id: 'oz', bg: rasterBg() })]];
      if (fmt === 'lottie') return [[`${tb}.json`, JSON.stringify(T.lottie(ic, TB, b, trOf(), { size: Math.max(size, 128), bg: rasterBg() }))]];
      return [[`${tb}.gif`, await makeTransGif(ic, TB, b, Math.min(size, 512))]];
    }
    switch (fmt) {
      case 'svg': return [[`${base}.svg`, G.svgStatic(ic, b, { size, id: ic.n, bg: rasterBg() })]];
      case 'asvg': return [[`${base}${animSuffix()}.svg`, G.svgAnimated(ic, b, S.anim, { size, id: 'oz', bg: rasterBg() })]];
      case 'lottie': return [[`${base}${animSuffix()}.json`, JSON.stringify(G.lottie(ic, b, S.anim, { size: Math.max(size, 128), bg: rasterBg() }))]];
      case 'gif': return [[`${base}${animSuffix()}.gif`, await makeGif(ic, b, S.anim, Math.min(size, 512))]];
      case 'png': return [[`${base}.png`, await makePng(ic, b, size)]];
    }
    return [];
  }
  async function exportOne(ic, fmt, btn) {
    const b = brand(); const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'מכין…';
    try {
      if (fmt === 'mp') {
        const JSZip = await loadZip(); const z = new JSZip();
        for (const f of ['svg', 'asvg', 'lottie', 'gif', 'png']) for (const [name, data] of await filesFor(ic, b, f, S.exp.size)) z.file(name, data);
        await saveFile(`${fileBase(ic, b)}.zip`, await z.generateAsync({ type: 'blob' }));
      } else { const [[name, data]] = await filesFor(ic, b, fmt, S.exp.size); await saveFile(name, data); }
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + (e.message || e)); }
    btn.disabled = false; btn.innerHTML = label;
  }

  // ---------- set tray & set dialog ----------
  function renderTray() {
    const b = brand(), n = S.set.length;
    $('#tray').innerHTML = `<div class="trayinfo"><b>הסט שלי</b><span>${n} אייקונים</span></div>
      <div class="trayicons">${n ? S.set.map((x) => `<div class="ti" data-sel="${x}" role="button" tabindex="0" title="${x}" aria-label="בחירה של ${x}" aria-current="${x === S.cur}">${svgFor(x, b, { size: 26, id: 'tr' })}<button class="tix" data-rm="${x}" title="הסרה מהסט" aria-label="הסרה של ${x} מהסט">×</button></div>`).join('') : '<span class="trayempty">לחצו + על אייקון כדי להוסיף אותו לסט, או השתמשו ב"רשימת מילים".</span>'}</div>
      <button class="btn" id="setPrev" ${n ? '' : 'disabled'}>תצוגה וייצוא של הסט</button>
      ${n ? '<button class="btn ghost small" id="setClear">ניקוי</button>' : ''}`;
    $$('#tray [data-rm]').forEach((x) => x.onclick = (e) => { e.stopPropagation(); toggleSet(x.dataset.rm); });
    $$('#tray [data-sel]').forEach((x) => { const go = () => { select(x.dataset.sel); $$('#tray [data-sel]').forEach((y) => y.setAttribute('aria-current', y === x)); }; x.onclick = go; x.onkeydown = (e) => { if (e.target === x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } }; });
    $('#setPrev').onclick = openSetDialog;
    const c = $('#setClear'); if (c) c.onclick = () => { S.set = []; saveSession(); renderTray(); renderGrid(); };
  }
  function combinedSVG(names, b) {
    const cols = Math.min(6, names.length), gap = 16, cell = 24;
    const rows = Math.ceil(names.length / cols);
    const W = cols * cell + (cols - 1) * gap, H = rows * cell + (rows - 1) * gap;
    const body = names.map((n, i) => {
      const s = svgFor(n, b, { size: 24, id: 'set' + i });
      const open = s.match(/^<svg[^>]*>/)[0];
      const attrs = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map((k) => { const m = open.match(new RegExp(` ${k}="([^"]*)"`)); return m ? `${k}="${m[1]}"` : ''; }).join(' ');
      const x = (i % cols) * (cell + gap), y = Math.floor(i / cols) * (cell + gap);
      return `<g id="${n}" transform="translate(${x} ${y})" ${attrs}>${s.slice(open.length, -6)}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  }
  function previewHtml(b) {
    const cards = S.set.map((n) => `<figure>${G.svgAnimated(icon(n), b, S.anim, { size: 96, id: 'p' })}<figcaption>${n}</figcaption></figure>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(b.name)} icon set</title><style>body{font:14px system-ui;margin:40px;background:#f6f6f3;color:#222}h1{font-size:20px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px}figure{margin:0;background:#fff;border-radius:14px;padding:22px 10px 12px;text-align:center}figcaption{font:12px ui-monospace,monospace;color:#777;margin-top:8px}</style></head><body><h1>${esc(b.name)} · ${S.set.length} icons · ${S.anim.type}</h1><div class="g">${cards}</div></body></html>`;
  }
  function openSetDialog() {
    const d = $('#setDlg'), b = brand();
    d.innerHTML = `<div class="dlg"><div class="dlghead"><div><h2 style="margin:0">${esc(b.name)}</h2><h3>הסט: ${S.set.length} אייקונים</h3></div><button class="btn ghost" data-close>סגירה</button></div>
      <div class="setgrid" id="setGrid">${S.set.map((n) => `<div data-set="${n}" title="${n}"></div>`).join('')}</div>
      <p class="status">הנפשה: ${S.anim.type.split('+').map((t) => (G.ANIMS.find((a) => a.id === t) || { he: t }).he).join(' + ')}, ${S.anim.dur} שניות, ${S.anim.loop ? 'בלולאה' : 'פעם אחת'}. אפשר לשנות אותה בחלונית האייקון הנבחר.</p>
      <div><span class="lbl">פורמטים לייצוא</span><div class="checks">
        ${[['svg', 'SVG'], ['asvg', 'SVG מונפש'], ['lottie', 'Lottie'], ['gif', 'GIF'], ['png', 'PNG']].map(([v, l]) => `<label><input type="checkbox" value="${v}" ${['svg', 'lottie', 'gif'].includes(v) ? 'checked' : ''}> ${l}</label>`).join('')}
      </div></div>
      <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="zipSet">הורדת הסט כ־ZIP</button><button class="btn" id="cpSet">העתקת הסט לפיגמה</button><span class="status" id="zipStatus"></span></div></div>`;
    d.showModal(); t0 = performance.now();
    $('[data-close]', d).onclick = () => d.close();
    $('#cpSet').onclick = () => copyText(combinedSVG(S.set, b), 'הסט כ־SVG אחד');
    $('#zipSet').onclick = async () => {
      const fmts = $$('.checks input:checked', d).map((x) => x.value); if (!fmts.length) { $('#zipStatus').textContent = 'בחרו לפחות פורמט אחד'; return; }
      const btn = $('#zipSet'); btn.disabled = true;
      try {
        const JSZip = await loadZip(); const z = new JSZip(); const dirs = { svg: 'svg', asvg: 'svg-animated', lottie: 'lottie', gif: 'gif', png: 'png' };
        let i = 0;
        for (const n of S.set) {
          i++; $('#zipStatus').textContent = `מכין ${i} מתוך ${S.set.length}…`;
          for (const f of fmts) for (const [name, data] of await filesFor(icon(n), b, f, S.exp.size)) z.file(`${dirs[f]}/${name}`, data);
        }
        z.file('preview.html', previewHtml(b));
        z.file('brand-style.json', JSON.stringify({ brand: b.name, primary: b.primary, secondary: b.secondary, style: b.style, strokeWidth: b.stroke, linecap: b.cap, linejoin: b.join, container: b.container, containerColor: b.containerColor, animation: S.anim, icons: S.set, source: 'Lucide (ISC license) restyled with OZ Icon Studio' }, null, 2));
        $('#zipStatus').textContent = 'אורז…';
        await saveFile(`${slug(b.name)}-icon-set.zip`, await z.generateAsync({ type: 'blob' }));
        $('#zipStatus').textContent = '';
      } catch (e) { console.error(e); $('#zipStatus').textContent = 'הייצוא נכשל: ' + (e.message || e); }
      btn.disabled = false;
    };
  }

  // ---------- brandbook dialog ----------
  function openBrandDialog(existing) {
    const d = $('#brandDlg'); const st = { files: [], pages: [], text: '' };
    d.innerHTML = `<div class="dlg"><div class="dlghead"><h3>${existing ? 'ניתוח brandbook עבור ' + esc(existing.name) : 'חברה חדשה'}</h3><button class="btn ghost" data-close>סגירה</button></div>
      <div class="field" style="margin:0"><label for="nbName">שם החברה</label><input class="text" id="nbName" value="${esc(existing ? existing.name : '')}" placeholder="למשל Galcon"></div>
      <label class="drop" id="drop"><input type="file" id="nbFile" accept=".pdf,image/png,image/jpeg,image/webp" multiple hidden>
        <b>העלאת brandbook</b><br>קובץ PDF או צילומי מסך של עמודי הצבעים והסגנון (PNG/JPG). אפשר לגרור לכאן.</label>
      <div class="field" style="margin:0"><label for="nbFigma">או / וגם: קישור לפיגמה של המותג</label><input class="text mono" id="nbFigma" placeholder="https://www.figma.com/design/…?node-id=…" dir="ltr"><span class="status">קישור לפריים של הצבעים או ה־brand guideline (לחיצה ימנית על הפריים ← Copy link). נקרא דרך חיבור הפיגמה שלכם ל־Claude.</span></div>
      <div class="thumbs" id="thumbs"></div>
      <p class="status" id="nbStatus">Claude יקרא את הצבעים, הטיפוגרפיה והאופי של המותג ויציע סגנון אייקונים. אפשר לתקן הכול אחר כך.</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="nbGo" disabled>ניתוח ויצירת סגנון</button>${existing ? '' : '<button class="btn" id="nbManual">יצירה ידנית בלי קובץ</button>'}</div></div>`;
    d.showModal();
    $('[data-close]', d).onclick = () => d.close();
    const status = (t, err) => { const s = $('#nbStatus'); s.textContent = t; s.classList.toggle('err', !!err); };
    const ready = () => { $('#nbGo').disabled = !(st.pages.length || figmaRef($('#nbFigma').value)) || !$('#nbName').value.trim(); };
    $('#nbName').oninput = ready; $('#nbFigma').oninput = ready;
    const drop = $('#drop');
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); take([...e.dataTransfer.files]); };
    $('#nbFile').onchange = (e) => take([...e.target.files]);
    async function take(files) {
      st.pages = []; st.text = ''; st.pdfPages = 0; $('#thumbs').innerHTML = '';
      try {
        for (const file of files) {
          if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
            status('קורא את ה־PDF…');
            const pdfjs = await loadPdf();
            const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
            const N = Math.min(doc.numPages, 300); const pageInfo = [];
            for (let i = 1; i <= N; i++) {
              if (i % 10 === 0) status(`קורא עמוד ${i} מתוך ${N}…`);
              const page = await doc.getPage(i);
              const tc = await page.getTextContent(); const txt = tc.items.map((x) => x.str).join(' ');
              st.text += `\n[page ${i}] ` + txt;
              pageInfo.push({ i, score: (txt.match(/#[0-9a-f]{6}|\b(?:hex|rgb|cmyk|pantone|colou?r|palette|icon\w*|logo|typograph\w*|font|graphic|shape|stroke|צבע\w*|אייקון\w*|לוגו|טיפוגרפ\w*)/gi) || []).length });
            }
            const pick = pageInfo.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 20).map((p) => p.i).sort((a, b) => a - b);
            if (!pick.includes(1)) pick.unshift(1);
            st.pdfPages = (st.pdfPages || 0) + N;
            for (const i of pick.slice(0, 20)) {
              const page = await doc.getPage(i); const vp0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: 1000 / Math.max(vp0.width, vp0.height) });
              const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
              await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
              st.pages.push(c);
            }
          } else if (file.type.startsWith('image/')) {
            const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
            const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); st.pages.push(c);
          }
        }
        st.pages = st.pages.slice(0, 20);
        $('#thumbs').innerHTML = st.pages.map((c) => `<img alt="" src="${c.toDataURL('image/jpeg', 0.6)}">`).join('');
        status(st.pages.length ? (st.pdfPages ? `נקראו כל ${st.pdfPages} העמודים. ${st.pages.length} העמודים הרלוונטיים ביותר (צבעים, לוגו, אייקונים) נבחרו גם לניתוח חזותי.` : `${st.pages.length} עמודים מוכנים לניתוח.`) : 'לא נמצאו עמודים בקובץ.', !st.pages.length);
      } catch (e) { console.error(e); status('לא הצלחתי לקרוא את הקובץ. נסו צילומי מסך של עמודי הצבעים במקום.', true); }
      ready();
    }
    $('#nbGo').onclick = async () => {
      const name = $('#nbName').value.trim(); $('#nbGo').disabled = true;
      const fig = await readFigma($('#nbFigma').value, status);
      const fullText = (fig.text ? `[Figma brand file]\n${fig.text}\n` : '') + st.text;
      const hexes = textHexes(fullText); const local = localPalette([...fig.canvases, ...st.pages]);
      let res = null; const sample = await cap('sample');
      if (sample) {
        status('Claude מנתח את המותג…');
        try {
          const lim = sample.limits ? await sample.limits() : null;
          const maxImg = lim && typeof lim.images === 'number' ? lim.images : (lim && lim.images ? 20 : 0);
          const pageBlobs = await Promise.all(st.pages.map((c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8))));
          const blobs = maxImg ? [...fig.images, ...pageBlobs].slice(0, Math.min(20, maxImg)) : [];
          res = await sample.json(brandPrompt(name, fullText.slice(0, 60000), hexes, local), blobs.length ? { images: blobs, modelTier: 'default' } : { modelTier: 'default' });
        } catch (e) { console.warn(e); status('הניתוח עם Claude לא זמין כרגע, משתמש בחילוץ צבעים מקומי.'); }
      }
      const b = normalizeBrand(res, name, hexes, local, existing);
      if (fig.url) b.figma = fig.url;
      d.close();
      S.brandId = b.id; S.draft = null; S.dirty = false;
      await persistBrand(b); saveSession(); renderAll();
    };
    const man = $('#nbManual');
    if (man) man.onclick = async () => {
      const name = $('#nbName').value.trim(); if (!name) { status('תנו שם לחברה', true); return; }
      const b = normalizeBrand(null, name, [], [], null); b.source = 'נוצר ידנית'; d.close();
      S.brandId = b.id; await persistBrand(b); saveSession(); renderAll();
    };
  }
  function figmaRef(url) {
    const m = String(url || '').trim().match(/figma\.com\/(?:design|file)\/([0-9a-zA-Z]{22,128})(?:\/branch\/([0-9a-zA-Z]{22,128}))?[^?#]*(?:\?[^#]*?node-id=(\d+)[-:](\d+))?/);
    return m ? { fileKey: m[2] || m[1], nodeId: m[3] ? `${m[3]}:${m[4]}` : null, url: String(url).trim() } : null;
  }
  /* Reads colour variables, structure and a screenshot of the brand frame through the viewer's own Figma connector. */
  async function readFigma(url, status) {
    const out = { text: '', images: [], canvases: [], url: null };
    const ref = figmaRef(url); if (!ref) return out;
    out.url = ref.url;
    const mcp = await cap('mcp');
    if (!mcp) { status('חיבור הפיגמה לא זמין בעמוד הזה. ממשיך בלי פיגמה.', true); return out; }
    const texts = (r) => (r && r.content ? r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : (r && r.payload ? JSON.stringify(r.payload) : ''));
    const why = (e) => ({ server_not_connected: 'פיגמה לא מחוברת לחשבון Claude שלכם', not_granted: 'לא אושרה גישה לפיגמה', consent_required: 'צריך לאשר גישה לפיגמה' }[e && e.code] || 'לא הצלחתי לקרוא את הקובץ');
    try {
      status('קורא את קובץ הפיגמה…');
      let nodeId = ref.nodeId;
      if (!nodeId) {
        const meta = texts(await mcp.callTool('Figma', 'get_metadata', { fileKey: ref.fileKey }));
        out.text += meta.slice(0, 4000) + '\n';
        const m = meta.match(/^- (\d+:\d+):.*(?:colou?r|brand|style|design system|guide|צבע)/im) || meta.match(/^- (\d+:\d+)/m); nodeId = m ? m[1] : null;
      }
      if (nodeId) {
        try { out.text += 'Variables: ' + texts(await mcp.callTool('Figma', 'get_variable_defs', { fileKey: ref.fileKey, nodeId })).slice(0, 20000) + '\n'; } catch (e) { console.warn(e); }
        try {
          const shot = await mcp.callTool('Figma', 'get_screenshot', { fileKey: ref.fileKey, nodeId, maxDimension: 1400, enableBase64Response: true });
          for (const c of (shot.content || [])) if (c.type === 'image' && c.data) {
            const bin = atob(c.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            const blob = new Blob([u], { type: c.mimeType || 'image/png' }); out.images.push(blob);
            try { const bm = await createImageBitmap(blob); const k = Math.min(1, 1200 / Math.max(bm.width, bm.height)); const cv = document.createElement('canvas'); cv.width = bm.width * k; cv.height = bm.height * k; cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height); out.canvases.push(cv); } catch (e) {}
          }
        } catch (e) { console.warn(e); }
      }
      status(out.text || out.images.length ? 'הפיגמה נקראה.' : 'לא נמצא מידע בקישור הפיגמה. ודאו שהקישור מצביע על פריים.', !(out.text || out.images.length));
    } catch (e) { console.warn(e); status(why(e) + '. ממשיך בלי פיגמה.', true); }
    return out;
  }
  function textHexes(text) {
    const m = new Map();
    for (const x of text.matchAll(/(?:#|hex[:\s]*#?)([0-9a-f]{6})\b/gi)) { const h = '#' + x[1].toUpperCase(); m.set(h, (m.get(h) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 12);
  }
  function localPalette(canvases) {
    const counts = new Map();
    for (const c of canvases) {
      const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.length; i += 4 * 7) {
        if (data[i + 3] < 200) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mn > 235 || mx - mn < 18 && mx > 60) continue; // white & greys
        const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    const out = [];
    for (const [k] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const rgb = [(k >> 10) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4];
      if (out.every((o) => Math.hypot(o[0] - rgb[0], o[1] - rgb[1], o[2] - rgb[2]) > 60)) out.push(rgb);
      if (out.length >= 6) break;
    }
    return out.map((c) => '#' + c.map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  function brandPrompt(name, text, hexes, local) {
    return `You are a senior brand designer at a B2B design studio. From this company's brand book, define an ICON STYLE for a line-icon set (Lucide-based: 24px grid, stroke icons).
Company: ${name}
HEX codes found in the text (most frequent first): ${JSON.stringify(hexes)}
Dominant colors measured in the page images: ${JSON.stringify(local)}
Brand book text (excerpt):
"""${text}"""

Choose:
- primary: the main brand color for icon strokes. Must read well on white (dark or saturated; never a pale tint).
- secondary: the supporting accent color (used for fills, second color or gradient end).
- style: "outline" (one color), "duotone" (stroke + translucent secondary fill), "twotone" (main shape primary, details secondary) or "gradient" (stroke gradient primary→secondary). Match the brand's character.
- strokeWidth: 1–3 (thin, elegant brands ~1.5; bold, friendly brands ~2–2.5).
- cap: "round" | "butt" | "square"; join: "round" | "miter" (geometric / technical brands → square + miter; friendly / soft → round).
- container: "none" | "circle" | "square" and containerColor (a light tint from the palette) — use a container only if the brand uses badges or tiles.
- fillOpacity: 0.15–0.5 for duotone.
- notes: 1–2 sentences IN HEBREW explaining the choices to the studio designers.
Return ONLY JSON: {"primary":"#RRGGBB","secondary":"#RRGGBB","style":"...","strokeWidth":1.75,"cap":"round","join":"round","container":"none","containerColor":"#RRGGBB","fillOpacity":0.3,"notes":"..."}`;
  }
  function normalizeBrand(res, name, hexes, local, existing) {
    const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : d);
    const pool = [...hexes, ...local];
    const darkFirst = pool.filter((h) => lum(h) < 0.35);
    const fallbackP = darkFirst[0] || pool[0] || '#1F2A44';
    const fallbackS = pool.find((h) => h !== fallbackP && lum(h) > 0.12) || '#3BB2C8';
    const r = res && typeof res === 'object' ? res : {};
    const pick = (v, list, d) => (list.includes(v) ? v : d);
    const id = existing ? existing.id : slug(name) + '-' + Math.random().toString(36).slice(2, 6);
    return {
      id, name, order: existing ? existing.order : (Math.max(0, ...S.brands.map((b) => b.order || 0)) + 1),
      primary: hex(r.primary, fallbackP), secondary: hex(r.secondary, fallbackS),
      style: pick(r.style, ['outline', 'duotone', 'twotone', 'gradient'], 'duotone'),
      stroke: Math.min(3, Math.max(0.75, Math.round((+r.strokeWidth || 1.75) * 4) / 4)),
      cap: pick(r.cap, ['round', 'butt', 'square'], 'round'), join: pick(r.join, ['round', 'miter', 'bevel'], 'round'),
      container: pick(r.container, ['none', 'circle', 'square'], 'none'), containerColor: hex(r.containerColor, '#F1F1EC'),
      fillOpacity: Math.min(1, Math.max(0.1, +r.fillOpacity || 0.3)),
      notes: typeof r.notes === 'string' ? r.notes.slice(0, 400) : (res ? '' : 'הצבעים חולצו אוטומטית מה־brandbook, בלי ניתוח של Claude. כדאי לבדוק את הסגנון ולתקן.'),
      source: res ? 'ניתוח brandbook עם Claude' : (pool.length ? 'חילוץ צבעים מקומי מה־brandbook' : 'ברירת מחדל'),
    };
  }

  // ---------- boot ----------
  function renderAll() { renderBrands(); renderBrandPanel(); applyAccent(); renderGrid(); renderInspector(); renderTray(); if (S.mode === 'words') renderWordRows(); }
  async function boot() {
    renderAll();
    try {
      const raw = await (await fetch('icons.json')).json();
      const SRC = (n) => (n.startsWith('tb-') ? 'tb' : n.startsWith('hi-') ? 'hi' : 'lu');
      const mk = (raw) => raw.map(([n, e, t]) => ({ n, e, t: t || [], src: SRC(n), b: n.replace(/^(tb|hi)-/, '') }));
      S.icons = mk(raw); S.icons.forEach((ic) => S.byName.set(ic.n, ic));
      const extra = await Promise.all(['icons-tabler.json', 'icons-hero.json'].map((f) => fetch(f).then((r) => r.json()).catch(() => [])));
      for (const x of extra) for (const ic of mk(x)) { S.icons.push(ic); S.byName.set(ic.n, ic); }
      S.set = S.set.filter((n) => S.byName.has(n)); if (!S.byName.has(S.cur)) S.cur = 'droplet';
      if (!S.set.length) S.set = ['droplet', 'sun', 'gauge', 'shield-check', 'chart-line', 'zap', 'cloud', 'settings', 'triangle-exclamation-point', 'users', 'wrench', 'leaf'];
    } catch (e) { $('#grid').innerHTML = '<p class="empty">לא הצלחתי לטעון את ספריית האייקונים. רעננו את העמוד.</p>'; }
    renderAll(); requestAnimationFrame(tick);
    initDb();
  }
  document.addEventListener('click', () => { if (brandMenuOpen) { brandMenuOpen = false; renderBrands(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && brandMenuOpen) { brandMenuOpen = false; renderBrands(); $('#bmBtn').focus(); } });

  // ---------- guide ----------
  function openGuide() {
    const d = $('#guideDlg');
    const sec = (id, title, body) => `<section class="gd-sec" id="gd-${id}"><h3>${title}</h3>${body}</section>`;
    d.innerHTML = `<div class="dlg gd"><div class="dlghead"><div><h2 style="margin:0">מדריך למנוע האייקונים</h2><h3>איך מעצבים, מנפישים ומייצאים אייקונים בשפה של כל חברה</h3></div><button class="btn ghost" data-close>סגירה</button></div>
      <nav class="gd-toc">${[['what', 'מה זה'], ['brand', 'חברות'], ['style', 'סגנון'], ['find', 'חיפוש'], ['set', 'הסט'], ['anim', 'הנפשה'], ['trans', 'מעברים'], ['export', 'ייצוא'], ['tips', 'טיפים']].map(([a, l]) => `<a href="#gd-${a}">${l}</a>`).join('')}</nav>
      <div class="gd-body">
      ${sec('what', 'מה זה עושה', `<p>המנוע לוקח אייקוני קו מוכנים ומעצב אותם מחדש לפי השפה הוויזואלית של כל חברה: צבעים, עובי קו, פינות, קצוות ומסגרת. אחר כך אפשר להנפיש אותם ולייצא לכל פורמט שצריך.</p>
        <p>יש בו 7,350 אייקונים משלוש ספריות פתוחות לשימוש מסחרי: <b>Lucide</b> (2,091), <b>Tabler</b> (4,935) ו־<b>Heroicons</b> (324). כולם בנויים על גריד של 24px, כך שהם נראים אחידים גם כשמערבבים ביניהם.</p>`)}
      ${sec('brand', 'בחירת חברה והוספת חברה חדשה', `<ol><li>למעלה מוצגת החברה הנוכחית. <b>"החלפת חברה"</b> פותח רשימה שבה כל חברה מוצגת עם האייקונים בסגנון שלה.</li>
        <li><b>"+ חברה חדשה"</b> בתחתית הרשימה. יש שתי דרכים להזין את המותג:<ul><li><b>Brandbook ב־PDF:</b> המנוע קורא את כל המסמך ומחלץ צבעים וסגנון.</li><li><b>קישור לפיגמה:</b> לפריים של צבעים או של ה־guideline. בפיגמה: לחיצה ימנית על הפריים ← Copy link to selection.</li></ul></li>
        <li>Claude מציע סגנון התחלתי, ואפשר לערוך הכול בחלונית "סגנון המותג" ולשמור. חברות שנשמרות משותפות לכל הצוות.</li></ol>`)}
      ${sec('style', 'סגנון המותג', `<ul><li><b>צבעים:</b> ראשי ומשני.</li><li><b>סגנון:</b> קו (צבע אחד), דו־טון (קו ומילוי בגוון של הצבע המשני), שני צבעים (הצורה הראשית בצבע אחד והפרטים בשני), גרדיאנט.</li>
        <li><b>עובי קו, קצה קו ופינות:</b> מעוגלות, חדות או חתוכות. "חדות" הופך גם את הפינות המעוגלות שבתוך האייקון לפינות אמיתיות.</li><li><b>עוצמת המילוי:</b> בדו־טון, כמה חזק הגוון. המילוי תמיד אטום, כך שהוא נראה אותו דבר עם רקע ובלי רקע.</li><li><b>מסגרת:</b> בלי, עיגול או ריבוע מעוגל בצבע לבחירה.</li></ul>`)}
      ${sec('find', 'מציאת אייקונים', `<ul><li><b>חיפוש בספרייה:</b> אפשר לחפש בעברית או באנגלית ("משלוח", "truck"). מילה שלא נמצאת במילון נשלחת ל־Claude לתרגום.</li><li><b>סינון:</b> הכל, Lucide, Tabler או Heroicons. שמות של Tabler מתחילים ב־<span class="mono">tb-</span> ושל Heroicons ב־<span class="mono">hi-</span>.</li>
        <li><b>רשימת מילים:</b> מדביקים רשימה של נושאים (למשל מהבריף), והמנוע מציע אייקון לכל מילה עם חלופות.</li></ul>`)}
      ${sec('set', 'הסט שלי', `<ul><li><b>+</b> על אייקון מוסיף אותו לסט שבתחתית המסך. אין הגבלה על מספר האייקונים בסט.</li><li>לחיצה על אייקון בסט פותחת אותו בחלונית האייקון הנבחר. <b>×</b> מסיר אותו מהסט.</li>
        <li>הכפתור של הסט פותח תצוגה של כל הסט מונפש, ומשם מורידים את כולו כ־ZIP בפורמטים שבוחרים, או מעתיקים לפיגמה.</li></ul>`)}
      ${sec('anim', 'הנפשה', `<ul><li>בוחרים הנפשה אחת או כמה יחד, למשל ציור קו + הגדלה. "ללא" מנקה את הבחירה.</li><li><b>משך:</b> מהירות ההנפשה. <b>השהיה בין קווים:</b> בציור קו, כמה כל קו מחכה לקודם. <b>חזרה:</b> בלולאה או פעם אחת.</li>
        <li><b>טשטוש תנועה:</b> טשטוש שתלוי במהירות. הוא חזק בתנועה מהירה ונעלם כשהאייקון עוצר.</li><li>בדו־טון עם ציור קו, המילוי נחשף יחד עם הקו של כל צורה.</li></ul>`)}
      ${sec('trans', 'מעבר בין אייקונים', `<p>בחלק ההנפשה עוברים ל<b>"מעבר בין אייקונים"</b> ובוחרים אייקון יעד מהסט, או ב"בחירה מהספרייה".</p>
        <ul><li><b>החלקה:</b> match cut במיקום. האייקון יוצא מהמסגרת והבא נכנס מהצד השני.</li><li><b>שינוי גודל:</b> match cut בגודל. שני האייקונים מתכווצים יחד, החיתוך קורה בשיא התנועה, והאייקון החדש חוזר לגודל מלא. האייקון לא יוצא מהמסגרת ולא נחתך.</li>
        <li><b>מורף:</b> כל קו זורם לקו הקרוב אליו באייקון השני. כאן מופיעות המלצות: איזו גרסה של היעד עוברת הכי חלק, ואילו אייקונים קשורים עוברים הכי יפה.</li><li>בלולאה המעבר חוזר גם אחורה.</li></ul>`)}
      ${sec('export', 'ייצוא: איזה פורמט לאן', `<table class="gd-t"><thead><tr><th>פורמט</th><th>מתי</th><th>משקל טיפוסי</th></tr></thead><tbody>
        <tr><td>SVG</td><td>פיגמה, מצגות, אתר (סטטי)</td><td>פחות מ־1KB</td></tr>
        <tr><td>SVG מונפש</td><td>אתר. ההנפשה מובנית בקובץ, בלי ספריות</td><td>3–10KB, מעבר מורף כ־65KB</td></tr>
        <tr><td>Lottie</td><td>אפליקציות, אתרים עם נגן Lottie, After Effects</td><td>5–20KB, מעבר מורף כ־125KB</td></tr>
        <tr><td>GIF</td><td>סושיאל, מייל, מצגות</td><td>בערך 50–250KB לפי גודל ומשך</td></tr>
        <tr><td>PNG</td><td>תמונה סטטית בכל מקום</td><td>קטן</td></tr></tbody></table>
        <ul><li><b>רקע:</b> לבן, ללא רקע או צבע לבחירה. חל על כל הפורמטים.</li><li><b>גודל:</b> מ־24 עד 512px. בווקטורים (SVG, Lottie) הגודל רק קובע את ברירת המחדל, והם חדים בכל גודל.</li><li>"העתקת SVG לפיגמה" ו"העתקת קוד לאתר" מעתיקים ישר ללוח.</li></ul>`)}
      ${sec('tips', 'טיפים', `<ul><li>לאתר עדיף SVG מונפש או Lottie: קלים פי 10 מ־GIF וחדים בכל גודל.</li><li>GIF עם רקע צבעוני נראה חלק יותר מ־GIF שקוף.</li><li>לסט אחיד, כדאי להעדיף אייקונים מאותה ספרייה.</li><li>אם המורף נראה מבולגן, נסו גרסה אחרת של היעד מתוך ההמלצות.</li></ul>`)}
      </div></div>`;
    d.querySelector('[data-close]').onclick = () => d.close();
    $$('.gd-toc a', d).forEach((a) => a.onclick = (e) => { e.preventDefault(); d.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    d.showModal();
  }
  $('#guideBtn').onclick = openGuide;
  boot();
})();
