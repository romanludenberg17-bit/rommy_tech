/* common.js — тема, вкладки, вход/регистрация, мелкие утилиты.
   Аккаунты живут в localStorage этого браузера: без бэкенда они не общие для посетителей. */
(function () {
  'use strict';
  var CFG = window.ROMMY_CONFIG || {};
  var K_USERS = 'rommy.users.v1';
  var K_SESS = 'rommy.session.v1';

  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fallbackHash(t) {
    var h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return 'f' + h.toString(16);
  }
  function hash(pass) {
    var text = 'rommytech::' + pass;
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        var a = new Uint8Array(buf), s = '';
        for (var i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, '0');
        return s;
      }).catch(function () { return fallbackHash(text); });
    }
    return Promise.resolve(fallbackHash(text));
  }

  function users() { return read(K_USERS, []); }
  function saveUsers(list) { write(K_USERS, list); }
  function user() { return read(K_SESS, null); }
  function byEmail(email) {
    var l = users();
    for (var i = 0; i < l.length; i++) if (l[i].email === email) return l[i];
    return null;
  }

  function emit() {
    try { document.dispatchEvent(new CustomEvent('rommy-auth', { detail: user() })); } catch (e) {}
    paintSlot();
  }

  function setSession(u, provider) {
    write(K_SESS, { email: u.email, name: u.name, provider: provider || 'email', at: Date.now() });
    emit();
  }

  function register(name, email, pass) {
    email = String(email || '').trim().toLowerCase();
    name = String(name || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Promise.reject('почта выглядит неправильно');
    if (name.length < 2) return Promise.reject('имя минимум 2 символа');
    if (String(pass || '').length < 6) return Promise.reject('пароль минимум 6 символов');
    if (byEmail(email)) return Promise.reject('такая почта уже зарегистрирована — войди');
    return hash(pass).then(function (h) {
      var l = users();
      l.push({ email: email, name: name, hash: h, at: Date.now(), provider: 'email' });
      saveUsers(l);
      setSession({ email: email, name: name }, 'email');
      return user();
    });
  }

  function login(email, pass) {
    email = String(email || '').trim().toLowerCase();
    var u = byEmail(email);
    if (!u) return Promise.reject('аккаунта с такой почтой нет');
    return hash(pass).then(function (h) {
      if (h !== u.hash) throw 'неверный пароль';
      setSession(u, u.provider || 'email');
      return user();
    });
  }

  function logout() {
    try { localStorage.removeItem(K_SESS); } catch (e) {}
    emit();
  }

  /* ---------- модальное окно входа ---------- */
  var modal = null;

  function buildModal() {
    var d = document.createElement('div');
    d.className = 'modal';
    d.id = 'authModal';
    d.innerHTML =
      '<div class="modalbox" role="dialog" aria-modal="true" aria-label="Вход в аккаунт">' +
        '<div class="modalhead"><b id="authTitle">вход</b><button type="button" id="authClose" aria-label="Закрыть">×</button></div>' +
        '<div class="modaltabs">' +
          '<button class="tab on" type="button" data-mode="login">вход</button>' +
          '<button class="tab" type="button" data-mode="reg">регистрация</button>' +
        '</div>' +
        '<div id="authMsg" class="msg" hidden></div>' +
        '<form id="fLogin" autocomplete="on">' +
          '<label class="fl" for="lEmail">почта</label>' +
          '<input type="email" id="lEmail" autocomplete="email" placeholder="you@mail.ru" required>' +
          '<label class="fl" for="lPass">пароль</label>' +
          '<input type="password" id="lPass" autocomplete="current-password" placeholder="••••••" required>' +
          '<button class="btn btn-main" type="submit" style="width:100%">войти</button>' +
        '</form>' +
        '<form id="fReg" autocomplete="on" hidden>' +
          '<label class="fl" for="rName">имя на форуме</label>' +
          '<input type="text" id="rName" autocomplete="nickname" placeholder="курбьер" required>' +
          '<label class="fl" for="rEmail">почта</label>' +
          '<input type="email" id="rEmail" autocomplete="email" placeholder="you@mail.ru" required>' +
          '<label class="fl" for="rPass">пароль</label>' +
          '<input type="password" id="rPass" autocomplete="new-password" placeholder="минимум 6 символов" required>' +
          '<label class="fl" for="rPass2">пароль ещё раз</label>' +
          '<input type="password" id="rPass2" autocomplete="new-password" placeholder="повтори пароль" required>' +
          '<button class="btn btn-main" type="submit" style="width:100%">создать аккаунт</button>' +
        '</form>' +
        '<div style="margin:10px 0 6px;border-top:1px dotted var(--line);padding-top:9px">' +
          '<div id="gsiBox"></div>' +
          '<button class="gbtn" type="button" id="gDemo">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#4285f4"/><text x="12" y="17" font-size="13" text-anchor="middle" fill="#fff" font-family="Arial">G</text></svg>' +
            'продолжить с Google' +
          '</button>' +
        '</div>' +
        '<p class="hint" id="authHint"></p>' +
      '</div>';
    document.body.appendChild(d);
    modal = d;

    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    d.querySelector('#authClose').addEventListener('click', close);
    d.querySelectorAll('.modaltabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { switchMode(b.dataset.mode); });
    });

    d.querySelector('#fLogin').addEventListener('submit', function (e) {
      e.preventDefault();
      login(d.querySelector('#lEmail').value, d.querySelector('#lPass').value)
        .then(function (u) { close(); flash('вы вошли как ' + u.name); })
        .catch(function (err) { say(String(err), true); });
    });
    d.querySelector('#fReg').addEventListener('submit', function (e) {
      e.preventDefault();
      var p1 = d.querySelector('#rPass').value, p2 = d.querySelector('#rPass2').value;
      if (p1 !== p2) { say('пароли не совпадают', true); return; }
      register(d.querySelector('#rName').value, d.querySelector('#rEmail').value, p1)
        .then(function (u) { close(); flash('аккаунт создан, привет, ' + u.name); })
        .catch(function (err) { say(String(err), true); });
    });
    d.querySelector('#gDemo').addEventListener('click', function () { googleNotice(); });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
    return d;
  }

  function say(text, isErr) {
    var m = modal.querySelector('#authMsg');
    m.hidden = !text;
    m.textContent = text || '';
    m.className = 'msg' + (isErr ? ' err' : ' ok');
  }

  function googleNotice() {
    var cfg = window.ROMMY_CONFIG || {};
    if (!cfg.googleClientId) {
      say('Вход через Google выключен: нужен OAuth Client ID. Создай его в Google Cloud Console (тип «Web application», адрес сайта в разрешённых источниках) и впиши в config.js — кнопка сразу заработает. Локальные аккаунты при этом уже работают.', true);
    } else {
      say('Google загружается, подожди пару секунд…', false);
    }
  }

  function switchMode(mode) {
    modal.querySelectorAll('.modaltabs .tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === mode);
    });
    modal.querySelector('#authTitle').textContent = mode === 'reg' ? 'регистрация' : 'вход';
    modal.querySelector('#fLogin').hidden = mode !== 'login';
    modal.querySelector('#fReg').hidden = mode !== 'reg';
    say('', false);
    initGoogle();
  }

  function open(mode) {
    if (!modal) buildModal();
    modal.classList.add('open');
    switchMode(mode === 'reg' ? 'reg' : 'login');
    var f = modal.querySelector(mode === 'reg' ? '#rName' : '#lEmail');
    setTimeout(function () { try { f.focus(); } catch (e) {} }, 60);
  }
  function close() { if (modal) modal.classList.remove('open'); }

  /* ---------- Google Identity Services (нужен clientId) ---------- */
  var gsiLoaded = false;
  function decodeJwt(t) {
    var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var s = atob(p), bin = [];
    for (var i = 0; i < s.length; i++) bin.push('%' + ('00' + s.charCodeAt(i).toString(16)).slice(-2));
    return JSON.parse(decodeURIComponent(bin.join('')));
  }
  function initGoogle() {
    var cfg = window.ROMMY_CONFIG || {};
    if (!cfg.googleClientId || !modal) return;
    var box = modal.querySelector('#gsiBox');
    if (!box || box.dataset.done) return;
    function start() {
      try {
        google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: function (resp) {
            try {
              var p = decodeJwt(resp.credential);
              var l = users(), found = null;
              for (var i = 0; i < l.length; i++) if (l[i].email === String(p.email).toLowerCase()) found = l[i];
              if (!found) {
                l.push({ email: String(p.email).toLowerCase(), name: p.name || p.email, hash: '', at: Date.now(), provider: 'google' });
                saveUsers(l);
              }
              setSession({ email: String(p.email).toLowerCase(), name: p.name || p.email }, 'google');
              close();
              flash('вошли через Google: ' + (p.name || p.email));
            } catch (e) { say('не получилось прочитать ответ Google', true); }
          }
        });
        google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'continue_with', locale: 'ru', width: 300 });
        var demo = modal.querySelector('#gDemo');
        if (demo) demo.hidden = true;
        box.dataset.done = '1';
      } catch (e) { googleNotice(); }
    }
    if (window.google && google.accounts && google.accounts.id) { start(); return; }
    if (gsiLoaded) return;
    gsiLoaded = true;
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = start;
    s.onerror = function () {
      gsiLoaded = false;
      say('не удалось загрузить Google — проверь интернет или блокировщик', true);
    };
    document.head.appendChild(s);
  }

  /* ---------- шапка: кнопка входа / имя ---------- */
  function paintSlot() {
    var slot = document.getElementById('authslot');
    if (!slot) return;
    var u = user();
    slot.innerHTML = u
      ? '<span class="who">привет, <b>' + esc(u.name) + '</b>' + (u.provider === 'google' ? ' (google)' : '') + '</span>' +
        '<button class="tab" type="button" data-auth="logout">выйти</button>'
      : '<button class="tab" type="button" data-auth="login">вход / регистрация</button>';
    slot.querySelectorAll('[data-auth]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.auth === 'logout') { logout(); flash('вы вышли'); }
        else open('login');
      });
    });
  }

  function flash(text) {
    var f = document.getElementById('rommyFlash');
    if (!f) {
      f = document.createElement('div');
      f.id = 'rommyFlash';
      f.className = 'msg ok';
      f.style.cssText = 'position:fixed;left:8px;right:8px;bottom:10px;z-index:70;max-width:360px;margin:0 auto;box-shadow:3px 3px 0 rgba(0,0,0,.25)';
      document.body.appendChild(f);
    }
    f.textContent = text;
    f.hidden = false;
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { f.hidden = true; }, 4200);
  }

  /* ---------- тема и вкладки ---------- */
  function paintTheme() {
    var root = document.documentElement, btn = document.getElementById('themebtn');
    if (btn) btn.textContent = 'тема: ' + (root.dataset.theme === 'dark' ? 'ночная' : 'дневная');
  }
  function initTheme() {
    paintTheme();
    var btn = document.getElementById('themebtn');
    if (btn) btn.addEventListener('click', function () {
      var root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('rommy.theme', root.dataset.theme); } catch (e) {}
      paintTheme();
    });
  }

  /* ---------- Общий счётчик посетителей за всё время ----------
     Сайт статический, поэтому числа хранит бесплатный сервис Abacus (abacus.jasoncameron.dev).
     visitors — уникальные посетители: каждый браузер засчитывается один раз за всё время;
     views    — все открытия страниц сайта (любой вкладки).
     Пространство имён можно сменить в config.js: counterNamespace. */
  var COUNTER_API = 'https://abacus.jasoncameron.dev';
  var COUNTER_NS = CFG.counterNamespace || 'rommy-tech-site';
  var K_COUNTED = 'rommy.counted.v1';

  function counterCall(action, key) {
    var url = COUNTER_API + '/' + action + '/' + encodeURIComponent(COUNTER_NS) + '/' + key;
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404 && action === 'get') return { value: 0 };
      if (!r.ok) throw new Error('counter ' + r.status);
      return r.json();
    }).then(function (j) {
      var v = parseInt(j && j.value, 10);
      if (isNaN(v)) throw new Error('counter: bad answer');
      return v;
    });
  }

  function paintCount(kind, value) {
    document.querySelectorAll('[data-gcount="' + kind + '"]').forEach(function (el) {
      if (value == null) { el.textContent = '—'; el.title = 'счётчик сейчас недоступен'; return; }
      if (el.classList.contains('counter')) {
        var s = String(value).padStart(6, '0');
        el.innerHTML = '';
        for (var i = 0; i < s.length; i++) { var sp = document.createElement('span'); sp.textContent = s[i]; el.appendChild(sp); }
      } else {
        el.textContent = value.toLocaleString('ru-RU');
      }
    });
  }

  function globalCounter() {
    if (!window.fetch) { paintCount('visitors', null); paintCount('views', null); return; }
    var counted = false;
    try { counted = localStorage.getItem(K_COUNTED) === '1'; } catch (e) {}
    counterCall(counted ? 'get' : 'hit', 'visitors').then(function (v) {
      if (!counted) { try { localStorage.setItem(K_COUNTED, '1'); } catch (e) {} }
      paintCount('visitors', v);
    }).catch(function () { paintCount('visitors', null); });
    counterCall('hit', 'views').then(function (v) { paintCount('views', v); })
      .catch(function () { paintCount('views', null); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    paintSlot();
    globalCounter();
    // подсветка активной вкладки по имени файла
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.tabs a.tab').forEach(function (a) {
      var href = (a.getAttribute('href') || '').toLowerCase();
      if (href === here) a.classList.add('on');
    });
  });

  window.RommyAuth = {
    user: user,
    open: open,
    close: close,
    logout: logout,
    login: login,
    register: register,
    require: function (mode) {
      if (user()) return true;
      open(mode || 'login');
      flash('сначала войди или зарегистрируйся');
      return false;
    }
  };
  window.Rommy = { esc: esc, flash: flash };
})();
