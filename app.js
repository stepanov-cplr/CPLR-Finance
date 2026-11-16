/* Фінсистема ЦППР — сторінка. Даних і адрес команди тут немає: усе приходить із сервера після входу.
   Версія 1.5.1 — 17.11.2026: залучення — від реальної норми годин місяця.
   Версія 1.5.0 — 16.11.2026: сортування таблиць і списків, % залучення, примітка про зарплату.
   Версія 1.4.0 — 16.11.2026: мін/макс гонорару і ставка за проєктами.
   Версія 1.3.0 — 16.11.2026: ролі «член правління» і «керівник проєкту».
   Версія 1.2.0 — 16.11.2026: бюджетні статті й перевищення.
   Версія 1.1.0 — 16.11.2026: фільтри (керівник, проєкт, людина), введення грошима, заробіток на стороні.
   Версія 1.0.0 — 15.11.2026 */
(function () {
  "use strict";

  var API_URL = "https://script.google.com/macros/s/AKfycbxLwHagGGbJyr_Lvd7cvozGJjrjNugkVUT-s6u-Poo6565pp9ywYxMU3r_VMiTMcY3Afw/exec";
  var CLIENT_ID = "480913215993-h8o3gcsismg88cjg7h7e48h9o8gpj45r.apps.googleusercontent.com";
  var TOKEN_KEY = "cplrf_token";
  var MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
  var MSHORT = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
  var ST = { plan: "План", ok: "Підтверджено", paid: "Оплачено" };
  var ST_CLASS = { "План": "plan", "Підтверджено": "ok", "Оплачено": "paid" };
  // Рядок реєстру: [id, рік, місяць, людина, проєкт, ставка, години, сума, статус, дата оплати, оформлення, коментар]
  var NET_NOTE = "Зарплата — це чисті виплати, вже за вирахуванням податків; години для неї — з ЗП-розпису.";
  var R = { id: 0, year: 1, month: 2, person: 3, project: 4, rate: 5, hours: 6, sum: 7, status: 8, paid: 9, kind: 10, note: 11, line: 12 };

  var D = null;            // дані з сервера — лише в пам'яті сторінки
  var S = { sort: {}, listSort: { people: "name", projects: "sum" }, tab: "month", year: 0, month: 0, fLead: "", fProject: "", fPerson: "", person: "", project: "", q: "", open: {} };
  var dirty = {};          // id рядка → {mode: "hours"|"sum", hours, sum, rate}
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    n = Math.round(n || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  function hrs(n) { return n === null || n === undefined || n === "" ? "" : String(Math.round(n * 100) / 100).replace(".", ","); }
  function sumStr(n) { return n ? String(Math.round(n * 100) / 100).replace(".", ",") : ""; }
  function parseNum(s) { var n = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function uk(a, b) { return a.localeCompare(b, "uk"); }

  // ── Вхід ──────────────────────────────────────────────
  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function showGate(msg, isErr) {
    D = null; dirty = {};
    $("view").innerHTML = "";
    $("app").hidden = true; $("me").hidden = true; $("gate").hidden = false; $("savebar").hidden = true;
    var m = $("gateMsg");
    m.hidden = !msg; m.textContent = msg || ""; m.className = "msg" + (isErr ? " err" : "");
  }
  function signOut(msg, isErr) {
    setToken("");
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) {}
    showGate(msg, isErr);
  }
  function initGsi() {
    if (!(window.google && google.accounts && google.accounts.id)) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID, auto_select: true,
      callback: function (resp) { if (resp && resp.credential) { setToken(resp.credential); load(); } }
    });
    google.accounts.id.renderButton($("gbtn"), { theme: "outline", size: "large", text: "signin_with", locale: "uk" });
  }
  window.onGoogleLibraryLoad = initGsi;

  // ── Сервер ────────────────────────────────────────────
  function api(action, payload) {
    var body = { token: token(), action: action };
    Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
    return fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.error === "AUTH_REQUIRED") {
          signOut(res.denied ? "Цієї адреси немає в списку доступу. Напишіть Миколі Степанову або Інесі Ковальовій." : "Сесія завершилась — увійдіть ще раз.", !!res.denied);
          throw new Error("AUTH");
        }
        return res;
      });
  }
  function errText(res) {
    if (!res) return "Немає зв'язку із сервером";
    if (res.message) return res.message;
    if (res.error === "FORBIDDEN") return "У вас немає права на цю дію";
    return "Не вдалося зберегти. Спробуйте ще раз";
  }

  function load() {
    if (!token()) { showGate(); return; }
    $("gate").hidden = true; $("app").hidden = false; $("loading").hidden = false; $("view").hidden = true; $("error").hidden = true;
    api("getData").then(function (res) {
      if (!res || !res.ok) throw new Error("DATA");
      D = res;
      var t = String(res.today || "").split("-");
      if (!S.year) { S.year = +t[0] || new Date().getFullYear(); S.month = +t[1] || 1; }
      if (!S.filterSet) { S.fLead = res.me.role === "board" && res.me.lead ? res.me.lead : ""; S.filterSet = true; }
      $("meName").textContent = res.me.name + " · " + roleName(res.me.role);
      $("me").hidden = false; $("loading").hidden = true; $("view").hidden = false;
      render();
    }).catch(function (e) {
      if (e && e.message === "AUTH") return;
      $("loading").hidden = true;
      var b = $("error"); b.hidden = false; b.textContent = "Не вдалося завантажити дані. Натисніть «Оновити».";
    });
  }
  function roleName(r) { return { admin: "адмін", finance: "фінанси", board: "член правління", pm: "керівник проєкту", viewer: "перегляд" }[r] || r; }

  // ── Права ─────────────────────────────────────────────
  function canAll() { return D.me.role === "admin" || D.me.role === "finance"; }
  function mine() { return (D.me.projects || []); }
  function isMine(code) { return mine().indexOf(code) >= 0; }
  function project(code) { return D.projects.filter(function (p) { return p.code === code; })[0] || { code: code, leads: [], active: false, side: false }; }
  function isSide(code) { return !!project(code).side; }
  function isLead() { return D.me.role === "board" || D.me.role === "pm"; }
  function canEditProject(code) { return canAll() || (D.me.role === "board" && (isMine(code) || isSide(code))) || (D.me.role === "pm" && isMine(code)); }
  function canEditRow(r) { return canAll() || (canEditProject(r[R.project]) && r[R.status] !== ST.paid); }

  // ── Допоміжне для даних ───────────────────────────────
  function rowsOf(f) { return D.rows.filter(f); }
  function sum(rows) { return rows.reduce(function (a, r) { return a + (r[R.sum] || 0); }, 0); }
  // Виплати ЦППР за статусами; заробіток на стороні — окремо
  function byStatus(rows) {
    var o = { plan: 0, ok: 0, paid: 0, side: 0 };
    rows.forEach(function (r) { o[isSide(r[R.project]) ? "side" : (ST_CLASS[r[R.status]] || "plan")] += r[R.sum] || 0; });
    return o;
  }
  function years() {
    var ys = {}; D.rows.forEach(function (r) { ys[r[R.year]] = 1; }); ys[S.year] = 1;
    return Object.keys(ys).map(Number).sort();
  }
  function mergeRows(rows) {
    (rows || []).forEach(function (n) {
      var i = -1;
      D.rows.forEach(function (r, k) { if (r[R.id] === n[R.id]) i = k; });
      if (i >= 0) D.rows[i] = n; else D.rows.push(n);
    });
  }
  function isCur(y, m) { var t = String(D.today || "").split("-"); return +t[0] === y && +t[1] === m; }
  function rowById(id) { return D.rows.filter(function (r) { return r[R.id] === id; })[0]; }

  // ── Бюджетні статті ───────────────────────────────────
  var useCache = {};
  function linesOf(code) { return (D.lines || []).filter(function (l) { return l.project === code; }); }
  // Скільки вже оплачено й заплановано за кожною статтею проєкту (за всі роки) проти бюджету
  function lineUse(code) {
    if (useCache[code]) return useCache[code];
    var m = {}, none = 0, order = [];
    linesOf(code).forEach(function (l) { m[l.code] = { l: l, paid: 0, open: 0, hours: 0, people: {} }; order.push(l.code); });
    D.rows.forEach(function (r) {
      if (r[R.project] !== code) return;
      var s = m[r[R.line]];
      if (!s) { none += r[R.sum] || 0; return; }
      if (r[R.status] === ST.paid) s.paid += r[R.sum] || 0; else s.open += r[R.sum] || 0;
      s.hours += r[R.hours] || 0; s.people[r[R.person]] = 1;
    });
    var list = order.map(function (k) {
      var s = m[k];
      s.budget = s.l.budget * (s.l.rate || 1);
      s.used = s.paid + s.open + (s.l.prior || 0);
      s.left = s.budget - s.used;
      s.over = s.used > s.budget + 1;
      return s;
    });
    var by = {}; list.forEach(function (s) { by[s.l.code] = s; });
    return (useCache[code] = { list: list, by: by, none: none, over: list.filter(function (s) { return s.over; }) });
  }
  function signed(n) { return (n < 0 ? "−" : "") + money(Math.abs(n)); }
  function linesTable(code) {
    var u = lineUse(code);
    if (!u.list.length) return "";
    var cur = u.list[0].l.currency, fx = cur && cur !== "UAH";
    var h = '<div class="block"><h2>Бюджетні статті <small>за весь проєкт, грн' + (fx ? " · бюджет у " + esc(cur) + " перераховано за курсом " + String(u.list[0].l.rate).replace(".", ",") : "") + '</small></h2>' +
      '<div class="tw"><table class="t"><thead><tr><th>Стаття</th><th>Бюджет</th><th>Оплачено</th><th>Підтв. і план</th><th>Залишок</th><th>Години</th></tr></thead><tbody>';
    u.list.forEach(function (s) {
      if (!s.budget && !s.used) return;
      var done = s.paid + (s.l.prior || 0);
      h += '<tr' + (s.over ? ' class="overrow"' : "") + '><td title="' + esc(s.l.name) + '"><b>' + esc(s.l.code) + '</b> ' + esc(s.l.name) + '</td><td>' + money(s.budget) + '</td><td>' + money(done) +
        '</td><td>' + money(s.open) + '</td><td class="' + (s.over ? "over" : "") + '">' + signed(s.left) + '</td><td class="' + (s.l.hours && s.hours > s.l.hours + 0.5 ? "over" : "") + '">' +
        (s.l.hours ? hrs(Math.round(s.hours)) + " / " + hrs(Math.round(s.l.hours)) : "–") + '</td></tr>';
    });
    if (u.none) h += '<tr><td>Без статті</td><td>–</td><td colspan="2">' + money(u.none) + '</td><td>–</td><td>–</td></tr>';
    return h + '</tbody></table></div>' + (fx ? '<p class="legend" style="padding:8px 12px 0">Бюджет у валюті, виплати в гривнях: порівняння приблизне, залежить від курсу в аркуші «Статті».</p>' : "") + '</div>';
  }
  // Перевищення за статтями для набору проєктів
  function overBlock(codes) {
    var items = [];
    codes.forEach(function (c) { lineUse(c).over.forEach(function (s) { items.push({ c: c, s: s }); }); });
    if (!items.length) return "";
    items.sort(function (a, b) { return a.s.left - b.s.left; });
    return '<div class="block overblock"><h2>Перевищення бюджету <small>статей: ' + items.length + '</small></h2><div class="tw"><table class="t"><thead><tr><th>Проєкт і стаття</th><th>Бюджет</th><th>Оплачено й заплановано</th><th>Перевищення</th><th>Хто</th></tr></thead><tbody>' +
      items.map(function (x) {
        return '<tr><td><button class="plink" type="button" data-act="project" data-v="' + esc(x.c) + '">' + esc(x.c) + '</button> ' + esc(x.s.l.code) + " " + esc(x.s.l.name) + '</td><td>' + money(x.s.budget) +
          '</td><td>' + money(x.s.used) + '</td><td class="over">' + money(-x.s.left) + '</td><td>' + esc(Object.keys(x.s.people).sort(uk).join(", ")) + '</td></tr>';
      }).join("") + '</tbody></table></div></div>';
  }

  // ── Фільтри: керівник, проєкт, людина ─────────────────
  function passProject(code) {
    if (S.fProject && code !== S.fProject) return false;
    // заробіток на стороні не має керівника, тому фільтр за керівником його не ховає
    if (S.fLead && !isSide(code) && project(code).leads.indexOf(S.fLead) < 0) return false;
    return true;
  }
  function pass(r) { return passProject(r[R.project]) && (!S.fPerson || r[R.person] === S.fPerson); }
  function filtersOn() { return !!(S.fLead || S.fProject || S.fPerson); }
  function filterBar(rows) {
    var leads = {}, codes = {}, names = {};
    D.projects.forEach(function (p) { p.leads.forEach(function (l) { leads[l] = 1; }); if (p.active) codes[p.code] = 1; });
    rows.forEach(function (r) { codes[r[R.project]] = 1; names[r[R.person]] = 1; });
    if (S.fProject) codes[S.fProject] = 1;
    if (S.fPerson) names[S.fPerson] = 1;
    function sel(id, label, cur, list, allText) {
      return '<select class="pick" id="' + id + '" aria-label="' + label + '"><option value="">' + allText + '</option>' +
        list.map(function (v) { return '<option' + (v === cur ? " selected" : "") + '>' + esc(v) + '</option>'; }).join("") + '</select>';
    }
    var mineLead = D.me.role === "pm" ? "" : (D.me.lead || "");
    return '<div class="filters">' +
      (D.me.role === "pm" ? "" : sel("fLead", "Керівник", S.fLead, Object.keys(leads).sort(uk), "Усі керівники")) +
      sel("fProject", "Проєкт", S.fProject, Object.keys(codes).sort(uk), "Усі проєкти") +
      sel("fPerson", "Людина", S.fPerson, Object.keys(names).sort(uk), "Усі люди") +
      (mineLead && S.fLead !== mineLead ? '<button class="linkbtn" type="button" data-act="mineonly">лише мої</button>' : "") +
      (filtersOn() ? '<button class="linkbtn" type="button" data-act="nofilter">скинути</button>' : "") + '</div>';
  }

  // ── Спільні шматки розмітки ───────────────────────────
  // withSide: у «Разом» входить і заробіток на стороні (картка людини)
  function tiles(st, withSide) {
    var cplr = st.plan + st.ok + st.paid;
    return '<div class="tiles">' +
      '<div class="tile plan"><small>План</small><b>' + money(st.plan) + '</b></div>' +
      '<div class="tile ok"><small>Підтверджено керівником</small><b>' + money(st.ok) + '</b></div>' +
      '<div class="tile paid"><small>Оплачено</small><b>' + money(st.paid) + '</b></div>' +
      (st.side ? '<div class="tile side"><small>Зароблено на стороні</small><b>' + money(st.side) + '</b></div>' : "") +
      '<div class="tile total"><small>' + (withSide && st.side ? "Разом зі стороннім, грн" : "Разом через ЦППР, грн") + '</small><b>' + money(cplr + (withSide ? st.side : 0)) + '</b></div></div>';
  }
  function yearSeg() {
    return '<div class="seg">' + years().map(function (y) {
      return '<button type="button" data-act="year" data-y="' + y + '" aria-pressed="' + (y === S.year) + '">' + y + '</button>';
    }).join("") + '</div>';
  }
  function cell(v, y, m) {
    var c = (v ? "" : "z") + (isCur(y, m) ? " cur" : "");
    return '<td class="' + c.trim() + '">' + (v ? money(v) : "–") + '</td>';
  }
  function sideTag(code) { return isSide(code) ? ' <span class="sidetag">на стороні</span>' : ""; }
  // Таблиця «рядки × 12 місяців»
  // opt.rate(назва) — ставка, грн/год, окремою колонкою; opt.mark(місяць, сума) — клас для клітинки підсумку
  function matrix(names, pick, firstHead, linkAct, tag, opt) {
    opt = opt || {};
    var head = '<tr><th>' + esc(firstHead) + '</th>' + (opt.rate ? '<th>Ставка</th>' : "") + MSHORT.map(function (m) { return '<th>' + m + '</th>'; }).join("") + '<th>Разом</th></tr>';
    var tot = new Array(12).fill(0), body = "";
    names.forEach(function (n) {
      var rs = pick(n), per = new Array(12).fill(0);
      rs.forEach(function (r) { per[r[R.month] - 1] += r[R.sum] || 0; });
      if (!per.some(Boolean)) return;
      per.forEach(function (v, i) { tot[i] += v; });
      var rt = opt.rate ? opt.rate(n) : null;
      body += '<tr><td>' + (linkAct ? '<button class="plink" type="button" data-act="' + linkAct + '" data-v="' + esc(n) + '">' + esc(n) + '</button>' : esc(n)) + (tag ? tag(n) : "") + '</td>' +
        (opt.rate ? '<td class="rate">' + (rt ? money(rt) : "–") + '</td>' : "") +
        per.map(function (v, i) { return cell(v, S.year, i + 1); }).join("") + '<td><b>' + money(per.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>';
    });
    if (!body) return '<div class="empty">За ' + S.year + ' рік записів немає.</div>';
    body += '<tr class="total"><td>Разом</td>' + (opt.rate ? '<td></td>' : "") + tot.map(function (v, i) {
      var c = opt.mark ? opt.mark(i + 1, v) : "";
      return '<td' + (c ? ' class="' + c + '"' : "") + '>' + (v ? money(v) : "–") + '</td>';
    }).join("") +
      '<td>' + money(tot.reduce(function (a, b) { return a + b; }, 0)) + '</td></tr>';
    if (opt.after) body += opt.after;
    return '<div class="tw"><table class="t"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  // ── Вкладка «Місяць» ──────────────────────────────────
  function viewMonth() {
    var y = S.year, m = S.month;
    var all = rowsOf(function (r) { return r[R.year] === y && r[R.month] === m; });
    var shown = all.filter(pass);
    var codes = {};
    shown.forEach(function (r) { codes[r[R.project]] = 1; });
    // порожні блоки — лише там, де людина може щось внести, і якщо не шукають конкретну людину
    if (!S.fPerson) D.projects.forEach(function (p) { if (p.active && canEditProject(p.code) && passProject(p.code)) codes[p.code] = 1; });
    var list = Object.keys(codes).sort(function (a, b) {
      return (isSide(a) - isSide(b)) || (isMine(b) - isMine(a)) || (project(b).active - project(a).active) || uk(a, b);
    });

    var h = '<div class="bar"><div class="stepper"><button type="button" data-act="prev" aria-label="Попередній місяць">‹</button><b>' +
      MONTHS[m - 1] + " " + y + '</b><button type="button" data-act="next" aria-label="Наступний місяць">›</button></div></div>' +
      filterBar(all) + tiles(byStatus(shown));
    if (isLead() && mine().length) {
      h += '<div class="hint">Впишіть години або гроші — друге порахується само за ставкою. Потім натисніть «Підтвердити години».</div>';
    }
    if (!list.length) return h + '<div class="empty">За цей місяць записів немає.</div>';
    var hasNet = shown.some(function (r) { return r[R.kind] === "ЗП"; });

    list.forEach(function (code) {
      var p = project(code), rows = shown.filter(function (r) { return r[R.project] === code; })
        .sort(function (a, b) { return uk(a[R.person], b[R.person]); });
      var edit = canEditProject(code);
      h += '<div class="block" data-project="' + esc(code) + '"><h2>' + esc(code) +
        (isMine(code) ? ' <span class="mine">мій</span>' : "") + sideTag(code) +
        (lineUse(code).over.length ? ' <button class="overtag" type="button" data-act="project" data-v="' + esc(code) + '">перевищення бюджету: ' + lineUse(code).over.length + '</button>' : "") +
        (p.leads.length ? ' <small>керівник: ' + esc(p.leads.join(", ")) + '</small>' : "") +
        '<span class="sum">' + money(sum(rows)) + '</span></h2>';
      if (p.side) h += '<div class="sidenote">Зароблене не через ЦППР. Зараховується до загальної виплати людини.</div>';
      if (!rows.length) h += '<div class="empty small">Ще нікого не внесено.</div>';
      else h += '<div class="rowhead"><span></span><span>години</span><span>гривні</span></div>';
      rows.forEach(function (r) { h += rowHtml(r); });
      if (edit && !S.fPerson) h += addRowHtml(code, all.filter(function (r) { return r[R.project] === code; }));
      var nPlan = p.side ? 0 : rows.filter(function (r) { return r[R.status] === ST.plan && canEditRow(r); }).length;
      var nOk = p.side ? 0 : rows.filter(function (r) { return r[R.status] === ST.ok; }).length;
      if ((edit && nPlan) || (canAll() && nOk)) {
        h += '<div class="foot">';
        if (edit && nPlan) h += '<button class="btn primary" type="button" data-act="confirm" data-v="' + esc(code) + '">Підтвердити години (' + nPlan + ')</button>';
        if (canAll() && nOk) h += '<button class="btn good" type="button" data-act="pay" data-v="' + esc(code) + '">Позначити оплаченим (' + nOk + ')</button>';
        h += '</div>';
      }
      h += '</div>';
    });
    if (hasNet) h += '<p class="legend">' + NET_NOTE + '</p>';
    return h;
  }

  // Що показати в полях рядка з урахуванням незбережених змін
  function live(r, d) {
    var rate = d && d.rate !== undefined && d.rate !== "" ? parseNum(d.rate) : r[R.rate];
    var o = { hours: hrs(r[R.hours]), sum: sumStr(r[R.sum]), rate: rate };
    if (!d) return o;
    if (d.mode === "sum") {
      o.sum = d.sum;
      var s = parseNum(d.sum);
      o.hours = d.sum === "" ? "" : (isFinite(s) && rate > 0 ? hrs(round2(s / rate)) : o.hours);
    } else {
      var hv = d.hours !== undefined ? d.hours : o.hours;
      o.hours = hv;
      var n = parseNum(hv);
      if (d.hours !== undefined || d.rate !== undefined) o.sum = hv === "" ? o.sum : (isFinite(n) && rate > 0 ? sumStr(round2(n * rate)) : o.sum);
    }
    return o;
  }

  function rowHtml(r) {
    var id = r[R.id], d = dirty[id], edit = canEditRow(r), side = isSide(r[R.project]), v = live(r, d);
    var h = '<div class="row" data-id="' + id + '"><div class="who"><b>' + esc(r[R.person]) + '</b><small>' +
      (r[R.rate] ? money(r[R.rate]) + " грн/год" : "без ставки") + (r[R.kind] === "ЗП" ? ' · <span title="' + esc(NET_NOTE) + '">зарплата, чиста</span>' : "") +
      (side ? "" : ' <span class="st ' + (ST_CLASS[r[R.status]] || "plan") + '">' + esc(r[R.status]) +
        (r[R.paid] ? " " + esc(r[R.paid].slice(8, 10) + "." + r[R.paid].slice(5, 7)) : "") + '</span>') +
      (r[R.note] ? " · " + esc(r[R.note]) : "") + lineNote(r) + '</small></div>';
    if (edit) {
      h += '<input class="h' + (d ? " dirty" : "") + '" type="text" inputmode="decimal" autocomplete="off" aria-label="Години: ' + esc(r[R.person]) + '" data-f="hours" value="' + esc(v.hours) + '" placeholder="год">' +
        '<input class="s' + (d ? " dirty" : "") + '" type="text" inputmode="decimal" autocomplete="off" aria-label="Гривні: ' + esc(r[R.person]) + '" data-f="sum" value="' + esc(v.sum) + '" placeholder="грн">';
    } else {
      h += '<div class="hh">' + (hrs(r[R.hours]) || "–") + '</div><div class="amt">' + money(r[R.sum]) + '</div>';
    }
    if (canAll()) {
      h += '<div class="rowtools">';
      if (S.open[id]) {
        h += '<label>ставка <input type="text" inputmode="decimal" data-f="rate" value="' + esc(d && d.rate !== undefined ? d.rate : (r[R.rate] || "")) + '"></label>' +
          (linesOf(r[R.project]).length ? '<select data-f="line" aria-label="Стаття бюджету">' + lineOptions(r[R.project], r[R.line], "без статті") + '</select>' : "") +
          (side ? "" : '<select data-f="status" aria-label="Статус">' + [ST.plan, ST.ok, ST.paid].map(function (s) {
            return '<option' + (s === r[R.status] ? " selected" : "") + '>' + s + '</option>';
          }).join("") + '</select>') +
          (r[R.status] !== ST.paid || side ? '<button class="linkbtn danger" type="button" data-act="remove">вилучити</button>' : "") +
          '<button class="linkbtn" type="button" data-act="more">згорнути</button>';
      } else {
        h += '<button class="linkbtn" type="button" data-act="more">' + (side ? "змінити ставку" : "змінити ставку, статтю, статус") + '</button>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  // Підпис статті в рядку; якщо за статтею перевищення — червоним, на скільки
  function lineNote(r) {
    if (isSide(r[R.project]) || !linesOf(r[R.project]).length) return "";
    if (!r[R.line]) return ' <span class="linecode none">без статті</span>';
    var s = lineUse(r[R.project]).by[r[R.line]];
    return ' <span class="linecode' + (s && s.over ? " over" : "") + '">ст. ' + esc(r[R.line]) + (s && s.over ? ": перевищення " + money(-s.left) : "") + '</span>';
  }
  function lineOptions(code, cur, first) {
    return '<option value="">' + first + '</option>' + linesOf(code).map(function (l) {
      return '<option value="' + esc(l.code) + '"' + (l.code === cur ? " selected" : "") + '>' + esc(l.code + " " + l.name) + '</option>';
    }).join("");
  }

  function addRowHtml(code, rows) {
    var have = {};
    rows.forEach(function (r) { have[r[R.person]] = 1; });
    var opts = D.people.filter(function (p) { return p.active && !have[p.name]; })
      .sort(function (a, b) { return uk(a.name, b.name); })
      .map(function (p) { return '<option>' + esc(p.name) + '</option>'; }).join("");
    if (!opts) return "";
    return '<div class="addrow"><select aria-label="Додати людину"><option value="">+ додати людину…</option>' + opts + '</select>' +
      (linesOf(code).length ? '<select data-add="line" aria-label="Стаття бюджету">' + lineOptions(code, "", "стаття: як минулого разу") + '</select>' : "") +
      '<input type="text" inputmode="decimal" placeholder="год" aria-label="Години" data-add="hours">' +
      '<input type="text" inputmode="decimal" placeholder="або грн" aria-label="Гривні" data-add="sum">' +
      '<button class="btn" type="button" data-act="add">Додати</button></div>';
  }

  // ── Вкладка «Люди» ────────────────────────────────────
  function viewPeople() {
    var yr = rowsOf(function (r) { return r[R.year] === S.year; });
    if (S.person) {
      var pr = yr.filter(function (r) { return r[R.person] === S.person; });
      var pi = personInfo(S.person);
      var codes = {}; pr.forEach(function (r) { codes[r[R.project]] = 1; });
      var hoursPer = new Array(12).fill(0);
      pr.forEach(function (r) { hoursPer[r[R.month] - 1] += r[R.hours] || 0; });
      return '<div class="bar"><button class="btn" type="button" data-act="back">‹ Усі люди</button>' + yearSeg() + '</div>' +
        '<div class="block"><h2>' + esc(S.person) + ' <small>' + S.year + ' рік, грн</small>' +
        (mmText(pi) ? '<span class="mm">' + mmText(pi) + '</span>' : "") + '</h2>' +
        tilesWrap(byStatus(pr), true) +
        matrix(Object.keys(codes).sort(function (a, b) { return (isSide(a) - isSide(b)) || uk(a, b); }),
          function (c) { return pr.filter(function (r) { return r[R.project] === c; }); }, "Проєкт", "project", sideTag,
          { rate: function (c) { return isSide(c) ? null : rateIn(S.person, c); }, mark: function (m, v) { return mmClass(pi, v); },
            after: '<tr class="hours"><td>Годин</td><td></td>' + hoursPer.map(function (v) { return '<td class="' + (v ? "" : "z") + '">' + (v ? hrs(v) : "–") + '</td>'; }).join("") +
              '<td><b>' + hrs(hoursPer.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>' +
              '<tr class="hours"><td>Норма годин</td><td></td>' + hoursPer.map(function (v, i) { return '<td>' + norm(S.year, i + 1) + '</td>'; }).join("") + '<td>' + MSHORT.reduce(function (a, _, i) { return a + norm(S.year, i + 1); }, 0) + '</td></tr>' +
              '<tr class="hours"><td>Залучення</td><td></td>' + hoursPer.map(function (v, i) { return loadCell(monthHours(S.person, S.year, i + 1), "", S.year, i + 1); }).join("") + '<td></td></tr>' }) +
        '<p class="legend" style="padding:6px 12px 0">Залучення — години в проєктах ЦППР ÷ норма годин місяця (робочі дні × 8); понад 100% — червоним. ' + (pr.some(function (r) { return r[R.kind] === "ЗП"; }) ? NET_NOTE : "") + '</p>' +
        (pi.min || pi.max ? '<p class="legend" style="padding:6px 12px 0"><span class="below">жовтим</span> — місяць нижче мінімального гонорару, <span class="above">червоним</span> — вище максимального. Ураховано й заробіток на стороні.</p>' : "") +
'</div>';
    }
    var tot = {};
    yr.forEach(function (r) { tot[r[R.person]] = (tot[r[R.person]] || 0) + (r[R.sum] || 0); });
    var q = S.q.toLowerCase(), ls = S.listSort.people;
    var key = function (n) { return ls === "sum" ? monthTotal(n, S.year, S.month) : ls === "load" ? monthHours(n, S.year, S.month) : 0; };
    var names = Object.keys(tot).filter(function (n) { return !q || n.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (key(b) - key(a)) || uk(a, b); });
    return '<div class="bar">' + yearSeg() + listSortSeg("people", [["name", "за прізвищем"], ["sum", "за сумою"], ["load", "за залученням"]]) + '</div>' +
      '<input class="pick" id="q" type="search" autocomplete="off" placeholder="Пошук за прізвищем" value="' + esc(S.q) + '" style="margin-bottom:12px">' +
      (names.length ? '<p class="legend">Сума за ' + MONTHS[S.month - 1].toLowerCase() + ' ' + S.year + ' (разом зі стороннім), % залучення (години ÷ ' + norm(S.year, S.month) + ' год норми місяця) і рамки гонорару. Клік — картка людини.</p><div class="list">' + names.map(function (n) {
        var p = personInfo(n), v = monthTotal(n, S.year, S.month), c = mmClass(p, v);
        var lp = loadPct(monthHours(n, S.year, S.month), S.year, S.month);
        return '<button class="item person" type="button" data-act="person" data-v="' + esc(n) + '"><b>' + esc(n) + '</b><span class="' + c + '">' + (v ? money(v) : "–") + '</span>' +
          (lp ? '<em class="' + (lp > 100 ? "over" : "") + '">' + lp + '%</em>' : "") +
          (p.min || p.max ? '<small>' + (p.min ? money(p.min) : "–") + ' – ' + (p.max ? money(p.max) : "–") + '</small>' : "") + '</button>';
      }).join("") + '</div>' : '<div class="empty">Нікого не знайдено.</div>');
  }
  function personInfo(name) { return D.people.filter(function (p) { return p.name === name; })[0] || {}; }
  // Остання ставка людини в проєкті (за рік, що відкритий; якщо немає — за будь-який)
  function rateIn(person, code) {
    var best = null, ym = -1;
    D.rows.forEach(function (r) {
      if (r[R.person] !== person || r[R.project] !== code || !r[R.rate]) return;
      var k = (r[R.year] === S.year ? 100000 : 0) + r[R.year] * 12 + r[R.month];
      if (k > ym) { ym = k; best = r[R.rate]; }
    });
    return best;
  }
  // Усе, що людина отримує за місяць, зокрема заробіток на стороні
  function monthTotal(person, y, m) {
    return D.rows.reduce(function (a, r) { return a + (r[R.person] === person && r[R.year] === y && r[R.month] === m ? r[R.sum] || 0 : 0); }, 0);
  }
  // Години людини за місяць у роботі через ЦППР (без заробітку на стороні)
  function monthHours(person, y, m) {
    return D.rows.reduce(function (a, r) { return a + (r[R.person] === person && r[R.year] === y && r[R.month] === m && !isSide(r[R.project]) ? r[R.hours] || 0 : 0); }, 0);
  }
  // Норма годин місяця: з аркуша «Норма годин», інакше робочі дні × 8 (свята під час воєнного стану — робочі)
  function norm(y, m) {
    var n = D.norms && D.norms[y + "-" + m];
    if (n) return n;
    var d = new Date(y, m - 1, 1), c = 0;
    while (d.getMonth() === m - 1) { if (d.getDay() % 6) c++; d.setDate(d.getDate() + 1); }
    return c * 8;
  }
  function loadPct(h, y, m) { return h ? Math.round(h / (m ? norm(y, m) : y) * 100) : 0; }
  function loadCell(h, extra, y, m) {
    var p = loadPct(h, y, m);
    return '<td class="' + (!p ? "z" : p > 100 ? "over" : "") + (extra ? " " + extra : "") + '">' + (p ? p + "%" : "–") + '</td>';
  }
  function mmClass(p, v) {
    if (!v) return "";
    if (p.min && v < p.min) return "below";
    if (p.max && v > p.max) return "above";
    return "";
  }
  function mmText(p) {
    if (!p.min && !p.max) return "";
    return "гонорар на місяць: мін " + (p.min ? money(p.min) : "–") + " · макс " + (p.max ? money(p.max) : "–");
  }
  function listSortSeg(list, opts) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button type="button" data-act="lsort" data-l="' + list + '" data-v="' + o[0] + '" aria-pressed="' + (S.listSort[list] === o[0]) + '">' + o[1] + '</button>';
    }).join("") + '</div>';
  }
  function tilesWrap(st, withSide) { return '<div style="padding:10px 12px 0">' + tiles(st, withSide) + '</div>'; }

  // ── Вкладка «Проєкти» ─────────────────────────────────
  function viewProjects() {
    var yr = rowsOf(function (r) { return r[R.year] === S.year; });
    if (S.project) {
      var code = S.project, p = project(code);
      var pr = yr.filter(function (r) { return r[R.project] === code; });
      var names = {}; pr.forEach(function (r) { names[r[R.person]] = 1; });
      var h = '<div class="bar"><button class="btn" type="button" data-act="back">‹ Усі проєкти</button>' + yearSeg() + '</div>' +
        '<div class="block"><h2>' + esc(code) + sideTag(code) + (p.leads.length ? ' <small>керівник: ' + esc(p.leads.join(", ")) + '</small>' : "") +
        ' <small>' + S.year + ' рік, грн</small></h2>' + tilesWrap(byStatus(pr), true) +
        matrix(Object.keys(names).sort(uk), function (n) { return pr.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person", null,
          { rate: function (n) { return isSide(code) ? null : rateIn(n, code); } }) + '</div>' + linesTable(code);
      var bs = D.budgets.filter(function (b) { return b.project === code; });
      if (bs.length) {
        h += '<div class="block"><h2>Бюджет на людину <small>план і факт разом</small></h2><div class="tw"><table class="t"><thead><tr><th>Людина</th><th>Період</th><th>Бюджет</th><th>Використано</th><th>Залишок</th></tr></thead><tbody>';
        bs.forEach(function (b) {
          var used = sum(D.rows.filter(function (r) {
            if (r[R.project] !== code || r[R.person] !== b.person) return false;
            var ym = r[R.year] + "-" + (r[R.month] < 10 ? "0" : "") + r[R.month];
            return (!b.from || ym >= b.from) && (!b.to || ym <= b.to);
          }));
          var left = b.budget - used;
          h += '<tr><td>' + esc(b.person) + '</td><td>' + esc(b.from || b.to ? (b.from || "…") + " – " + (b.to || "…") : "весь проєкт") + '</td><td>' + money(b.budget) +
            '</td><td>' + money(used) + '</td><td class="' + (left < 0 ? "over" : "") + '">' + (left < 0 ? "−" : "") + money(Math.abs(left)) + '</td></tr>';
        });
        h += '</tbody></table></div></div>';
      }
      return h;
    }
    var tot = {};
    yr.forEach(function (r) { tot[r[R.project]] = (tot[r[R.project]] || 0) + (r[R.sum] || 0); });
    var byName = S.listSort.projects === "name";
    var codes = Object.keys(tot).sort(function (a, b) { return (isSide(a) - isSide(b)) || (byName ? uk(a, b) : (isMine(b) - isMine(a)) || (tot[b] - tot[a])); });
    return '<div class="bar">' + yearSeg() + listSortSeg("projects", [["name", "за назвою"], ["sum", "за сумою"]]) + '</div>' + (codes.length ? '<div class="list">' + codes.map(function (c) {
      return '<button class="item" type="button" data-act="project" data-v="' + esc(c) + '"><b>' + esc(c) + (isMine(c) ? ' <span class="mine">мій</span>' : "") + sideTag(c) +
        '</b><span>' + money(tot[c]) + '</span></button>';
    }).join("") + '</div>' : '<div class="empty">За ' + S.year + ' рік записів немає.</div>');
  }

  // ── Вкладка «Рік» ─────────────────────────────────────
  function viewYear() {
    var allYear = rowsOf(function (r) { return r[R.year] === S.year; });
    var yr = allYear.filter(pass);
    var own = yr.filter(function (r) { return !isSide(r[R.project]); }), side = yr.filter(function (r) { return isSide(r[R.project]); });
    var codes = {}; own.forEach(function (r) { codes[r[R.project]] = 1; });
    var sideNames = {}; side.forEach(function (r) { sideNames[r[R.person]] = 1; });
    var per = { paid: new Array(12).fill(0), ok: new Array(12).fill(0), plan: new Array(12).fill(0) };
    own.forEach(function (r) { per[ST_CLASS[r[R.status]] || "plan"][r[R.month] - 1] += r[R.sum] || 0; });
    function line(label, arr) {
      return '<tr><td>' + label + '</td>' + arr.map(function (v, i) { return cell(v, S.year, i + 1); }).join("") +
        '<td><b>' + money(arr.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>';
    }
    var overCodes = {}; own.forEach(function (r) { overCodes[r[R.project]] = 1; });
    return '<div class="bar">' + yearSeg() + '</div>' + filterBar(allYear) + tiles(byStatus(yr)) + overBlock(Object.keys(overCodes).sort(uk)) +
      '<div class="block"><h2>За проєктами <small>' + S.year + ' рік, грн</small></h2>' +
      matrix(Object.keys(codes).sort(uk), function (c) { return own.filter(function (r) { return r[R.project] === c; }); }, "Проєкт", "project") + '</div>' +
      (S.fPerson ? "" : '<div class="block"><h2>За людьми <small>' + S.year + ' рік, грн, через ЦППР</small></h2>' +
        matrix(Object.keys(own.reduce(function (o, r) { o[r[R.person]] = 1; return o; }, {})).sort(uk),
          function (n) { return own.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>') +
      loadBlock(own) +
      (side.length ? '<div class="block"><h2>Зароблено на стороні <small>не через ЦППР</small></h2>' +
        matrix(Object.keys(sideNames).sort(uk), function (n) { return side.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>' : "") +
      '<div class="block"><h2>Що оплачено і що попереду</h2><div class="tw"><table class="t"><thead><tr><th>Статус</th>' +
      MSHORT.map(function (m) { return '<th>' + m + '</th>'; }).join("") + '<th>Разом</th></tr></thead><tbody>' +
      line("Оплачено", per.paid) + line("Підтверджено", per.ok) + line("План", per.plan) + '</tbody></table></div></div>' +
      '<p class="legend">Суми — виплати людям за місяцями, без інших витрат проєктів. ' + NET_NOTE + ' Клік по заголовку стовпця — сортування.</p>';
  }

  // Залучення людей за місяцями року
  function loadBlock(own) {
    var names = {}; own.forEach(function (r) { names[r[R.person]] = 1; });
    var list = Object.keys(names).filter(function (n) { return n !== "Офіс" && n !== "Інтернет"; }).sort(uk);
    if (!list.length) return "";
    var yearNorm = MSHORT.reduce(function (a, _, i) { return a + norm(S.year, i + 1); }, 0);
    var over = 0, body = list.map(function (n) {
      var per = MSHORT.map(function (_, i) { return monthHours(n, S.year, i + 1); });
      var mx = Math.max.apply(null, per.map(function (h, i) { return loadPct(h, S.year, i + 1); }));
      if (mx > 100) over++;
      return '<tr><td><button class="plink" type="button" data-act="person" data-v="' + esc(n) + '">' + esc(n) + '</button></td>' +
        per.map(function (h, i) { return loadCell(h, isCur(S.year, i + 1) ? "cur" : "", S.year, i + 1); }).join("") + loadCell(per.reduce(function (a, b) { return a + b; }, 0), "", yearNorm) + '</tr>';
    }).join("");
    body += '<tr class="hours"><td>Норма годин</td>' + MSHORT.map(function (_, i) { return '<td>' + norm(S.year, i + 1) + '</td>'; }).join("") + '<td>' + yearNorm + '</td></tr>';
    return '<div class="block"><h2>Залучення людей <small>години в проєктах ЦППР ÷ норма годин місяця (робочі дні × 8)' + (over ? ' · понад 100% хоча б раз: ' + over : "") + '</small></h2>' +
      '<div class="tw"><table class="t"><thead><tr><th>Людина</th>' + MSHORT.map(function (m) { return '<th>' + m + '</th>'; }).join("") + '<th>За рік</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  // ── Сортування таблиць: клік по заголовку стовпця ─────
  function cellVal(td) {
    var t = (td ? td.textContent : "").replace(/[\u00A0\s]/g, "").replace("−", "-");
    if (t === "–" || t === "") return { n: true, v: -Infinity };
    var m = t.match(/^-?\d+(?:[.,]\d+)?/);
    if (m && /^-?\d+(?:[.,]\d+)?(%|\/.*)?$/.test(t)) return { n: true, v: parseFloat(m[0].replace(",", ".")) };
    return { n: false, v: (td.textContent || "").trim() };
  }
  function tableKey(i) { return S.tab + "|" + (S.person || S.project || "") + "|" + i; }
  function sortTable(tbl, col, dir) {
    var tb = tbl.tBodies[0]; if (!tb) return;
    var rows = Array.prototype.slice.call(tb.rows), fixed = rows.filter(function (r) { return /\b(total|hours)\b/.test(r.className); });
    var data = rows.filter(function (r) { return fixed.indexOf(r) < 0; });
    data.sort(function (a, b) {
      var x = cellVal(a.cells[col]), y = cellVal(b.cells[col]);
      var c = x.n && y.n ? x.v - y.v : String(x.v).localeCompare(String(y.v), "uk");
      return dir * (c || 0);
    });
    data.concat(fixed).forEach(function (r) { tb.appendChild(r); });
    Array.prototype.forEach.call(tbl.tHead.rows[0].cells, function (th, i) { th.setAttribute("data-dir", i === col ? (dir > 0 ? "asc" : "desc") : ""); });
  }
  function applySorts() {
    Array.prototype.forEach.call($("view").querySelectorAll("table.t"), function (tbl, i) {
      if (!tbl.tHead) return;
      tbl.setAttribute("data-key", tableKey(i));
      var s = S.sort[tableKey(i)];
      if (s) sortTable(tbl, s.col, s.dir);
    });
  }
  function onHeadClick(th) {
    var tbl = th.closest("table"), key = tbl.getAttribute("data-key"), col = th.cellIndex, cur = S.sort[key];
    // перший клік: числа — від більшого, текст — за абеткою
    var first = cellVal(tbl.tBodies[0] && tbl.tBodies[0].rows[0] && tbl.tBodies[0].rows[0].cells[col]).n ? -1 : 1;
    var dir = cur && cur.col === col ? -cur.dir : first;
    S.sort[key] = { col: col, dir: dir };
    sortTable(tbl, col, dir);
  }

  // ── Малювання ─────────────────────────────────────────
  function render() {
    if (!D) return;
    var tabs = document.querySelectorAll('nav.tabs button[role="tab"]');
    Array.prototype.forEach.call(tabs, function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === S.tab)); });
    useCache = {};
    var v = $("view");
    v.innerHTML = S.tab === "month" ? viewMonth() : S.tab === "people" ? viewPeople() : S.tab === "projects" ? viewProjects() : viewYear();
    applySorts();
    saveBar();
  }
  function saveBar() {
    var n = Object.keys(dirty).length;
    $("savebar").hidden = !n;
    $("saveInfo").textContent = n ? "Змінено рядків: " + n : "";
    $("saveBtn").disabled = busy;
  }
  var toastTimer = 0;
  function toast(msg, isErr) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 2600);
  }
  function leaveOk() { return !Object.keys(dirty).length || confirm("Є незбережені зміни. Продовжити без збереження?"); }

  // ── Дії ───────────────────────────────────────────────
  function run(promise, okMsg) {
    busy = true; saveBar();
    return promise.then(function (res) {
      busy = false;
      if (!res || !res.ok) { toast(errText(res), true); saveBar(); return null; }
      if (res.rows) mergeRows(res.rows);
      if (res.removed) D.rows = D.rows.filter(function (r) { return res.removed.indexOf(r[R.id]) < 0; });
      if (okMsg) toast(okMsg);
      return res;
    }).catch(function (e) {
      busy = false; saveBar();
      if (!(e && e.message === "AUTH")) toast("Немає зв'язку із сервером. Спробуйте ще раз", true);
      return null;
    });
  }

  function saveDirty() {
    var ids = Object.keys(dirty);
    if (!ids.length) return Promise.resolve(true);
    var rows = [], bad = "";
    ids.forEach(function (id) {
      var d = dirty[id], r = rowById(+id), o = { id: +id };
      if (!r) return;
      if (d.mode === "sum") { // внесли гроші — години порахує сервер
        if (d.sum === "") o.sum = 0;
        else { o.sum = parseNum(d.sum); if (!(o.sum >= 0)) bad = r[R.person] + ": гривні мають бути числом"; }
      } else if (d.hours !== undefined) {
        if (d.hours === "") o.hours = "";
        else { o.hours = parseNum(d.hours); if (!(o.hours >= 0)) bad = r[R.person] + ": години мають бути числом"; }
      } else if (r[R.hours] !== null) o.hours = r[R.hours];  // змінили лише ставку
      if (d.rate !== undefined && d.rate !== "") { o.rate = parseNum(d.rate); if (!(o.rate > 0)) bad = r[R.person] + ": неправильна ставка"; }
      rows.push(o);
    });
    if (bad) { toast(bad, true); return Promise.resolve(false); }
    return run(api("save", { rows: rows }), "Збережено").then(function (res) {
      if (!res) return false;
      dirty = {}; render();
      return true;
    });
  }

  function monthRows(code, status) {
    return rowsOf(function (r) { return r[R.year] === S.year && r[R.month] === S.month && r[R.project] === code && r[R.status] === status && pass(r); });
  }

  function onClick(e) {
    var th = e.target.closest("table.t thead th");
    if (th && !e.target.closest("[data-act]")) { onHeadClick(th); return; }
    var b = e.target.closest("[data-act]");
    if (!b || busy) return;
    var act = b.getAttribute("data-act"), v = b.getAttribute("data-v");
    if (act === "prev" || act === "next") {
      var m = S.month + (act === "next" ? 1 : -1), y = S.year;
      if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
      if (!leaveOk()) return;
      dirty = {}; S.open = {}; S.month = m; S.year = y; render();
    } else if (act === "nofilter" || act === "mineonly") {
      if (!leaveOk()) return;
      dirty = {}; S.fProject = ""; S.fPerson = ""; S.fLead = act === "mineonly" ? (D.me.lead || "") : ""; render();
    }
    else if (act === "year") { S.year = +b.getAttribute("data-y"); render(); }
    else if (act === "lsort") { S.listSort[b.getAttribute("data-l")] = v; render(); }
    else if (act === "person") { S.tab = "people"; S.person = v; render(); window.scrollTo(0, 0); }
    else if (act === "project") { S.tab = "projects"; S.project = v; render(); window.scrollTo(0, 0); }
    else if (act === "back") { S.person = ""; S.project = ""; render(); }
    else if (act === "more") { var id = +b.closest(".row").getAttribute("data-id"); S.open[id] = !S.open[id]; render(); }
    else if (act === "confirm") {
      saveDirty().then(function (ok) {
        if (!ok) return;
        var ids = monthRows(v, ST.plan).filter(canEditRow).map(function (r) { return r[R.id]; });
        if (!ids.length) return;
        run(api("confirm", { ids: ids }), "Години підтверджено").then(render);
      });
    } else if (act === "pay") {
      saveDirty().then(function (ok) {
        if (!ok) return;
        var ids = monthRows(v, ST.ok).map(function (r) { return r[R.id]; });
        if (!ids.length) return;
        var d = prompt("Дата оплати (рррр-мм-дд)", D.today || "");
        if (d === null) return;
        run(api("setStatus", { ids: ids, status: ST.paid, date: d.trim() }), "Позначено оплаченим").then(render);
      });
    } else if (act === "remove") {
      var rid = +b.closest(".row").getAttribute("data-id"), r = rowById(rid);
      if (!r || !confirm("Вилучити рядок: " + r[R.person] + ", " + r[R.project] + "?")) return;
      delete dirty[rid];
      run(api("remove", { ids: [rid] }), "Вилучено").then(render);
    } else if (act === "add") {
      var box = b.closest(".addrow"), person = box.querySelector("select").value;
      var hv = box.querySelector('[data-add="hours"]').value.trim(), sv = box.querySelector('[data-add="sum"]').value.trim();
      var code = b.closest(".block").getAttribute("data-project");
      if (!person) { toast("Виберіть людину", true); return; }
      var row = { year: S.year, month: S.month, person: person, project: code };
      var ls = box.querySelector('[data-add="line"]');
      if (ls && ls.value) row.line = ls.value;
      if (sv !== "" && hv === "") { row.sum = parseNum(sv); if (!(row.sum >= 0)) { toast("Гривні мають бути числом", true); return; } }
      else { row.hours = hv === "" ? "" : parseNum(hv); if (hv !== "" && !(row.hours >= 0)) { toast("Години мають бути числом", true); return; } }
      run(api("save", { rows: [row] }), "Додано").then(render);
    }
  }

  function onInput(e) {
    var t = e.target;
    if (t.id === "q") { S.q = t.value; var pos = t.selectionStart; render(); var q = $("q"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } return; }
    var f = t.getAttribute("data-f"), rowEl = t.closest(".row");
    if (!f || !rowEl || f === "status" || f === "line") return;
    var id = +rowEl.getAttribute("data-id"), r = rowById(id);
    if (!r) return;
    var d = dirty[id] || (dirty[id] = { mode: "hours" });
    var val = t.value.trim();
    if (f === "sum") { d.mode = "sum"; d.sum = val; delete d.hours; }
    else if (f === "hours") { d.mode = "hours"; d.hours = val; delete d.sum; }
    else d.rate = val;
    // якщо все повернули як було — рядок більше не «змінений»
    var same = (d.rate === undefined || d.rate === String(r[R.rate] || "")) &&
      (d.mode === "sum" ? d.sum === sumStr(r[R.sum]) : (d.hours === undefined || d.hours === hrs(r[R.hours])));
    if (same) delete dirty[id];
    var v = live(r, dirty[id]);
    var hi = rowEl.querySelector("input.h"), si = rowEl.querySelector("input.s");
    if (hi && t !== hi) hi.value = v.hours;
    if (si && t !== si) si.value = v.sum;
    if (hi) hi.classList.toggle("dirty", !same);
    if (si) si.classList.toggle("dirty", !same);
    saveBar();
  }

  function onChange(e) {
    var t = e.target;
    if (t.id === "fLead" || t.id === "fProject" || t.id === "fPerson") {
      if (!leaveOk()) { render(); return; }
      dirty = {};
      S[t.id] = t.value;
      render();
      return;
    }
    if (t.getAttribute("data-f") === "line" && !busy) {
      run(api("save", { rows: [{ id: +t.closest(".row").getAttribute("data-id"), line: t.value }] }), "Статтю змінено").then(render);
      return;
    }
    if (t.getAttribute("data-f") !== "status" || busy) return;
    var id = +t.closest(".row").getAttribute("data-id"), status = t.value, payload = { ids: [id], status: status };
    if (status === ST.paid) {
      var d = prompt("Дата оплати (рррр-мм-дд)", D.today || "");
      if (d === null) { render(); return; }
      payload.date = d.trim();
    }
    run(api("setStatus", payload), "Статус змінено").then(render);
  }

  // ── Запуск ────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    $("view").addEventListener("click", onClick);
    $("view").addEventListener("input", onInput);
    $("view").addEventListener("change", onChange);
    $("view").addEventListener("keydown", function (e) {
      var c = e.target.classList;
      if (e.key === "Enter" && c && (c.contains("h") || c.contains("s"))) { e.preventDefault(); saveDirty(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('nav.tabs button[role="tab"]'), function (b) {
      b.addEventListener("click", function () {
        if (!leaveOk()) return;
        dirty = {}; S.tab = b.getAttribute("data-tab"); S.person = ""; S.project = ""; render(); window.scrollTo(0, 0);
      });
    });
    $("saveBtn").addEventListener("click", function () { if (!busy) saveDirty(); });
    $("saveCancel").addEventListener("click", function () { dirty = {}; render(); });
    $("refresh").addEventListener("click", function () {
      if (!leaveOk()) return;
      dirty = {}; load();
    });
    $("logout").addEventListener("click", function () { signOut(); });
    window.addEventListener("beforeunload", function (e) { if (Object.keys(dirty).length) { e.preventDefault(); e.returnValue = ""; } });
    if (window.google && google.accounts) initGsi();
    if (token()) load(); else showGate();
  });
})();
