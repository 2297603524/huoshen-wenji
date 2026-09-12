/* 把抓取到的原始 JSON 清洗为站点数据文件 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 用法：node tools/build-data.js [slug]
   原始数据 data/raw/<slug>/  →  站点数据 data/<slug>/ */
const SLUG = (process.argv[2] || 'huoshen').trim();
const RAW = path.join(ROOT, 'data', 'raw', SLUG);
const OUT = path.join(ROOT, 'data', SLUG);
fs.mkdirSync(OUT, { recursive: true });

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));

/* ---------- 内容清洗 ---------- */
function fixImg(attrs) {
  const grab = (name) => {
    const m = new RegExp(name + '="([^"]*)"').exec(attrs);
    return m ? m[1] : '';
  };
  let src = grab('data-original') || grab('data-actualsrc') || grab('data-src') || grab('src');
  if (!src || /^data:/i.test(src)) return '';
  if (/^data:/i.test(src)) return '';
  src = src.replace(/^http:\/\//, 'https://').replace(/(https:\/\/[a-z0-9.]*zhimg\.com)\/\d+\//i, '$1/');
  const w = parseInt(grab('data-rawwidth'), 10) || 0;
  const h = parseInt(grab('data-rawheight'), 10) || 0;
  const dim = (w > 0 && h > 0) ? ' width="' + w + '" height="' + h + '"' : '';
  const im = '<img src="' + src + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""' + dim + '>';
  // 超长图（高宽比 > 2.2）默认收起，避免一张图占满整屏
  if (w > 0 && h > 0 && h / w > 2.2) {
    return '<a class="ImgTall" href="' + src + '" target="_blank" rel="noopener noreferrer" title="查看原图">' +
      im + '<span class="ImgTall-tip">查看大图</span></a>';
  }
  return im;
}

function dedupeImgs(s) {
  // 知乎正文里 noscript 真图 + 懒加载占位图会渲染出两份同样的图，折叠掉
  const re = /(?:<a class="ImgTall"[\s\S]*?<\/a>)|(?:<img[^>]*>)/g;
  let out = '', last = 0, prevSrc = null, m;
  while ((m = re.exec(s))) {
    const src = (/src="([^"]+)"/.exec(m[0]) || [, ''])[1];
    const between = s.slice(last, m.index);
    const adjacent = /^[\s]*(?:<br\s*\/?>|<\/?figure[^>]*>|<\/?p>)?[\s]*$/.test(between);
    if (src && src === prevSrc && adjacent) {
      // 丢弃当前这一份（连同中间的空白/空标签）
    } else {
      out += between + m[0];
    }
    prevSrc = src;
    last = m.index + m[0].length;
  }
  out += s.slice(last);
  return out;
}

function cleanHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html;
  // 去掉脚本 / 样式
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  // 图片懒加载还原（先处理 noscript 包装）
  s = s.replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1');
  s = s.replace(/<img([^>]*?)\/?>/gi, (m, attrs) => fixImg(attrs));
  s = dedupeImgs(s);
  // 知乎跳转链接还原
  s = s.replace(/href="https?:\/\/link\.zhihu\.com\/\?target=([^"&]*)[^"]*"/gi, (m, t) => {
    let u = t;
    try { u = decodeURIComponent(t); } catch (e) { /* ignore */ }
    return 'href="' + u + '" target="_blank" rel="noopener noreferrer"';
  });
  // 绝对化站内链接
  s = s.replace(/href="\/(?!\/)/g, 'href="https://www.zhihu.com/');
  s = s.replace(/<a (?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');
  // 清掉空段落与空图框
  s = s.replace(/<p[^>]*>\s*<\/p>/gi, '');
  s = s.replace(/<figure[^>]*>\s*<\/figure>/gi, '');
  return s.trim();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pinHtml(blocks) {
  if (!Array.isArray(blocks)) return '';
  const out = [];
  blocks.forEach((b) => {
    if (!b) return;
    if (b.type === 'text') {
      const t = (b.own_text || b.content || '').trim();
      if (t) out.push('<p>' + esc(t) + '</p>');
    } else if (b.type === 'image') {
      const u = b.original_url || b.url || '';
      if (!u) return;
      const dim = (b.width > 0 && b.height > 0) ? ' width="' + b.width + '" height="' + b.height + '"' : '';
      out.push('<img src="' + esc(u.replace(/^http:/, 'https:')) +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""' + dim + '>');
    } else if (b.type === 'quote') {
      const t = (b.own_text || b.content || '').trim();
      if (t) out.push('<blockquote>' + esc(t) + '</blockquote>');
    } else if (b.type === 'link') {
      out.push('<a class="LinkCard" href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">' +
        (b.image_url ? '<img src="' + esc(b.image_url) + '" referrerpolicy="no-referrer" alt="">' : '') +
        '<b>' + esc(b.title || b.url) + '</b></a>');
    } else if (b.type === 'video') {
      out.push('<p>［视频］' + esc(b.title || b.url || '') + '</p>');
    }
  });
  return out.join('');
}

/* ---------- 数据构建 ---------- */
const rawProfile = readJSON('profile.json');
const rawAnswers = readJSON('answers.json');
const rawArticles = readJSON('articles.json');
const rawPins = readJSON('pins.json');
const rawQuestions = readJSON('questions.json');
const rawFavlists = readJSON('favlists.json');
const rawColumns = readJSON('columnContrib.json');
const rawFollowing = readJSON('followingColumns.json');

/* 收藏夹条目 */
let favItems = {};
try { favItems = readJSON('favitems.json'); } catch (e) { favItems = {}; }

/* 划线 */
function buildHighlights() {
  let html = '';
  try { html = readJSON('lineCommentsHTML.json'); } catch (e) { return []; }
  const parts = html.split('<div class="List-item"').slice(1);
  const pick = (chunk, cls) => {
    const m = new RegExp('<div class="' + cls + '">([\\s\\S]*?)<\\/div>').exec(chunk);
    if (!m) return '';
    return m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
  };
  const list = [];
  parts.forEach((chunk) => {
    const href = (/<a class="css-ytumd6" href="([^"]+)"/.exec(chunk) || [])[1] || '';
    const highlight = pick(chunk, 'css-1efr9n');
    const question = pick(chunk, 'css-h05wt0');
    const stats = pick(chunk, 'css-vurnku');
    if (highlight) list.push({ url: href, highlight: highlight, question: question, stats: stats });
  });
  return list;
}

/* 分页写出 */
function writePages(dir, items, size) {
  const target = path.join(OUT, dir);
  fs.mkdirSync(target, { recursive: true });
  let n = 0;
  for (let i = 0; i < items.length; i += size) {
    fs.writeFileSync(path.join(target, 'p' + n + '.json'), JSON.stringify({ items: items.slice(i, i + size) }));
    n++;
  }
  // 清理多余旧页
  for (let j = n; j < n + 5; j++) {
    const p = path.join(target, 'p' + j + '.json');
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return n;
}

/* 回答 */
const answers = rawAnswers.map((a) => ({
  id: a.id,
  question: { id: a.question && a.question.id, title: (a.question && a.question.title) || '' },
  content: cleanHtml(a.content),
  excerpt: (a.excerpt || '').trim(),
  voteupCount: a.voteup_count || 0,
  thanksCount: a.thanks_count || 0,
  commentCount: a.comment_count || 0,
  created: a.created_time || 0,
  updated: a.updated_time || 0,
  url: 'https://www.zhihu.com/answer/' + a.id
})).filter((a) => a.content || a.excerpt);

/* 文章 */
const articles = rawArticles.map((a) => ({
  id: a.id,
  title: a.title || '',
  content: cleanHtml(a.content),
  excerpt: (a.excerpt || '').trim(),
  image: a.image_url || '',
  voteupCount: a.voteup_count || 0,
  commentCount: a.comment_count || 0,
  created: a.created || a.created_time || 0,
  url: 'https://zhuanlan.zhihu.com/p/' + a.id
}));

/* 想法 */
const pins = rawPins.map((p) => ({
  id: p.id,
  title: p.excerpt_title || '',
  content: pinHtml(p.content),
  excerpt: (p.excerpt_title || '').trim(),
  voteupCount: p.like_count || 0,
  commentCount: p.comment_count || 0,
  created: p.created || 0,
  url: 'https://www.zhihu.com/pin/' + p.id
})).filter((p) => p.content);

/* 提问 */
const questions = rawQuestions.map((q) => ({
  id: q.id,
  title: q.title || '',
  detail: cleanHtml(q.detail || ''),
  answerCount: q.answer_count || 0,
  followerCount: q.follower_count || 0,
  created: q.created || 0,
  url: 'https://www.zhihu.com/question/' + q.id
}));

/* 收藏夹 */
const favlists = rawFavlists.map((f) => {
  const archived = (favItems[String(f.id)] || []).length;
  return {
    id: f.id,
    title: f.title || '',
    description: (f.description || '').trim(),
    itemCount: archived || f.item_count || f.answer_count || 0,
    sourceCount: f.item_count || f.answer_count || 0,
    followerCount: f.follower_count || 0,
    created: f.created_time || 0,
    updated: f.updated_time || 0,
    isPublic: !!f.is_public
  };
}).sort((a, b) => b.itemCount - a.itemCount);

/* 收藏夹条目单独成文件 */
const favDir = path.join(OUT, 'favlists');
fs.mkdirSync(favDir, { recursive: true });
let favTotal = 0;
favlists.forEach((f) => {
  const list = (favItems[String(f.id)] || []).map((it) => ({
    id: it.id,
    type: it.type,
    typeName: it.type === 'answer' ? '回答' : (it.type === 'article' ? '文章' : (it.type === 'pin' ? '想法' : it.type)),
    title: it.title || '',
    excerpt: (it.excerpt || '').replace(/\s+/g, ' ').trim(),
    url: it.url || '',
    voteup: it.voteup || 0,
    comments: it.comments || 0,
    created: it.created || 0,
    author: it.author && it.author.name ? it.author.name : ''
  })).filter((it) => it.title || it.excerpt);
  favTotal += list.length;
  fs.writeFileSync(path.join(favDir, f.id + '.json'), JSON.stringify(list));
});

/* 专栏（本人创建） */
const columns = rawColumns.map((c) => {
  const col = c.column || c;
  return {
    id: col.id || '',
    title: col.title || '',
    intro: (col.intro || '').trim(),
    image: col.image_url || '',
    author: (col.author && col.author.name) || '',
    updated: col.updated || 0,
    followers: col.followers || 0,
    articlesCount: col.articles_count || 0,
    voteupCount: col.voteup_count || 0,
    itemsCount: col.items_count || 0,
    url: 'https://zhuanlan.zhihu.com/' + String(col.id || '')
  };
});

/* 关注订阅 */
const following = rawFollowing.map((c) => {
  const col = c.column || c;
  return {
    id: col.id || '',
    title: col.title || '',
    intro: (col.intro || '').trim(),
    image: col.image_url || '',
    author: (col.author && col.author.name) || '',
    updated: col.updated || 0,
    followers: col.followers || 0,
    articlesCount: col.articles_count || 0,
    voteupCount: col.voteup_count || 0,
    url: 'https://zhuanlan.zhihu.com/' + String(col.id || '')
  };
});

/* 划线 */
const highlights = buildHighlights();

/* 页面数量 */
const pageCounts = {
  answers: writePages('answers', answers, 20),
  articles: writePages('articles', articles, 10),
  pins: writePages('pins', pins, 10)
};

fs.writeFileSync(path.join(OUT, 'questions.json'), JSON.stringify(questions));
fs.writeFileSync(path.join(OUT, 'favlists.json'), JSON.stringify(favlists));
fs.writeFileSync(path.join(OUT, 'columns.json'), JSON.stringify(columns));
fs.writeFileSync(path.join(OUT, 'following.json'), JSON.stringify(following));
fs.writeFileSync(path.join(OUT, 'highlights.json'), JSON.stringify(highlights));

/* 资料 */
function avatarUrl(u, size) {
  if (!u) return '';
  return u.replace(/_(xl|l|m|b|is|s)\.(jpg|jpeg|png|gif)/, '_' + size + '.$2').replace(/^http:/, 'https:');
}

const profile = {
  id: rawProfile.id,
  name: rawProfile.name,
  headline: rawProfile.headline || '',
  description: cleanHtml(rawProfile.description || ''),
  avatar: avatarUrl(rawProfile.avatar_url, 'xl'),
  avatarMid: avatarUrl(rawProfile.avatar_url, 'l'),
  ipInfo: rawProfile.ip_info || '',
  business: rawProfile.business && rawProfile.business.name ? rawProfile.business.name : '',
  location: (rawProfile.locations || []).map((x) => x.name).join(' / '),
  gender: rawProfile.gender,
  isVip: !!(rawProfile.kvip_info && rawProfile.kvip_info.is_vip),
  followerCount: rawProfile.follower_count || 0,
  followingCount: rawProfile.following_count || 0,
  voteupCount: rawProfile.voteup_count || 0,
  thankedCount: rawProfile.thanked_count || 0,
  favoritedCount: rawProfile.favorited_count || 0,
  answerCount: rawProfile.answer_count || 0,
  articlesCount: rawProfile.articles_count || 0,
  questionCount: rawProfile.question_count || 0,
  pinsCount: rawProfile.pins_count || 0,
  favlistsCount: rawProfile.favlists_count || 0,
  columnsCount: rawProfile.columns_count || 0
};

const meta = {
  profile: profile,
  sourceUrl: 'https://www.zhihu.com/people/huo-shen-ba-hao-59',
  fetchedAt: new Date().toISOString().slice(0, 10),
  tabs: [
    { key: 'answers', label: '回答' },
    { key: 'articles', label: '文章' },
    { key: 'pins', label: '想法' },
    { key: 'questions', label: '提问' },
    { key: 'favlists', label: '收藏' },
    { key: 'columns', label: '专栏' },
    { key: 'following', label: '关注订阅' },
    { key: 'highlights', label: '划线' }
  ],
  counts: {
    answers: answers.length,
    articles: articles.length,
    pins: pins.length,
    questions: questions.length,
    favlists: favlists.length,
    columns: columns.length,
    following: following.length,
    highlights: highlights.length
  },
  archived: {
    answers: answers.length,
    articles: articles.length,
    pins: pins.length,
    questions: questions.length,
    favlists: favlists.length,
    favItems: favTotal,
    columns: columns.length,
    following: following.length,
    highlights: highlights.length
  },
  rawCounts: {
    answers: answers.length,
    articles: articles.length,
    pins: pins.length,
    comments: 0,
    favItems: favTotal
  },
  pageCounts: pageCounts
};

fs.writeFileSync(path.join(OUT, 'profile.json'), JSON.stringify(meta));

console.log('SUMMARY ' + JSON.stringify({
  slug: SLUG,
  answers: answers.length,
  articles: articles.length,
  pins: pins.length,
  questions: questions.length,
  favlists: favlists.length,
  favItems: favTotal,
  columns: columns.length,
  following: following.length,
  highlights: highlights.length,
  pageCounts: pageCounts
}));
