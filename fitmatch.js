// FITMATCH — основной JavaScript
// Работает без ошибок, даже если некоторые элементы страницы отсутствуют.

document.addEventListener("DOMContentLoaded", () => {
  console.log("FITMATCH запущен");

  // =========================
  // ГОД В FOOTER
  // =========================

  const yearElement = document.querySelector("[data-current-year]");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // =========================
  // МОБИЛЬНОЕ МЕНЮ
  // =========================

  const menuButton =
    document.querySelector(".menu-toggle") ||
    document.querySelector("[data-menu-toggle]");

  const navigation =
    document.querySelector(".nav-links") ||
    document.querySelector("[data-navigation]");

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      navigation.classList.toggle("active");

      const isOpen = navigation.classList.contains("active");

      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // =========================
  // ПЛАВНАЯ ПРОКРУТКА
  // =========================

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") {
        return;
      }

      const target = document.querySelector(targetId);

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

        if (navigation) {
          navigation.classList.remove("active");
        }
      }
    });
  });

  // =========================
  // ПОИСК ТРЕНЕРОВ
  // =========================

  const searchInput =
    document.querySelector("#trainer-search") ||
    document.querySelector("[data-trainer-search]");

  const trainerCards = document.querySelectorAll(
    ".trainer-card, [data-trainer-card]"
  );

  if (searchInput && trainerCards.length > 0) {
    searchInput.addEventListener("input", () => {
      const searchValue = searchInput.value
        .trim()
        .toLowerCase();

      trainerCards.forEach((card) => {
        const text = card.textContent.toLowerCase();

        const matches = text.includes(searchValue);

        card.style.display = matches ? "" : "none";
      });
    });
  }

  // =========================
  // ФИЛЬТР ПО ВИДУ СПОРТА
  // =========================

  const sportButtons = document.querySelectorAll(
    "[data-sport-filter]"
  );

  if (sportButtons.length > 0 && trainerCards.length > 0) {
    sportButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sport = button.dataset.sportFilter;

        sportButtons.forEach((item) => {
          item.classList.remove("active");
        });

        button.classList.add("active");

        trainerCards.forEach((card) => {
          const cardSport = card.dataset.sport || "";

          const showCard =
            sport === "all" ||
            cardSport.toLowerCase() === sport.toLowerCase();

          card.style.display = showCard ? "" : "none";
        });
      });
    });
  }

  // =========================
  // КНОПКИ "НАЙТИ ТРЕНЕРА"
  // =========================

  const findTrainerButtons = document.querySelectorAll(
    "[data-find-trainer]"
  );

  findTrainerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const trainersSection =
        document.querySelector("#trainers") ||
        document.querySelector("[data-trainers-section]");

      if (trainersSection) {
        trainersSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });

  // =========================
  // ФОРМА ОБРАТНОЙ СВЯЗИ
  // =========================

  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      const isDemoForm = form.dataset.demo === "true";

      if (isDemoForm) {
        event.preventDefault();

        alert("Спасибо! Ваша заявка принята.");
        form.reset();
      }
    });
  });

  // =========================
  // КНОПКИ ВЫБОРА ТРЕНЕРА
  // =========================

  const trainerButtons = document.querySelectorAll(
    "[data-select-trainer]"
  );

  trainerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const trainerName =
        button.dataset.trainerName || "Тренер";

      alert(
        `Вы выбрали тренера: ${trainerName}`
      );
    });
  });
});
