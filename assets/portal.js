/* ============================================================
   文集 · 名录（门户页）
   读取 data/people.json，列出全部作者；点击进入个人文集。
   ============================================================ */
(function () {
  'use strict';

  var I = {
    sun: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"></circle><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5 7.2 7.2M16.8 16.8l1.7 1.7M18.5 5.5 16.8 7.2M7.2 16.8 5.5 18.5"></path></svg>',
    moon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20.5 14.8A8.7 8.7 0 1 1 9.4 3.7a7.1 7.1 0 0 0 11.1 11.1Z"></path></svg>',
    err: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 7v6M12 16.5h.01"></path><circle cx="12" cy="12" r="9"></circle></svg>',
    empty: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5h14M5 12h9M5 19h11"></path></svg>',
    go: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"></path></svg>'
  };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }
  function wan(n) {
    n = Number(n) || 0;
    return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : n.toLocaleString('en-US');
  }
  function pad(x, w) { x = String(x); while (x.length < w) x = '0' + x; return x; }
  function d(t) {
    if (!t) return '';
    var x = new Date(t * 1000);
    return x.getFullYear() + '.' + pad(x.getMonth() + 1, 2) + '.' + pad(x.getDate(), 2);
  }
  function get(u) {
    return fetch(u, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + u);
      return r.json();
    });
  }

  function theme() {
    var t = document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'paper';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('wj-theme', t); } catch (e) { /* ignore */ }
    var b = $('#themeBtn');
    if (b) {
      var night = t === 'night';
      b.innerHTML = night ? I.sun : I.moon;
      b.setAttribute('aria-label', night ? '切换到纸白主题' : '切换到夜读主题');
      b.setAttribute('title', night ? '纸白' : '夜读');
    }
  }
  function toggleTheme() {
    document.documentElement.setAttribute('data-theme',
      document.documentElement.getAttribute('data-theme') === 'night' ? 'paper' : 'night');
    theme();
  }

  function row(p) {
    var s = p.stats || {};
    var m = p.metrics || {};
    var bits = [];
    if (p.ipInfo) bits.push(esc(p.ipInfo));
    if (p.business) bits.push(esc(p.business));
    if (p.location) bits.push('居 ' + esc(p.location));

    var stats = [
      ['回答', s.answers], ['文章', s.articles], ['想法', s.pins],
      ['提问', s.questions], ['收藏', s.favlists], ['划线', s.highlights]
    ].filter(function (x) { return x[1]; })
      .map(function (x) { return '<span><b>' + num(x[1]) + '</b>' + x[0] + '</span>'; })
      .join('');

    var a = document.createElement('a');
    a.className = 'Person Rise';
    a.href = 'person.html?u=' + encodeURIComponent(p.slug);
    a.innerHTML =
      '<img class="Person-avatar" src="' + esc(String(p.avatar || '').replace(/^http:/, 'https:')) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="">' +
      '<div class="Person-body">' +
      '<h3 class="Person-name">' + esc(p.name) + '</h3>' +
      (p.headline ? '<p class="Person-line">' + esc(p.headline) + '</p>' : '') +
      (bits.length ? '<div class="Person-meta">' + bits.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>' : '') +
      (stats ? '<div class="Person-stats">' + stats + '</div>' : '') +
      '</div>' +
      '<div class="Person-side">' +
      '<span class="Person-num">' + wan(m.followers) + ' 关注者</span>' +
      (p.latest ? '<span class="Person-time">最近更新 ' + d(p.latest) + '</span>' : '') +
      '<span class="Person-go">进入文集 ' + I.go + '</span>' +
      '</div>';
    return a;
  }

  function boot() {
    theme();
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('#themeBtn') : null;
      if (b) { toggleTheme(); return; }
      if (ev.target.closest && ev.target.closest('.Brand')) {
        ev.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    get('data/people.json').then(function (data) {
      var list = (data.people || []).slice().sort(function (a, b) {
        return (b.latest || 0) - (a.latest || 0);
      });
      var box = $('#roster');
      var cnt = $('#rosterCount');
      if (!list.length) {
        box.innerHTML = '<div class="Quiet"><div class="mark">' + I.empty +
          '</div><h3>名录还是空的</h3><p>把某位作者的抓取数据放进 data/raw/&lt;标识&gt;/ 后重新构建即可。</p></div>';
        if (cnt) cnt.textContent = '0 位';
        return;
      }
      box.innerHTML = '';
      var frag = document.createDocumentFragment();
      list.forEach(function (p, i) {
        var n = row(p);
        n.style.setProperty('--i', Math.min(i, 8));
        frag.appendChild(n);
      });
      box.appendChild(frag);
      if (cnt) cnt.textContent = list.length + ' 位';
      document.title = '文集 · 名录（' + list.length + '）';

      var total = list.reduce(function (a, p) {
        var s = p.stats || {};
        return a + (s.answers || 0) + (s.articles || 0) + (s.pins || 0);
      }, 0);
      $('#foot').innerHTML =
        '<p>本名录收录 ' + list.length + ' 位作者的公开文字作品，共 ' + num(total) + ' 条长文与短记，' +
        '整理于 ' + esc(data.generatedAt || '') + '。</p>' +
        '<p>内容版权归原作者所有，仅作个人阅读存档，不作商业用途。点击任一位作者即可进入其文集。</p>';
    }).catch(function (e) {
      $('#roster').innerHTML = '<div class="Quiet"><div class="mark">' + I.err +
        '</div><h3>名录未能载入</h3><p>' + esc(e.message) + '</p></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
