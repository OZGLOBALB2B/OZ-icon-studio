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
      // A browser copy wins only when it was saved after the exported file's version.
      if (Array.isArray(l)) for (const b of l) { const i = S.brands.findIndex((x) => x.id === b.id); if (i < 0) S.brands.push(b); else if ((b.updated || 0) > (S.brands[i].updated || 0)) S.brands[i] = b; }
    } catch (e) {}
    S.brands.sort((a, b) => (a.order || 99) - (b.order || 99));
    if (!S.brands.find((b) => b.id === S.brandId)) S.brandId = S.brands[0]?.id;
    setSync('נשמר בדפדפן זה בלבד');
  }
  async function initDb() {
    const db = await cap('db');
    if (!db) { await loadLocalBrands(); loadCustomIcons(null); renderAll(); return; }
    S.db = db; setSync('מתחבר לחברות המשותפות…'); loadCustomIcons(db);
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
    b = { ...b, updated: Date.now() };
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
  // ---------- theme ----------
  const contrast = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mixHex = (a, c, t) => { const p = G.hexToRgb(a), q = G.hexToRgb(c); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const SURF = { light: '#FFFFFF', dark: '#1A1B21' };
  let themePref = 'auto'; try { themePref = localStorage.getItem('iconstudio.theme') || 'auto'; } catch (e) {}
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => themePref === 'dark' || (themePref === 'auto' && !!(mq && mq.matches));
  // A plate behind icons when the brand's main colour would sink into the page (dark navy on dark, pale yellow on white).
  function plateFor(b, dark = isDark()) {
    b = G.util.effColors(b);
    const col = b.style === 'gradient' ? mixHex(b.primary, b.secondary, 0.5) : b.primary;
    if (b.container && b.container !== 'none') return null;
    if (dark && contrast(col, SURF.dark) < 3) return { bg: '#EDEDE9', ink: '#5A5B63', soft: '#E1E1DB' };
    if (!dark && contrast(col, SURF.light) < 1.8) return { bg: '#24252C', ink: '#B4B5BC', soft: '#2E2F37' };
    return null;
  }
  function applyAccent() {
    const b = G.util.effColors(brand()); if (!b) return; const root = document.documentElement, dark = isDark();
    root.toggleAttribute('data-theme', themePref !== 'auto'); if (themePref !== 'auto') root.setAttribute('data-theme', themePref);
    let acc = b.primary;
    const bg = dark ? SURF.dark : SURF.light;
    for (let t = 0.1; contrast(acc, bg) < 3.2 && t <= 1; t += 0.1) acc = mixHex(b.primary, dark ? '#FFFFFF' : '#000000', t);
    root.style.setProperty('--accent', acc);
    root.style.setProperty('--accent-ink', lum(acc) > 0.45 ? '#16171C' : '#FFFFFF');
    const pl = plateFor(b, dark);
    for (const [k, v] of [['--icbg', pl && pl.bg], ['--icink', pl && pl.ink], ['--icsoft', pl && pl.soft], ['--icplate', pl && pl.bg], ['--icplateink', pl && '#16171C']]) { if (v) root.style.setProperty(k, v); else root.style.removeProperty(k); }
    const tb = $('#themeBtn'); if (tb) { tb.dataset.mode = themePref; tb.title = { auto: 'ערכת צבעים: לפי המערכת', light: 'ערכת צבעים: בהירה', dark: 'ערכת צבעים: כהה' }[themePref]; tb.setAttribute('aria-label', tb.title); }
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (themePref === 'auto') { applyAccent(); renderBrands(); } });
  const svgFor = (n, b, o = {}) => { const ic = icon(n); return ic ? G.svgStatic(ic, b, o) : ''; };
  const neutral = { primary: 'currentColor', secondary: 'currentColor', style: 'outline', stroke: 2, cap: 'round', join: 'round', container: 'none' };

  const PREVIEW_ICONS = ['droplet', 'chart-line', 'shield-check', 'users', 'settings'];
  let brandMenuOpen = false;
  function renderBrands() {
    const cur = brand(), sw = (b) => `<span class="sw"><i style="background:${esc(b.primary)}"></i><i style="background:${esc(b.secondary)}"></i></span>`;
    const prev = (b) => { const pl = plateFor(b); return `<span class="bm-icons"${pl ? ` style="background:${pl.bg}"` : ''}>${PREVIEW_ICONS.map((n) => svgFor(n, b, { size: 22, id: 'bm' + b.id })).join('')}</span>`; };
    $('#brands').innerHTML = `<div class="bmenu">
        <button class="brand-chip bm-btn" id="bmBtn" aria-haspopup="listbox" aria-expanded="${brandMenuOpen}">${sw(cur)}<span class="bm-name">${esc(cur.name)}</span>${prev(cur)}<span class="bm-change">החלפת חברה ▾</span></button>
        <div class="bm-pop" id="bmPop" role="listbox" aria-label="בחירת חברה"${brandMenuOpen ? '' : ' hidden'}>
          ${S.brands.length > 6 ? '<input class="text bm-q" id="bmQ" type="search" placeholder="חיפוש חברה…" aria-label="חיפוש חברה">' : ''}
          <div class="bm-list">${S.brands.map((b) => `<button class="bm-row brand-chip" role="option" data-id="${esc(b.id)}" data-name="${esc(b.name.toLowerCase())}" aria-selected="${b.id === cur.id}" aria-pressed="${b.id === cur.id}">${sw(b)}<span class="bm-name">${esc(b.name)}</span>${prev(b)}</button>`).join('')}</div>
          <button class="brand-chip add" id="addBrand">+ חברה חדשה</button>
          <button class="brand-chip add" id="exportData" title="brands.json, brand-language.json, icons-oz.json">הורדת נתוני הסטודיו (לגיט)</button>
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
    $('#exportData').onclick = async () => {
      brandMenuOpen = false; renderBrands();
      try {
        const JSZip = await loadZip(), z = new JSZip(), clean = (o) => JSON.parse(JSON.stringify(o));
        z.file('brands.json', JSON.stringify(clean(S.brands).sort((a, b) => (a.order || 99) - (b.order || 99)), null, 2));
        z.file('brand-language.json', JSON.stringify(clean(S.lang)));
        z.file('icons-oz.json', JSON.stringify(S.icons.filter((x) => x.src === 'oz').map((x) => x.custom)));
        await saveFile('oz-icon-studio-data.zip', await z.generateAsync({ type: 'blob' }));
      } catch (e) { toast('הייצוא נכשל: ' + (e.message || e)); }
    };
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
      <div class="field"><span class="lbl">צבעים</span>${colorField('primary', 'ראשי', b.primary)}${colorField('secondary', 'משני', b.secondary)}
        <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn small" id="bSwap" title="החלפה בין הצבע הראשי למשני">⇄ החלפה בין ראשי למשני</button></div></div>
      <div class="field"><span class="lbl">שימוש בצבעים</span>${seg('colorUse', [['both', 'שניהם'], ['primary', 'רק ראשי'], ['secondary', 'רק משני']], b.colorUse || 'both')}
        ${b.colorUse && b.colorUse !== 'both' ? `<span class="status">האייקונים בצבע אחד. הצבע ה${b.colorUse === 'primary' ? 'משני' : 'ראשי'} נשמר ולא נמחק.</span>` : ''}</div>
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
    $('#bSwap').onclick = () => { if (!S.draft) S.draft = clone(brand()); const t = S.draft.primary; S.draft.primary = S.draft.secondary; S.draft.secondary = t; S.dirty = true; refreshStyle(); };
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
      const SRC = (n) => (n.startsWith('tb-') ? 'tb' : n.startsWith('hi-') ? 'hi' : n.startsWith('oz-') ? 'oz' : 'lu');
      const mk = (raw) => raw.map(([n, e, t]) => ({ n, e, t: t || [], src: SRC(n), b: n.replace(/^(tb|hi|oz)-/, '') }));
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


  // ---------- custom icons (prompt to icon) ----------
  const ALLOWED = { path: ['d'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'] };
  function addCustomIcons(list) {
    S.icons = S.icons.filter((x) => x.src !== 'oz');
    for (const [n] of [...S.byName]) if (n.startsWith('oz-')) S.byName.delete(n);
    for (const d of list) {
      const ic = { n: d.n, e: d.e, t: d.t || [], src: 'oz', b: d.n.replace(/^oz-/, ''), custom: d };
      S.icons.unshift(ic); S.byName.set(ic.n, ic);
    }
    renderGrid(); renderTray();
  }
  function loadCustomIcons(db) {
    loadBrandLang(db);
    if (!db) {
      fetch('icons-oz.json').then((r) => r.json()).catch(() => []).then((base) => {
        let loc = []; try { loc = JSON.parse(localStorage.getItem('iconstudio.custom') || '[]') || []; } catch (e) {}
        const m = new Map(); for (const d of [...(Array.isArray(base) ? base : []), ...loc]) if (d && d.n && Array.isArray(d.e)) m.set(d.n, d);
        addCustomIcons([...m.values()].sort((a, b) => (b.created || 0) - (a.created || 0)));
      });
      return;
    }
    db.collection('icons').onSnapshot((snap) => {
      addCustomIcons(snap.docs.map((d) => d.data()).filter((d) => d && d.n && Array.isArray(d.e)).sort((a, b) => (b.created || 0) - (a.created || 0)));
    }, () => {});
  }
  async function saveCustomIcon(doc) {
    if (S.db) { await S.db.collection('icons').doc(doc.n).set(doc); return 'shared'; }
    const cur = S.icons.filter((x) => x.src === 'oz').map((x) => x.custom);
    const all = [doc, ...cur.filter((x) => x.n !== doc.n)];
    try { localStorage.setItem('iconstudio.custom', JSON.stringify(all)); } catch (e) {}
    addCustomIcons(all); return 'local';
  }
  // Keep only safe, stroke-only geometry Claude returned; null when it can't be drawn.
  function cleanIcon(o, k) {
    if (!o || !Array.isArray(o.elements)) return null;
    const e = [];
    for (const it of o.elements.slice(0, 16)) {
      const [tag, a] = Array.isArray(it) ? it : [it && it.tag, it && it.attrs];
      if (!ALLOWED[tag] || !a || typeof a !== 'object') continue;
      const out = {};
      for (const key of ALLOWED[tag]) if (a[key] != null) {
        const v = String(a[key]).trim();
        if (key === 'd' ? /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/.test(v) : key === 'points' ? /^[0-9.,\s+\-]+$/.test(v) : /^-?[0-9.]+$/.test(v)) out[key] = v;
      }
      const role = a['data-role'] || a.role; if (role === 'accent' || role === 'fill') out['data-role'] = role;
      if (Object.keys(out).length) e.push([tag, out]);
    }
    if (!e.length) return null;
    const slugN = String(o.name || 'icon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'icon';
    const ic = { n: `gen-${Date.now().toString(36)}-${k}`, e, t: (Array.isArray(o.tags) ? o.tags : []).map((x) => String(x).toLowerCase()).slice(0, 12), src: 'oz', b: slugN };
    try { const svg = G.svgStatic(ic, brand(), { size: 48, id: 'gv' }); if (/NaN|undefined/.test(svg)) return null; } catch (err) { return null; }
    ic.name = slugN; ic.idea = String(o.idea || '').slice(0, 140);
    return ic;
  }
  const GEN = { refs: [], images: [], options: [], picked: null, busy: false, mode: 'close', check: true };
  // Panels on a 24-unit coordinate grid (0..24, the icon area 2..22 marked), so Claude can read positions in icon units.
  function gridSheet(panels, labels) {
    const P = 480, M = 34, W = panels.length * (P + M) + M, H = P + M * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    panels.forEach((pn, i) => {
      const x0 = M + i * (P + M), y0 = M, u = P / 24;
      pn.draw(ctx, x0 + 2 * u, y0 + 2 * u, 20 * u);
      for (let k = 0; k <= 24; k++) {
        ctx.strokeStyle = k % 4 === 0 ? 'rgba(220,40,60,.45)' : 'rgba(40,120,220,.18)'; ctx.lineWidth = k % 4 === 0 ? 1.2 : 0.8;
        ctx.beginPath(); ctx.moveTo(x0 + k * u, y0); ctx.lineTo(x0 + k * u, y0 + P); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 + k * u); ctx.lineTo(x0 + P, y0 + k * u); ctx.stroke();
        if (k % 4 === 0) { ctx.fillStyle = '#c02838'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k, x0 + k * u, y0 - 8); ctx.textAlign = 'right'; ctx.fillText(k, x0 - 5, y0 + k * u + 4); }
      }
      ctx.strokeStyle = 'rgba(0,160,90,.6)'; ctx.setLineDash([6, 4]); ctx.strokeRect(x0 + 2 * u, y0 + 2 * u, 20 * u, 20 * u); ctx.setLineDash([]);
      ctx.fillStyle = '#111'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[i] || '', x0 + P / 2, y0 + P + 24);
    });
    return c;
  }
  async function optionSheet(opts) {
    const imgs = await Promise.all(opts.map((ic) => svgImage(G.svgStatic(ic, { ...neutral, primary: '#111111', secondary: '#111111' }, { size: 480, id: 'cs' }))));
    const sheet = gridSheet(imgs.map((im) => ({ draw: (ctx, x, y, w) => { const u = w / 20; ctx.drawImage(im, x - 2 * u, y - 2 * u, w + 4 * u, w + 4 * u); } })), opts.map((_, i) => 'אפשרות ' + (i + 1)));
    return new Promise((r) => sheet.toBlob(r, 'image/png'));
  }
  async function shrinkImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 768 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const grid = gridSheet([{ draw: (ctx, x, y, w) => { const k = Math.min(w / c.width, w / c.height); ctx.drawImage(c, x + (w - c.width * k) / 2, y + (w - c.height * k) / 2, c.width * k, c.height * k); } }], ['רפרנס']);
      return { blob: await new Promise((r) => c.toBlob(r, 'image/png')), url: c.toDataURL('image/png'), grid: await new Promise((r) => grid.toBlob(r, 'image/png')) };
    } finally { URL.revokeObjectURL(url); }
  }
  function genPrompt(desc, refine) {
    const close = GEN.mode === 'close' && (GEN.images.length || GEN.refs.length);
    const L = langOf(brand()), lang = L && L.samples.length >= 2 ? langBlock(brand(), L) + '\nThe new icon must belong to this family.\nYou may use "data-role":"accent" (second colour) or "data-role":"fill" on elements, as the samples do.\n' : '';
    const ex = (GEN.refs.length ? GEN.refs : ['droplet', 'shield-check', 'truck', 'chart-line']).map((n) => icon(n)).filter(Boolean).map((ic) => JSON.stringify({ name: ic.b, elements: ic.e }));
    return `${lang}You design icons ${lang ? 'for the brand family above, on the geometric grid' : 'in the exact geometric language'} of the Lucide icon set.
Rules for every icon:
- 24x24 grid, drawn as STROKES ONLY (no fills): the app applies stroke width 2, round caps and joins, and its own colours.
- Keep all geometry inside x,y 2..22. Use whole or half units. Corner radius 2 on rectangles, small arcs for rounded turns.
- Allowed elements: path (d with M L H V C S Q A Z, absolute or relative), circle (cx cy r), ellipse, rect (x y width height rx), line, polyline, polygon.
- 1 to 8 elements. Simple, readable at 16px, one clear metaphor, no text or letters unless asked, no tiny details closer than 2 units apart.
- Optically balanced: the visual weight centred on 12,12.
${GEN.refs.length ? 'Match the style, proportions and detail level of these reference icons closely:' : 'Examples of the target style:'}
${ex.join('\n')}
${GEN.images.length ? (close
  ? `The attached reference image${GEN.images.length > 1 ? 's are' : ' is'} drawn on a 24-unit coordinate grid: red numbers every 4 units, the dashed green square is the 2..22 icon area, and the reference is scaled into that square. READ COORDINATES FROM THE GRID: where the reference's main outline, corners, centres and inner lines sit, in grid units. Recreate the reference as a stroke icon at those positions, keeping its silhouette, proportions, composition and distinctive details. Do not substitute a different metaphor.`
  : `The attached image${GEN.images.length > 1 ? 's are' : ' is'} inspiration for the subject, metaphor or style, shown on a 24-unit grid. Translate it into this stroke language; do not copy photographic detail.`) : ''}
${refine ? `Start from this icon and make 4 variations that apply the feedback.\nIcon: ${JSON.stringify({ name: refine.name, elements: refine.e })}\nFeedback: ${refine.feedback}`
  : close ? `Before drawing, write a short "plan": the reference's main shapes with their grid coordinates. Then make 4 options that all stay close to the reference:
1) faithful: the reference's outline and key inner lines at the measured coordinates;
2) faithful but cleaned: same layout, geometry snapped to clean circles, rectangles and straight lines;
3) simplified: same silhouette with fewer inner details;
4) minimal: the most recognisable reading of the reference in 2-4 elements.`
  : `Make 4 clearly different design options (different metaphors or compositions, not small tweaks).`}
Request (may be in Hebrew): ${desc}
Return ONLY JSON: {"plan":"short text","options":[{"name":"kebab-case-english-name","idea":"one short sentence in Hebrew describing the concept","tags":["english","search","words"],"elements":[["path",{"d":"..."}],["circle",{"cx":"12","cy":"12","r":"3"}]]}]}`;
  }
  function renderGenOptions() {
    const box = $('#genOpts'); if (!box) return; const b = brand();
    box.innerHTML = GEN.options.map((ic, i) => `<button class="gen-opt" data-gi="${i}" aria-pressed="${GEN.picked === i}" title="${esc(ic.name)}">
        <span class="gen-prev">${G.svgStatic(ic, b, { size: 128, id: 'go' + i })}</span>
        <span class="gen-sm">${G.svgStatic(ic, b, { size: 16, id: 'gs' + i })}${G.svgStatic(ic, b, { size: 24, id: 'gt' + i })}${G.svgStatic(ic, neutral, { size: 24, id: 'gn' + i })}</span>
        <span class="gen-idea">${esc(ic.idea || ic.name)}</span></button>`).join('');
    $$('[data-gi]', box).forEach((x) => x.onclick = () => { GEN.picked = +x.dataset.gi; renderGenOptions(); renderGenPick(); });
  }
  function renderGenPick() {
    const el = $('#genPick'); if (!el) return; const ic = GEN.options[GEN.picked];
    if (!ic) { el.hidden = true; return; }
    el.hidden = false; $('#genName').value = ic.name; $('#genTags').value = ic.t.join(', ');
  }
  async function runGen(refine) {
    const desc = $('#genDesc').value.trim(); const st = $('#genStatus');
    if (!desc) { st.textContent = 'כתבו תיאור של האייקון'; $('#genDesc').focus(); return; }
    const sample = await cap('sample');
    if (!sample) { st.textContent = 'יצירת אייקונים עובדת רק בתוך claude.ai, כי היא משתמשת ב־Claude.'; return; }
    if (GEN.busy) return; GEN.busy = true; $('#genGo').disabled = true; $('#genRefine').disabled = true;
    st.textContent = refine ? 'Claude משפר את האייקון…' : GEN.check && GEN.images.length && GEN.mode === 'close' ? 'שלב 1 מתוך 2: Claude קורא את הרפרנס ומשרטט 4 אפשרויות…' : 'Claude מעצב 4 אפשרויות…';
    try {
      const refImgs = GEN.images.map((x) => x.grid || x.blob);
      const Lg = langOf(brand()), langImgs = Lg && Lg.samples.length >= 2 ? [await samplesSheet(Lg.samples)] : [];
      const r = await sample.json(genPrompt(desc, refine), { modelTier: 'complex', ...(refImgs.length || langImgs.length ? { images: [...refImgs, ...langImgs] } : {}) });
      let opts = (r && Array.isArray(r.options) ? r.options : []).map((o, k) => cleanIcon(o, k)).filter(Boolean);
      if (!opts.length) throw new Error('לא התקבלו אייקונים תקינים');
      if (GEN.check && refImgs.length && GEN.mode === 'close') {
        GEN.options = opts; GEN.picked = null; renderGenOptions(); renderGenPick();
        st.textContent = 'שלב 2 מתוך 2: Claude משווה את האפשרויות לרפרנס ומתקן…';
        try {
          const sheet = await optionSheet(opts);
          const fix = await sample.json(`You are checking stroke icons against a reference. Image(s) 1..${refImgs.length}: the reference on a 24-unit grid (red numbers every 4 units, dashed green square = 2..22 icon area). Last image: the current options drawn on the SAME grid, labelled in order.
For each option compare it with the reference: silhouette, proportions, positions of corners/centres/inner lines in grid units, missing or extra details. Then return a corrected version of every option that matches the reference more closely, keeping that option's level of simplification (1 faithful, 2 cleaned, 3 simplified, 4 minimal). Keep the same rules: strokes only, inside 2..22, path/circle/ellipse/rect/line/polyline/polygon, 1-8 elements.
Current options: ${JSON.stringify(opts.map((o) => ({ name: o.name, idea: o.idea, tags: o.t, elements: o.e })))}
Request: ${desc}
Return ONLY JSON: {"options":[{"name":"...","idea":"short Hebrew sentence","tags":["..."],"elements":[["path",{"d":"..."}]]}]}`, { modelTier: 'complex', images: [...refImgs, sheet] });
          const fixed = (fix && Array.isArray(fix.options) ? fix.options : []).map((o, k) => cleanIcon(o, k + 10)).filter(Boolean);
          if (fixed.length) opts = fixed;
        } catch (e) { /* keep the first-pass options */ }
      }
      GEN.options = opts; GEN.picked = null; renderGenOptions(); renderGenPick();
      st.textContent = `התקבלו ${opts.length} אפשרויות. בחרו אחת כדי לשמור או לשפר אותה.`;
    } catch (e) {
      st.textContent = e && e.code === 'not_granted' ? 'אין הרשאה להשתמש ב־Claude מהדף.' : e && e.code === 'rate_limited' ? 'יותר מדי בקשות. נסו שוב בעוד דקה.' : 'היצירה נכשלה: ' + ((e && e.message) || 'נסו שוב');
    }
    GEN.busy = false; $('#genGo').disabled = false; $('#genRefine').disabled = false;
  }
  function renderGenRefs() {
    const el = $('#genRefs'); if (!el) return; const b = brand();
    el.innerHTML = GEN.refs.map((n) => `<span class="ti" title="${n}">${svgFor(n, b, { size: 26, id: 'gr' })}<button class="tix" data-grm="${n}" aria-label="הסרה של ${n}">×</button></span>`).join('')
      + (GEN.refs.length < 6 ? `<button class="btn small" id="genAddCur">+ האייקון הנבחר (${esc(S.cur)})</button>${S.set.length ? '<button class="btn small" id="genAddSet">+ מהסט</button>' : ''}` : '');
    $$('[data-grm]', el).forEach((x) => x.onclick = () => { GEN.refs = GEN.refs.filter((n) => n !== x.dataset.grm); renderGenRefs(); });
    const ac = $('#genAddCur'); if (ac) ac.onclick = () => { if (!GEN.refs.includes(S.cur)) GEN.refs.push(S.cur); renderGenRefs(); };
    const as = $('#genAddSet'); if (as) as.onclick = () => { for (const n of S.set) if (GEN.refs.length < 6 && !GEN.refs.includes(n)) GEN.refs.push(n); renderGenRefs(); };
  }
  function renderGenImages() {
    const el = $('#genImgs'); if (!el) return;
    el.innerHTML = GEN.images.map((x, i) => `<span class="gen-img"><img src="${x.url}" alt="השראה ${i + 1}"><button class="tix" data-gim="${i}" aria-label="הסרת תמונה">×</button></span>`).join('');
    $$('[data-gim]', el).forEach((x) => x.onclick = () => { GEN.images.splice(+x.dataset.gim, 1); renderGenImages(); });
  }
  function paneGen() {
    const d = $('#stBody');
    d.innerHTML = `<div class="st-pane"><p class="status st-sub">${langOf(brand()) && langOf(brand()).samples.length >= 2 ? `Claude מעצב בשפת האייקונים של ${esc(brand().name)}, לפי הדוגמאות של הסטודיו` : 'Claude מעצב אפשרויות בשפה של ספריית האייקונים. כדי לעצב בשפת המותג, הוסיפו דוגמאות של אייקוני הסטודיו בחלונית המותג'}</p>
      <div class="field" style="margin:0"><label for="genDesc">מה האייקון צריך להראות?</label><textarea class="text" id="genDesc" rows="2" placeholder="למשל: מנורת UV שמטהרת טיפת מים, או משאית קירור עם פתית שלג">${esc($('#genDesc')?.value || '')}</textarea></div>
      <div class="grid2">
        <div class="field" style="margin:0"><span class="lbl">תמונות השראה (לא חובה)</span><div class="row" style="gap:6px;flex-wrap:wrap"><span id="genImgs" class="row" style="gap:6px;flex-wrap:wrap"></span><label class="btn small">+ העלאת תמונה<input type="file" id="genFile" accept="image/*" multiple hidden></label></div></div>
        <div class="field" style="margin:0"><span class="lbl">אייקונים לחיקוי הסגנון (לא חובה)</span><div class="row" id="genRefs" style="gap:6px;flex-wrap:wrap"></div></div>
      </div>
      <div class="grid2">
        <div class="field" style="margin:0"><span class="lbl">כמה קרוב לרפרנס</span>${seg('gmode', [['close', 'קרוב לרפרנס'], ['free', 'חופשי, רעיונות שונים']], GEN.mode)}</div>
        <div class="field" style="margin:0"><span class="lbl">בדיקה מול הרפרנס</span><label class="row" style="gap:6px;font-size:13px;min-height:34px"><input type="checkbox" id="genCheck" ${GEN.check ? 'checked' : ''}> שלב שני: Claude משווה לרפרנס ומתקן (איטי יותר)</label></div>
      </div>
      <p class="status" style="margin:0">ב"קרוב לרפרנס" התמונה מונחת על גריד של 24 יחידות, Claude קורא ממנה מיקומים אמיתיים, וכל 4 האפשרויות הן אותו אייקון ברמות פישוט שונות: נאמן, מנוקה, מפושט, מינימלי.</p>
      <div class="row"><button class="btn primary" id="genGo">יצירת 4 אפשרויות</button><span class="status" id="genStatus"></span></div>
      <div class="gen-opts" id="genOpts"></div>
      <div id="genPick" hidden class="gen-pick">
        <div class="grid2">
          <div class="field" style="margin:0"><label for="genName">שם האייקון (באנגלית)</label><input class="text mono" id="genName" maxlength="40"></div>
          <div class="field" style="margin:0"><label for="genTags">מילות חיפוש, מופרדות בפסיק</label><input class="text" id="genTags"></div>
        </div>
        <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="genSave">שמירה במאגר</button><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="genToSet" checked> להוסיף גם לסט שלי</label></div>
        <div class="row" style="flex-wrap:wrap"><input class="text" id="genFeedback" placeholder="מה לשפר? למשל: קו נקי יותר, טיפה גדולה יותר, בלי הקרניים" style="flex:1;min-width:200px"><button class="btn" id="genRefine">שיפור האפשרות הזו</button></div>
      </div></div>`;
    $('#genFile').onchange = async (e) => { for (const f of [...e.target.files].slice(0, 4 - GEN.images.length)) { try { GEN.images.push(await shrinkImage(f)); } catch (err) {} } e.target.value = ''; renderGenImages(); };
    $('#genGo').onclick = () => runGen(null);
    $$('.seg[data-k="gmode"] button', d).forEach((x) => x.onclick = () => { GEN.mode = x.dataset.v; $$('.seg[data-k="gmode"] button', d).forEach((y) => y.setAttribute('aria-pressed', y === x)); });
    $('#genCheck').onchange = (e) => { GEN.check = e.target.checked; };
    $('#genRefine').onclick = () => { const ic = GEN.options[GEN.picked]; const fb = $('#genFeedback').value.trim(); if (!ic) return; if (!fb) { $('#genStatus').textContent = 'כתבו מה לשפר'; $('#genFeedback').focus(); return; } runGen({ name: ic.name, e: ic.e, feedback: fb }); };
    $('#genSave').onclick = async () => {
      const ic = GEN.options[GEN.picked]; if (!ic) return;
      let base = ($('#genName').value || ic.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'icon', n = 'oz-' + base, k = 2;
      while (S.byName.has(n)) n = `oz-${base}-${k++}`;
      const doc = { n, e: ic.e, t: [...new Set([...$('#genTags').value.split(/[,،]/).map((x) => x.trim().toLowerCase()).filter(Boolean), ...base.split('-')])].slice(0, 16), prompt: $('#genDesc').value.trim().slice(0, 500), created: Date.now() };
      $('#genSave').disabled = true;
      try {
        const where = await saveCustomIcon(doc);
        if (!S.byName.has(n)) addCustomIcons([doc, ...S.icons.filter((x) => x.src === 'oz').map((x) => x.custom)]);
        if ($('#genToSet').checked && !S.set.includes(n)) { S.set.push(n); saveSession(); renderTray(); }
        select(n); toast(where === 'shared' ? `${n} נשמר במאגר המשותף` : `${n} נשמר בדפדפן הזה`);
        $('#genStatus').textContent = `נשמר בשם ${n}. אפשר למצוא אותו בספרייה תחת "OZ".`;
      } catch (e) { $('#genStatus').textContent = 'השמירה נכשלה: ' + ((e && e.message) || 'נסו שוב'); }
      $('#genSave').disabled = false;
    };
    renderGenImages(); renderGenRefs(); renderGenOptions(); renderGenPick();
  }


  // ---------- brand icon language (studio samples per brand) ----------
  S.lang = {};
  function loadBrandLang(db) {
    if (!db) {
      fetch('brand-language.json').then((r) => r.json()).catch(() => ({})).then((base) => {
        let loc = {}; try { loc = JSON.parse(localStorage.getItem('iconstudio.lang') || '{}') || {}; } catch (e) {}
        S.lang = { ...(base && typeof base === 'object' ? base : {}), ...loc }; renderBrandPanel();
      });
      return;
    }
    db.collection('brandIcons').onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data(); }); S.lang = m; renderBrandPanel(); if ($('#langGrid')) renderLangSamples(); }, () => {});
  }
  const langOf = (b) => (b && S.lang[b.id]) || null;
  async function saveLang(id, doc) {
    S.lang[id] = doc;
    if (S.db) { await S.db.collection('brandIcons').doc(id).set(doc); return; }
    try { localStorage.setItem('iconstudio.lang', JSON.stringify(S.lang)); } catch (e) {}
  }
  // Keep only drawing elements and presentation attributes from an uploaded SVG; returns a clean SVG string plus measurements.
  const SVG_TAGS = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
  const GEO_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points'];
  const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'clip-rule'];
  const okColor = (v) => /^(none|currentColor|#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]+\))$/i.test(v);
  const okNum = (v) => /^-?[0-9.]+(e-?\d+)?(px)?$/i.test(v);
  function sanitizeSvg(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    let vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some((v) => !isFinite(v)) || vb[2] <= 0) { const w = parseFloat(root.getAttribute('width')) || 24, h = parseFloat(root.getAttribute('height')) || 24; vb = [0, 0, w, h]; }
    const scale = 24 / Math.max(vb[2], vb[3]), stats = { sw: [], caps: {}, joins: {}, filled: 0, stroked: 0, colors: {}, shapes: 0, gradient: 0, grads: [] };
    const decl = (txt) => { const m = {}; for (const part of String(txt || '').split(';')) { const k = part.slice(0, part.indexOf(':')).trim().toLowerCase(), v = part.slice(part.indexOf(':') + 1).trim(); if (part.includes(':') && k && v) m[k] = v; } return m; };
    // CSS classes from <style> (Illustrator exports: .cls-1{fill:none;stroke:url(#linear-gradient)})
    const classes = {};
    for (const st of doc.querySelectorAll('style')) for (const m of st.textContent.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const d = decl(m[2]);
      for (const sel of m[1].split(',')) { const c = sel.trim().match(/^\.([\w-]+)$/); if (c) classes[c[1]] = { ...(classes[c[1]] || {}), ...d }; }
    }
    // Gradients, kept with fresh ids so many samples can sit on one page.
    const sfx = Math.random().toString(36).slice(2, 7), gmap = {};
    const grads = [...doc.querySelectorAll('linearGradient, radialGradient')];
    grads.forEach((g) => { const id = g.getAttribute('id'); if (id && /^[\w.-]+$/.test(id)) gmap[id] = `${id.replace(/[^\w-]/g, '')}-${sfx}`; });
    const okNumList = (v) => /^[0-9.,\s+\-eE%]+$/.test(v);
    const gradDefs = grads.map((g) => {
      const id = gmap[g.getAttribute('id')]; if (!id) return '';
      const tag = g.nodeName.replace(/^.*:/, ''), at = [`id="${id}"`];
      for (const k of ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']) { const v = g.getAttribute(k); if (v != null && okNumList(v)) at.push(`${k}="${v}"`); }
      const gu = g.getAttribute('gradientUnits'); if (gu === 'userSpaceOnUse' || gu === 'objectBoundingBox') at.push(`gradientUnits="${gu}"`);
      const gt = g.getAttribute('gradientTransform'); if (gt && /^[a-z0-9.,\s()+\-eE]+$/i.test(gt)) at.push(`gradientTransform="${gt}"`);
      const href = (g.getAttribute('href') || g.getAttribute('xlink:href') || '').replace(/^#/, ''); if (gmap[href]) at.push(`href="#${gmap[href]}"`);
      const stopCols = [...g.querySelectorAll('stop')].map((sp) => (decl(sp.getAttribute('style'))['stop-color'] || sp.getAttribute('stop-color') || '')).filter(okColor);
      if (stopCols.length >= 2) stats.grads.push([stopCols[0], stopCols[stopCols.length - 1]]);
      const stops = [...g.querySelectorAll('stop')].map((sp) => { const sd = decl(sp.getAttribute('style')); const col = sd['stop-color'] || sp.getAttribute('stop-color') || '#000', op = sd['stop-opacity'] || sp.getAttribute('stop-opacity'), off = sp.getAttribute('offset') || '0';
        return okColor(col) && okNumList(off) ? `<stop offset="${off}" stop-color="${col}"${op && okNum(op) ? ` stop-opacity="${op}"` : ''}/>` : ''; }).join('');
      return `<${tag} ${at.join(' ')}>${stops}</${tag}>`;
    }).join('');
    const okPaint = (v) => okColor(v) || /^url\(\s*['"]?#([\w.-]+)['"]?\s*\)$/.test(v);
    const fixPaint = (v) => { const m = v.match(/^url\(\s*['"]?#([\w.-]+)['"]?\s*\)$/); return m ? (gmap[m[1]] ? `url(#${gmap[m[1]]})` : null) : v; };
    const isWhite = (v) => /^(#fff|#ffffff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i.test(String(v || '').trim());
    const paintOf = (el) => { const m = {}; for (const c of (el.getAttribute('class') || '').split(/\s+/)) if (classes[c]) Object.assign(m, classes[c]); const attrs = {}; for (const k of PAINT) { const v = el.getAttribute(k); if (v != null) attrs[k] = v; } return { ...attrs, ...m, ...decl(el.getAttribute('style')) }; };
    // How much a transform enlarges strokes (so stroke width is measured as drawn).
    const tScale = (tf) => { let k = 1; for (const m of String(tf || '').matchAll(/(matrix|scale)\(([^)]*)\)/g)) { const n = m[2].split(/[\s,]+/).map(Number); k *= m[1] === 'matrix' ? Math.sqrt(Math.abs(n[0] * n[3] - n[1] * n[2])) || 1 : Math.sqrt(Math.abs(n[0] * (n[1] ?? n[0]))) || 1; } return k; };
    const walk = (el, inh, ks = 1) => {
      const tag = el.nodeName.toLowerCase(); if (!SVG_TAGS.has(tag)) return '';
      const st = paintOf(el), at = {}, cur = { ...inh }; ks *= tScale(el.getAttribute('transform'));
      for (const k of PAINT) {
        let v = String(st[k] ?? '').trim(); if (!v) continue;
        if (k === 'fill' || k === 'stroke') { if (!okPaint(v)) continue; v = fixPaint(v); if (!v) continue; }
        else if (/linecap|linejoin|rule/.test(k)) { if (!/^[a-z-]+$/.test(v)) continue; }
        else if (!okNum(v)) continue;
        at[k] = v.replace(/px$/, ''); cur[k] = at[k];
      }
      if (tag !== 'g') for (const k of GEO_ATTRS) { const v = el.getAttribute(k); if (v == null) continue; if (k === 'd' ? /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/.test(v) : k === 'points' ? /^[0-9.,\s+\-eE]+$/.test(v) : okNum(v)) at[k] = v; }
      const tf = el.getAttribute('transform'); if (tf && /^[a-z0-9.,\s()+\-eE]+$/i.test(tf)) at.transform = tf;
      if (tag === 'g') { const inner = [...el.children].map((c) => walk(c, cur, ks)).join(''); return inner ? `<g ${Object.entries(at).map(([k, v]) => `${k}="${v}"`).join(' ')}>${inner}</g>` : ''; }
      const fill = cur.fill ?? '#000', stroke = cur.stroke ?? 'none';
      if (isWhite(fill) && stroke === 'none') return ''; // artboard / card backgrounds
      stats.shapes++;
      if (stroke !== 'none') { stats.stroked++; stats.sw.push((parseFloat(cur['stroke-width'] ?? 1)) * scale * ks); const cp = cur['stroke-linecap'] || 'butt', jn = cur['stroke-linejoin'] || 'miter'; stats.caps[cp] = (stats.caps[cp] || 0) + 1; stats.joins[jn] = (stats.joins[jn] || 0) + 1; if (stroke.startsWith('url(')) stats.gradient++; else stats.colors[stroke] = (stats.colors[stroke] || 0) + 1; }
      if (fill !== 'none') { stats.filled++; if (fill.startsWith('url(')) stats.gradient++; else stats.colors[fill] = (stats.colors[fill] || 0) + 1; }
      return `<${tag} ${Object.entries(at).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
    };
    const rootPaint = {}; const rp = paintOf(root);
    for (const k of PAINT) { let v = String(rp[k] ?? '').trim(); if (!v) continue; if (k === 'fill' || k === 'stroke') { if (!okPaint(v)) continue; v = fixPaint(v); if (!v) continue; } else if (/linecap|linejoin|rule/.test(k) ? !/^[a-z-]+$/.test(v) : !okNum(v)) continue; rootPaint[k] = v; }
    const body = [...root.children].map((c) => walk(c, rootPaint)).join('');
    if (!body) return null;
    const ra = Object.entries(rootPaint).map(([k, v]) => `${k}="${v}"`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"${ra ? ' ' + ra : ''}>${gradDefs ? `<defs>${gradDefs}</defs>` : ''}${body}</svg>`;
    return { svg, stats };
  }

  // Bake transforms and the viewBox into plain 24-grid paths, and mark accent strokes and filled shapes,
  // so the samples look exactly like the format Claude has to answer in.
  function normalizeSample(svg) {
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-10000px;top:0;width:480px;height:480px;visibility:hidden';
    host.innerHTML = svg; document.body.appendChild(host);
    try {
      const root = host.querySelector('svg'); root.setAttribute('width', '480'); root.setAttribute('height', '480');
      const vb = root.getAttribute('viewBox').split(/[\s,]+/).map(Number), sc = 24 / Math.max(vb[2], vb[3]);
      const ox = (24 - vb[2] * sc) / 2, oy = (24 - vb[3] * sc) / 2, inv = root.getScreenCTM().inverse();
      const shapes = [...root.querySelectorAll('path,circle,ellipse,rect,line,polyline,polygon')];
      const paint = shapes.map((el) => { const cs = getComputedStyle(el); return { stroke: cs.stroke, fill: cs.fill, sw: parseFloat(cs.strokeWidth) || 0 }; });
      const strokes = {}; paint.forEach((p) => { if (p.stroke && p.stroke !== 'none') strokes[p.stroke] = (strokes[p.stroke] || 0) + 1; });
      const main = Object.entries(strokes).sort((a, c) => c[1] - a[1])[0]?.[0];
      const out = [];
      shapes.slice(0, 18).forEach((el, k) => {
        const tag = el.nodeName.toLowerCase(), a = {}; for (const at of el.attributes) a[at.name] = at.value;
        let subs; try { subs = G.parsePath(G.elToD(tag, a)); } catch (e) { return; }
        const m = inv.multiply(el.getScreenCTM());
        const T = (p) => [ (m.a * p[0] + m.c * p[1] + m.e - vb[0]) * sc + ox, (m.b * p[0] + m.d * p[1] + m.f - vb[1]) * sc + oy ];
        const r = (v) => +v.toFixed(2), P = (p) => r(p[0]) + ' ' + r(p[1]), same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
        let d = '';
        for (const sp of subs) {
          let prev = sp.start; d += 'M' + P(T(prev));
          for (const q of sp.segs) { d += same(q.c1, prev) && same(q.c2, q.p) ? 'L' + P(T(q.p)) : 'C' + P(T(q.c1)) + ' ' + P(T(q.c2)) + ' ' + P(T(q.p)); prev = q.p; }
          if (sp.closed) d += 'Z';
        }
        if (!d) return;
        const p = paint[k], attrs = { d };
        if ((!p.stroke || p.stroke === 'none') && p.fill && p.fill !== 'none') attrs['data-role'] = 'fill';
        else if (main && p.stroke !== main && !String(p.stroke).startsWith('url')) attrs['data-role'] = 'accent';
        out.push(['path', attrs]);
      });
      return out;
    } catch (e) { return null; } finally { host.remove(); }
  }
  // Every inline copy gets its own gradient ids: a url(#id) that resolves to a copy inside a hidden dialog draws nothing.
  let svgUid = 0;
  const withSize = (svg, n) => { const u = 'u' + (++svgUid).toString(36); return svg.replace(/\bid="([\w.-]+)"/g, `id="$1-${u}"`).replace(/url\(#([\w.-]+)\)/g, `url(#$1-${u})`).replace(/href="#([\w.-]+)"/g, `href="#$1-${u}"`).replace('<svg ', `<svg width="${n}" height="${n}" `); };
  const hex6 = (c) => { c = String(c || '').trim(); let m = c.match(/^#([0-9a-f]{3})$/i); if (m) return '#' + m[1].split('').map((x) => x + x).join('').toUpperCase(); m = c.match(/^#([0-9a-f]{6})/i); if (m) return '#' + m[1].toUpperCase(); m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i); if (m) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('').toUpperCase(); return null; };
  function measureLang(samples) {
    const all = { sw: [], caps: {}, joins: {}, filled: 0, stroked: 0, colors: {}, shapes: 0, gradient: 0, grads: {} };
    for (const x of samples) { const r = sanitizeSvg(x.svg); if (!r) continue; const t = r.stats; all.sw.push(...t.sw); all.filled += t.filled; all.stroked += t.stroked; all.shapes += t.shapes; all.gradient += t.gradient || 0; for (const [a, c] of t.grads || []) { const k = hex6(a) + '>' + hex6(c); if (k !== 'null>null') all.grads[k] = (all.grads[k] || 0) + 1; } for (const k of ['caps', 'joins', 'colors']) for (const [a, c] of Object.entries(t[k])) all[k][a] = (all[k][a] || 0) + c; }
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0];
    const sw = all.sw.sort((a, b) => a - b)[Math.floor(all.sw.length / 2)];
    return { stroke: sw ? Math.round(sw * 4) / 4 : null, cap: top(all.caps) || null, join: top(all.joins) || null, colors: Object.entries(all.colors).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]), fillShare: all.shapes ? all.filled / all.shapes : 0, gradient: all.gradient > 0,
      gradPair: (Object.entries(all.grads).sort((a, b) => b[1] - a[1])[0] || [null])[0], solid: Object.entries(all.colors).map(([c, n]) => [hex6(c), n]).filter(([c]) => c && c !== '#FFFFFF').sort((a, b) => b[1] - a[1]).map((x) => x[0]), perIcon: samples.length ? all.shapes / samples.length : 0 };
  }
  async function samplesSheet(samples, n = 16) {
    const list = samples.slice(0, n), cols = Math.min(4, list.length), rows = Math.ceil(list.length / cols), C = 200;
    const c = document.createElement('canvas'); c.width = cols * C; c.height = rows * C; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) { try { const im = await svgImage(withSize(list[i].svg, 160)); ctx.drawImage(im, (i % cols) * C + 20, Math.floor(i / cols) * C + 20, 160, 160); } catch (e) {} }
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
  const langCode = (samples, n = 10) => samples.slice(0, n).map((x) => `${x.name}: ${x.svg.slice(0, 1400)}`).join('\n');
  function langBlock(b, L) {
    const p = L.profile || {}, norm = L.samples.filter((x) => x.norm && x.norm.length);
    const rules = (p.rules || []).map((x) => '- ' + (x.en || x)).join('\n');
    const pairs = (p.pairs || []).map((pr) => ({ lib: icon(pr.lib), smp: L.samples[pr.i] })).filter((x) => x.lib && x.smp && x.smp.norm).slice(0, 6);
    return `BRAND ICON LANGUAGE for "${b.name}": icons the studio drew for this brand. Every new icon must look like it was drawn by the same hand.
${L.designer ? `DESIGNER NOTES (highest priority, written by the brand's designer): ${L.designer}\n` : ''}${rules ? `LANGUAGE RULES (measured from the samples; follow them strictly):\n${rules}\n` : p.notes ? `Style notes: ${p.notes}\n` : ''}
STUDIO SAMPLES, already converted to the exact 24x24 element format you must answer in ("data-role":"accent" = second colour, "fill" = filled shape):
${(norm.length ? norm.slice(0, 12).map((x, i) => `${(p.subjects && p.subjects[L.samples.indexOf(x)]) || x.name}: ${JSON.stringify(x.norm).slice(0, 1600)}`) : [langCode(L.samples)]).join('\n')}
${pairs.length ? `\nBEFORE → AFTER: the same subject as a generic library icon and as the studio drew it. Study what changes (corners, terminals, gaps, proportions, detail, colour roles) and apply the same transformation:\n${pairs.map((x) => `LIBRARY ${x.lib.b}: ${JSON.stringify(x.lib.e).slice(0, 900)}\nSTUDIO  ${x.lib.b}: ${JSON.stringify(x.smp.norm).slice(0, 1600)}`).join('\n')}\n` : ''}`;
  }

  const langColors = (m) => (m && m.gradPair ? m.gradPair.split('>') : (m && m.solid) || []).filter(Boolean).slice(0, 2);
  function renderLangSamples() {
    const b = brand(), L = langOf(b) || { samples: [] }, el = $('#langGrid'); if (!el) return;
    const tabEl = $('[data-st="samples"]'); if (tabEl) tabEl.textContent = `דוגמאות הסטודיו (${L.samples.length})`;
    el.innerHTML = L.samples.length ? L.samples.map((x, i) => `<div class="lang-s" title="${esc(x.name)}">${withSize(x.svg, 44)}<span>${esc(x.name)}</span><button class="tix" data-lrm="${i}" aria-label="הסרת ${esc(x.name)}">×</button></div>`).join('') : '<p class="status">עדיין אין דוגמאות. העלו קובצי SVG של אייקונים שהסטודיו עיצב למותג הזה.</p>';
    $$('[data-lrm]', el).forEach((x) => x.onclick = async () => { const nl = { ...L, samples: L.samples.filter((_, i) => i !== +x.dataset.lrm), profile: null }; await saveLang(b.id, nl); renderLangSamples(); renderBrandPanel(); });
    const p = L.profile, pe = $('#langProfile');
    if (pe) pe.innerHTML = p ? `<div class="lang-prof"><b>מה נמדד:</b> קו ${p.measured.stroke ?? '?'}px · קצה ${p.measured.cap ?? '?'} · פינות ${p.measured.join ?? '?'} · ${Math.round(p.measured.fillShare * 100)}% צורות מלאות${p.measured.gradient ? ' · גרדיאנט' : ''} · בערך ${p.measured.perIcon.toFixed(1)} צורות לאייקון
        ${p.notesHe ? `<p style="margin:6px 0 0"><b>השפה לפי Claude:</b> ${esc(p.notesHe)}</p>` : ''}
        ${p.rules && p.rules.length ? `<details class="lang-rules" open><summary><b>כללי השפה (${p.rules.length})</b></summary><ul>${p.rules.map((x) => `<li>${esc(x.he || x.en)}</li>`).join('')}</ul></details>` : ''}
        ${p.pairs && p.pairs.length ? `<div class="field" style="margin:6px 0 0"><span class="lbl">זוגות "לפני ← אחרי" שהמנוע לומד מהם (אייקון מהספרייה ← הגרסה של הסטודיו)</span><div class="row" style="gap:10px;flex-wrap:wrap">${p.pairs.slice(0, 8).map((pr) => icon(pr.lib) && L.samples[pr.i] ? `<span class="lang-pair" title="${esc(pr.lib)}">${svgFor(pr.lib, neutral, { size: 24, id: 'lp' })}<i>←</i>${withSize(L.samples[pr.i].svg, 28)}</span>` : '').join('')}</div></div>` : ''}
        ${langColors(p.measured).length ? `<div class="row" style="gap:6px;margin-top:6px"><b>צבעים:</b>${langColors(p.measured).map((c) => `<i class="lang-sw" style="background:${c}"></i><span class="mono">${c}</span>`).join('')}${p.measured.gradPair ? '<span class="status">(גרדיאנט)</span>' : ''}</div>` : ''}
        <div class="row" style="margin-top:8px"><button class="btn small" id="langApply">עדכון סגנון המותג לפי הדוגמאות</button><span class="status">קו, קצה, פינות${langColors(p.measured).length ? ', צבעים' : ''}${p.style || p.measured.gradPair ? ' וסגנון' : ''}</span></div></div>` : '';
    const dn = $('#langDesigner'); if (dn) { dn.value = L.designer || ''; $('#langDesignerSave').onclick = async () => { await saveLang(b.id, { ...L, designer: dn.value.trim().slice(0, 1200) }); toast('ההערות נשמרו ויקבלו עדיפות בכל התאמה'); }; }
    const ap = $('#langApply'); if (ap) ap.onclick = () => { const m = p.measured, d = { ...brand() }; const cols = langColors(m); if (cols[0]) d.primary = cols[0]; if (cols[1]) d.secondary = cols[1]; if (m.gradPair) d.style = 'gradient'; if (m.stroke) d.stroke = Math.min(3, Math.max(1, m.stroke)); if (['round', 'butt', 'square'].includes(m.cap)) d.cap = m.cap; if (['round', 'miter', 'bevel'].includes(m.join)) d.join = m.join; if (!m.gradPair && p.style && ['outline', 'duotone', 'twotone', 'gradient'].includes(p.style)) d.style = p.style; S.draft = d; S.dirty = true; renderAll(); toast('הסגנון עודכן. לחצו "שמירה" בחלונית המותג כדי לשמור.'); };
  }
  // A sheet SVG with many icons (Figma export of a frame, a sprite with <symbol>s) → one clean SVG per icon.
  function splitSheet(text) {
    let raw; try { raw = new DOMParser().parseFromString(text, 'image/svg+xml'); } catch (e) { return null; }
    const syms = [...raw.querySelectorAll('symbol')];
    if (syms.length >= 2) return syms.map((sy) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sy.getAttribute('viewBox') || '0 0 24 24'}" ${[...sy.attributes].filter((x) => PAINT.includes(x.name) || x.name === 'style').map((x) => `${x.name}="${x.value.replace(/"/g, '')}"`).join(' ')}>${sy.innerHTML}</svg>`);
    const clean = sanitizeSvg(text); if (!clean) return null;
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-10000px;top:0;width:2000px;height:2000px;visibility:hidden';
    host.innerHTML = clean.svg; document.body.appendChild(host);
    try {
      const root = host.querySelector('svg'); root.setAttribute('width', '2000'); root.setAttribute('height', '2000');
      const vb = root.getAttribute('viewBox').split(' ').map(Number), area = vb[2] * vb[3];
      // Walk down single-child wrappers, remembering their attributes so each icon keeps inherited stroke/fill.
      let level = root; const wrap = [];
      const kids = (el) => [...el.children].filter((c) => c.nodeName.toLowerCase() !== 'defs');
      while (kids(level).length === 1 && kids(level)[0].nodeName.toLowerCase() === 'g') { level = kids(level)[0]; wrap.push([...level.attributes].map((a) => `${a.name}="${a.value}"`).join(' ')); }
      const box = (el) => { try { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); el.parentNode.insertBefore(g, el); g.appendChild(el); const r = g.getBBox(); g.parentNode.insertBefore(el, g); g.remove(); return r.width || r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; } catch (e) { return null; } };
      const defsHtml = (root.querySelector('defs') || { outerHTML: '' }).outerHTML;
      let items = [...level.children].filter((el) => el.nodeName.toLowerCase() !== 'defs').map((el) => ({ el, b: box(el) })).filter((x) => x.b && x.b.w * x.b.h < area * 0.5);
      if (items.length < 2) return null;
      // Group nearby shapes into icons: boxes that touch or sit closer than a fraction of a typical icon size.
      const sizes = items.map((x) => Math.max(x.b.w, x.b.h)).sort((a, c) => a - c), gap = sizes[Math.floor(sizes.length * 0.9)] * 0.3;
      const parent = items.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const near = (a, c) => a.x - gap <= c.x + c.w && c.x - gap <= a.x + a.w && a.y - gap <= c.y + c.h && c.y - gap <= a.y + a.h;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (near(items[i].b, items[j].b)) parent[find(i)] = find(j);
      const groups = new Map(); items.forEach((x, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(x); });
      if (groups.size < 2) return null;
      const out = [...groups.values()].map((g) => {
        const x0 = Math.min(...g.map((x) => x.b.x)), y0 = Math.min(...g.map((x) => x.b.y)), x1 = Math.max(...g.map((x) => x.b.x + x.b.w)), y1 = Math.max(...g.map((x) => x.b.y + x.b.h));
        const side = Math.max(x1 - x0, y1 - y0) * 1.2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        let inner = g.map((x) => x.el.outerHTML).join('');
        for (const w of wrap.slice().reverse()) inner = `<g ${w}>${inner}</g>`;
        const rp = [...root.attributes].filter((a) => !['viewBox', 'width', 'height', 'xmlns'].includes(a.name)).map((a) => `${a.name}="${a.value}"`).join(' ');
        return { y: cy, x: cx, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${+(cx - side / 2).toFixed(2)} ${+(cy - side / 2).toFixed(2)} ${+side.toFixed(2)} ${+side.toFixed(2)}" ${rp}>${defsHtml}${inner}</svg>` };
      });
      // Reading order: rows top to bottom, then left to right.
      const rowH = sizes[Math.floor(sizes.length / 2)] || 1;
      out.sort((a, c) => (Math.round(a.y / rowH) - Math.round(c.y / rowH)) || a.x - c.x);
      return out.map((x) => x.svg);
    } finally { host.remove(); }
  }
  async function addLangFiles(texts) {
    const b = brand(), L = langOf(b) || { samples: [] }, add = []; let bad = 0, split = 0;
    const expanded = [];
    for (const [name, text] of texts) {
      const parts = splitSheet(text);
      if (parts && parts.length >= 2) { split += parts.length; parts.forEach((p, i) => expanded.push([`${name.replace(/\.svg$/i, '')}-${i + 1}`, p])); }
      else expanded.push([name, text]);
    }
    for (const [name, text] of expanded) { const r = sanitizeSvg(text); if (r) add.push({ name: name.replace(/\.svg$/i, '').slice(0, 40), svg: r.svg }); else bad++; }
    const samples = [...L.samples, ...add].slice(0, 30);
    await saveLang(b.id, { ...L, samples, profile: null, updated: Date.now() });
    renderLangSamples(); renderBrandPanel();
    $('#langStatus').textContent = `נוספו ${Math.min(add.length, 30 - L.samples.length)} דוגמאות${split ? ` (קובץ עם כמה אייקונים פוצל ל־${split})` : ''}${bad ? `, ${bad} לא נקראו (צריך SVG)` : ''}. ${samples.length >= 30 ? 'הגעתם למקסימום של 30.' : ''} אפשר למחוק בלחיצה על × דוגמה שפוצלה לא נכון.`;
  }

  async function analyzeLang() {
    const b = brand(), L0 = langOf(b); const st = $('#langStatus');
    if (!L0 || L0.samples.length < 2) { st.textContent = 'צריך לפחות 2 דוגמאות'; return; }
    st.textContent = 'ממיר את הדוגמאות לגריד של 24…';
    const L = { ...L0, samples: L0.samples.map((x) => ({ ...x, norm: normalizeSample(x.svg) || x.norm || null })) };
    const measured = measureLang(L.samples); let prof = { measured, at: Date.now() };
    const sample = await cap('sample');
    if (sample) {
      st.textContent = 'Claude מנתח את שפת האייקונים לעומק…';
      try {
        const r = await sample.json(`You are an icon designer analysing a studio's icon family for the brand "${b.name}" so that new icons can be drawn indistinguishably in the same language.
Image: the sample icons as drawn (in order, left to right, top to bottom).
The same samples converted to 24x24 path data ("data-role":"accent" = second colour, "fill" = filled shape):
${L.samples.slice(0, 16).map((x, i) => `#${i}: ${JSON.stringify(x.norm || x.svg).slice(0, 1800)}`).join('\n')}
Measured: ${JSON.stringify(measured)}
1) For every sample, name its subject in 1-3 English words (what a generic icon library would call it) and a search keyword.
2) Write 8-14 LANGUAGE RULES that are specific and checkable, with numbers in 24-grid units where possible. Cover: stroke vs fill; how lines end (caps, cut angles); corners (radius in units, sharp, chamfer); deliberate gaps/breaks (where, how long); curves vs straight lines; recurring motifs (e.g. a double-arch top edge, a broken outline, a tick, a dot); how much detail (elements per icon); proportions and padding in the 24 frame; how the second colour or fills are used; anything that differs from a generic icon set like Lucide.
3) A short summary.
Return ONLY JSON: {"subjects":[{"i":0,"subject":"shield","search":"shield"}],"rules":[{"en":"rule in English","he":"the same rule in Hebrew"}],"notes":"English summary, max 60 words","notesHe":"Hebrew summary, max 45 words","style":"outline|duotone|twotone|gradient"}`, { modelTier: 'complex', images: [await samplesSheet(L.samples)] });
        const subj = {}; for (const x of (r && Array.isArray(r.subjects) ? r.subjects : [])) if (Number.isInteger(x.i) && L.samples[x.i]) subj[x.i] = { subject: String(x.subject || '').slice(0, 40), search: String(x.search || x.subject || '').slice(0, 40) };
        const pairs = [];
        for (const [i, v] of Object.entries(subj)) { const hit = searchIcons(v.search, 8); const lib = hit.find((h) => h.src === 'lu') || hit[0]; if (lib) pairs.push({ i: +i, lib: lib.n }); }
        prof = { ...prof, notes: String(r && r.notes || '').slice(0, 700), notesHe: String(r && r.notesHe || '').slice(0, 600), style: r && r.style || null,
          rules: (Array.isArray(r && r.rules) ? r.rules : []).slice(0, 16).map((x) => ({ en: String(x.en || x).slice(0, 260), he: String(x.he || '').slice(0, 260) })),
          subjects: L.samples.map((_, i) => (subj[i] ? subj[i].subject : null)), pairs };
      } catch (e) { st.textContent = 'הניתוח של Claude נכשל, נשמרו רק המדידות.'; }
    }
    await saveLang(b.id, { ...L, profile: prof });
    renderLangSamples(); renderBrandPanel(); if (sample && prof.rules) st.textContent = `הניתוח נשמר: ${prof.rules.length} כללי שפה ו־${(prof.pairs || []).length} זוגות "לפני ← אחרי". הם ישמשו בכל התאמה ויצירה.`;
  }
  function paneLang() {
    const b = brand(), d = $('#stBody');
    d.innerHTML = `<div class="st-pane"><p class="status st-sub">אייקונים שהסטודיו עיצב למותג. המנוע לומד מהם את השפה ומתאים אליה כל אייקון.</p>
      <div class="row" style="flex-wrap:wrap"><label class="btn primary">+ העלאת קובצי SVG<input type="file" id="langFile" accept=".svg,image/svg+xml" multiple hidden></label><button class="btn" id="langPasteBtn">הדבקת קוד SVG</button><button class="btn" id="langAnalyze">ניתוח השפה</button><span class="status" id="langStatus">מומלץ 6–20 אייקונים מגוונים. אפשר קובץ לכל אייקון, או קובץ SVG אחד עם כל האייקונים, והוא יפוצל אוטומטית.</span></div>
      <div id="langPasteBox" hidden><textarea class="text mono" id="langPaste" rows="4" placeholder="<svg ...>...</svg>  אפשר כמה אייקונים ברצף"></textarea><div class="row" style="margin-top:6px"><button class="btn small" id="langPasteAdd">הוספה</button></div></div>
      <div class="lang-grid" id="langGrid"></div>
      <div id="langProfile"></div>
      <div class="field" style="margin:0"><label for="langDesigner">הערות המעצב (עדיפות עליונה)</label><textarea class="text" id="langDesigner" rows="3" placeholder="מה Claude מפספס? למשל: הקצה העליון של כל צורה סגורה הוא קשת כפולה. תמיד יש שבירה קטנה בקו המתאר. בלי מילויים. מקסימום 4 רכיבים."></textarea><div class="row" style="margin-top:6px"><button class="btn small" id="langDesignerSave">שמירת ההערות</button></div></div></div>`;
    $('#langFile').onchange = async (e) => { const files = [...e.target.files]; const texts = await Promise.all(files.map(async (f) => [f.name, await f.text()])); e.target.value = ''; addLangFiles(texts); };
    $('#langPasteBtn').onclick = () => { $('#langPasteBox').hidden = !$('#langPasteBox').hidden; };
    $('#langPasteAdd').onclick = () => { const t = $('#langPaste').value; const parts = t.match(/<svg[\s\S]*?<\/svg>/gi) || []; addLangFiles(parts.map((p, i) => [`pasted-${Date.now().toString(36)}-${i + 1}`, p])); $('#langPaste').value = ''; };
    $('#langAnalyze').onclick = analyzeLang;
    renderLangSamples();
  }

  // ---------- adapt icons to the brand language ----------
  const ADAPT = { items: [], busy: false, check: true };
  function adaptPrompt(b, L, targets, n) {
    return `${langBlock(b, L)}

TASK: Redraw each target icon so it keeps its subject and is instantly recognisable, but is drawn in the brand icon language above: it must look like the studio drew it as part of the same family.
Work like the BEFORE → AFTER examples: start from the target's library geometry and apply the same transformations the studio applied (corners, terminals, gaps, motifs, proportions, detail level, colour roles). Obey every language rule and the designer notes.
The app applies stroke width ${b.stroke}, ${b.cap} caps, ${b.join} joins and the brand colours itself, so focus on geometry: proportions, corner treatment, terminals, gaps, angles, detail level, motifs.
To use the brand's second colour on part of the icon, add "data-role":"accent" to that element's attributes. For a filled shape add "data-role":"fill". Use these only if the samples do.
Output geometry on a 24x24 grid inside 2..22, elements: path, circle, ellipse, rect, line, polyline, polygon. 1-10 elements per icon.
Targets (24x24 Lucide-style geometry):
${targets.map((t) => JSON.stringify({ id: t.n, name: t.b, elements: t.e })).join('\n')}
${n > 1 ? `Make ${n} variations, from closest to the original to most stylised. All must clearly be the same subject.` : 'Make 1 version.'}
Return ONLY JSON: {"results":[{"id":"<target id>","options":[{"name":"kebab-name","tags":["..."],"elements":[["path",{"d":"..."}]]}]}]}`;
  }
  async function adaptOne(sample, b, L, it, n, sheet) {
    const r = await sample.json(adaptPrompt(b, L, [it.src], n), { modelTier: 'complex', images: [sheet] });
    const res = (r && Array.isArray(r.results) ? r.results : []).find((x) => x.id === it.src.n) || (r && r.results && r.results[0]);
    let opts = (res && Array.isArray(res.options) ? res.options : []).map((o, k) => cleanIcon({ ...o, name: o.name || it.src.b, tags: [...(o.tags || []), ...it.src.t.slice(0, 6)] }, k)).filter(Boolean);
    if (!opts.length) return;
    it.options = opts; renderAdapt();
    if (!ADAPT.check) return;
    it.stage = 'בדיקה מול הדוגמאות…'; renderAdapt();
    try {
      const fix = await sample.json(`${langBlock(b, L)}
CHECK: Image 1 shows the studio samples. Image 2 shows candidate redraws of "${it.src.b}" on a 24-unit grid, labelled in order.
For each candidate find every way it differs from the studio language and rules: corners, terminals, gaps, motifs, proportions, stroke rhythm, detail level, colour roles; also anything that makes the subject "${it.src.b}" unclear. Return corrected candidates that a viewer could not tell apart from the studio's own icons, still clearly showing "${it.src.b}". Keep each candidate's own idea.
Candidates: ${JSON.stringify(opts.map((o) => ({ name: o.name, elements: o.e })))}
Return ONLY JSON: {"options":[{"name":"...","elements":[["path",{"d":"..."}]]}]}`, { modelTier: 'complex', images: [sheet, await optionSheet(opts)] });
      const fixed = (fix && Array.isArray(fix.options) ? fix.options : []).map((o, k) => cleanIcon({ ...o, name: o.name || it.src.b, tags: it.src.t.slice(0, 6) }, k + 20)).filter(Boolean);
      if (fixed.length) { it.options = fixed; it.picked = Math.min(it.picked, fixed.length - 1); }
    } catch (e) { /* keep the first pass */ }
  }
  async function runAdapt(targetNames, n) {
    const b = brand(), L = langOf(b), st = $('#adStatus');
    const sample = await cap('sample');
    if (!sample) { st.textContent = 'ההתאמה עובדת רק בתוך claude.ai, כי היא משתמשת ב־Claude.'; return; }
    if (ADAPT.busy) return; ADAPT.busy = true; $$('#stBody .btn.primary').forEach((x) => x.disabled = true);
    const sheet = await samplesSheet(L.samples);
    const targets = targetNames.map((x) => icon(x)).filter(Boolean);
    ADAPT.items = targets.map((t) => ({ src: t, options: [], picked: 0, keep: true, stage: 'ממתין…', saved: null }));
    ADAPT.focus = null; renderAdapt();
    // Each icon gets its own request (no mixing between icons), two at a time.
    const per = targets.length === 1 ? 3 : 2; let next = 0, done = 0;
    const worker = async () => {
      while (next < ADAPT.items.length) {
        const it = ADAPT.items[next++]; it.stage = 'Claude מצייר…'; renderAdapt();
        try { await adaptOne(sample, b, L, it, per, sheet); } catch (e) { it.error = (e && e.message) || 'נכשל'; }
        it.stage = null; done++; st.textContent = `הותאמו ${done} מתוך ${targets.length}…`; renderAdapt();
      }
    };
    await Promise.all([worker(), worker()]);
    const ok = ADAPT.items.filter((x) => x.options.length).length;
    st.textContent = ok ? `הותאמו ${ok} מתוך ${targets.length}. בחרו גרסה בכל שורה ושמרו.` : 'לא התקבלו התאמות תקינות. נסו שוב.';
    ADAPT.busy = false; $$('#stBody .btn.primary').forEach((x) => x.disabled = false); renderAdapt();
  }
  // Large side-by-side view: the original next to the chosen option, plus the real small sizes.
  function compareView(src, opt, b, key) {
    const big = (ic, lbl, id) => `<figure class="cmp-big"><div class="cmp-plate">${G.svgStatic(ic, b, { size: 200, id })}</div><figcaption>${lbl}</figcaption></figure>`;
    const sizes = (ic, id) => `<div class="cmp-sizes">${[16, 24, 32, 48].map((n) => `<span>${G.svgStatic(ic, b, { size: n, id: id + n })}<small>${n}</small></span>`).join('')}</div>`;
    return `<div class="cmp">${big(src, 'המקור · ' + esc(src.n), 'cs' + key)}<span class="ad-arrow">←</span>${opt ? big(opt, 'בשפת המותג', 'co' + key) : '<div class="cmp-big"><div class="cmp-plate"></div></div>'}</div>
      <div class="cmp-row">${sizes(src, 'ss' + key)}${opt ? sizes(opt, 'so' + key) : ''}</div>`;
  }
  function renderAdapt() {
    const el = $('#adList'); if (!el) return; const b = brand();
    if (ADAPT.focus == null || !ADAPT.items[ADAPT.focus]) ADAPT.focus = ADAPT.items.findIndex((x) => x.options.length);
    const f = ADAPT.items[ADAPT.focus];
    el.innerHTML = (f ? `<div class="ad-focus">${compareView(f.src, f.options[f.picked] || f.options[0], b, 'f')}</div>` : '')
      + ADAPT.items.map((it, i) => `<div class="ad-row" data-focus="${i}" aria-current="${i === ADAPT.focus}">
        <label class="ad-keep" title="לשמור"><input type="checkbox" data-adk="${i}" ${it.keep && it.options.length ? 'checked' : ''} ${it.options.length ? '' : 'disabled'}></label>
        <div class="ad-src" title="${it.src.n}">${G.svgStatic(it.src, b, { size: 72, id: 'as' + i })}<span>${it.src.n}</span></div>
        <span class="ad-arrow">←</span>
        <div class="ad-opts">${it.options.length ? it.options.map((o, k) => `<button class="gen-opt" data-adi="${i}" data-ado="${k}" aria-pressed="${it.picked === k}" title="הצגה בגדול">${G.svgStatic(o, b, { size: 96, id: `ao${i}_${k}` })}<span class="gen-sm">${G.svgStatic(o, b, { size: 20, id: `aos${i}_${k}` })}</span></button>`).join('') : ''}${it.stage ? `<span class="status">${it.stage}</span>` : !it.options.length ? `<span class="status">${it.error ? 'נכשל: ' + esc(it.error) : 'אין תוצאה'}</span>` : ''}</div>
        <div class="ad-act">${it.saved ? `<span class="ad-ok">✓ ${it.saved.update ? 'עודכן' : 'נשמר'}<small class="mono">${it.saved.name}</small></span>` : ''}${it.options.length ? `<button class="btn small${it.saved ? '' : ' primary'}" data-adsave="${i}">${it.src.src === 'oz' ? 'עדכון האייקון' : it.saved ? 'שמירה שוב' : 'שמירה'}</button>` : ''}</div></div>`).join('');
    $$('[data-adk]', el).forEach((x) => { x.onclick = (e) => e.stopPropagation(); x.onchange = () => { ADAPT.items[+x.dataset.adk].keep = x.checked; renderAdaptSave(); }; });
    $$('[data-adi]', el).forEach((x) => x.onclick = (e) => { e.stopPropagation(); ADAPT.items[+x.dataset.adi].picked = +x.dataset.ado; ADAPT.focus = +x.dataset.adi; renderAdapt(); });
    $$('[data-focus]', el).forEach((x) => x.onclick = () => { ADAPT.focus = +x.dataset.focus; renderAdapt(); });
    $$('[data-adsave]', el).forEach((x) => x.onclick = async (e) => { e.stopPropagation(); x.disabled = true; const it = ADAPT.items[+x.dataset.adsave]; const r = await saveOne(it, $('#adReplace').checked); renderAdapt(); if (r) toast(r.update ? `${r.name} עודכן` : `${r.name} נשמר בספריית OZ`); });
    renderAdaptSave();
  }
  function renderAdaptSave() { const sv = $('#adSave'), k = ADAPT.items.filter((x) => x.keep && x.options.length).length; if (sv) { sv.disabled = ADAPT.busy || !k; sv.textContent = k ? `שמירת כל המסומנים (${k})` : 'שמירת המסומנים'; } const ft = $('#adFoot'); if (ft) ft.hidden = !ADAPT.items.length; }

  async function saveOne(it, replace) {
    const b = brand(), o = it.options[it.picked] || it.options[0]; if (!o) return null;
    const update = it.src.src === 'oz';
    let name = it.src.n;
    if (!update) { const base = `${b.id}-${it.src.b}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); let k = 2; name = 'oz-' + base; while (S.byName.has(name)) name = `oz-${base}-${k++}`; }
    const prev = update && it.src.custom ? it.src.custom : {};
    const doc = { ...prev, n: name, e: o.e, t: [...new Set([...(prev.t || []), ...o.t, ...it.src.b.split('-'), b.name.toLowerCase()])].slice(0, 16), brand: b.id, from: prev.from || it.src.n, created: prev.created || Date.now(), updated: Date.now() };
    G.uncache(name);
    await saveCustomIcon(doc);
    addCustomIcons([doc, ...S.icons.filter((x) => x.src === 'oz' && x.n !== name).map((x) => x.custom)]);
    if (!update) {
      if (replace) { const i = S.set.indexOf(it.src.n); if (i >= 0) S.set[i] = name; else if (!S.set.includes(name)) S.set.push(name); } else if (!S.set.includes(name)) S.set.push(name);
      if (S.cur === it.src.n) S.cur = name;
    }
    it.saved = { name, update }; it.src = icon(name) || it.src;
    if (ADAPT.pick) ADAPT.pick = ADAPT.pick.map((x) => (x === (prev.n || '') ? name : x));
    saveSession(); renderTray(); renderGrid(); renderInspector();
    return it.saved;
  }
  async function saveAdapted() {
    const replace = $('#adReplace').checked; let n = 0, up = 0;
    for (const it of ADAPT.items) { if (!it.keep || !it.options.length) continue; const r = await saveOne(it, replace); if (r) { n++; if (r.update) up++; } }
    renderAdapt();
    $('#adStatus').textContent = `נשמרו ${n} אייקונים${up ? ` (${up} עודכנו במקום)` : ''}${replace ? '. החדשים הוחלפו בסט.' : '. החדשים נוספו לסט.'}`; toast(`נשמרו ${n} אייקונים בשפת ${brand().name}`);
  }
  function searchIcons(q, n = 18) {
    const sq = S.q, sl = S.lib; S.q = q; S.lib = 'all';
    let r = []; try { r = filtered(); } finally { S.q = sq; S.lib = sl; }
    return r.slice(0, n);
  }
  function paneAdapt(mode) {
    const b = brand(), L = langOf(b), d = $('#stBody');
    if (!L || L.samples.length < 2) { openStudio('samples'); toast('קודם מוסיפים דוגמאות של אייקוני הסטודיו למותג הזה'); return; }
    if (mode === 'one') mode = 'pick';
    if (!ADAPT.pick || !ADAPT.pick.length) ADAPT.pick = S.byName.has(S.cur) ? [S.cur] : [];
    const setList = S.set.filter((x) => S.byName.has(x));
    const targets = () => (mode === 'set' ? setList : ADAPT.pick);
    d.innerHTML = `<div class="st-pane"><p class="status st-sub">האייקונים מצוירים מחדש בשפה של ${L.samples.length} הדוגמאות של הסטודיו${L.profile && L.profile.notes ? ', כולל ניתוח השפה' : ''}.</p>
      <div class="field" style="margin:0"><span class="lbl">מה להחליף</span>${seg('adsrc', [['pick', 'אייקונים מסוימים'], ['set', `כל הסט (${setList.length})`]], mode)}</div>
      ${mode === 'pick' ? `<div class="ad-pick">
        <div class="field" style="margin:0"><span class="lbl">נבחרו <b id="adCount">${ADAPT.pick.length}</b></span><div class="row" id="adChips" style="gap:6px;flex-wrap:wrap"></div></div>
        <label class="search" style="max-width:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="adQ" type="search" placeholder="חיפוש אייקון להחלפה, בעברית או באנגלית: עגלה, תשלום, truck…" autocomplete="off"></label>
        <div class="row" id="adResults" style="gap:6px;flex-wrap:wrap"></div>
        ${setList.length ? `<div class="field" style="margin:0"><span class="lbl">או מהסט</span><div class="row" id="adFromSet" style="gap:6px;flex-wrap:wrap"></div></div>` : ''}
      </div>` : ''}
      <div class="field" style="margin:0"><span class="lbl">בשפה של הדוגמאות</span><div class="lang-strip">${L.samples.slice(0, 14).map((x) => withSize(x.svg, 28)).join('')}</div></div>
      <label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="adCheck" ${ADAPT.check ? 'checked' : ''}> שלב בדיקה: Claude משווה כל תוצאה לדוגמאות ומתקן (מדויק יותר, בערך פי 2 זמן)</label>
      ${L.profile && L.profile.rules ? '' : '<p class="status" style="margin:0">טיפ: הריצו "ניתוח השפה" בלשונית הדוגמאות. בלי הניתוח אין כללים וזוגות "לפני ← אחרי", והתוצאות פחות מדויקות.</p>'}
      <div class="row"><button class="btn primary" id="adGo"></button><span class="status" id="adStatus"></span></div>
      <div class="ad-list" id="adList"></div>
      <div class="ad-foot" id="adFoot" hidden><button class="btn primary" id="adSave" disabled>שמירת המסומנים</button><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="adReplace" checked> להחליף את המקור בסט</label><span class="status">אייקון מספריית OZ מתעדכן במקום</span></div></div>`;
    const tile = (n, on, attr) => `<button class="ti ad-t" ${attr}="${n}" title="${n}" aria-pressed="${on}">${svgFor(n, b, { size: 26, id: 'pk' })}</button>`;
    const refresh = () => {
      const t = targets(), go = $('#adGo');
      go.textContent = !t.length ? 'בחרו אייקונים' : t.length === 1 ? `יצירת 3 גרסאות ל־${t[0]}` : `התאמת ${t.length} אייקונים`;
      go.disabled = !t.length || ADAPT.busy;
      if (!ADAPT.items.length) $('#adStatus').textContent = t.length > 1 ? 'כל אייקון מותאם בנפרד ומקבל 2 גרסאות' : '';
      const ch = $('#adChips'); if (ch) { ch.innerHTML = ADAPT.pick.length ? ADAPT.pick.map((n) => `<span class="ti" title="${n}">${svgFor(n, b, { size: 26, id: 'pc' })}<button class="tix" data-unpick="${n}" aria-label="הסרת ${n}">×</button></span>`).join('') : '<span class="status">חפשו אייקון או בחרו מהסט</span>'; $('#adCount').textContent = ADAPT.pick.length;
        $$('[data-unpick]', ch).forEach((x) => x.onclick = () => { ADAPT.pick = ADAPT.pick.filter((n) => n !== x.dataset.unpick); refresh(); }); }
      $$('#adResults [data-pick], #adFromSet [data-pick]').forEach((x) => x.setAttribute('aria-pressed', ADAPT.pick.includes(x.dataset.pick)));
    };
    const toggle = (n) => { ADAPT.pick = ADAPT.pick.includes(n) ? ADAPT.pick.filter((x) => x !== n) : [...ADAPT.pick, n].slice(0, 30); refresh(); };
    if (mode === 'pick') {
      const showResults = (q) => { const el = $('#adResults'); const list = q.trim() ? searchIcons(q) : []; el.innerHTML = list.length ? list.map((x) => tile(x.n, ADAPT.pick.includes(x.n), 'data-pick')).join('') : (q.trim() ? '<span class="status">לא נמצא. נסו מילה אחרת.</span>' : ''); $$('[data-pick]', el).forEach((x) => x.onclick = () => toggle(x.dataset.pick)); };
      let qt; $('#adQ').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => showResults(e.target.value), 150); };
      const fs = $('#adFromSet'); if (fs) { fs.innerHTML = setList.map((n) => tile(n, ADAPT.pick.includes(n), 'data-pick')).join(''); $$('[data-pick]', fs).forEach((x) => x.onclick = () => toggle(x.dataset.pick)); }
    }
    $$('.seg[data-k="adsrc"] button').forEach((x) => x.onclick = () => paneAdapt(x.dataset.v));
    $('#adCheck').onchange = (e) => { ADAPT.check = e.target.checked; };
    ADAPT.items = []; renderAdapt(); refresh();
    $('#adGo').onclick = () => { const t = targets(); if (t.length) runAdapt(t).then(refresh); };
    $('#adSave').onclick = saveAdapted;
  }


  // ---------- icon studio window: adapt / new from description / studio samples ----------
  let stTab = 'adapt', stMode = 'one';
  function openStudio(tab, mode) {
    const d = $('#genDlg'), b = brand(), L = langOf(b), n = L ? L.samples.length : 0;
    if (tab) stTab = tab; if (mode) stMode = mode;
    if (stTab === 'adapt' && n < 2 && !tab) stTab = 'samples';
    d.innerHTML = `<div class="dlg"><div class="dlghead"><div><h2 style="margin:0">סטודיו אייקונים · ${esc(b.name)}</h2><h3>אייקונים שמרגישים שייכים לשפה של המותג</h3></div><button class="btn ghost" data-close>סגירה</button></div>
      <div class="st-tabs" role="tablist">${[['adapt', 'התאמה לשפת המותג'], ['gen', 'אייקון חדש מתיאור'], ['samples', `דוגמאות הסטודיו (${n})`]].map(([k, l]) => `<button role="tab" data-st="${k}" aria-selected="${k === stTab}">${l}</button>`).join('')}</div>
      <div id="stBody"></div></div>`;
    d.querySelector('[data-close]').onclick = () => d.close();
    $$('[data-st]', d).forEach((x) => x.onclick = () => openStudio(x.dataset.st));
    if (stTab === 'adapt') paneAdapt(stMode); else if (stTab === 'gen') paneGen(); else paneLang();
    if (!d.open) d.showModal();
  }
  $('#genBtn').onclick = () => openStudio();

  // ---------- guide ----------
  function openGuide() {
    const d = $('#guideDlg');
    const sec = (id, title, body) => `<section class="gd-sec" id="gd-${id}"><h3>${title}</h3>${body}</section>`;
    d.innerHTML = `<div class="dlg gd"><div class="dlghead"><div><h2 style="margin:0">מדריך למנוע האייקונים</h2><h3>איך מעצבים, מנפישים ומייצאים אייקונים בשפה של כל חברה</h3></div><button class="btn ghost" data-close>סגירה</button></div>
      <nav class="gd-toc">${[['what', 'מה זה'], ['brand', 'חברות'], ['style', 'סגנון'], ['find', 'חיפוש'], ['studio', 'סטודיו אייקונים'], ['set', 'הסט'], ['anim', 'הנפשה'], ['trans', 'מעברים'], ['export', 'ייצוא'], ['tips', 'טיפים']].map(([a, l]) => `<a href="#gd-${a}">${l}</a>`).join('')}</nav>
      <div class="gd-body">
      ${sec('what', 'מה זה עושה', `<p>המנוע לוקח אייקוני קו מוכנים ומעצב אותם מחדש לפי השפה הוויזואלית של כל חברה: צבעים, עובי קו, פינות, קצוות ומסגרת. אחר כך אפשר להנפיש אותם ולייצא לכל פורמט שצריך.</p>
        <p>יש בו 7,350 אייקונים משלוש ספריות פתוחות לשימוש מסחרי: <b>Lucide</b> (2,091), <b>Tabler</b> (4,935) ו־<b>Heroicons</b> (324). כולם בנויים על גריד של 24px, כך שהם נראים אחידים גם כשמערבבים ביניהם.</p>`)}
      ${sec('brand', 'בחירת חברה והוספת חברה חדשה', `<ol><li>למעלה מוצגת החברה הנוכחית. <b>"החלפת חברה"</b> פותח רשימה שבה כל חברה מוצגת עם האייקונים בסגנון שלה.</li>
        <li><b>"+ חברה חדשה"</b> בתחתית הרשימה. יש שתי דרכים להזין את המותג:<ul><li><b>Brandbook ב־PDF:</b> המנוע קורא את כל המסמך ומחלץ צבעים וסגנון.</li><li><b>קישור לפיגמה:</b> לפריים של צבעים או של ה־guideline. בפיגמה: לחיצה ימנית על הפריים ← Copy link to selection.</li></ul></li>
        <li>Claude מציע סגנון התחלתי, ואפשר לערוך הכול בחלונית "סגנון המותג" ולשמור. חברות שנשמרות משותפות לכל הצוות.</li></ol>`)}
      ${sec('theme', 'מצב כהה', `<p>הכפתור שליד "מדריך" מחליף בין מצב בהיר, מצב כהה ומצב לפי המערכת. במצב כהה, צבע מותג כהה מדי (למשל כחול נייבי) מוצג בממשק בגרסה בהירה יותר, והאייקונים מוצגים על כרטיס בהיר כדי שהצבעים לא ייבלעו. הקבצים המיוצאים לא משתנים.</p>`)}
      ${sec('style', 'סגנון המותג', `<ul><li><b>צבעים:</b> ראשי ומשני. "⇄ החלפה" מחליף ביניהם. ב"שימוש בצבעים" אפשר לצייר את האייקונים רק בצבע הראשי או רק במשני, בלי למחוק את הצבע השני.</li><li><b>סגנון:</b> קו (צבע אחד), דו־טון (קו ומילוי בגוון של הצבע המשני), שני צבעים (הצורה הראשית בצבע אחד והפרטים בשני), גרדיאנט.</li>
        <li><b>עובי קו, קצה קו ופינות:</b> מעוגלות, חדות או חתוכות. "חדות" הופך גם את הפינות המעוגלות שבתוך האייקון לפינות אמיתיות.</li><li><b>עוצמת המילוי:</b> בדו־טון, כמה חזק הגוון. המילוי תמיד אטום, כך שהוא נראה אותו דבר עם רקע ובלי רקע.</li><li><b>מסגרת:</b> בלי, עיגול או ריבוע מעוגל בצבע לבחירה.</li></ul>`)}
      ${sec('find', 'מציאת אייקונים', `<ul><li><b>חיפוש בספרייה:</b> אפשר לחפש בעברית או באנגלית ("משלוח", "truck"). מילה שלא נמצאת במילון נשלחת ל־Claude לתרגום.</li><li><b>סינון:</b> הכל, Lucide, Tabler או Heroicons. שמות של Tabler מתחילים ב־<span class="mono">tb-</span> ושל Heroicons ב־<span class="mono">hi-</span>.</li>
        <li><b>רשימת מילים:</b> מדביקים רשימה של נושאים (למשל מהבריף), והמנוע מציע אייקון לכל מילה עם חלופות.</li></ul>`)}
      ${sec('studio', 'סטודיו אייקונים', `<p>הכפתור <b>"✦ סטודיו אייקונים"</b> בסרגל הספרייה פותח חלון אחד עם שלוש לשוניות.</p>
        <ol><li><b>דוגמאות הסטודיו:</b> מעלים קובצי SVG של אייקונים שהסטודיו עיצב למותג (בפיגמה: לבחור את האייקונים ← Export ← SVG), או מדביקים קוד SVG. מומלץ 6–20 אייקונים מגוונים. "ניתוח השפה" מודד עובי קו, קצה ופינות, ו־Claude מתאר את השפה. אפשר לעדכן בלחיצה את סגנון המותג לפי המדידה.</li>
        <li><b>התאמה לשפת המותג:</b> בוחרים את האייקון הנבחר או את כל הסט. Claude מצייר אותם מחדש בשפה של הדוגמאות: אותו נושא, אבל נראה כאילו הסטודיו צייר אותו. לאייקון בודד מתקבלות 3 גרסאות. מסמנים מה לשמור, והגרסאות נשמרות בספריית <b>OZ</b> (למשל <span class="mono">oz-volta-truck</span>) ומחליפות את המקור בסט.</li>
        <li><b>אייקון חדש מתיאור:</b> כותבים מה האייקון צריך להראות, ואפשר להוסיף תמונות השראה ואייקונים לחיקוי. כשלמותג יש דוגמאות, Claude מעצב בשפה שלהן. ב"קרוב לרפרנס" התמונה מונחת על גריד של 24 יחידות, ו־4 האפשרויות הן אותו אייקון ברמות פישוט שונות. שלב שני אופציונלי משווה לרפרנס ומתקן.</li></ol>
        <p>הכול משותף לכל הצוות, והאייקונים שנשמרים מקבלים עיצוב, הנפשה, מעברים וייצוא כמו כל אייקון אחר.</p>`)}
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
  $('#themeBtn').onclick = () => { themePref = { auto: 'light', light: 'dark', dark: 'auto' }[themePref]; try { localStorage.setItem('iconstudio.theme', themePref); } catch (e) {} applyAccent(); renderBrands(); toast($('#themeBtn').title); };
  boot();
})();
