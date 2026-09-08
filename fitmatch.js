import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// APLEX — FIND YOUR LEVEL.
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
// SPORT IMAGES
// =====================================================

const SPORT_IMAGES = {

  bodybuilding:
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1600&q=85",

  fitness:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=85",

  crossfit:
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1600&q=85",

  running:
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1600&q=85",

  yoga:
    "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1600&q=85",

  swimming:
    "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=85",

  cycling:
    "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1600&q=85",

  tennis:
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1600&q=85",

  combat:
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1600&q=85"

};


const COACH_IMAGES = [

  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1550345332-09e3ac987658?auto=format&fit=crop&w=900&q=85",

  "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=900&q=85"

];


// =====================================================
// SAFE HTML
// =====================================================

function esc(value) {

  return String(value ?? "").replace(
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
    .filter(Boolean)
    .map(function (word) {

      return word[0] || "";

    })
    .slice(0, 2)
    .join("")
    .toUpperCase();

}


// =====================================================
// SPORT NAME
// =====================================================

function sportName(id) {

  const sport = sports.find(
    function (item) {

      return String(item.id) === String(id);

    }
  );

  return sport
    ? sport.name
    : String(id || "Не указан");

}


// =====================================================
// SPORT IMAGE
// =====================================================

function getSportImage(sport) {

  if (
    sport &&
    sport.image_url
  ) {

    return sport.image_url;

  }


  const raw =
    String(
      sport?.slug ||
      sport?.key ||
      sport?.name ||
      sport?.id ||
      ""
    )
      .toLowerCase();


  if (
    raw.includes("body") ||
    raw.includes("бодиб")
  ) {

    return SPORT_IMAGES.bodybuilding;

  }


  if (
    raw.includes("cross") ||
    raw.includes("кросс")
  ) {

    return SPORT_IMAGES.crossfit;

  }


  if (
    raw.includes("run") ||
    raw.includes("бег")
  ) {

    return SPORT_IMAGES.running;

  }


  if (
    raw.includes("yoga") ||
    raw.includes("йога")
  ) {

    return SPORT_IMAGES.yoga;

  }


  if (
    raw.includes("swim") ||
    raw.includes("плав")
  ) {

    return SPORT_IMAGES.swimming;

  }


  if (
    raw.includes("cycl") ||
    raw.includes("вел")
  ) {

    return SPORT_IMAGES.cycling;

  }


  if (
    raw.includes("tennis") ||
    raw.includes("теннис")
  ) {

    return SPORT_IMAGES.tennis;

  }


  if (
    raw.includes("combat") ||
    raw.includes("fight") ||
    raw.includes("единобор")
  ) {

    return SPORT_IMAGES.combat;

  }


  return SPORT_IMAGES.fitness;

}


// =====================================================
// COACH IMAGE
// =====================================================

function getCoachImage(coach) {

  if (
    coach?.avatar_url
  ) {

    return coach.avatar_url;

  }


  if (
    coach?.image_url
  ) {

    return coach.image_url;

  }


  const id =
    String(
      coach?.id ||
      coach?.name ||
      "0"
    );


  let hash = 0;


  for (
    let index = 0;
    index < id.length;
    index += 1
  ) {

    hash =
      (
        (
          hash << 5
        )
        -
        hash
      )
      +
      id.charCodeAt(index);

    hash |= 0;

  }


  return COACH_IMAGES[
    Math.abs(hash) %
    COACH_IMAGES.length
  ];

}


// =====================================================
// PRICE
// =====================================================

function priceText(coach) {

  const price =
    Number(
      coach?.price || 0
    );


  const period =
    coach?.period ||
    "месяц";


  return `€${price} / ${period}`;

}


// =====================================================
// SCORE
// =====================================================

function calculateScore(coach) {

  if (
    coach?.score !== null &&
    coach?.score !== undefined &&
    Number(coach.score) > 0
  ) {

    return Math.min(
      100,
      Math.round(
        Number(coach.score)
      )
    );

  }


  let score = 40;


  const rating =
    Number(
      coach?.rating || 0
    );


  const experience =
    Number(
      coach?.experience_years ||
      coach?.experience ||
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


  if (
    coach?.image_url ||
    coach?.avatar_url
  ) {

    score += 5;

  }


  if (
    coach?.goal ||
    coach?.specialization
  ) {

    score += 5;

  }


  if (
    coach?.bio
  ) {

    score += 5;

  }


  return Math.min(
    100,
    Math.round(score)
  );

}


// =====================================================
// PAGE
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
// MODAL
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
    Boolean(show)
  );


  document.body.classList.toggle(
    "modal-open",
    Boolean(
      document.querySelector(
        ".modal.show"
      )
    )
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


  element.textContent =
    text;


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
      .order(
        "name",
        {
          ascending: true
        }
      );


  if (sportsResult.error) {

    console.error(
      "SPORTS ERROR:",
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
      "COACHES ERROR:",
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
          calculateScore(b) -
          calculateScore(a)
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
// SPORT CARD
// =====================================================

function createSportCard(sport) {

  const card =
    document.createElement("article");


  card.className =
    "sport-card";


  const image =
    getSportImage(sport);


  card.style.backgroundImage =
    `url("${image}")`;


  card.innerHTML = `

    <div class="sport-card-content">

      <div class="sport-icon">

        ${esc(
          sport.icon || "🏅"
        )}

      </div>

      <h3>

        ${esc(
          sport.name ||
          "Спорт"
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
// SPORTS
// =====================================================

function renderSports() {

  [
    "homeSports",
    "sportsList"
  ]
    .forEach(function (id) {

      const container =
        document.getElementById(id);


      if (!container) return;


      container.replaceChildren(
        ...sports.map(
          createSportCard
        )
      );

    });


  populateSportSelects();

}


// =====================================================
// SPORT SELECTS
// =====================================================

function populateSportSelects() {

  const ids = [

    "sportFilter",

    "matchSport",

    "coachSport"

  ];


  ids.forEach(
    function (id) {

      const select =
        document.getElementById(id);


      if (!select) return;


      const previous =
        select.value;


      if (
        id === "sportFilter"
      ) {

        select.innerHTML =
          `<option value="">
            Все виды спорта
          </option>`;

      }

      else if (
        id === "matchSport"
      ) {

        select.innerHTML =
          `<option value="">
            Не выбрано
          </option>`;

      }

      else {

        select.innerHTML =
          `<option value="">
            Выберите вид спорта
          </option>`;

      }


      sports.forEach(
        function (sport) {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            String(sport.id);


          option.textContent =
            `${sport.icon || ""} ${sport.name}`.trim();


          select.appendChild(option);

        }
      );


      if (previous) {

        select.value =
          previous;

      }

    }
  );

}


// =====================================================
// COACH CARD
// =====================================================

function createCoachCard(coach) {

  const article =
    document.createElement("article");


  article.className =
    "coach-card";


  const image =
    getCoachImage(coach);


  const score =
    calculateScore(coach);


  article.innerHTML = `

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

        ${score}

      </div>


      <h3>

        ${esc(
          coach.name ||
          "Тренер"
        )}

      </h3>


      <p class="coach-sport">

        ${esc(
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

      </div>


      <div class="card-footer">

        <span>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </span>


        <span>

          ${esc(
            priceText(coach)
          )}

        </span>

      </div>

    </div>

  `;


  article.addEventListener(
    "click",
    function () {

      openProfile(coach.id);

    }
  );


  return article;

}


// =====================================================
// COACHES
// =====================================================

function renderCoaches() {

  const container =
    document.getElementById(
      "coachesList"
    );


  if (!container) return;


  const sport =
    document.getElementById(
      "sportFilter"
    )?.value || "";


  const query =
    String(
      document.getElementById(
        "coachSearch"
      )?.value || ""
    )
      .trim()
      .toLowerCase();


  let result =
    [...coaches];


  if (sport) {

    result =
      result.filter(
        function (coach) {

          return (
            String(coach.sport) ===
            String(sport)
          );

        }
      );

  }


  if (query) {

    result =
      result.filter(
        function (coach) {

          const text =
            [

              coach.name,

              coach.goal,

              coach.specialization,

              coach.bio,

              sportName(
                coach.sport
              )

            ]
              .join(" ")
              .toLowerCase();


          return text.includes(query);

        }
      );

  }


  container.replaceChildren();


  if (!result.length) {

    container.innerHTML =
      `<p class="empty">
        Тренеры пока не найдены.
      </p>`;

    return;

  }


  result.forEach(
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


  container.replaceChildren();


  coaches
    .slice(0, 3)
    .forEach(
      function (coach) {

        container.appendChild(
          createCoachCard(coach)
        );

      }
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


  container.innerHTML = "";


  if (!coaches.length) {

    container.innerHTML =
      `<p class="empty">
        Рейтинг пока пуст.
      </p>`;

    return;

  }


  coaches.forEach(
    function (
      coach,
      index
    ) {

      const item =
        document.createElement("article");


      item.className =
        "ranking-item";


      item.innerHTML = `

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


        <strong>

          ${calculateScore(coach)}

        </strong>

      `;


      item.addEventListener(
        "click",
        function () {

          openProfile(coach.id);

        }
      );


      container.appendChild(item);

    }
  );

}


// =====================================================
// MATCH GOALS
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) return;


  const current =
    select.value;


  const goals =
    [
      ...new Set(

        coaches
          .map(
            function (coach) {

              return String(
                coach.goal || ""
              ).trim();

            }
          )
          .filter(Boolean)

      )

    ];


  select.innerHTML =
    `<option value="">
      Любая цель
    </option>`;


  goals.forEach(
    function (goal) {

      const option =
        document.createElement("option");


      option.value =
        goal;


      option.textContent =
        goal;


      select.appendChild(option);

    }
  );


  if (current) {

    select.value =
      current;

  }

}


// =====================================================
// MATCH
// =====================================================

function initMatch() {

  const button =
    document.getElementById(
      "findMatchBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    function () {

      const sport =
        document.getElementById(
          "matchSport"
        )?.value || "";


      const goal =
        String(
          document.getElementById(
            "matchGoal"
          )?.value || ""
        )
          .trim()
          .toLowerCase();


      const format =
        document.getElementById(
          "matchFormat"
        )?.value || "";


      let result =
        [...coaches];


      if (sport) {

        result =
          result.filter(
            function (coach) {

              return (
                String(coach.sport) ===
                String(sport)
              );

            }
          );

      }


      if (goal) {

        result =
          result.filter(
            function (coach) {

              return String(
                coach.goal || ""
              )
                .toLowerCase()
                .includes(goal);

            }
          );

      }


      if (format) {

        result =
          result.filter(
            function (coach) {

              return (
                coach.format ===
                format
              );

            }
          );

      }


      const container =
        document.getElementById(
          "matchResults"
        );


      if (!container) return;


      container.replaceChildren();


      if (!result.length) {

        container.innerHTML =
          `<p class="empty">
            Подходящих тренеров пока не найдено.
          </p>`;

        return;

      }


      result
        .slice(0, 6)
        .forEach(
          function (coach) {

            container.appendChild(
              createCoachCard(coach)
            );

          }
        );

    }
  );

}


// =====================================================
// PROFILE
// =====================================================

function openProfile(id) {

  const coach =
    coaches.find(
      function (item) {

        return (
          String(item.id) ===
          String(id)
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
    getCoachImage(coach);


  const isOwner =
    currentUser &&
    coach.user_id &&
    String(currentUser.id) ===
    String(coach.user_id);


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


        ${
          coach.goal
            ? `
              <p>

                ${esc(
                  coach.goal
                )}

              </p>
            `
            : ""
        }


        ${
          coach.format
            ? `
              <p>

                Формат:
                ${esc(
                  coach.format
                )}

              </p>
            `
            : ""
        }


        <p>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

          · SCORE ${calculateScore(coach)}

        </p>


        <p>

          ${esc(
            priceText(coach)
          )}

        </p>


        <p>

          ${esc(
            coach.bio ||
            "Описание пока не добавлено."
          )}

        </p>


        <div class="actions">

          ${
            isOwner
              ? `
                <button
                  id="editMyCoachBtn"
                  class="btn btn-primary"
                  type="button"
                >
                  РЕДАКТИРОВАТЬ ПРОФИЛЬ
                </button>
              `
              : ""
          }


          <button
            id="backToCoaches"
            class="btn"
            type="button"
          >
            ← К ТРЕНЕРАМ
          </button>

        </div>

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

        showPage("coaches");

      }
    );


  document
    .getElementById(
      "editMyCoachBtn"
    )
    ?.addEventListener(
      "click",
      async function () {

        await openCoachEditor();

      }
    );


  showPage("profile");

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
    .querySelectorAll("[data-nav]")
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
    .getElementById("coachSearch")
    ?.addEventListener(
      "input",
      renderCoaches
    );

}


// =====================================================
// AUTH UI
// =====================================================

function updateAuthUI() {

  const authButton =
    document.getElementById(
      "authBtn"
    );


  const createButton =
    document.getElementById(
      "createBtn"
    );


  if (authButton) {

    if (currentUser) {

      authButton.textContent =
        "Выйти";

    }

    else {

      authButton.textContent =
        "Войти";

    }

  }


  if (createButton) {

    if (currentUser) {

      createButton.textContent =
        "Мой профиль";

    }

    else {

      createButton.textContent =
        "Стать тренером";

    }

  }

}


// =====================================================
// REFRESH USER
// =====================================================

async function refreshUser() {

  const result =
    await supabase.auth.getUser();


  currentUser =
    result.data?.user ||
    null;


  updateAuthUI();

}


// =====================================================
// AUTH BUTTON
// =====================================================

function initAuthButton() {

  const authButton =
    document.getElementById(
      "authBtn"
    );


  if (!authButton) return;


  authButton.addEventListener(
    "click",
    async function () {

      if (currentUser) {

        const result =
          await supabase.auth.signOut();


        if (result.error) {

          alert(
            result.error.message
          );

          return;

        }


        currentUser = null;

        updateAuthUI();

        showPage("home");

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
// AUTH LOGIN
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
        document.getElementById(
          "authEmail"
        )?.value
          .trim();


      const password =
        document.getElementById(
          "authPassword"
        )?.value;


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


      showMessage(
        "authMessage",
        "Выполняется вход..."
      );


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


      currentUser =
        result.data.user;


      showMessage(
        "authMessage",
        "Вход выполнен."
      );


      updateAuthUI();


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
// SIGNUP
// =====================================================

function initSignup() {

  const button =
    document.getElementById(
      "signupBtn"
    );


  if (!button) return;


  button.addEventListener(
    "click",
    function () {

      toggleModal(
        "modal",
        false
      );


      toggleModal(
        "signupModal",
        true
      );

    }
  );


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
        document.getElementById(
          "signupEmail"
        )?.value
          .trim();


      const password =
        document.getElementById(
          "signupPassword"
        )?.value;


      const confirm =
        document.getElementById(
          "signupPasswordConfirm"
        )?.value;


      if (
        !email ||
        !password
      ) {

        showMessage(
          "signupMessage",
          "Заполните email и пароль.",
          true
        );

        return;

      }


      if (
        password.length < 6
      ) {

        showMessage(
          "signupMessage",
          "Пароль должен содержать минимум 6 символов.",
          true
        );

        return;

      }


      if (
        confirm !== undefined &&
        password !== confirm
      ) {

        showMessage(
          "signupMessage",
          "Пароли не совпадают.",
          true
        );

        return;

      }


      showMessage(
        "signupMessage",
        "Создаём аккаунт..."
      );


      const redirectTo =
        `${window.location.origin}${window.location.pathname}`;


      const result =
        await supabase.auth.signUp({

          email,

          password,

          options: {

            emailRedirectTo:
              redirectTo

          }

        });


      if (result.error) {

        showMessage(
          "signupMessage",
          result.error.message,
          true
        );

        return;

      }


      if (
        result.data.session
      ) {

        currentUser =
          result.data.user;


        updateAuthUI();


        showMessage(
          "signupMessage",
          "Аккаунт создан."
        );

      }

      else {

        showMessage(
          "signupMessage",
          "Аккаунт создан. Проверьте email и подтвердите регистрацию."
        );

      }


      form.reset();

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
    function () {

      toggleModal(
        "modal",
        false
      );


      toggleModal(
        "forgotPasswordModal",
        true
      );

    }
  );


  const form =
    document.getElementById(
      "forgotPasswordForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const email =
        document.getElementById(
          "forgotEmail"
        )?.value
          .trim();


      if (!email) {

        showMessage(
          "forgotMessage",
          "Введите email.",
          true
        );

        return;

      }


      const redirectTo =
        `${window.location.origin}${window.location.pathname}`;


      const result =
        await supabase.auth
          .resetPasswordForEmail(
            email,
            {
              redirectTo
            }
          );


      if (result.error) {

        showMessage(
          "forgotMessage",
          result.error.message,
          true
        );

        return;

      }


      showMessage(
        "forgotMessage",
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


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const password =
        document.getElementById(
          "newPassword"
        )?.value;


      const confirm =
        document.getElementById(
          "newPasswordConfirm"
        )?.value;


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
        confirm !== undefined &&
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


      form.reset();


      setTimeout(
        function () {

          toggleModal(
            "resetPasswordModal",
            false
          );

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
// CREATE / EDIT COACH
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

      if (!currentUser) {

        toggleModal(
          "modal",
          true
        );

        return;

      }


      await openCoachEditor();

    }
  );

}


// =====================================================
// OPEN COACH EDITOR
// =====================================================

async function openCoachEditor() {

  if (!currentUser) {

    toggleModal(
      "modal",
      true
    );

    return;

  }


  const form =
    document.getElementById(
      "createForm"
    );


  if (!form) return;


  const title =
    document.getElementById(
      "coachTitle"
    );


  const submit =
    form.querySelector(
      '[type="submit"]'
    );


  form.reset();


  const result =
    await supabase
      .from("coaches")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();


  if (
    result.error &&
    result.error.code !== "PGRST116"
  ) {

    console.error(
      result.error
    );

  }


  const coach =
    result.data;


  if (coach) {

    if (title) {

      title.textContent =
        "Мой профиль";

    }


    if (submit) {

      submit.textContent =
        "СОХРАНИТЬ ИЗМЕНЕНИЯ";

    }


    form.elements.name.value =
      coach.name || "";


    form.elements.sport.value =
      String(
        coach.sport || ""
      );


    form.elements.goal.value =
      coach.goal || "";


    form.elements.format.value =
      coach.format || "Онлайн";


    form.elements.price.value =
      coach.price ?? "";


    form.elements.period.value =
      coach.period || "месяц";


    form.elements.bio.value =
      coach.bio || "";

  }

  else {

    if (title) {

      title.textContent =
        "Создать профиль тренера";

    }


    if (submit) {

      submit.textContent =
        "СОЗДАТЬ ПРОФИЛЬ";

    }

  }


  toggleModal(
    "coachModal",
    true
  );

}


// =====================================================
// COACH FORM
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


      const name =
        String(
          data.get("name") || ""
        )
          .trim();


      const sport =
        String(
          data.get("sport") || ""
        )
          .trim();


      const goal =
        String(
          data.get("goal") || ""
        )
          .trim();


      const format =
        String(
          data.get("format") || ""
        )
          .trim();


      const price =
        Number(
          data.get("price")
        );


      const period =
        String(
          data.get("period") || "месяц"
        )
          .trim();


      const bio =
        String(
          data.get("bio") || ""
        )
          .trim();


      if (!name) {

        showMessage(
          "coachMessage",
          "Введите имя.",
          true
        );

        return;

      }


      if (!sport) {

        showMessage(
          "coachMessage",
          "Выберите вид спорта.",
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
          "Введите корректную цену.",
          true
        );

        return;

      }


      showMessage(
        "coachMessage",
        "Сохраняем профиль..."
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

        bio

      };


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


      let response;


      if (existing.data) {

        response =
          await supabase
            .from("coaches")
            .update(payload)
            .eq(
              "id",
              existing.data.id
            );

      }

      else {

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
        "Профиль тренера успешно сохранён."
      );


      await loadData();


      setTimeout(
        function () {

          toggleModal(
            "coachModal",
            false
          );

        },
        700
      );

    }
  );

}


// =====================================================
// MODALS
// =====================================================

function initModals() {

  document
    .getElementById("authClose")
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


      updateAuthUI();


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


  if (!images.length) return;


  let index = 0;


  function showImage() {

    hero.style.backgroundImage =
      `url("${images[index]}")`;


    index =
      (
        index + 1
      ) %
      images.length;

  }


  showImage();


  setInterval(
    showImage,
    7000
  );

}


// =====================================================
// START
// =====================================================

async function init() {

  initNavigation();

  initFilters();

  initMatch();

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


init();
