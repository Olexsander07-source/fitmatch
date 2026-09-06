import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// FITMATCH — SUPABASE
// =====================================================

const SUPABASE_URL = "https://ypbhcgcwkpiujcakvaji.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return chars[char];
  });
}

// =====================================================
// ИНИЦИАЛЫ
// =====================================================

function initials(name) {
  return String(name || "").trim().split(/\s+/).map(function (w) { return w[0] || ""; }).slice(0, 2).join("").toUpperCase();
}

// =====================================================
// ИНТЕРНАЦИОНАЛИЗАЦИЯ (RU / EN / FR / DE / UK)
// =====================================================

const SPORT_NAME_I18N = {
  running:      { ru: "Бег", en: "Running", fr: "Course à pied", de: "Laufen", uk: "Біг" },
  bodybuilding: { ru: "Бодибилдинг", en: "Bodybuilding", fr: "Musculation", de: "Bodybuilding", uk: "Бодибілдинг" },
  swimming:     { ru: "Плавание", en: "Swimming", fr: "Natation", de: "Schwimmen", uk: "Плавання" },
  cycling:      { ru: "Велоспорт", en: "Cycling", fr: "Cyclisme", de: "Radsport", uk: "Велоспорт" },
  combat:       { ru: "Единоборства", en: "Martial Arts", fr: "Arts martiaux", de: "Kampfsport", uk: "Єдиноборства" },
  yoga:         { ru: "Йога", en: "Yoga", fr: "Yoga", de: "Yoga", uk: "Йога" },
  crossfit:     { ru: "Кроссфит", en: "CrossFit", fr: "CrossFit", de: "Crossfit", uk: "Кросфіт" },
  tennis:       { ru: "Теннис", en: "Tennis", fr: "Tennis", de: "Tennis", uk: "Теніс" },
  fitness:      { ru: "Фитнес", en: "Fitness", fr: "Fitness", de: "Fitness", uk: "Фітнес" }
};

const TRANSLATIONS = {
  ru: {
    nav: { home: "Главная", sports: "Виды спорта", coaches: "Тренеры", ranking: "Рейтинг", match: "Подбор" },
    becomeCoach: "Стать тренером",
    auth: { login: "Войти", logout: "Выйти", register: "Регистрация", forgot: "Забыли пароль?", cancel: "Отмена", email: "Email", password: "Пароль", modalTitle: "Войти в FITMATCH", needLoginFirst: "Сначала войди или зарегистрируйся." },
    landing: { eyebrow: "GLOBAL COACHING PLATFORM", subtitle: "Войдите, зарегистрируйтесь или станьте тренером — весь каталог тренеров открыт для просмотра без регистрации.", browse: "Смотреть тренеров без регистрации →" },
    reset: { title: "Создать новый пароль", desc: "Введите и подтвердите новый пароль.", newPass: "Новый пароль", confirmPass: "Повторите пароль", save: "Сохранить пароль", cancel: "Отмена" },
    coachForm: { title: "Стать тренером", name: "Имя", sport: "Вид спорта", goal: "Цель", goalPh: "Например: похудение, сила, выносливость", format: "Формат", price: "Цена €", period: "Период", periodMonth: "В месяц", periodSession: "За занятие", periodProgram: "За программу", bio: "О себе", bioPh: "Расскажите о своём опыте и специализации", submit: "Создать", cancel: "Отмена" },
    filters: { allSports: "Все виды спорта", anyFormat: "Любой формат", online: "Онлайн", offline: "Офлайн" },
    pages: { sportsTitle: "ВЫБЕРИ<br><em>СВОЙ СПОРТ.</em>", coachesTitle: "НАЙДИ<br><em>ТРЕНЕРА.</em>", rankingTitle: "РЕЙТИНГ<br><em>ТРЕНЕРОВ.</em>", matchTitle: "НАЙДЁМ<br><em>ТВОЙ MATCH.</em>", topCoaches: "ЛУЧШИЕ ТРЕНЕРЫ" },
    match: { sportLabel: "Какой спорт?", goalLabel: "Какая цель?", formatLabel: "Формат?", notSelected: "Не выбрано", notImportant: "Не важно", submit: "НАЙТИ МОЕГО ТРЕНЕРА →", resultsTitle: "Лучшие совпадения", empty: "Пока нет доступных тренеров." },
    category: { cta: "НАЙТИ ТРЕНЕРА →", subtitleTemplate: "Персональные тренировки в категории «{sport}» — найдите своего тренера.", stat1: "Опыт", stat2: "Рейтинг", stat3: "Прогресс" },
    coachesEmpty: "Тренеры пока не найдены.",
    rankingEmpty: "Рейтинг пока пуст.",
    reviews: { title: "Отзывы", empty: "Отзывов пока нет.", leaveTitle: "Оставить отзыв", rating: "Оценка", comment: "Комментарий", submit: "Отправить", loginFirst: "Сначала войди в аккаунт.", duplicate: "Вы уже оставляли отзыв этому тренеру." },
    profileLoading: "Загрузка профиля...",
    profileReviewsError: "Не удалось загрузить отзывы:",
    footer: "© 2026 FITMATCH",
    coachExists: "У тебя уже есть профиль тренера.",
    coachRequiredFields: "Заполни обязательные поля.",
    coachInvalidPrice: "Укажи корректную цену.",
    coachCreated: "Профиль тренера создан.",
    loginNeeded: "Необходимо войти в аккаунт.",
    loginSuccess: "Вход выполнен.",
    signupSuccess: "Регистрация выполнена. Проверь email.",
    enterEmailPassword: "Введи email и пароль.",
    enterEmailFirst: "Сначала введи свой email.",
    resetEmailSent: "Письмо для восстановления пароля отправлено. Проверь email.",
    passwordTooShort: "Пароль должен содержать минимум 6 символов.",
    passwordMismatch: "Пароли не совпадают.",
    passwordChanged: "Пароль успешно изменён.",
    connectionError: "Ошибка подключения к Supabase."
  },
  en: {
    nav: { home: "Home", sports: "Sports", coaches: "Coaches", ranking: "Ranking", match: "Match" },
    becomeCoach: "Become a coach",
    auth: { login: "Log in", logout: "Log out", register: "Sign up", forgot: "Forgot password?", cancel: "Cancel", email: "Email", password: "Password", modalTitle: "Log in to FITMATCH", needLoginFirst: "Please log in or sign up first." },
    landing: { eyebrow: "GLOBAL COACHING PLATFORM", subtitle: "Log in, sign up, or become a coach — the whole catalog of coaches is open to browse without an account.", browse: "Browse coaches without an account →" },
    reset: { title: "Set a new password", desc: "Enter and confirm your new password.", newPass: "New password", confirmPass: "Confirm password", save: "Save password", cancel: "Cancel" },
    coachForm: { title: "Become a coach", name: "Name", sport: "Sport", goal: "Goal", goalPh: "E.g.: weight loss, strength, endurance", format: "Format", price: "Price €", period: "Period", periodMonth: "Per month", periodSession: "Per session", periodProgram: "Per program", bio: "About you", bioPh: "Tell us about your experience and specialty", submit: "Create", cancel: "Cancel" },
    filters: { allSports: "All sports", anyFormat: "Any format", online: "Online", offline: "In person" },
    pages: { sportsTitle: "CHOOSE<br><em>YOUR SPORT.</em>", coachesTitle: "FIND<br><em>A COACH.</em>", rankingTitle: "COACH<br><em>RANKING.</em>", matchTitle: "FIND<br><em>YOUR MATCH.</em>", topCoaches: "TOP COACHES" },
    match: { sportLabel: "Which sport?", goalLabel: "Which goal?", formatLabel: "Format?", notSelected: "Not selected", notImportant: "Doesn't matter", submit: "FIND MY COACH →", resultsTitle: "Best matches", empty: "No coaches available yet." },
    category: { cta: "FIND A COACH →", subtitleTemplate: "Personal training in the “{sport}” category — find your coach.", stat1: "Experience", stat2: "Rating", stat3: "Progress" },
    coachesEmpty: "No coaches found yet.",
    rankingEmpty: "The ranking is empty for now.",
    reviews: { title: "Reviews", empty: "No reviews yet.", leaveTitle: "Leave a review", rating: "Rating", comment: "Comment", submit: "Submit", loginFirst: "Please log in first.", duplicate: "You've already reviewed this coach." },
    profileLoading: "Loading profile...",
    profileReviewsError: "Couldn't load reviews:",
    footer: "© 2026 FITMATCH",
    coachExists: "You already have a coach profile.",
    coachRequiredFields: "Please fill in the required fields.",
    coachInvalidPrice: "Please enter a valid price.",
    coachCreated: "Coach profile created.",
    loginNeeded: "You need to log in.",
    loginSuccess: "Logged in successfully.",
    signupSuccess: "Sign-up complete. Check your email.",
    enterEmailPassword: "Enter your email and password.",
    enterEmailFirst: "Enter your email first.",
    resetEmailSent: "Password reset email sent. Check your inbox.",
    passwordTooShort: "Password must be at least 6 characters.",
    passwordMismatch: "Passwords don't match.",
    passwordChanged: "Password changed successfully.",
    connectionError: "Couldn't connect to Supabase."
  },
  fr: {
    nav: { home: "Accueil", sports: "Sports", coaches: "Coachs", ranking: "Classement", match: "Match" },
    becomeCoach: "Devenir coach",
    auth: { login: "Connexion", logout: "Déconnexion", register: "Inscription", forgot: "Mot de passe oublié ?", cancel: "Annuler", email: "Email", password: "Mot de passe", modalTitle: "Connexion à FITMATCH", needLoginFirst: "Connectez-vous ou inscrivez-vous d'abord." },
    landing: { eyebrow: "GLOBAL COACHING PLATFORM", subtitle: "Connectez-vous, inscrivez-vous ou devenez coach — tout le catalogue de coachs est consultable sans compte.", browse: "Voir les coachs sans compte →" },
    reset: { title: "Nouveau mot de passe", desc: "Saisissez et confirmez votre nouveau mot de passe.", newPass: "Nouveau mot de passe", confirmPass: "Confirmez le mot de passe", save: "Enregistrer", cancel: "Annuler" },
    coachForm: { title: "Devenir coach", name: "Nom", sport: "Sport", goal: "Objectif", goalPh: "Ex. : perte de poids, force, endurance", format: "Format", price: "Prix €", period: "Période", periodMonth: "Par mois", periodSession: "Par séance", periodProgram: "Par programme", bio: "À propos de vous", bioPh: "Décrivez votre expérience et votre spécialité", submit: "Créer", cancel: "Annuler" },
    filters: { allSports: "Tous les sports", anyFormat: "Tous les formats", online: "En ligne", offline: "En personne" },
    pages: { sportsTitle: "CHOISIS<br><em>TON SPORT.</em>", coachesTitle: "TROUVE<br><em>UN COACH.</em>", rankingTitle: "CLASSEMENT<br><em>DES COACHS.</em>", matchTitle: "TROUVE<br><em>TON MATCH.</em>", topCoaches: "MEILLEURS COACHS" },
    match: { sportLabel: "Quel sport ?", goalLabel: "Quel objectif ?", formatLabel: "Format ?", notSelected: "Non choisi", notImportant: "Peu importe", submit: "TROUVER MON COACH →", resultsTitle: "Meilleures correspondances", empty: "Aucun coach disponible pour le moment." },
    category: { cta: "TROUVER UN COACH →", subtitleTemplate: "Entraînement personnalisé en « {sport} » — trouvez votre coach.", stat1: "Expérience", stat2: "Note", stat3: "Progrès" },
    coachesEmpty: "Aucun coach trouvé pour le moment.",
    rankingEmpty: "Le classement est encore vide.",
    reviews: { title: "Avis", empty: "Aucun avis pour le moment.", leaveTitle: "Laisser un avis", rating: "Note", comment: "Commentaire", submit: "Envoyer", loginFirst: "Connectez-vous d'abord.", duplicate: "Vous avez déjà laissé un avis à ce coach." },
    profileLoading: "Chargement du profil...",
    profileReviewsError: "Impossible de charger les avis :",
    footer: "© 2026 FITMATCH",
    coachExists: "Vous avez déjà un profil de coach.",
    coachRequiredFields: "Veuillez remplir les champs obligatoires.",
    coachInvalidPrice: "Veuillez saisir un prix valide.",
    coachCreated: "Profil de coach créé.",
    loginNeeded: "Vous devez vous connecter.",
    loginSuccess: "Connexion réussie.",
    signupSuccess: "Inscription réussie. Vérifiez votre email.",
    enterEmailPassword: "Saisissez votre email et mot de passe.",
    enterEmailFirst: "Saisissez d'abord votre email.",
    resetEmailSent: "Email de réinitialisation envoyé. Vérifiez votre boîte de réception.",
    passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    passwordChanged: "Mot de passe modifié avec succès.",
    connectionError: "Échec de connexion à Supabase."
  },
  de: {
    nav: { home: "Start", sports: "Sportarten", coaches: "Trainer", ranking: "Rangliste", match: "Match" },
    becomeCoach: "Trainer werden",
    auth: { login: "Anmelden", logout: "Abmelden", register: "Registrieren", forgot: "Passwort vergessen?", cancel: "Abbrechen", email: "E-Mail", password: "Passwort", modalTitle: "Bei FITMATCH anmelden", needLoginFirst: "Bitte zuerst anmelden oder registrieren." },
    landing: { eyebrow: "GLOBAL COACHING PLATFORM", subtitle: "Melde dich an, registriere dich oder werde Trainer — der gesamte Trainerkatalog ist ohne Konto einsehbar.", browse: "Trainer ohne Konto ansehen →" },
    reset: { title: "Neues Passwort festlegen", desc: "Neues Passwort eingeben und bestätigen.", newPass: "Neues Passwort", confirmPass: "Passwort bestätigen", save: "Passwort speichern", cancel: "Abbrechen" },
    coachForm: { title: "Trainer werden", name: "Name", sport: "Sportart", goal: "Ziel", goalPh: "Z. B.: Abnehmen, Kraft, Ausdauer", format: "Format", price: "Preis €", period: "Zeitraum", periodMonth: "Pro Monat", periodSession: "Pro Einheit", periodProgram: "Pro Programm", bio: "Über dich", bioPh: "Erzähl von deiner Erfahrung und Spezialisierung", submit: "Erstellen", cancel: "Abbrechen" },
    filters: { allSports: "Alle Sportarten", anyFormat: "Beliebiges Format", online: "Online", offline: "Vor Ort" },
    pages: { sportsTitle: "WÄHLE<br><em>DEINEN SPORT.</em>", coachesTitle: "FINDE<br><em>EINEN TRAINER.</em>", rankingTitle: "TRAINER<br><em>RANGLISTE.</em>", matchTitle: "FINDE<br><em>DEIN MATCH.</em>", topCoaches: "TOP TRAINER" },
    match: { sportLabel: "Welche Sportart?", goalLabel: "Welches Ziel?", formatLabel: "Format?", notSelected: "Nicht gewählt", notImportant: "Egal", submit: "MEINEN TRAINER FINDEN →", resultsTitle: "Beste Treffer", empty: "Noch keine Trainer verfügbar." },
    category: { cta: "TRAINER FINDEN →", subtitleTemplate: "Personaltraining in der Kategorie „{sport}“ — finde deinen Trainer.", stat1: "Erfahrung", stat2: "Bewertung", stat3: "Fortschritt" },
    coachesEmpty: "Noch keine Trainer gefunden.",
    rankingEmpty: "Die Rangliste ist noch leer.",
    reviews: { title: "Bewertungen", empty: "Noch keine Bewertungen.", leaveTitle: "Bewertung abgeben", rating: "Bewertung", comment: "Kommentar", submit: "Absenden", loginFirst: "Bitte zuerst anmelden.", duplicate: "Du hast diesen Trainer bereits bewertet." },
    profileLoading: "Profil wird geladen...",
    profileReviewsError: "Bewertungen konnten nicht geladen werden:",
    footer: "© 2026 FITMATCH",
    coachExists: "Du hast bereits ein Trainerprofil.",
    coachRequiredFields: "Bitte fülle die Pflichtfelder aus.",
    coachInvalidPrice: "Bitte gib einen gültigen Preis ein.",
    coachCreated: "Trainerprofil erstellt.",
    loginNeeded: "Du musst dich anmelden.",
    loginSuccess: "Erfolgreich angemeldet.",
    signupSuccess: "Registrierung abgeschlossen. Prüfe deine E-Mails.",
    enterEmailPassword: "Gib E-Mail und Passwort ein.",
    enterEmailFirst: "Gib zuerst deine E-Mail-Adresse ein.",
    resetEmailSent: "E-Mail zum Zurücksetzen gesendet. Prüfe dein Postfach.",
    passwordTooShort: "Das Passwort muss mindestens 6 Zeichen haben.",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    passwordChanged: "Passwort erfolgreich geändert.",
    connectionError: "Verbindung zu Supabase fehlgeschlagen."
  },
  uk: {
    nav: { home: "Головна", sports: "Види спорту", coaches: "Тренери", ranking: "Рейтинг", match: "Підбір" },
    becomeCoach: "Стати тренером",
    auth: { login: "Увійти", logout: "Вийти", register: "Реєстрація", forgot: "Забули пароль?", cancel: "Скасувати", email: "Email", password: "Пароль", modalTitle: "Увійти в FITMATCH", needLoginFirst: "Спочатку увійдіть або зареєструйтеся." },
    landing: { eyebrow: "GLOBAL COACHING PLATFORM", subtitle: "Увійдіть, зареєструйтеся або станьте тренером — весь каталог тренерів відкритий для перегляду без реєстрації.", browse: "Дивитися тренерів без реєстрації →" },
    reset: { title: "Створити новий пароль", desc: "Введіть і підтвердіть новий пароль.", newPass: "Новий пароль", confirmPass: "Повторіть пароль", save: "Зберегти пароль", cancel: "Скасувати" },
    coachForm: { title: "Стати тренером", name: "Ім'я", sport: "Вид спорту", goal: "Мета", goalPh: "Наприклад: схуднення, сила, витривалість", format: "Формат", price: "Ціна €", period: "Період", periodMonth: "На місяць", periodSession: "За заняття", periodProgram: "За програму", bio: "Про себе", bioPh: "Розкажіть про свій досвід і спеціалізацію", submit: "Створити", cancel: "Скасувати" },
    filters: { allSports: "Усі види спорту", anyFormat: "Будь-який формат", online: "Онлайн", offline: "Офлайн" },
    pages: { sportsTitle: "ОБЕРИ<br><em>СВІЙ СПОРТ.</em>", coachesTitle: "ЗНАЙДИ<br><em>ТРЕНЕРА.</em>", rankingTitle: "РЕЙТИНГ<br><em>ТРЕНЕРІВ.</em>", matchTitle: "ЗНАЙДЕМО<br><em>ТВІЙ MATCH.</em>", topCoaches: "КРАЩІ ТРЕНЕРИ" },
    match: { sportLabel: "Який спорт?", goalLabel: "Яка мета?", formatLabel: "Формат?", notSelected: "Не обрано", notImportant: "Не важливо", submit: "ЗНАЙТИ МОГО ТРЕНЕРА →", resultsTitle: "Найкращі збіги", empty: "Поки що немає доступних тренерів." },
    category: { cta: "ЗНАЙТИ ТРЕНЕРА →", subtitleTemplate: "Персональні тренування в категорії «{sport}» — знайдіть свого тренера.", stat1: "Досвід", stat2: "Рейтинг", stat3: "Прогрес" },
    coachesEmpty: "Тренерів поки не знайдено.",
    rankingEmpty: "Рейтинг поки порожній.",
    reviews: { title: "Відгуки", empty: "Відгуків поки немає.", leaveTitle: "Залишити відгук", rating: "Оцінка", comment: "Коментар", submit: "Надіслати", loginFirst: "Спочатку увійдіть в акаунт.", duplicate: "Ви вже залишали відгук цьому тренеру." },
    profileLoading: "Завантаження профілю...",
    profileReviewsError: "Не вдалося завантажити відгуки:",
    footer: "© 2026 FITMATCH",
    coachExists: "У вас вже є профіль тренера.",
    coachRequiredFields: "Заповніть обов'язкові поля.",
    coachInvalidPrice: "Вкажіть коректну ціну.",
    coachCreated: "Профіль тренера створено.",
    loginNeeded: "Потрібно увійти в акаунт.",
    loginSuccess: "Вхід виконано.",
    signupSuccess: "Реєстрація виконана. Перевірте email.",
    enterEmailPassword: "Введіть email і пароль.",
    enterEmailFirst: "Спочатку введіть свій email.",
    resetEmailSent: "Лист для відновлення пароля надіслано. Перевірте email.",
    passwordTooShort: "Пароль має містити щонайменше 6 символів.",
    passwordMismatch: "Паролі не збігаються.",
    passwordChanged: "Пароль успішно змінено.",
    connectionError: "Помилка підключення до Supabase."
  }
};

const SUPPORTED_LANGS = ["ru", "en", "fr", "de", "uk"];

function detectInitialLang() {
  try {
    const saved = localStorage.getItem("fm_lang");
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (e) { /* localStorage may be unavailable */ }
  return "ru";
}

let currentLang = detectInitialLang();

function t(path) {
  const parts = path.split(".");

  let node = TRANSLATIONS[currentLang];
  for (const part of parts) node = node ? node[part] : undefined;
  if (node !== undefined) return node;

  node = TRANSLATIONS.ru;
  for (const part of parts) node = node ? node[part] : undefined;
  return node !== undefined ? node : path;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  document.querySelectorAll(".lang-select").forEach(function (select) {
    select.value = currentLang;
  });

  refreshAuthButtonsLabel();
  updateCategoryBanner();
}

function initLanguageSwitcher() {
  document.querySelectorAll(".lang-select").forEach(function (select) {
    select.value = currentLang;
    select.addEventListener("change", function () {
      currentLang = select.value;
      try { localStorage.setItem("fm_lang", currentLang); } catch (e) { /* ignore */ }
      applyTranslations();
    });
  });
}

// =====================================================
// ИЗОБРАЖЕНИЯ
// =====================================================

const SPORT_IMAGES = {
  bodybuilding: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85",
  fitness: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85",
  crossfit: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=85",
  running: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85",
  yoga: "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=85",
  swimming: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=85",
  cycling: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=85",
  tennis: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85",
  combat: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85"
};

const COACH_IMAGES = [
  "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=85"
];

function getSportKey(value) {
  const text = String(value || "").toLowerCase().trim();

  if (text.includes("бодибилдинг") || text.includes("bodybuilding")) return "bodybuilding";
  if (text.includes("фитнес") || text.includes("fitness")) return "fitness";
  if (text.includes("кроссфит") || text.includes("crossfit")) return "crossfit";
  if (text.includes("бег") || text.includes("running")) return "running";
  if (text.includes("йога") || text.includes("yoga")) return "yoga";
  if (text.includes("плав") || text.includes("swimming")) return "swimming";
  if (text.includes("вел") || text.includes("cycling")) return "cycling";
  if (text.includes("теннис") || text.includes("tennis")) return "tennis";
  if (text.includes("единобор") || text.includes("бокс") || text.includes("boxing") || text.includes("mma")) return "combat";

  return "fitness";
}

function getSportImage(sportName) {
  const key = getSportKey(sportName);
  return SPORT_IMAGES[key] || SPORT_IMAGES.fitness;
}

function getCoachImage(coach) {
  if (coach.image_url) return coach.image_url;

  const id = String(coach.id || "");
  let number = 0;
  for (let i = 0; i < id.length; i++) number += id.charCodeAt(i);

  return COACH_IMAGES[number % COACH_IMAGES.length];
}

// =====================================================
// НАЗВАНИЕ / КЛЮЧ СПОРТА
// =====================================================

function sportName(id) {
  const sport = sports.find(function (item) { return String(item.id) === String(id); });
  return sport ? sport.name : id || "—";
}

function sportKeyById(id) {
  const sport = sports.find(function (item) { return String(item.id) === String(id); });
  return getSportKey(sport ? sport.name : id);
}

// =====================================================
// ВИЗУАЛЫ КАТЕГОРИЙ (иконка + переведённое название)
// =====================================================

const CATEGORY_ICONS = {
  running: `
    <circle cx="150" cy="55" r="18" stroke="currentColor" stroke-width="6"/>
    <path d="M150 74 L165 140 L110 200 M165 140 L235 175 M165 140 L135 95 L225 85" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  bodybuilding: `
    <circle cx="90" cy="170" r="45" stroke="currentColor" stroke-width="6"/>
    <circle cx="310" cy="170" r="45" stroke="currentColor" stroke-width="6"/>
    <line x1="132" y1="170" x2="268" y2="170" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
  `,
  swimming: `
    <circle cx="130" cy="90" r="18" stroke="currentColor" stroke-width="6"/>
    <path d="M130 108 L175 160" stroke="currentColor" stroke-width="6"/>
    <path d="M40 210 Q80 190 120 210 T200 210 T280 210 T360 210" stroke="currentColor" stroke-width="6" fill="none"/>
  `,
  cycling: `
    <circle cx="110" cy="210" r="70" stroke="currentColor" stroke-width="6"/>
    <circle cx="290" cy="210" r="70" stroke="currentColor" stroke-width="6"/>
    <path d="M110 210L170 110H220M170 110L140 210M220 110L290 210" stroke="currentColor" stroke-width="6"/>
  `,
  combat: `
    <circle cx="200" cy="150" r="75" stroke="currentColor" stroke-width="6"/>
    <rect x="165" y="215" width="70" height="60" rx="14" stroke="currentColor" stroke-width="6"/>
  `,
  yoga: `
    <circle cx="200" cy="70" r="22" stroke="currentColor" stroke-width="6"/>
    <path d="M200 92 L150 190 H250 Z" stroke="currentColor" stroke-width="6"/>
  `,
  crossfit: `
    <circle cx="200" cy="190" r="65" stroke="currentColor" stroke-width="6"/>
    <path d="M165 140 Q165 95 200 95 Q235 95 235 140" stroke="currentColor" stroke-width="6" fill="none"/>
  `,
  tennis: `
    <ellipse cx="170" cy="120" rx="75" ry="95" stroke="currentColor" stroke-width="6"/>
    <circle cx="310" cy="230" r="20" stroke="currentColor" stroke-width="6"/>
  `,
  fitness: `
    <path d="M30 190 H130 L150 120 L185 260 L215 150 L245 190 H370" stroke="currentColor" stroke-width="6" fill="none"/>
  `
};

function getCategoryVisual(sportId) {
  const key = sportKeyById(sportId);
  if (!CATEGORY_ICONS[key]) return null;

  const sportLabel = (SPORT_NAME_I18N[key] && SPORT_NAME_I18N[key][currentLang]) || key;

  return {
    key,
    icon: CATEGORY_ICONS[key],
    title: sportLabel,
    subtitle: t("category.subtitleTemplate").replace("{sport}", sportLabel),
    stats: [t("category.stat1"), t("category.stat2"), t("category.stat3")]
  };
}

// =====================================================
// ЦЕНА
// =====================================================

function priceText(coach) {
  const price = Number(coach.price || 0);
  const period = coach.period || "месяц";
  return `€${price} / ${period}`;
}

// =====================================================
// ПОКАЗ СТРАНИЦЫ
// =====================================================

function closeMobileNav() {
  const nav = document.getElementById("mainNav");
  const hamburger = document.getElementById("hamburger");
  if (nav) nav.classList.remove("mobile-open");
  if (hamburger) hamburger.textContent = "☰";
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(function (page) { page.classList.remove("active"); });

  const page = document.getElementById(id);
  if (page) page.classList.add("active");

  closeMobileNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =====================================================
// МОДАЛЬНОЕ ОКНО
// =====================================================

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.toggle("show", show);
}

// =====================================================
// СООБЩЕНИЯ
// =====================================================

function showMessage(id, text, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = text;
  element.className = isError ? "error" : "success";
}

// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================

async function loadData() {
  const sportsResult = await supabase.from("sports").select("*").order("name");
  if (sportsResult.error) { console.error("Sports load error:", sportsResult.error); throw sportsResult.error; }
  sports = sportsResult.data || [];
  renderSports();

  const coachesResult = await supabase.from("coaches").select("*").order("score", { ascending: false });
  if (coachesResult.error) { console.error("Coaches load error:", coachesResult.error); coaches = []; }
  else { coaches = coachesResult.data || []; }

  renderCoaches();
  renderTopCoaches();
  renderRanking();
  populateGoals();
}

// =====================================================
// КАРТОЧКА СПОРТА
// =====================================================

function createSportCard(sport) {
  const card = document.createElement("div");
  card.className = "sport-card";
  card.style.backgroundImage = `url("${getSportImage(sport.name)}")`;

  card.innerHTML = `
    <div style="font-size:30px">${esc(sport.icon || "🏅")}</div>
    <b>${esc(sport.name)}</b>
    <p>${esc(t("category.cta"))}</p>
  `;

  card.addEventListener("click", function () {
    showPage("coaches");
    const filter = document.getElementById("sportFilter");
    if (filter) filter.value = String(sport.id);
    renderCoaches();
  });

  return card;
}

// =====================================================
// КАРТОЧКА ТРЕНЕРА
// =====================================================

function createCoachCard(coach) {
  const card = document.createElement("article");
  card.className = "coach-card";

  card.innerHTML = `
    <img class="coach-image" src="${esc(getCoachImage(coach))}" alt="${esc(coach.name)}" loading="lazy">
    <div class="coach-score">${Number(coach.score || 0)}</div>
    <h3>${esc(coach.name)}</h3>
    <div>${esc(sportName(coach.sport))} · ${esc(coach.format || "")}</div>
    <div class="tags">
      ${coach.goal ? `<span class="tag">${esc(coach.goal)}</span>` : ""}
      ${coach.verified ? `<span class="tag">✓</span>` : ""}
    </div>
    <div class="card-footer">
      <span>⭐ ${Number(coach.rating || 0).toFixed(1)}</span>
      <span>${priceText(coach)}</span>
    </div>
  `;

  card.addEventListener("click", function () { openProfile(coach.id); });
  return card;
}

// =====================================================
// СПОРТЫ
// =====================================================

function renderSports() {
  ["homeSports", "sportsList"].forEach(function (id) {
    const container = document.getElementById(id);
    if (!container) return;
    container.replaceChildren(...sports.map(createSportCard));
  });

  ["sportFilter", "matchSport", "coachSport"].forEach(function (id) {
    const select = document.getElementById(id);
    if (!select) return;

    const previousValue = select.value;

    if (id === "sportFilter") select.innerHTML = `<option value="">${esc(t("filters.allSports"))}</option>`;
    if (id === "matchSport") select.innerHTML = `<option value="">${esc(t("match.notSelected"))}</option>`;
    if (id === "coachSport") select.innerHTML = `<option value="">${esc(t("filters.allSports"))}</option>`;

    sports.forEach(function (sport) { select.add(new Option(sport.name, sport.id)); });

    if ([...select.options].some(function (o) { return o.value === previousValue; })) {
      select.value = previousValue;
    }
  });
}

// =====================================================
// БАННЕР КАТЕГОРИИ
// =====================================================

function updateCategoryBanner() {
  const sportFilter = document.getElementById("sportFilter");
  const banner = document.getElementById("categoryBanner");
  if (!sportFilter || !banner) return;

  if (!sportFilter.value) { banner.style.display = "none"; return; }

  const visual = getCategoryVisual(sportFilter.value);
  if (!visual) { banner.style.display = "none"; return; }

  const sport = sports.find(function (item) { return String(item.id) === String(sportFilter.value); });
  banner.style.backgroundImage = `url("${getSportImage(sport ? sport.name : "")}")`;

  document.getElementById("categoryBannerGraphic").innerHTML = visual.icon;
  document.getElementById("categoryBannerTitle").innerHTML = `<em>${esc(visual.title)}</em>`;
  document.getElementById("categoryBannerSubtitle").textContent = visual.subtitle;

  document.getElementById("categoryBannerStats").innerHTML = visual.stats.map(function (label) {
    return `
      <div class="category-banner-stat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <span>${esc(label.toUpperCase())}</span>
      </div>
    `;
  }).join("");

  banner.style.display = "block";
}

// =====================================================
// СЛАЙД-ШОУ НА ГЛАВНОЙ
// =====================================================

function initHeroSlideshow() {
  const container = document.getElementById("heroSlideshow");
  if (!container) return;

  const keys = Object.keys(SPORT_IMAGES);
  const slot = 72 / keys.length;

  container.innerHTML = keys.map(function (key, index) {
    return `<div class="hero-slide" style="animation-delay:${(index * slot).toFixed(2)}s;background-image:url('${SPORT_IMAGES[key]}')"></div>`;
  }).join("");
}

// =====================================================
// ТРЕНЕРЫ
// =====================================================

function renderCoaches() {
  const sportFilter = document.getElementById("sportFilter");
  const formatFilter = document.getElementById("formatFilter");
  const container = document.getElementById("coachesList");
  if (!sportFilter || !formatFilter || !container) return;

  updateCategoryBanner();

  const selectedSport = sportFilter.value;
  const selectedFormat = formatFilter.value;

  const filtered = coaches.filter(function (coach) {
    const sportMatches = !selectedSport || String(coach.sport) === String(selectedSport);
    const formatMatches = !selectedFormat || coach.format === selectedFormat;
    return sportMatches && formatMatches;
  });

  container.replaceChildren();

  if (!filtered.length) {
    const message = document.createElement("p");
    message.className = "lead";
    message.textContent = t("coachesEmpty");
    container.appendChild(message);
    return;
  }

  filtered.forEach(function (coach) { container.appendChild(createCoachCard(coach)); });
}

// =====================================================
// ЛУЧШИЕ ТРЕНЕРЫ
// =====================================================

function renderTopCoaches() {
  const container = document.getElementById("topCoaches");
  if (!container) return;

  const top = [...coaches].sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0); }).slice(0, 3);
  container.replaceChildren(...top.map(createCoachCard));
}

// =====================================================
// РЕЙТИНГ
// =====================================================

function renderRanking() {
  const container = document.getElementById("rankingList");
  if (!container) return;

  const ranking = [...coaches].sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0); });
  container.replaceChildren();

  if (!ranking.length) {
    const empty = document.createElement("p");
    empty.className = "lead";
    empty.textContent = t("rankingEmpty");
    container.appendChild(empty);
    return;
  }

  ranking.forEach(function (coach, index) {
    const row = document.createElement("div");
    row.className = "ranking-row";
    row.innerHTML = `
      <div>#${index + 1}</div>
      <div><b>${esc(coach.name)}</b></div>
      <div class="sport">${esc(sportName(coach.sport))} · ⭐ ${Number(coach.rating || 0).toFixed(1)}</div>
      <div><b>${Number(coach.score || 0)}</b></div>
    `;
    row.addEventListener("click", function () { openProfile(coach.id); });
    container.appendChild(row);
  });
}

// =====================================================
// ЦЕЛИ
// =====================================================

function populateGoals() {
  const select = document.getElementById("matchGoal");
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = `<option value="">${esc(t("match.notSelected"))}</option>`;

  const goals = [...new Set(coaches.map(function (c) { return c.goal; }).filter(Boolean))];
  goals.forEach(function (goal) { select.add(new Option(goal, goal)); });

  select.value = previousValue;
}

// =====================================================
// ПРОФИЛЬ ТРЕНЕРА
// =====================================================

async function openProfile(coachId) {
  const coach = coaches.find(function (item) { return String(item.id) === String(coachId); });
  if (!coach) return;

  const profileContent = document.getElementById("profileContent");
  if (!profileContent) return;

  showPage("profile");
  profileContent.innerHTML = `<div class="match-box"><p class="lead">${esc(t("profileLoading"))}</p></div>`;

  const result = await supabase
    .from("reviews")
    .select(`rating, text, created_at, user_id`)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });

  if (result.error) {
    profileContent.innerHTML = `<div class="match-box"><p class="error">${esc(t("profileReviewsError"))} ${esc(result.error.message)}</p></div>`;
    return;
  }

  const reviews = result.data || [];
  const canReview = Boolean(currentUser) && String(currentUser.id) !== String(coach.user_id);

  const reviewHTML = reviews.length
    ? reviews.map(function (review) {
        return `
          <div class="review">
            <b>⭐ ${Number(review.rating || 0)}/5</b>
            <p>${esc(review.text || "")}</p>
          </div>
        `;
      }).join("")
    : `<p class="lead">${esc(t("reviews.empty"))}</p>`;

  profileContent.innerHTML = `
    <div class="coach-card">
      <img class="profile-image" src="${esc(getCoachImage(coach))}" alt="${esc(coach.name)}">
      <h1 class="page-title">${esc(coach.name)}</h1>
      <p class="lead">${esc(sportName(coach.sport))} · ${esc(coach.goal || "")} · ${esc(coach.format || "")}</p>
      <p class="lead">${esc(coach.bio || "")}</p>
      <div class="tags">
        <span class="tag">⭐ ${Number(coach.rating || 0).toFixed(2)}</span>
        <span class="tag">${Number(coach.reviews_count || 0)}</span>
        <span class="tag">${Number(coach.clients_count || 0)}</span>
      </div>
      <h2>${priceText(coach)}</h2>
    </div>

    <div class="match-box">
      <h2>${esc(t("reviews.title"))}</h2>
      ${reviewHTML}
    </div>

    ${canReview ? `
      <div class="match-box">
        <h2>${esc(t("reviews.leaveTitle"))}</h2>
        <form id="reviewForm" class="form">
          <label>
            ${esc(t("reviews.rating"))}
            <select name="rating">
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>
          <label>
            ${esc(t("reviews.comment"))}
            <textarea name="text" maxlength="2000"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">${esc(t("reviews.submit"))}</button>
          <div id="reviewMessage" aria-live="polite"></div>
        </form>
      </div>
    ` : ""}
  `;

  const reviewForm = document.getElementById("reviewForm");
  if (!reviewForm) return;

  reviewForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) { showMessage("reviewMessage", t("reviews.loginFirst"), true); return; }

    const formData = new FormData(event.currentTarget);
    const rating = Number(formData.get("rating"));
    const text = String(formData.get("text") || "").trim() || null;

    const response = await supabase.from("reviews").insert({ coach_id: coachId, user_id: currentUser.id, rating, text });

    if (response.error) {
      if (response.error.code === "23505") showMessage("reviewMessage", t("reviews.duplicate"), true);
      else showMessage("reviewMessage", response.error.message, true);
      return;
    }

    await loadData();
    await openProfile(coachId);
  });
}

// =====================================================
// MATCH
// =====================================================

function findMatch() {
  const sportElement = document.getElementById("matchSport");
  const goalElement = document.getElementById("matchGoal");
  const formatElement = document.getElementById("matchFormat");
  const container = document.getElementById("matchResults");
  if (!sportElement || !goalElement || !formatElement || !container) return;

  const sport = sportElement.value;
  const goal = goalElement.value;
  const format = formatElement.value;

  const matches = coaches.map(function (coach) {
    let match = 10;
    if (sport && String(coach.sport) === String(sport)) match += 40;
    if (goal && coach.goal === goal) match += 30;
    if (format && coach.format === format) match += 15;
    match += Math.round(Number(coach.rating || 0) * 5);
    return { ...coach, match: Math.min(99, match) };
  }).sort(function (a, b) { return b.match - a.match; });

  container.innerHTML = `<h2>${esc(t("match.resultsTitle"))}</h2>`;

  if (!matches.length) {
    container.innerHTML += `<p class="lead">${esc(t("match.empty"))}</p>`;
    return;
  }

  matches.slice(0, 5).forEach(function (coach) {
    const card = document.createElement("div");
    card.className = "match-result";
    card.innerHTML = `
      <div>
        <b>${esc(coach.name)}</b>
        <div>${esc(sportName(coach.sport))}</div>
      </div>
      <div class="match-percent">${coach.match}% MATCH</div>
    `;
    card.addEventListener("click", function () { openProfile(coach.id); });
    container.appendChild(card);
  });
}

// =====================================================
// АВТОРИЗАЦИЯ
// =====================================================

function refreshAuthButtonsLabel() {
  const button = document.getElementById("authBtn");
  if (!button) return;

  if (currentUser) {
    const email = currentUser.email || "";
    const name = email.split("@")[0] || "";
    button.textContent = `${t("auth.logout")}${name ? " (" + name + ")" : ""}`;
  } else {
    button.textContent = t("auth.login");
  }
}

async function refreshUser() {
  const response = await supabase.auth.getUser();

  if (response.error) { console.warn("Auth:", response.error.message); currentUser = null; }
  else { currentUser = response.data.user || null; }

  const button = document.getElementById("authBtn");
  if (!button) return;

  refreshAuthButtonsLabel();

  button.onclick = async function () {
    if (currentUser) {
      const signOutResponse = await supabase.auth.signOut();
      if (signOutResponse.error) return;
      currentUser = null;
      refreshAuthButtonsLabel();
      return;
    }
    toggleModal("modal", true);
  };
}

// =====================================================
// ВХОД
// =====================================================

function initAuthForm() {
  const form = document.getElementById("authForm");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    const response = await supabase.auth.signInWithPassword({ email, password });

    if (response.error) { showMessage("authMessage", response.error.message, true); return; }

    currentUser = response.data.user || null;
    await refreshUser();

    showMessage("authMessage", t("loginSuccess"));
    setTimeout(function () { toggleModal("modal", false); }, 500);
  });
}

// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

function initSignup() {
  const button = document.getElementById("signupBtn");
  if (!button) return;

  button.addEventListener("click", async function () {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    if (!email || !password) { showMessage("authMessage", t("enterEmailPassword"), true); return; }

    const response = await supabase.auth.signUp({ email, password });
    showMessage("authMessage", response.error ? response.error.message : t("signupSuccess"), Boolean(response.error));
  });
}

// =====================================================
// ЗАБЫЛ ПАРОЛЬ
// =====================================================

function initForgotPassword() {
  const button = document.getElementById("forgotPasswordBtn");
  if (!button) return;

  button.addEventListener("click", async function () {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) { showMessage("authMessage", t("enterEmailFirst"), true); return; }

    const response = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (response.error) { showMessage("authMessage", response.error.message, true); return; }
    showMessage("authMessage", t("resetEmailSent"));
  });
}

// =====================================================
// НОВЫЙ ПАРОЛЬ
// =====================================================

function initResetPassword() {
  const form = document.getElementById("resetPasswordForm");
  const cancel = document.getElementById("resetCancel");

  if (cancel) cancel.addEventListener("click", function () { toggleModal("resetPasswordModal", false); });
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (password.length < 6) { showMessage("resetMessage", t("passwordTooShort"), true); return; }
    if (password !== confirm) { showMessage("resetMessage", t("passwordMismatch"), true); return; }

    const response = await supabase.auth.updateUser({ password });
    if (response.error) { showMessage("resetMessage", response.error.message, true); return; }

    showMessage("resetMessage", t("passwordChanged"));

    setTimeout(async function () {
      toggleModal("resetPasswordModal", false);
      window.location.hash = "";
      await refreshUser();
    }, 800);
  });
}

// =====================================================
// RECOVERY MODE
// =====================================================

function checkRecoveryMode() {
  if (window.location.hash.includes("type=recovery")) toggleModal("resetPasswordModal", true);
}

// =====================================================
// СОЗДАТЬ ТРЕНЕРА
// =====================================================

function initCreateCoach() {
  const buttons = [document.getElementById("createBtn"), document.getElementById("landingCreateBtn")].filter(Boolean);

  buttons.forEach(function (button) {
    button.addEventListener("click", async function () {
      await refreshUser();

      if (!currentUser) {
        toggleModal("modal", true);
        showMessage("authMessage", t("auth.needLoginFirst"), true);
        return;
      }

      toggleModal("coachModal", true);
    });
  });
}

// =====================================================
// ФОРМА ТРЕНЕРА
// =====================================================

function initCoachForm() {
  const form = document.getElementById("createForm");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) { showMessage("coachMessage", t("loginNeeded"), true); return; }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const sport = formData.get("sport");
    const goal = String(formData.get("goal") || "").trim() || null;
    const format = formData.get("format");
    const price = Number(formData.get("price"));
    const period = formData.get("period");
    const bio = String(formData.get("bio") || "").trim() || null;

    if (!name || !sport || !period) { showMessage("coachMessage", t("coachRequiredFields"), true); return; }
    if (!Number.isFinite(price) || price < 0) { showMessage("coachMessage", t("coachInvalidPrice"), true); return; }

    const response = await supabase.from("coaches").insert({ user_id: currentUser.id, name, sport, goal, format, price, period, bio });

    if (response.error) {
      if (response.error.code === "23505") showMessage("coachMessage", t("coachExists"), true);
      else showMessage("coachMessage", response.error.message, true);
      return;
    }

    showMessage("coachMessage", t("coachCreated"));
    await loadData();

    setTimeout(function () { toggleModal("coachModal", false); form.reset(); }, 600);
  });
}

// =====================================================
// ЛЕНДИНГ (Войти / Регистрация / Забыли пароль / Стать тренером)
// =====================================================

function initLandingPanel() {
  ["landingLoginBtn", "landingRegisterBtn", "landingForgotBtn"].forEach(function (id) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", function () { toggleModal("modal", true); });
  });
}

// =====================================================
// НАВИГАЦИЯ
// =====================================================

function initNavigation() {
  document.querySelectorAll("[data-nav]").forEach(function (button) {
    button.addEventListener("click", function () { showPage(button.dataset.nav); });
  });
}

// =====================================================
// ФИЛЬТРЫ
// =====================================================

function initFilters() {
  const sportFilter = document.getElementById("sportFilter");
  if (sportFilter) sportFilter.addEventListener("change", renderCoaches);

  const formatFilter = document.getElementById("formatFilter");
  if (formatFilter) formatFilter.addEventListener("change", renderCoaches);

  const findMatchBtn = document.getElementById("findMatchBtn");
  if (findMatchBtn) findMatchBtn.addEventListener("click", findMatch);

  const categoryBannerCta = document.getElementById("categoryBannerCta");
  if (categoryBannerCta) {
    categoryBannerCta.addEventListener("click", function () {
      document.getElementById("coachesList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

// =====================================================
// МОДАЛЬНЫЕ ОКНА
// =====================================================

function initModals() {
  const modalCancel = document.getElementById("modalCancel");
  if (modalCancel) modalCancel.addEventListener("click", function () { toggleModal("modal", false); });

  const coachCancel = document.getElementById("coachCancel");
  if (coachCancel) coachCancel.addEventListener("click", function () { toggleModal("coachModal", false); });

  document.querySelectorAll(".modal").forEach(function (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) toggleModal(modal.id, false);
    });
  });
}

// =====================================================
// МОБИЛЬНОЕ МЕНЮ (открытие/закрытие + крестик + клик снаружи)
// =====================================================

function initMobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("mainNav");
  const navClose = document.getElementById("navClose");
  if (!hamburger || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("mobile-open", open);
    hamburger.textContent = open ? "✕" : "☰";
  }

  hamburger.addEventListener("click", function () {
    setOpen(!nav.classList.contains("mobile-open"));
  });

  if (navClose) navClose.addEventListener("click", function () { setOpen(false); });

  document.addEventListener("click", function (event) {
    if (!nav.classList.contains("mobile-open")) return;
    if (nav.contains(event.target) || event.target === hamburger) return;
    setOpen(false);
  });
}

// =====================================================
// AUTH STATE
// =====================================================

function initAuthState() {
  supabase.auth.onAuthStateChange(function (event, session) {
    currentUser = session ? session.user : null;
    refreshUser();
    if (event === "PASSWORD_RECOVERY") toggleModal("resetPasswordModal", true);
  });
}

// =====================================================
// ЗАПУСК
// =====================================================

async function init() {
  initLanguageSwitcher();
  applyTranslations();

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
  initLandingPanel();
  initAuthState();
  checkRecoveryMode();
  initHeroSlideshow();

  try {
    await refreshUser();
    await loadData();
    applyTranslations();
  } catch (error) {
    console.error("FITMATCH ERROR:", error);
    const container = document.getElementById("coachesList");
    if (container) container.innerHTML = `<p class="error">${esc(t("connectionError"))} ${esc(error.message || error)}</p>`;
  }
}

init();
