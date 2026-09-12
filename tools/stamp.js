/* 给页面里的静态资源加内容指纹版本号，
   避免 CDN / 浏览器把旧的 js、css 拿来配上新的 HTML。
   用法：node tools/stamp.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = ['assets/site.css', 'assets/app.js', 'assets/portal.js'];
const PAGES = ['index.html', 'person.html'];

const md5 = (f) => crypto.createHash('md5')
  .update(fs.readFileSync(path.join(ROOT, f)))
  .digest('hex').slice(0, 8);

const stamp = {};
ASSETS.forEach((a) => { stamp[a] = md5(a); });
Object.keys(stamp).forEach((a) => console.log(a.padEnd(20) + ' -> ' + stamp[a]));

PAGES.forEach((page) => {
  const p = path.join(ROOT, page);
  if (!fs.existsSync(p)) return;
  let html = fs.readFileSync(p, 'utf8');
  const before = html;
  ASSETS.forEach((a) => {
    const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\?v=[^"\']*)?', 'g');
    html = html.replace(re, a + '?v=' + stamp[a]);
  });
  if (html !== before) fs.writeFileSync(p, html);
  console.log((html === before ? '(未变化) ' : '已更新   ') + page);
});
