import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// FITMATCH — SUPABASE
// =====================================================

const SUPABASE_URL = "https://ypbhcgcwkpiujcakvaji.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// =====================================================
// СОСТОЯНИЕ
// =====================================================

let sports = [];
let coaches = [];
let currentUser = null;


// =====================================================
// БЕЗОПАСНЫЙ HTML
// =====================================================

function esc(value) {

  return String(value ?? "").replace(/[&<>"']/g, function (char) {

    const chars = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return chars[char];

  });

}


// =====================================================
// ИНИЦИАЛЫ
// =====================================================

function initials(name) {

  return String(name || "")
    .trim()
    .split(/\s+/)
    .map(function (word) {
      return word[0] || "";
    })
    .slice(0, 2)
    .join("")
    .toUpperCase();

}


// =====================================================
// НАЗВАНИЕ СПОРТА
// =====================================================

function sportName(id) {

  const sport = sports.find(function (item) {

    return String(item.id) === String(id);

  });

  return sport
    ? sport.name
    : (id || "Не указан");

}


// =====================================================
// ИЗОБРАЖЕНИЯ СПОРТА
// =====================================================

const SPORT_IMAGES = {

  bodybuilding:
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85",

  fitness:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85",

  crossfit:
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=85",

  running:
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85",

  yoga:
    "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=85",

  swimming:
    "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=85",

  cycling:
    "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=85",

  tennis:
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85",

  combat:
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85",

  football:
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85"

};


// =====================================================
// ИЗОБРАЖЕНИЯ ТРЕНЕРОВ
// =====================================================

const COACH_IMAGES = [

  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1550345332-09e3ac987658?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85"

];


// =====================================================
// АЛИАСЫ СПОРТА
// =====================================================

const CATEGORY_ALIASES = {

  boxing: "combat",
  mma: "combat",
  martialarts: "combat",
  martial_arts: "combat",

  bodybuilding: "bodybuilding",

  fitness: "fitness",

  crossfit: "crossfit",

  running: "running",

  yoga: "yoga",

  swimming: "swimming",

  cycling: "cycling",

  tennis: "tennis",

  football: "football"

};


// =====================================================
// ВИЗУАЛЫ КАТЕГОРИЙ
// =====================================================

const CATEGORY_VISUALS = {

  bodybuilding: {

    word1: "",
    word2: "БОДИБИЛДИНГ",

    subtitle:
      "Мышечная масса, сила и рельеф под руководством тренера",

    stats: [
      "Сила",
      "Масса",
      "Рельеф"
    ],

    icon: `
      <circle cx="145" cy="60" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M145 80
        C120 110 105 145 110 200
        M145 95
        C185 105 215 130 230 170
        M145 100
        C130 130 130 160 140 210
        M140 210
        L105 245
        M145 210
        L190 245"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  fitness: {

    word1: "",
    word2: "ФИТНЕС",

    subtitle:
      "Сила, здоровье и хорошая физическая форма",

    stats: [
      "Форма",
      "Сила",
      "Здоровье"
    ],

    icon: `
      <circle cx="150" cy="55" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 75
        L150 145
        L105 210
        M150 145
        L205 210
        M150 100
        L100 135
        M150 100
        L210 130"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  crossfit: {

    word1: "",
    word2: "КРОССФИТ",

    subtitle:
      "Функциональная сила и высокая физическая подготовка",

    stats: [
      "Сила",
      "Скорость",
      "Выносливость"
    ],

    icon: `
      <circle cx="150" cy="55" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 75
        L160 140
        L115 200
        M160 140
        L220 180
        M150 95
        L95 125
        M150 95
        L220 115"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  running: {

    word1: "",
    word2: "БЕГ",

    subtitle:
      "Тренировки на скорость, дыхание и технику бега",

    stats: [
      "Выносливость",
      "Скорость",
      "Прогресс"
    ],

    icon: `
      <circle cx="150" cy="55" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 74
        L165 140
        L110 200
        M165 140
        L235 175
        M165 140
        L135 95
        L225 85"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>

      <path
        d="M100 230 H150"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>
    `

  },


  yoga: {

    word1: "",
    word2: "ЙОГА",

    subtitle:
      "Гибкость, баланс, контроль тела и спокойствие",

    stats: [
      "Гибкость",
      "Баланс",
      "Контроль"
    ],

    icon: `
      <circle cx="150" cy="55" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 75
        C125 115 110 155 90 210
        M150 110
        L210 150
        M150 110
        L100 150
        M90 210
        H220"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  swimming: {

    word1: "",
    word2: "ПЛАВАНИЕ",

    subtitle:
      "Техника, скорость и уверенность в воде",

    stats: [
      "Техника",
      "Скорость",
      "Выносливость"
    ],

    icon: `
      <circle cx="145" cy="75" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M110 130
        C145 105 185 115 220 145"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>

      <path
        d="M80 190
        Q110 170 140 190
        T200 190
        T260 190"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>
    `

  },


  cycling: {

    word1: "",
    word2: "ВЕЛОСПОРТ",

    subtitle:
      "Скорость, техника и выносливость на велосипеде",

    stats: [
      "Скорость",
      "Техника",
      "Выносливость"
    ],

    icon: `
      <circle cx="100" cy="205" r="40"
        stroke="currentColor"
        stroke-width="6"/>

      <circle cx="230" cy="205" r="40"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M100 205
        L145 130
        L190 205
        L230 205
        M145 130
        L190 130
        L230 205"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  tennis: {

    word1: "",
    word2: "ТЕННИС",

    subtitle:
      "Техника ударов, движение и игровая стратегия",

    stats: [
      "Техника",
      "Скорость",
      "Тактика"
    ],

    icon: `
      <ellipse
        cx="150"
        cy="110"
        rx="45"
        ry="65"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M180 165
        L220 230"
        stroke="currentColor"
        stroke-width="10"
        stroke-linecap="round"/>

      <circle
        cx="240"
        cy="80"
        r="18"
        stroke="currentColor"
        stroke-width="6"/>
    `

  },


  combat: {

    word1: "",
    word2: "ЕДИНОБОРСТВА",

    subtitle:
      "Сила, техника, дисциплина и боевые навыки",

    stats: [
      "Техника",
      "Сила",
      "Скорость"
    ],

    icon: `
      <circle cx="150" cy="55" r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 75
        L155 140
        L100 180
        M155 140
        L225 115
        M155 140
        L205 205
        M155 140
        L105 220"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `

  },


  football: {

    word1: "",
    word2: "ФУТБОЛ",

    subtitle:
      "Техника, скорость и физическая подготовка",

    stats: [
      "Техника",
      "Скорость",
      "Тактика"
    ],

    icon: `
      <circle
        cx="150"
        cy="150"
        r="70"
        stroke="currentColor"
        stroke-width="6"/>

      <path
        d="M150 110
        L175 135
        L165 170
        L135 170
        L125 135
        Z"
        stroke="currentColor"
        stroke-width="6"
        stroke-linejoin="round"/>
    `

  }

};


// =====================================================
// ПОЛУЧИТЬ КЛЮЧ КАТЕГОРИИ
// =====================================================

function normalizeSport(value) {

  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");

}


function resolveCategoryKey(sportId, sportTitle = "") {

  const id = normalizeSport(sportId);
  const title = normalizeSport(sportTitle);

  if (CATEGORY_ALIASES[id]) {
    return CATEGORY_ALIASES[id];
  }

  if (CATEGORY_ALIASES[title]) {
    return CATEGORY_ALIASES[title];
  }

  if (
    title.includes("бодибил")
  ) {
    return "bodybuilding";
  }

  if (
    title.includes("фитнес")
  ) {
    return "fitness";
  }

  if (
    title.includes("кроссф")
  ) {
    return "crossfit";
  }

  if (
    title.includes("бег")
  ) {
    return "running";
  }

  if (
    title.includes("йог")
  ) {
    return "yoga";
  }

  if (
    title.includes("плав")
  ) {
    return "swimming";
  }

  if (
    title.includes("вел")
  ) {
    return "cycling";
  }

  if (
    title.includes("теннис")
  ) {
    return "tennis";
  }

  if (
    title.includes("единобор") ||
    title.includes("бокс") ||
    title.includes("mma")
  ) {
    return "combat";
  }

  if (
    title.includes("футбол")
  ) {
    return "football";
  }

  return id;

}


// =====================================================
// ИЗОБРАЖЕНИЕ СПОРТА
// =====================================================

function getSportImage(name, id = "") {

  const key = resolveCategoryKey(id, name);

  return SPORT_IMAGES[key]
    || SPORT_IMAGES.fitness;

}


// =====================================================
// ВИЗУАЛ КАТЕГОРИИ
// =====================================================

function getCategoryVisual(sportId) {

  const sport = sports.find(function (item) {

    return String(item.id) === String(sportId);

  });

  const key = resolveCategoryKey(

    sportId,

    sport ? sport.name : ""

  );

  return CATEGORY_VISUALS[key] || null;

}


// =====================================================
// ИЗОБРАЖЕНИЕ ТРЕНЕРА
// =====================================================

function getCoachImage(coach) {

  if (coach.image_url) {
    return coach.image_url;
  }

  if (coach.image) {
    return coach.image;
  }

  const id = String(coach.id || "");

  let hash = 0;

  for (let i = 0; i < id.length; i++) {

    hash += id.charCodeAt(i);

  }

  return COACH_IMAGES[
    Math.abs(hash) % COACH_IMAGES.length
  ];

}


// =====================================================
// СООБЩЕНИЯ
// =====================================================

function showMessage(id, message, isError = false) {

  const element =
    document.getElementById(id);

  if (!element) return;

  element.className =
    isError
      ? "error"
      : "success";

  element.textContent = message;

}


// =====================================================
// МОДАЛЬНОЕ ОКНО
// =====================================================

function toggleModal(id, show) {

  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.toggle(
    "show",
    Boolean(show)
  );

}


// =====================================================
// СТРАНИЦЫ
// =====================================================

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(function (page) {

      page.classList.remove("active");

    });


  const page =
    document.getElementById(pageId);

  if (page) {

    page.classList.add("active");

  }


  const nav =
    document.getElementById("mainNav");

  if (nav) {

    nav.classList.remove("mobile-open");

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================

async function loadSports() {

  const response =
    await supabase
      .from("sports")
      .select("*");

  if (response.error) {

    throw response.error;

  }

  sports = response.data || [];

}


async function loadCoaches() {

  const response =
    await supabase
      .from("coaches")
      .select("*");

  if (response.error) {

    throw response.error;

  }

  coaches = response.data || [];

}


async function loadData() {

  await Promise.all([
    loadSports(),
    loadCoaches()
  ]);

  renderSports();
  renderCoaches();
  renderTopCoaches();
  renderRanking();

}


// =====================================================
// КАРТОЧКА СПОРТА
// =====================================================

function createSportCard(sport) {

  const card =
    document.createElement("article");

  card.className =
    "sport-card";

  card.style.backgroundImage =
    `url("${getSportImage(
      sport.name,
      sport.id
    )}")`;


  const title =
    document.createElement("b");

  title.textContent =
    sport.name;


  const text =
    document.createElement("p");

  text.textContent =
    "Найти тренера →";


  card.append(
    title,
    text
  );


  card.addEventListener(
    "click",
    function () {

      showPage("coaches");

      const filter =
        document.getElementById(
          "sportFilter"
        );

      if (filter) {

        filter.value =
          String(sport.id);

      }

      renderCoaches();

    }
  );


  return card;

}


// =====================================================
// КАРТОЧКА ТРЕНЕРА
// =====================================================

function createCoachCard(coach) {

  const card =
    document.createElement("article");

  card.className =
    "coach-card";


  const image =
    document.createElement("img");

  image.className =
    "coach-image";

  image.src =
    getCoachImage(coach);

  image.alt =
    coach.name
      ? `Тренер ${coach.name}`
      : "Тренер";

  image.loading = "lazy";


  const score =
    document.createElement("div");

  score.className =
    "coach-score";

  score.textContent =
    Number(
      coach.score || 0
    );


  const avatar =
    document.createElement("div");

  avatar.className =
    "coach-avatar";

  avatar.textContent =
    initials(coach.name);


  const name =
    document.createElement("h3");

  name.textContent =
    coach.name || "Тренер";


  const info =
    document.createElement("p");

  info.className =
    "lead";

  info.textContent =
    sportName(coach.sport);


  const tags =
    document.createElement("div");

  tags.className =
    "tags";


  if (coach.goal) {

    const tag =
      document.createElement("span");

    tag.className = "tag";

    tag.textContent =
      coach.goal;

    tags.appendChild(tag);

  }


  if (coach.format) {

    const tag =
      document.createElement("span");

    tag.className = "tag";

    tag.textContent =
      coach.format;

    tags.appendChild(tag);

  }


  const footer =
    document.createElement("div");

  footer.className =
    "card-footer";


  const rating =
    Number(
      coach.rating || 0
    );


  const priceText =
    coach.price !== null &&
    coach.price !== undefined

      ? `${coach.price} € / ${
          coach.period || "занятие"
        }`

      : "Цена не указана";


  footer.innerHTML = `

    <span>
      ⭐ ${rating.toFixed(1)}
    </span>

    <span>
      ${esc(priceText)}
    </span>

  `;


  card.append(
    image,
    score,
    avatar,
    name,
    info,
    tags,
    footer
  );


  card.addEventListener(
    "click",
    function () {

      openProfile(coach.id);

    }
  );


  return card;

}


// =====================================================
// РЕНДЕР СПОРТА
// =====================================================

function renderSports() {

  const containers = [
    "homeSports",
    "sportsList"
  ];


  containers.forEach(
    function (id) {

      const container =
        document.getElementById(id);

      if (!container) return;

      container.replaceChildren(
        ...sports.map(
          createSportCard
        )
      );

    }
  );


  const selects = [
    "sportFilter",
    "matchSport",
    "coachSport"
  ];


  selects.forEach(
    function (id) {

      const select =
        document.getElementById(id);

      if (!select) return;


      const previousValue =
        select.value;


      if (id === "sportFilter") {

        select.innerHTML =
          `<option value="">
            Все виды спорта
          </option>`;

      }


      if (id === "matchSport") {

        select.innerHTML =
          `<option value="">
            Не выбрано
          </option>`;

      }


      if (id === "coachSport") {

        select.innerHTML =
          `<option value="">
            Выбрать спорт
          </option>`;

      }


      sports.forEach(
        function (sport) {

          select.add(
            new Option(
              sport.name,
              sport.id
            )
          );

        }
      );


      if (
        [...select.options].some(
          function (option) {

            return option.value ===
              previousValue;

          }
        )
      ) {

        select.value =
          previousValue;

      }

    }
  );

}


// =====================================================
// БАННЕР КАТЕГОРИИ
// =====================================================

function updateCategoryBanner() {

  const sportFilter =
    document.getElementById(
      "sportFilter"
    );


  const banner =
    document.getElementById(
      "categoryBanner"
    );


  if (
    !sportFilter ||
    !banner
  ) return;


  if (!sportFilter.value) {

    banner.style.display =
      "none";

    return;

  }


  const visual =
    getCategoryVisual(
      sportFilter.value
    );


  if (!visual) {

    banner.style.display =
      "none";

    return;

  }


  const sport =
    sports.find(function (item) {

      return String(item.id) ===
        String(sportFilter.value);

    });


  const image =
    getSportImage(
      sport ? sport.name : "",
      sport ? sport.id : ""
    );


  banner.style.backgroundImage =
    `url("${image}")`;


  const graphic =
    document.getElementById(
      "categoryBannerGraphic"
    );

  if (graphic) {

    graphic.innerHTML =
      visual.icon;

  }


  const title =
    document.getElementById(
      "categoryBannerTitle"
    );

  if (title) {

    title.innerHTML =

      (
        visual.word1
          ? esc(visual.word1) +
            "<br>"
          : ""
      )

      +

      `<em>${esc(
        visual.word2
      )}</em>`;

  }


  const subtitle =
    document.getElementById(
      "categoryBannerSubtitle"
    );

  if (subtitle) {

    subtitle.textContent =
      visual.subtitle;

  }


  const stats =
    document.getElementById(
      "categoryBannerStats"
    );


  if (stats) {

    stats.innerHTML =
      visual.stats.map(
        function (label) {

          return `

            <div class="category-banner-stat">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >

                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />

                <path d="M12 7v5l3 3"/>

              </svg>

              <span>
                ${esc(
                  label.toUpperCase()
                )}
              </span>

            </div>

          `;

        }
      ).join("");

  }


  banner.style.display =
    "block";

}


// =====================================================
// ТРЕНЕРЫ
// =====================================================

function renderCoaches() {

  const sportFilter =
    document.getElementById(
      "sportFilter"
    );


  const formatFilter =
    document.getElementById(
      "formatFilter"
    );


  const container =
    document.getElementById(
      "coachesList"
    );


  if (
    !sportFilter ||
    !formatFilter ||
    !container
  ) return;


  updateCategoryBanner();


  const selectedSport =
    sportFilter.value;


  const selectedFormat =
    formatFilter.value;


  const filtered =
    coaches.filter(
      function (coach) {

        const sportMatches =

          !selectedSport ||

          String(coach.sport) ===
          String(selectedSport);


        const formatMatches =

          !selectedFormat ||

          coach.format ===
          selectedFormat;


        return (
          sportMatches &&
          formatMatches
        );

      }
    );


  container.replaceChildren();


  if (!filtered.length) {

    const message =
      document.createElement("p");

    message.className =
      "lead";

    message.textContent =
      "Тренеры пока не найдены.";

    container.appendChild(
      message
    );

    return;

  }


  filtered.forEach(
    function (coach) {

      container.appendChild(
        createCoachCard(coach)
      );

    }
  );

}


// =====================================================
// ЛУЧШИЕ ТРЕНЕРЫ
// =====================================================

function renderTopCoaches() {

  const container =
    document.getElementById(
      "topCoaches"
    );


  if (!container) return;


  const top =
    [...coaches]
      .sort(
        function (a, b) {

          return Number(
            b.score || 0
          ) - Number(
            a.score || 0
          );

        }
      )
      .slice(0, 3);


  container.replaceChildren(
    ...top.map(
      createCoachCard
    )
  );

}


// =====================================================
// РЕЙТИНГ
// =====================================================

function renderRanking() {

  const container =
    document.getElementById(
      "rankingList"
    );


  if (!container) return;


  const ranking =
    [...coaches].sort(
      function (a, b) {

        return Number(
          b.score || 0
        ) - Number(
          a.score || 0
        );

      }
    );


  container.replaceChildren();


  if (!ranking.length) {

    const empty =
      document.createElement("p");

    empty.className =
      "lead";

    empty.textContent =
      "Рейтинг пока пуст.";

    container.appendChild(
      empty
    );

    return;

  }


  ranking.forEach(
    function (coach, index) {

      const row =
        document.createElement("div");

      row.className =
        "ranking-row";


      row.innerHTML = `

        <div>
          #${index + 1}
        </div>

        <div>
          <b>
            ${esc(coach.name)}
          </b>
        </div>

        <div class="sport">

          ${esc(
            sportName(
              coach.sport
            )
          )}

          · ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </div>

        <div>
          ${Number(
            coach.score || 0
          )}
        </div>

      `;


      row.addEventListener(
        "click",
        function () {

          openProfile(
            coach.id
          );

        }
      );


      container.appendChild(row);

    }
  );

}


// =====================================================
// MATCH ENGINE
// =====================================================

function calculateMatch(
  coach,
  sport,
  goal,
  format
) {

  let score = 0;
  let max = 0;


  if (sport) {

    max += 50;

    if (
      String(coach.sport) ===
      String(sport)
    ) {

      score += 50;

    }

  }


  if (goal) {

    max += 30;

    const coachGoal =
      String(
        coach.goal || ""
      )
      .toLowerCase();


    if (
      coachGoal.includes(
        String(goal).toLowerCase()
      )
    ) {

      score += 30;

    }

  }


  if (format) {

    max += 20;

    if (
      coach.format === format
    ) {

      score += 20;

    }

  }


  if (!max) {

    return 0;

  }


  return Math.round(
    (score / max) * 100
  );

}


function findMatch() {

  const sport =
    document.getElementById(
      "matchSport"
    ).value;


  const goal =
    document.getElementById(
      "matchGoal"
    ).value.trim();


  const format =
    document.getElementById(
      "matchFormat"
    ).value;


  const container =
    document.getElementById(
      "matchResults"
    );


  if (!container) return;


  if (!sport) {

    container.innerHTML = `

      <p class="error">
        Выбери вид спорта.
      </p>

    `;

    return;

  }


  const results =
    coaches
      .map(function (coach) {

        return {

          coach,

          percent:
            calculateMatch(
              coach,
              sport,
              goal,
              format
            )

        };

      })

      .filter(function (item) {

        return item.percent > 0;

      })

      .sort(function (a, b) {

        return (
          b.percent - a.percent
        );

      })

      .slice(0, 5);


  container.replaceChildren();


  if (!results.length) {

    const message =
      document.createElement("p");

    message.className =
      "lead";

    message.textContent =
      "Подходящих тренеров пока не найдено.";

    container.appendChild(
      message
    );

    return;

  }


  results.forEach(
    function (result) {

      const coach =
        result.coach;


      const row =
        document.createElement("div");

      row.className =
        "match-result";


      row.innerHTML = `

        <div>

          <b>
            ${esc(coach.name)}
          </b>

          <div class="lead">

            ${esc(
              sportName(
                coach.sport
              )
            )}

            ${coach.goal
              ? " · " + esc(coach.goal)
              : ""
            }

          </div>

        </div>

        <div class="match-percent">

          ${result.percent}%

        </div>

      `;


      row.addEventListener(
        "click",
        function () {

          openProfile(
            coach.id
          );

        }
      );


      container.appendChild(row);

    }
  );

}


// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

function openProfile(coachId) {

  const coach =
    coaches.find(
      function (item) {

        return String(item.id) ===
          String(coachId);

      }
    );


  if (!coach) {

    return;

  }


  showPage("profile");


  const container =
    document.getElementById(
      "profileContent"
    );


  if (!container) return;


  const image =
    getCoachImage(coach);


  const price =

    coach.price !== null &&
    coach.price !== undefined

      ? `${coach.price} €`

      : "Цена не указана";


  container.innerHTML = `

    <img
      class="profile-image"
      src="${esc(image)}"
      alt="${esc(coach.name || "Тренер")}"
    >

    <p class="eyebrow">
      ${esc(
        sportName(
          coach.sport
        )
      )}
    </p>

    <h1 class="page-title">

      ${esc(
        coach.name || "ТРЕНЕР"
      )}

    </h1>

    <div class="score-box">

      <div class="coach-score">

        FITMATCH SCORE:
        ${Number(
          coach.score || 0
        )}

      </div>

      <div class="coach-avatar">

        ${esc(
          initials(
            coach.name
          )
        )}

      </div>

      <p class="lead">

        ${coach.bio
          ? esc(coach.bio)
          : "Описание пока не добавлено."
        }

      </p>

      <div class="tags">

        <span class="tag">

          ${esc(
            sportName(
              coach.sport
            )
          )}

        </span>

        ${coach.goal
          ? `<span class="tag">
              ${esc(coach.goal)}
            </span>`
          : ""
        }

        ${coach.format
          ? `<span class="tag">
              ${esc(coach.format)}
            </span>`
          : ""
        }

      </div>

      <div class="card-footer">

        <span>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </span>

        <span>

          ${esc(price)}
          /
          ${esc(
            coach.period || "занятие"
          )}

        </span>

      </div>

      <div class="actions">

        <button
          class="btn btn-primary"
          id="profileMatchBtn"
          type="button"
        >

          ПРОЙТИ MATCH →

        </button>

        <button
          class="btn"
          id="profileBackBtn"
          type="button"
        >

          К ТРЕНЕРАМ

        </button>

      </div>

    </div>

  `;


  const matchButton =
    document.getElementById(
      "profileMatchBtn"
    );


  if (matchButton) {

    matchButton.addEventListener(
      "click",
      function () {

        showPage("match");

        const matchSport =
          document.getElementById(
            "matchSport"
          );

        if (matchSport) {

          matchSport.value =
            String(coach.sport);

        }

      }
    );

  }


  const backButton =
    document.getElementById(
      "profileBackBtn"
    );


  if (backButton) {

    backButton.addEventListener(
      "click",
      function () {

        showPage("coaches");

      }
    );

  }

}


// =====================================================
// ПОЛЬЗОВАТЕЛЬ
// =====================================================

async function refreshUser() {

  const response =
    await supabase.auth.getUser();


  currentUser =
    response.data?.user || null;


  const button =
    document.getElementById(
      "authBtn"
    );


  if (!button) return;


  if (currentUser) {

    button.textContent =
      "Выйти";

  } else {

    button.textContent =
      "Войти";

  }

}


// =====================================================
// КНОПКА АВТОРИЗАЦИИ
// =====================================================

function initAuthButton() {

  const button =
    document.getElementById(
      "authBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    async function () {

      if (currentUser) {

        const response =
          await supabase.auth.signOut();


        if (response.error) {

          showMessage(
            "authMessage",
            response.error.message,
            true
          );

          return;

        }


        currentUser = null;

        button.textContent =
          "Войти";

        return;

      }


      toggleModal(
        "modal",
        true
      );

    }
  );

}


// =====================================================
// ВХОД
// =====================================================

function initAuthForm() {

  const form =
    document.getElementById(
      "authForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const email =
        document
          .getElementById(
            "authEmail"
          )
          .value
          .trim();


      const password =
        document
          .getElementById(
            "authPassword"
          )
          .value;


      const response =
        await supabase.auth
          .signInWithPassword({
            email,
            password
          });


      if (response.error) {

        showMessage(
          "authMessage",
          response.error.message,
          true
        );

        return;

      }


      currentUser =
        response.data.user ||
        null;


      await refreshUser();


      showMessage(
        "authMessage",
        "Вход выполнен."
      );


      setTimeout(
        function () {

          toggleModal(
            "modal",
            false
          );

        },
        500
      );

    }
  );

}


// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

function initSignup() {

  const button =
    document.getElementById(
      "signupBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    async function () {

      const email =
        document
          .getElementById(
            "authEmail"
          )
          .value
          .trim();


      const password =
        document
          .getElementById(
            "authPassword"
          )
          .value;


      if (!email || !password) {

        showMessage(
          "authMessage",
          "Введи email и пароль.",
          true
        );

        return;

      }


      if (password.length < 6) {

        showMessage(
          "authMessage",
          "Пароль должен содержать минимум 6 символов.",
          true
        );

        return;

      }


      const response =
        await supabase.auth
          .signUp({
            email,
            password
          });


      showMessage(

        "authMessage",

        response.error

          ? response.error.message

          : "Регистрация выполнена. Проверь email.",

        Boolean(
          response.error
        )

      );

    }
  );

}


// =====================================================
// ЗАБЫЛ ПАРОЛЬ
// =====================================================

function initForgotPassword() {

  const button =
    document.getElementById(
      "forgotPasswordBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    async function () {

      const email =
        document
          .getElementById(
            "authEmail"
          )
          .value
          .trim();


      if (!email) {

        showMessage(
          "authMessage",
          "Сначала введи свой email.",
          true
        );

        return;

      }


      const response =
        await supabase.auth
          .resetPasswordForEmail(
            email,
            {

              redirectTo:

                window.location.origin +
                window.location.pathname

            }
          );


      if (response.error) {

        showMessage(
          "authMessage",
          response.error.message,
          true
        );

        return;

      }


      showMessage(
        "authMessage",
        "Письмо для восстановления пароля отправлено. Проверь email."
      );

    }
  );

}


// =====================================================
// НОВЫЙ ПАРОЛЬ
// =====================================================

function initResetPassword() {

  const form =
    document.getElementById(
      "resetPasswordForm"
    );


  const cancel =
    document.getElementById(
      "resetCancel"
    );


  if (cancel) {

    cancel.addEventListener(
      "click",
      function () {

        toggleModal(
          "resetPasswordModal",
          false
        );

      }
    );

  }


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const password =
        document
          .getElementById(
            "newPassword"
          )
          .value;


      const confirm =
        document
          .getElementById(
            "confirmPassword"
          )
          .value;


      if (password.length < 6) {

        showMessage(
          "resetMessage",
          "Пароль должен содержать минимум 6 символов.",
          true
        );

        return;

      }


      if (password !== confirm) {

        showMessage(
          "resetMessage",
          "Пароли не совпадают.",
          true
        );

        return;

      }


      const response =
        await supabase.auth
          .updateUser({
            password
          });


      if (response.error) {

        showMessage(
          "resetMessage",
          response.error.message,
          true
        );

        return;

      }


      showMessage(
        "resetMessage",
        "Пароль успешно изменён."
      );


      setTimeout(
        async function () {

          toggleModal(
            "resetPasswordModal",
            false
          );


          window.location.hash =
            "";


          await refreshUser();

        },
        800
      );

    }
  );

}


// =====================================================
// RECOVERY MODE
// =====================================================

function checkRecoveryMode() {

  const hash =
    window.location.hash;


  if (
    hash.includes(
      "type=recovery"
    )
  ) {

    toggleModal(
      "resetPasswordModal",
      true
    );

  }

}


// =====================================================
// СОЗДАТЬ ТРЕНЕРА
// =====================================================

function initCreateCoach() {

  const button =
    document.getElementById(
      "createBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    async function () {

      await refreshUser();


      if (!currentUser) {

        toggleModal(
          "modal",
          true
        );


        showMessage(
          "authMessage",
          "Сначала войди или зарегистрируйся.",
          true
        );

        return;

      }


      toggleModal(
        "coachModal",
        true
      );

    }
  );

}


// =====================================================
// ФОРМА ТРЕНЕРА
// =====================================================

function initCoachForm() {

  const form =
    document.getElementById(
      "createForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      await refreshUser();


      if (!currentUser) {

        showMessage(
          "coachMessage",
          "Необходимо войти в аккаунт.",
          true
        );

        return;

      }


      const formData =
        new FormData(
          event.currentTarget
        );


      const name =
        String(
          formData.get("name") || ""
        ).trim();


      const sport =
        formData.get("sport");


      const goal =
        String(
          formData.get("goal") || ""
        ).trim() ||
        null;


      const format =
        formData.get("format");


      const price =
        Number(
          formData.get("price")
        );


      const period =
        formData.get("period");


      const bio =
        String(
          formData.get("bio") || ""
        ).trim() ||
        null;


      if (
        !name ||
        !sport ||
        !period
      ) {

        showMessage(
          "coachMessage",
          "Заполни обязательные поля.",
          true
        );

        return;

      }


      if (
        !Number.isFinite(price) ||
        price < 0
      ) {

        showMessage(
          "coachMessage",
          "Укажи корректную цену.",
          true
        );

        return;

      }


      const response =
        await supabase
          .from("coaches")
          .insert({

            user_id:
              currentUser.id,

            name,

            sport,

            goal,

            format,

            price,

            period,

            bio

          });


      if (response.error) {

        if (
          response.error.code ===
          "23505"
        ) {

          showMessage(
            "coachMessage",
            "У тебя уже есть профиль тренера.",
            true
          );

        } else {

          showMessage(
            "coachMessage",
            response.error.message,
            true
          );

        }

        return;

      }


      showMessage(
        "coachMessage",
        "Профиль тренера создан."
      );


      await loadData();


      setTimeout(
        function () {

          toggleModal(
            "coachModal",
            false
          );


          form.reset();

          showPage(
            "coaches"
          );

        },
        700
      );

    }
  );

}


// =====================================================
// НАВИГАЦИЯ
// =====================================================

function initNavigation() {

  const logo =
    document.getElementById(
      "logo"
    );


  if (logo) {

    logo.addEventListener(
      "click",
      function () {

        showPage("home");

      }
    );

  }


  document
    .querySelectorAll(
      "[data-nav]"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            showPage(
              button.dataset.nav
            );

          }
        );

      }
    );


  const matchBtn =
    document.getElementById(
      "matchBtn"
    );


  if (matchBtn) {

    matchBtn.addEventListener(
      "click",
      function () {

        showPage("match");

      }
    );

  }


  const chooseSportBtn =
    document.getElementById(
      "chooseSportBtn"
    );


  if (chooseSportBtn) {

    chooseSportBtn.addEventListener(
      "click",
      function () {

        showPage("sports");

      }
    );

  }

}


// =====================================================
// ФИЛЬТРЫ
// =====================================================

function initFilters() {

  const sportFilter =
    document.getElementById(
      "sportFilter"
    );


  if (sportFilter) {

    sportFilter.addEventListener(
      "change",
      renderCoaches
    );

  }


  const formatFilter =
    document.getElementById(
      "formatFilter"
    );


  if (formatFilter) {

    formatFilter.addEventListener(
      "change",
      renderCoaches
    );

  }


  const findMatchBtn =
    document.getElementById(
      "findMatchBtn"
    );


  if (findMatchBtn) {

    findMatchBtn.addEventListener(
      "click",
      findMatch
    );

  }


  const categoryBannerCta =
    document.getElementById(
      "cyclingBannerCta"
    );


  if (categoryBannerCta) {

    categoryBannerCta.addEventListener(
      "click",
      function () {

        document
          .getElementById(
            "coachesList"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

      }
    );

  }

}


// =====================================================
// МОДАЛЬНЫЕ ОКНА
// =====================================================

function initModals() {

  const modalCancel =
    document.getElementById(
      "modalCancel"
    );


  if (modalCancel) {

    modalCancel.addEventListener(
      "click",
      function () {

        toggleModal(
          "modal",
          false
        );

      }
    );

  }


  const coachCancel =
    document.getElementById(
      "coachCancel"
    );


  if (coachCancel) {

    coachCancel.addEventListener(
      "click",
      function () {

        toggleModal(
          "coachModal",
          false
        );

      }
    );

  }


  document
    .querySelectorAll(
      ".modal"
    )
    .forEach(
      function (modal) {

        modal.addEventListener(
          "click",
          function (event) {

            if (
              event.target === modal
            ) {

              toggleModal(
                modal.id,
                false
              );

            }

          }
        );

      }
    );

}


// =====================================================
// МОБИЛЬНОЕ МЕНЮ
// =====================================================

function initMobileMenu() {

  const hamburger =
    document.getElementById(
      "hamburger"
    );


  const nav =
    document.getElementById(
      "mainNav"
    );


  if (
    !hamburger ||
    !nav
  ) return;


  hamburger.addEventListener(
    "click",
    function () {

      nav.classList.toggle(
        "mobile-open"
      );

    }
  );

}


// =====================================================
// AUTH STATE
// =====================================================

function initAuthState() {

  supabase.auth.onAuthStateChange(
    function (event, session) {

      currentUser =
        session
          ? session.user
          : null;


      refreshUser();


      if (
        event ===
        "PASSWORD_RECOVERY"
      ) {

        toggleModal(
          "resetPasswordModal",
          true
        );

      }

    }
  );

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


  try {

    await refreshUser();

    await loadData();

  }

  catch (error) {

    console.error(
      "FITMATCH ERROR:",
      error
    );


    const container =
      document.getElementById(
        "coachesList"
      );


    if (container) {

      container.innerHTML = `

        <p class="error">

          Ошибка подключения к Supabase.

          ${esc(
            error.message ||
            String(error)
          )}

        </p>

      `;

    }

  }

}


init();
