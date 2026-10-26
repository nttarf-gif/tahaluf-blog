// بناء المدونة: content/posts/*.md  ->  dist/  (صفحات + sitemap + rss + robots)
// التشغيل: node build.js
const fs = require('fs'), path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.json'), 'utf8'));
const SRC = path.join(__dirname, 'content', 'posts');
const OUT = path.join(__dirname, 'dist');
const BASE = cfg.siteUrl.replace(/\/$/, '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function parse(file) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/^﻿/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('front matter missing: ' + file);
  const meta = {};
  m[1].split(/\r?\n/).forEach(l => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, ''); });
  meta.slug = meta.slug || file.replace(/\.md$/, '');
  return { meta, body: m[2].trim() };
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

function md(text) {
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map(i => '<li>' + inline(i) + '</li>').join('') + `</${list.t}>`); list = null; } };
  for (const line of text.split(/\r?\n/)) {
    let m;
    if (!line.trim()) { flushP(); flushL(); }
    else if ((m = line.match(/^(#{2,3})\s+(.*)/))) { flushP(); flushL(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); }
    else if ((m = line.match(/^\d+\.\s+(.*)/))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); }
    else { flushL(); para.push(line.trim()); }
  }
  flushP(); flushL();
  return out.join('\n');
}

const CSS = `:root{--b:#0B4DA2;--a:#F59E0B;--ink:#14233a;--mute:#6b7380}*{box-sizing:border-box}body{margin:0;font-family:Cairo,Tahoma,sans-serif;background:#f3f6fb;color:var(--ink);line-height:1.95}a{color:var(--b)}
.top{background:#fff;border-bottom:1px solid #e1e8f3;position:sticky;top:0;z-index:9}.top .in{max-width:900px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}.top b{font-size:18px;color:var(--b)}.top a{text-decoration:none}.top nav{margin-inline-start:auto;display:flex;gap:6px}.top nav a{color:var(--ink);padding:6px 10px;border-radius:8px;font-size:14px}.top nav a:hover{background:#eef2f6}
header.hero{background:linear-gradient(135deg,#0B4DA2,#072f66);color:#fff;padding:40px 16px 52px;text-align:center}header.hero h1{font-size:clamp(24px,5vw,36px);margin:0 auto 8px;max-width:760px;line-height:1.5}header.hero p{max-width:680px;margin:0 auto;opacity:.93}
main{max-width:900px;margin:-26px auto 40px;padding:0 16px}.card{background:#fff;border-radius:18px;padding:22px;box-shadow:0 6px 24px #0b4da21a;margin-bottom:16px}
.card h2{margin:0 0 6px;font-size:21px}.card h2 a{text-decoration:none}.meta{color:var(--mute);font-size:13.5px}.tag{display:inline-block;background:#eaf1fb;color:var(--b);border-radius:20px;padding:1px 12px;font-size:13px;text-decoration:none}
article h2{color:var(--b);font-size:23px;margin:26px 0 8px}article h3{font-size:18px;margin:18px 0 6px}article li{margin:6px 0}
.cta{background:#fff7e6;border:1px solid #f5d38b;border-radius:16px;padding:18px;margin-top:26px;text-align:center}.btn{display:inline-block;padding:12px 24px;border-radius:12px;font-weight:700;text-decoration:none;margin:5px;background:var(--a);color:#fff}.btn.w{background:#25D366}
footer{background:#0f1623;color:#c9d3e3;padding:26px 16px;text-align:center;font-size:14px}footer a{color:#fff}`;

function layout({ title, desc, path: p, body, ld = [], type = 'website', h1, lead }) {
  const url = BASE + p;
  const fullTitle = title.includes(cfg.name) ? title : `${title} | ${cfg.name}`;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)}" href="${BASE}/rss.xml">
<meta property="og:type" content="${type}"><meta property="og:locale" content="ar_SA"><meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
${cfg.gscVerification && !/\.html$/.test(cfg.gscVerification) ? `<meta name="google-site-verification" content="${esc(cfg.gscVerification)}">` : ''}
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="top"><div class="in"><a href="${BASE}/"><b>${esc(cfg.name)}</b></a><nav><a href="${BASE}/">الرئيسية</a><a href="${cfg.mainSite}/">تطبيق تحالف</a></nav></div></div>
<header class="hero"><h1>${esc(h1)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}</header>
<main>${body}</main>
<footer>© ${new Date().getFullYear()} ${esc(cfg.org)} · <a href="${cfg.mainSite}/">${cfg.mainSite.replace('https://', '')}</a> · <a href="${BASE}/rss.xml">RSS</a></footer>
</body></html>`;
}

function write(rel, content) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); }

fs.rmSync(OUT, { recursive: true, force: true });
const posts = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter(f => f.endsWith('.md')).map(parse) : [];
posts.sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));
const orgLd = { '@type': 'Organization', name: cfg.org, url: cfg.mainSite, email: cfg.email, telephone: '+' + cfg.whatsapp };
const wa = `https://wa.me/${cfg.whatsapp}`;

const cta = `<div class="cta"><b>تحتاج نقل معدات أو تأجير معدات ثقيلة؟</b><br>اطلب عرض سعر عبر تطبيق تحالف أو تواصل معنا مباشرة.<br><a class="btn" href="${cfg.mainSite}/?utm_source=blog&utm_medium=article&utm_campaign=cta">افتح تطبيق تحالف</a><a class="btn w" href="${wa}">واتساب</a></div>`;

for (const { meta, body } of posts) {
  const p = `/posts/${meta.slug}/`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, description: meta.description,
    datePublished: meta.date, dateModified: meta.date, inLanguage: 'ar', mainEntityOfPage: BASE + p,
    author: orgLd, publisher: orgLd, articleSection: meta.category || undefined,
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: cfg.name, item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: meta.title, item: BASE + p }],
  }];
  const html = `<div class="card"><article><div class="meta">${esc(meta.date)} · <span class="tag">${esc(meta.category || 'عام')}</span></div>${md(body)}${cta}</article></div>
<div class="card"><a href="${BASE}/">&larr; كل المقالات</a></div>`;
  write(p + 'index.html', layout({ title: meta.title, desc: meta.description, path: p, body: html, ld, type: 'article', h1: meta.title, lead: meta.description }));
}

const list = posts.map(({ meta }) => `<div class="card"><div class="meta">${esc(meta.date)} · <span class="tag">${esc(meta.category || 'عام')}</span></div><h2><a href="${BASE}/posts/${meta.slug}/">${esc(meta.title)}</a></h2><p>${esc(meta.description)}</p></div>`).join('\n');
write('index.html', layout({
  title: `${cfg.name} — ${cfg.tagline}`, desc: cfg.tagline + '. مقالات يومية عن نقل المعدات الثقيلة، تأجير الكرينات والحفارات، خدمات السائقين والمقاولين والمستودعات.',
  path: '/', body: list || '<div class="card">قريبًا.</div>', h1: cfg.name, lead: cfg.tagline,
  ld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: cfg.name, url: BASE + '/', inLanguage: 'ar', publisher: orgLd }],
}));
write('404.html', layout({ title: 'الصفحة غير موجودة', desc: 'الصفحة غير موجودة', path: '/404.html', body: `<div class="card"><a href="${BASE}/">العودة للمدونة</a></div>`, h1: 'الصفحة غير موجودة' }));

const urls = ['/', ...posts.map(p => `/posts/${p.meta.slug}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `<url><loc>${BASE}${u}</loc>${i && posts[i - 1].meta.date ? `<lastmod>${posts[i - 1].meta.date}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
write('CNAME', new URL(BASE).hostname + '\n');
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.name)}</title><link>${BASE}/</link><description>${esc(cfg.tagline)}</description><language>ar</language>\n${posts.slice(0, 30).map(({ meta }) => `<item><title>${esc(meta.title)}</title><link>${BASE}/posts/${meta.slug}/</link><guid>${BASE}/posts/${meta.slug}/</guid><pubDate>${new Date(meta.date).toUTCString()}</pubDate><description>${esc(meta.description)}</description></item>`).join('\n')}\n</channel></rss>\n`);
if (cfg.gscVerification && /^google[\w-]+\.html$/.test(cfg.gscVerification)) write(cfg.gscVerification, 'google-site-verification: ' + cfg.gscVerification);
console.log(`built ${posts.length} posts`);
