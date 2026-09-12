/* 给 index.html 里的静态资源加内容指纹版本号，
   避免 CDN/浏览器把旧的 app.js、site.css 拿来配上新的 HTML。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const hash = (f) => crypto.createHash('md5')
  .update(fs.readFileSync(path.join(ROOT, f)))
  .digest('hex').slice(0, 8);

const js = hash('assets/app.js');
const css = hash('assets/site.css');

const p = path.join(ROOT, 'index.html');
let html = fs.readFileSync(p, 'utf8');
const before = html;
html = html.replace(/assets\/app\.js(\?v=[^"']*)?/g, 'assets/app.js?v=' + js);
html = html.replace(/assets\/site\.css(\?v=[^"']*)?/g, 'assets/site.css?v=' + css);
if (html !== before) fs.writeFileSync(p, html);

console.log('app.js  ->', js);
console.log('site.css->', css);
console.log(html === before ? '(未变化)' : 'index.html 已更新');
