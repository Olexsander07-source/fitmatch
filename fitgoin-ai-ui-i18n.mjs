import {translateStaticLiteral} from './fitgoin-i18n.mjs';
// Only fixed FitGoIn AI UI labels are translated here. Never send user records to translators.
export const aiUiCatalog = new Map([
 [
  "Твой спортивный помощник",
  "Your sports assistant",
  "Ton assistant sportif"
 ],
 [
  "AI-тренировки и питание по подписке. Профиль, дневник и подбор тренера доступны без оплаты. Войди, чтобы сохранить свою историю.",
  "AI training and nutrition require a subscription. Your profile, log and trainer search are free. Sign in to save your history.",
  "Les entraînements et la nutrition avec l’IA nécessitent un abonnement. Le profil, le journal et la recherche de coach sont gratuits. Connecte-toi pour enregistrer ton historique."
 ],
 [
  "Войти и начать",
  "Sign in to get started",
  "Se connecter pour commencer"
 ],
 [
  "Загружаем твоего помощника…",
  "Loading your assistant…",
  "Chargement de ton assistant…"
 ],
 [
  "Повторить загрузку",
  "Retry loading",
  "Réessayer"
 ],
 [
  "Новые разговоры появятся здесь.",
  "New conversations will appear here.",
  "Tes nouvelles conversations apparaîtront ici."
 ],
 [
  "По приглашению",
  "By invitation",
  "Sur invitation"
 ],
 [
  "Подписка активна",
  "Subscription active",
  "Abonnement actif"
 ],
 [
  "AI по подписке",
  "AI subscription required",
  "IA sur abonnement"
 ],
 [
  "Твой профиль, планы и история — в одном месте.",
  "Your profile, plans and history in one place.",
  "Ton profil, tes programmes et ton historique au même endroit."
 ],
 [
  "AI-ответы пока не подключены; профиль и дневник доступны.",
  "AI responses are not connected yet; your profile and log are available.",
  "Les réponses IA ne sont pas encore disponibles ; ton profil et ton journal le restent."
 ],
 [
  "Обновить историю",
  "Refresh history",
  "Actualiser l’historique"
 ],
 [
  "Проверь распознанный текст",
  "Check recognized speech",
  "Vérifie le texte reconnu"
 ],
 [
  "Выполнить команду / задать вопрос",
  "Confirm command / ask question",
  "Confirmer la commande / poser la question"
 ],
 [
  "Перенести в вопрос",
  "Use as question",
  "Utiliser comme question"
 ],
 [
  "Голосовые команды выполняются только после подтверждения.",
  "Voice commands run only after confirmation.",
  "Les commandes vocales ne sont exécutées qu’après confirmation."
 ],
 [
  "Познакомимся в разговоре",
  "Let’s start by talking",
  "Commençons par discuter"
 ],
 [
  "Расскажи о цели и привычных тренировках. AI сохранит только нужные спортивные данные; их можно изменить следующим сообщением.",
  "Tell us about your goals and workouts. AI will save only the necessary sports information; you can update it in your next message.",
  "Parle-nous de tes objectifs et de tes entraînements. L’IA ne conserve que les données sportives nécessaires, modifiables par message."
 ],
 [
  "Разрешаю сохранять спортивный профиль и историю в FitGoIn и передавать необходимый контекст OpenAI. Ограничения и травмы сообщаю добровольно.",
  "I agree to save my sports profile and history in FitGoIn and share the necessary context with OpenAI. I disclose injuries and restrictions voluntarily.",
  "J’autorise l’enregistrement de mon profil sportif et de mon historique dans FitGoIn ainsi que le partage du contexte nécessaire avec OpenAI. Je communique librement mes blessures et restrictions."
 ],
 [
  "Как используются данные",
  "How data is used",
  "Comment les données sont utilisées"
 ],
 [
  "Начать диалог",
  "Start conversation",
  "Commencer la conversation"
 ],
 [
  "Модуль",
  "Module",
  "Module"
 ],
 [
  "Тренировки",
  "Training",
  "Entraînement"
 ],
 [
  "Питание",
  "Nutrition",
  "Nutrition"
 ],
 [
  "Быстрые действия",
  "Quick actions",
  "Actions rapides"
 ],
 [
  "Что AI помнит о тебе",
  "What AI remembers about you",
  "Ce que l’IA retient de toi"
 ],
 [
  "Только сообщённые спортивные данные. Измени их обычным сообщением; сохранение подтвердим после записи.",
  "Only the sports details you shared. Update them by message; we will confirm after saving.",
  "Uniquement les données sportives que tu as fournies. Modifie-les par message ; nous confirmerons l’enregistrement."
 ],
 [
  "Спортивные данные пока не сохранены. Начнём с цели и уровня подготовки.",
  "No sports data saved yet. Let’s start with your goal and fitness level.",
  "Aucune donnée sportive enregistrée. Commençons par ton objectif et ton niveau."
 ],
 [
  "Чего хочешь добиться и какой у тебя опыт тренировок? Остальное уточним по ходу разговора.",
  "What would you like to achieve, and what is your training experience? We can discuss the rest as we go.",
  "Quel est ton objectif et ton expérience sportive ? Nous préciserons le reste en discutant."
 ],
 [
  "История разговора",
  "Conversation history",
  "Historique de la conversation"
 ],
 [
  "Показать предыдущие сообщения",
  "Show previous messages",
  "Afficher les messages précédents"
 ],
 [
  "Ты",
  "You",
  "Toi"
 ],
 [
  "Голос",
  "Voice",
  "Vocal"
 ],
 [
  "Прослушать",
  "Listen",
  "Écouter"
 ],
 [
  "Полезно",
  "Helpful",
  "Utile"
 ],
 [
  "Есть проблема",
  "Report a problem",
  "Signaler un problème"
 ],
 [
  "Новый запрос расходует лимит AI",
  "A new request uses your AI allowance",
  "Une nouvelle demande utilise ton quota IA"
 ],
 [
  "Мой кабинет",
  "My account",
  "Mon espace"
 ],
 [
  "Сообщения",
  "Messages",
  "Messages"
 ],
 [
  "Тренеры",
  "Trainers",
  "Coachs"
 ],
 [
  "Отправляется",
  "Sending",
  "Envoi en cours"
 ],
 [
  "Не отправлено",
  "Not sent",
  "Non envoyé"
 ],
 [
  "Проверяем доставку",
  "Checking delivery",
  "Vérification de l’envoi"
 ],
 [
  "Повторить отправку",
  "Retry sending",
  "Renvoyer"
 ],
 [
  "Проверить ответ",
  "Check response",
  "Vérifier la réponse"
 ],
 [
  "AI-ответы в этом модуле доступны по подписке.",
  "AI responses in this module require a subscription.",
  "Les réponses IA de ce module nécessitent un abonnement."
 ],
 [
  "AI может ошибаться. Он помогает со спортом и питанием; медицинские вопросы обсуждай со специалистом.",
  "AI can make mistakes. It helps with training and nutrition; discuss medical questions with a professional.",
  "L’IA peut se tromper. Elle aide pour le sport et la nutrition ; discute des questions médicales avec un professionnel."
 ],
 [
  "Последнее измерение",
  "Latest measurement",
  "Dernière mesure"
 ],
 [
  "Последняя выполненная тренировка",
  "Last completed workout",
  "Dernière séance terminée"
 ],
 [
  "Мой прогресс",
  "My progress",
  "Mes progrès"
 ],
 [
  "Измерений веса пока нет.",
  "No weight measurements yet.",
  "Aucune mesure de poids pour le moment."
 ],
 [
  "Каждое измерение сохраняется отдельно, включая повторное измерение в тот же день.",
  "Every measurement is saved separately, even on the same day.",
  "Chaque mesure est conservée séparément, même lorsqu’elle est répétée le même jour."
 ],
 [
  "Выполненных тренировок пока нет.",
  "No completed workouts yet.",
  "Aucune séance terminée pour le moment."
 ],
 [
  "Плановые нагрузки и остановленные занятия не считаются выполненными.",
  "Scheduled and stopped workouts are not counted as completed.",
  "Les séances prévues ou interrompues ne sont pas comptées comme terminées."
 ],
 [
  "Разбор прогресса",
  "Progress analysis",
  "Analyse des progrès"
 ],
 [
  "Вес, завершённые занятия и фактический дневник питания. Расчёты используют всю историю за выбранный период, даже если список ниже сокращён.",
  "Weight, completed workouts and actual food records. Calculations use the full history for the chosen period, even if the list below is shortened.",
  "Poids, séances terminées et journal alimentaire réel. Les calculs utilisent tout l’historique de la période, même si la liste ci-dessous est abrégée."
 ],
 [
  "Проанализировать 28 дней",
  "Analyse 28 days",
  "Analyser 28 jours"
 ],
 [
  "Запроси разбор. Без измерений и записанных результатов AI не придумывает динамику.",
  "Request an analysis. AI does not invent trends without measurements or logged results.",
  "Demande une analyse. L’IA n’invente pas de tendances sans mesures ni résultats enregistrés."
 ],
 [
  "Новое измерение",
  "New measurement",
  "Nouvelle mesure"
 ],
 [
  "Дата измерения",
  "Measurement date",
  "Date de mesure"
 ],
 [
  "Вес, кг",
  "Weight, kg",
  "Poids, kg"
 ],
 [
  "Талия, см · необязательно",
  "Waist, cm · optional",
  "Tour de taille, cm · facultatif"
 ],
 [
  "Сон, часов · необязательно",
  "Sleep, hours · optional",
  "Sommeil, heures · facultatif"
 ],
 [
  "Энергия, 1–5 · необязательно",
  "Energy, 1–5 · optional",
  "Énergie, 1 à 5 · facultatif"
 ],
 [
  "Личное фото · необязательно",
  "Private photo · optional",
  "Photo personnelle · facultative"
 ],
 [
  "Комментарий",
  "Comment",
  "Commentaire"
 ],
 [
  "Предыдущие записи сохраняются. Вес профиля обновляется по последнему измерению по дате. Фотография остаётся приватной и не анализируется AI.",
  "Previous entries are kept. Profile weight is updated from the latest dated measurement. Photos stay private and are not analysed by AI.",
  "Les anciennes données sont conservées. Le poids du profil suit la dernière mesure datée. La photo reste privée et n’est pas analysée par l’IA."
 ],
 [
  "Сохранить измерение",
  "Save measurement",
  "Enregistrer la mesure"
 ],
 [
  "Проверить и повторить запись",
  "Check and retry saving",
  "Vérifier et réessayer"
 ],
 [
  "История веса и измерений",
  "Weight and measurement history",
  "Historique du poids et des mesures"
 ],
 [
  "История измерений пока пуста. Добавь измерение в форме или напиши AI «Сегодня я вешу 84 кг».",
  "No measurements yet. Add one above or tell AI your current weight.",
  "Aucune mesure pour le moment. Ajoute-en une ci-dessus ou indique ton poids à l’IA."
 ],
 [
  "Показать более ранние измерения",
  "Show older measurements",
  "Afficher les mesures plus anciennes"
 ],
 [
  "История выполненных тренировок",
  "Completed workout history",
  "Historique des séances terminées"
 ],
 [
  "История выполненных тренировок пока пуста.",
  "No completed workouts recorded yet.",
  "Aucune séance terminée enregistrée pour le moment."
 ],
 [
  "Показать более ранние тренировки",
  "Show older workouts",
  "Afficher les séances plus anciennes"
 ],
 [
  "Остановленные занятия",
  "Interrupted workouts",
  "Séances interrompues"
 ],
 [
  "Результаты сохранены, эти занятия не отмечены выполненными.",
  "Results are saved; these workouts are not marked as completed.",
  "Les résultats sont enregistrés ; ces séances ne sont pas considérées comme terminées."
 ],
 [
  "Твои данные",
  "Your data",
  "Tes données"
 ],
 [
  "Скачать историю",
  "Download history",
  "Télécharger l’historique"
 ],
 [
  "Удалить данные AI",
  "Delete AI data",
  "Supprimer les données IA"
 ],
 [
  "Удаление касается только FitGoIn AI: профиля, планов, переписки, прогресса, сводок для тренеров и личных AI-фотографий.",
  "Deleting only affects FitGoIn AI: profile, plans, conversations, progress, coach summaries and private AI photos.",
  "La suppression ne concerne que FitGoIn AI : profil, programmes, conversations, progrès, bilans pour coachs et photos privées."
 ],
 [
  "Тренер, который подходит тебе",
  "The right trainer for you",
  "Le coach qui te correspond"
 ],
 [
  "Используем твой профиль и опубликованные анкеты FitGoIn. Процент — совпадение пожеланий, а не гарантия результата.",
  "We use your profile and published FitGoIn trainer profiles. The percentage shows preference compatibility, not guaranteed results.",
  "Nous utilisons ton profil et les profils de coachs publiés. Le pourcentage indique une compatibilité, pas une garantie de résultats."
 ],
 [
  "Изменить пожелания",
  "Edit preferences",
  "Modifier les préférences"
 ],
 [
  "Цена не указана",
  "Price not specified",
  "Prix non indiqué"
 ],
 [
  "Карточка",
  "Profile",
  "Fiche"
 ],
 [
  "Написать",
  "Message",
  "Écrire"
 ],
 [
  "Передать сводку",
  "Share summary",
  "Partager un bilan"
 ],
 [
  "По выбранному спорту пока нет опубликованных тренеров. Уточни спорт в профиле или посмотри каталог.",
  "No trainers are published for this sport yet. Update your sport in the profile or browse the directory.",
  "Aucun coach publié pour ce sport. Modifie le sport dans ton profil ou consulte l’annuaire."
 ],
 [
  "Все тренеры",
  "All trainers",
  "Tous les coachs"
 ],
 [
  "Что спросить перед началом",
  "Questions to ask before starting",
  "Questions à poser avant de commencer"
 ],
 [
  "Переданные сводки",
  "Shared summaries",
  "Bilans partagés"
 ],
 [
  "Тренер видит только текст сводки до указанной даты. Отзыв доступа не удаляет копию, которую тренер уже сохранил.",
  "The trainer can read the summary until the stated date. Revoking access does not remove a copy the trainer already saved.",
  "Le coach peut lire le bilan jusqu’à la date indiquée. Révoquer l’accès ne supprime pas une copie déjà enregistrée."
 ],
 [
  "Отозвать доступ",
  "Revoke access",
  "Révoquer l’accès"
 ],
 [
  "Клиенты поделились с тобой",
  "Clients shared with you",
  "Les clients ont partagé avec toi"
 ],
 [
  "Питание и восстановление",
  "Nutrition and recovery",
  "Nutrition et récupération"
 ],
 [
  "Создать программу",
  "Create a program",
  "Créer un programme"
 ],
 [
  "Создать новую версию",
  "Create a new version",
  "Créer une nouvelle version"
 ],
 [
  "Моя программа",
  "My program",
  "Mon programme"
 ],
 [
  "Твоя программа пока не создана.",
  "Your program has not been created yet.",
  "Ton programme n’est pas encore créé."
 ],
 [
  "Разминка и завершение",
  "Warm-up and cool-down",
  "Échauffement et retour au calme"
 ],
 [
  "Упражнения закончены",
  "All exercises completed",
  "Tous les exercices sont terminés"
 ],
 [
  "Записать подход",
  "Log a set",
  "Enregistrer une série"
 ],
 [
  "Оборудование",
  "Equipment",
  "Matériel"
 ],
 [
  "Отдых",
  "Rest",
  "Repos"
 ],
 [
  "Разминка",
  "Warm-up",
  "Échauffement"
 ],
 [
  "Завершение",
  "Cool-down",
  "Retour au calme"
 ],
 [
  "Список упражнений закончен.",
  "Exercise list completed.",
  "La liste des exercices est terminée."
 ],
 [
  "Восстановление и обычная активность",
  "Recovery and everyday activity",
  "Récupération et activité habituelle"
 ],
 [
  "Твой план начинается здесь",
  "Your plan starts here",
  "Ton programme commence ici"
 ],
 [
  "Программа без календарной привязки",
  "Program without a fixed schedule",
  "Programme sans calendrier fixe"
 ],
 [
  "Перед началом учтём время, сон и самочувствие.",
  "Before starting, consider time, sleep and how you feel.",
  "Avant de commencer, tenons compte du temps, du sommeil et de ton état."
 ],
 [
  "Дни недели не заданы. Выбери тренировку по порядку из программы ниже.",
  "No weekdays specified. Choose workouts in order from the program below.",
  "Aucun jour fixé. Choisis les séances dans l’ordre ci-dessous."
 ],
 [
  "Сегодня нет тренировки по графику. Отдых помогает восстановиться. Если пропустил занятие, выбери его ниже и сохрани время на восстановление.",
  "No scheduled workout today. Rest supports recovery. If you missed one, select it below and allow time to recover.",
  "Aucune séance prévue aujourd’hui. Le repos favorise la récupération. Si tu en as manqué une, sélectionne-la ci-dessous et prévois une récupération."
 ],
 [
  "Заполни спортивный профиль, затем создай программу под свою цель.",
  "Complete your sports profile, then create a program for your goal.",
  "Complète ton profil sportif, puis crée un programme adapté à ton objectif."
 ],
 [
  "Начать сегодняшнюю",
  "Start today’s workout",
  "Commencer la séance du jour"
 ],
 [
  "Спросить AI",
  "Ask AI",
  "Demander à l’IA"
 ],
 [
  "Итоги последних 7 дней",
  "Last 7 days",
  "Bilan des 7 derniers jours"
 ],
 [
  "Добавить график в календарь",
  "Add schedule to calendar",
  "Ajouter au calendrier"
 ],
 [
  "Оценить технику",
  "Review technique",
  "Évaluer la technique"
 ],
 [
  "Доступ к AI",
  "AI access",
  "Accès à l’IA"
 ],
 [
  "Можно составить примерное меню, список покупок и варианты замены продуктов.",
  "You can create a sample menu, shopping list and food substitutions.",
  "Tu peux créer un menu type, une liste de courses et des alternatives alimentaires."
 ],
 [
  "Моё питание",
  "My nutrition",
  "Ma nutrition"
 ],
 [
  "Составить меню",
  "Build a menu",
  "Créer un menu"
 ],
 [
  "Продолжить в чате",
  "Continue in chat",
  "Continuer dans le chat"
 ],
 [
  "Питание",
  "Nutrition",
  "Nutrition"
 ],
 [
  "Составим простой рацион по твоим сохранённым данным. Меню сохранится после подтверждения.",
  "We’ll create a simple meal plan from your saved details. It will be saved after confirmation.",
  "Créons un menu simple à partir de tes données. Il sera enregistré après confirmation."
 ],
 [
  "Расскажи AI о цели питания, возрасте, росте, весе и активности. Учтём сохранённые предпочтения; недостающее уточним в чате.",
  "Tell AI your nutrition goal, age, height, weight and activity. Saved preferences will be used; missing details can be discussed in chat.",
  "Indique à l’IA ton objectif alimentaire, ton âge, ta taille, ton poids et ton activité. Les préférences enregistrées seront prises en compte."
 ],
 [
  "Приготовление",
  "Preparation",
  "Préparation"
 ],
 [
  "Список продуктов и расчёт",
  "Shopping list and estimate",
  "Liste de courses et estimation"
 ],
 [
  "Проверь меню.",
  "Review the menu.",
  "Vérifie le menu."
 ],
 [
  "Рацион ещё не принят.",
  "Meal plan not accepted yet.",
  "Le menu n’est pas encore validé."
 ],
 [
  "Сохранить рацион",
  "Save meal plan",
  "Enregistrer le menu"
 ],
 [
  "Отменить черновик",
  "Discard draft",
  "Annuler le brouillon"
 ],
 [
  "Черновик рациона",
  "Meal plan draft",
  "Brouillon du menu"
 ],
 [
  "Сохранённый рацион",
  "Saved meal plan",
  "Menu enregistré"
 ],
 [
  "Отменить",
  "Cancel",
  "Annuler"
 ],
 [
  "Заменить",
  "Replace",
  "Remplacer"
 ],
 [
  "Открыть «Питание»",
  "Open Nutrition",
  "Ouvrir « Nutrition »"
 ],
 [
  "Изменить рацион в чате",
  "Edit meal plan in chat",
  "Modifier le menu dans le chat"
 ],
 [
  "Предложить новое меню",
  "Suggest a new menu",
  "Proposer un nouveau menu"
 ],
 [
  "Твой базовый рацион. Принятое меню хранится отдельно от нового предложения.",
  "Your base meal plan. The saved menu stays separate from new proposals.",
  "Ton menu de base. Le menu validé reste séparé des nouvelles propositions."
 ],
 [
  "Открыть предложение",
  "Open proposal",
  "Ouvrir la proposition"
 ],
 [
  "Предлагаемая адаптация",
  "Suggested adjustment",
  "Adaptation proposée"
 ],
 [
  "Применить изменение",
  "Apply change",
  "Appliquer le changement"
 ],
 [
  "Не менять программу",
  "Keep current program",
  "Conserver le programme"
 ],
 [
  "Дата",
  "Date",
  "Date"
 ],
 [
  "Название",
  "Name",
  "Nom"
 ],
 [
  "Удалить",
  "Delete",
  "Supprimer"
 ],
 [
  "Калории · нижняя оценка",
  "Calories · low estimate",
  "Calories · estimation basse"
 ],
 [
  "Калории · верхняя оценка",
  "Calories · high estimate",
  "Calories · estimation haute"
 ],
 [
  "Белки, г",
  "Protein, g",
  "Protéines, g"
 ],
 [
  "Жиры, г",
  "Fat, g",
  "Lipides, g"
 ],
 [
  "Углеводы, г",
  "Carbs, g",
  "Glucides, g"
 ],
 [
  "Подтверди порцию и оценку",
  "Confirm portion and estimate",
  "Confirme la portion et l’estimation"
 ],
 [
  "Исправь данные по фактической порции, упаковке или известному рецепту. Сохранение не изменяет твоё меню автоматически.",
  "Correct the values using the actual portion, package or known recipe. Saving does not change your meal plan automatically.",
  "Corrige les données selon la portion réelle, l’emballage ou la recette. Enregistrer ne modifie pas automatiquement ton menu."
 ],
 [
  "Подтверждаю, сохранить",
  "Confirm and save",
  "Confirmer et enregistrer"
 ],
 [
  "Удобное время",
  "Preferred time",
  "Horaire préféré"
 ],
 [
  "Город для поиска тренера",
  "City for trainer search",
  "Ville pour chercher un coach"
 ],
 [
  "Формат с тренером",
  "Training format",
  "Format d’accompagnement"
 ],
 [
  "Любой",
  "Any",
  "Tous"
 ],
 [
  "Любое",
  "Any",
  "Tout"
 ],
 [
  "Онлайн",
  "Online",
  "En ligne"
 ],
 [
  "Офлайн",
  "In person",
  "En présentiel"
 ],
 [
  "Бюджет за",
  "Budget per",
  "Budget par"
 ],
 [
  "Бюджет, € · необязательно",
  "Budget, € · optional",
  "Budget, € · facultatif"
 ],
 [
  "Утро",
  "Morning",
  "Matin"
 ],
 [
  "День",
  "Daytime",
  "Journée"
 ],
 [
  "Вечер",
  "Evening",
  "Soir"
 ],
 [
  "Выходные",
  "Weekends",
  "Week-end"
 ],
 [
  "В зале",
  "At the gym",
  "En salle"
 ],
 [
  "На улице",
  "Outdoors",
  "En extérieur"
 ],
 [
  "Дома",
  "At home",
  "À la maison"
 ],
 [
  "Стандартное оборудование зала",
  "Standard gym equipment",
  "Équipement standard de salle"
 ],
 [
  "Упражнения без инвентаря",
  "Bodyweight exercises",
  "Exercices sans matériel"
 ],
 [
  "Аллергены · исключить из меню",
  "Allergens · exclude from menu",
  "Allergènes · à exclure du menu"
 ],
 [
  "Ограничения · можно не раскрывать подробности",
  "Restrictions · details optional",
  "Restrictions · détails facultatifs"
 ],
 [
  "Готово",
  "Done",
  "Terminé"
 ],
 [
  "Мой профиль",
  "My profile",
  "Mon profil"
 ],
 [
  "Полезные советы",
  "Helpful tips",
  "Conseils utiles"
 ],
 [
  "Включить",
  "Enable",
  "Activer"
 ],
 [
  "Не сейчас",
  "Not now",
  "Pas maintenant"
 ]
].map(([ru,en,fr])=>[ru,{en,fr}]));
const originals=new WeakMap();
const protectedText='script,style,textarea,[contenteditable],.fgi-ai-message p[dir="auto"],.fgi-ai-pre,.fgi-ai-sources,.ai-history,[data-analysis-answer],[data-progress-history] p,[data-workout-history] ul,.ai-meal-foods strong,.ai-meal-foods small,.ai-nutrition-changes';
export function aiUiLabel(source,language){
 const literal=String(source??'').trim(), translated=aiUiCatalog.get(literal)?.[language];
 return translated||translateStaticLiteral(literal,language);
}
export function translateAIUI(root,language){
 if(!root||!['fr','en','ru'].includes(language))return;
 const doc=root.ownerDocument||globalThis.document;
 if(!doc?.createTreeWalker)return;
 const walker=doc.createTreeWalker(root,globalThis.NodeFilter?.SHOW_TEXT??4);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const parent=node.parentElement;
  if(!parent||parent.closest(protectedText))continue;
  let original=originals.get(node);
  if(original===undefined){original=node.nodeValue;originals.set(node,original);}
  const bare=original.trim();
  if(!bare)continue;
  const translation=aiUiLabel(bare,language);
  if(translation===bare&&language!=='ru')continue;
  const newValue=original.replace(bare,translation);
  if(node.nodeValue!==newValue)node.nodeValue=newValue;
 }
 for(const el of root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){
  if(el.closest(protectedText))continue;
  for(const attr of ['placeholder','title','aria-label']){
   if(!el.hasAttribute(attr))continue;
   const original=el.getAttribute('data-fgi-original-'+attr)||el.getAttribute(attr);
   if(aiUiLabel(original,language)===original&&language!=='ru')continue;
   if(!el.hasAttribute('data-fgi-original-'+attr))el.setAttribute('data-fgi-original-'+attr,original);
   el.setAttribute(attr,aiUiLabel(original,language));
  }
 }
}

// Supplementary labels discovered by scanning the generated AI pages.
for(const [ru,en,fr] of [["Дни тренировок · можно выбрать позже","Training days · can be chosen later","Jours d’entraînement · à choisir plus tard"],["Есть травма, заболевание, беременность, расстройство пищевого поведения или серьёзная аллергия — персональную программу нужно согласовать со специалистом.","Injury, illness, pregnancy, eating disorder or severe allergy: discuss a personalized program with a healthcare professional.","Blessure, maladie, grossesse, trouble du comportement alimentaire ou allergie grave : un programme personnalisé doit être validé avec un professionnel de santé."],["Я согласен сохранять спортивный профиль и историю в FitGoIn и передавать необходимые данные OpenAI для ответов AI. Данные о здоровье предоставляю добровольно.","I agree to store my sports profile and history in FitGoIn and share the necessary data with OpenAI for AI responses. I provide health information voluntarily.","J’accepte l’enregistrement de mon profil sportif et de mon historique dans FitGoIn ainsi que le partage des données nécessaires avec OpenAI pour les réponses IA. Je fournis volontairement mes données de santé."],["Разрешаю отправить выбранное фото или шесть кадров видео в OpenAI для этого анализа.","I consent to sending the selected photo or six video frames to OpenAI for this analysis.","J’autorise l’envoi de la photo sélectionnée ou de six images de la vidéo à OpenAI pour cette analyse."],["Получить оценку","Get assessment","Obtenir l’évaluation"],["Проверь оценку","Review assessment","Vérifier l’évaluation"],["Дневник питания · сегодня","Food diary · today","Journal alimentaire · aujourd’hui"],["Последние записи питания","Recent food entries","Dernières entrées alimentaires"],["Записей пока нет.","No entries yet.","Aucune entrée pour le moment."],["Предложение относится к прежней программе. Обнови разбор перед подтверждением.","This proposal refers to an older program. Refresh the analysis before confirming.","Cette proposition concerne un ancien programme. Actualise l’analyse avant de confirmer."],["Адаптация обсуждалась в другом диалоге.","The adjustment was discussed in another conversation.","L’adaptation a été discutée dans une autre conversation."],["Активная программа ещё не изменена. После согласия создадим новую версию; предыдущая версия и результаты сохранятся.","The active program has not changed. Confirming will create a new version while preserving the previous one and your results.","Le programme actif n’a pas changé. Ta confirmation créera une nouvelle version sans supprimer la précédente ni les résultats."],["Подтверждаю: техника уверенная, боли нет.","I confirm: technique is controlled and there is no pain.","Je confirme : la technique est maîtrisée et je ne ressens aucune douleur."],["Выбери текущую тренировку","Choose your current workout","Choisis ta séance actuelle"],["Программа требует пересмотра. Обсуди изменения с AI перед продолжением.","The program needs review. Discuss changes with AI before continuing.","Le programme doit être revu. Discute des modifications avec l’IA avant de continuer."],["Разминка:","Warm-up:","Échauffement :"],["Завершение:","Cool-down:","Retour au calme :"],["Спортивные данные изменились. Перед использованием пересмотри программу под новые условия.","Your sports details have changed. Review the program for your new situation before using it.","Tes données sportives ont changé. Vérifie le programme selon les nouvelles conditions avant de l’utiliser."],["Голосовая команда","Voice command","Commande vocale"],["Завершить тренировку","Finish workout","Terminer la séance"],["Боль / остановить","Pain / stop","Douleur / arrêter"],["За последние 7 дней","In the last 7 days","Au cours des 7 derniers jours"],["Достижения","Achievements","Réalisations"],["Доступен после повторного входа. Замены сначала показываем в черновике.","Available after signing in again. Replacements are shown as a draft first.","Disponible après reconnexion. Les remplacements sont d’abord proposés dans un brouillon."],["Результаты упражнений не записаны.","No exercise results recorded.","Aucun résultat d’exercice enregistré."],["Подтверди завершение","Confirm completion","Confirmer la fin"],["Завершить тренировку?","Finish the workout?","Terminer la séance ?"],["Оставь поле пустым, если значение неизвестно. Время из программы не считается фактической длительностью.","Leave a field empty if unknown. Planned duration does not count as actual workout time.","Laisse le champ vide si tu ne sais pas. La durée prévue ne constitue pas la durée réelle."],["Подтвердить и сохранить","Confirm and save","Confirmer et enregistrer"],["Тренер получит только показанный ниже текст на 14 дней. Фотографии, переписка и медицинские ограничения в него не входят.","The trainer can see only the text below for 14 days. Photos, conversations and medical restrictions are not included.","Le coach ne verra que le texte ci-dessous pendant 14 jours. Les photos, conversations et restrictions médicales n’en font pas partie."],["Добавить возраст, рост и вес","Include age, height and weight","Ajouter l’âge, la taille et le poids"],["Разрешаю этому тренеру увидеть именно эту сводку.","I authorize this trainer to view this specific summary.","J’autorise ce coach à consulter uniquement ce bilan."],["Разрешить доступ","Grant access","Autoriser l’accès"],["Удалить данные AI?","Delete AI data?","Supprimer les données IA ?"],["Введи УДАЛИТЬ","Type УДАЛИТЬ","Saisis УДАЛИТЬ"]]) aiUiCatalog.set(ru,{en,fr});
