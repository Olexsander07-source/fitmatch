/* =========================================================
   APLEX — Find your level.
   fitmatch.js
   ========================================================= */

import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL = "https://ypbhcgcwkpiujcakvaji.supabase.co";

const SUPABASE_ANON_KEY =
  "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let coaches = [];

let sports = [];

let currentSport = null;


/* =========================================================
   DOM
========================================================= */

const $ = (selector) =>
  document.querySelector(selector);


const $$ = (selector) =>
  document.querySelectorAll(selector);


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  setupNavigation();

  setupAuth();

  setupForms();

  setupFilters();

  setupModals();

  await loadSession();

  await loadSports();

  await loadCoaches();

  renderHomeSports();

  renderSports();

  renderTopCoaches();

  renderCoaches();

  renderRanking();

  fillSportSelects();

  startHeroSlideshow();

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  $$("#mainNav button").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.nav
          );

        }
      );

    }
  );


  $("#logo")?.addEventListener(
    "click",
    () => showPage("home")
  );


  $("#matchBtn")?.addEventListener(
    "click",
    () => showPage("match")
  );


  $("#chooseSportBtn")?.addEventListener(
    "click",
    () => showPage("sports")
  );


  $("#hamburger")?.addEventListener(
    "click",
    toggleMobileMenu
  );

}


function showPage(pageId) {

  $$(".page").forEach(
    page => {

      page.classList.remove(
        "active"
      );

    }
  );


  const page =
    document.getElementById(pageId);


  if (page) {

    page.classList.add(
      "active"
    );

  }


  $("#mainNav")?.classList.remove(
    "mobile-open"
  );


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (pageId === "coaches") {

    renderCoaches();

  }


  if (pageId === "ranking") {

    renderRanking();

  }


  if (pageId === "sports") {

    renderSports();

  }


  if (pageId === "dashboard") {

    renderDashboard();

  }

}


window.showPage = showPage;


/* =========================================================
   MOBILE MENU
========================================================= */

function toggleMobileMenu() {

  const nav =
    $("#mainNav");

  const hamburger =
    $("#hamburger");


  if (!nav) return;


  const isOpen =
    nav.classList.toggle(
      "mobile-open"
    );


  hamburger?.setAttribute(
    "aria-expanded",
    String(isOpen)
  );

}


/* =========================================================
   SESSION
========================================================= */

async function loadSession() {

  try {

    const {
      data,
      error
    } = await supabase.auth.getSession();


    if (error) {

      console.error(error);

      return;

    }


    currentUser =
      data.session?.user || null;


    updateAuthUI();

  } catch (error) {

    console.error(
      "Session error:",
      error
    );

  }

}


/* =========================================================
   AUTH UI
========================================================= */

function updateAuthUI() {

  const authBtn =
    $("#authBtn");

  const createBtn =
    $("#createBtn");


  if (!authBtn) return;


  if (currentUser) {

    authBtn.textContent =
      "Мой аккаунт";


    authBtn.onclick = () =>
      showPage("dashboard");


    if (createBtn) {

      createBtn.textContent =
        "Выйти";


      createBtn.onclick =
        signOut;

    }

  } else {

    authBtn.textContent =
      "Войти";


    authBtn.onclick =
      openLoginModal;


    if (createBtn) {

      createBtn.textContent =
        "Стать тренером";


      createBtn.onclick =
        openCoachModal;

    }

  }

}


/* =========================================================
   AUTH EVENTS
========================================================= */

function setupAuth() {

  $("#authBtn")?.addEventListener(
    "click",
    () => {

      if (!currentUser) {

        openLoginModal();

      }

    }
  );


  $("#createBtn")?.addEventListener(
    "click",
    () => {

      if (!currentUser) {

        openCoachModal();

      }

    }
  );


  $("#authForm")?.addEventListener(
    "submit",
    login
  );


  $("#signupForm")?.addEventListener(
    "submit",
    signup
  );


  $("#forgotPasswordBtn")?.addEventListener(
    "click",
    resetPassword
  );


  $("#signupBtn")?.addEventListener(
    "click",
    () => {

      closeLoginModal();

      $("#signupSection")?.scrollIntoView({
        behavior: "smooth"
      });

    }
  );

}


/* =========================================================
   LOGIN
========================================================= */

async function login(event) {

  event.preventDefault();


  const email =
    $("#authEmail")?.value.trim();

  const password =
    $("#authPassword")?.value;


  const message =
    $("#authMessage");


  if (!email || !password) {

    showMessage(
      message,
      "Введите email и пароль.",
      "error"
    );

    return;

  }


  try {

    showMessage(
      message,
      "Выполняется вход..."
    );


    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({

      email,
      password

    });


    if (error) {

      throw error;

    }


    currentUser =
      data.user;


    showMessage(
      message,
      "Вход выполнен.",
      "success"
    );


    updateAuthUI();


    setTimeout(
      () => {

        closeLoginModal();

        showPage(
          "dashboard"
        );

      },
      500
    );

  } catch (error) {

    console.error(error);


    showMessage(
      message,
      error.message ||
      "Ошибка входа.",
      "error"
    );

  }

}


/* =========================================================
   SIGNUP
========================================================= */

async function signup(event) {

  event.preventDefault();


  const form =
    event.currentTarget;


  const email =
    form.email.value.trim();

  const password =
    form.password.value;


  const message =
    $("#signupMessage");


  try {

    showMessage(
      message,
      "Создаём аккаунт..."
    );


    const {
      data,
      error
    } = await supabase.auth.signUp({

      email,

      password,

      options: {

        emailRedirectTo:
          window.location.origin

      }

    });


    if (error) {

      throw error;

    }


    currentUser =
      data.user;


    if (data.user?.identities?.length === 0) {

      showMessage(
        message,
        "Этот email уже зарегистрирован.",
        "error"
      );

      return;

    }


    showMessage(
      message,
      "Аккаунт создан. Проверьте email для подтверждения.",
      "success"
    );


    form.reset();

  } catch (error) {

    console.error(error);


    showMessage(
      message,
      error.message ||
      "Не удалось создать аккаунт.",
      "error"
    );

  }

}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {

  try {

    await supabase.auth.signOut();


    currentUser = null;


    updateAuthUI();


    showPage(
      "home"
    );

  } catch (error) {

    console.error(error);

  }

}


/* =========================================================
   RESET PASSWORD EMAIL
========================================================= */

async function resetPassword() {

  const email =
    $("#authEmail")?.value.trim();


  const message =
    $("#authMessage");


  if (!email) {

    showMessage(
      message,
      "Введите ваш email.",
      "error"
    );

    return;

  }


  try {

    const {
      error
    } = await supabase.auth.resetPasswordForEmail(

      email,

      {
        redirectTo:
          window.location.origin
      }

    );


    if (error) {

      throw error;

    }


    showMessage(
      message,
      "Письмо для восстановления пароля отправлено.",
      "success"
    );

  } catch (error) {

    showMessage(
      message,
      error.message ||
      "Ошибка восстановления пароля.",
      "error"
    );

  }

}


/* =========================================================
   SPORTS
========================================================= */

async function loadSports() {

  try {

    const {
      data,
      error
    } = await supabase
      .from("sports")
      .select("*")
      .order("name");


    if (error) {

      throw error;

    }


    sports =
      data || [];

  } catch (error) {

    console.error(
      "Sports error:",
      error
    );


    sports = [];

  }

}


/* =========================================================
   COACHES
========================================================= */

async function loadCoaches() {

  try {

    const {
      data,
      error
    } = await supabase
      .from("coaches")
      .select(`
        *,
        sports (
          id,
          name,
          slug
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


    if (error) {

      throw error;

    }


    coaches =
      data || [];

  } catch (error) {

    console.error(
      "Coaches error:",
      error
    );


    coaches = [];

  }

}


/* =========================================================
   RENDER HOME SPORTS
========================================================= */

function renderHomeSports() {

  const container =
    $("#homeSports");


  if (!container) return;


  const selectedSports =
    sports.slice(0, 4);


  if (!selectedSports.length) {

    container.innerHTML =
      emptyHTML(
        "Виды спорта пока не добавлены."
      );

    return;

  }


  container.innerHTML =
    selectedSports
      .map(
        sport =>
          sportCardHTML(sport)
      )
      .join("");


  addSportCardEvents();

}


/* =========================================================
   RENDER SPORTS
========================================================= */

function renderSports() {

  const container =
    $("#sportsList");


  if (!container) return;


  if (!sports.length) {

    container.innerHTML =
      emptyHTML(
        "Виды спорта пока не добавлены."
      );

    return;

  }


  container.innerHTML =
    sports
      .map(
        sport =>
          sportCardHTML(sport)
      )
      .join("");


  addSportCardEvents();

}


/* =========================================================
   SPORT CARD
========================================================= */

function sportCardHTML(sport) {

  const image =
    sport.image_url ||
    sport.image ||
    "";


  const backgroundStyle =
    image
      ? `style="background-image:url('${escapeHTML(image)}')"`
      : "";


  return `

    <article
      class="sport-card"
      data-sport-id="${sport.id}"
      ${backgroundStyle}
    >

      <div class="sport-card-content">

        <div class="sport-icon">
          ${sport.icon || "💪"}
        </div>

        <h3>
          ${escapeHTML(sport.name)}
        </h3>

        <p>
          Найти тренера →
        </p>

      </div>

    </article>

  `;

}


/* =========================================================
   SPORT EVENTS
========================================================= */

function addSportCardEvents() {

  $$(".sport-card").forEach(
    card => {

      card.addEventListener(
        "click",
        () => {

          const sportId =
            card.dataset.sportId;


          openSport(
            sportId
          );

        }
      );

    }
  );

}


/* =========================================================
   OPEN SPORT
========================================================= */

function openSport(sportId) {

  currentSport =
    sports.find(
      sport =>
        String(sport.id) ===
        String(sportId)
    );


  if (!currentSport) return;


  showPage(
    "coaches"
  );


  $("#categoryBanner").style.display =
    "block";


  $("#categoryBannerTitle").textContent =
    currentSport.name;


  $("#categoryBannerSubtitle").textContent =
    currentSport.description ||
    `Найдите тренера по ${currentSport.name}.`;


  $("#sportFilter").value =
    String(currentSport.id);


  renderCategoryBanner();

  renderCoaches();

}


/* =========================================================
   CATEGORY BANNER
========================================================= */

function renderCategoryBanner() {

  if (!currentSport) return;


  const coachesCount =
    coaches.filter(
      coach =>
        String(
          getCoachSportId(coach)
        ) === String(currentSport.id)
    ).length;


  const stats =
    $("#categoryBannerStats");


  if (stats) {

    stats.innerHTML = `

      <span>
        ${coachesCount} тренеров
      </span>

      <span>
        ${escapeHTML(currentSport.name)}
      </span>

    `;

  }


  const graphic =
    $("#categoryBannerGraphic");


  if (graphic) {

    graphic.innerHTML =
      getSportGraphic(
        currentSport.name
      );

  }


  $("#cyclingBannerCta")?.addEventListener(
    "click",
    () => {

      $("#searchInput")?.scrollIntoView({
        behavior: "smooth"
      });

    }
  );

}


/* =========================================================
   SPORT GRAPHICS
========================================================= */

function getSportGraphic(name) {

  const sport =
    String(name).toLowerCase();


  if (
    sport.includes("cycl") ||
    sport.includes("velo") ||
    sport.includes("bike")
  ) {

    return `
      <circle cx="100" cy="220" r="55" stroke="currentColor" stroke-width="12"/>
      <circle cx="300" cy="220" r="55" stroke="currentColor" stroke-width="12"/>
      <path d="M100 220L165 110L235 220H100ZM165 110L210 110L255 165M165 110L135 75M210 110L245 70"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `;

  }


  return `
    <path
      d="M110 230C110 150 170 90 250 90C300 90 335 115 350 150"
      stroke="currentColor"
      stroke-width="18"
      stroke-linecap="round"
    />

    <circle
      cx="150"
      cy="90"
      r="35"
      stroke="currentColor"
      stroke-width="18"
    />

    <path
      d="M150 125L220 170L285 135"
      stroke="currentColor"
      stroke-width="18"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <path
      d="M220 170L195 245M220 170L285 245"
      stroke="currentColor"
      stroke-width="18"
      stroke-linecap="round"
    />
  `;

}


/* =========================================================
   TOP COACHES
========================================================= */

function renderTopCoaches() {

  const container =
    $("#topCoaches");


  if (!container) return;


  const top =
    [...coaches]
      .slice(0, 3);


  if (!top.length) {

    container.innerHTML =
      emptyHTML(
        "Тренеры пока не добавлены."
      );

    return;

  }


  container.innerHTML =
    top
      .map(
        coach =>
          coachCardHTML(coach)
      )
      .join("");


  addCoachCardEvents();

}


/* =========================================================
   RENDER COACHES
========================================================= */

function renderCoaches() {

  const container =
    $("#coachesList");


  if (!container) return;


  const search =
    ($("#searchInput")?.value || "")
      .trim()
      .toLowerCase();


  const sportId =
    $("#sportFilter")?.value || "";


  const format =
    $("#formatFilter")?.value || "";


  let filtered =
    [...coaches];


  if (sportId) {

    filtered =
      filtered.filter(
        coach =>
          String(
            getCoachSportId(coach)
          ) === String(sportId)
      );

  }


  if (format) {

    filtered =
      filtered.filter(
        coach =>
          coach.format === format
      );

  }


  if (search) {

    filtered =
      filtered.filter(
        coach => {

          const text = [

            coach.name,

            coach.bio,

            coach.goal,

            getCoachSportName(coach)

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return text.includes(
            search
          );

        }
      );

  }


  if (!filtered.length) {

    container.innerHTML =
      emptyHTML(
        "Тренеры не найдены."
      );

    return;

  }


  container.innerHTML =
    filtered
      .map(
        coach =>
          coachCardHTML(coach)
      )
      .join("");


  addCoachCardEvents();

}


/* =========================================================
   COACH CARD
========================================================= */

function coachCardHTML(coach) {

  const image =
    coach.image_url ||
    coach.avatar_url ||
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80";


  const rating =
    Number(
      coach.rating || 0
    ).toFixed(1);


  const sport =
    getCoachSportName(coach);


  const price =
    coach.price
      ? `${escapeHTML(coach.price)} €`
      : "Цена не указана";


  const format =
    coach.format ||
    "Онлайн / Офлайн";


  const goal =
    coach.goal ||
    "Персональные тренировки";


  return `

    <article
      class="coach-card"
      data-coach-id="${coach.id}"
    >

      <div class="coach-image">

        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(coach.name || "Тренер")}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80'"
        >

      </div>


      <div class="coach-content">

        <div class="coach-score">
          ${rating}
        </div>


        <h3>
          ${escapeHTML(
            coach.name ||
            "Тренер"
          )}
        </h3>


        <p class="coach-sport">
          ${escapeHTML(
            sport || "Спорт"
          )}
        </p>


        <div class="tags">

          <span class="tag">
            ${escapeHTML(goal)}
          </span>

          <span class="tag">
            ${escapeHTML(format)}
          </span>

        </div>


        <div class="card-footer">

          <span>
            ${price}
          </span>


          <span>
            Подробнее →
          </span>

        </div>

      </div>

    </article>

  `;

}


/* =========================================================
   COACH EVENTS
========================================================= */

function addCoachCardEvents() {

  $$(".coach-card").forEach(
    card => {

      card.addEventListener(
        "click",
        () => {

          openCoachProfile(
            card.dataset.coachId
          );

        }
      );

    }
  );

}


/* =========================================================
   COACH PROFILE
========================================================= */

function openCoachProfile(coachId) {

  const coach =
    coaches.find(
      item =>
        String(item.id) ===
        String(coachId)
    );


  if (!coach) return;


  const container =
    $("#profileContent");


  if (!container) return;


  const image =
    coach.image_url ||
    coach.avatar_url ||
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80";


  const sport =
    getCoachSportName(coach);


  const rating =
    Number(
      coach.rating || 0
    ).toFixed(1);


  container.innerHTML = `

    <button
      id="backToCoaches"
      class="btn"
      type="button"
    >
      ← Назад
    </button>


    <div class="coach-profile">

      <div class="coach-profile-image">

        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(coach.name || "Тренер")}"
          onerror="this.src='https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80'"
        >

      </div>


      <div class="coach-profile-info">

        <p class="eyebrow">
          ${escapeHTML(sport || "APLEX COACH")}
        </p>


        <h1>
          ${escapeHTML(
            coach.name || "Тренер"
          )}
        </h1>


        <p>
          ⭐ ${rating}
        </p>


        <p>
          ${escapeHTML(
            coach.bio ||
            "Информация о тренере будет добавлена."
          )}
        </p>


        <p>
          <strong>
            Специализация:
          </strong>

          ${escapeHTML(
            coach.goal ||
            "Персональные тренировки"
          )}
        </p>


        <p>
          <strong>
            Формат:
          </strong>

          ${escapeHTML(
            coach.format ||
            "Не указан"
          )}
        </p>


        <p>
          <strong>
            Цена:
          </strong>

          ${coach.price
            ? `${escapeHTML(coach.price)} €`
            : "Не указана"
          }
        </p>


        <div class="actions">

          <button
            id="contactCoachBtn"
            class="btn btn-primary"
            type="button"
          >
            НАПИСАТЬ ТРЕНЕРУ
          </button>

        </div>

      </div>

    </div>

  `;


  $("#backToCoaches")?.addEventListener(
    "click",
    () => showPage("coaches")
  );


  $("#contactCoachBtn")?.addEventListener(
    "click",
    () => {

      if (!currentUser) {

        openLoginModal();

        return;

      }


      alert(
        "Система сообщений будет подключена к новой структуре Supabase."
      );

    }
  );


  showPage(
    "profile"
  );

}


/* =========================================================
   RANKING
========================================================= */

function renderRanking() {

  const container =
    $("#rankingList");


  if (!container) return;


  const ranked =
    [...coaches]
      .sort(
        (a, b) =>
          Number(b.rating || 0) -
          Number(a.rating || 0)
      );


  if (!ranked.length) {

    container.innerHTML =
      emptyHTML(
        "Рейтинг пока пуст."
      );

    return;

  }


  container.innerHTML =
    ranked
      .map(
        (coach, index) => `

          <article
            class="ranking-item"
            data-coach-id="${coach.id}"
          >

            <div class="ranking-position">
              ${index + 1}
            </div>


            <div>

              <strong>
                ${escapeHTML(
                  coach.name || "Тренер"
                )}
              </strong>


              <p>
                ${escapeHTML(
                  getCoachSportName(coach) ||
                  "Спорт"
                )}
              </p>

            </div>


            <strong>
              ⭐ ${Number(
                coach.rating || 0
              ).toFixed(1)}
            </strong>

          </article>

        `
      )
      .join("");


  $$(".ranking-item").forEach(
    item => {

      item.addEventListener(
        "click",
        () => {

          openCoachProfile(
            item.dataset.coachId
          );

        }
      );

    }
  );

}


/* =========================================================
   MATCH
========================================================= */

function setupForms() {

  $("#findMatchBtn")?.addEventListener(
    "click",
    findMatch
  );


  $("#createForm")?.addEventListener(
    "submit",
    saveCoachProfile
  );


  $("#resetPasswordForm")?.addEventListener(
    "submit",
    updatePassword
  );

}


function findMatch() {

  const sportId =
    $("#matchSport")?.value || "";


  const goal =
    $("#matchGoal")?.value || "";


  const format =
    $("#matchFormat")?.value || "";


  let results =
    [...coaches];


  if (sportId) {

    results =
      results.filter(
        coach =>
          String(
            getCoachSportId(coach)
          ) === String(sportId)
      );

  }


  if (format) {

    results =
      results.filter(
        coach =>
          coach.format === format
      );

  }


  if (goal) {

    const goalText =
      String(goal).toLowerCase();


    results =
      results.filter(
        coach => {

          const text = [

            coach.goal,
            coach.bio

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return (
            text.includes(goalText) ||
            goalText.includes(text)
          );

        }
      );

  }


  const container =
    $("#matchResults");


  if (!container) return;


  if (!results.length) {

    container.innerHTML =
      emptyHTML(
        "Подходящий тренер пока не найден. Попробуйте изменить параметры."
      );

    return;

  }


  container.innerHTML =
    results
      .slice(0, 6)
      .map(
        coach =>
          coachCardHTML(coach)
      )
      .join("");


  addCoachCardEvents();

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  $("#searchInput")?.addEventListener(
    "input",
    renderCoaches
  );


  $("#sportFilter")?.addEventListener(
    "change",
    () => {

      if (!$("#sportFilter").value) {

        currentSport = null;

        $("#categoryBanner").style.display =
          "none";

      }

      renderCoaches();

    }
  );


  $("#formatFilter")?.addEventListener(
    "change",
    renderCoaches
  );

}


/* =========================================================
   FILL SELECTS
========================================================= */

function fillSportSelects() {

  const selects = [

    $("#sportFilter"),
    $("#matchSport"),
    $("#coachSport")

  ].filter(Boolean);


  selects.forEach(
    select => {

      const currentValue =
        select.value;


      const firstOption =
        select.querySelector("option");


      const firstOptionHTML =
        firstOption
          ? firstOption.outerHTML
          : `<option value="">Выберите спорт</option>`;


      select.innerHTML =
        firstOptionHTML;


      sports.forEach(
        sport => {

          const option =
            document.createElement("option");


          option.value =
            sport.id;


          option.textContent =
            sport.name;


          select.appendChild(option);

        }
      );


      select.value =
        currentValue;

    }
  );


  const goalSelect =
    $("#matchGoal");


  if (goalSelect) {

    const goals =
      [
        "Похудение",
        "Набор мышечной массы",
        "Сила",
        "Выносливость",
        "Подготовка к соревнованиям",
        "Общее здоровье"
      ];


    goals.forEach(
      goal => {

        const option =
          document.createElement("option");


        option.value =
          goal;


        option.textContent =
          goal;


        goalSelect.appendChild(option);

      }
    );

  }

}


/* =========================================================
   SAVE COACH PROFILE
========================================================= */

async function saveCoachProfile(event) {

  event.preventDefault();


  const form =
    event.currentTarget;


  const message =
    $("#coachMessage");


  if (!currentUser) {

    showMessage(
      message,
      "Сначала необходимо войти в аккаунт.",
      "error"
    );

    return;

  }


  const name =
    form.name.value.trim();


  const sportId =
    form.sport.value;


  const goal =
    form.goal.value.trim();


  const format =
    form.format.value;


  const price =
    Number(form.price.value);


  const period =
    form.period.value;


  const bio =
    form.bio.value.trim();


  try {

    showMessage(
      message,
      "Сохранение..."
    );


    const payload = {

      user_id:
        currentUser.id,

      name,

      sport_id:
        sportId,

      goal,

      format,

      price,

      period,

      bio,

      updated_at:
        new Date().toISOString()

    };


    const {
      data: existing,
      error: findError
    } = await supabase
      .from("coaches")
      .select("id")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();


    if (findError) {

      throw findError;

    }


    let error;


    if (existing) {

      ({
        error
      } = await supabase
        .from("coaches")
        .update(payload)
        .eq(
          "id",
          existing.id
        ));

    } else {

      ({
        error
      } = await supabase
        .from("coaches")
        .insert(payload)
      );

    }


    if (error) {

      throw error;

    }


    showMessage(
      message,
      "Профиль тренера сохранён.",
      "success"
    );


    await loadCoaches();

    renderTopCoaches();

    renderCoaches();

    renderRanking();


    setTimeout(
      closeCoachModal,
      700
    );

  } catch (error) {

    console.error(error);


    showMessage(
      message,
      error.message ||
      "Не удалось сохранить профиль.",
      "error"
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function renderDashboard() {

  const container =
    $("#dashboardContent");


  if (!container) return;


  if (!currentUser) {

    container.innerHTML = `

      <div class="empty">

        <p>
          Войдите в аккаунт,
          чтобы открыть личный кабинет.
        </p>

        <button
          id="dashboardLogin"
          class="btn btn-primary"
          type="button"
        >
          ВОЙТИ
        </button>

      </div>

    `;


    $("#dashboardLogin")?.addEventListener(
      "click",
      openLoginModal
    );


    return;

  }


  let myCoach = null;


  try {

    const {
      data,
      error
    } = await supabase
      .from("coaches")
      .select(`
        *,
        sports (
          id,
          name
        )
      `)
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();


    if (error) {

      throw error;

    }


    myCoach =
      data;

  } catch (error) {

    console.error(error);

  }


  container.innerHTML = `

    <div class="score-box">

      <p>
        ${escapeHTML(
          currentUser.email
        )}
      </p>


      ${
        myCoach
          ? `

            <h2>
              ${escapeHTML(
                myCoach.name
              )}
            </h2>

            <p>
              Ваш профиль тренера активен.
            </p>

            <div class="actions">

              <button
                id="editCoachProfile"
                class="btn btn-primary"
                type="button"
              >
                РЕДАКТИРОВАТЬ АНКЕТУ
              </button>


              <button
                id="dashboardLogout"
                class="btn"
                type="button"
              >
                ВЫЙТИ
              </button>

            </div>

          `
          : `

            <h2>
              Добро пожаловать в APLEX
            </h2>

            <p>
              Вы можете создать профиль тренера.
            </p>

            <div class="actions">

              <button
                id="createCoachFromDashboard"
                class="btn btn-primary"
                type="button"
              >
                СОЗДАТЬ АНКЕТУ ТРЕНЕРА
              </button>


              <button
                id="dashboardLogout"
                class="btn"
                type="button"
              >
                ВЫЙТИ
              </button>

            </div>

          `
      }

    </div>

  `;


  $("#dashboardLogout")?.addEventListener(
    "click",
    signOut
  );


  $("#createCoachFromDashboard")?.addEventListener(
    "click",
    openCoachModal
  );


  $("#editCoachProfile")?.addEventListener(
    "click",
    () => {

      openCoachModal(
        myCoach
      );

    }
  );

}


/* =========================================================
   MODALS
========================================================= */

function setupModals() {

  $("#authClose")?.addEventListener(
    "click",
    closeLoginModal
  );


  $("#modalCancel")?.addEventListener(
    "click",
    closeLoginModal
  );


  $("#coachClose")?.addEventListener(
    "click",
    closeCoachModal
  );


  $("#coachCancel")?.addEventListener(
    "click",
    closeCoachModal
  );


  $("#resetClose")?.addEventListener(
    "click",
    closeResetModal
  );


  $("#resetCancel")?.addEventListener(
    "click",
    closeResetModal
  );


  $$(".modal").forEach(
    modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target === modal
          ) {

            modal.classList.remove(
              "show"
            );

            document.body.classList.remove(
              "modal-open"
            );

          }

        }
      );

    }
  );


  window.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {

        $$(".modal.show").forEach(
          modal =>
            modal.classList.remove("show")
        );


        document.body.classList.remove(
          "modal-open"
        );

      }

    }
  );

}


function openLoginModal() {

  $("#modal")?.classList.add(
    "show"
  );


  document.body.classList.add(
    "modal-open"
  );


  $("#authEmail")?.focus();

}


function closeLoginModal() {

  $("#modal")?.classList.remove(
    "show"
  );


  document.body.classList.remove(
    "modal-open"
  );

}


function openCoachModal(coach = null) {

  if (!currentUser) {

    openLoginModal();

    return;

  }


  const modal =
    $("#coachModal");


  if (!modal) return;


  modal.classList.add(
    "show"
  );


  document.body.classList.add(
    "modal-open"
  );


  const form =
    $("#createForm");


  if (
    coach &&
    form
  ) {

    form.name.value =
      coach.name || "";


    form.sport.value =
      getCoachSportId(coach) || "";


    form.goal.value =
      coach.goal || "";


    form.format.value =
      coach.format || "Онлайн";


    form.price.value =
      coach.price || "";


    form.period.value =
      coach.period || "месяц";


    form.bio.value =
      coach.bio || "";

  }

}


function closeCoachModal() {

  $("#coachModal")?.classList.remove(
    "show"
  );


  document.body.classList.remove(
    "modal-open"
  );


  $("#coachMessage").innerHTML = "";

}


function closeResetModal() {

  $("#resetPasswordModal")?.classList.remove(
    "show"
  );


  document.body.classList.remove(
    "modal-open"
  );

}


/* =========================================================
   UPDATE PASSWORD
========================================================= */

async function updatePassword(event) {

  event.preventDefault();


  const password =
    $("#newPassword")?.value;


  const confirm =
    $("#confirmPassword")?.value;


  const message =
    $("#resetMessage");


  if (password !== confirm) {

    showMessage(
      message,
      "Пароли не совпадают.",
      "error"
    );

    return;

  }


  try {

    const {
      error
    } = await supabase.auth.updateUser({

      password

    });


    if (error) {

      throw error;

    }


    showMessage(
      message,
      "Пароль успешно изменён.",
      "success"
    );


    setTimeout(
      closeResetModal,
      700
    );

  } catch (error) {

    showMessage(
      message,
      error.message ||
      "Не удалось изменить пароль.",
      "error"
    );

  }

}


/* =========================================================
   AUTH STATE
========================================================= */

supabase.auth.onAuthStateChange(
  (event, session) => {

    currentUser =
      session?.user || null;


    updateAuthUI();


    if (
      event === "PASSWORD_RECOVERY"
    ) {

      $("#resetPasswordModal")?.classList.add(
        "show"
      );


      document.body.classList.add(
        "modal-open"
      );

    }

  }
);


/* =========================================================
   HERO SLIDESHOW
========================================================= */

function startHeroSlideshow() {

  const hero =
    $("#heroSlideshow");


  if (!hero) return;


  const images = [

    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=85",

    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=85",

    "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1600&q=85"

  ];


  let index = 0;


  hero.style.backgroundImage =
    `url("${images[index]}")`;


  setInterval(
    () => {

      index =
        (index + 1) %
        images.length;


      hero.style.backgroundImage =
        `url("${images[index]}")`;

    },
    7000
  );

}


/* =========================================================
   HELPERS
========================================================= */

function getCoachSportId(coach) {

  if (coach.sport_id) {

    return coach.sport_id;

  }


  if (coach.sports?.id) {

    return coach.sports.id;

  }


  return null;

}


function getCoachSportName(coach) {

  if (coach.sports?.name) {

    return coach.sports.name;

  }


  if (coach.sport_name) {

    return coach.sport_name;

  }


  return "";

}


function showMessage(
  element,
  text,
  type = ""
) {

  if (!element) return;


  element.innerHTML = `

    <div class="${type}">

      ${escapeHTML(text)}

    </div>

  `;

}


function emptyHTML(text) {

  return `

    <div class="empty">

      ${escapeHTML(text)}

    </div>

  `;

}


function escapeHTML(value) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}
