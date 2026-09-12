/* ============================================================
   火神八号 · 文集  —— 前端
   结构：顶栏 / 左侧目录栏 / 主区条目
   每栏目独立面板常驻，切换不重新请求、保留阅读位置。
   ============================================================ */
(function () {
  'use strict';

  var DATA = 'data/';
  var PAGE = { answers: 20, articles: 10, pins: 10 };
  var state = { tab: 'answers', meta: null, built: {}, pages: {}, scroll: {} };

  /* ---------------- 图标 ---------------- */
  var I = {
    up: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>',
    out: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"></path></svg>',
    sun: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"></circle><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5 7.2 7.2M16.8 16.8l1.7 1.7M18.5 5.5 16.8 7.2M7.2 16.8 5.5 18.5"></path></svg>',
    moon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20.5 14.8A8.7 8.7 0 1 1 9.4 3.7a7.1 7.1 0 0 0 11.1 11.1Z"></path></svg>',
    size: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7V5h11v2M9.5 5v14M7 19h5M15.5 12.5V11H21v1.5M18.2 11v8M16.6 19h3.2"></path></svg>',
    empty: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5h14M5 12h9M5 19h11"></path></svg>',
    err: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 7v6M12 16.5h.01"></path><circle cx="12" cy="12" r="9"></circle></svg>',
    fold: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>'
  };

  /* ---------------- 基础 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(t, c, h) {
    var n = document.createElement(t);
    if (c) n.className = c;
    if (h != null) n.innerHTML = h;
    return n;
  }
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
  function pic(u) { return esc(String(u || '').replace(/^http:/, 'https:')); }
  function img(u, cls, alt) {
    if (!u) return '';
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + pic(u) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="' + esc(alt || '') + '">';
  }
  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return r.json();
    });
  }
  var OUT = ' target="_blank" rel="noopener noreferrer"';

  /* ---------------- 偏好 ---------------- */
  function read(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    write('wj-theme', t);
    var b = $('#themeBtn');
    if (b) {
      var night = t === 'night';
      b.innerHTML = night ? I.sun : I.moon;
      b.setAttribute('aria-label', night ? '切换到纸白主题' : '切换到夜读主题');
      b.setAttribute('title', night ? '纸白' : '夜读');
    }
  }
  var SIZES = ['s', 'm', 'l'];
  var SIZE_LABEL = { s: '小', m: '中', l: '大' };
  function applySize(s) {
    document.documentElement.setAttribute('data-size', s);
    write('wj-size', s);
    var b = $('#sizeBtn');
    if (b) {
      b.innerHTML = I.size + '<span>' + SIZE_LABEL[s] + '</span>';
      b.setAttribute('aria-label', '正文字号：' + SIZE_LABEL[s] + '，点击切换');
      b.setAttribute('title', '正文字号');
    }
  }

  /* ---------------- 顶栏 ---------------- */
  function topbar(p) {
    var n = el('header', 'Topbar');
    n.id = 'topbar';
    n.innerHTML =
      '<div class="Topbar-inner">' +
      '<a class="Brand" href="#" aria-label="回到顶部">' +
      '<span class="Brand-dot" aria-hidden="true"></span>' + esc(p.name) +
      '<span class="Brand-sub">文集</span></a>' +
      '<span class="Topbar-sp"></span>' +
      '<div class="Topbar-tools">' +
      '<button class="Tool" id="sizeBtn" type="button"></button>' +
      '<button class="Tool" id="themeBtn" type="button"></button>' +
      '</div></div>';
    return n;
  }

  /* ---------------- 左栏目录 ---------------- */
  function rail(p, meta) {
    var r = el('aside', 'Rail');
    r.setAttribute('aria-label', '目录与简介');
    var h = '';
    h += img(p.avatar, 'Rail-avatar', p.name);
    h += '<h1 class="Rail-name">' + esc(p.name) + '</h1>';
    if (p.headline) h += '<div class="Rail-headline">' + esc(p.headline) + '</div>';
    if (p.description) h += '<div class="Rail-bio">' + p.description + '</div>';

    var facts = [];
    if (p.ipInfo) facts.push(esc(p.ipInfo));
    if (p.business) facts.push(esc(p.business));
    if (p.location) facts.push('居 ' + esc(p.location));
    if (facts.length) {
      h += '<div class="Rail-facts">' + facts.map(function (f) {
        return '<span><i></i>' + f + '</span>';
      }).join('') + '</div>';
    }

    h += '<div class="Rail-metrics">' +
      '<div class="Rail-metric"><b>' + wan(p.followerCount) + '</b><span>读者</span></div>' +
      '<div class="Rail-metric"><b>' + num(p.followingCount) + '</b><span>订阅</span></div>' +
      '<div class="Rail-metric"><b>' + num(p.voteupCount) + '</b><span>累计获赞</span></div>' +
      '</div>';

    h += '<nav class="Nav" aria-label="栏目"><div class="Nav-title">目录</div>';
    (meta.tabs || []).forEach(function (t) {
      h += '<button class="Nav-item" type="button" data-tab="' + t.key + '"' +
        (t.key === state.tab ? ' aria-current="true"' : '') + ' id="nav-' + t.key + '">' +
        '<span class="Nav-name">' + esc(t.label) + '</span>' +
        '<span class="Nav-count">' + num(meta.counts[t.key] || 0) + '</span></button>';
    });
    h += '</nav>';

    h += '<div class="Colophon">' +
      '文字与图片版权归原作者所有，本站仅作个人阅读存档，不作商业用途。<br>' +
      '整理于 ' + esc(meta.fetchedAt || '') + '。' +
      '</div>';
    r.innerHTML = h;
    return r;
  }

  /* ---------------- 主区标题 ---------------- */
  function sectionHead(title, count, hint) {
    return el('div', 'SectionHead',
      '<h2>' + esc(title) + '</h2>' +
      '<span class="n">' + count + '</span>' +
      '<span class="sp"></span>' +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : ''));
  }

  /* ---------------- 条目 ---------------- */
  function foldable(html) {
    var long = html && html.length > 900;
    return '<div class="Copy' + (long ? ' Folded' : '') + '">' + html + '</div>' +
      (long ? '<button class="Unfold" type="button" data-unfold>展开全文 ' + I.fold + '</button>' : '');
  }
  function marks(o) {
    var h = '<div class="Entry-foot">';
    if (o.likes != null) h += '<span class="Mark"><i></i>' + num(o.likes) + '</span>';
    if (o.extra) h += '<span>' + o.extra + '</span>';
    h += '<span class="sp"></span>';
    if (o.src) h += '<a class="src" href="' + esc(o.src) + '"' + OUT + '>原文' + I.out + '</a>';
    h += '</div>';
    return h;
  }

  function itemAnswers(it, no) {
    var q = it.question || {};
    var n = el('article', 'Entry');
    n.innerHTML =
      '<div class="Entry-head"><span class="Entry-no">No.' + pad(no, 3) + '</span>' +
      '<span class="Entry-date">' + d(it.created) + '</span></div>' +
      (q.title ? '<h3 class="Entry-title">' +
        (q.id ? '<a href="https://www.zhihu.com/question/' + esc(q.id) + '"' + OUT + '>' + esc(q.title) + '</a>' : esc(q.title)) +
        '</h3>' : '') +
      foldable(it.content) +
      marks({ likes: it.voteupCount, src: it.url });
    return n;
  }
  function itemArticles(it, no) {
    var n = el('article', 'Entry');
    n.innerHTML =
      '<div class="Entry-head"><span class="Entry-no">No.' + pad(no, 3) + '</span>' +
      '<span class="Entry-date">' + d(it.created) + '</span></div>' +
      '<h3 class="Entry-title"><a href="' + esc(it.url) + '"' + OUT + '>' + esc(it.title) + '</a></h3>' +
      foldable(it.content) +
      marks({ likes: it.voteupCount, src: it.url });
    return n;
  }
  function itemPins(it, no) {
    var n = el('article', 'Entry');
    n.innerHTML =
      '<div class="Entry-head"><span class="Entry-no">No.' + pad(no, 3) + '</span>' +
      '<span class="Entry-date">' + d(it.created) + '</span></div>' +
      foldable(it.content) +
      marks({ likes: it.voteupCount, src: it.url });
    return n;
  }
  function itemQuestions(it, no) {
    var n = el('article', 'Entry');
    n.innerHTML =
      '<div class="Entry-head"><span class="Entry-no">No.' + pad(no, 3) + '</span>' +
      '<span class="Entry-date">' + d(it.created) + '</span></div>' +
      '<h3 class="Entry-title"><a href="' + esc(it.url) + '"' + OUT + '>' + esc(it.title) + '</a></h3>' +
      (it.detail ? '<div class="Copy">' + it.detail + '</div>' : '') +
      marks({ extra: '收到回答 ' + num(it.answerCount) + ' · 关注 ' + num(it.followerCount), src: it.url });
    return n;
  }
  function itemShelf(it) {
    var n = el('article', 'Shelf-item');
    n.innerHTML =
      '<h3 class="Shelf-name"><a href="#" data-shelf="' + esc(it.id) + '">' + esc(it.title) + '</a></h3>' +
      (it.description ? '<p class="Shelf-desc">' + esc(it.description) + '</p>' : '') +
      '<div class="Shelf-meta">' + num(it.itemCount) + ' 条 · 编于 ' + d(it.updated) + '</div>';
    return n;
  }
  function itemColumn(it) {
    var n = el('article', 'Shelf-item');
    n.innerHTML =
      '<h3 class="Shelf-name"><a href="' + esc(it.url) + '"' + OUT + '>' + esc(it.title) + '</a></h3>' +
      (it.intro ? '<p class="Shelf-desc">' + esc(it.intro) + '</p>' : '') +
      '<div class="Shelf-meta">' + (it.author ? esc(it.author) + ' · ' : '') + '更新于 ' + d(it.updated) + '</div>';
    return n;
  }
  function itemExcerpt(it, no) {
    var n = el('article', 'Excerpt');
    n.innerHTML =
      '<blockquote>' + esc(it.highlight) + '</blockquote>' +
      '<div class="Excerpt-from">出自 <a href="' + esc(it.url) + '"' + OUT + '>' + esc(it.question) + '</a></div>' +
      (it.stats ? '<div class="Excerpt-note">' + esc(it.stats) + '</div>' : '');
    return n;
  }

  /* ---------------- 状态块 ---------------- */
  function skeleton() {
    var f = document.createDocumentFragment();
    for (var i = 0; i < 2; i++) {
      f.appendChild(el('div', 'Skeleton',
        '<div class="Sk t"></div><div class="Sk"></div><div class="Sk"></div><div class="Sk"></div>'));
    }
    return f;
  }
  function quiet(kind, title, desc) {
    return el('div', 'Quiet',
      '<div class="mark">' + (kind === 'err' ? I.err : I.empty) + '</div>' +
      '<h3>' + esc(title) + '</h3>' + (desc ? '<p>' + desc + '</p>' : ''));
  }

  /* ---------------- 面板 ---------------- */
  function panel(tab) {
    var p = $('#panel-' + tab);
    if (!p) {
      p = el('div');
      p.id = 'panel-' + tab;
      $('#panels').appendChild(p);
      p.hidden = true;
    }
    return p;
  }
  function syncPanels() {
    var box = $('#panels');
    if (!box) return;
    Array.prototype.forEach.call(box.children, function (p) {
      p.hidden = p.id !== 'panel-' + state.tab;
    });
  }

  function render(tab, append) {
    var box = panel(tab);
    var meta = state.meta;
    if (!append) { box.innerHTML = ''; box.appendChild(skeleton()); }
    var ok = function () { box.classList.add('Fade'); };
    var bad = function (e) {
      box.innerHTML = '';
      box.appendChild(quiet('err', '内容未能载入', esc(e && e.message ? e.message : '请稍后重试')));
    };

    if (tab === 'questions') {
      return get(DATA + 'questions.json').then(function (list) {
        box.innerHTML = '';
        box.appendChild(sectionHead('提问', list.length + ' 条'));
        if (!list.length) return box.appendChild(quiet('', '暂无内容', ''));
        list.forEach(function (it, i) { box.appendChild(itemQuestions(it, i + 1)); });
        ok();
      }).catch(bad);
    }

    if (tab === 'favlists') {
      return get(DATA + 'favlists.json').then(function (list) {
        box.innerHTML = '';
        var total = list.reduce(function (s, x) { return s + (x.itemCount || 0); }, 0);
        box.appendChild(sectionHead('集萃', list.length + ' 个分类 · ' + num(total) + ' 条', '进入分类查看条目'));
        var g = el('div', 'Shelf');
        list.forEach(function (it) { g.appendChild(itemShelf(it)); });
        box.appendChild(g);
        ok();
      }).catch(bad);
    }

    if (tab === 'columns' || tab === 'following') {
      var file = tab === 'columns' ? 'columns.json' : 'following.json';
      var title = tab === 'columns' ? '文丛' : '订阅';
      return get(DATA + file).then(function (list) {
        box.innerHTML = '';
        box.appendChild(sectionHead(title, list.length + ' 个'));
        if (!list.length) return box.appendChild(quiet('', '暂无内容', ''));
        var g = el('div', 'Shelf');
        list.forEach(function (it) { g.appendChild(itemColumn(it)); });
        box.appendChild(g);
        ok();
      }).catch(bad);
    }

    if (tab === 'highlights') {
      return get(DATA + 'highlights.json').then(function (list) {
        box.innerHTML = '';
        box.appendChild(sectionHead('摘录', list.length + ' 条'));
        if (!list.length) return box.appendChild(quiet('', '暂无内容', ''));
        list.forEach(function (it, i) { box.appendChild(itemExcerpt(it, i + 1)); });
        ok();
      }).catch(bad);
    }

    /* 分页栏目 */
    var size = PAGE[tab] || 20;
    var pages = (meta.pageCounts || {})[tab] || 0;
    if (state.pages[tab] == null) state.pages[tab] = -1;
    var next = state.pages[tab] + 1;
    var label = { answers: '随想', articles: '长文', pins: '片段' }[tab];

    if (next >= pages) {
      if (!append) {
        box.innerHTML = '';
        box.appendChild(sectionHead(label, num(meta.counts[tab]) + ' 条'));
        box.appendChild(quiet('', '暂无内容', ''));
      }
      return Promise.resolve();
    }
    return get(DATA + tab + '/p' + next + '.json').then(function (data) {
      if (!append) {
        box.innerHTML = '';
        box.appendChild(sectionHead(label, num(meta.counts[tab]) + ' 条',
          next === 0 ? '按时间倒序' : null));
      } else {
        var sk = box.querySelector('.Skeleton');
        if (sk) sk.remove();
      }
      var make = tab === 'answers' ? itemAnswers : (tab === 'articles' ? itemArticles : itemPins);
      var frag = document.createDocumentFragment();
      (data.items || []).forEach(function (it, i) {
        frag.appendChild(make(it, next * size + i + 1));
      });
      box.appendChild(frag);
      state.pages[tab] = next;
      more(box, tab, state.pages[tab] + 1 >= pages);
      ok();
    }).catch(bad);
  }

  function more(box, tab, done) {
    var old = box.querySelector('.More');
    if (old) old.remove();
    if (done) return;
    var b = el('button', 'More', '继续往下读');
    b.type = 'button';
    b.onclick = function () {
      b.disabled = true;
      b.innerHTML = '<span class="Spin"></span>载入中';
      render(tab, true);
    };
    box.appendChild(b);
  }

  /* ---------------- 切换栏目 ---------------- */
  function go(tab) {
    var meta = state.meta;
    if (!meta.counts || !(tab in meta.counts)) tab = 'answers';
    state.scroll[state.tab] = window.scrollY;
    state.tab = tab;

    document.querySelectorAll('.Nav-item').forEach(function (b) {
      if (b.getAttribute('data-tab') === tab) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    history.replaceState(null, '', '#' + tab);

    panel(tab);
    syncPanels();
    if (!state.built[tab]) {
      state.built[tab] = true;
      render(tab, false).then(function () { restore(tab); });
    } else {
      restore(tab);
    }
  }
  function restore(tab) {
    var y = state.scroll[tab] || 0;
    requestAnimationFrame(function () { window.scrollTo(0, y); });
  }

  /* ---------------- 集萃详情 ---------------- */
  function openShelf(id, title) {
    var box = panel('favlists');
    box.innerHTML = '';
    var back = el('button', 'More is-back', '← 返回目录');
    back.type = 'button';
    back.onclick = function () { render('favlists', false); };
    box.appendChild(back);
    box.appendChild(skeleton());

    get(DATA + 'favlists/' + id + '.json').then(function (list) {
      box.innerHTML = '';
      box.appendChild(back);
      box.appendChild(sectionHead(title, list.length + ' 条'));
      if (!list.length) return box.appendChild(quiet('', '这个分类下暂无条目', ''));
      list.forEach(function (it) {
        var row = el('article', 'Pick');
        var bits = [];
        if (it.typeName) bits.push(it.typeName);
        if (it.author) bits.push(it.author);
        if (it.created) bits.push(d(it.created));
        if (it.voteup) bits.push(num(it.voteup) + ' 赞');
        row.innerHTML =
          '<h3 class="Pick-name">' +
          (it.url ? '<a href="' + esc(it.url) + '"' + OUT + '>' + esc(it.title) + '</a>' : esc(it.title)) +
          '</h3>' +
          '<div class="Pick-meta">' + bits.join(' · ') + '</div>' +
          (it.excerpt ? '<p class="Pick-text">' + esc(it.excerpt) + '</p>' : '');
        box.appendChild(row);
      });
      box.classList.add('Fade');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function () {
      box.innerHTML = '';
      box.appendChild(back);
      box.appendChild(quiet('err', '这个分类未能载入', ''));
    });
  }

  /* ---------------- 交互 ---------------- */
  function bind() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var nav = t.closest ? t.closest('.Nav-item') : null;
      if (nav) { go(nav.getAttribute('data-tab')); return; }

      var un = t.closest ? t.closest('[data-unfold]') : null;
      if (un) {
        var c = un.previousElementSibling;
        if (c) c.classList.remove('Folded');
        un.remove();
        return;
      }
      var sh = t.closest ? t.closest('[data-shelf]') : null;
      if (sh) {
        ev.preventDefault();
        openShelf(sh.getAttribute('data-shelf'), sh.textContent.trim());
        return;
      }
      if (t.closest && t.closest('.Brand')) {
        ev.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (t.closest && t.closest('#themeBtn')) {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'night' ? 'paper' : 'night');
        return;
      }
      if (t.closest && t.closest('#sizeBtn')) {
        var cur = document.documentElement.getAttribute('data-size') || 'm';
        applySize(SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length]);
        return;
      }
      if (t.closest && t.closest('#toTop')) window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        var tb = $('#topbar');
        if (tb) tb.classList.toggle('is-stuck', y > 2);
        var tt = $('#toTop');
        if (tt) tt.classList.toggle('is-on', y > 700);
        tick = false;
      });
    }, { passive: true });

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (h && state.meta && h in state.meta.counts && h !== state.tab) go(h);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var theme = read('wj-theme', '');
    if (theme !== 'paper' && theme !== 'night') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
    }
    applyTheme(theme);
    applySize(SIZES.indexOf(read('wj-size', 'm')) >= 0 ? read('wj-size', 'm') : 'm');

    get(DATA + 'profile.json').then(function (meta) {
      state.meta = meta;
      var p = meta.profile;
      if (meta.tabs && meta.tabs.length && !meta.counts[state.tab]) state.tab = meta.tabs[0].key;
      var h = (location.hash || '').replace('#', '');
      if (h && meta.counts[h] != null) state.tab = h;

      document.body.insertBefore(topbar(p), document.body.firstChild);

      var body = $('#body');
      body.innerHTML = '';
      body.appendChild(rail(p, meta));
      var main = el('main', 'Main');
      var panels = el('div');
      panels.id = 'panels';
      main.appendChild(panels);
      body.appendChild(main);

      document.title = p.name + ' · 文集';

      var a = meta.archived;
      var foot = el('footer', 'Foot');
      foot.innerHTML =
        '<p>本站收录「' + esc(p.name) + '」的公开文字：随想 ' + num(a.answers) + ' 条、长文 ' + num(a.articles) +
        ' 篇、片段 ' + num(a.pins) + ' 条、提问 ' + num(a.questions) + ' 条、集萃 ' + num(a.favlists) +
        ' 个分类（' + num(a.favItems) + ' 条）、文丛 ' + num(a.columns) + ' 个、订阅 ' + num(a.following) +
        ' 个、摘录 ' + num(a.highlights) + ' 条。</p>' +
        '<p>内容版权归原作者所有，仅作个人阅读存档，不作商业用途。整理于 ' + esc(meta.fetchedAt || '') + '。</p>';
      document.body.appendChild(foot);

      var up = el('button', 'ToTop', I.up);
      up.id = 'toTop';
      up.type = 'button';
      up.setAttribute('aria-label', '回到顶部');
      document.body.appendChild(up);

      bind();
      applyTheme(document.documentElement.getAttribute('data-theme'));
      applySize(document.documentElement.getAttribute('data-size') || 'm');

      state.built[state.tab] = true;
      render(state.tab, false);
      syncPanels();
      window.dispatchEvent(new Event('scroll'));
    }).catch(function (e) {
      document.body.innerHTML = '<div style="max-width:560px;margin:80px auto;padding:0 24px">' +
        '<div class="Quiet"><div class="mark">' + I.err + '</div>' +
        '<h3>内容未能载入</h3><p>' + esc(e.message) +
        '<br>请通过 HTTP 方式打开本页（直接双击 html 文件会因浏览器限制读不到数据）。</p></div></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
