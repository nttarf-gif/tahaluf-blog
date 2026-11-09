// ينشر مقالات يومية على موقع المتنقل (ووردبريس) عبر REST + كلمة مرور تطبيق.
// المتغيرات: ANTHROPIC_API_KEY · WP_USER · WP_APP_PASSWORD (إلزامية) · WP_URL · WP_COUNT (افتراضي 2) · ARTICLE_MODEL · DRY_RUN=1
const WP = (process.env.WP_URL || 'https://almtngl-ksa.com').replace(/\/$/, '');
const { ANTHROPIC_API_KEY: KEY, WP_USER, WP_APP_PASSWORD } = process.env;
if (!KEY || !WP_USER || !WP_APP_PASSWORD) { console.error('missing ANTHROPIC_API_KEY / WP_USER / WP_APP_PASSWORD'); process.exit(1); }
const model = process.env.ARTICLE_MODEL || 'claude-haiku-5-5';
const count = +(process.env.WP_COUNT ?? 2);
const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
const wp = (p, init = {}) => fetch(WP + '/wp-json/' + p, { ...init, headers: { Authorization: auth, 'Content-Type': 'application/json', ...(init.headers || {}) } });

// محاور تخص خدمات المتنقل فعلاً. المدن حيث الخدمة معلنة في الموقع. التنويع يمنع التكرار.
const SERVICES = [
  { cat: 'خدمات السيارات', name: 'غسيل وتلميع السيارات بالبخار أمام المنزل', cities: ['جدة', 'الرياض'], themes: ['كيف تحافظ على لون سيارتك في حر الصيف', 'الفرق بين الغسيل بالبخار والغسيل التقليدي', 'متى تحتاج سيارتك تلميعاً ومتى يكفي الغسيل', 'تنظيف المقاعد الجلدية والقماشية من الداخل', 'التخلص من الروائح داخل السيارة', 'العناية بالسيارة بعد العواصف الترابية', 'أخطاء شائعة عند غسيل السيارة في البيت', 'كيف تختار شركة غسيل سيارات متنقلة بأمان', 'تنظيف المحرك والأجزاء الخارجية بحذر', 'حماية الطلاء من الرطوبة والملوحة'] },
  { cat: 'ورشة متنقلة', name: 'الورشة المتنقلة لصيانة السيارات والشاحنات', cities: ['القطيف', 'الجبيل', 'ينبع', 'نجران', 'حائل', 'بريدة', 'الأحساء', 'الخبر', 'الطائف', 'المدينة المنورة', 'مكة المكرمة'], themes: ['سيارة لا تدور: فحص البطارية والمارش', 'ارتفاع حرارة المحرك: ماذا تفعل قبل وصول الفني', 'تغيير الزيت والفلاتر: متى ولماذا', 'عطل التكييف في الصيف: الأسباب الشائعة', 'فحص الفرامل: علامات التحذير', 'صيانة الشاحنات قبل الرحلات الطويلة', 'إطار مثقوب على الطريق: خطوات آمنة', 'أضواء لوحة العدادات: ماذا تعني', 'كيف تتأكد من جودة قطع الغيار'] },
  { cat: 'نقل وتأجير المعدات الثقيلة', name: 'نقل وتأجير المعدات الثقيلة عبر منصة تحالف', cities: ['الرياض', 'جدة', 'الدمام', 'الجبيل', 'ينبع', 'تبوك'], themes: ['كيف تختار الناقلة المناسبة لحمولتك', 'ما الأوراق المطلوبة لنقل معدة ثقيلة', 'الفرق بين اللوبد والسطحة', 'نصائح لتأجير الرافعة والبوكلين', 'تأمين المعدة أثناء النقل: نقاط يجب التأكد منها', 'تخطيط مسار نقل المعدات الضخمة'] },
];
const LINKS = `- الصفحة الرئيسية للمتنقل: ${WP}/
- منصة تحالف للنقل والتأجير: https://tahalufapp.com/
- ورشة تحالف (ورشة متنقلة في مدن المملكة): https://workshop.tahalufapp.com/`;

const SYSTEM = `أنت كاتب محتوى عربي (السعودية) لموقع "المتنقل": خدمات تصل إلى العميل (غسيل وتلميع سيارات بالبخار أمام المنزل في جدة والرياض، ورشة متنقلة لصيانة السيارات والشاحنات، ونقل وتأجير معدات ثقيلة عبر منصة تحالف). رقم الحجز 0561115652.
القواعد الصارمة:
- المقال يجيب سؤالاً حقيقياً ويفيد القارئ بمعلومات عملية، بأسلوب فصحى مبسطة، دون حشو أو تكرار أو حشو كلمات مفتاحية. اذكر المدينة بشكل طبيعي في السياق.
- لا تخترع أرقاماً أو إحصاءات أو أسعاراً أو أنظمة أو أسماء أحياء غير مؤكدة، ولا تعد بسرعة وصول ولا بتوفر الخدمة في كل حي. انصح بالاتصال لتأكيد التوفر.
- لا تقل «الأفضل» أو «رقم واحد» أو ادعاءات لا يمكن إثباتها.
- الروابط: ضع 1 إلى 2 رابط Markdown داخل النص فقط من القائمة المعطاة وبشرط أن يكون الربط طبيعياً.
- البنية: مقدمة قصيرة، 4 إلى 5 عناوين ## مع فقرات وقوائم، ثم ## أسئلة شائعة بأسئلة ### قصيرة، ثم خاتمة قصيرة تذكر الاتصال على 0561115652. الطول 700–1000 كلمة. Markdown فقط.
المخرج JSON فقط بلا أي نص خارجه: {"title":"عنوان جذاب يتضمن الكلمة المفتاحية","description":"وصف ميتا 140-160 حرفاً","slug":"english-kebab-case-slug","body":"المقال دون العنوان الرئيسي"}`;

async function ask(user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 12000, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json(), txt = j.content.map(c => c.text || '').join(''), m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in response');
  return JSON.parse(m[0]);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
function md(src) {
  const out = []; let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.join('')}</${list.t}>`); list = null; } };
  for (const raw of src.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    let m;
    if ((m = l.match(/^(#{2,3})\s+(.*)/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^[-*]\s+(.*)/))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(`<li>${inline(m[1])}</li>`); }
    else { flush(); out.push(`<p>${inline(l)}</p>`); }
  }
  flush(); return out.join('\n');
}

(async () => {
  // المقالات الموجودة لتجنب التكرار
  const have = [];
  for (let p = 1; p <= 3; p++) {
    const r = await wp(`wp/v2/posts?per_page=100&page=${p}&status=publish,future&_fields=slug,title`);
    if (r.status === 401 || r.status === 403) { console.error('WP auth failed: ' + r.status); process.exit(1); }
    if (!r.ok) break;
    have.push(...(await r.json()));
  }
  console.log('existing posts:', have.length);
  const titles = have.slice(0, 120).map(x => x.title?.rendered || x.slug).join(' | ');
  const cats = await (await wp('wp/v2/categories?per_page=100&_fields=id,name')).json();
  const catId = n => (cats.find(c => c.name === n) || {}).id;

  const day = Math.floor(Date.now() / 864e5);
  let failed = 0;
  for (let i = 0; i < count; i++) {
    const s = SERVICES[(day * count + i) % SERVICES.length];
    const k = Math.floor((day * count + i) / SERVICES.length);
    const city = s.cities[k % s.cities.length], theme = s.themes[(k * 3 + i) % s.themes.length];
    try {
      const a = await ask(`الخدمة: ${s.name}\nالمدينة: ${city}\nمحور المقال: ${theme}\nاكتب مقالاً جديداً مختلفاً تماماً عن هذه العناوين المنشورة سابقاً: ${titles}\nالروابط المسموحة:\n${LINKS}`);
      if (!a.title || !a.body || a.body.length < 1500) throw new Error('invalid article');
      const slug = String(a.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `almutanaqil-${day}-${i}`;
      if (process.env.DRY_RUN) { console.log('DRY', a.title, '|', city, '|', theme, '|', a.body.length); continue; }
      const r = await wp('wp/v2/posts', { method: 'POST', body: JSON.stringify({ title: a.title, slug, content: md(a.body), excerpt: a.description, status: 'publish', categories: [catId(s.cat)].filter(Boolean) }) });
      if (!r.ok) throw new Error(`WP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const post = await r.json();
      console.log('published', post.link);
      try { await wp('rankmath/v1/updateMeta', { method: 'POST', body: JSON.stringify({ objectID: post.id, objectType: 'post', meta: { rank_math_description: a.description, rank_math_focus_keyword: `${s.name.split(' ').slice(0, 2).join(' ')} ${city}` } }) }); } catch { /* اختياري */ }
    } catch (e) { failed++; console.error(String(e).slice(0, 300)); }
  }
  if (failed && failed >= count) process.exit(1);
})();
