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

  return String(value ?? "").replace(
    /[&<>"']/g,
    function (char) {

      const chars = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return chars[char];

    }
  );

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
    "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=85",

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
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85"

};


// =====================================================
// ИЗОБРАЖЕНИЯ ТРЕНЕРОВ
// =====================================================

const COACH_IMAGES = [

  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&w=900&q=85"

];


// =====================================================
// КАТЕГОРИИ
// =====================================================

const CATEGORY_ALIASES = {

  boxing: "combat",
  mma: "combat",
  martialarts: "combat",
  martial_arts: "combat"

};


function resolveCategoryKey(sportId) {

  const value =
    String(sportId || "")
      .toLowerCase()
      .trim();

  return CATEGORY_ALIASES[value] || value;

}


// =====================================================
// ВИЗУАЛЫ КАТЕГОРИЙ
// =====================================================

const CATEGORY_VISUALS = {

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
      <circle
        cx="150"
        cy="55"
        r="18"
        stroke="currentColor"
        stroke-width="6"
      />

      <path
        d="M150 74 L165 140 L110 200 M165 140 L235 175 M165 140 L135 95 L225 85"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    `

  },


  bodybuilding: {

    word1: "",
    word2: "БОДИБИЛДИНГ",

    subtitle:
      "Мышечная масса, сила и рельеф под руководством профессионального тренера",

    stats: [
      "Сила",
      "Масса",
      "Рельеф"
    ],

    icon: `
      <path
        d="M80 190 H320"
        stroke="currentColor"
        stroke-width="10"
        stroke-linecap="round"
      />

      <path
        d="M115 155 V225 M285 155 V225"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"
      />

      <circle
        cx="95"
        cy="190"
        r="28"
        stroke="currentColor"
        stroke-width="8"
      />

      <circle
        cx="305"
        cy="190"
        r="28"
        stroke="currentColor"
        stroke-width="8"
      />
    `

  },


  fitness: {

    word1: "",
    word2: "ФИТНЕС",

    subtitle:
      "Форма, здоровье и уверенность в своём теле",

    stats: [
      "Форма",
      "Энергия",
      "Здоровье"
    ],

    icon: `
      <circle
        cx="200"
        cy="55"
        r="22"
        stroke="currentColor"
        stroke-width="6"
      />

      <path
        d="M200 78 L175 145 L120 180 M175 145 L240 120 M175 145 L155 235 M175 145 L245 225"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <path
        d="M80 260 H320"
        stroke="currentColor"
        stroke-width="5"
        stroke-linecap="round"
      />
    `

  },


  crossfit: {

    word1: "",
    word2: "КРОССФИТ",

    subtitle:
      "Функциональные тренировки, сила и максимальная выносливость",

    stats: [
      "Сила",
      "Выносливость",
      "Функциональность"
    ],

    icon: `
      <path
        d="M80 150 H320"
        stroke="currentColor"
        stroke-width="9"
      />

      <path
        d="M120 115 V185 M280 115 V185"
        stroke="currentColor"
        stroke-width="14"
      />

      <circle
        cx="90"
        cy="150"
        r="25"
        stroke="currentColor"
        stroke-width="8"
      />

      <circle
        cx="310"
        cy="150"
        r="25"
        stroke="currentColor"
        stroke-width="8"
      />
    `

  },


  yoga: {

    word1: "",
    word2: "ЙОГА",

    subtitle:
      "Гибкость, баланс, сила и контроль над телом",

    stats: [
      "Баланс",
      "Гибкость",
      "Спокойствие"
    ],

    icon: `
      <circle
        cx="200"
        cy="65"
        r="20"
        stroke="currentColor"
        stroke-width="6"
      />

      <path
        d="M200 90 L160 170 L240 170 Z"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
        stroke-linejoin="round"
      />

      <path
        d="M160 170 L110 230 M240 170 L290 230"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
      />
    `

  },


  swimming: {

    word1: "",
    word2: "ПЛАВАНИЕ",

    subtitle:
      "Техника, скорость и эффективная работа всего тела",

    stats: [
      "Техника",
      "Скорость",
      "Выносливость"
    ],

    icon: `
      <circle
        cx="150"
        cy="95"
        r="20"
        stroke="currentColor"
        stroke-width="6"
      />

      <path
        d="M170 110 L240 140 L290 115"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
      />

      <path
        d="M70 200 Q110 170 150 200 T230 200 T310 200"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
      />

      <path
        d="M70 235 Q110 205 150 235 T230 235 T310 235"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
      />
    `

  },


  cycling: {

    word1: "",
    word2: "ВЕЛОСПОРТ",

    subtitle:
      "Скорость, техника и подготовка к новым дистанциям",

    stats: [
      "Скорость",
      "Техника",
      "Дистанция"
    ],

    icon: `
      <circle
        cx="120"
        cy="210"
        r="45"
        stroke="currentColor"
        stroke-width="6"
      />

      <circle
        cx="280"
        cy="210"
        r="45"
        stroke="currentColor"
        stroke-width="6"
      />

      <path
        d="M120 210 L175 115 L225 210 L150 210 L225 210 L280 210 L210 100"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
        stroke-linejoin="round"
      />

      <circle
        cx="210"
        cy="65"
        r="17"
        stroke="currentColor"
        stroke-width="6"
      />
    `

  },


  tennis: {

    word1: "",
    word2: "ТЕННИС",

    subtitle:
      "Техника ударов, скорость и тактическое мышление",

    stats: [
      "Техника",
      "Скорость",
      "Тактика"
    ],

    icon: `
      <ellipse
        cx="165"
        cy="130"
        rx="60"
        ry="90"
        stroke="currentColor"
        stroke-width="7"
      />

      <path
        d="M205 200 L260 270"
        stroke="currentColor"
        stroke-width="10"
        stroke-linecap="round"
      />

      <circle
        cx="310"
        cy="95"
        r="22"
        stroke="currentColor"
        stroke-width="6"
      />
    `

  },


  combat: {

    word1: "",
    word2: "ЕДИНОБОРСТВА",

    subtitle:
      "Техника, сила, скорость и спортивная дисциплина",

    stats: [
      "Техника",
      "Сила",
      "Скорость"
    ],

    icon: `
      <path
        d="M120 220 L200 120 L280 220"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <circle
        cx="200"
        cy="70"
        r="22"
        stroke="currentColor"
        stroke-width="7"
      />

      <path
        d="M120 145 H70 M280 145 H330"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
      />
    `

  }

};


// =====================================================
// ИЗОБРАЖЕНИЕ СПОРТА
// =====================================================

function getSportImage(nameOrId) {

  const value =
    String(nameOrId || "")
      .toLowerCase()
      .trim();

  const map = {

    "бодибилдинг": "bodybuilding",
    "bodybuilding": "bodybuilding",

    "фитнес": "fitness",
    "fitness": "fitness",

    "кроссфит": "crossfit",
    "crossfit": "crossfit",

    "бег": "running",
    "running": "running",

    "йога": "yoga",
    "yoga": "yoga",

    "плавание": "swimming",
    "swimming": "swimming",

    "велоспорт": "cycling",
    "велосипед": "cycling",
    "cycling": "cycling",

    "теннис": "tennis",
    "tennis": "tennis",

    "единоборства": "combat",
    "бокс": "combat",
    "boxing": "combat",
    "mma": "combat"

  };


  const key =
    map[value] ||
    resolveCategoryKey(value);


  return (
    SPORT_IMAGES[key] ||
    SPORT_IMAGES.fitness
  );

}


// =====================================================
// ИЗОБРАЖЕНИЕ ТРЕНЕРА
// =====================================================

function getCoachImage(coach) {

  if (
    coach &&
    coach.image_url
  ) {

    return coach.image_url;

  }


  const seed =
    String(
      coach?.id ||
      coach?.name ||
      "fitmatch"
    );


  let hash = 0;


  for (
    let i = 0;
    i < seed.length;
    i++
  ) {

    hash =
      ((hash << 5) - hash) +
      seed.charCodeAt(i);

    hash |= 0;

  }


  const index =
    Math.abs(hash) %
    COACH_IMAGES.length;


  return COACH_IMAGES[index];

}


// =====================================================
// ВИЗУАЛ КАТЕГОРИИ
// =====================================================

function getCategoryVisual(sportId) {

  const sport =
    sports.find(function (item) {

      return String(item.id) ===
        String(sportId);

    });


  if (!sport) {

    return CATEGORY_VISUALS[
      resolveCategoryKey(sportId)
    ] || null;

  }


  const name =
    String(sport.name || "")
      .toLowerCase();


  const aliases = {

    "бег": "running",
    "бодибилдинг": "bodybuilding",
    "фитнес": "fitness",
    "кроссфит": "crossfit",
    "йога": "yoga",
    "плавание": "swimming",
    "велоспорт": "cycling",
    "теннис": "tennis",
    "единоборства": "combat",
    "бокс": "combat"

  };


  const key =
    aliases[name] ||
    resolveCategoryKey(sportId);


  return CATEGORY_VISUALS[key] || null;

}


// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {

  const price =
    Number(coach.price || 0);


  const period =
    coach.period ||
    "месяц";


  return `€${price} / ${period}`;

}


// =====================================================
// ПОКАЗ СТРАНИЦЫ
// =====================================================

function showPage(id) {

  document
    .querySelectorAll(".page")
    .forEach(function (page) {

      page.classList.remove("active");

    });


  const page =
    document.getElementById(id);


  if (page) {

    page.classList.add("active");

  }


  const nav =
    document.getElementById("mainNav");


  if (nav) {

    nav.classList.remove(
      "mobile-open"
    );

  }


  window.scrollTo({

    top: 0,
    behavior: "smooth"

  });

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
    show
  );

}


// =====================================================
// СООБЩЕНИЯ
// =====================================================

function showMessage(
  id,
  text,
  isError = false
) {

  const element =
    document.getElementById(id);


  if (!element) return;


  element.textContent = text;


  element.className =
    isError
      ? "error"
      : "success";

}


// =====================================================
// ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function refreshUser() {

  const response =
    await supabase.auth.getUser();


  currentUser =
    response.data?.user ||
    null;


  const button =
    document.getElementById("authBtn");


  if (!button) return;


  button.textContent =
    currentUser
      ? "Выйти"
      : "Войти";

}


// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================

async function loadData() {

  const sportsResult =
    await supabase
      .from("sports")
      .select("*")
      .order("name");


  if (sportsResult.error) {

    console.error(
      "Ошибка загрузки видов спорта:",
      sportsResult.error
    );

    throw sportsResult.error;

  }


  sports =
    sportsResult.data || [];


  renderSports();


  const coachesResult =
    await supabase
      .from("coaches")
      .select("*");


  if (coachesResult.error) {

    console.error(
      "Ошибка загрузки тренеров:",
      coachesResult.error
    );

    coaches = [];

  } else {

    coaches =
      coachesResult.data || [];

  }


  coaches.sort(function (a, b) {

    const scoreA =
      Number(a.score || 0);

    const scoreB =
      Number(b.score || 0);


    if (scoreB !== scoreA) {

      return scoreB - scoreA;

    }


    return (
      Number(b.rating || 0) -
      Number(a.rating || 0)
    );

  });


  renderCoaches();

  renderTopCoaches();

  renderRanking();

  populateGoals();

}


// =====================================================
// КАРТОЧКА СПОРТА
// =====================================================

function createSportCard(sport) {

  const card =
    document.createElement("div");


  card.className =
    "sport-card";


  const image =
    getSportImage(
      sport.name
    );


  card.style.backgroundImage =
    `url("${image}")`;


  card.innerHTML = `

    <div style="font-size:30px">

      ${esc(
        sport.icon || "🏅"
      )}

    </div>


    <b>
      ${esc(sport.name)}
    </b>


    <p>
      Найти тренера →
    </p>

  `;


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
    getCoachImage(coach);


  const rating =
    Number(coach.rating || 0);


  const score =
    Number(coach.score || 0);


  card.innerHTML = `

    <img
      class="coach-image"
      src="${esc(image)}"
      alt="${esc(coach.name)}"
      loading="lazy"
    >


    <div class="coach-score">

      ${score}

    </div>


    <h3>

      ${esc(coach.name)}

    </h3>


    <div>

      ${esc(
        sportName(coach.sport)
      )}

      ·

      ${esc(
        coach.format ||
        "Не указан"
      )}

    </div>


    <div class="tags">

      ${
        coach.goal

          ? `

            <span class="tag">

              ${esc(coach.goal)}

            </span>

          `

          : ""
      }


      ${
        coach.verified

          ? `

            <span class="tag">

              ✓ Проверен

            </span>

          `

          : ""
      }

    </div>


    <div class="card-footer">

      <span>

        ⭐ ${rating.toFixed(1)}

      </span>


      <span>

        ${priceText(coach)}

      </span>

    </div>

  `;


  card.addEventListener(
    "click",
    function () {

      openProfile(coach.id);

    }
  );


  return card;

}


// =====================================================
// СПОРТЫ
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


      if (
        id === "sportFilter"
      ) {

        select.innerHTML = `
          <option value="">
            Все виды спорта
          </option>
        `;

      }


      if (
        id === "matchSport"
      ) {

        select.innerHTML = `
          <option value="">
            Не выбрано
          </option>
        `;

      }


      if (
        id === "coachSport"
      ) {

        select.innerHTML = `
          <option value="">
            Выберите спорт
          </option>
        `;

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


      const exists =
        Array.from(
          select.options
        ).some(function (option) {

          return (
            String(option.value) ===
            String(previousValue)
          );

        });


      if (exists) {

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


  const selectedSport =
    sportFilter.value;


  if (!selectedSport) {

    banner.style.display =
      "none";

    return;

  }


  const visual =
    getCategoryVisual(
      selectedSport
    );


  if (!visual) {

    banner.style.display =
      "none";

    return;

  }


  const graphic =
    document.getElementById(
      "categoryBannerGraphic"
    );


  const title =
    document.getElementById(
      "categoryBannerTitle"
    );


  const subtitle =
    document.getElementById(
      "categoryBannerSubtitle"
    );


  const stats =
    document.getElementById(
      "categoryBannerStats"
    );


  if (graphic) {

    graphic.innerHTML =
      visual.icon;

  }


  if (title) {

    title.innerHTML =

      (
        visual.word1
          ? `${esc(visual.word1)}<br>`
          : ""
      )

      +

      `<em>${esc(
        visual.word2
      )}</em>`;

  }


  if (subtitle) {

    subtitle.textContent =
      visual.subtitle;

  }


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

                <path
                  d="M12 7v5l3 3"
                />

              </svg>


              <span>

                ${esc(
                  String(label)
                    .toUpperCase()
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

          return (
            Number(b.score || 0) -
            Number(a.score || 0)
          );

        }
      )
      .slice(0, 3);


  container.replaceChildren();


  if (!top.length) {

    const message =
      document.createElement("p");


    message.className =
      "lead";


    message.textContent =
      "Тренеры пока не добавлены.";


    container.appendChild(
      message
    );


    return;

  }


  top.forEach(
    function (coach) {

      container.appendChild(
        createCoachCard(coach)
      );

    }
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

        const scoreDifference =

          Number(b.score || 0) -

          Number(a.score || 0);


        if (scoreDifference !== 0) {

          return scoreDifference;

        }


        return (

          Number(b.rating || 0) -

          Number(a.rating || 0)

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

          ·

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </div>


        <div>

          <b>

            ${Number(
              coach.score || 0
            )}

          </b>

        </div>

      `;


      row.addEventListener(
        "click",
        function () {

          openProfile(coach.id);

        }
      );


      container.appendChild(row);

    }
  );

}


// =====================================================
// ЦЕЛИ MATCH
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) return;


  const previousValue =
    select.value;


  select.innerHTML = `
    <option value="">
      Не выбрано
    </option>
  `;


  const goals = [

    ...new Set(

      coaches
        .map(function (coach) {

          return coach.goal;

        })
        .filter(Boolean)

    )

  ];


  goals.forEach(
    function (goal) {

      select.add(
        new Option(
          goal,
          goal
        )
      );

    }
  );


  const exists =
    Array.from(
      select.options
    ).some(function (option) {

      return (
        option.value ===
        previousValue
      );

    });


  if (exists) {

    select.value =
      previousValue;

  }

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

  let maxScore = 0;


  if (sport) {

    maxScore += 50;


    if (
      String(coach.sport) ===
      String(sport)
    ) {

      score += 50;

    }

  }


  if (goal) {

    maxScore += 30;


    const coachGoal =
      String(
        coach.goal || ""
      ).toLowerCase();


    const selectedGoal =
      String(goal)
        .toLowerCase();


    if (
      coachGoal.includes(
        selectedGoal
      ) ||

      selectedGoal.includes(
        coachGoal
      )
    ) {

      score += 30;

    }

  }


  if (format) {

    maxScore += 20;


    if (
      coach.format === format
    ) {

      score += 20;

    }

  }


  if (maxScore === 0) {

    return 0;

  }


  return Math.round(
    (score / maxScore) * 100
  );

}


function findMatch() {

  const sport =
    document.getElementById(
      "matchSport"
    )?.value || "";


  const goal =
    document.getElementById(
      "matchGoal"
    )?.value || "";


  const format =
    document.getElementById(
      "matchFormat"
    )?.value || "";


  const container =
    document.getElementById(
      "matchResults"
    );


  if (!container) return;


  if (
    !sport &&
    !goal &&
    !format
  ) {

    container.innerHTML = `

      <p class="error">

        Выберите хотя бы один параметр.

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

        if (
          b.percent !==
          a.percent
        ) {

          return (
            b.percent -
            a.percent
          );

        }


        return (

          Number(
            b.coach.score || 0
          )

          -

          Number(
            a.coach.score || 0
          )

        );

      })

      .slice(0, 5);


  if (!results.length) {

    container.innerHTML = `

      <p class="lead">

        Подходящих тренеров пока не найдено.

      </p>

    `;

    return;

  }


  container.replaceChildren();


  results.forEach(
    function (item) {

      const result =
        document.createElement("div");


      result.className =
        "match-result";


      result.innerHTML = `

        <div>

          <b>

            ${esc(
              item.coach.name
            )}

          </b>


          <div class="lead">

            ${esc(
              sportName(
                item.coach.sport
              )
            )}

            ·

            ${esc(
              item.coach.goal || ""
            )}

          </div>

        </div>


        <div class="match-percent">

          ${item.percent}%

        </div>

      `;


      result.addEventListener(
        "click",
        function () {

          openProfile(
            item.coach.id
          );

        }
      );


      container.appendChild(
        result
      );

    }
  );

}


// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

async function openProfile(coachId) {

  const coach =
    coaches.find(function (item) {

      return (
        String(item.id) ===
        String(coachId)
      );

    });


  if (!coach) return;


  const profileContent =
    document.getElementById(
      "profileContent"
    );


  if (!profileContent) return;


  showPage("profile");


  profileContent.innerHTML = `

    <div class="match-box">

      <p class="lead">

        Загрузка профиля...

      </p>

    </div>

  `;


  let reviews = [];


  try {

    const result =
      await supabase

        .from("reviews")

        .select(
          "rating, text, created_at, user_id"
        )

        .eq(
          "coach_id",
          coachId
        )

        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (result.error) {

      console.error(
        "Ошибка загрузки отзывов:",
        result.error
      );

    } else {

      reviews =
        result.data || [];

    }

  }

  catch (error) {

    console.error(
      "Ошибка отзывов:",
      error
    );

  }


  const canReview =

    Boolean(currentUser) &&

    String(currentUser.id) !==
    String(coach.user_id);


  const reviewHTML =

    reviews.length

      ?

      reviews.map(
        function (review) {

          return `

            <div class="review">

              <b>

                ⭐ ${Number(
                  review.rating || 0
                )}/5

              </b>


              <p>

                ${esc(
                  review.text ||
                  "Без текста"
                )}

              </p>

            </div>

          `;

        }
      ).join("")

      :

      `

        <p class="lead">

          Отзывов пока нет.

        </p>

      `;


  profileContent.innerHTML = `

    <div class="coach-card">

      <img
        class="profile-image"
        src="${esc(
          getCoachImage(coach)
        )}"
        alt="${esc(
          coach.name
        )}"
      >


      <div class="coach-score">

        ${Number(
          coach.score || 0
        )}

      </div>


      <h1 class="page-title">

        ${esc(coach.name)}

      </h1>


      <p class="lead">

        ${esc(
          sportName(
            coach.sport
          )
        )}

        ·

        ${esc(
          coach.goal ||
          ""
        )}

        ·

        ${esc(
          coach.format ||
          ""
        )}

      </p>


      <p class="lead">

        ${esc(
          coach.bio ||
          "Информация о тренере будет добавлена позже."
        )}

      </p>


      <div class="tags">

        <span class="tag">

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </span>


        <span class="tag">

          ${Number(
            coach.reviews_count || 0
          )}

          отзывов

        </span>


        <span class="tag">

          ${Number(
            coach.clients_count || 0
          )}

          клиентов

        </span>


        ${
          coach.verified

            ? `

              <span class="tag">

                ✓ Проверен

              </span>

            `

            : ""
        }

      </div>


      <h2>

        ${priceText(coach)}

      </h2>

    </div>


    <div class="match-box">

      <h2>

        Отзывы

      </h2>


      ${reviewHTML}

    </div>


    ${
      canReview

        ?

        `

          <div class="match-box">

            <h2>

              Оставить отзыв

            </h2>


            <form
              id="reviewForm"
              class="form"
            >

              <label>

                Оценка


                <select
                  name="rating"
                >

                  <option value="5">
                    5
                  </option>

                  <option value="4">
                    4
                  </option>

                  <option value="3">
                    3
                  </option>

                  <option value="2">
                    2
                  </option>

                  <option value="1">
                    1
                  </option>

                </select>

              </label>


              <label>

                Комментарий


                <textarea
                  name="text"
                  maxlength="2000"
                  placeholder="Напишите свой отзыв"
                ></textarea>

              </label>


              <button
                class="btn btn-primary"
                type="submit"
              >

                ОСТАВИТЬ ОТЗЫВ

              </button>


              <div
                id="reviewMessage"
              ></div>

            </form>

          </div>

        `

        : ""
    }

  `;


  const reviewForm =
    document.getElementById(
      "reviewForm"
    );


  if (reviewForm) {

    reviewForm.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        if (!currentUser) {

          return;

        }


        const formData =
          new FormData(
            reviewForm
          );


        const rating =
          Number(
            formData.get("rating")
          );


        const text =
          String(
            formData.get("text") || ""
          ).trim();


        if (
          !Number.isInteger(rating) ||

          rating < 1 ||

          rating > 5
        ) {

          showMessage(
            "reviewMessage",
            "Выберите оценку от 1 до 5.",
            true
          );

          return;

        }


        const response =
          await supabase

            .from("reviews")

            .insert({

              coach_id:
                coach.id,

              user_id:
                currentUser.id,

              rating,

              text:
                text || null

            });


        if (response.error) {

          showMessage(
            "reviewMessage",
            response.error.message,
            true
          );

          return;

        }


        showMessage(
          "reviewMessage",
          "Спасибо за ваш отзыв."
        );


        await loadData();


        setTimeout(
          function () {

            openProfile(
              coach.id
            );

          },
          500
        );

      }
    );

  }

}


// =====================================================
// ВХОД / ВЫХОД
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

          alert(
            response.error.message
          );

          return;

        }


        currentUser = null;


        await refreshUser();


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
          ?.value
          .trim();


      const password =
        document
          .getElementById(
            "authPassword"
          )
          ?.value;


      if (
        !email ||
        !password
      ) {

        showMessage(
          "authMessage",
          "Введите email и пароль.",
          true
        );

        return;

      }


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

          form.reset();

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
          ?.value
          .trim();


      const password =
        document
          .getElementById(
            "authPassword"
          )
          ?.value;


      if (
        !email ||
        !password
      ) {

        showMessage(
          "authMessage",
          "Введите email и пароль для регистрации.",
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
        await supabase.auth.signUp({

          email,

          password,

          options: {

            emailRedirectTo:

              window.location.origin +

              window.location.pathname

          }

        });


      if (response.error) {

        showMessage(
          "authMessage",
          response.error.message,
          true
        );

        return;

      }


      if (
        response.data.session
      ) {

        currentUser =
          response.data.user;


        await refreshUser();


        showMessage(
          "authMessage",
          "Регистрация выполнена."
        );

      }

      else {

        showMessage(
          "authMessage",
          "Регистрация выполнена. Проверьте email и подтвердите аккаунт."
        );

      }

    }
  );

}


// =====================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
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
          ?.value
          .trim();


      if (!email) {

        showMessage(
          "authMessage",
          "Сначала введите свой email.",
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
        "Письмо для восстановления пароля отправлено."
      );

    }
  );

}


// =====================================================
// ПРОВЕРКА RECOVERY MODE
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
          ?.value;


      const confirm =
        document
          .getElementById(
            "confirmPassword"
          )
          ?.value;


      if (
        !password ||
        password.length < 6
      ) {

        showMessage(
          "resetMessage",
          "Пароль должен содержать минимум 6 символов.",
          true
        );

        return;

      }


      if (
        password !== confirm
      ) {

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


      form.reset();


      setTimeout(
        function () {

          toggleModal(
            "resetPasswordModal",
            false
          );


          history.replaceState(
            null,
            document.title,
            window.location.pathname
          );

        },
        700
      );

    }
  );

}


// =====================================================
// ОТКРЫТЬ СОЗДАНИЕ ТРЕНЕРА
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
          "Сначала войдите или зарегистрируйтесь.",
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
// СОЗДАНИЕ ПРОФИЛЯ ТРЕНЕРА
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
        new FormData(form);


      const name =
        String(
          formData.get("name") || ""
        )
          .trim();


      const sport =
        String(
          formData.get("sport") || ""
        );


      const goal =
        String(
          formData.get("goal") || ""
        )
          .trim() ||
        null;


      const format =
        String(
          formData.get("format") || ""
        );


      const price =
        Number(
          formData.get("price")
        );


      const period =
        String(
          formData.get("period") || ""
        );


      const bio =
        String(
          formData.get("bio") || ""
        )
          .trim() ||
        null;


      if (
        !name ||
        !sport ||
        !period
      ) {

        showMessage(
          "coachMessage",
          "Заполните обязательные поля.",
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
          "Укажите корректную цену.",
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
            "У вас уже есть профиль тренера.",
            true
          );

        }

        else {

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
        "Профиль тренера успешно создан."
      );


      await loadData();


      setTimeout(
        function () {

          toggleModal(
            "coachModal",
            false
          );


          form.reset();

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


      hamburger.setAttribute(

        "aria-expanded",

        nav.classList.contains(
          "mobile-open"
        )

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

          Ошибка подключения к базе данных.

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
