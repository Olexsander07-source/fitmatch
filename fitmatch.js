const CATEGORY_VISUALS = {
  running: {
    word1: "",
    word2: "БЕГ",
    subtitle: "Тренировки на скорость, дыхание и технику бега",
    stats: ["Выносливость", "Скорость", "Прогресс"],
    icon: `
      <circle cx="150" cy="55" r="18" stroke="currentColor" stroke-width="6"/>
      <path d="M150 74 L165 140 L110 200 M165 140 L235 175 M165 140 L135 95 L225 85"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>
      <path d="M100 230 H150"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>
    `
  },

  bodybuilding: {
    word1: "",
    word2: "БОДИБИЛДИНГ",
    subtitle: "Мышечная масса, сила и рельеф под руководством профи",
    stats: ["Сила", "Масса", "Рельеф"],
    icon: `
      <circle cx="90" cy="170" r="45"
        stroke="currentColor"
        stroke-width="6"/>

      <circle cx="310" cy="170" r="45"
        stroke="currentColor"
        stroke-width="6"/>

      <line x1="132" y1="170"
        x2="268" y2="170"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"/>

      <line x1="150" y1="135"
        x2="150" y2="205"
        stroke="currentColor"
        stroke-width="4"/>

      <line x1="250" y1="135"
        x2="250" y2="205"
        stroke="currentColor"
        stroke-width="4"/>
    `
  },

  swimming: {
    word1: "",
    word2: "ПЛАВАНИЕ",
    subtitle: "Техника плавания, дыхание и выносливость в воде",
    stats: ["Техника", "Дыхание", "Выносливость"],
    icon: `
      <circle cx="130" cy="90"
        r="18"
        stroke="currentColor"
        stroke-width="6"/>

      <path d="M130 108 L175 160"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>

      <path d="M40 210
        Q80 190 120 210
        T200 210
        T280 210
        T360 210"
        stroke="currentColor"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"/>

      <path d="M40 250
        Q80 230 120 250
        T200 250
        T280 250
        T360 250"
        stroke="currentColor"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"
        opacity="0.6"/>
    `
  },

  cycling: {
    word1: "ВЕЛО",
    word2: "СПОРТ",
    subtitle: "Тренировки на выносливость, скорость и силу",
    stats: ["Выносливость", "Скорость", "Прогресс"],
    icon: `
      <circle cx="110" cy="210"
        r="70"
        stroke="currentColor"
        stroke-width="6"/>

      <circle cx="290" cy="210"
        r="70"
        stroke="currentColor"
        stroke-width="6"/>

      <circle cx="110" cy="210"
        r="6"
        fill="currentColor"/>

      <circle cx="290" cy="210"
        r="6"
        fill="currentColor"/>

      <path d="M110 210
        L170 110
        H220
        M170 110
        L140 210
        M220 110
        L290 210
        M220 110
        L245 70
        H270"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"/>

      <circle cx="245" cy="70"
        r="10"
        stroke="currentColor"
        stroke-width="6"/>
    `
  },

  combat: {
    word1: "",
    word2: "ЕДИНОБОРСТВА",
    subtitle: "Техника, реакция и физическая готовность в единоборствах",
    stats: ["Реакция", "Техника", "Сила"],
    icon: `
      <circle cx="200" cy="80"
        r="25"
        stroke="currentColor"
        stroke-width="6"/>

      <path d="M200 105
        L200 190
        M200 125
        L120 155
        M200 125
        L280 155
        M200 190
        L145 260
        M200 190
        L255 260"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

      <circle cx="110" cy="155"
        r="20"
        stroke="currentColor"
        stroke-width="6"/>

      <circle cx="290" cy="155"
        r="20"
        stroke="currentColor"
        stroke-width="6"/>
    `
  },

  yoga: {
    word1: "",
    word2: "ЙОГА",
    subtitle: "Гибкость, баланс и осознанность тела",
    stats: ["Гибкость", "Баланс", "Спокойствие"],
    icon: `
      <circle cx="200" cy="65"
        r="22"
        stroke="currentColor"
        stroke-width="6"/>

      <path d="M200 90
        L160 170
        L110 210
        M200 90
        L240 170
        L290 210"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"/>

      <path d="M120 225
        Q200 260 280 225"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
        stroke-linecap="round"/>
    `
  },

  /* =========================
     КРОССФИТ — ОТДЕЛЬНАЯ ИКОНКА
  ========================= */

  crossfit: {
    word1: "",
    word2: "КРОССФИТ",
    subtitle: "Сила, выносливость и интенсивные функциональные тренировки",
    stats: ["Сила", "Интенсивность", "Выносливость"],
    icon: `
      <!-- ШТАНГА -->

      <line x1="60" y1="140"
        x2="340" y2="140"
        stroke="currentColor"
        stroke-width="10"
        stroke-linecap="round"/>

      <rect x="45" y="105"
        width="25"
        height="70"
        rx="5"
        stroke="currentColor"
        stroke-width="6"/>

      <rect x="75" y="115"
        width="22"
        height="50"
        rx="5"
        stroke="currentColor"
        stroke-width="6"/>

      <rect x="330" y="105"
        width="25"
        height="70"
        rx="5"
        stroke="currentColor"
        stroke-width="6"/>

      <rect x="303" y="115"
        width="22"
        height="50"
        rx="5"
        stroke="currentColor"
        stroke-width="6"/>

      <!-- ЧЕЛОВЕК -->

      <circle cx="200" cy="75"
        r="20"
        stroke="currentColor"
        stroke-width="6"/>

      <path d="M200 95
        L200 190
        M200 120
        L150 140
        M200 120
        L250 140
        M200 190
        L160 260
        M200 190
        L240 260"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `
  },

  tennis: {
    word1: "",
    word2: "ТЕННИС",
    subtitle: "Техника удара, тактика и физическая форма на корте",
    stats: ["Точность", "Тактика", "Форма"],
    icon: `
      <ellipse cx="170" cy="120"
        rx="75"
        ry="95"
        stroke="currentColor"
        stroke-width="6"/>

      <line x1="170" y1="215"
        x2="170" y2="280"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"/>

      <line x1="135" y1="245"
        x2="205" y2="245"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>

      <circle cx="310" cy="220"
        r="24"
        stroke="currentColor"
        stroke-width="6"/>

      <path d="M290 205
        Q310 220 330 205"
        stroke="currentColor"
        stroke-width="4"
        fill="none"/>
    `
  },

  /* =========================
     ФИТНЕС — ОТДЕЛЬНАЯ ИКОНКА
  ========================= */

  fitness: {
    word1: "",
    word2: "ФИТНЕС",
    subtitle: "Форма, здоровье и уверенность в своём теле",
    stats: ["Форма", "Энергия", "Здоровье"],
    icon: `
      <!-- ГОЛОВА -->

      <circle cx="200" cy="65"
        r="23"
        stroke="currentColor"
        stroke-width="6"/>

      <!-- ТЕЛО -->

      <path d="M200 90
        C175 120 165 150 170 190
        L180 250
        M200 90
        C225 120 235 150 230 190
        L220 250"
        stroke="currentColor"
        stroke-width="7"
        fill="none"
        stroke-linecap="round"/>

      <!-- РУКИ -->

      <path d="M180 125
        L110 170
        M220 125
        L290 170"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"/>

      <!-- НОГИ -->

      <path d="M180 250
        L145 280
        M220 250
        L255 280"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"/>

      <!-- ПУЛЬС -->

      <path d="M55 230
        H110
        L130 200
        L155 250
        L180 220
        H345"
        stroke="currentColor"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    `
  },

  /* =========================
     ФУТБОЛ — НОВАЯ ОТДЕЛЬНАЯ ИКОНКА
  ========================= */

  football: {
    word1: "",
    word2: "ФУТБОЛ",
    subtitle: "Техника, скорость, выносливость и тактическая подготовка",
    stats: ["Скорость", "Техника", "Тактика"],
    icon: `
      <!-- МЯЧ -->

      <circle cx="200" cy="150"
        r="90"
        stroke="currentColor"
        stroke-width="7"/>

      <!-- ЦЕНТР МЯЧА -->

      <path d="M200 115
        L225 135
        L215 165
        L185 165
        L175 135
        Z"
        stroke="currentColor"
        stroke-width="6"
        fill="none"
        stroke-linejoin="round"/>

      <!-- ЛИНИИ -->

      <path d="M175 135
        L135 110
        M225 135
        L265 110
        M185 165
        L155 210
        M215 165
        L245 210"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"/>

      <path d="M135 110
        L115 150
        L155 210"
        stroke="currentColor"
        stroke-width="5"
        fill="none"
        stroke-linejoin="round"/>

      <path d="M265 110
        L285 150
        L245 210"
        stroke="currentColor"
        stroke-width="5"
        fill="none"
        stroke-linejoin="round"/>
    `
  }
};
