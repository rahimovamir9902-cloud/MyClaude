/* ==========================================================================
   ДомПлюс — логика сайта: каталог, фильтры, избранное, заявки, отзывы
   Данные хранятся в localStorage, работает без бэкенда.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var LISTINGS = window.LISTINGS || [];
  var BRANCHES = window.BRANCHES || [];

  var LS_FAV = "domplus_favorites";
  var LS_REVIEWS = "domplus_reviews";

  var state = { filter: "all", city: "", type: "", deal: "" };

  /* ---------- Хранилище ---------- */
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var favorites = load(LS_FAV, []);
  var reviews = load(LS_REVIEWS, null) || (window.REVIEWS || []).slice();

  /* ---------- Утилиты ---------- */
  function fmtPrice(item) {
    var n = item.price.toLocaleString("ru-RU");
    return item.deal === "rent"
      ? { main: n + " ₽", note: "/ мес" }
      : { main: n + " ₽", note: "" };
  }
  function dealLabel(deal) { return deal === "rent" ? "Аренда" : "Продажа"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isFav(id) { return favorites.indexOf(id) !== -1; }

  /* Плейсхолдер-изображение объекта (SVG вместо внешних картинок) */
  function media(item) {
    var c = item.color || "#4f8cff";
    var houseIcon = item.type === "house"
      ? '<path d="M120 210 210 140 300 210v70H120z" fill="#fff" opacity=".9"/>' +
        '<rect x="196" y="222" width="34" height="58" fill="' + c + '"/>'
      : '<rect x="120" y="150" width="180" height="130" rx="6" fill="#fff" opacity=".9"/>' +
        '<g fill="' + c + '" opacity=".85">' +
        '<rect x="140" y="170" width="30" height="30"/><rect x="185" y="170" width="30" height="30"/>' +
        '<rect x="230" y="170" width="30" height="30"/><rect x="140" y="215" width="30" height="30"/>' +
        '<rect x="185" y="215" width="30" height="30"/><rect x="230" y="215" width="30" height="30"/></g>';
    return (
      '<svg viewBox="0 0 420 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(item.title) + '">' +
      '<rect width="420" height="300" fill="' + c + '"/>' +
      '<rect width="420" height="300" fill="url(#sheen)"/>' +
      '<defs><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>' +
      '<stop offset="1" stop-color="#000000" stop-opacity=".12"/></linearGradient></defs>' +
      houseIcon +
      "</svg>"
    );
  }

  /* ---------- Рендер каталога ---------- */
  function matches(item) {
    if (state.city && item.city !== state.city) return false;
    if (state.type && item.type !== state.type) return false;
    if (state.deal && item.deal !== state.deal) return false;
    switch (state.filter) {
      case "apartment": return item.type === "apartment";
      case "house": return item.type === "house";
      case "sale": return item.deal === "sale";
      case "rent": return item.deal === "rent";
      case "fav": return isFav(item.id);
      default: return true;
    }
  }

  function cardHTML(item) {
    var p = fmtPrice(item);
    var feats = (item.features || []).slice(0, 3)
      .map(function (f) { return '<span>' + esc(f) + "</span>"; }).join("");
    var tag = item.tag ? '<span class="card__tag">' + esc(item.tag) + "</span>" : "";
    return (
      '<article class="card" data-id="' + item.id + '">' +
      '<div class="card__media">' + media(item) + tag +
      '<span class="card__deal">' + dealLabel(item.deal) + "</span>" +
      '<button class="card__fav' + (isFav(item.id) ? " is-active" : "") +
      '" data-fav="' + item.id + '" aria-label="В избранное">♥</button>' +
      "</div>" +
      '<div class="card__body">' +
      '<div class="card__price">' + p.main +
      (p.note ? ' <small>' + p.note + "</small>" : "") + "</div>" +
      '<h3 class="card__title">' + esc(item.title) + "</h3>" +
      '<div class="card__loc">📍 ' + esc(item.city) + ", " + esc(item.district) + "</div>" +
      '<div class="card__params">' +
      "<span><b>" + item.rooms + "</b> комн.</span>" +
      "<span><b>" + item.area + "</b> м²</span>" +
      "<span>" + esc(item.floor) + "</span>" +
      "<span>" + item.year + " г.</span>" +
      "</div>" +
      '<div class="card__features">' + feats + "</div>" +
      '<div class="card__actions">' +
      '<button class="btn btn--primary" data-buy="' + item.id + '">Купить</button>' +
      '<button class="btn btn--outline" data-info="' + item.id + '">Подробнее</button>' +
      "</div></div></article>"
    );
  }

  function renderCatalog() {
    var grid = $("#grid");
    var list = LISTINGS.filter(matches);
    grid.innerHTML = list.map(cardHTML).join("");
    $("#emptyState").hidden = list.length !== 0;
    $("#catalogCount").textContent =
      "Найдено объектов: " + list.length +
      (state.filter === "fav" ? " · избранное" : "");
    updateFavCount();
  }

  function updateFavCount() { $("#favCount").textContent = favorites.length; }

  /* ---------- Фильтры ---------- */
  function initFilters() {
    // Города в выпадающем списке
    var cities = [];
    LISTINGS.forEach(function (i) { if (cities.indexOf(i.city) === -1) cities.push(i.city); });
    var sel = $("#fCity");
    cities.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c; sel.appendChild(o);
    });

    $("#searchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      state.city = $("#fCity").value;
      state.type = $("#fType").value;
      state.deal = $("#fDeal").value;
      // сбрасываем чип-фильтр, чтобы поиск не конфликтовал
      state.filter = "all";
      setActiveChip("all");
      renderCatalog();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });

    $("#chips").addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      state.filter = btn.getAttribute("data-filter");
      setActiveChip(state.filter);
      renderCatalog();
    });
  }

  function setActiveChip(f) {
    $$(".chip").forEach(function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-filter") === f);
    });
  }

  /* ---------- Клики по каталогу ---------- */
  function initCatalogEvents() {
    $("#grid").addEventListener("click", function (e) {
      var favBtn = e.target.closest("[data-fav]");
      if (favBtn) { toggleFav(parseInt(favBtn.getAttribute("data-fav"), 10)); return; }

      var buyBtn = e.target.closest("[data-buy]");
      if (buyBtn) { openRequestForItem(parseInt(buyBtn.getAttribute("data-buy"), 10)); return; }

      var infoBtn = e.target.closest("[data-info]");
      if (infoBtn) { openInfo(parseInt(infoBtn.getAttribute("data-info"), 10)); return; }
    });

    $("#favLink").addEventListener("click", function (e) {
      e.preventDefault();
      state.filter = "fav"; setActiveChip("fav"); renderCatalog();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });
  }

  function toggleFav(id) {
    var idx = favorites.indexOf(id);
    if (idx === -1) { favorites.push(id); toast("Добавлено в избранное ♥"); }
    else { favorites.splice(idx, 1); toast("Удалено из избранного"); }
    save(LS_FAV, favorites);
    // перерисуем текущий вид (важно для фильтра «избранное»)
    renderCatalog();
  }

  function findItem(id) {
    for (var i = 0; i < LISTINGS.length; i++) if (LISTINGS[i].id === id) return LISTINGS[i];
    return null;
  }

  function openInfo(id) {
    var it = findItem(id);
    if (!it) return;
    var p = fmtPrice(it);
    var params = it.rooms + " комн. · " + it.area + " м² · " + it.floor + " · " + it.year + " г.";
    toast(it.title + " — " + p.main + (p.note ? " " + p.note : ""));
    // Открываем заявку с подробностями объекта
    openModal({
      title: "Записаться на просмотр",
      object: it.title + " · " + esc(it.city) + ", " + esc(it.address) +
        "\n" + params + "\n" + it.description,
    });
  }

  /* ---------- Модальное окно заявки ---------- */
  var modal = null;
  function openRequestForItem(id) {
    var it = findItem(id);
    if (!it) return;
    var p = fmtPrice(it);
    openModal({
      title: it.deal === "rent" ? "Заявка на аренду" : "Заявка на покупку",
      object: it.title + " — " + p.main + (p.note ? " " + p.note : "") +
        " · " + it.city + ", " + it.address,
    });
  }

  function openModal(opts) {
    opts = opts || {};
    $("#modalTitle").textContent = opts.title || "Оставить заявку";
    var objEl = $("#modalObject");
    if (opts.object) { objEl.textContent = opts.object; objEl.hidden = false; }
    else { objEl.hidden = true; }
    $("#requestForm").hidden = false;
    $("#requestForm").reset();
    $("#modalSuccess").hidden = true;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { $("#reqName").focus(); }, 40);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function initModal() {
    modal = $("#modal");
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    $$("[data-open-request]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openModal({ title: btn.getAttribute("data-open-request") });
      });
    });

    $("#requestForm").addEventListener("submit", function (e) {
      e.preventDefault();
      // Демо: заявка «отправляется» — сохраняем локально
      var reqs = load("domplus_requests", []);
      reqs.push({
        name: $("#reqName").value,
        phone: $("#reqPhone").value,
        comment: $("#reqComment").value,
        object: $("#modalObject").hidden ? "" : $("#modalObject").textContent,
        at: new Date().toISOString(),
      });
      save("domplus_requests", reqs);
      $("#requestForm").hidden = true;
      $("#modalObject").hidden = true;
      $("#modalSuccess").hidden = false;
    });
  }

  /* ---------- Филиалы ---------- */
  function renderBranches() {
    $("#branches-grid").innerHTML = BRANCHES.map(function (b) {
      return (
        '<div class="branch">' +
        '<div class="branch__city">' + esc(b.city) + "</div>" +
        '<div class="branch__name">' + esc(b.name) + "</div>" +
        '<div class="branch__row"><span>📍</span><span>' + esc(b.address) + "</span></div>" +
        '<div class="branch__row"><span>🚇</span><span>' + esc(b.metro) + "</span></div>" +
        '<div class="branch__row"><span>🕘</span><span>' + esc(b.hours) + "</span></div>" +
        '<a class="branch__phone" href="tel:' + b.phone.replace(/[^+\d]/g, "") + '">' + esc(b.phone) + "</a>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------- Отзывы ---------- */
  var AVA_COLORS = ["#4f8cff", "#22b07d", "#f0913b", "#8b5cf6", "#e35d6a", "#0ea5a0"];
  function avaColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return AVA_COLORS[sum % AVA_COLORS.length];
  }
  function stars(n) {
    n = Math.max(1, Math.min(5, n | 0));
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  }

  function renderReviews() {
    $("#reviews-grid").innerHTML = reviews.map(function (r) {
      var initials = (r.name || "?").trim().charAt(0).toUpperCase();
      return (
        '<div class="review">' +
        '<div class="review__top">' +
        '<div class="review__ava" style="background:' + avaColor(r.name || "?") + '">' + esc(initials) + "</div>" +
        "<div>" +
        '<div class="review__name">' + esc(r.name) + "</div>" +
        '<div class="review__meta">' + esc(r.city || "") + "</div>" +
        "</div></div>" +
        '<div class="review__stars">' + stars(r.rating) + "</div>" +
        '<p class="review__text">' + esc(r.text) + "</p>" +
        '<div class="review__date">' + esc(r.date || "") + "</div>" +
        "</div>"
      );
    }).join("");

    var avg = reviews.length
      ? (reviews.reduce(function (s, r) { return s + (+r.rating || 0); }, 0) / reviews.length)
      : 0;
    $("#reviewsSummary").textContent =
      reviews.length
        ? "Средняя оценка " + avg.toFixed(1) + " из 5 · " + reviews.length + " отзыв(а/ов)"
        : "Пока нет отзывов — станьте первым!";
  }

  function initReviews() {
    var form = $("#reviewForm");
    $("#addReviewBtn").addEventListener("click", function () {
      form.hidden = !form.hidden;
      if (!form.hidden) $("#rName").focus();
    });
    $("#cancelReview").addEventListener("click", function () { form.hidden = true; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new Date();
      var review = {
        name: $("#rName").value.trim(),
        city: $("#rCity").value.trim(),
        rating: +$("#rRating").value,
        text: $("#rText").value.trim(),
        date: ("0" + d.getDate()).slice(-2) + "." +
              ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(),
      };
      if (!review.name || !review.text) return;
      reviews.unshift(review);
      save(LS_REVIEWS, reviews);
      form.reset();
      form.hidden = true;
      renderReviews();
      toast("Спасибо за ваш отзыв!");
      document.getElementById("reviews").scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ---------- Меню (мобильное) ---------- */
  function initMenu() {
    var burger = $("#burger");
    var nav = $("#nav");
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("#nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Тост-уведомления ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 2400);
  }

  /* ---------- Инициализация ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initFilters();
    initCatalogEvents();
    initModal();
    initReviews();
    initMenu();
    renderCatalog();
    renderBranches();
    renderReviews();
  });
})();
