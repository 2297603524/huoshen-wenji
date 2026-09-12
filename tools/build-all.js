/* 批量构建所有人物数据，并生成门户页要用的 data/people.json
   用法：node tools/build-all.js
   取材：data/raw/<slug>/  →  产物：data/<slug>/  +  data/people.json */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RAW_BASE = path.join(ROOT, 'data', 'raw');
const OUT_BASE = path.join(ROOT, 'data');

function slugs() {
  if (!fs.existsSync(RAW_BASE)) return [];
  return fs.readdirSync(RAW_BASE)
    .filter((n) => {
      try { return fs.statSync(path.join(RAW_BASE, n)).isDirectory(); } catch (e) { return false; }
    })
    .sort();
}

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

function latestStamp(slug) {
  // 取该人最新一条内容的时间戳，用于门户显示「最近更新」
  const dir = path.join(OUT_BASE, slug);
  for (const f of ['answers/p0.json', 'articles/p0.json', 'pins/p0.json']) {
    const d = readJSON(path.join(dir, f), null);
    if (d && d.items && d.items.length) {
      const t = d.items[0].created;
      if (t) return t;
    }
  }
  return 0;
}

function stripTags(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

const list = [];
slugs().forEach((slug) => {
  const out = path.join(OUT_BASE, slug);
  let summary = null;
  try {
    const stdout = execFileSync(process.execPath, [path.join(__dirname, 'build-data.js'), slug], {
      cwd: ROOT, encoding: 'utf8'
    });
    const line = stdout.split('\n').find((l) => l.indexOf('SUMMARY ') === 0);
    if (line) summary = JSON.parse(line.slice(8));
  } catch (e) {
    console.error('构建失败：' + slug + ' — ' + e.message);
    return;
  }

  const meta = readJSON(path.join(out, 'profile.json'), null);
  if (!meta || !meta.profile) {
    console.error('缺少 profile.json，跳过：' + slug);
    return;
  }
  const p = meta.profile;
  list.push({
    slug: slug,
    name: p.name,
    headline: p.headline || '',
    bio: stripTags(p.description || '').slice(0, 80),
    bioHtml: p.description || '',
    avatar: p.avatar,
    ipInfo: p.ipInfo || '',
    business: p.business || '',
    location: p.location || '',
    metrics: {
      following: p.followingCount,
      followers: p.followerCount,
      voteup: p.voteupCount
    },
    stats: summary ? {
      answers: summary.answers,
      articles: summary.articles,
      pins: summary.pins,
      questions: summary.questions,
      favlists: summary.favlists,
      favItems: summary.favItems,
      columns: summary.columns,
      following: summary.following,
      highlights: summary.highlights
    } : {},
    latest: latestStamp(slug),
    updatedAt: meta.fetchedAt || ''
  });
  console.log('✓ ' + slug + '  ' + p.name + '  回答 ' + (summary ? summary.answers : '?') +
    ' / 文章 ' + (summary ? summary.articles : '?') + ' / 想法 ' + (summary ? summary.pins : '?'));
});

list.sort((a, b) => (b.latest || 0) - (a.latest || 0));

fs.writeFileSync(path.join(OUT_BASE, 'people.json'), JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  people: list
}));

console.log('\n共 ' + list.length + ' 位 → data/people.json');
