import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


// =====================================================
// SUPABASE
// =====================================================

const SUPABASE_URL =
  "https://ypbhcgcwkpiujcakvaji.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV";


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// =====================================================
// STATE
// =====================================================

let sports = [];

let coaches = [];

let currentUser = null;


// =====================================================
// IMAGES
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

  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=85"

];


// =====================================================
// SAFE HTML
// =====================================================

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      function (char) {

        const map = {

          "&": "&amp;",

          "<": "&lt;",

          ">": "&gt;",

          '"': "&quot;",

          "'": "&#039;"

        };

        return map[char];

      }
    );

}


// =====================================================
// INITIALS
// =====================================================

function initials(name) {

  return String(name || "")

    .trim()

    .split(/\s+/)

    .map(
      function (word) {
        return word[0] || "";
      }
    )

    .slice(0, 2)

    .join("")

    .toUpperCase();

}


// =====================================================
// SPORT KEY
// =====================================================

function getSportKey(value) {

  const text = String(value || "")
    .toLowerCase()
    .trim();


  if (
    text.includes("бодибилдинг") ||
    text.includes("bodybuilding")
  ) {

    return "bodybuilding";

  }


  if (
    text.includes("фитнес") ||
    text.includes("fitness")
  ) {

    return "fitness";

  }


  if (
    text.includes("кроссфит") ||
    text.includes("crossfit")
  ) {

    return "crossfit";

  }


  if (
    text.includes("бег") ||
    text.includes("running")
  ) {

    return "running";

  }


  if (
    text.includes("йога") ||
    text.includes("yoga")
  ) {

    return "yoga";

  }


  if (
    text.includes("плав") ||
    text.includes("swimming")
  ) {

    return "swimming";

  }


  if (
    text.includes("вел") ||
    text.includes("cycling")
  ) {

    return "cycling";

  }


  if (
    text.includes("теннис") ||
    text.includes("tennis")
  ) {

    return "tennis";

  }


  if (
    text.includes("единобор") ||
    text.includes("бокс") ||
    text.includes("boxing") ||
    text.includes("mma")
  ) {

    return "combat";

  }


  return "fitness";

}


// =====================================================
// SPORT IMAGE
// =====================================================

function getSportImage(value) {

  const key = getSportKey(value);

  return (
    SPORT_IMAGES[key] ||
    SPORT_IMAGES.fitness
  );

}


// =====================================================
// COACH IMAGE
// =====================================================

function getCoachImage(coach) {

  if (coach.image_url) {

    return coach.image_url;

  }


  const id = String(coach.id || "");

  let number = 0;


  for (
    let i = 0;
    i < id.length;
    i++
  ) {

    number += id.charCodeAt(i);

  }


  return COACH_IMAGES[
    number % COACH_IMAGES.length
  ];

}


// =====================================================
// SPORT NAME
// =====================================================

function sportName(id) {

  const sport = sports.find(
    function (item) {

      return (
        String(item.id) ===
        String(id)
      );

    }
  );


  return sport
    ? sport.name
    : id || "Не указан";

}


// =====================================================
// PRICE
// =====================================================

function priceText(coach) {

  const price =
    Number(coach.price || 0);

  const period =
    coach.period || "месяц";


  return `€${price} / ${period}`;

}


// =====================================================
// CATEGORY VISUALS
// =====================================================

const CATEGORY_VISUALS = {

  bodybuilding: {

    title: "БОДИБИЛДИНГ",

    subtitle:
      "Мышечная масса, сила и рельеф под руководством профессионального тренера",

    stats: [
      "СИЛА",
      "МАССА",
      "РЕЛЬЕФ"
    ],

    icon:
      `<path
        d="M70 180
        C110 110 150 110 200 160
        C250 110 300 110 340 180"
        stroke="currentColor"
        stroke-width="12"
        fill="none"
        stroke-linecap="round"
      />`

  },


  fitness: {

    title: "ФИТНЕС",

    subtitle:
      "Форма, здоровье, энергия и уверенность в своём теле",

    stats: [
      "ФОРМА",
      "ЭНЕРГИЯ",
      "ЗДОРОВЬЕ"
    ],

    icon:
      `<path
        d="M30 190
        H130
        L150 120
        L185 260
        L215 150
        L245 190
        H370"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
      />`

  },


  crossfit: {

    title: "КРОССФИТ",

    subtitle:
      "Функциональная сила, скорость и максимальная выносливость",

    stats: [
      "СИЛА",
      "СКОРОСТЬ",
      "ВЫНОСЛИВОСТЬ"
    ],

    icon:
      `<circle
        cx="200"
        cy="90"
        r="30"
        stroke="currentColor"
        stroke-width="8"
      />

      <path
        d="M200 120
        L200 220
        M120 160
        L280 160
        M160 220
        L120 280
        M240 220
        L280 280"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
      />`

  },


  running: {

    title: "БЕГ",

    subtitle:
      "Тренировки на скорость, дыхание и технику бега",

    stats: [
      "СКОРОСТЬ",
      "ДЫХАНИЕ",
      "ПРОГРЕСС"
    ],

    icon:
      `<circle
        cx="160"
        cy="60"
        r="20"
        stroke="currentColor"
        stroke-width="8"
      />

      <path
        d="M160 85
        L190 150
        L120 210

        M190 150
        L280 180

        M190 150
        L150 110"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />`

  },


  yoga: {

    title: "ЙОГА",

    subtitle:
      "Гибкость, баланс, сила тела и контроль над движением",

    stats: [
      "БАЛАНС",
      "ГИБКОСТЬ",
      "КОНТРОЛЬ"
    ],

    icon:
      `<circle
        cx="200"
        cy="80"
        r="28"
        stroke="currentColor"
        stroke-width="8"
      />

      <path
        d="M200 110
        C160 160 140 210 100 250

        M200 110
        C240 160 260 210 300 250"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
        stroke-linecap="round"
      />`

  },


  swimming: {

    title: "ПЛАВАНИЕ",

    subtitle:
      "Техника, скорость и развитие выносливости в воде",

    stats: [
      "ТЕХНИКА",
      "СКОРОСТЬ",
      "ВЫНОСЛИВОСТЬ"
    ],

    icon:
      `<path
        d="M40 180
        Q80 140 120 180
        T200 180
        T280 180
        T360 180"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
      />`

  },


  cycling: {

    title: "ВЕЛОСПОРТ",

    subtitle:
      "Скорость, мощность и выносливость на велосипеде",

    stats: [
      "МОЩНОСТЬ",
      "СКОРОСТЬ",
      "ВЫНОСЛИВОСТЬ"
    ],

    icon:
      `<circle
        cx="120"
        cy="220"
        r="55"
        stroke="currentColor"
        stroke-width="8"
      />

      <circle
        cx="280"
        cy="220"
        r="55"
        stroke="currentColor"
        stroke-width="8"
      />

      <path
        d="M120 220
        L180 120
        L240 220
        L150 220
        L220 120
        L280 220"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
      />`

  },


  tennis: {

    title: "ТЕННИС",

    subtitle:
      "Техника ударов, скорость, тактика и контроль игры",

    stats: [
      "ТЕХНИКА",
      "СКОРОСТЬ",
      "ТАКТИКА"
    ],

    icon:
      `<ellipse
        cx="170"
        cy="130"
        rx="70"
        ry="95"
        stroke="currentColor"
        stroke-width="8"
      />

      <line
        x1="170"
        y1="225"
        x2="170"
        y2="285"
        stroke="currentColor"
        stroke-width="8"
      />

      <circle
        cx="300"
        cy="220"
        r="22"
        stroke="currentColor"
        stroke-width="8"
      />`

  },


  combat: {

    title: "ЕДИНОБОРСТВА",

    subtitle:
      "Техника, сила, скорость реакции и боевое мастерство",

    stats: [
      "ТЕХНИКА",
      "СИЛА",
      "РЕАКЦИЯ"
    ],

    icon:
      `<path
        d="M100 150
        C120 100 180 100 200 150

        C220 100 280 100 300 150

        L270 230
        L130 230
        Z"
        stroke="currentColor"
        stroke-width="8"
        fill="none"
      />`

  }

};


// =====================================================
// PAGE
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


  document
    .getElementById("mainNav")
    ?.classList.remove(
      "mobile-open"
    );


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// =====================================================
// MODAL
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
// MESSAGE
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
// LOAD DATA
// =====================================================

async function loadData() {

  const sportsResult =
    await supabase
      .from("sports")
      .select("*")
      .order("name");


  if (sportsResult.error) {

    throw sportsResult.error;

  }


  sports =
    sportsResult.data || [];


  renderSports();


  const coachesResult =
    await supabase

      .from("coaches")

      .select("*")

      .order(
        "score",
        {
          ascending: false
        }
      );


  if (coachesResult.error) {

    console.error(
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
// SPORT CARD
// =====================================================

function createSportCard(sport) {

  const card =
    document.createElement("article");


  card.className =
    "sport-card";


  card.style.backgroundImage =
    `url("${getSportImage(sport.name)}")`;


  card.innerHTML = `

    <div class="sport-icon">
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

      const filter =
        document.getElementById(
          "sportFilter"
        );


      if (filter) {

        filter.value =
          String(sport.id);

      }


      showPage("coaches");

      renderCoaches();

    }
  );


  return card;

}


// =====================================================
// COACH CARD
// =====================================================

function createCoachCard(coach) {

  const card =
    document.createElement("article");


  card.className =
    "coach-card";


  card.innerHTML = `

    <img
      class="coach-image"
      src="${esc(getCoachImage(coach))}"
      alt="${esc(coach.name)}"
      loading="lazy"
    >


    <div class="coach-score">
      ${Number(coach.score || 0)}
    </div>


    <div class="coach-avatar">

      ${esc(
        initials(coach.name)
      )}

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
        coach.format || ""
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
// RENDER SPORTS
// =====================================================

function renderSports() {

  [
    "homeSports",
    "sportsList"
  ]
    .forEach(
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


  [
    "sportFilter",
    "matchSport",
    "coachSport"
  ]
    .forEach(
      function (id) {

        const select =
          document.getElementById(id);


        if (!select) return;


        const previous =
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
          [...select.options]
            .some(
              function (option) {

                return (
                  option.value ===
                  previous
                );

              }
            )
        ) {

          select.value =
            previous;

        }

      }
    );

}


// =====================================================
// CATEGORY BANNER
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
  ) return;


  if (!filter.value) {

    banner.style.display =
      "none";

    return;

  }


  const sport =
    sports.find(
      function (item) {

        return (
          String(item.id) ===
          String(filter.value)
        );

      }
    );


  const key =
    getSportKey(
      sport
        ? sport.name
        : filter.value
    );


  const visual =
    CATEGORY_VISUALS[key];


  if (!visual) {

    banner.style.display =
      "none";

    return;

  }


  banner.style.backgroundImage =
    `url("${getSportImage(sport.name)}")`;


  document
    .getElementById(
      "categoryBannerTitle"
    )
    .innerHTML =

      `<em>
        ${esc(visual.title)}
      </em>`;


  document
    .getElementById(
      "categoryBannerSubtitle"
    )
    .textContent =
      visual.subtitle;


  document
    .getElementById(
      "categoryBannerGraphic"
    )
    .innerHTML =
      visual.icon;


  document
    .getElementById(
      "categoryBannerStats"
    )
    .innerHTML =

      visual.stats
        .map(
          function (stat) {

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
                  ></circle>

                  <path
                    d="M12 7v5l3 3"
                  ></path>

                </svg>


                <span>
                  ${esc(stat)}
                </span>

              </div>

            `;

          }
        )
        .join("");


  banner.style.display =
    "block";

}


// =====================================================
// COACHES
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
// TOP COACHES
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


  container.replaceChildren(
    ...top.map(
      createCoachCard
    )
  );

}


// =====================================================
// RANKING
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

          return (
            Number(b.score || 0) -
            Number(a.score || 0)
          );

        }
      );


  container.replaceChildren();


  if (!ranking.length) {

    container.innerHTML = `
      <p class="lead">
        Рейтинг пока пуст.
      </p>
    `;

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
            sportName(coach.sport)
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
// GOALS
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) return;


  const previous =
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


  select.value =
    previous;

}


// =====================================================
// MATCH
// =====================================================

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


  const results =
    document.getElementById(
      "matchResults"
    );


  if (!results) return;


  const ranked =
    coaches

      .map(
        function (coach) {

          let score = 0;


          if (
            sport &&
            String(coach.sport) ===
            String(sport)
          ) {

            score += 50;

          }


          if (
            goal &&
            coach.goal === goal
          ) {

            score += 30;

          }


          if (
            format &&
            coach.format === format
          ) {

            score += 20;

          }


          score +=
            Number(coach.rating || 0) * 2;


          return {
            coach,
            percent:
              Math.min(
                100,
                Math.round(score)
              )
          };

        }
      )

      .filter(
        function (item) {

          return (
            item.percent > 0 ||
            (
              !sport &&
              !goal &&
              !format
            )
          );

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


  results.replaceChildren();


  if (!ranked.length) {

    results.innerHTML = `

      <p class="lead">
        Подходящих тренеров пока нет.
      </p>

    `;

    return;

  }


  ranked.forEach(
    function (item) {

      const element =
        document.createElement("div");


      element.className =
        "match-result";


      element.innerHTML = `

        <div>

          <b>
            ${esc(
              item.coach.name
            )}
          </b>

          <br>

          <span class="lead">

            ${esc(
              sportName(
                item.coach.sport
              )
            )}

            ·

            ${esc(
              item.coach.format || ""
            )}

          </span>

        </div>


        <div class="match-percent">

          ${item.percent}%

        </div>

      `;


      element.addEventListener(
        "click",
        function () {

          openProfile(
            item.coach.id
          );

        }
      );


      results.appendChild(element);

    }
  );

}


// =====================================================
// PROFILE
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


  showPage("profile");


  const content =
    document.getElementById(
      "profileContent"
    );


  if (!content) return;


  content.innerHTML = `

    <div class="match-box">

      <p class="lead">
        Загрузка профиля...
      </p>

    </div>

  `;


  const response =
    await supabase

      .from("reviews")

      .select("*")

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
    response.data || [];


  const reviewsHTML =
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


  const canReview =

    currentUser &&

    String(currentUser.id) !==
    String(coach.user_id);


  content.innerHTML = `

    <div class="profile-header">

      <div>

        <img
          class="profile-image"
          src="${esc(
            getCoachImage(coach)
          )}"
          alt="${esc(coach.name)}"
        >

      </div>


      <div>

        <p class="eyebrow">

          FITMATCH COACH

        </p>


        <h1>

          ${esc(coach.name)}

        </h1>


        <p class="lead">

          ${esc(
            sportName(coach.sport)
          )}

          ·

          ${esc(
            coach.format || ""
          )}

        </p>


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


        <h2>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

          ·

          FITMATCH SCORE
          ${Number(
            coach.score || 0
          )}

        </h2>


        <p class="lead">

          ${esc(
            coach.bio ||
            "Тренер ещё не добавил информацию о себе."
          )}

        </p>


        <h3>

          ${esc(
            priceText(coach)
          )}

        </h3>

      </div>

    </div>


    <div class="section">

      <h2 class="section-title">

        ОТЗЫВЫ

      </h2>


      ${reviewsHTML}


      ${
        canReview

          ? `

            <div
              class="match-box"
              style="margin-top:25px"
            >

              <h3>
                Оставить отзыв
              </h3>


              <form
                id="reviewForm"
                class="form"
              >


                <label>

                  Оценка

                  <select
                    id="reviewRating"
                  >

                    <option value="5">
                      ⭐⭐⭐⭐⭐
                    </option>

                    <option value="4">
                      ⭐⭐⭐⭐
                    </option>

                    <option value="3">
                      ⭐⭐⭐
                    </option>

                    <option value="2">
                      ⭐⭐
                    </option>

                    <option value="1">
                      ⭐
                    </option>

                  </select>

                </label>


                <label>

                  Отзыв

                  <textarea
                    id="reviewText"
                    required
                    placeholder="Расскажите о своём опыте"
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

    </div>

  `;


  const reviewForm =
    document.getElementById(
      "reviewForm"
    );


  if (!reviewForm) return;


  reviewForm.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      if (!currentUser) {

        showMessage(
          "reviewMessage",
          "Необходимо войти.",
          true
        );

        return;

      }


      const rating =
        Number(
          document
            .getElementById(
              "reviewRating"
            )
            .value
        );


      const text =
        document
          .getElementById(
            "reviewText"
          )
          .value
          .trim();


      const result =
        await supabase

          .from("reviews")

          .insert({

            coach_id:
              coach.id,

            user_id:
              currentUser.id,

            rating,

            text

          });


      if (result.error) {

        showMessage(
          "reviewMessage",
          result.error.message,
          true
        );

        return;

      }


      showMessage(
        "reviewMessage",
        "Спасибо за отзыв!"
      );


      await loadData();


      openProfile(
        coach.id
      );

    }
  );

}


// =====================================================
// USER
// =====================================================

async function refreshUser() {

  const response =
    await supabase.auth.getUser();


  currentUser =
    response.data?.user ||
    null;


  const button =
    document.getElementById(
      "authBtn"
    );


  if (!button) return;


  button.textContent =
    currentUser
      ? "Выйти"
      : "Войти";

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
// LOGIN
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
        response.data.user;


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
// SIGN UP
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
          "Введи email.",
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


      const response =
        await supabase.auth.signUp({

          email,

          password

        });


      showMessage(

        "authMessage",

        response.error

          ? response.error.message

          : "Регистрация выполнена. Проверь email.",

        Boolean(response.error)

      );

    }
  );

}


// =====================================================
// FORGOT PASSWORD
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
          "Сначала введи email.",
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
// RESET PASSWORD
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


  cancel?.addEventListener(
    "click",
    function () {

      toggleModal(
        "resetPasswordModal",
        false
      );

    }
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

        },
        700
      );

    }
  );

}


// =====================================================
// RECOVERY
// =====================================================

function checkRecoveryMode() {

  if (

    window.location.hash.includes(
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
// CREATE COACH BUTTON
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
// CREATE COACH FORM
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


      const data =
        new FormData(
          event.currentTarget
        );


      const name =
        String(
          data.get("name") || ""
        ).trim();


      const sport =
        data.get("sport");


      const goal =
        String(
          data.get("goal") || ""
        ).trim() || null;


      const format =
        data.get("format");


      const price =
        Number(
          data.get("price")
        );


      const period =
        data.get("period");


      const bio =
        String(
          data.get("bio") || ""
        ).trim() || null;


      if (

        !name ||

        !sport ||

        !Number.isFinite(price) ||

        price < 0

      ) {

        showMessage(
          "coachMessage",
          "Заполни обязательные поля корректно.",
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

        showMessage(

          "coachMessage",

          response.error.code === "23505"

            ? "У тебя уже есть профиль тренера."

            : response.error.message,

          true

        );

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

        },
        700
      );

    }
  );

}


// =====================================================
// NAVIGATION
// =====================================================

function initNavigation() {

  document
    .getElementById("logo")
    ?.addEventListener(
      "click",
      function () {

        showPage("home");

      }
    );


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
    .getElementById("matchBtn")
    ?.addEventListener(
      "click",
      function () {

        showPage("match");

      }
    );


  document
    .getElementById("chooseSportBtn")
    ?.addEventListener(
      "click",
      function () {

        showPage("sports");

      }
    );

}


// =====================================================
// FILTERS
// =====================================================

function initFilters() {

  document
    .getElementById("sportFilter")
    ?.addEventListener(
      "change",
      renderCoaches
    );


  document
    .getElementById("formatFilter")
    ?.addEventListener(
      "change",
      renderCoaches
    );


  document
    .getElementById("findMatchBtn")
    ?.addEventListener(
      "click",
      findMatch
    );


  document
    .getElementById("cyclingBannerCta")
    ?.addEventListener(
      "click",
      function () {

        document
          .getElementById("coachesList")
          ?.scrollIntoView({

            behavior: "smooth",

            block: "start"

          });

      }
    );

}


// =====================================================
// MODALS
// =====================================================

function initModals() {

  document
    .getElementById("modalCancel")
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
    .getElementById("coachCancel")
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
    .querySelectorAll(".modal")
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
// MOBILE MENU
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
// START
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

          Ошибка подключения к Supabase:

          ${esc(
            error.message || error
          )}

        </p>

      `;

    }

  }

}


init();
