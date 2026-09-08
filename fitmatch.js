import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// APLEX — SUPABASE
// =====================================================

// ОСТАВЛЯЕМ ТЕКУЩЕЕ ПОДКЛЮЧЕНИЕ SUPABASE

const SUPABASE_URL =
  "https://ypbhcgcwkpiujcakvaji.supabase.co";

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
// НОРМАЛИЗАЦИЯ СПОРТА
// =====================================================

function normalizeSport(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");

}


// =====================================================
// КЛЮЧ СПОРТА
// =====================================================

function getSportKey(value) {

  const raw =
    normalizeSport(value);

  if (!raw) {

    return "fitness";

  }


  if (SPORT_ALIASES[raw]) {

    return SPORT_ALIASES[raw];

  }


  if (
    raw.includes("бодибил") ||
    raw.includes("bodybuild")
  ) {

    return "bodybuilding";

  }


  if (
    raw.includes("фитнес") ||
    raw.includes("fitness")
  ) {

    return "fitness";

  }


  if (
    raw.includes("кросс") ||
    raw.includes("crossfit")
  ) {

    return "crossfit";

  }


  if (
    raw.includes("бег") ||
    raw.includes("running")
  ) {

    return "running";

  }


  if (
    raw.includes("йог") ||
    raw.includes("yoga")
  ) {

    return "yoga";

  }


  if (
    raw.includes("плав") ||
    raw.includes("swimming")
  ) {

    return "swimming";

  }


  if (
    raw.includes("вел") ||
    raw.includes("cycling")
  ) {

    return "cycling";

  }


  if (
    raw.includes("теннис") ||
    raw.includes("tennis")
  ) {

    return "tennis";

  }


  if (
    raw.includes("бокс") ||
    raw.includes("boxing") ||
    raw.includes("mma") ||
    raw.includes("единобор")
  ) {

    return "combat";

  }


  if (
    raw.includes("футбол") ||
    raw.includes("football")
  ) {

    return "football";

  }


  return "fitness";

}


// =====================================================
// НАЗВАНИЕ СПОРТА ПО ID
// =====================================================

function sportName(id) {

  const sport =
    sports.find(function (item) {

      return (
        String(item.id) ===
        String(id)
      );

    });


  return sport
    ? sport.name
    : (
      id ||
      "Не указан"
    );

}


// =====================================================
// СПОРТ ПО ID
// =====================================================

function getSportById(id) {

  return sports.find(
    function (sport) {

      return (
        String(sport.id) ===
        String(id)
      );

    }
  );

}


// =====================================================
// КЛЮЧ СПОРТА ПО ID
// =====================================================

function sportKeyById(id) {

  const sport =
    getSportById(id);


  if (sport) {

    return getSportKey(
      sport.name
    );

  }


  return getSportKey(id);

}


// =====================================================
// ИЗОБРАЖЕНИЕ СПОРТА
// =====================================================

function getSportImage(sport) {

  let value = sport;


  if (
    sport &&
    typeof sport === "object"
  ) {

    value =
      sport.name ||
      sport.slug ||
      sport.id;

  }


  const key =
    getSportKey(value);


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
    String(
      coach.image_url
    ).trim()
  ) {

    return coach.image_url;

  }


  if (
    coach?.avatar_url &&
    String(
      coach.avatar_url
    ).trim()
  ) {

    return coach.avatar_url;

  }


  const id =
    String(
      coach?.id || "0"
    );


  let number = 0;


  for (
    let i = 0;
    i < id.length;
    i++
  ) {

    number +=
      id.charCodeAt(i);

  }


  return COACH_IMAGES[
    number %
    COACH_IMAGES.length
  ];

}


// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {

  const price =
    Number(
      coach?.price
    );


  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {

    return "Цена по запросу";

  }


  return (
    `€${price} / ` +
    (
      coach.period ||
      "месяц"
    )
  );

}


// =====================================================
// ПОКАЗ СТРАНИЦЫ
// =====================================================

function showPage(id) {

  document
    .querySelectorAll(".page")
    .forEach(
      function (page) {

        page.classList.remove(
          "active"
        );

      }
    );


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

function toggleModal(
  id,
  show
) {

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
      .order(
        "name",
        {
          ascending: true
        }
      );


  if (sportsResult.error) {

    console.error(
      "Ошибка загрузки спорта:",
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

  }

  else {

    coaches =
      coachesResult.data || [];


    coaches.sort(
      function (a, b) {

        return (
          Number(b.score || 0) -
          Number(a.score || 0)
        );

      }
    );

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
    document.createElement("article");


  card.className =
    "sport-card";


  const image =
    getSportImage(
      sport
    );


  card.style.backgroundImage =
    `linear-gradient(
      rgba(0,0,0,.28),
      rgba(0,0,0,.58)
    ),
    url("${image}")`;


  card.innerHTML = `

    <div class="sport-card-content">

      <div class="sport-icon">

        ${esc(
          sport.icon || "🏅"
        )}

      </div>

      <h3>

        ${esc(
          sport.name
        )}

      </h3>

      <p>

        Найти тренера →

      </p>

    </div>

  `;


  card.addEventListener(
    "click",
    function () {

      showPage(
        "coaches"
      );


      const filter =
        document.getElementById(
          "sportFilter"
        );


      if (filter) {

        filter.value =
          String(
            sport.id
          );

      }


      renderCoaches();

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
            Выберите вид спорта
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
        Array.from(
          select.options
        ).some(
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
// КАРТОЧКА ТРЕНЕРА
// =====================================================

function createCoachCard(coach) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "coach-card";


  const image =
    getCoachImage(
      coach
    );


  const sport =
    getSportById(
      coach.sport
    );


  card.innerHTML = `

    <div class="coach-image">

      <img
        src="${esc(image)}"
        alt="${esc(
          coach.name ||
          "Тренер"
        )}"
        loading="lazy"
      >

    </div>


    <div class="coach-content">

      <div class="coach-score">

        ${Number(
          coach.score || 0
        )}

      </div>


      <h3>

        ${esc(
          coach.name ||
          "Тренер"
        )}

      </h3>


      <p class="coach-sport">

        ${esc(
          sport?.icon || ""
        )}

        ${esc(
          sport?.name ||
          sportName(
            coach.sport
          )
        )}

      </p>


      <div class="tags">

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
          coach.format
            ? `
              <span class="tag">
                ${esc(
                  coach.format
                )}
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

          ${esc(
            priceText(
              coach
            )
          )}

        </span>

      </div>

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


  const searchInput =
    document.getElementById(
      "searchInput"
    );


  const container =
    document.getElementById(
      "coachesList"
    );


  if (!container) return;


  const sportValue =
    sportFilter?.value || "";


  const formatValue =
    formatFilter?.value || "";


  const search =
    normalizeSport(
      searchInput?.value || ""
    );


  const filtered =
    coaches.filter(
      function (coach) {

        const matchesSport =

          !sportValue ||

          String(
            coach.sport
          ) ===
          String(
            sportValue
          );


        const matchesFormat =

          !formatValue ||

          coach.format ===
          formatValue;


        const sportText =
          sportName(
            coach.sport
          );


        const haystack =
          normalizeSport(

            [

              coach.name,

              coach.goal,

              coach.bio,

              coach.format,

              sportText

            ]
              .filter(Boolean)
              .join(" ")

          );


        const matchesSearch =

          !search ||

          haystack.includes(
            search
          );


        return (

          matchesSport &&

          matchesFormat &&

          matchesSearch

        );

      }
    );


  container.replaceChildren(
    ...filtered.map(
      createCoachCard
    )
  );


  if (
    !filtered.length
  ) {

    container.innerHTML = `

      <p class="empty">

        Тренеры по этим параметрам
        пока не найдены.

      </p>

    `;

  }


  updateCategoryBanner();

}


// =====================================================
// ТОП ТРЕНЕРОВ
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

            Number(
              b.score || 0
            )

            -

            Number(
              a.score || 0
            )

          );

        }
      )

      .slice(
        0,
        3
      );


  container.replaceChildren(
    ...top.map(
      createCoachCard
    )
  );


  if (
    !top.length
  ) {

    container.innerHTML = `

      <p class="empty">

        Пока нет зарегистрированных
        тренеров.

      </p>

    `;

  }

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


  const ranked =
    [...coaches]

      .sort(
        function (a, b) {

          return (

            Number(
              b.rating || 0
            )

            -

            Number(
              a.rating || 0
            )

          );

        }
      );


  if (
    !ranked.length
  ) {

    container.innerHTML = `

      <p class="empty">

        Рейтинг появится,
        когда появятся тренеры.

      </p>

    `;


    return;

  }


  container.innerHTML =
    ranked.map(
      function (
        coach,
        index
      ) {

        return `

          <article
            class="ranking-item"
          >

            <div class="ranking-position">

              ${index + 1}

            </div>


            <div>

              <strong>

                ${esc(
                  coach.name ||
                  "Тренер"
                )}

              </strong>


              <p>

                ${esc(
                  sportName(
                    coach.sport
                  )
                )}

              </p>

            </div>


            <div>

              ⭐ ${Number(
                coach.rating || 0
              ).toFixed(1)}

            </div>

          </article>

        `;

      }
    ).join("");

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


  const goals =
    Array.from(

      new Set(

        coaches
          .map(
            function (coach) {

              return coach.goal;

            }
          )

          .filter(Boolean)

      )

    );


  select.innerHTML =
    `<option value="">
      Любая цель
    </option>`;


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

}


// =====================================================
// MATCH
// =====================================================

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


  let results =
    coaches.map(
      function (coach) {

        let score = 0;


        if (
          sport &&
          String(
            coach.sport
          ) ===
          String(
            sport
          )
        ) {

          score += 3;

        }


        if (
          goal &&
          normalizeSport(
            coach.goal
          ).includes(
            normalizeSport(goal)
          )
        ) {

          score += 2;

        }


        if (
          format &&
          coach.format ===
          format
        ) {

          score += 1;

        }


        return {

          coach,

          score

        };

      }
    );


  results =
    results

      .filter(
        function (item) {

          return (

            !sport &&
            !goal &&
            !format

          )

          ||

          item.score > 0;

        }
      )

      .sort(
        function (a, b) {

          return (

            b.score -

            a.score

          )

          ||

          (

            Number(
              b.coach.rating || 0
            )

            -

            Number(
              a.coach.rating || 0
            )

          );

        }
      )

      .slice(
        0,
        5
      );


  container.replaceChildren(
    ...results.map(
      function (item) {

        return createCoachCard(
          item.coach
        );

      }
    )
  );


  if (
    !results.length
  ) {

    container.innerHTML = `

      <p class="empty">

        Подходящих тренеров
        пока не найдено.

      </p>

    `;

  }

}


// =====================================================
// КАТЕГОРИЙНЫЙ БАННЕР
// =====================================================

function updateCategoryBanner() {

  const filter =
    document.getElementById(
      "sportFilter"
    );


  const banner =
    document.getElementById(
      "categoryBanner"
    );


  if (
    !filter ||
    !banner
  ) {

    return;

  }


  if (
    !filter.value
  ) {

    banner.style.display =
      "none";


    return;

  }


  const sport =
    getSportById(
      filter.value
    );


  if (!sport) {

    banner.style.display =
      "none";


    return;

  }


  const image =
    getSportImage(
      sport
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


  const graphic =
    document.getElementById(
      "categoryBannerGraphic"
    );


  banner.style.display =
    "block";


  banner.style.backgroundImage =
    `linear-gradient(
      rgba(0,0,0,.35),
      rgba(0,0,0,.7)
    ),
    url("${image}")`;


  if (title) {

    title.textContent =
      sport.name;

  }


  if (subtitle) {

    subtitle.textContent =
      `Найдите тренера по направлению ${sport.name}.`;

  }


  if (stats) {

    const count =
      coaches.filter(
        function (coach) {

          return (

            String(
              coach.sport
            ) ===
            String(
              sport.id
            )

          );

        }
      ).length;


    stats.innerHTML = `

      <div class="category-banner-stat">

        ${count} тренеров

      </div>


      <div class="category-banner-stat">

        APLEX

      </div>


      <div class="category-banner-stat">

        Find your level.

      </div>

    `;

  }


  if (graphic) {

    graphic.innerHTML = "";

  }

}


// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

function openProfile(id) {

  const coach =
    coaches.find(
      function (item) {

        return (

          String(
            item.id
          ) ===
          String(
            id
          )

        );

      }
    );


  if (!coach) return;


  const container =
    document.getElementById(
      "profileContent"
    );


  if (!container) return;


  const image =
    getCoachImage(
      coach
    );


  container.innerHTML = `

    <article class="coach-profile">

      <div class="coach-profile-image">

        <img
          src="${esc(image)}"
          alt="${esc(
            coach.name ||
            "Тренер"
          )}"
        >

      </div>


      <div class="coach-profile-info">

        <p class="eyebrow">

          APLEX

        </p>


        <h1>

          ${esc(
            coach.name ||
            "Тренер"
          )}

        </h1>


        <p>

          ${esc(
            sportName(
              coach.sport
            )
          )}

        </p>


        <p>

          ${esc(
            coach.goal ||
            ""
          )}

        </p>


        <p>

          ${esc(
            coach.format ||
            ""
          )}

        </p>


        <p>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </p>


        <p>

          ${esc(
            priceText(
              coach
            )
          )}

        </p>


        <p>

          ${esc(
            coach.bio ||
            "Описание пока не добавлено."
          )}

        </p>


        <button
          id="backToCoaches"
          class="btn"
          type="button"
        >

          ← К ТРЕНЕРАМ

        </button>

      </div>

    </article>

  `;


  document
    .getElementById(
      "backToCoaches"
    )
    ?.addEventListener(
      "click",
      function () {

        showPage(
          "coaches"
        );

      }
    );


  showPage(
    "profile"
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

        showPage(
          "home"
        );

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


  document
    .getElementById(
      "matchBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        showPage(
          "match"
        );

      }
    );


  document
    .getElementById(
      "chooseSportBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        showPage(
          "sports"
        );

      }
    );

}


// =====================================================
// ФИЛЬТРЫ
// =====================================================

function initFilters() {

  document
    .getElementById(
      "sportFilter"
    )
    ?.addEventListener(
      "change",
      renderCoaches
    );


  document
    .getElementById(
      "formatFilter"
    )
    ?.addEventListener(
      "change",
      renderCoaches
    );


  document
    .getElementById(
      "searchInput"
    )
    ?.addEventListener(
      "input",
      renderCoaches
    );


  document
    .getElementById(
      "findMatchBtn"
    )
    ?.addEventListener(
      "click",
      findMatch
    );


  document
    .getElementById(
      "cyclingBannerCta"
    )
    ?.addEventListener(
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
  ) {

    return;

  }


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
          ? "true"
          : "false"

      );

    }
  );

}


// =====================================================
// МОДАЛЬНЫЕ ОКНА
// =====================================================

function initModals() {

  document
    .getElementById(
      "authClose"
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
      "coachClose"
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


  document
    .getElementById(
      "resetClose"
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
// КНОПКА ВХОДА
// =====================================================

function initAuthButton() {

  document
    .getElementById(
      "authBtn"
    )
    ?.addEventListener(
      "click",
      async function () {

        if (currentUser) {

          const result =
            await supabase.auth.signOut();


          if (result.error) {

            alert(
              result.error.message
            );

          }


          return;

        }


        toggleModal(
          "modal",
          true
        );

      }
    );


  document
    .getElementById(
      "createBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        if (!currentUser) {

          toggleModal(
            "modal",
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
// ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function refreshUser() {

  const result =
    await supabase.auth.getUser();


  currentUser =
    result.data?.user ||
    null;


  const authBtn =
    document.getElementById(
      "authBtn"
    );


  const createBtn =
    document.getElementById(
      "createBtn"
    );


  if (authBtn) {

    authBtn.textContent =
      currentUser
        ? "Выйти"
        : "Войти";

  }


  if (createBtn) {

    createBtn.textContent =
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
          ?.value
          .trim();


      const password =
        document
          .getElementById(
            "authPassword"
          )
          ?.value;


      const message =
        document.getElementById(
          "authMessage"
        );


      if (message) {

        message.textContent =
          "Выполняется вход...";

      }


      const result =
        await supabase.auth
          .signInWithPassword({

            email,

            password

          });


      if (result.error) {

        showMessage(

          "authMessage",

          result.error.message,

          true

        );


        return;

      }


      showMessage(

        "authMessage",

        "Добро пожаловать в APLEX."

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


  document
    .getElementById(
      "signupBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        toggleModal(
          "modal",
          false
        );


        document
          .getElementById(
            "signupSection"
          )
          ?.scrollIntoView({

            behavior: "smooth"

          });

      }
    );

}


// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

function initSignup() {

  const form =
    document.getElementById(
      "signupForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const email =
        form.email.value
          .trim();


      const password =
        form.password.value;


      showMessage(

        "signupMessage",

        "Создаём аккаунт..."

      );


      const result =
        await supabase.auth
          .signUp({

            email,

            password

          });


      if (result.error) {

        showMessage(

          "signupMessage",

          result.error.message,

          true

        );


        return;

      }


      showMessage(

        "signupMessage",

        "Аккаунт создан. Проверьте email для подтверждения."

      );


      form.reset();

    }
  );

}


// =====================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// =====================================================

function initForgotPassword() {

  document
    .getElementById(
      "forgotPasswordBtn"
    )
    ?.addEventListener(
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

            "Введите email.",

            true

          );


          return;

        }


        const result =
          await supabase.auth
            .resetPasswordForEmail(

              email,

              {

                redirectTo:
                  window.location.origin

              }

            );


        if (result.error) {

          showMessage(

            "authMessage",

            result.error.message,

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
          ?.value;


      const confirm =
        document
          .getElementById(
            "confirmPassword"
          )
          ?.value;


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


      const result =
        await supabase.auth
          .updateUser({

            password

          });


      if (result.error) {

        showMessage(

          "resetMessage",

          result.error.message,

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

        },
        700
      );

    }
  );

}


// =====================================================
// РЕЖИМ ВОССТАНОВЛЕНИЯ
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
// ОТКРЫТИЕ СОЗДАНИЯ ТРЕНЕРА
// =====================================================

function initCreateCoach() {

  const createBtn =
    document.getElementById(
      "createBtn"
    );


  if (!createBtn) return;


  createBtn.addEventListener(
    "click",
    async function () {

      if (!currentUser) return;


      toggleModal(
        "coachModal",
        true
      );


      const select =
        document.getElementById(
          "coachSport"
        );


      if (
        select &&
        !select.options.length
      ) {

        renderSports();

      }

    }
  );

}


// =====================================================
// СОЗДАНИЕ ТРЕНЕРА
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


      if (!currentUser) {

        toggleModal(
          "coachModal",
          false
        );


        toggleModal(
          "modal",
          true
        );


        return;

      }


      const data =
        new FormData(form);


      const payload = {

        user_id:
          currentUser.id,

        name:
          String(
            data.get("name") ||
            ""
          ).trim(),

        sport:
          data.get("sport"),

        goal:
          String(
            data.get("goal") ||
            ""
          ).trim(),

        format:
          data.get("format"),

        price:
          Number(
            data.get("price")
          ),

        period:
          data.get("period"),

        bio:
          String(
            data.get("bio") ||
            ""
          ).trim()

      };


      const message =
        document.getElementById(
          "coachMessage"
        );


      if (!payload.name) {

        showMessage(

          "coachMessage",

          "Введите имя.",

          true

        );


        return;

      }


      if (!payload.sport) {

        showMessage(

          "coachMessage",

          "Выберите вид спорта.",

          true

        );


        return;

      }


      if (
        !Number.isFinite(
          payload.price
        )
      ) {

        showMessage(

          "coachMessage",

          "Введите корректную цену.",

          true

        );


        return;

      }


      if (message) {

        message.textContent =
          "Сохраняем профиль...";

      }


      const existing =
        await supabase

          .from("coaches")

          .select("id")

          .eq(
            "user_id",
            currentUser.id
          )

          .maybeSingle();


      if (existing.error) {

        showMessage(

          "coachMessage",

          existing.error.message,

          true

        );


        return;

      }


      let result;


      if (existing.data) {

        result =
          await supabase

            .from("coaches")

            .update(
              payload
            )

            .eq(
              "id",
              existing.data.id
            );

      }

      else {

        result =
          await supabase

            .from("coaches")

            .insert(
              payload
            );

      }


      if (result.error) {

        showMessage(

          "coachMessage",

          result.error.message,

          true

        );


        return;

      }


      showMessage(

        "coachMessage",

        "Профиль тренера успешно сохранён."

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
// СОСТОЯНИЕ АВТОРИЗАЦИИ
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
// HERO SLIDESHOW
// =====================================================

function initHeroSlideshow() {

  const hero =
    document.getElementById(
      "heroSlideshow"
    );


  if (!hero) return;


  const images =
    Object.values(
      SPORT_IMAGES
    );


  if (!images.length) {

    return;

  }


  let index = 0;


  function showImage() {

    hero.style.backgroundImage =
      `url("${images[index]}")`;


    index =
      (
        index + 1
      )
      %
      images.length;

  }


  showImage();


  setInterval(

    showImage,

    7000

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

  initHeroSlideshow();


  try {

    await refreshUser();

    await loadData();

  }

  catch (error) {

    console.error(
      "APLEX ERROR:",
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


// =====================================================
// START
// =====================================================

init();
