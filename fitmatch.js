import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// FITMATCH — MASTER VERSION
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
// НОРМАЛИЗАЦИЯ СПОРТА
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

  combat: "combat",
  "единоборства": "combat",
  boxing: "combat",
  "бокс": "combat",

  swimming: "swimming",
  "плавание": "swimming",

  cycling: "cycling",
  "велоспорт": "cycling",

  football: "football",
  "футбол": "football",

  tennis: "tennis",
  "теннис": "tennis"

};


function getSportKey(value) {

  const raw =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!raw) return null;


  if (SPORT_ALIASES[raw]) {

    return SPORT_ALIASES[raw];

  }


  return raw;

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
// ИЗОБРАЖЕНИЕ СПОРТА
// =====================================================

function sportImage(value) {

  const key =
    getSportKey(value);


  if (
    key &&
    SPORT_IMAGES[key]
  ) {

    return SPORT_IMAGES[key];

  }


  return null;

}


// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {

  if (
    coach.price === null ||
    coach.price === undefined ||
    coach.price === ""
  ) {

    return "Цена по запросу";

  }


  const price =
    Number(coach.price);


  if (!Number.isFinite(price)) {

    return "Цена по запросу";

  }


  const period =
    String(
      coach.period || ""
    ).trim();


  return period
    ? `€${price} / ${period}`
    : `€${price}`;

}


// =====================================================
// FITMATCH SCORE
// =====================================================

function calculateProfileScore(coach) {

  let score = 0;


  if (coach.name) score += 10;

  if (coach.sport) score += 10;

  if (coach.goal) score += 5;

  if (coach.format) score += 5;

  if (coach.price !== null &&
      coach.price !== undefined) {

    score += 5;

  }


  if (coach.period) score += 5;

  if (coach.bio) score += 10;

  if (
    coach.city ||
    coach.location
  ) {

    score += 5;

  }


  if (
    coach.specialization
  ) {

    score += 10;

  }


  if (
    coach.experience ||
    coach.experience_years
  ) {

    score += 10;

  }


  if (
    coach.achievements ||
    coach.achievements_summary
  ) {

    score += 10;

  }


  if (
    coach.education
  ) {

    score += 5;

  }


  if (
    coach.avatar_url ||
    coach.image_url
  ) {

    score += 5;

  }


  if (
    coach.verified
  ) {

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

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(function (page) {

      page.classList.remove(
        "active"
      );

    });


  const page =
    document.getElementById(
      pageId
    );


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


  if (!modal) return;


  modal.classList.toggle(
    "show",
    Boolean(show)
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

  populateSports();

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
    sportImage(
      sport.id ||
      sport.name
    );


  const imageHtml =
    image
      ? `
        <div
          class="sport-image"
          style="
            background-image:
            url('${esc(image)}')
          "
        ></div>
      `
      : "";


  card.innerHTML = `

    ${imageHtml}

    <div
      class="sport-content"
    >

      <div
        style="
          font-size:30px
        "
      >

        ${esc(
          sport.icon || "🏅"
        )}

      </div>


      <b>

        ${esc(
          sport.name
        )}

      </b>


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
// ОТОБРАЖЕНИЕ СПОРТА
// =====================================================

function renderSports() {

  const containers = [

    "homeSports",

    "sportsList",

    "sportsGrid"

  ];


  containers.forEach(
    function (id) {

      const container =
        document.getElementById(id);


      if (!container) return;


      container.innerHTML = "";


      sports.forEach(
        function (sport) {

          container.appendChild(
            createSportCard(sport)
          );

        }
      );

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


  const score =
    Number.isFinite(
      Number(coach.score)
    )
      ? Number(coach.score)
      : calculateProfileScore(
          coach
        );


  const avatarUrl =
    coach.avatar_url ||
    coach.image_url ||
    "";


  const avatar =
    avatarUrl
      ? `
        <img
          src="${esc(avatarUrl)}"
          alt="${esc(
            coach.name || "Тренер"
          )}"
          loading="lazy"
        >
      `
      : `
        <span>

          ${esc(
            initials(
              coach.name
            )
          )}

        </span>
      `;


  const experience =
    coach.experience ||
    coach.experience_years;


  card.innerHTML = `

    <div
      class="coach-score"
      title="FITMATCH Score"
    >

      ${score}

    </div>


    <div
      class="coach-avatar"
    >

      ${avatar}

    </div>


    <h3>

      ${esc(
        coach.name ||
        "Тренер"
      )}

    </h3>


    <div
      class="coach-sport"
    >

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

    </div>


    <div
      class="tags"
    >

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
        experience
          ? `
            <span class="tag">

              ${esc(
                experience
              )} лет опыта

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


    <div
      class="card-footer"
    >

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
// ФИЛЬТРАЦИЯ ТРЕНЕРОВ
// =====================================================

function getFilteredCoaches() {

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


  const selectedSport =
    sportFilter
      ? sportFilter.value
      : "";


  const selectedFormat =
    formatFilter
      ? formatFilter.value
      : "";


  const search =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";


  return coaches.filter(
    function (coach) {

      const sportMatches =
        !selectedSport ||
        String(
          coach.sport
        ) ===
        String(
          selectedSport
        );


      const formatMatches =
        !selectedFormat ||
        coach.format ===
        selectedFormat;


      const text =
        [

          coach.name,

          coach.goal,

          coach.bio,

          coach.specialization,

          coach.city,

          sportName(
            coach.sport
          )

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


      const searchMatches =
        !search ||
        text.includes(search);


      return (
        sportMatches &&
        formatMatches &&
        searchMatches
      );

    }
  );

}


// =====================================================
// СПИСОК ТРЕНЕРОВ
// =====================================================

function renderCoaches() {

  const container =
    document.getElementById(
      "coachesList"
    );


  if (!container) return;


  const list =
    getFilteredCoaches();


  container.innerHTML = "";


  if (!list.length) {

    container.innerHTML = `

      <p class="empty">

        Тренеры по этим параметрам
        пока не найдены.

      </p>

    `;

    return;

  }


  list.forEach(
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


  container.innerHTML = "";


  const top =
    [...coaches]
      .sort(
        function (a, b) {

          const scoreA =
            Number(
              a.score ??
              calculateProfileScore(a)
            );


          const scoreB =
            Number(
              b.score ??
              calculateProfileScore(b)
            );


          return scoreB - scoreA;

        }
      )
      .slice(0, 6);


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


  container.innerHTML = "";


  const ranked =
    [...coaches]
      .sort(
        function (a, b) {

          return (
            Number(
              b.rating || 0
            ) -
            Number(
              a.rating || 0
            )
          );

        }
      )
      .slice(0, 20);


  ranked.forEach(
    function (coach, index) {

      const row =
        document.createElement(
          "article"
        );


      row.className =
        "ranking-item";


      row.innerHTML = `

        <strong>

          #${index + 1}

        </strong>


        <span>

          ${esc(
            coach.name ||
            "Тренер"
          )}

        </span>


        <span>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

        </span>

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
// СПОРТ В SELECT
// =====================================================

function populateSports() {

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


      const current =
        select.value;


      const firstOption =
        id === "sportFilter"
          ? `<option value="">Все виды спорта</option>`
          : `<option value="">Выберите спорт</option>`;


      select.innerHTML =
        firstOption +
        sports
          .map(
            function (sport) {

              return `

                <option
                  value="${esc(
                    sport.id
                  )}"
                >

                  ${esc(
                    sport.icon || ""
                  )}

                  ${esc(
                    sport.name
                  )}

                </option>

              `;

            }
          )
          .join("");


      if (current) {

        select.value = current;

      }

    }
  );

}


// =====================================================
// ЦЕЛИ В MATCH
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) return;


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


  const current =
    select.value;


  select.innerHTML = `

    <option value="">

      Любая цель

    </option>

  `;


  goals.forEach(
    function (goal) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        goal;


      option.textContent =
        goal;


      select.appendChild(
        option
      );

    }
  );


  if (current) {

    select.value =
      current;

  }

}


// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

async function openProfile(id) {

  const coach =
    coaches.find(
      function (item) {

        return String(item.id) ===
          String(id);

      }
    );


  if (!coach) return;


  showPage(
    "profile"
  );


  const container =
    document.getElementById(
      "profileContent"
    );


  if (!container) return;


  container.innerHTML = `

    <p>

      Загрузка профиля...

    </p>

  `;


  let reviews = [];


  const reviewsResult =
    await supabase
      .from("reviews")
      .select(
        "id, rating, text, created_at"
      )
      .eq(
        "coach_id",
        coach.id
      )
      .order(
        "created_at",
        {

          ascending: false

        }
      );


  if (!reviewsResult.error) {

    reviews =
      reviewsResult.data || [];

  }


  const avatarUrl =
    coach.avatar_url ||
    coach.image_url ||
    "";


  const avatar =
    avatarUrl
      ? `
        <img
          src="${esc(avatarUrl)}"
          alt="${esc(
            coach.name
          )}"
        >
      `
      : `
        <div class="coach-avatar">

          ${esc(
            initials(
              coach.name
            )
          )}

        </div>
      `;


  const experience =
    coach.experience ||
    coach.experience_years ||
    "Не указан";


  const city =
    coach.city ||
    coach.location ||
    "";


  const achievements =
    coach.achievements ||
    coach.achievements_summary ||
    "";


  const score =
    Number.isFinite(
      Number(coach.score)
    )
      ? Number(coach.score)
      : calculateProfileScore(
          coach
        );


  container.innerHTML = `

    <div
      class="profile-header"
    >

      <div
        class="profile-avatar"
      >

        ${avatar}

      </div>


      <div>

        <div
          class="profile-eyebrow"
        >

          ${esc(
            sportName(
              coach.sport
            )
          )}

        </div>


        <h2>

          ${esc(
            coach.name ||
            "Тренер"
          )}

        </h2>


        ${
          coach.specialization
            ? `
              <p>

                ${esc(
                  coach.specialization
                )}

              </p>
            `
            : ""
        }


        ${
          coach.verified
            ? `
              <span class="tag">

                ✓ Проверен FITMATCH

              </span>
            `
            : ""
        }


        <p>

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(1)}

          ·

          FITMATCH SCORE ${score}

        </p>

      </div>

    </div>


    <div
      class="profile-info"
    >

      <p>

        <strong>Цель:</strong>

        ${esc(
          coach.goal ||
          "Не указана"
        )}

      </p>


      <p>

        <strong>Формат:</strong>

        ${esc(
          coach.format ||
          "Не указан"
        )}

      </p>


      <p>

        <strong>Цена:</strong>

        ${esc(
          priceText(coach)
        )}

      </p>


      <p>

        <strong>Опыт:</strong>

        ${esc(
          experience
        )}

      </p>


      ${
        city
          ? `
            <p>

              <strong>Город:</strong>

              ${esc(city)}

            </p>
          `
          : ""
      }

    </div>


    <section>

      <h3>

        О тренере

      </h3>


      <p>

        ${esc(
          coach.bio ||
          "Описание пока не добавлено."
        )}

      </p>

    </section>


    ${
      achievements
        ? `
          <section>

            <h3>

              Достижения

            </h3>


            <p>

              ${esc(
                achievements
              )}

            </p>

          </section>
        `
        : ""
    }


    ${
      coach.education
        ? `
          <section>

            <h3>

              Образование

            </h3>


            <p>

              ${esc(
                coach.education
              )}

            </p>

          </section>
        `
        : ""
    }


    <div
      class="profile-actions"
    >

      <button
        id="contactCoachBtn"
        class="btn btn-primary"
        type="button"
      >

        СВЯЗАТЬСЯ С ТРЕНЕРОМ

      </button>


      <button
        id="backToCoachesBtn"
        class="btn"
        type="button"
      >

        ← К ТРЕНЕРАМ

      </button>

    </div>


    <section
      class="reviews"
    >

      <h3>

        Отзывы

      </h3>


      <div
        class="reviews-list"
      >

        ${
          reviews.length
            ? reviews
                .map(
                  function (review) {

                    return `

                      <article
                        class="review"
                      >

                        <strong>

                          ⭐ ${Number(
                            review.rating || 0
                          )}/5

                        </strong>


                        <p>

                          ${esc(
                            review.text ||
                            ""
                          )}

                        </p>

                      </article>

                    `;

                  }
                )
                .join("")
            : `
                <p>

                  Отзывов пока нет.

                </p>
              `
        }

      </div>


      ${
        currentUser
          ? `

            <form
              id="reviewForm"
            >

              <h4>

                Оставить отзыв

              </h4>


              <label>

                Оценка

                <select
                  name="rating"
                  required
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
                  name="text"
                  rows="4"
                  maxlength="1000"
                ></textarea>

              </label>


              <button
                class="btn btn-primary"
                type="submit"
              >

                ОТПРАВИТЬ ОТЗЫВ

              </button>


              <div
                id="reviewMessage"
              ></div>

            </form>

          `
          : `

            <p>

              Войдите в аккаунт,
              чтобы оставить отзыв.

            </p>

          `
      }

    </section>

  `;


  document
    .getElementById(
      "backToCoachesBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        showPage(
          "coaches"
        );

      }
    );


  document
    .getElementById(
      "contactCoachBtn"
    )
    ?.addEventListener(
      "click",
      function () {

        if (!currentUser) {

          toggleModal(
            "modal",
            true
          );


          showMessage(
            "authMessage",
            "Войдите или зарегистрируйтесь, чтобы связаться с тренером.",
            true
          );

          return;

        }


        alert(
          "Система заявок будет добавлена следующим этапом FITMATCH."
        );

      }
    );


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

          showMessage(
            "reviewMessage",
            "Укажите корректную оценку.",
            true
          );

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

        if (
          response.error.code ===
          "23505"
        ) {

          showMessage(
            "reviewMessage",
            "Вы уже оставляли отзыв этому тренеру.",
            true
          );

        } else {

          showMessage(
            "reviewMessage",
            response.error.message,
            true
          );

        }

        return;

      }


      showMessage(
        "reviewMessage",
        "Спасибо за отзыв!"
      );


      await loadData();

      await openProfile(
        coach.id
      );

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
    Number(
      coach.rating || 0
    );


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


// =====================================================
// ПРИЧИНЫ MATCH
// =====================================================

function getMatchReasons(
  coach,
  sport,
  goal,
  format
) {

  const reasons = [];


  if (
    sport &&
    String(coach.sport) ===
    String(sport)
  ) {

    reasons.push(
      "Совпадает вид спорта"
    );

  }


  if (
    goal &&
    String(
      coach.goal || ""
    )
      .toLowerCase()
      .includes(
        String(goal)
          .toLowerCase()
      )
  ) {

    reasons.push(
      "Совпадает ваша цель"
    );

  }


  if (
    format &&
    coach.format === format
  ) {

    reasons.push(
      "Подходит формат тренировок"
    );

  }


  if (
    Number(
      coach.rating || 0
    ) >= 4
  ) {

    reasons.push(
      "Высокий рейтинг"
    );

  }


  if (!reasons.length) {

    reasons.push(
      "Подходит по общим параметрам"
    );

  }


  return reasons;

}


// =====================================================
// ПОИСК MATCH
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


  if (!container) {

    return;

  }


  const results =
    coaches
      .map(
        function (coach) {

          return {

            coach,

            score:
              calculateMatch(
                coach,
                sport,
                goal,
                format
              )

          };

        }
      )
      .filter(
        function (item) {

          return item.score > 0;

        }
      )
      .sort(
        function (a, b) {

          return b.score - a.score;

        }
      )
      .slice(0, 10);


  if (!results.length) {

    container.innerHTML = `

      <p class="empty">

        Пока не удалось найти
        подходящего тренера.

      </p>

    `;

    return;

  }


  container.innerHTML =
    results
      .map(
        function (item) {

          const coach =
            item.coach;


          const reasons =
            getMatchReasons(
              coach,
              sport,
              goal,
              format
            );


          return `

            <article
              class="match-card"
              data-match-id="${esc(
                coach.id
              )}"
            >

              <div
                class="match-score"
              >

                ${item.score}%

              </div>


              <h3>

                ${esc(
                  coach.name
                )}

              </h3>


              <p>

                ${esc(
                  sportName(
                    coach.sport
                  )
                )}

              </p>


              <div
                class="match-reasons"
              >

                ${reasons
                  .map(
                    function (reason) {

                      return `

                        <span>

                          ✓ ${esc(reason)}

                        </span>

                      `;

                    }
                  )
                  .join("")
                }

              </div>


              <p>

                ⭐ ${Number(
                  coach.rating || 0
                ).toFixed(1)}

              </p>


              <button
                class="btn"
                type="button"
              >

                ПОСМОТРЕТЬ ПРОФИЛЬ

              </button>

            </article>

          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-match-id]"
    )
    .forEach(
      function (card) {

        card.addEventListener(
          "click",
          function () {

            openProfile(
              card.dataset.matchId
            );

          }
        );

      }
    );

}


// =====================================================
// АВТОРИЗАЦИЯ — КНОПКА
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

          console.error(
            response.error
          );

        }

      } else {

        toggleModal(
          "modal",
          true
        );

      }

    }
  );

}


// =====================================================
// ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
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


  if (button) {

    button.textContent =
      currentUser
        ? "Выйти"
        : "Войти";

  }


  return currentUser;

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


      const formData =
        new FormData(
          event.currentTarget
        );


      const email =
        String(
          formData.get("email") || ""
        )
          .trim();


      const password =
        String(
          formData.get("password") || ""
        );


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
        await supabase.auth.signInWithPassword({

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
        500
      );

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


      const formData =
        new FormData(
          event.currentTarget
        );


      const email =
        String(
          formData.get("email") || ""
        )
          .trim();


      const password =
        String(
          formData.get("password") || ""
        );


      if (
        !email ||
        password.length < 6
      ) {

        showMessage(
          "signupMessage",
          "Введите корректный email и пароль минимум из 6 символов.",
          true
        );

        return;

      }


      const response =
        await supabase.auth.signUp({

          email,

          password

        });


      if (response.error) {

        showMessage(
          "signupMessage",
          response.error.message,
          true
        );

        return;

      }


      showMessage(
        "signupMessage",
        "Аккаунт создан. Проверьте email для подтверждения."
      );

    }
  );

}


// =====================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// =====================================================

function initForgotPassword() {

  const form =
    document.getElementById(
      "forgotPasswordForm"
    );


  if (!form) return;


  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const formData =
        new FormData(
          event.currentTarget
        );


      const email =
        String(
          formData.get("email") || ""
        )
          .trim();


      if (!email) {

        showMessage(
          "forgotMessage",
          "Введите email.",
          true
        );

        return;

      }


      const response =
        await supabase.auth.resetPasswordForEmail(
          email,
          {

            redirectTo:
              window.location.origin +
              window.location.pathname

          }
        );


      if (response.error) {

        showMessage(
          "forgotMessage",
          response.error.message,
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
// СБРОС ПАРОЛЯ
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


      const formData =
        new FormData(
          event.currentTarget
        );


      const password =
        String(
          formData.get("password") || ""
        );


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


      const response =
        await supabase.auth.updateUser({

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
        null;


      const price =
        Number(
          formData.get("price")
        );


      const period =
        formData.get("period") ||
        null;


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

      } else {

        response =
          await supabase
            .from("coaches")
            .insert(payload);

      }


      if (response.error) {

        showMessage(
          "coachMessage",
          response.error.message,
          true
        );

        return;

      }


      showMessage(
        "coachMessage",
        existing.data
          ? "Профиль тренера обновлён."
          : "Профиль тренера создан."
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


  const matchBtn =
    document.getElementById(
      "matchBtn"
    );


  if (matchBtn) {

    matchBtn.addEventListener(
      "click",
      function () {

        showPage(
          "match"
        );

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

        showPage(
          "sports"
        );

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


  const searchInput =
    document.getElementById(
      "searchInput"
    );


  if (searchInput) {

    searchInput.addEventListener(
      "input",
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
