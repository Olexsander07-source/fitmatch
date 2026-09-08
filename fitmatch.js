import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// APLEX — SUPABASE
// =====================================================

const SUPABASE_URL = "https://ypbhcgcwkpiujcakvaji.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// СОСТОЯНИЕ
// =====================================================

let sports = [];
let coaches = [];
let currentUser = null;
let activeConversationId = null;
let activeMessagesChannel = null;

// =====================================================
// БЕЗОПАСНЫЙ HTML
// =====================================================

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

// Безопасная подстановка URL внутрь CSS background-image.
function escUrl(value) {
  return String(value ?? "").replace(/["'()\\]/g, (char) => "%" + char.charCodeAt(0).toString(16));
}

// =====================================================
// ИНИЦИАЛЫ
// =====================================================

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .map((word) => word[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// =====================================================
// ИЗОБРАЖЕНИЯ СПОРТА
// =====================================================

const SPORT_IMAGES = {
  bodybuilding: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85",
  fitness: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85",
  crossfit: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=85",
  running: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85",
  yoga: "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=85",
  swimming: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=85",
  cycling: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=85",
  tennis: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85",
  combat: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85",
  football: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85"
};

// =====================================================
// РЕЗЕРВНЫЕ ИЗОБРАЖЕНИЯ ТРЕНЕРОВ
// =====================================================

const COACH_IMAGES = [
  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1517838277536-f5f99be5010f?auto=format&fit=crop&w=900&q=85"
];

// =====================================================
// АЛИАСЫ СПОРТА
// =====================================================

const SPORT_ALIASES = {
  bodybuilding: "bodybuilding",
  "бодибилдинг": "bodybuilding",
  fitness: "fitness",
  "фитнес": "fitness",
  crossfit: "crossfit",
  "кроссфит": "crossfit",
  running: "running",
  "бег": "running",
  yoga: "yoga",
  "йога": "yoga",
  swimming: "swimming",
  "плавание": "swimming",
  cycling: "cycling",
  "велоспорт": "cycling",
  "велосипед": "cycling",
  tennis: "tennis",
  "теннис": "tennis",
  combat: "combat",
  boxing: "combat",
  mma: "combat",
  "бокс": "combat",
  "единоборства": "combat",
  football: "football",
  "футбол": "football"
};

// =====================================================
// НОРМАЛИЗАЦИЯ / КЛЮЧ СПОРТА
// =====================================================

function normalizeSport(value) {
  return String(value || "").trim().toLowerCase().replace(/ё/g, "е");
}

function getSportKey(value) {
  const raw = normalizeSport(value);
  if (!raw) return "fitness";
  if (SPORT_ALIASES[raw]) return SPORT_ALIASES[raw];

  if (raw.includes("бодибил") || raw.includes("bodybuild")) return "bodybuilding";
  if (raw.includes("фитнес") || raw.includes("fitness")) return "fitness";
  if (raw.includes("кросс") || raw.includes("crossfit")) return "crossfit";
  if (raw.includes("бег") || raw.includes("running")) return "running";
  if (raw.includes("йог") || raw.includes("yoga")) return "yoga";
  if (raw.includes("плав") || raw.includes("swimming")) return "swimming";
  if (raw.includes("вел") || raw.includes("cycling")) return "cycling";
  if (raw.includes("теннис") || raw.includes("tennis")) return "tennis";
  if (raw.includes("бокс") || raw.includes("boxing") || raw.includes("mma") || raw.includes("единобор")) return "combat";
  if (raw.includes("футбол") || raw.includes("football")) return "football";

  return "fitness";
}

function sportName(id) {
  const sport = sports.find((item) => String(item.id) === String(id));
  return sport ? sport.name : (id || "Не указан");
}

function getSportById(id) {
  return sports.find((sport) => String(sport.id) === String(id));
}

function sportKeyById(id) {
  const sport = getSportById(id);
  return sport ? getSportKey(sport.name) : getSportKey(id);
}

function getSportImage(sport) {
  let value = sport;
  if (sport && typeof sport === "object") {
    value = sport.name || sport.slug || sport.id;
  }
  const key = getSportKey(value);
  return SPORT_IMAGES[key] || SPORT_IMAGES.fitness;
}

function getCoachImage(coach) {
  if (coach?.image_url && String(coach.image_url).trim()) return coach.image_url;
  if (coach?.avatar_url && String(coach.avatar_url).trim()) return coach.avatar_url;

  const id = String(coach?.id || "0");
  let number = 0;
  for (let i = 0; i < id.length; i++) number += id.charCodeAt(i);

  return COACH_IMAGES[number % COACH_IMAGES.length];
}

// =====================================================
// СЧЁТ (SCORE) ТРЕНЕРА
// =====================================================

function computeScore(coach) {
  const raw = Number(coach?.score);
  if (Number.isFinite(raw) && raw > 0) return raw;

  const rating = Number(coach?.rating) || 0;
  const verifiedBonus = coach?.verified ? 5 : 0;

  return Math.round(rating * 10 + verifiedBonus);
}

// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {
  const price = Number(coach?.price);
  if (!Number.isFinite(price) || price <= 0) return "Цена по запросу";
  return `€${price} / ${coach.period || "месяц"}`;
}

// =====================================================
// ПОКАЗ СТРАНИЦЫ
// =====================================================

function showPage(id) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));

  const page = document.getElementById(id);
  if (page) page.classList.add("active");

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === id);
  });

  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.remove("mobile-open");

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Уходя со страницы сообщений — отписываемся от realtime-канала
  // и сбрасываем открытый диалог, чтобы не копить подписки в фоне.
  if (id !== "messages" && activeMessagesChannel) {
    supabase.removeChannel(activeMessagesChannel);
    activeMessagesChannel = null;
    activeConversationId = null;

    const thread = document.getElementById("chatThread");
    if (thread) thread.innerHTML = `<p class="empty">Выберите диалог слева.</p>`;

    document.getElementById("messagesLayout")?.classList.remove("thread-open");
  }

  if (id === "bookings") loadBookingsPage();
  if (id === "messages") loadConversations();
}

// =====================================================
// МОДАЛЬНОЕ ОКНО
// =====================================================

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.toggle("show", show);

  const anyModalOpen = document.querySelector(".modal.show");
  document.body.classList.toggle("modal-open", Boolean(anyModalOpen));
}

// =====================================================
// СООБЩЕНИЯ (статусы форм)
// =====================================================

function showMessage(id, text, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = text;
  element.className = isError ? "error" : "success";
}

// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================

async function loadData() {
  const sportsResult = await supabase.from("sports").select("*").order("name", { ascending: true });

  if (sportsResult.error) {
    console.error("Ошибка загрузки спорта:", sportsResult.error);
    throw sportsResult.error;
  }

  sports = sportsResult.data || [];
  renderSports();

  const coachesResult = await supabase.from("coaches").select("*");

  if (coachesResult.error) {
    console.error("Ошибка загрузки тренеров:", coachesResult.error);
    coaches = [];
  } else {
    coaches = coachesResult.data || [];
    coaches.sort((a, b) => computeScore(b) - computeScore(a));
  }

  renderCoaches();
  renderTopCoaches();
  renderRanking();
  populateGoals();
}

// =====================================================
// КАРТОЧКА СПОРТА
// =====================================================

function createSportCard(sport) {
  const card = document.createElement("article");
  card.className = "sport-card";

  const image = getSportImage(sport);
  card.style.backgroundImage = `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.58)), url("${escUrl(image)}")`;

  card.innerHTML = `
    <div class="sport-card-content">
      <div class="sport-icon">${esc(sport.icon || "🏅")}</div>
      <h3>${esc(sport.name)}</h3>
      <p>Найти тренера →</p>
    </div>
  `;

  card.addEventListener("click", () => {
    showPage("coaches");

    const filter = document.getElementById("sportFilter");
    if (filter) filter.value = String(sport.id);

    renderCoaches();
  });

  return card;
}

// =====================================================
// СПОРТЫ
// =====================================================

function renderSports() {
  ["homeSports", "sportsList"].forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.replaceChildren(...sports.map(createSportCard));
  });

  const selectDefaults = {
    sportFilter: "Все виды спорта",
    matchSport: "Не выбрано",
    coachSport: "Выберите вид спорта"
  };

  Object.entries(selectDefaults).forEach(([id, defaultLabel]) => {
    const select = document.getElementById(id);
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = `<option value="">${defaultLabel}</option>`;

    sports.forEach((sport) => select.add(new Option(sport.name, sport.id)));

    const exists = Array.from(select.options).some((option) => option.value === previousValue);
    if (exists) select.value = previousValue;
  });
}

// =====================================================
// КАРТОЧКА ТРЕНЕРА
// =====================================================

function createCoachCard(coach) {
  const card = document.createElement("article");
  card.className = "coach-card";

  const image = getCoachImage(coach);
  const sport = getSportById(coach.sport);

  card.innerHTML = `
    <div class="coach-image">
      <img src="${esc(image)}" alt="${esc(coach.name || "Тренер")}" loading="lazy">
    </div>

    <div class="coach-content">
      <div class="coach-score">${computeScore(coach)}</div>

      <h3>${esc(coach.name || "Тренер")}</h3>

      <p class="coach-sport">
        ${esc(sport?.icon || "")} ${esc(sport?.name || sportName(coach.sport))}
      </p>

      <div class="tags">
        ${coach.goal ? `<span class="tag">${esc(coach.goal)}</span>` : ""}
        ${coach.format ? `<span class="tag">${esc(coach.format)}</span>` : ""}
        ${coach.verified ? `<span class="tag">✓ Проверен</span>` : ""}
      </div>

      <div class="card-footer">
        <span>⭐ ${Number(coach.rating || 0).toFixed(1)}</span>
        <span>${esc(priceText(coach))}</span>
      </div>
    </div>
  `;

  card.addEventListener("click", () => openProfile(coach.id));

  return card;
}

// =====================================================
// ТРЕНЕРЫ (СПИСОК С ФИЛЬТРАМИ)
// =====================================================

function renderCoaches() {
  const sportFilter = document.getElementById("sportFilter");
  const formatFilter = document.getElementById("formatFilter");
  const searchInput = document.getElementById("searchInput");
  const container = document.getElementById("coachesList");
  if (!container) return;

  const sportValue = sportFilter?.value || "";
  const formatValue = formatFilter?.value || "";
  const search = normalizeSport(searchInput?.value || "");

  const filtered = coaches.filter((coach) => {
    const matchesSport = !sportValue || String(coach.sport) === String(sportValue);
    const matchesFormat = !formatValue || coach.format === formatValue;

    const sportText = sportName(coach.sport);
    const haystack = normalizeSport(
      [coach.name, coach.goal, coach.bio, coach.format, sportText].filter(Boolean).join(" ")
    );
    const matchesSearch = !search || haystack.includes(search);

    return matchesSport && matchesFormat && matchesSearch;
  });

  container.replaceChildren(...filtered.map(createCoachCard));

  if (!filtered.length) {
    container.innerHTML = `<p class="empty">Тренеры по этим параметрам пока не найдены.</p>`;
  }

  updateCategoryBanner();
}

// =====================================================
// ТОП ТРЕНЕРОВ
// =====================================================

function renderTopCoaches() {
  const container = document.getElementById("topCoaches");
  if (!container) return;

  const top = [...coaches].sort((a, b) => computeScore(b) - computeScore(a)).slice(0, 3);

  container.replaceChildren(...top.map(createCoachCard));

  if (!top.length) {
    container.innerHTML = `<p class="empty">Пока нет зарегистрированных тренеров.</p>`;
  }
}

// =====================================================
// РЕЙТИНГ
// =====================================================

function renderRanking() {
  const container = document.getElementById("rankingList");
  if (!container) return;

  const ranked = [...coaches].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));

  if (!ranked.length) {
    container.innerHTML = `<p class="empty">Рейтинг появится, когда появятся тренеры.</p>`;
    return;
  }

  container.innerHTML = ranked
    .map(
      (coach, index) => `
        <article class="ranking-item">
          <div class="ranking-position">${index + 1}</div>
          <div>
            <strong>${esc(coach.name || "Тренер")}</strong>
            <p>${esc(sportName(coach.sport))}</p>
          </div>
          <div>⭐ ${Number(coach.rating || 0).toFixed(1)}</div>
        </article>
      `
    )
    .join("");
}

// =====================================================
// ЦЕЛИ ДЛЯ MATCH
// =====================================================

function populateGoals() {
  const select = document.getElementById("matchGoal");
  if (!select) return;

  const goals = Array.from(new Set(coaches.map((coach) => coach.goal).filter(Boolean)));

  select.innerHTML = `<option value="">Любая цель</option>`;
  goals.forEach((goal) => select.add(new Option(goal, goal)));
}

// =====================================================
// MATCH (ПОДБОР ТРЕНЕРА)
// =====================================================

function findMatch() {
  const sport = document.getElementById("matchSport")?.value || "";
  const goal = document.getElementById("matchGoal")?.value || "";
  const format = document.getElementById("matchFormat")?.value || "";
  const container = document.getElementById("matchResults");
  if (!container) return;

  let results = coaches.map((coach) => {
    let score = 0;
    if (sport && String(coach.sport) === String(sport)) score += 3;
    if (goal && normalizeSport(coach.goal).includes(normalizeSport(goal))) score += 2;
    if (format && coach.format === format) score += 1;
    return { coach, score };
  });

  const noFiltersSelected = !sport && !goal && !format;

  results = results
    .filter((item) => noFiltersSelected || item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.coach.rating || 0) - Number(a.coach.rating || 0))
    .slice(0, 5);

  container.replaceChildren(...results.map((item) => createCoachCard(item.coach)));

  if (!results.length) {
    container.innerHTML = `<p class="empty">Подходящих тренеров пока не найдено.</p>`;
  }
}

// =====================================================
// КАТЕГОРИЙНЫЙ БАННЕР
// =====================================================

function updateCategoryBanner() {
  const filter = document.getElementById("sportFilter");
  const banner = document.getElementById("categoryBanner");
  if (!filter || !banner) return;

  if (!filter.value) {
    banner.style.display = "none";
    return;
  }

  const sport = getSportById(filter.value);
  if (!sport) {
    banner.style.display = "none";
    return;
  }

  const image = getSportImage(sport);
  const title = document.getElementById("categoryBannerTitle");
  const subtitle = document.getElementById("categoryBannerSubtitle");
  const stats = document.getElementById("categoryBannerStats");

  banner.style.display = "block";
  banner.style.backgroundImage = `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.7)), url("${escUrl(image)}")`;

  if (title) title.textContent = sport.name;
  if (subtitle) subtitle.textContent = `Найдите тренера по направлению ${sport.name}.`;

  if (stats) {
    const count = coaches.filter((coach) => String(coach.sport) === String(sport.id)).length;
    stats.innerHTML = `
      <div class="category-banner-stat">${count} тренеров</div>
      <div class="category-banner-stat">APLEX</div>
      <div class="category-banner-stat">Find your level.</div>
    `;
  }
}

// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

function openProfile(id) {
  const coach = coaches.find((item) => String(item.id) === String(id));
  if (!coach) return;

  const container = document.getElementById("profileContent");
  if (!container) return;

  const image = getCoachImage(coach);
  const isOwnProfile = Boolean(currentUser && coach.user_id === currentUser.id);

  container.innerHTML = `
    <article class="coach-profile">
      <div class="coach-profile-image">
        <img src="${esc(image)}" alt="${esc(coach.name || "Тренер")}">
      </div>

      <div class="coach-profile-info">
        <p class="eyebrow">APLEX</p>
        <h1>${esc(coach.name || "Тренер")}</h1>
        <p>${esc(sportName(coach.sport))}</p>
        <p>${esc(coach.goal || "")}</p>
        <p>${esc(coach.format || "")}</p>
        <p>⭐ ${Number(coach.rating || 0).toFixed(1)}</p>
        <p>${esc(priceText(coach))}</p>
        <p>${esc(coach.bio || "Описание пока не добавлено.")}</p>

        <button id="backToCoaches" class="btn" type="button">← К ТРЕНЕРАМ</button>

        ${
          isOwnProfile
            ? `<p class="empty" style="margin-top:24px">Это ваш собственный профиль тренера.</p>`
            : `
              <div class="profile-actions">
                <button id="chatWithCoachBtn" class="btn btn-primary" type="button">💬 НАПИСАТЬ ТРЕНЕРУ</button>
              </div>

              <div class="booking-box">
                <h3>Забронировать тренировку</h3>

                <form id="bookingForm" class="form">
                  <label>
                    Дата
                    <input type="date" name="date" required min="${todayIso()}">
                  </label>

                  <label>
                    Время
                    <select name="time" required>
                      <option value="">Выберите время</option>
                      ${generateTimeSlotOptions()}
                    </select>
                  </label>

                  <label>
                    Ваше имя
                    <input type="text" name="clientName" required value="${esc(displayNameFromUser(currentUser))}">
                  </label>

                  <label>
                    Telegram или телефон (необязательно)
                    <input type="text" name="clientContact" placeholder="@username или +33...">
                  </label>

                  <label>
                    Комментарий
                    <textarea name="note" rows="3" placeholder="Например: хочу утреннюю тренировку"></textarea>
                  </label>

                  <button class="btn btn-primary" type="submit">ОТПРАВИТЬ ЗАЯВКУ</button>

                  <div id="bookingMessage" aria-live="polite"></div>
                </form>
              </div>
            `
        }
      </div>
    </article>
  `;

  document.getElementById("backToCoaches")?.addEventListener("click", () => showPage("coaches"));

  if (!isOwnProfile) {
    document.getElementById("chatWithCoachBtn")?.addEventListener("click", () => startChatWithCoach(coach));
    initBookingForm(coach);
  }

  showPage("profile");
}

// =====================================================
// БРОНИРОВАНИЕ — ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function generateTimeSlotOptions() {
  const options = [];
  for (let hour = 8; hour <= 20; hour++) {
    const value = `${String(hour).padStart(2, "0")}:00`;
    options.push(`<option value="${value}">${value}</option>`);
  }
  return options.join("");
}

const BOOKING_STATUS_LABELS = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждено",
  completed: "Проведено",
  cancelled: "Отменено"
};

// =====================================================
// ФОРМА БРОНИРОВАНИЯ (на странице профиля тренера)
// =====================================================

function initBookingForm(coach) {
  const form = document.getElementById("bookingForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      toggleModal("modal", true);
      return;
    }

    const data = new FormData(form);

    const payload = {
      coach_id: String(coach.id),
      coach_user_id: coach.user_id,
      coach_name: coach.name || "Тренер",
      client_id: currentUser.id,
      client_name: String(data.get("clientName") || "").trim(),
      client_contact: String(data.get("clientContact") || "").trim() || null,
      booking_date: data.get("date"),
      booking_time: data.get("time"),
      note: String(data.get("note") || "").trim() || null
    };

    if (!payload.client_name) {
      showMessage("bookingMessage", "Введите ваше имя.", true);
      return;
    }

    if (!payload.booking_date || !payload.booking_time) {
      showMessage("bookingMessage", "Выберите дату и время.", true);
      return;
    }

    const message = document.getElementById("bookingMessage");
    if (message) message.textContent = "Отправляем заявку...";

    const result = await supabase.from("bookings").insert(payload);

    if (result.error) {
      showMessage("bookingMessage", result.error.message, true);
      return;
    }

    showMessage("bookingMessage", "Заявка отправлена! Тренер свяжется с вами для подтверждения.");
    form.reset();
  });
}

// =====================================================
// СТРАНИЦА «МОИ БРОНИРОВАНИЯ»
// =====================================================

async function loadBookingsPage() {
  const clientContainer = document.getElementById("clientBookingsList");
  const coachSection = document.getElementById("bookingsAsCoachSection");

  if (!currentUser) {
    if (clientContainer) {
      clientContainer.innerHTML = `<p class="empty">Войдите, чтобы увидеть свои бронирования.</p>`;
    }
    if (coachSection) coachSection.style.display = "none";
    return;
  }

  const clientResult = await supabase
    .from("bookings")
    .select("*")
    .eq("client_id", currentUser.id)
    .order("booking_date", { ascending: true });

  renderClientBookings(clientResult.data || [], clientResult.error);

  const isCoach = coaches.some((coach) => coach.user_id === currentUser.id);

  if (!coachSection) return;

  if (!isCoach) {
    coachSection.style.display = "none";
    return;
  }

  coachSection.style.display = "block";

  const coachResult = await supabase
    .from("bookings")
    .select("*")
    .eq("coach_user_id", currentUser.id)
    .order("booking_date", { ascending: true });

  renderCoachBookings(coachResult.data || [], coachResult.error);
}

function renderClientBookings(bookings, error) {
  const container = document.getElementById("clientBookingsList");
  if (!container) return;

  if (error) {
    container.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    return;
  }

  if (!bookings.length) {
    container.innerHTML = `<p class="empty">У вас пока нет бронирований.</p>`;
    return;
  }

  container.innerHTML = bookings
    .map(
      (booking) => `
        <article class="booking-card">
          <div>
            <strong>${esc(booking.coach_name)}</strong>
            <p>${esc(booking.booking_date)} в ${esc(booking.booking_time)}</p>
            ${booking.note ? `<p class="booking-note">${esc(booking.note)}</p>` : ""}
          </div>

          <div class="booking-status-row">
            <span class="badge badge-${esc(booking.status)}">${esc(BOOKING_STATUS_LABELS[booking.status] || booking.status)}</span>

            ${
              booking.status === "pending" || booking.status === "confirmed"
                ? `<button class="btn" type="button" data-cancel-booking="${esc(booking.id)}">Отменить</button>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  container.querySelectorAll("[data-cancel-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingStatus(button.dataset.cancelBooking, "cancelled", loadBookingsPage);
    });
  });
}

function renderCoachBookings(bookings, error) {
  const container = document.getElementById("coachBookingsList");
  if (!container) return;

  if (error) {
    container.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    return;
  }

  if (!bookings.length) {
    container.innerHTML = `<p class="empty">Заявок на бронирование пока нет.</p>`;
    return;
  }

  container.innerHTML = bookings
    .map(
      (booking) => `
        <article class="booking-card">
          <div>
            <strong>${esc(booking.client_name)}</strong>
            <p>${esc(booking.booking_date)} в ${esc(booking.booking_time)}</p>
            ${booking.client_contact ? `<p>Контакт: ${esc(booking.client_contact)}</p>` : ""}
            ${booking.note ? `<p class="booking-note">${esc(booking.note)}</p>` : ""}
          </div>

          <div class="booking-status-row">
            <span class="badge badge-${esc(booking.status)}">${esc(BOOKING_STATUS_LABELS[booking.status] || booking.status)}</span>

            ${
              booking.status === "pending"
                ? `
                  <button class="btn btn-primary" type="button" data-confirm-booking="${esc(booking.id)}">Подтвердить</button>
                  <button class="btn" type="button" data-cancel-booking="${esc(booking.id)}">Отклонить</button>
                `
                : booking.status === "confirmed"
                ? `
                  <button class="btn btn-primary" type="button" data-complete-booking="${esc(booking.id)}">Отметить как проведено</button>
                  <button class="btn" type="button" data-cancel-booking="${esc(booking.id)}">Отменить</button>
                `
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  container.querySelectorAll("[data-confirm-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingStatus(button.dataset.confirmBooking, "confirmed", loadBookingsPage);
    });
  });

  container.querySelectorAll("[data-complete-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingStatus(button.dataset.completeBooking, "completed", loadBookingsPage);
    });
  });

  container.querySelectorAll("[data-cancel-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingStatus(button.dataset.cancelBooking, "cancelled", loadBookingsPage);
    });
  });
}

async function updateBookingStatus(id, status, onDone) {
  const result = await supabase.from("bookings").update({ status }).eq("id", id);

  if (result.error) {
    alert(result.error.message);
    return;
  }

  if (onDone) onDone();
}

// =====================================================
// СООБЩЕНИЯ / ЧАТ
// =====================================================

function displayNameFromUser(user) {
  return user?.email?.split("@")[0] || "Пользователь";
}

async function startChatWithCoach(coach) {
  if (!currentUser) {
    toggleModal("modal", true);
    return;
  }

  if (coach.user_id === currentUser.id) return;

  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", currentUser.id)
    .eq("coach_user_id", coach.user_id)
    .maybeSingle();

  let conversationId = existing.data?.id;

  if (!conversationId) {
    const created = await supabase
      .from("conversations")
      .insert({
        client_id: currentUser.id,
        client_name: displayNameFromUser(currentUser),
        coach_user_id: coach.user_id,
        coach_id: String(coach.id),
        coach_name: coach.name || "Тренер"
      })
      .select("id")
      .single();

    if (created.error) {
      // На случай гонки (диалог уже создан параллельно, например в другой вкладке)
      const retry = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", currentUser.id)
        .eq("coach_user_id", coach.user_id)
        .maybeSingle();

      if (!retry.data?.id) {
        alert(created.error.message);
        return;
      }

      conversationId = retry.data.id;
    } else {
      conversationId = created.data.id;
    }
  }

  showPage("messages");
  await loadConversations();
  openConversation(conversationId);
}

async function loadConversations() {
  const container = document.getElementById("conversationsList");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<p class="empty">Войдите, чтобы увидеть сообщения.</p>`;
    return;
  }

  const result = await supabase
    .from("conversations")
    .select("*")
    .or(`client_id.eq.${currentUser.id},coach_user_id.eq.${currentUser.id}`)
    .order("last_message_at", { ascending: false });

  if (result.error) {
    container.innerHTML = `<p class="error">${esc(result.error.message)}</p>`;
    return;
  }

  const list = result.data || [];

  if (!list.length) {
    container.innerHTML = `<p class="empty">Пока нет диалогов. Напишите тренеру с его страницы профиля.</p>`;
    return;
  }

  container.innerHTML = list
    .map((conversation) => {
      const isClient = conversation.client_id === currentUser.id;
      const otherName = isClient ? conversation.coach_name : conversation.client_name;

      return `
        <button
          class="conversation-item ${conversation.id === activeConversationId ? "active" : ""}"
          type="button"
          data-conversation-id="${esc(conversation.id)}"
        >
          <strong>${esc(otherName)}</strong>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-conversation-id]").forEach((button) => {
    button.addEventListener("click", () => openConversation(button.dataset.conversationId));
  });
}

async function openConversation(conversationId) {
  activeConversationId = conversationId;

  document.querySelectorAll("#conversationsList .conversation-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.conversationId === conversationId);
  });

  const thread = document.getElementById("chatThread");
  if (!thread) return;

  thread.innerHTML = `
    <div class="chat-thread-header">
      <button id="backToConversations" class="btn chat-back-btn" type="button">← Диалоги</button>
    </div>

    <div id="chatMessages" class="chat-messages"></div>

    <form id="chatForm" class="chat-form">
      <input id="chatInput" type="text" placeholder="Напишите сообщение..." autocomplete="off" required>
      <button class="btn btn-primary" type="submit">Отправить</button>
    </form>
  `;

  document.getElementById("messagesLayout")?.classList.add("thread-open");

  document.getElementById("backToConversations")?.addEventListener("click", () => {
    document.getElementById("messagesLayout")?.classList.remove("thread-open");
  });

  document.getElementById("chatForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = document.getElementById("chatInput");
    const content = input.value.trim();
    if (!content) return;

    input.value = "";
    await sendMessage(conversationId, content);
  });

  await loadMessages(conversationId);
  subscribeToMessages(conversationId);
}

async function loadMessages(conversationId) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const result = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (result.error) {
    container.innerHTML = `<p class="error">${esc(result.error.message)}</p>`;
    return;
  }

  container.innerHTML = (result.data || []).map(renderMessageBubble).join("");
  container.scrollTop = container.scrollHeight;
}

function renderMessageBubble(message) {
  const mine = message.sender_id === currentUser?.id;

  return `
    <div class="chat-bubble ${mine ? "mine" : "theirs"}">
      ${!mine ? `<span class="chat-sender">${esc(message.sender_name)}</span>` : ""}
      <p>${esc(message.content)}</p>
    </div>
  `;
}

function subscribeToMessages(conversationId) {
  if (activeMessagesChannel) {
    supabase.removeChannel(activeMessagesChannel);
    activeMessagesChannel = null;
  }

  activeMessagesChannel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        if (payload.new.sender_id === currentUser?.id) return;

        const container = document.getElementById("chatMessages");
        if (!container) return;

        container.insertAdjacentHTML("beforeend", renderMessageBubble(payload.new));
        container.scrollTop = container.scrollHeight;
      }
    )
    .subscribe();
}

async function sendMessage(conversationId, content) {
  const senderName = displayNameFromUser(currentUser);

  const container = document.getElementById("chatMessages");
  if (container) {
    container.insertAdjacentHTML(
      "beforeend",
      renderMessageBubble({ sender_id: currentUser.id, sender_name: senderName, content })
    );
    container.scrollTop = container.scrollHeight;
  }

  const result = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: currentUser.id,
    sender_name: senderName,
    content
  });

  if (result.error) {
    alert(result.error.message);
  }
}

// =====================================================
// НАВИГАЦИЯ
// =====================================================

function initNavigation() {
  document.getElementById("logo")?.addEventListener("click", () => showPage("home"));

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.nav));
  });

  document.getElementById("matchBtn")?.addEventListener("click", () => showPage("match"));
  document.getElementById("chooseSportBtn")?.addEventListener("click", () => showPage("sports"));
}

// =====================================================
// ФИЛЬТРЫ
// =====================================================

function initFilters() {
  document.getElementById("sportFilter")?.addEventListener("change", renderCoaches);
  document.getElementById("formatFilter")?.addEventListener("change", renderCoaches);
  document.getElementById("searchInput")?.addEventListener("input", renderCoaches);
  document.getElementById("findMatchBtn")?.addEventListener("click", findMatch);

  document.getElementById("cyclingBannerCta")?.addEventListener("click", () => {
    document.getElementById("coachesList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// =====================================================
// МОБИЛЬНОЕ МЕНЮ
// =====================================================

function initMobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("mainNav");
  if (!hamburger || !nav) return;

  hamburger.addEventListener("click", () => {
    nav.classList.toggle("mobile-open");
    hamburger.setAttribute("aria-expanded", nav.classList.contains("mobile-open") ? "true" : "false");
  });
}

// =====================================================
// МОДАЛЬНЫЕ ОКНА (закрытие)
// =====================================================

function initModals() {
  const closers = [
    ["authClose", "modal"],
    ["modalCancel", "modal"],
    ["coachClose", "coachModal"],
    ["coachCancel", "coachModal"],
    ["resetClose", "resetPasswordModal"],
    ["resetCancel", "resetPasswordModal"]
  ];

  closers.forEach(([buttonId, modalId]) => {
    document.getElementById(buttonId)?.addEventListener("click", () => toggleModal(modalId, false));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) toggleModal(modal.id, false);
    });
  });
}

// =====================================================
// КНОПКА ВХОДА (только вход/выход)
// =====================================================

function initAuthButton() {
  document.getElementById("authBtn")?.addEventListener("click", async () => {
    if (currentUser) {
      const result = await supabase.auth.signOut();
      if (result.error) alert(result.error.message);
      return;
    }

    toggleModal("modal", true);
  });
}

// =====================================================
// СТАТЬ ТРЕНЕРОМ / СВОЙ ПРОФИЛЬ ТРЕНЕРА
// =====================================================

function initCreateCoach() {
  document.getElementById("createBtn")?.addEventListener("click", () => {
    if (!currentUser) {
      toggleModal("modal", true);
      return;
    }

    toggleModal("coachModal", true);

    const select = document.getElementById("coachSport");
    if (select && !select.options.length) renderSports();
  });
}

// =====================================================
// ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function refreshUser() {
  const result = await supabase.auth.getUser();
  currentUser = result.data?.user || null;

  const authBtn = document.getElementById("authBtn");
  const createBtn = document.getElementById("createBtn");

  if (authBtn) authBtn.textContent = currentUser ? "Выйти" : "Войти";
  if (createBtn) createBtn.textContent = currentUser ? "Мой профиль тренера" : "Стать тренером";
}

// =====================================================
// ВХОД
// =====================================================

function initAuthForm() {
  const form = document.getElementById("authForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value;

    const message = document.getElementById("authMessage");
    if (message) message.textContent = "Выполняется вход...";

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      showMessage("authMessage", result.error.message, true);
      return;
    }

    showMessage("authMessage", "Добро пожаловать в APLEX.");
    await refreshUser();

    setTimeout(() => toggleModal("modal", false), 400);
  });

  document.getElementById("signupBtn")?.addEventListener("click", () => {
    toggleModal("modal", false);
    document.getElementById("signupSection")?.scrollIntoView({ behavior: "smooth" });
  });
}

// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

function initSignup() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    showMessage("signupMessage", "Создаём аккаунт...");

    const result = await supabase.auth.signUp({ email, password });

    if (result.error) {
      showMessage("signupMessage", result.error.message, true);
      return;
    }

    showMessage("signupMessage", "Аккаунт создан. Проверьте email для подтверждения.");
    form.reset();
  });
}

// =====================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// =====================================================

function initForgotPassword() {
  document.getElementById("forgotPasswordBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail")?.value.trim();

    if (!email) {
      showMessage("authMessage", "Введите email.", true);
      return;
    }

    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (result.error) {
      showMessage("authMessage", result.error.message, true);
      return;
    }

    showMessage("authMessage", "Письмо для восстановления пароля отправлено.");
  });
}

// =====================================================
// НОВЫЙ ПАРОЛЬ
// =====================================================

function initResetPassword() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("newPassword")?.value;
    const confirm = document.getElementById("confirmPassword")?.value;

    if (password !== confirm) {
      showMessage("resetMessage", "Пароли не совпадают.", true);
      return;
    }

    const result = await supabase.auth.updateUser({ password });

    if (result.error) {
      showMessage("resetMessage", result.error.message, true);
      return;
    }

    showMessage("resetMessage", "Пароль успешно изменён.");
    setTimeout(() => toggleModal("resetPasswordModal", false), 700);
  });
}

// =====================================================
// РЕЖИМ ВОССТАНОВЛЕНИЯ (запасной вариант)
// =====================================================

function checkRecoveryMode() {
  if (window.location.hash.includes("type=recovery")) {
    toggleModal("resetPasswordModal", true);
  }
}

// =====================================================
// СОЗДАНИЕ / ОБНОВЛЕНИЕ ПРОФИЛЯ ТРЕНЕРА
// =====================================================

function initCoachForm() {
  const form = document.getElementById("createForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      toggleModal("coachModal", false);
      toggleModal("modal", true);
      return;
    }

    const data = new FormData(form);

    const payload = {
      user_id: currentUser.id,
      name: String(data.get("name") || "").trim(),
      sport: data.get("sport"),
      goal: String(data.get("goal") || "").trim(),
      format: data.get("format"),
      price: Number(data.get("price")),
      period: data.get("period"),
      bio: String(data.get("bio") || "").trim()
    };

    if (!payload.name) {
      showMessage("coachMessage", "Введите имя.", true);
      return;
    }

    if (!payload.sport) {
      showMessage("coachMessage", "Выберите вид спорта.", true);
      return;
    }

    if (!Number.isFinite(payload.price)) {
      showMessage("coachMessage", "Введите корректную цену.", true);
      return;
    }

    const message = document.getElementById("coachMessage");
    if (message) message.textContent = "Сохраняем профиль...";

    const existing = await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (existing.error) {
      showMessage("coachMessage", existing.error.message, true);
      return;
    }

    const result = existing.data
      ? await supabase.from("coaches").update(payload).eq("id", existing.data.id)
      : await supabase.from("coaches").insert(payload);

    if (result.error) {
      showMessage("coachMessage", result.error.message, true);
      return;
    }

    showMessage("coachMessage", "Профиль тренера успешно сохранён.");
    await loadData();

    setTimeout(() => {
      toggleModal("coachModal", false);
      form.reset();
      showPage("coaches");
    }, 700);
  });
}

// =====================================================
// СОСТОЯНИЕ АВТОРИЗАЦИИ
// =====================================================

function initAuthState() {
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    refreshUser();

    if (event === "PASSWORD_RECOVERY") {
      toggleModal("resetPasswordModal", true);
    }
  });
}

// =====================================================
// HERO SLIDESHOW
// =====================================================

function initHeroSlideshow() {
  const hero = document.getElementById("heroSlideshow");
  if (!hero) return;

  const images = Object.values(SPORT_IMAGES);
  if (!images.length) return;

  let index = 0;

  function showImage() {
    hero.style.backgroundImage = `url("${escUrl(images[index])}")`;
    index = (index + 1) % images.length;
  }

  showImage();
  setInterval(showImage, 7000);
}

// =====================================================
// ЗАПУСК
// =====================================================

async function init() {
  initNavigation();
  initFilters();
  initModals();
  initMobileMenu();
  initAuthButton();
  initAuthForm();
  initSignup();
  initForgotPassword();
  initResetPassword();
  initCreateCoach();
  initCoachForm();
  initAuthState();
  checkRecoveryMode();
  initHeroSlideshow();

  try {
    await refreshUser();
    await loadData();
  } catch (error) {
    console.error("APLEX ERROR:", error);

    const container = document.getElementById("coachesList");
    if (container) {
      container.innerHTML = `<p class="error">Ошибка подключения к Supabase. ${esc(error.message || String(error))}</p>`;
    }
  }
}

init();
