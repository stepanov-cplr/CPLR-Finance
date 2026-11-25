/* Фінсистема ЦППР — сторінка. Даних і адрес команди тут немає: усе приходить із сервера після входу.
   Версія 1.10.1 — 25.11.2026: у «Році» таблиця «За проєктами» — останньою (після «Перевищення бюджету»).
   Версія 1.10.0 — 21.11.2026: «Витрати на ЦППР» — гроші з гонорару, витрачені людиною на потреби ЦППР (завжди мінус).
   Версія 1.9.2 — 21.11.2026: «Передано колегам» завжди мінусом; у «Внеску» знак як у файлі (плюс — повернення).
   Версія 1.9.1 — 20.11.2026: у переданому й внесках знак як у файлі (плюс — повернення).
   Версія 1.9.0 — 20.11.2026: «Отримано фактично» — «Передано колегам» і «Внесок» віднімаються від суми людини (лише перегляд,
     ведуться у файлі «Виплати»; бачать адміни й члени правління); звірка доплат із переданим колегам у «Році».
   Версія 1.8.2 — 20.11.2026: «Доплата від колег» — окрема категорія: не через ЦППР, лише сума, без годин; у загальну суму людини
     і в рамки гонорару; окрема плитка й окремий блок у «Році».
   Версія 1.8.1 — 20.11.2026: кнопка «Редагувати суми» — помітна (синя, з олівцем).
   Версія 1.8.0 — 20.11.2026: напрями (експертні, комунікаційний, адміністративний) — фільтр у «Місяці», «Році» і «Людях»,
     напрями в картці людини; бачать лише адміни й члени правління, змінює адмін.
   Версія 1.7.0 — 17.11.2026: правка сум у картці людини й картці проєкту (кнопка «Редагувати суми»): години видно в клітинці,
     неціле число годин — помаранчевим; підсумки, рамки гонорару й залучення перераховуються одразу.
   Версія 1.6.3 — 17.11.2026: у «Році» блок «Перевищення бюджету» — унизу сторінки.
   Версія 1.6.2 — 17.11.2026: коментарі в «Році», картці людини й картці проєкту — позначка в клітинці і перелік під таблицею.
   Версія 1.6.1 — 17.11.2026: коментарі до виплат — видно під рядком (хто й коли), пише кожен, хто вносить години в проєкті.
   Версія 1.6.0 — 17.11.2026: «З інших періодів» — окрема позначка й плитка (входять у суму людини і в «Разом через ЦППР»).
   Версія 1.5.3 — 17.11.2026: пояснення кольорів у списку людей.
   Версія 1.5.2 — 17.11.2026: Офіс, Інтернет — витрати: без ставки, годин і залучення.
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
  var R = { id: 0, year: 1, month: 2, person: 3, project: 4, rate: 5, hours: 6, sum: 7, status: 8, paid: 9, kind: 10, note: 11, line: 12, noteBy: 13, noteAt: 14 };

  var D = null;            // дані з сервера — лише в пам'яті сторінки
  var S = { sort: {}, listSort: { people: "name", projects: "sum" }, tab: "month", year: 0, month: 0, fLead: "", fProject: "", fPerson: "", fDir: "", dirEdit: false, person: "", project: "", q: "", open: {}, noteOpen: {}, mxOn: false, mxAdd: {} };
  var dirty = {}, mx = {};          // dirty: id рядка → {mode: "hours"|"sum", hours, sum, rate}; mx: «рік|місяць|людина|проєкт» → сума з картки
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    n = Math.round(n || 0);
    return (n < 0 ? "−" : "") + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
    D = null; dirty = {}; mx = {};
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
  // «З інших періодів» — виплати ЦППР за роботу в інших місяцях: як стороннє — без підтвердження й оплати і без годин залучення
  function isPrior(code) { return !!project(code).prior; }
  function isBonus(code) { return !!project(code).bonus; }
  function isOut(code) { return !!project(code).out; }
  var OUT_LABEL = { "передано": "передано колегам", "внесок": "внесок у ЦППР", "витрати": "витрати на ЦППР" };
  function outLabel(code) { return OUT_LABEL[project(code).out] || "внесок у ЦППР"; }   // «передано колегам» / «внесок» — лише перегляд, з файлу «Виплати»
  function seesOutRows() { return D.projects.some(function (p) { return p.out; }); }
  function isLead() { return D.me.role === "board" || D.me.role === "pm"; }
  function canEditProject(code) { if (isOut(code)) return false; return canAll() || (D.me.role === "board" && (isMine(code) || isSide(code))) || (D.me.role === "pm" && isMine(code)); }
  function canEditRow(r) { if (isOut(r[R.project])) return false; return canAll() || (canEditProject(r[R.project]) && r[R.status] !== ST.paid); }
  // коментар — і до оплаченого, якщо людина вносить години в цьому проєкті
  function canNote(r) { if (isOut(r[R.project])) return false; return canAll() || canEditProject(r[R.project]); }

  // ── Допоміжне для даних ───────────────────────────────
  function rowsOf(f) { return D.rows.filter(f); }
  function sum(rows) { return rows.reduce(function (a, r) { return a + (r[R.sum] || 0); }, 0); }
  // Виплати ЦППР за статусами; заробіток на стороні й виплати з інших періодів — окремо
  function byStatus(rows) {
    var o = { plan: 0, ok: 0, paid: 0, side: 0, prior: 0, bonus: 0, given: 0, contrib: 0, spent: 0 };
    rows.forEach(function (r) { var ot = project(r[R.project]).out; o[ot === "передано" ? "given" : ot === "витрати" ? "spent" : ot ? "contrib" : isBonus(r[R.project]) ? "bonus" : isPrior(r[R.project]) ? "prior" : isSide(r[R.project]) ? "side" : (ST_CLASS[r[R.status]] || "plan")] += r[R.sum] || 0; });
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
  function pass(r) { return passProject(r[R.project]) && (!S.fPerson || r[R.person] === S.fPerson) && passDir(r[R.person]); }
  function filtersOn() { return !!(S.fLead || S.fProject || S.fPerson || (hasDirs() && S.fDir)); }

  // ── Напрями: лише для адмінів і членів правління (іншим сервер їх не віддає) ──
  var DIR_GROUPS = [["експертний", "Експертні напрями", "усі експертні"], ["комунікаційний", "Комунікаційний", "увесь комунікаційний"], ["адміністративний", "Адміністративний", "уся адміністрація"]];
  function hasDirs() { return !!(D && D.directions && D.directions.length); }
  function canDirs() { return hasDirs() && D.me.role === "admin"; }
  function dirsOf(name) { return personInfo(name).dirs || []; }
  function dirType(name) { var d = D.directions.filter(function (x) { return x.name === name; })[0]; return d ? d.type : ""; }
  // Людина в кількох напрямах потрапляє в кожен із них
  function passDir(name) {
    if (!S.fDir || !hasDirs()) return true;
    var ds = dirsOf(name);
    if (S.fDir === "-") return !ds.length;
    if (S.fDir.indexOf("type:") === 0) { var t = S.fDir.slice(5); return ds.some(function (d) { return dirType(d) === t; }); }
    return ds.indexOf(S.fDir) >= 0;
  }
  function dirSelect() {
    if (!hasDirs()) return "";
    function o(v, label) { return '<option value="' + esc(v) + '"' + (S.fDir === v ? " selected" : "") + '>' + esc(label) + '</option>'; }
    return '<select class="pick" id="fDir" aria-label="Напрям">' + o("", "Усі напрями") + DIR_GROUPS.map(function (g) {
      var list = D.directions.filter(function (d) { return d.type === g[0]; });
      if (!list.length) return "";
      return '<optgroup label="' + g[1] + '">' + (list.length > 1 ? o("type:" + g[0], "— " + g[2] + " —") : "") +
        list.map(function (d) { return o(d.name, d.name); }).join("") + '</optgroup>';
    }).join("") + '<optgroup label="Інше">' + o("-", "без напряму") + '</optgroup></select>';
  }
  function dirTags(name) {
    return dirsOf(name).map(function (d) { return '<span class="dirtag ' + (dirType(d) === "експертний" ? "" : dirType(d) === "комунікаційний" ? "com" : "adm") + '">' + esc(d) + '</span>'; }).join("");
  }
  function dirFilterNote() {
    if (!hasDirs() || !S.fDir) return "";
    var label = S.fDir === "-" ? "без напряму" : S.fDir.indexOf("type:") === 0 ? DIR_GROUPS.filter(function (g) { return "type:" + g[0] === S.fDir; }).map(function (g) { return g[1].toLowerCase(); })[0] : S.fDir;
    return '<p class="legend">Напрям: <b>' + esc(label) + '</b> — показано лише людей цього напряму (з усіма їхніми проєктами). Людина з кількома напрямами потрапляє в кожен.</p>';
  }
  function dirCard(name) {
    if (!hasDirs() || isExpense(name) && !dirsOf(name).length && !canDirs()) return "";
    var ds = dirsOf(name);
    if (S.dirEdit && canDirs()) {
      return '<div class="dirbox editing"><b>Напрями</b>' + DIR_GROUPS.map(function (g) {
        var list = D.directions.filter(function (d) { return d.type === g[0]; });
        return list.length ? '<div class="dirgrp"><small>' + g[1] + '</small>' + list.map(function (d) {
          return '<label><input type="checkbox" data-dir="' + esc(d.name) + '"' + (ds.indexOf(d.name) >= 0 ? " checked" : "") + '> ' + esc(d.name) + '</label>';
        }).join("") + '</div>' : "";
      }).join("") + '<div class="dirbtns"><button class="btn primary" type="button" data-act="dirsave">Зберегти напрями</button> <button class="btn" type="button" data-act="dircancel">Скасувати</button></div></div>';
    }
    return '<div class="dirbox"><b>Напрями:</b> ' + (ds.length ? dirTags(name) : '<span class="muted">не визначено</span>') +
      (canDirs() ? ' <button class="linkbtn" type="button" data-act="diredit">змінити</button>' : "") + '</div>';
  }
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
      sel("fPerson", "Людина", S.fPerson, Object.keys(names).sort(uk), "Усі люди") + dirSelect() +
      (mineLead && S.fLead !== mineLead ? '<button class="linkbtn" type="button" data-act="mineonly">лише мої</button>' : "") +
      (filtersOn() ? '<button class="linkbtn" type="button" data-act="nofilter">скинути</button>' : "") + '</div>' + dirFilterNote();
  }

  // ── Спільні шматки розмітки ───────────────────────────
  // withSide: у «Разом» входить і заробіток на стороні (картка людини)
  function tiles(st, withSide) {
    var cplr = st.plan + st.ok + st.paid + (st.prior || 0);
    return '<div class="tiles">' +
      '<div class="tile plan"><small>План</small><b>' + money(st.plan) + '</b></div>' +
      '<div class="tile ok"><small>Підтверджено керівником</small><b>' + money(st.ok) + '</b></div>' +
      '<div class="tile paid"><small>Оплачено</small><b>' + money(st.paid) + '</b></div>' +
      (st.prior ? '<div class="tile prior"><small>З інших періодів</small><b>' + money(st.prior) + '</b></div>' : "") +
      (st.side ? '<div class="tile side"><small>Зароблено на стороні</small><b>' + money(st.side) + '</b></div>' : "") +
      (st.bonus ? '<div class="tile bonus"><small>Доплати від колег</small><b>' + money(st.bonus) + '</b></div>' : "") +
      (st.given ? '<div class="tile out"><small>Передано колегам</small><b>' + money(st.given) + '</b></div>' : "") +
      (st.contrib ? '<div class="tile out"><small>Внески в ЦППР</small><b>' + money(st.contrib) + '</b></div>' : "") +
      (st.spent ? '<div class="tile out"><small>Витрати на ЦППР</small><b>' + money(st.spent) + '</b></div>' : "") +
      '<div class="tile total"><small>' + (withSide && (st.given || st.contrib || st.spent) ? "Отримано фактично, грн" : withSide && (st.side || st.bonus) ? "Разом зі стороннім і доплатами, грн" : "Разом через ЦППР, грн") + '</small><b>' +
      money(cplr + (withSide ? st.side + (st.bonus || 0) + (st.given || 0) + (st.contrib || 0) + (st.spent || 0) : 0)) + '</b></div></div>';
  }
  function yearSeg() {
    return '<div class="seg">' + years().map(function (y) {
      return '<button type="button" data-act="year" data-y="' + y + '" aria-pressed="' + (y === S.year) + '">' + y + '</button>';
    }).join("") + '</div>';
  }
  function cell(v, y, m, notes) {
    var c = (v ? "" : "z") + (isCur(y, m) ? " cur" : "") + (notes && notes.length ? " hasnote" : "");
    return '<td class="' + c.trim() + '"' + (notes && notes.length ? ' title="' + esc(notes.join("\n\n")) + '"' : "") + '>' + (v ? money(v) : "–") + '</td>';
  }
  // Коментарі за рік: перелік під таблицею (на телефоні підказки клітинок не видно). hide — яку назву не повторювати
  function notesBlock(rows, hide) {
    var list = rows.filter(function (r) { return r[R.note]; }).sort(function (a, b) {
      return a[R.month] - b[R.month] || uk(a[R.project], b[R.project]) || uk(a[R.person], b[R.person]);
    });
    if (!list.length) return "";
    return '<div class="block notesblock"><h2>Коментарі <small>' + S.year + ' рік · ' + list.length + '</small></h2><ul class="notes">' + list.map(function (r) {
      var what = [hide === "project" ? "" : r[R.project], hide === "person" ? "" : r[R.person]].filter(String).join(" · ");
      var when = r[R.noteAt] ? String(r[R.noteAt]).slice(8, 10) + "." + String(r[R.noteAt]).slice(5, 7) : "";
      return '<li><span class="nm">' + MSHORT[r[R.month] - 1] + '</span> <b>' + esc(what) + '</b> <span class="nsum">' + money(r[R.sum]) + '</span>' +
        '<div class="note">' + esc(r[R.note]) + (r[R.noteBy] || when ? '<small> — ' + esc([r[R.noteBy], when].filter(String).join(", ")) + '</small>' : "") + '</div></li>';
    }).join("") + '</ul></div>';
  }
  function noteLabel(r, n) { return [r[R.project], r[R.person]].filter(function (x) { return x !== n; }).join(" · ") + ": " + r[R.note]; }
  function sideTag(code) { var ot = project(code).out; if (ot) return ' <span class="sidetag out">' + outLabel(code) + '</span>'; return isBonus(code) ? ' <span class="sidetag bonus">доплата</span>' : isPrior(code) ? ' <span class="sidetag prior">з інших періодів</span>' : isSide(code) ? ' <span class="sidetag">на стороні</span>' : ""; }
  // Таблиця «рядки × 12 місяців»
  // opt.rate(назва) — ставка, грн/год, окремою колонкою; opt.mark(місяць, сума) — клас для клітинки підсумку
  function matrix(names, pick, firstHead, linkAct, tag, opt) {
    opt = opt || {};
    var ed = opt.edit && S.mxOn ? opt.edit : null;
    var head = '<tr><th>' + esc(firstHead) + '</th>' + (opt.rate ? '<th>Ставка</th>' : "") + MSHORT.map(function (m) { return '<th>' + m + '</th>'; }).join("") + '<th>Разом</th></tr>';
    var tot = new Array(12).fill(0), body = "";
    names.forEach(function (n) {
      var rs = pick(n), per = new Array(12).fill(0), notes = MSHORT.map(function () { return []; });
      rs.forEach(function (r) { per[r[R.month] - 1] += r[R.sum] || 0; if (r[R.note]) notes[r[R.month] - 1].push(noteLabel(r, n)); });
      if (!per.some(Boolean) && !ed) return;
      per.forEach(function (v, i) { tot[i] += v; });
      var rt = opt.rate ? opt.rate(n) : null;
      body += '<tr><td>' + (linkAct ? '<button class="plink" type="button" data-act="' + linkAct + '" data-v="' + esc(n) + '">' + esc(n) + '</button>' : esc(n)) + (tag ? tag(n) : "") + '</td>' +
        (opt.rate ? '<td class="rate">' + (rt ? money(rt) : "–") + '</td>' : "") +
        per.map(function (v, i) {
          if (!ed) return cell(v, S.year, i + 1, notes[i]);
          var person = ed.person || n, project = ed.project || n;
          return mxCell(person, project, i + 1, rs.filter(function (r) { return r[R.month] === i + 1; })[0]);
        }).join("") + '<td><b>' + money(per.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>';
    });
    if (!body) return '<div class="empty">За ' + S.year + ' рік записів немає.</div>';
    body += '<tr class="total"><td>Разом</td>' + (opt.rate ? '<td></td>' : "") + tot.map(function (v, i) {
      var c = opt.mark ? opt.mark(i + 1, v) : "";
      return '<td' + (c ? ' class="' + c + '"' : "") + '>' + (v ? money(v) : "–") + '</td>';
    }).join("") +
      '<td>' + money(tot.reduce(function (a, b) { return a + b; }, 0)) + '</td></tr>';
    if (opt.after) body += opt.after;
    return '<div class="tw"><table class="t' + (ed ? " mxt" : "") + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  // ── Вкладка «Місяць» ──────────────────────────────────
  function viewMonth() {
    var y = S.year, m = S.month;
    var all = rowsOf(function (r) { return r[R.year] === y && r[R.month] === m; });
    var shown = all.filter(pass);
    var codes = {};
    shown.forEach(function (r) { codes[r[R.project]] = 1; });
    // порожні блоки — лише там, де людина може щось внести, і якщо не шукають конкретну людину
    if (!S.fPerson && !(hasDirs() && S.fDir)) D.projects.forEach(function (p) { if (p.active && canEditProject(p.code) && passProject(p.code)) codes[p.code] = 1; });
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
      if (p.out) h += '<div class="sidenote">' + (p.out === "передано" ? "Частина заробленого, яку людина перерахувала колегам (у них це «Доплата»); завжди віднімається." : p.out === "витрати" ? "Гроші з гонорару, які людина сама витратила на потреби ЦППР чи проєкту (реклама, сервіси, обладнання); завжди віднімаються." : "Внесок людини на рахунок ЦППР: мінус — внесок, плюс — повернення чи доплата з цих коштів.") + ' Так видно, скільки людина отримала фактично. Ведеться у файлі «Виплати».</div>';
      else if (p.bonus) h += '<div class="sidenote">Частина заробленого колегами в проєктах, яку вони перераховують людині, що допомагала без договору в проєкті. Не через ЦППР; зараховується до загальної виплати людини й у рамки гонорару.</div>';
      else if (p.prior) h += '<div class="sidenote">Виплати за роботу в інших періодах. Зараховуються до загальної виплати людини; підтвердження й оплати тут немає.</div>';
      else if (p.side) h += '<div class="sidenote">Зароблене не через ЦППР. Зараховується до загальної виплати людини.</div>';
      if (!rows.length) h += '<div class="empty small">Ще нікого не внесено.</div>';
      else h += '<div class="rowhead"><span></span><span>години</span><span>гривні</span></div>';
      rows.forEach(function (r) { h += rowHtml(r); });
      if (edit && !S.fPerson) h += addRowHtml(code, all.filter(function (r) { return r[R.project] === code; }));
      var nPlan = p.side ? 0 : rows.filter(function (r) { return r[R.status] === ST.plan && canEditRow(r); }).length;
      var nOk = p.side ? 0 : rows.filter(function (r) { return r[R.status] === ST.ok; }).length;
      if ((edit && nPlan) || (canAll() && nOk)) {
        h += '<div class="foot">';
        if (edit && nPlan) h += '<button class="btn primary" type="button" data-act="confirm" data-v="' + esc(code) + '">' + (p.bonus ? "Підтвердити доплати" : "Підтвердити години") + ' (' + nPlan + ')</button>';
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
    var bon = isBonus(r[R.project]) || isOut(r[R.project]), ex = isExpense(r[R.person]) || bon;
    var h = '<div class="row" data-id="' + id + '"><div class="who"><b>' + esc(r[R.person]) + '</b><small>' +
      (isOut(r[R.project]) ? outLabel(r[R.project]) : bon ? "доплата від колег, лише сума" : ex ? "витрати" : r[R.rate] ? money(r[R.rate]) + " грн/год" : "без ставки") + (r[R.kind] === "ЗП" ? ' · <span title="' + esc(NET_NOTE) + '">зарплата, чиста</span>' : "") +
      (side ? "" : ' <span class="st ' + (ST_CLASS[r[R.status]] || "plan") + '">' + esc(r[R.status]) +
        (r[R.paid] ? " " + esc(r[R.paid].slice(8, 10) + "." + r[R.paid].slice(5, 7)) : "") + '</span>') +
      lineNote(r) + '</small></div>';
    if (edit) {
      h += (ex ? '<div class="hh">–</div>' : '<input class="h' + (d ? " dirty" : "") + '" type="text" inputmode="decimal" autocomplete="off" aria-label="Години: ' + esc(r[R.person]) + '" data-f="hours" value="' + esc(v.hours) + '" placeholder="год">') +
        '<input class="s' + (d ? " dirty" : "") + '" type="text" inputmode="decimal" autocomplete="off" aria-label="Гривні: ' + esc(r[R.person]) + '" data-f="sum" value="' + esc(v.sum) + '" placeholder="грн">';
    } else {
      h += '<div class="hh">' + (hrs(r[R.hours]) || "–") + '</div><div class="amt">' + money(r[R.sum]) + '</div>';
    }
    h += noteHtml(r);
    if (canAll() && !isOut(r[R.project])) {
      h += '<div class="rowtools">';
      if (S.open[id]) {
        h += (isBonus(r[R.project]) || isExpense(r[R.person]) ? "" : '<label>ставка <input type="text" inputmode="decimal" data-f="rate" value="' + esc(d && d.rate !== undefined ? d.rate : (r[R.rate] || "")) + '"></label>') +
          (linesOf(r[R.project]).length ? '<select data-f="line" aria-label="Стаття бюджету">' + lineOptions(r[R.project], r[R.line], "без статті") + '</select>' : "") +
          (side ? "" : '<select data-f="status" aria-label="Статус">' + [ST.plan, ST.ok, ST.paid].map(function (s) {
            return '<option' + (s === r[R.status] ? " selected" : "") + '>' + s + '</option>';
          }).join("") + '</select>') +
          (r[R.status] !== ST.paid || side ? '<button class="linkbtn danger" type="button" data-act="remove">вилучити</button>' : "") +
          '<button class="linkbtn" type="button" data-act="more">згорнути</button>';
      } else {
        h += '<button class="linkbtn" type="button" data-act="more">' + (isBonus(r[R.project]) ? "ще" : side ? "змінити ставку" : "змінити ставку, статтю, статус") + '</button>';
      }
      if (!S.noteOpen[id]) h += noteBtn(r);
      h += '</div>';
    } else if (canNote(r) && !S.noteOpen[id]) {
      h += '<div class="rowtools">' + noteBtn(r) + '</div>';
    }
    return h + '</div>';
  }

  // Коментар під рядком: текст, хто й коли; редагування — тим, хто вносить години в проєкті
  function noteBtn(r) { return '<button class="linkbtn" type="button" data-act="note">' + (r[R.note] ? "змінити коментар" : "коментар") + '</button>'; }
  function noteHtml(r) {
    var id = r[R.id];
    if (S.noteOpen[id]) {
      return '<div class="noteedit"><textarea data-n="note" maxlength="1000" rows="3" aria-label="Коментар: ' + esc(r[R.person]) + '" placeholder="Коментар до виплати">' + esc(r[R.note] || "") + '</textarea>' +
        '<div><button class="btn primary" type="button" data-act="notesave">Зберегти коментар</button> <button class="linkbtn" type="button" data-act="note">скасувати</button></div></div>';
    }
    if (!r[R.note]) return "";
    var when = r[R.noteAt] ? String(r[R.noteAt]).slice(8, 10) + "." + String(r[R.noteAt]).slice(5, 7) : "";
    return '<div class="note">' + esc(r[R.note]) + (r[R.noteBy] || when ? '<small> — ' + esc([r[R.noteBy], when].filter(String).join(", ")) + '</small>' : "") + '</div>';
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
      (isBonus(code) ? '<input type="hidden" data-add="hours" value="">' : '<input type="text" inputmode="decimal" placeholder="год" aria-label="Години" data-add="hours">') +
      '<input type="text" inputmode="decimal" placeholder="' + (isBonus(code) ? "грн" : "або грн") + '" aria-label="Гривні" data-add="sum">' +
      '<button class="btn" type="button" data-act="add">Додати</button></div>';
  }

  // ── Вкладка «Люди» ────────────────────────────────────
  function viewPeople() {
    var yr = rowsOf(function (r) { return r[R.year] === S.year; });
    if (S.person) {
      var pr = (S.mxOn ? liveRows() : D.rows).filter(function (r) { return r[R.year] === S.year && r[R.person] === S.person; });
      var pi = personInfo(S.person), extra = S.mxOn ? S.mxAdd["person|" + S.person] || [] : [];
      if (isExpense(S.person)) {
        var ecodes = {}; pr.forEach(function (r) { ecodes[r[R.project]] = 1; }); extra.forEach(function (c) { ecodes[c] = 1; });
        return '<div class="bar"><button class="btn" type="button" data-act="back">‹ Усі люди</button>' + yearSeg() + '</div>' +
          '<div class="block"><h2>' + esc(S.person) + ' <small>витрати · ' + S.year + ' рік, грн</small></h2>' + dirCard(S.person) + tilesWrap(byStatus(pr)) + mxBar("person", ecodes) +
          matrix(Object.keys(ecodes).sort(uk), function (c) { return pr.filter(function (r) { return r[R.project] === c; }); }, "Проєкт", "project", null, { edit: { person: S.person } }) + '</div>' + notesBlock(pr, "person");
      }
      var codes = {}; pr.forEach(function (r) { codes[r[R.project]] = 1; }); extra.forEach(function (c) { codes[c] = 1; });
      var hoursPer = new Array(12).fill(0), loadPer = new Array(12).fill(0);
      pr.forEach(function (r) { hoursPer[r[R.month] - 1] += r[R.hours] || 0; if (!isSide(r[R.project])) loadPer[r[R.month] - 1] += r[R.hours] || 0; });
      return '<div class="bar"><button class="btn" type="button" data-act="back">‹ Усі люди</button>' + yearSeg() + '</div>' +
        '<div class="block"><h2>' + esc(S.person) + ' <small>' + S.year + ' рік, грн</small>' +
        (mmText(pi) ? '<span class="mm">' + mmText(pi) + '</span>' : "") + '</h2>' + dirCard(S.person) +
        tilesWrap(byStatus(pr), true) + mxBar("person", codes) +
        matrix(Object.keys(codes).sort(function (a, b) { return (isSide(a) - isSide(b)) || uk(a, b); }),
          function (c) { return pr.filter(function (r) { return r[R.project] === c; }); }, "Проєкт", "project", sideTag,
          { rate: function (c) { return isSide(c) ? null : rateIn(S.person, c); }, mark: function (m, v) { return mmClass(pi, v); }, edit: { person: S.person },
            after: '<tr class="hours"><td>Годин</td><td></td>' + hoursPer.map(function (v) { return '<td class="' + (v ? "" : "z") + '">' + (v ? hrs(v) : "–") + '</td>'; }).join("") +
              '<td><b>' + hrs(hoursPer.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>' +
              '<tr class="hours"><td>Норма годин</td><td></td>' + hoursPer.map(function (v, i) { return '<td>' + norm(S.year, i + 1) + '</td>'; }).join("") + '<td>' + MSHORT.reduce(function (a, _, i) { return a + norm(S.year, i + 1); }, 0) + '</td></tr>' +
              '<tr class="hours"><td>Залучення</td><td></td>' + loadPer.map(function (v, i) { return loadCell(v, "", S.year, i + 1); }).join("") + '<td></td></tr>' }) +
        '<p class="legend" style="padding:6px 12px 0">Залучення — години в проєктах ЦППР ÷ норма годин місяця (робочі дні × 8); понад 100% — червоним. ' + (pr.some(function (r) { return r[R.kind] === "ЗП"; }) ? NET_NOTE : "") + '</p>' +
        (pi.min || pi.max ? '<p class="legend" style="padding:6px 12px 0"><span class="below">жовтим</span> — місяць нижче мінімального гонорару, <span class="above">червоним</span> — вище максимального. Ураховано заробіток на стороні, доплати від колег і виплати з інших періодів' + (seesOutRows() ? ", мінус передане колегам і внески — тобто отримано фактично" : "") + '.</p>' : "") +
'</div>' + notesBlock(pr, "person");
    }
    var tot = {};
    yr.forEach(function (r) { tot[r[R.person]] = (tot[r[R.person]] || 0) + (r[R.sum] || 0); });
    var q = S.q.toLowerCase(), ls = S.listSort.people;
    var key = function (n) { return ls === "sum" ? monthTotal(n, S.year, S.month) : ls === "load" ? monthHours(n, S.year, S.month) : 0; };
    if (hasDirs()) D.people.forEach(function (p) { if (p.active && !(p.name in tot) && S.fDir && S.fDir !== "-") tot[p.name] = 0; }); // людина напряму без виплат цього року — теж у списку
    var names = Object.keys(tot).filter(function (n) { return (!q || n.toLowerCase().indexOf(q) >= 0) && passDir(n); })
      .sort(function (a, b) { return (isExpense(a) - isExpense(b)) || (key(b) - key(a)) || uk(a, b); });
    return '<div class="bar">' + yearSeg() + listSortSeg("people", [["name", "за прізвищем"], ["sum", "за сумою"], ["load", "за залученням"]]) + '</div>' +
      (hasDirs() ? '<div class="filters">' + dirSelect() + (S.fDir ? '<button class="linkbtn" type="button" data-act="nodir">усі напрями</button>' : "") + '</div>' : "") +
      '<input class="pick" id="q" type="search" autocomplete="off" placeholder="Пошук за прізвищем" value="' + esc(S.q) + '" style="margin-bottom:12px">' +
      (names.length ? '<p class="legend">Сума за ' + MONTHS[S.month - 1].toLowerCase() + ' ' + S.year + ' (' + (seesOutRows() ? "отримано фактично: разом зі стороннім і доплатами, мінус передане колегам і внески" : "разом зі стороннім і доплатами") + '), % залучення (години ÷ ' + norm(S.year, S.month) + ' год норми місяця) і рамки гонорару «мін – макс». Клік — картка людини.</p>' +
        '<p class="legend keys"><span class="below">жовтим</span> — сума за місяць нижча за мінімальний гонорар · <span class="above">червоним</span> — вища за максимальний · <span class="over">червоний %</span> — залучення понад 100% · без кольору — у межах рамок або рамок не задано</p><div class="list">' + names.map(function (n) {
        var p = personInfo(n), v = monthTotal(n, S.year, S.month), c = mmClass(p, v);
        var lp = isExpense(n) ? 0 : loadPct(monthHours(n, S.year, S.month), S.year, S.month);
        return '<button class="item person" type="button" data-act="person" data-v="' + esc(n) + '"><b>' + esc(n) + '</b><span class="' + c + '">' + (v ? money(v) : "–") + '</span>' +
          (lp ? '<em class="' + (lp > 100 ? "over" : "") + '">' + lp + '%</em>' : "") + (isExpense(n) ? '<em>витрати</em>' : "") +
          (p.min || p.max ? '<small>' + (p.min ? money(p.min) : "–") + ' – ' + (p.max ? money(p.max) : "–") + '</small>' : "") +
          (hasDirs() && dirsOf(n).length ? '<span class="dirs">' + dirTags(n) + '</span>' : "") + '</button>';
      }).join("") + '</div>' + (hasDirs() && S.fDir ? '<p class="legend">У напрямі: ' + names.length + '. Сума за місяць — разом з усіма проєктами людини.</p>' : "") : '<div class="empty">Нікого не знайдено.</div>');
  }
  function personInfo(name) { return D.people.filter(function (p) { return p.name === name; })[0] || {}; }
  // Витрати (Офіс, Інтернет) — не люди: без ставки, годин, залучення і рамок гонорару
  function isExpense(name) { var p = personInfo(name); return !!p.expense || name === "Офіс" || name === "Інтернет"; }
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
  // ── Правка сум у картках ──────────────────────────────
  function mxKey(y, m, person, project) { return [y, m, person, project].join("|"); }
  function mxParse(k) { var a = k.split("|"); return { year: +a[0], month: +a[1], person: a[2], project: a.slice(3).join("|") }; }
  function mxRow(p) { return D.rows.filter(function (r) { return r[R.year] === p.year && r[R.month] === p.month && r[R.person] === p.person && r[R.project] === p.project; })[0]; }
  // Рядки з урахуванням незбережених сум (для підсумків, рамок гонорару й залучення в картці)
  function liveRows() {
    if (!Object.keys(mx).length) return D.rows;
    var seen = {}, out = D.rows.map(function (r) {
      var k = mxKey(r[R.year], r[R.month], r[R.person], r[R.project]);
      if (mx[k] === undefined || seen[k]) return r;
      seen[k] = 1;
      var c = r.slice(), v = String(mx[k]).trim() === "" ? 0 : parseNum(mx[k]);
      c[R.sum] = isFinite(v) ? v : 0;
      if (c[R.rate] && isFinite(v)) c[R.hours] = round2(v / c[R.rate]);
      return c;
    });
    var nid = -1;
    Object.keys(mx).forEach(function (k) {
      if (seen[k]) return;
      var p = mxParse(k), v = parseNum(mx[k]);
      if (!(v > 0)) return;
      var rate = isExpense(p.person) || isSide(p.project) ? null : rateIn(p.person, p.project) || personInfo(p.person).rate || null;
      out.push([nid--, p.year, p.month, p.person, p.project, rate, rate ? round2(v / rate) : null, v, ST.plan, "", "", "", "", "", ""]);
    });
    return out;
  }
  function canEditCell(person, project, r) { return r ? (r[R.id] < 0 ? canEditProject(project) : canEditRow(r)) : canEditProject(project); }
  function canMxAny() { return D.me.role !== "viewer" && (canAll() || mine().length > 0 || D.me.role === "board"); }
  function mxHoursText(sumV, rate) {
    if (!rate || !(sumV > 0)) return { t: "", frac: false };
    var h = round2(sumV / rate);
    return { t: hrs(h) + " год", frac: Math.abs(h - Math.round(h)) > 0.001 };
  }
  // Клітинка для правки: сума + години під нею (неціле число годин — помаранчевим)
  function mxCell(person, project, m, r) {
    var k = mxKey(S.year, m, person, project);
    if (!canEditCell(person, project, r)) {
      return '<td class="ro' + (r && r[R.status] === ST.paid ? " paid" : "") + '" title="' + (r && r[R.status] === ST.paid ? "Оплачено — змінює Інеса" : "Не ваш проєкт") + '">' + (r && r[R.sum] ? money(r[R.sum]) : "–") + '</td>';
    }
    var real = mxRow({ year: S.year, month: m, person: person, project: project });
    var orig = real ? sumStr(real[R.sum]) : "";
    var v = mx[k] !== undefined ? mx[k] : orig;
    var rate = isExpense(person) || isSide(project) ? null : (real && real[R.rate]) || rateIn(person, project) || personInfo(person).rate || null;
    var ht = mxHoursText(parseNum(v), rate);
    return '<td class="ed' + (mx[k] !== undefined ? " dirty" : "") + '"><input class="mx" type="text" inputmode="decimal" autocomplete="off" data-k="' + esc(k) + '" data-o="' + esc(orig) + '" data-rate="' + (rate || "") + '" value="' + esc(v) + '" aria-label="' + esc(person + ", " + project + ", " + MSHORT[m - 1]) + '">' +
      '<small class="mh' + (ht.frac ? " frac" : "") + '"' + (ht.frac ? ' title="Неціле число годин"' : "") + '>' + ht.t + '</small></td>';
  }
  function mxBar(kind, have) {
    if (!canMxAny()) return "";
    return '<div class="mxbar">' + (S.mxOn
      ? '<span>Правка сум: впишіть гривні — години рахуються за ставкою. ' + (canAll() ? "Можна й минулі, й оплачені місяці." : "Оплачене змінює Інеса.") + '</span>' + mxAddRow(kind, have || {}) + '<button class="btn primary" type="button" data-act="mxoff">✓ Готово</button>'
      : '<button class="btn edit" type="button" data-act="mxon">✎ Редагувати суми</button>') + '</div>';
  }
  function mxAddRow(kind, have) {
    var opts;
    if (kind === "person") opts = D.projects.filter(function (p) { return p.active && canEditProject(p.code) && !have[p.code]; }).map(function (p) { return p.code; });
    else opts = D.people.filter(function (p) { return p.active && !have[p.name]; }).map(function (p) { return p.name; });
    if (kind === "project" && !canEditProject(S.project)) return "";
    if (!opts.length) return "";
    return '<select class="mxadd" data-mxadd="' + kind + '" aria-label="Додати"><option value="">+ ' + (kind === "person" ? "додати проєкт" : "додати людину") + '…</option>' +
      opts.sort(uk).map(function (o) { return '<option>' + esc(o) + '</option>'; }).join("") + '</select>';
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
      var pr = (S.mxOn ? liveRows() : D.rows).filter(function (r) { return r[R.year] === S.year && r[R.project] === code; });
      var names = {}; pr.forEach(function (r) { names[r[R.person]] = 1; });
      if (S.mxOn) (S.mxAdd["project|" + code] || []).forEach(function (n) { names[n] = 1; });
      var h = '<div class="bar"><button class="btn" type="button" data-act="back">‹ Усі проєкти</button>' + yearSeg() + '</div>' +
        '<div class="block"><h2>' + esc(code) + sideTag(code) + (p.leads.length ? ' <small>керівник: ' + esc(p.leads.join(", ")) + '</small>' : "") +
        ' <small>' + S.year + ' рік, грн</small></h2>' + tilesWrap(byStatus(pr), true) + (canEditProject(code) || canAll() ? mxBar("project", names) : "") +
        matrix(Object.keys(names).sort(uk), function (n) { return pr.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person", null,
          { rate: function (n) { return isSide(code) || isExpense(n) ? null : rateIn(n, code); }, edit: { project: code } }) + '</div>' + notesBlock(pr, "project") + linesTable(code);
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
    var own = yr.filter(function (r) { return !isSide(r[R.project]); });
    var side = yr.filter(function (r) { return isSide(r[R.project]) && !isPrior(r[R.project]) && !isBonus(r[R.project]) && !isOut(r[R.project]); }), prior = yr.filter(function (r) { return isPrior(r[R.project]); });
    var bonus = yr.filter(function (r) { return isBonus(r[R.project]); }), bonusNames = {}; bonus.forEach(function (r) { bonusNames[r[R.person]] = 1; });
    var outs = yr.filter(function (r) { return isOut(r[R.project]); });
    var codes = {}; own.forEach(function (r) { codes[r[R.project]] = 1; });
    var sideNames = {}; side.forEach(function (r) { sideNames[r[R.person]] = 1; });
    var priorNames = {}; prior.forEach(function (r) { priorNames[r[R.person]] = 1; });
    var per = { paid: new Array(12).fill(0), ok: new Array(12).fill(0), plan: new Array(12).fill(0) };
    own.forEach(function (r) { per[ST_CLASS[r[R.status]] || "plan"][r[R.month] - 1] += r[R.sum] || 0; });
    function line(label, arr) {
      return '<tr><td>' + label + '</td>' + arr.map(function (v, i) { return cell(v, S.year, i + 1); }).join("") +
        '<td><b>' + money(arr.reduce(function (a, b) { return a + b; }, 0)) + '</b></td></tr>';
    }
    var overCodes = {}; own.forEach(function (r) { overCodes[r[R.project]] = 1; });
    // 25.11.2026 (1.10.1): «За проєктами» — останньою таблицею сторінки (для керівників цікавіше по людях)
    var projBlock = '<div class="block"><h2>За проєктами <small>' + S.year + ' рік, грн</small></h2>' +
      matrix(Object.keys(codes).sort(uk), function (c) { return own.filter(function (r) { return r[R.project] === c; }); }, "Проєкт", "project") + '</div>';
    return '<div class="bar">' + yearSeg() + '</div>' + filterBar(allYear) + tiles(byStatus(yr)) +
      (S.fPerson ? "" : '<div class="block"><h2>За людьми <small>' + S.year + ' рік, грн, через ЦППР</small></h2>' +
        matrix(Object.keys(own.reduce(function (o, r) { o[r[R.person]] = 1; return o; }, {})).sort(uk),
          function (n) { return own.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>') +
      loadBlock(own) +
      (prior.length ? '<div class="block"><h2>З інших періодів <small>виплати ЦППР за роботу в інших місяцях</small></h2>' +
        matrix(Object.keys(priorNames).sort(uk), function (n) { return prior.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>' : "") +
      (side.length ? '<div class="block"><h2>Зароблено на стороні <small>не через ЦППР</small></h2>' +
        matrix(Object.keys(sideNames).sort(uk), function (n) { return side.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>' : "") +
      (bonus.length ? '<div class="block"><h2>Доплати від колег <small>частина заробленого в проєктах, яку колеги перераховують; не через ЦППР</small></h2>' +
        matrix(Object.keys(bonusNames).sort(uk), function (n) { return bonus.filter(function (r) { return r[R.person] === n; }); }, "Людина", "person") + '</div>' : "") +
      outBlock(outs, bonus) +
      '<div class="block"><h2>Що оплачено і що попереду</h2><div class="tw"><table class="t"><thead><tr><th>Статус</th>' +
      MSHORT.map(function (m) { return '<th>' + m + '</th>'; }).join("") + '<th>Разом</th></tr></thead><tbody>' +
      line("Оплачено", per.paid) + line("Підтверджено", per.ok) + line("План", per.plan) + '</tbody></table></div></div>' +
      notesBlock(yr) + overBlock(Object.keys(overCodes).sort(uk)) + projBlock +
      '<p class="legend">Суми — виплати людям за місяцями, без інших витрат проєктів. ' + NET_NOTE + ' Клітинка з жовтим кутиком — є коментар (наведіть мишку або див. перелік «Коментарі»). Клік по заголовку стовпця — сортування.</p>';
  }

  // Передано колегам і внески: таблиця по людях і звірка (сума доплат за місяць має дорівнювати переданому колегам)
  function outBlock(outs, bonus) {
    if (!seesOutRows() || (!outs.length && !bonus.length)) return "";
    var lab = {}; // «Людина — що» → рядки
    outs.forEach(function (r) { var k = r[R.person] + " — " + ({ "передано": "передано", "витрати": "витрати" }[project(r[R.project]).out] || "внесок"); (lab[k] = lab[k] || []).push(r); });
    var tbl = outs.length ? matrix(Object.keys(lab).sort(uk), function (k) { return lab[k]; }, "Людина — що") : "";
    var miss = [];
    MSHORT.forEach(function (mn, i) {
      var b = bonus.filter(function (r) { return r[R.month] === i + 1; }).reduce(function (a, r) { return a + (r[R.sum] || 0); }, 0);
      var g = -outs.filter(function (r) { return r[R.month] === i + 1 && project(r[R.project]).out === "передано"; }).reduce(function (a, r) { return a + (r[R.sum] || 0); }, 0);
      if (Math.abs(b - g) > 0.5) miss.push(mn + ": доплати " + money(b) + ", передано колегам " + money(g));
    });
    return '<div class="block"><h2>Передано колегам, внески й витрати на ЦППР <small>віднімаються від суми людини; ведуться у файлі «Виплати»</small></h2>' +
      (miss.length ? '<p class="warnline">Доплати й передане колегам не збігаються — десь записано лише з одного боку. ' + miss.join(" · ") + '</p>' : (bonus.length ? '<p class="legend" style="padding:6px 12px 0">Доплати й передане колегам за кожен місяць збігаються.</p>' : "")) +
      (tbl || '<div class="empty">Переданого колегам і внесків за ' + S.year + ' рік не записано.</div>') + '</div>';
  }

  // Залучення людей за місяцями року
  function loadBlock(own) {
    var names = {}; own.forEach(function (r) { names[r[R.person]] = 1; });
    var list = Object.keys(names).filter(function (n) { return !isExpense(n); }).sort(uk);
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
      if (!tbl.tHead || tbl.classList.contains("mxt")) return; // у правці рядки не переставляємо
      tbl.setAttribute("data-key", tableKey(i));
      var s = S.sort[tableKey(i)];
      if (s) sortTable(tbl, s.col, s.dir);
    });
  }
  function onHeadClick(th) {
    var tbl = th.closest("table"), key = tbl.getAttribute("data-key"), col = th.cellIndex, cur = S.sort[key];
    if (tbl.classList.contains("mxt")) return;
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
  function nDirty() { return Object.keys(dirty).length + Object.keys(mx).length; }
  function saveBar() {
    var n = nDirty();
    $("savebar").hidden = !n;
    $("saveInfo").textContent = n ? (Object.keys(mx).length && !Object.keys(dirty).length ? "Змінено клітинок: " : "Змінено рядків: ") + n : "";
    $("saveBtn").disabled = busy;
  }
  var toastTimer = 0;
  function toast(msg, isErr) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 2600);
  }
  function leaveOk() { return !nDirty() || confirm("Є незбережені зміни. Продовжити без збереження?"); }

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
    return saveMonth().then(function (ok) { return ok ? saveMx() : false; });
  }
  // Зміни з картки людини чи проєкту: існуючий рядок — нова сума; порожня клітинка — новий рядок;
  // стерли суму — Інеса й адміни вилучають рядок (якщо не оплачений), інші ставлять 0
  function saveMx() {
    var keys = Object.keys(mx);
    if (!keys.length) return Promise.resolve(true);
    var rows = [], removeIds = [], bad = "";
    keys.forEach(function (k) {
      var p = mxParse(k), r = mxRow(p), v = String(mx[k]).trim(), n = v === "" ? 0 : parseNum(v);
      if (!(n >= 0)) { bad = p.person + ", " + p.project + ", " + MSHORT[p.month - 1] + ": сума має бути числом"; return; }
      if (r) {
        if (!n && canAll() && r[R.status] !== ST.paid) removeIds.push(r[R.id]);
        else rows.push({ id: r[R.id], sum: n });
      } else if (n) rows.push({ year: p.year, month: p.month, person: p.person, project: p.project, sum: n });
    });
    if (bad) { toast(bad, true); return Promise.resolve(false); }
    var chain = rows.length ? run(api("save", { rows: rows })) : Promise.resolve({ ok: true });
    return chain.then(function (res) {
      if (!res) return false;
      return removeIds.length ? run(api("remove", { ids: removeIds })) : res;
    }).then(function (res) {
      if (!res) return false;
      mx = {}; toast("Збережено"); render();
      return true;
    });
  }

  function saveMonth() {
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
    return run(api("save", { rows: rows }), Object.keys(mx).length ? "" : "Збережено").then(function (res) {
      if (!res) return false;
      dirty = {}; if (!Object.keys(mx).length) render();
      return true;
    });
  }

  // Ввід у клітинку картки: пам'ятаємо суму, години під клітинкою — одразу
  function mxInput(t) {
    var k = t.getAttribute("data-k"), v = t.value.trim(), o = t.getAttribute("data-o");
    if (v === o) delete mx[k]; else mx[k] = v;
    var ht = mxHoursText(parseNum(v), +t.getAttribute("data-rate") || 0), sm = t.parentNode.querySelector(".mh");
    if (sm) { sm.textContent = ht.t; sm.classList.toggle("frac", ht.frac); sm.title = ht.frac ? "Неціле число годин" : ""; }
    t.parentNode.classList.toggle("dirty", mx[k] !== undefined);
    saveBar();
  }
  // Після виходу з клітинки — перерахувати підсумки, не загубивши курсор і прокрутку
  function mxRerender() {
    setTimeout(function () {
      var a = document.activeElement, k = a && a.classList && a.classList.contains("mx") ? a.getAttribute("data-k") : null;
      var tw = document.querySelector("table.mxt") && document.querySelector("table.mxt").parentNode, sl = tw ? tw.scrollLeft : 0, sy = window.scrollY;
      render();
      var tw2 = document.querySelector("table.mxt") && document.querySelector("table.mxt").parentNode;
      if (tw2) tw2.scrollLeft = sl;
      window.scrollTo(0, sy);
      if (k) Array.prototype.forEach.call(document.querySelectorAll("input.mx"), function (el) { if (el.getAttribute("data-k") === k) { el.focus(); try { el.select(); } catch (x) {} } });
    }, 0);
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
      dirty = {}; mx = {}; S.open = {}; S.noteOpen = {}; S.month = m; S.year = y; render();
    } else if (act === "nofilter" || act === "mineonly") {
      if (!leaveOk()) return;
      dirty = {}; mx = {}; S.fProject = ""; S.fPerson = ""; S.fDir = ""; S.fLead = act === "mineonly" ? (D.me.lead || "") : ""; render();
    }
    else if (act === "nodir") { S.fDir = ""; render(); }
    else if (act === "diredit") { S.dirEdit = true; render(); }
    else if (act === "dircancel") { S.dirEdit = false; render(); }
    else if (act === "dirsave") {
      var chosen = Array.prototype.map.call(document.querySelectorAll(".dirbox input[data-dir]:checked"), function (el) { return el.getAttribute("data-dir"); });
      var who = S.person;
      run(api("setDirs", { person: who, dirs: chosen }), "Напрями збережено").then(function (res) {
        if (res) { var pi = personInfo(res.person); if (pi.name) pi.dirs = res.dirs; S.dirEdit = false; }
        render();
      });
    }
    else if (act === "year") { if (Object.keys(mx).length && !leaveOk()) return; mx = {}; S.mxAdd = {}; S.year = +b.getAttribute("data-y"); render(); }
    else if (act === "lsort") { S.listSort[b.getAttribute("data-l")] = v; render(); }
    else if (act === "person" || act === "project" || act === "back") {
      if (Object.keys(mx).length && !leaveOk()) return;
      mx = {}; S.mxOn = false; S.mxAdd = {};
      S.dirEdit = false;
      if (act === "person") { S.tab = "people"; S.person = v; } else if (act === "project") { S.tab = "projects"; S.project = v; } else { S.person = ""; S.project = ""; }
      render(); if (act !== "back") window.scrollTo(0, 0);
    }
    else if (act === "mxon") { S.mxOn = true; render(); }
    else if (act === "mxoff") {
      if (Object.keys(mx).length && !confirm("Є незбережені суми. Вийти з правки без збереження?")) return;
      mx = {}; S.mxOn = false; S.mxAdd = {}; render();
    }
    else if (act === "more") { var id = +b.closest(".row").getAttribute("data-id"); S.open[id] = !S.open[id]; render(); }
    else if (act === "note") { var nid = +b.closest(".row").getAttribute("data-id"); S.noteOpen[nid] = !S.noteOpen[nid]; render(); var ta = document.querySelector('.row[data-id="' + nid + '"] textarea'); if (ta) ta.focus(); }
    else if (act === "notesave") {
      var sid = +b.closest(".row").getAttribute("data-id"), txt = b.closest(".row").querySelector("textarea").value;
      run(api("note", { id: sid, note: txt }), "Коментар збережено").then(function (res) { if (res) delete S.noteOpen[sid]; render(); });
    }
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
    if (t.classList && t.classList.contains("mx")) { mxInput(t); return; }
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
    if (t.classList && t.classList.contains("mx")) { mxRerender(); return; }
    if (t.getAttribute("data-mxadd")) {
      var kk = t.getAttribute("data-mxadd") + "|" + (S.person || S.project);
      if (t.value) { S.mxAdd[kk] = (S.mxAdd[kk] || []).concat(t.value); render(); }
      return;
    }
    if (t.id === "fDir") { if (S.tab !== "people" && !leaveOk()) { render(); return; } if (S.tab !== "people") { dirty = {}; mx = {}; } S.fDir = t.value; render(); return; }
    if (t.id === "fLead" || t.id === "fProject" || t.id === "fPerson") {
      if (!leaveOk()) { render(); return; }
      dirty = {}; mx = {};
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
      if (e.key === "Enter" && c && c.contains("mx")) { e.preventDefault(); e.target.blur(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('nav.tabs button[role="tab"]'), function (b) {
      b.addEventListener("click", function () {
        if (!leaveOk()) return;
        dirty = {}; mx = {}; S.mxOn = false; S.mxAdd = {}; S.tab = b.getAttribute("data-tab"); S.person = ""; S.project = ""; render(); window.scrollTo(0, 0);
      });
    });
    $("saveBtn").addEventListener("click", function () { if (!busy) saveDirty(); });
    $("saveCancel").addEventListener("click", function () { dirty = {}; mx = {}; render(); });
    $("refresh").addEventListener("click", function () {
      if (!leaveOk()) return;
      dirty = {}; mx = {}; load();
    });
    $("logout").addEventListener("click", function () { signOut(); });
    window.addEventListener("beforeunload", function (e) { if (nDirty()) { e.preventDefault(); e.returnValue = ""; } });
    if (window.google && google.accounts) initGsi();
    if (token()) load(); else showGate();
  });
})();
