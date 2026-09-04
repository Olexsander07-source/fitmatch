import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// FITMATCH — SUPABASE
// =====================================================

const SUPABASE_URL = "https://ypbhcgcwkpiujcakvaji.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV";

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
    : id || "Не указан";
}


// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {

  const price =
    Number(coach.price || 0);

  const period =
    coach.period || "месяц";

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
    nav.classList.remove("mobile-open");
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

  if (!element) {
    return;
  }

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


  // -----------------------------
  // ВИДЫ СПОРТА
  // -----------------------------

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


  // -----------------------------
  // ТРЕНЕРЫ
  // -----------------------------

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
      "Ошибка загрузки тренеров:",
      coachesResult.error
    );

    coaches = [];

  } else {

    coaches =
      coachesResult.data || [];

  }


  // -----------------------------
  // ОБНОВЛЯЕМ ИНТЕРФЕЙС
  // -----------------------------

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


  card.innerHTML = `

    <div class="coach-score">
      ${Number(coach.score || 0)}
    </div>


    <div class="coach-avatar">
      ${esc(initials(coach.name))}
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
        от ${priceText(coach)}
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

      if (!container) {
        return;
      }


      container.replaceChildren(
        ...sports.map(createSportCard)
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

      if (!select) {
        return;
      }


      const previousValue =
        select.value;


      if (id === "sportFilter") {

        select.innerHTML = `

          <option value="">
            Все виды спорта
          </option>

        `;

      }


      if (id === "matchSport") {

        select.innerHTML = `

          <option value="">
            Не выбрано
          </option>

        `;

      }


      if (id === "coachSport") {

        select.innerHTML = `

          <option value="">
            Выбрать спорт
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


      if (

        [...select.options].some(
          function (option) {

            return (
              option.value ===
              previousValue
            );

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
  ) {
    return;
  }


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


  if (!container) {
    return;
  }


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
    ...top.map(createCoachCard)
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


  if (!container) {
    return;
  }


  const ranking =
    [...coaches].sort(
      function (a, b) {

        return (
          Number(b.score || 0) -
          Number(a.score || 0)
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
// ЦЕЛИ
// =====================================================

function populateGoals() {

  const select =
    document.getElementById(
      "matchGoal"
    );


  if (!select) {
    return;
  }


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
    previousValue;

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


  if (!coach) {
    return;
  }


  const profileContent =
    document.getElementById(
      "profileContent"
    );


  if (!profileContent) {
    return;
  }


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
      .select(`
        rating,
        text,
        created_at,
        user_id
      `)
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

    profileContent.innerHTML = `

      <div class="match-box">

        <p class="error">

          Не удалось загрузить отзывы:

          ${esc(
            result.error.message
          )}

        </p>

      </div>

    `;

    return;
  }


  const reviews =
    result.data || [];


  const canReview =

    Boolean(currentUser) &&

    String(currentUser.id) !==
    String(coach.user_id);


  const reviewHTML =

    reviews.length

      ? reviews.map(
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

      : `

          <p class="lead">
            Отзывов пока нет.
          </p>

        `;


  profileContent.innerHTML = `

    <div class="coach-card">

      <div class="coach-avatar">

        ${esc(
          initials(coach.name)
        )}

      </div>


      <h1 class="page-title">

        ${esc(coach.name)}

      </h1>


      <p class="lead">

        ${esc(
          sportName(coach.sport)
        )}

        ·

        ${esc(
          coach.goal || ""
        )}

        ·

        ${esc(
          coach.format || ""
        )}

      </p>


      <p class="lead">

        ${esc(
          coach.bio || ""
        )}

      </p>


      <div class="tags">

        <span class="tag">

          ⭐ ${Number(
            coach.rating || 0
          ).toFixed(2)}

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

        ? `

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

                <select name="rating">

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
                ></textarea>

              </label>


              <button
                class="btn btn-primary"
                type="submit"
              >
                ОТПРАВИТЬ
              </button>

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


  if (!reviewForm) {
    return;
  }


  reviewForm.addEventListener(
    "submit",

    async function (event) {

      event.preventDefault();


      if (!currentUser) {

        alert(
          "Сначала войди в аккаунт."
        );

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
          formData.get("text") || ""
        ).trim()

        ||

        null;


      const response =
        await supabase
          .from("reviews")
          .insert({

            coach_id:
              coachId,

            user_id:
              currentUser.id,

            rating:
              rating,

            text:
              text

          });


      if (response.error) {

        if (
          response.error.code ===
          "23505"
        ) {

          alert(
            "Вы уже оставляли отзыв этому тренеру."
          );

        } else {

          alert(
            response.error.message
          );

        }

        return;
      }


      await loadData();

      await openProfile(
        coachId
      );

    }
  );

}


// =====================================================
// MATCH
// =====================================================

function findMatch() {

  const sportElement =
    document.getElementById(
      "matchSport"
    );


  const goalElement =
    document.getElementById(
      "matchGoal"
    );


  const formatElement =
    document.getElementById(
      "matchFormat"
    );


  const container =
    document.getElementById(
      "matchResults"
    );


  if (

    !sportElement ||

    !goalElement ||

    !formatElement ||

    !container

  ) {
    return;
  }


  const sport =
    sportElement.value;


  const goal =
    goalElement.value;


  const format =
    formatElement.value;


  const matches =

    coaches

      .map(
        function (coach) {

          let match = 10;


          if (

            sport &&

            String(coach.sport) ===
            String(sport)

          ) {

            match += 40;

          }


          if (

            goal &&

            coach.goal === goal

          ) {

            match += 30;

          }


          if (

            format &&

            coach.format === format

          ) {

            match += 15;

          }


          match += Math.round(

            Number(
              coach.rating || 0
            ) * 5

          );


          return {

            ...coach,

            match:
              Math.min(
                99,
                match
              )

          };

        }
      )

      .sort(
        function (a, b) {

          return (
            b.match -
            a.match
          );

        }
      );


  container.innerHTML = `

    <h2>
      Лучшие совпадения
    </h2>

  `;


  if (!matches.length) {

    container.innerHTML += `

      <p class="lead">
        Пока нет доступных тренеров.
      </p>

    `;

    return;
  }


  matches

    .slice(0, 5)

    .forEach(
      function (coach) {

        const card =
          document.createElement(
            "div"
          );


        card.className =
          "match-result";


        card.innerHTML = `

          <div>

            <b>
              ${esc(coach.name)}
            </b>


            <div>

              ${esc(

                sportName(
                  coach.sport
                )

              )}

            </div>

          </div>


          <div class="match-percent">

            ${coach.match}% MATCH

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


        container.appendChild(
          card
        );

      }
    );

}


// =====================================================
// АВТОРИЗАЦИЯ
// =====================================================

async function refreshUser() {

  const response =
    await supabase.auth.getUser();


  if (response.error) {

    console.warn(
      "Auth:",
      response.error.message
    );

    currentUser = null;

  } else {

    currentUser =
      response.data.user ||
      null;

  }


  const button =
    document.getElementById(
      "authBtn"
    );


  if (!button) {
    return;
  }


  if (currentUser) {

    const email =
      currentUser.email || "";


    const name =
      email.split("@")[0] ||
      "Пользователь";


    button.textContent =
      `Выйти (${name})`;

  } else {

    button.textContent =
      "Войти";

  }


  button.onclick =
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


        button.textContent =
          "Войти";


        return;
      }


      toggleModal(
        "modal",
        true
      );

    };

}


// =====================================================
// ВХОД
// =====================================================

function initAuthForm() {

  const form =
    document.getElementById(
      "authForm"
    );


  if (!form) {
    return;
  }


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

            email:
              email,

            password:
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


  if (!button) {
    return;
  }


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


      const response =
        await supabase.auth
          .signUp({

            email:
              email,

            password:
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


  if (!button) {
    return;
  }


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


  if (!form) {
    return;
  }


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
            password:
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
// СОЗДАТЬ ТРЕНЕРА
// =====================================================

function initCreateCoach() {

  const button =
    document.getElementById(
      "createBtn"
    );


  if (!button) {
    return;
  }


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


  if (!form) {
    return;
  }


  form.addEventListener(

    "submit",

    async function (event) {

      event.preventDefault();


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
          formData.get("name") ||
          ""
        ).trim();


      const sport =
        formData.get("sport");


      const goal =
        String(
          formData.get("goal") ||
          ""
        ).trim()

        ||

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
          formData.get("bio") ||
          ""
        ).trim()

        ||

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

            name:
              name,

            sport:
              sport,

            goal:
              goal,

            format:
              format,

            price:
              price,

            period:
              period,

            bio:
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

        },

        600

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
              event.target ===
              modal
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
  ) {
    return;
  }


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
        event === "PASSWORD_RECOVERY"
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

  } catch (error) {

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

          Ошибка подключения
          к Supabase.

          ${esc(
            error.message ||
            error
          )}

        </p>

      `;

    }

  }

}


init();
