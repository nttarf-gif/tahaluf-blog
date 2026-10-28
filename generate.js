// يكتب مقالات اليوم عبر Anthropic API.
//  - SERVICE_COUNT مقالات من قائمة topics.json (خدمات تحالف مباشرة)
//  - GENERAL_COUNT مقالات متنوعة (ارفع الرقمين تدريجياً بعد أسبوعين) من categories.json، يختار النموذج لها موضوعاً جديداً لم يُكتب
// المتغيرات: ANTHROPIC_API_KEY (إلزامي) · ARTICLE_MODEL · SERVICE_COUNT (افتراضي 1) · GENERAL_COUNT (افتراضي 3)
const fs = require('fs'), path = require('path');
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const topics = read('topics.json'), cats = read('categories.json'), services = read('services.json');
const dir = path.join(root, 'content', 'posts');
fs.mkdirSync(dir, { recursive: true });
const existing = () => fs.readdirSync(dir).filter(f => f.endsWith('.md'));
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1); }
const model = process.env.ARTICLE_MODEL || 'claude-sonnet-5-5';
const nService = +(process.env.SERVICE_COUNT ?? 1), nGeneral = +(process.env.GENERAL_COUNT ?? 3);
const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت السعودية

const svcText = ids => services.filter(s => ids.includes(s.id) && s.url)
  .map(s => `- ${s.name}: ${s.url} (${s.about})`).join('\n') || '(لا توجد روابط خدمة لهذا المقال)';

const SYSTEM = `أنت كاتب محتوى عربي (السعودية) لمدونة "تحالف" التي تنشر مقالات مفيدة للجمهور، وتدعم منصة تحالف: نقل المعدات والبضائع وتأجير المعدات الثقيلة وخدمات مرتبطة.
القواعد الصارمة:
- المقال يجيب سؤالاً حقيقياً ويفيد القارئ بمعلومات عملية، بأسلوب فصحى مبسطة جذاب، دون حشو أو تكرار.
- لا تخترع أرقاماً أو إحصاءات أو دراسات أو أسعاراً أو أنظمة أو أسماء. اشرح بالمنطق والخبرة العامة، وانصح بمراجعة المختصين والجهات الرسمية.
- الموضوعات الصحية: معلومات توعوية عامة فقط، دون تشخيص أو وصف علاج أو وعود، مع نصيحة مراجعة الطبيب.
- الروابط: ضع من 1 إلى 2 رابط Markdown داخل النص فقط من القائمة المعطاة لك وبشرط أن يكون الربط طبيعياً ويخدم القارئ فعلاً (جملة سياقية، لا عبارة إعلانية مقحمة). إن لم يناسب أي رابط فلا تضع شيئاً.
- البنية: مقدمة قصيرة، 4 إلى 6 عناوين ## مع فقرات وقوائم، ثم ## أسئلة شائعة بأسئلة ### قصيرة، ثم خاتمة. الطول 800–1200 كلمة. Markdown فقط (## ### - **).
المخرج JSON فقط بلا أي نص خارجه: {"title":"عنوان جذاب يتضمن الكلمة المفتاحية","description":"وصف ميتا 140-160 حرفاً","slug":"english-kebab-case-slug","body":"المقال دون العنوان الرئيسي"}`;

async function ask(user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 16000, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.content.map(c => c.text || '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON in response (stop_reason=${j.stop_reason}, len=${txt.length}, head=${txt.slice(0, 120)})`);
  return JSON.parse(m[0]);
}

function save(a, category) {
  const slug = String(a.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  if (!slug || !a.title || !a.description || !a.body || a.body.length < 1500) throw new Error('invalid article: ' + slug);
  let final = slug, n = 2;
  while (fs.existsSync(path.join(dir, final + '.md'))) final = `${slug}-${n++}`;
  const q = s => s.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  fs.writeFileSync(path.join(dir, final + '.md'), `---\ntitle: "${q(a.title)}"\ndescription: "${q(a.description)}"\ndate: ${today}\ncategory: ${category}\nslug: ${final}\n---\n\n${a.body.trim()}\n`);
  console.log('wrote', final);
}

(async () => {
  let failed = 0;
  const run = async fn => { try { await fn(); } catch (e) { failed++; console.error(String(e).slice(0, 300)); } };

  // 1) مقالات الخدمات المباشرة
  const have = new Set(existing().map(f => f.replace(/\.md$/, '')));
  for (const t of topics.filter(t => !have.has(t.slug)).slice(0, nService)) {
    await run(async () => {
      const a = await ask(`الموضوع: ${t.topic}\nالكلمة المفتاحية: ${t.keyword}\nروابط الخدمات المسموحة:\n${svcText(t.services || ['transport', 'rental', 'drivers', 'customs', 'warehouses'])}`);
      a.slug = t.slug; save(a, t.category);
    });
  }

  // 2) مقالات متنوعة: تدوير على المحاور، والنموذج يختار موضوعاً جديداً
  const day = Math.floor(Date.now() / 864e5);
  for (let i = 0; i < nGeneral; i++) {
    const c = cats[(day * nGeneral + i) % cats.length];
    await run(async () => {
      const titles = existing().slice(-150).map(f => f.replace(/\.md$/, '')).join(', ');
      const a = await ask(`المحور: ${c.name}\nأمثلة على نطاقه: ${c.hint}\nاختر بنفسك موضوعاً جديداً مفيداً يبحث عنه الناس في السعودية ضمن هذا المحور، ولا يشبه المقالات المكتوبة (slugs): ${titles}\nروابط الخدمات المسموحة:\n${svcText(c.services)}`);
      save(a, c.name);
    });
  }
  if (failed) console.log(`${failed} article(s) failed`);
  if (failed && failed >= nService + nGeneral) process.exit(1); // فشل الكل: أظهره في GitHub
})();
