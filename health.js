// فحص صحة المنظومة: يفشل (exit 1) إذا تعطل شيء أو اقترب موعد انتهاء شيء، فيصلك إيميل GitHub عن فشل التشغيل.
// يعمل كل يومين من .github/workflows/health.yml حتى يُصلح العطل. المتغيرات: ANTHROPIC_API_KEY (اختياري)
const fs = require('fs'), path = require('path'), tls = require('tls');
const problems = [], ok = [];
const bad = m => problems.push(m), good = m => ok.push(m);
const today = new Date(Date.now() + 3 * 3600e3), day = d => Math.floor(Date.parse(d) / 864e5), now = Math.floor(today.getTime() / 864e5);

// تذكيرات انتهاء/تجديد: [تاريخ الاستحقاق، الرسالة، كم يوماً قبله يبدأ التنبيه]
const REMINDERS = [
  ['2026-12-03', 'موعد تجديد الاستضافة (Hostinger) يقترب', 14],
  ['2027-11-08', 'انتهت سنة التسويق التلقائي: راجع النتائج في Search Console وجدّد الخطة', 14],
];

const SITES = [
  ['https://blog.tahalufapp.com/', 'المدونة'],
  ['https://remote.tahalufapp.com/', 'منصة العمل عن بعد'],
  ['https://workshop.tahalufapp.com/', 'ورشة تحالف'],
  ['https://workshop.tahalufapp.com/mobile-workshop-riyadh.html', 'صفحة مدينة (الورشة)'],
  ['https://kovera.tahalufapp.com/', 'كوفيرة بيتي'],
  ['https://kovera.tahalufapp.com/home-coiffeuse-riyadh.html', 'صفحة مدينة (كوفيرة)'],
  ['https://tahalufapp.com/', 'موقع تحالف الرئيسي'],
];
const SITEMAPS = ['https://blog.tahalufapp.com/sitemap.xml', 'https://remote.tahalufapp.com/sitemap.xml', 'https://workshop.tahalufapp.com/sitemap.xml', 'https://kovera.tahalufapp.com/sitemap.xml'];

const get = async (u, init) => { const c = new AbortController(), t = setTimeout(() => c.abort(), 25000); try { return await fetch(u, { ...init, signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); } };
const certDays = host => new Promise(res => { const s = tls.connect(443, host, { servername: host, timeout: 15000 }, () => { const c = s.getPeerCertificate(); s.end(); res(c && c.valid_to ? Math.floor((Date.parse(c.valid_to) - Date.now()) / 864e5) : null); }); s.on('error', () => res(null)); s.on('timeout', () => { s.destroy(); res(null); }); });

(async () => {
  for (const [u, n] of SITES) { try { const r = await get(u); r.ok ? good(`${n}: يعمل`) : bad(`${n}: رد ${r.status} (${u})`); } catch (e) { bad(`${n}: لا يستجيب (${u}) — ${e.cause?.code || e.name}`); } }
  for (const u of SITEMAPS) { try { const r = await get(u); const t = r.ok ? await r.text() : ''; const n = (t.match(/<loc>/g) || []).length; n > 0 ? good(`خريطة الموقع ${new URL(u).host}: ${n} رابط`) : bad(`خريطة الموقع فارغة أو لا تعمل: ${u}`); } catch { bad(`خريطة الموقع لا تستجيب: ${u}`); } }
  for (const h of ['blog.tahalufapp.com', 'remote.tahalufapp.com', 'workshop.tahalufapp.com', 'kovera.tahalufapp.com']) { const d = await certDays(h); if (d === null) bad(`تعذّر فحص شهادة HTTPS لـ ${h}`); else if (d < 10) bad(`شهادة HTTPS لـ ${h} تنتهي بعد ${d} يوم`); else good(`شهادة ${h}: ${d} يوم`); }

  // حداثة المقالات: آخر مقال لا يتأخر أكثر من 3 أيام
  try {
    const dir = path.join(__dirname, 'content', 'posts');
    const latest = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => (fs.readFileSync(path.join(dir, f), 'utf8').match(/^date:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1]).filter(Boolean).sort().pop();
    const age = now - day(latest);
    age > 3 ? bad(`آخر مقال بتاريخ ${latest} (منذ ${age} أيام): النشر اليومي متعثر`) : good(`آخر مقال ${latest}`);
  } catch (e) { bad('تعذّر فحص حداثة المقالات: ' + e.message); }

  // مفتاح Anthropic وحد الإنفاق: طلب صغير جداً
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await get('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }) });
      if (r.ok) good('مفتاح Anthropic يعمل'); else { const t = await r.text(); bad(`مفتاح Anthropic/حد الإنفاق: ${r.status} ${t.slice(0, 160)}`); }
    } catch (e) { bad('تعذّر فحص مفتاح Anthropic: ' + e.message); }
  }

  for (const [due, msg, before] of REMINDERS) { const left = day(due) - now; if (left <= before) bad(`${msg} — ${left >= 0 ? `بعد ${left} يوم` : `مضى ${-left} يوم`} (${due})`); }

  const out = ['# فحص صحة المنظومة — ' + today.toISOString().slice(0, 10), '', problems.length ? '## مشاكل تحتاج إصلاحاً' : '## كل شيء سليم', ...problems.map(p => '- ❌ ' + p), '', '## سليم', ...ok.map(p => '- ✅ ' + p)].join('\n');
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
  if (problems.length) { console.error(`\n${problems.length} مشكلة`); process.exit(1); }
})();
