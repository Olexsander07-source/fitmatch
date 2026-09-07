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
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85"

};


const COACH_IMAGES = [

  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1517838277536-f5f99be5010f?auto=format&fit=crop&w=900&q=85"

];


// =====================================================
// НОРМАЛИЗАЦИЯ НАЗВАНИЯ СПОРТА
// =====================================================

function normalizeSport(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");

}


// =====================================================
// КЛЮЧ КАТЕГОРИИ
// =====================================================

function resolveCategoryKey(value) {

  const name = normalizeSport(value);

  if (
    name.includes("бодибил")
  ) return "bodybuilding";

  if (
    name.includes("фитнес")
  ) return "fitness";

  if (
    name.includes("кросс")
  ) return "crossfit";

  if (
    name.includes("бег")
  ) return "running";

  if (
    name.includes("йог")
  ) return "yoga";

  if (
    name.includes("плав")
  ) return "swimming";

  if (
    name.includes("вел")
  ) return "cycling";

  if (
    name.includes("теннис")
  ) return "tennis";

  if (
    name.includes("единобор")
  ) return "combat";

  return "";

}


// =====================================================
// ИЗОБРАЖЕНИЕ СПОРТА
// =====================================================

function getSportImage(sport) {

  const key =
    resolveCategoryKey(
      sport?.name || sport
    );

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
    coach?.image_url &&
    String(coach.image_url).trim()
  ) {

    return coach.image_url;

  }

  if (
    coach?.avatar_url &&
    String(coach.avatar_url).trim()
  ) {

    return coach.avatar_url;

  }

  const id =
    Number(coach?.id) || 0;

  return COACH_IMAGES[
    Math.abs(id) %
    COACH_IMAGES.length
  ];

}


// =====================================================
// КАТЕГОРИИ
// =====================================================

const CATEGORY_VISUALS = {

  bodybuilding: {

    word1: "СИЛА",

    word2: "ТЕЛА",

    subtitle:
      "Мышечная масса, сила и профессиональная трансформация тела",

    stats: [
      "Масса",
      "Сила",
      "Рельеф"
    ],

    icon: `
      <circle cx="200" cy="55" r="25" stroke="currentColor" stroke-width="6"/>
      <path d="M150 120 Q200 80 250 120 L275 200" stroke="currentColor" stroke-width="6" fill="none"/>
      <path d="M150 120 L125 200" stroke="currentColor" stroke-width="6"/>
      <path d="M165 145 L110 120" stroke="currentColor" stroke-width="6"/>
      <path d="M235 145 L290 120" stroke="currentColor" stroke-width="6"/>
      <path d="M170 195 L155 280" stroke="currentColor" stroke-width="6"/>
      <path d="M230 195 L245 280" stroke="currentColor" stroke-width="6"/>
    `

  },

  fitness: {

    word1: "ТВОЯ",

    word2: "ФОРМА",

    subtitle:
      "Здоровье, энергия, красивая форма и уверенность в себе",

    stats: [
      "Форма",
      "Энергия",
      "Здоровье"
    ],

    icon: `
      <path d="M30 190 H120 L145 120 L180 260 L215 145 L250 190 H370"
      stroke="currentColor"
      stroke-width="6"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"/>
    `

  },

  crossfit: {

    word1: "ПРЕОДОЛЕЙ",

    word2: "СЕБЯ",

    subtitle:
      "Функциональная сила, выносливость и интенсивные тренировки",

    stats: [
      "Сила",
      "Скорость",
      "Выносливость"
    ],

    icon: `
      <path d="M80 210 H320" stroke="currentColor" stroke-width="7"/>
      <path d="M110 180 V240 M290 180 V240" stroke="currentColor" stroke-width="7"/>
      <path d="M160 150 L200 100 L240 150" stroke="currentColor" stroke-width="7" fill="none"/>
    `

  },

  running: {

    word1: "БЕГИ",

    word2: "ДАЛЬШЕ",

    subtitle:
      "Скорость, техника бега и подготовка к новым дистанциям",

    stats: [
      "Скорость",
      "Техника",
      "Дистанция"
    ],

    icon: `
      <circle cx="200" cy="65" r="22" stroke="currentColor" stroke-width="6"/>
      <path d="M200 90 L180 160 L230 180 L270 240"
      stroke="currentColor"
      stroke-width="6"
      fill="none"/>
      <path d="M180 160 L120 190" stroke="currentColor" stroke-width="6"/>
      <path d="M180 160 L140 250" stroke="currentColor" stroke-width="6"/>
    `

  },

  yoga: {

    word1: "НАЙДИ",

    word2: "БАЛАНС",

    subtitle:
      "Гибкость, осознанность, контроль тела и внутренний баланс",

    stats: [
      "Баланс",
      "Гибкость",
      "Спокойствие"
    ],

    icon: `
      <circle cx="200" cy="80" r="24" stroke="currentColor" stroke-width="6"/>
      <path d="M200 110 V190" stroke="currentColor" stroke-width="6"/>
      <path d="M200 145 L130 170" stroke="currentColor" stroke-width="6"/>
      <path d="M200 145 L270 170" stroke="currentColor" stroke-width="6"/>
      <path d="M200 190 L150 250" stroke="currentColor" stroke-width="6"/>
      <path d="M200 190 L250 250" stroke="currentColor" stroke-width="6"/>
    `

  },

  swimming: {

    word1: "ДВИГАЙСЯ",

    word2: "ВПЕРЁД",

    subtitle:
      "Техника плавания, скорость и выносливость в воде",

    stats: [
      "Техника",
      "Скорость",
      "Выносливость"
    ],

    icon: `
      <path d="M40 220 Q80 190 120 220 T200 220 T280 220 T360 220"
      stroke="currentColor"
      stroke-width="6"
      fill="none"/>
      <circle cx="180" cy="100" r="24" stroke="currentColor" stroke-width="6"/>
      <path d="M180 130 L230 180 L310 180"
      stroke="currentColor"
      stroke-width="6"
      fill="none"/>
    `

  },

  cycling: {

    word1: "КРУТИ",

    word2: "ВПЕРЁД",

    subtitle:
      "Скорость, выносливость и эффективная подготовка велосипедиста",

    stats: [
      "Скорость",
      "Мощность",
      "Дистанция"
    ],

    icon: `
      <circle cx="120" cy="220" r="50"
      stroke="currentColor"
      stroke-width="6"/>
      <circle cx="280" cy="220" r="50"
      stroke="currentColor"
      stroke-width="6"/>
      <path d="M120 220 L175 120 L230 220 L145 220"
      stroke="currentColor"
      stroke-width="6"
      fill="none"/>
      <path d="M175 120 L250 120"
      stroke="currentColor"
      stroke-width="6"/>
    `

  },

  tennis: {

    word1: "ТОЧНОСТЬ",

    word2: "УДАРА",

    subtitle:
      "Техника, скорость реакции и развитие игрового уровня",

    stats: [
      "Техника",
      "Реакция",
      "Тактика"
    ],

    icon: `
      <ellipse cx="180" cy="140" rx="70" ry="100"
      stroke="currentColor"
      stroke-width="6"/>
      <line x1="180" y1="240" x2="180" y2="290"
      stroke="currentColor"
      stroke-width="6"/>
      <circle cx="310" cy="230" r="20"
      stroke="currentColor"
      stroke-width="6"/>
    `

  },

  combat: {

    word1: "СИЛА",

    word2: "ХАРАКТЕРА",

    subtitle:
      "Техника, дисциплина, сила и уверенность в поединке",

    stats: [
      "Техника",
      "Сила",
      "Дисциплина"
    ],

    icon: `
      <path d="M120 170 Q150 100 200 150 Q250 100 280 170"
      stroke="currentColor"
      stroke-width="7"
      fill="none"/>
      <path d="M120 170 L80 210"
      stroke="currentColor"
      stroke-width="7"/>
      <path d="M280 170 L320 210"
      stroke="currentColor"
      stroke-width="7"/>
    `

  }

};


// =====================================================
// КАТЕГОРИЯ
// =====================================================

function getCategoryVisual(sportId) {

  const sport =
    sports.find(function (item) {

      return (
        String(item.id) ===
        String(sportId)
      );

    });

  const key =
    resolveCategoryKey(
      sport
        ? sport.name
        : sportId
    );

  return (
    CATEGORY_VISUALS[key] ||
    null
  );

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

  if (!Number.isFinite(price)) {

    return "Цена по запросу";

  }

  return `€${price} / ${period}`;

}


// =====================================================
// FITMATCH SCORE
// =====================================================

function calculateScore(coach) {

  if (
    coach.score !== null &&
    coach.score !== undefined &&
    Number(coach.score) > 0
  ) {

    return Math.round(
      Number(coach.score)
    );

  }

  let score = 40;

  const rating =
    Number(coach.rating || 0);

  const experience =
    Number(
      coach.experience_years ||
      coach.experience ||
      0
    );

  if (rating > 0) {

    score +=
      Math.min(
        25,
        rating * 5
      );

  }

  score +=
    Math.min(
      15,
      experience * 1.5
    );

  if (coach.image_url) {

    score += 5;

  }

  if (coach.specialization) {

    score += 5;

  }

  if (coach.achievements_summary) {

    score += 5;

  }

  if (coach.education) {

    score += 5;

  }

  return Math.min(
    100,
    Math.round(score)
  );

}


// =====================================================
// ПОКАЗ СТРАНИЦЫ
// =====================================================

function showPage(id) {

  document
    .querySelectorAll(".page")
    .forEach(function (page) {

      page.classList.remove(
        "active"
      );

    });


  const page =
    document.getElementById(id);


  if (page) {

    page.classList.add(
      "active"
    );

  }


  const nav =
    document.getElementById(
      "mainNav"
    );


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


  if (modal) {

    modal.classList.toggle(
      "show",
      show
    );

  }

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


  element.textContent =
    text;


  element.className =
    isError
      ? "error"
      : "success";

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
      .select("*")
      .order("score", {
        ascending: false
      });


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
    getSportImage(sport);


  card.style.backgroundImage =
    `url("${image}")`;


  card.innerHTML = `

    <div style="font-size:30px">
      ${esc(sport.icon || "🏅")}
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


  const score =
    calculateScore(coach);


  const experience =
    coach.experience_years ||
    coach.experience;


  card.innerHTML = `

    <img
      class="coach-image"
      src="${esc(image)}"
      alt="${esc(coach.name || "Тренер")}"
      loading="lazy"
    >

    <div class="coach-score">
      ${score}
    </div>

    <h3>
      ${esc(coach.name || "Тренер")}
    </h3>

    <div>
      ${esc(
        sportName(coach.sport)
      )}

      ·

      ${esc(
        coach.format || ""
      )}
    </div>

    <div class="tags">

      ${
        coach.specialization
          ? `
            <span class="tag">
              ${esc(
                coach.specialization
              )}
            </span>
          `
          : ""
      }

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
        experience
          ? `
            <span class="tag">
              ${esc(experience)} лет опыта
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
        ⭐ ${Number(
          coach.rating || 0
        ).toFixed(1)}
      </span>

      <span>
        ${esc(priceText(coach))}
      </span>

    </div>

  `;


  card.addEventListener(
    "click",
    function () {

      openProfile(
        coach.id
      );

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

        select.innerHTML =
          `<option value="">
            Все виды спорта
          </option>`;

      }


      if (
        id === "matchSport"
      ) {

        select.innerHTML =
          `<option value="">
            Не выбрано
          </option>`;

      }


      if (
        id === "coachSport"
      ) {

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


      const exists =
        [...select.options].some(
          function (option) {

            return (
              option.value ===
              previousValue
            );

          }
        );


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


  const visual =
    getCategoryVisual(
      sportFilter.value
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

      `${
        visual.word1
          ? esc(visual.word1) +
            "<br>"
          : ""
      }

      <em>
        ${esc(visual.word2)}
      </em>`;

  }


  if (subtitle) {

    subtitle.textContent =
      visual.subtitle;

  }


  if (stats) {

    stats.innerHTML =
      visual.stats
        .map(
          function (label) {

            return `

              <div
                class="category-banner-stat"
              >

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
                    label.toUpperCase()
                  )}
                </span>

              </div>

            `;

          }
        )
        .join("");

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


  filtered
    .sort(
      function (a, b) {

        return (
          calculateScore(b) -
          calculateScore(a)
        );

      }
    )
    .forEach(
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
            calculateScore(b) -
            calculateScore(a)
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
// РЕЙТИНГ ТРЕНЕРОВ
// =====================================================

function renderRanking() {

  const container =
    document.getElementById(
      "rankingList"
    );


  if (!container) return;


  const ranking =
    [...coaches]
      .sort(
        function (a, b) {

          const scoreDifference =
            calculateScore(b) -
            calculateScore(a);


          if (
            scoreDifference !== 0
          ) {

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
    function (
      coach,
      index
    ) {

      const row =
        document.createElement("div");


      row.className =
        "ranking-row";


      const score =
        calculateScore(coach);


      row.innerHTML = `

        <div>
          <strong>
            #${index + 1}
          </strong>
        </div>

        <div>

          <b>
            ${esc(
              coach.name ||
              "Тренер"
            )}
          </b>

          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-top:4px;
            "
          >

            ${
              coach.city
                ? esc(coach.city)
                : "FITMATCH"
            }

          </div>

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

          <strong>
            ${score}
          </strong>

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


      container.appendChild(
        row
      );

    }
  );

}


// =====================================================
// ЦЕЛИ ДЛЯ MATCH
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) return;


  const previousValue =
    select.value;


  select.innerHTML =
    `<option value="">
      Не выбрано
    </option>`;


  const goals =
    [
      ...new Set(

        coaches
          .map(
            function (coach) {

              return coach.goal;

            }
          )
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
    [...select.options].some(
      function (option) {

        return (
          option.value ===
          previousValue
        );

      }
    );


  if (exists) {

    select.value =
      previousValue;

  }

}


// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

async function openProfile(coachId) {

  const coach =
    coaches.find(
      function (item) {

        return (
          String(item.id) ===
          String(coachId)
        );

      }
    );


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


  const reviews =
    result.error
      ? []
      : (
          result.data || []
        );


  const canReview =

    Boolean(currentUser) &&

    String(currentUser.id) !==
    String(coach.user_id);


  const image =
    getCoachImage(coach);


  const score =
    calculateScore(coach);


  const experience =
    coach.experience_years ||
    coach.experience;


  const reviewHTML =
    reviews.length

      ? reviews
          .map(
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
          )
          .join("")

      : `

          <p class="lead">
            Отзывов пока нет.
          </p>

        `;


  profileContent.innerHTML = `

    <div class="match-box">

      <img
        class="profile-image"
        src="${esc(image)}"
        alt="${esc(coach.name || "Тренер")}"
      >

      <p class="eyebrow">
        FITMATCH COACH
      </p>

      <h1 class="page-title">

        ${esc(
          coach.name ||
          "Тренер"
        )}

      </h1>

      <p class="lead">

        ${esc(
          sportName(
            coach.sport
          )
        )}

        ·

        ${esc(
          coach.format ||
          ""
        )}

        ${
          coach.city
            ? " · " +
              esc(coach.city)
            : ""
        }

      </p>


      <div class="tags">

        ${
          coach.specialization
            ? `
              <span class="tag">
                ${esc(
                  coach.specialization
                )}
              </span>
            `
            : ""
        }

        ${
          coach.goal
            ? `
              <span class="tag">
                ${esc(
                  coach.goal
                )}
              </span>
            `
            : ""
        }

        ${
          experience
            ? `
              <span class="tag">
                ${esc(experience)}
                лет опыта
              </span>
            `
            : ""
        }

        ${
          coach.verified
            ? `
              <span class="tag">
                ✓ Проверенный тренер
              </span>
            `
            : ""
        }

      </div>


      <h2>
        FITMATCH SCORE:
        <span style="color:var(--accent)">
          ${score}
        </span>
      </h2>


      <p class="lead">

        ⭐ Рейтинг:
        <strong>
          ${Number(
            coach.rating || 0
          ).toFixed(1)}
        </strong>

      </p>


      <p class="lead">

        💶
        ${esc(
          priceText(coach)
        )}

      </p>


      <h2>
        О тренере
      </h2>

      <p class="lead">

        ${esc(
          coach.bio ||
          "Информация пока не добавлена."
        )}

      </p>


      ${
        coach.education

          ? `

            <h2>
              Образование
            </h2>

            <p class="lead">
              ${esc(
                coach.education
              )}
            </p>

          `

          : ""
      }


      ${
        coach.achievements_summary

          ? `

            <h2>
              Титулы и достижения
            </h2>

            <p class="lead">
              ${esc(
                coach.achievements_summary
              )}
            </p>

          `

          : ""
      }


      <h2>
        Отзывы
      </h2>

      ${reviewHTML}


      ${
        currentUser &&
        canReview

          ? `

            <form
              id="reviewForm"
              class="form"
              style="margin-top:25px"
            >

              <h2>
                Оставить отзыв
              </h2>

              <label>

                Оценка

                <select
                  name="rating"
                  required
                >

                  <option value="5">
                    ⭐⭐⭐⭐⭐ 5
                  </option>

                  <option value="4">
                    ⭐⭐⭐⭐ 4
                  </option>

                  <option value="3">
                    ⭐⭐⭐ 3
                  </option>

                  <option value="2">
                    ⭐⭐ 2
                  </option>

                  <option value="1">
                    ⭐ 1
                  </option>

                </select>

              </label>


              <label>

                Ваш отзыв

                <textarea
                  name="text"
                  rows="4"
                  placeholder="Расскажите о своём опыте..."
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

          `

          : ""
      }


      <div class="actions">

        <button
          class="btn btn-primary"
          id="contactCoachBtn"
          type="button"
        >

          СВЯЗАТЬСЯ С ТРЕНЕРОМ →

        </button>


        <button
          class="btn"
          id="backToCoachesBtn"
          type="button"
        >

          ← К ТРЕНЕРАМ

        </button>

      </div>

    </div>

  `;


  document
    .getElementById(
      "backToCoachesBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        showPage("coaches");

      }
    );


  document
    .getElementById(
      "contactCoachBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        alert(
          "Система заявок и бронирования будет следующим этапом FITMATCH."
        );

      }
    );


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
            event.currentTarget
          );


        const rating =
          Number(
            formData.get("rating")
          );


        const text =
          String(
            formData.get("text") ||
            ""
          ).trim();


        const message =
          document.getElementById(
            "reviewMessage"
          );


        if (
          !Number.isFinite(rating) ||
          rating < 1 ||
          rating > 5
        ) {

          if (message) {

            message.textContent =
              "Укажите корректную оценку.";

            message.className =
              "error";

          }

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

          if (message) {

            if (
              response.error.code ===
              "23505"
            ) {

              message.textContent =
                "Вы уже оставляли отзыв этому тренеру.";

            } else {

              message.textContent =
                response.error.message;

            }


            message.className =
              "error";

          }

          return;

        }


        if (message) {

          message.textContent =
            "Спасибо за отзыв!";

          message.className =
            "success";

        }


        await loadData();

        await openProfile(
          coach.id
        );

      }
    );

  }

}


// =====================================================
// MATCH
// =====================================================

function calculateMatch(
  coach,
  sport,
  goal,
  format
) {

  let score = 0;


  if (!sport) {

    score += 20;

  } else if (

    String(coach.sport) ===
    String(sport)

  ) {

    score += 50;

  }


  if (!goal) {

    score += 15;

  } else if (

    String(
      coach.goal || ""
    )
      .toLowerCase()
      .includes(
        String(goal)
          .toLowerCase()
      )

  ) {

    score += 25;

  }


  if (!format) {

    score += 15;

  } else if (

    coach.format === format

  ) {

    score += 15;

  }


  const rating =
    Number(coach.rating || 0);


  score +=
    Math.min(
      10,
      rating * 2
    );


  return Math.min(
    100,
    Math.round(score)
  );

}


function findMatch() {

  const sport =
    document.getElementById(
      "matchSport"
    )?.value;


  const goal =
    document.getElementById(
      "matchGoal"
    )?.value;


  const format =
    document.getElementById(
      "matchFormat"
    )?.value;


  const container =
    document.getElementById(
      "matchResults"
    );


  if (!container) return;


  const results =
    coaches
      .map(
        function (coach) {

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

        }
      )
      .sort(
        function (a, b) {

          return (
            b.percent -
            a.percent
          );

        }
      )
      .slice(0, 5);


  container.innerHTML =
    "";


  if (!results.length) {

    container.innerHTML = `

      <p class="lead">
        Пока нет доступных тренеров.
      </p>

    `;

    return;

  }


  results.forEach(
    function (result) {

      const coach =
        result.coach;


      const element =
        document.createElement(
          "div"
        );


      element.className =
        "match-result";


      element.innerHTML = `

        <div>

          <b>
            ${esc(
              coach.name
            )}
          </b>

          <div
            class="lead"
          >

            ${esc(
              sportName(
                coach.sport
              )
            )}

            ${
              coach.goal
                ? " · " +
                  esc(coach.goal)
                : ""
            }

          </div>

        </div>


        <div
          class="match-percent"
        >

          ${result.percent}%

        </div>

      `;


      element.addEventListener(
        "click",
        function () {

          openProfile(
            coach.id
          );

        }
      );


      container.appendChild(
        element
      );

    }
  );

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


  const cyclingBannerCta =
    document.getElementById(
      "cyclingBannerCta"
    );


  if (cyclingBannerCta) {

    cyclingBannerCta.addEventListener(
      "click",
      function () {

        document
          .getElementById(
            "coachesList"
          )
          ?.scrollIntoView({

            behavior:
              "smooth"

          });

      }
    );

  }

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
// МОДАЛЬНЫЕ ОКНА
// =====================================================

function initModals() {

  const modalIds = [

    "modal",

    "resetPasswordModal",

    "coachModal"

  ];


  modalIds.forEach(
    function (id) {

      const modal =
        document.getElementById(id);


      if (!modal) return;


      modal.addEventListener(
        "click",
        function (event) {

          if (
            event.target === modal
          ) {

            toggleModal(
              id,
              false
            );

          }

        }
      );

    }
  );


  document
    .getElementById(
      "modalCancel"
    )
    ?.addEventListener(
      "click",
      function () {

        toggleModal(
          "modal",
          false
        );

      }
    );


  document
    .getElementById(
      "resetCancel"
    )
    ?.addEventListener(
      "click",
      function () {

        toggleModal(
          "resetPasswordModal",
          false
        );

      }
    );


  document
    .getElementById(
      "coachCancel"
    )
    ?.addEventListener(
      "click",
      function () {

        toggleModal(
          "coachModal",
          false
        );

      }
    );

}


// =====================================================
// AUTH BUTTON
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

      await refreshUser();


      if (currentUser) {

        const response =
          await supabase.auth.signOut();


        if (response.error) {

          alert(
            response.error.message
          );

          return;

        }


        currentUser =
          null;


        refreshUser();

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
// ОБНОВЛЕНИЕ UI ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function refreshUser() {

  const result =
    await supabase.auth.getSession();


  currentUser =
    result.data?.session?.user ||
    null;


  const button =
    document.getElementById(
      "authBtn"
    );


  const createButton =
    document.getElementById(
      "createBtn"
    );


  if (button) {

    button.textContent =
      currentUser
        ? "Выйти"
        : "Войти";

  }


  if (createButton) {

    createButton.textContent =
      currentUser
        ? "Мой профиль тренера"
        : "Стать тренером";

  }

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
        await supabase
          .auth
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


      showMessage(
        "authMessage",
        "Вход выполнен."
      );


      await refreshUser();


      setTimeout(
        function () {

          toggleModal(
            "modal",
            false
          );

        },
        400
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


      if (!email) {

        showMessage(
          "authMessage",
          "Введите email.",
          true
        );

        return;

      }


      if (
        password.length < 6
      ) {

        showMessage(
          "authMessage",
          "Пароль должен содержать минимум 6 символов.",
          true
        );

        return;

      }


      showMessage(
        "authMessage",
        "Создание аккаунта..."
      );


      const response =
        await supabase
          .auth
          .signUp({

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
        response.data?.session
      ) {

        currentUser =
          response.data.session.user;


        await refreshUser();


        showMessage(
          "authMessage",
          "Аккаунт успешно создан."
        );

      } else {

        showMessage(
          "authMessage",
          "Регистрация выполнена. Проверьте email и подтвердите аккаунт."
        );

      }

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
          "Сначала введите email.",
          true
        );

        return;

      }


      const response =
        await supabase
          .auth
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
// НОВЫЙ ПАРОЛЬ
// =====================================================

function initResetPassword() {

  const form =
    document.getElementById(
      "resetPasswordForm"
    );


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


      if (
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
        await supabase
          .auth
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
        function () {

          toggleModal(
            "resetPasswordModal",
            false
          );

          window.location.hash =
            "";

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
// СОЗДАТЬ / РЕДАКТИРОВАТЬ ТРЕНЕРА
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


      const existing =
        coaches.find(
          function (coach) {

            return (
              String(coach.user_id) ===
              String(currentUser.id)
            );

          }
        );


      if (existing) {

        openProfile(
          existing.id
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
        formData.get("format") ||
        "Онлайн";


      const price =
        Number(
          formData.get("price")
        );


      const period =
        formData.get("period") ||
        "месяц";


      const bio =
        String(
          formData.get("bio") || ""
        ).trim() ||
        null;


      // Новые поля.
      // Если соответствующих input пока нет в index.html,
      // они просто сохранятся как null.

      const imageUrl =
        String(
          formData.get("image_url") || ""
        ).trim() ||
        null;


      const city =
        String(
          formData.get("city") || ""
        ).trim() ||
        null;


      const specialization =
        String(
          formData.get("specialization") || ""
        ).trim() ||
        null;


      const experienceYearsRaw =
        formData.get(
          "experience_years"
        );


      const experienceYears =
        experienceYearsRaw !== null &&
        experienceYearsRaw !== ""
          ? Number(experienceYearsRaw)
          : null;


      const education =
        String(
          formData.get("education") || ""
        ).trim() ||
        null;


      const achievementsSummary =
        String(
          formData.get(
            "achievements_summary"
          ) || ""
        ).trim() ||
        null;


      if (
        !name ||
        !sport
      ) {

        showMessage(
          "coachMessage",
          "Заполните имя и вид спорта.",
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


      if (
        experienceYears !== null &&
        (
          !Number.isFinite(
            experienceYears
          ) ||
          experienceYears < 0
        )
      ) {

        showMessage(
          "coachMessage",
          "Укажите корректный опыт работы.",
          true
        );

        return;

      }


      showMessage(
        "coachMessage",
        "Создание профиля..."
      );


      const existing =
        coaches.find(
          function (coach) {

            return (
              String(coach.user_id) ===
              String(currentUser.id)
            );

          }
        );


      const payload = {

        user_id:
          currentUser.id,

        name,

        sport,

        goal,

        format,

        price,

        period,

        bio,

        image_url:
          imageUrl,

        city,

        specialization,

        experience_years:
          experienceYears,

        education,

        achievements_summary:
          achievementsSummary

      };


      let response;


      if (existing) {

        response =
          await supabase
            .from("coaches")
            .update(payload)
            .eq(
              "id",
              existing.id
            );

      } else {

        response =
          await supabase
            .from("coaches")
            .insert(payload);

      }


      if (response.error) {

        console.error(
          response.error
        );


        showMessage(
          "coachMessage",
          response.error.message,
          true
        );

        return;

      }


      showMessage(
        "coachMessage",

        existing
          ? "Профиль обновлён."
          : "Профиль тренера успешно создан."

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
        800
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
    function (
      event,
      session
    ) {

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
