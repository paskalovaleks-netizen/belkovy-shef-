import { defaultProfile, goalNames, normalizeProfile, generateMonth, scaledIngredients, mealNutrition, sumNutrition, eligibleRecipe, replaceMeal } from './planner.js';
import { foods, foodGroups } from './foods.js';
import { ingredientRows, roundNutrition } from './nutrition.js';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => roundNutrition(value).toLocaleString('ru-RU');
const portionNumber = value => value.toLocaleString('ru-RU', { maximumFractionDigits: 4 });
export function nutritionTable(recipe, portions = 1) {
  const total = mealNutrition(recipe, portions);
  return `<div class="table-scroll"><table class="nutrition-table"><caption>Расчёт КБЖУ по ингредиентам · выбранная порция</caption><thead><tr><th scope="col">Продукт</th><th scope="col">Масса, г</th><th scope="col">ккал</th><th scope="col">Б, г</th><th scope="col">Ж, г</th><th scope="col">У, г</th></tr></thead><tbody>${ingredientRows(recipe.components, portions).map(row => `<tr><th scope="row">${escape(row.name)}</th><td>${number(row.grams)}</td><td>${number(row.kcal)}</td><td>${number(row.protein)}</td><td>${number(row.fat)}</td><td>${number(row.carbs)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Всего</th><td>${number(ingredientRows(recipe.components, portions).reduce((sum, row) => sum + row.grams, 0))}</td><td>${number(total.kcal)}</td><td>${number(total.protein)}</td><td>${number(total.fat)}</td><td>${number(total.carbs)}</td></tr></tfoot></table></div><p class="field-hint">Масса мяса и рыбы — до приготовления; крупы указаны сухими, бобовые — варёными. Вода и соль не добавляют КБЖУ. Расчёт: масса × БЖУ на 100 г ÷ 100; ккал = 4 × белки + 9 × жиры + 4 × углеводы. Округление — до 0,1; сумма округлённых строк может отличаться на десятые.</p>`;
}
export function mountPlanner(root, recipes, openRecipe) {
  let profile = { ...defaultProfile, likedFoods: [], excludedFoods: [], allergens: [] };
  let month = null, activeDay = 0, variant = 0, step = 0;
  try {
    const saved = JSON.parse(localStorage.getItem('chef-profile') || 'null');
    if (saved) profile = normalizeProfile(saved);
    const savedMonth = JSON.parse(localStorage.getItem('chef-month') || 'null');
    if (savedMonth?.version === 3 && savedMonth.days?.length === 30 && savedMonth.days.every(day => day.meals?.length === profile.meals)) {
      const ids = savedMonth.days.flatMap(day => day.meals.map(meal => meal.id));
      if (new Set(ids).size === ids.length && savedMonth.days.every(day => day.meals.every(meal => recipes.some(recipe => recipe.id === meal.id && eligibleRecipe(recipe, profile)) && Number.isFinite(meal.portions) && meal.portions >= 0.75 && meal.portions <= 2))) {
        month = { profile, days: savedMonth.days.map(day => {
          const meals = day.meals.map(meal => ({ ...meal, recipe: recipes.find(recipe => recipe.id === meal.id) }));
          return { meals, totals: sumNutrition(meals), warnings: day.warnings || [] };
        }) };
        step = 3;
      }
    }
  } catch { /* Invalid or unavailable storage must not prevent setup. */ }
  const allergens = { dairy: 'Молочные продукты', eggs: 'Яйца', fish: 'Рыба', nuts: 'Орехи', soy: 'Соя', gluten: 'Пшеница / глютен' };
  function foodTable() {
    return Object.entries(foodGroups).map(([group, ids], index) => `<details class="food-group" ${index < 3 ? 'open' : ''}><summary>${group} <span>${ids.length} продуктов</span></summary><div class="table-scroll"><table class="food-table"><caption class="sr-only">${group}: выбор продуктов и справочные КБЖУ на 100 г</caption><thead><tr><th scope="col">Продукт</th><th scope="col">Хочу</th><th scope="col">Можно</th><th scope="col">Исключить</th><th scope="col">ккал</th><th scope="col">Б, г</th><th scope="col">Ж, г</th><th scope="col">У, г</th></tr></thead><tbody>${ids.map(id => {
      const [name, protein, fat, carbs] = foods[id];
      const selected = profile.excludedFoods.includes(id) ? 'exclude' : profile.likedFoods.includes(id) ? 'like' : 'allow';
      return `<tr data-food-row="${id}"><th scope="row">${escape(name)}</th>${[['like', 'Хочу'], ['allow', 'Можно'], ['exclude', 'Исключить']].map(([value, label]) => `<td><label><input type="radio" name="food-${id}" value="${value}" aria-label="${label}: ${escape(name)}" ${selected === value ? 'checked' : ''}></label></td>`).join('')}<td>${number(protein * 4 + fat * 9 + carbs * 4)}</td><td>${number(protein)}</td><td>${number(fat)}</td><td>${number(carbs)}</td></tr>`;
    }).join('')}</tbody></table></div></details>`).join('');
  }
  function calorieStep() {
    return `<div class="assistant-message"><span>💪</span><div><h2>Сколько калорий хочешь в день?</h2><p>Задай белок и калории — я автоматически подберу продукты, блюда и размеры порций на месяц. Главный приоритет — белок.</p></div></div><p class="protein-priority">💪 Приоритет: цель по белку, затем калории и остальные БЖУ.</p><label>Желаемые калории в день, ккал<input name="kcal" type="number" required min="1000" max="4000" step="1" value="${profile.kcal}"></label><div class="target-presets" role="group" aria-label="Быстрый выбор калорий">${[1500, 1800, 2000, 2200, 2500].map(value => `<button type="button" data-kcal="${value}" class="chip" aria-pressed="${profile.kcal === value}">${value} ккал</button>`).join('')}</div><label>Желаемый белок в день, г<input name="protein" type="number" required min="20" max="300" step="1" value="${profile.protein}"></label><div class="target-presets" role="group" aria-label="Быстрый выбор белка">${[90, 120, 150, 180].map(value => `<button type="button" data-protein="${value}" class="chip" aria-pressed="${profile.protein === value}">${value} г белка</button>`).join('')}</div><details class="optional-targets"><summary>Дополнительно: жиры и углеводы</summary><div class="form-columns manual-targets"><label>Жиры в день, г (необязательно)<input name="fat" type="number" min="0" max="200" step="1" value="${profile.fat ?? ''}" placeholder="Не ограничивать"></label><label>Углеводы в день, г<input name="carbs" type="number" readonly value="${profile.carbs ?? ''}" placeholder="Остаток калорий после Б и Ж"></label></div><p class="field-hint">Если задать жиры, углеводы рассчитываются из оставшихся калорий. Меню будет учитывать все выбранные цели КБЖУ.</p></details><label>Пожелание к меню<select name="goal">${Object.entries(goalNames).map(([value, title]) => `<option value="${value}">${title}</option>`).join('')}</select></label><p class="field-hint">Калории задаёшь ты. Приложение не назначает норму и не меняет её из-за выбранной цели. В меню будут фактические КБЖУ; если не удалось приблизиться к заданным значениям, появится предупреждение.</p>`;
  }

  function render() {
    root.innerHTML = `<div class="planner-header"><p class="eyebrow">ТВОЙ ПОМОЩНИК ПОВАРА</p><h1>Месяц вкусной еды.<br><em>Под твои пожелания.</em></h1><p>Выбери продукты, укажи желаемые калории — и получи 30 дней рецептов с КБЖУ, без повторения блюд.</p></div><ol class="wizard-progress" aria-label="Этапы настройки">${['Выбор продуктов', 'Калории и белок', 'Меню на месяц'].map((name, i) => `<li class="${i === step ? 'current' : i < step ? 'done' : ''}" ${i === step ? 'aria-current="step"' : ''}>${i + 1}. ${name}</li>`).join('')}</ol><div id="wizard-body"></div>`;
    const body = root.querySelector('#wizard-body');
    if (step === 3 && month) { renderMonth(body); return; }
    const content = step === 0 ? `<div class="assistant-message"><span>👨‍🍳</span><div><h2>Отметь, что хочешь есть.</h2><p>Ничего не нужно писать. «Хочу» — чаще в меню, «Можно» — без предпочтения, «Исключить» — не использовать.</p></div></div><label>Тип питания<select name="diet"><option value="all">Ем всё</option><option value="vegetarian">Без мяса и рыбы</option><option value="vegan">Только растительные продукты</option></select></label><p class="field-hint">В таблице весь список продуктов из каталога. КБЖУ — на 100 г продукта, а не на блюдо. Выбор «Хочу» не отменяет исключения по типу питания и аллергенам.</p><div id="food-selection-status" role="status"></div>${foodTable()}` : step === 1 ? calorieStep() : `<div class="assistant-message"><span>📋</span><div><h2>Последние детали — и меню готово.</h2><p>На все 30 дней будут разные блюда, с ингредиентами и шагами приготовления.</p></div></div><div class="form-columns"><label>Приёмов пищи в день<select name="meals"><option value="3">3 — завтрак, обед, ужин</option><option value="4">4 — с одним перекусом</option><option value="5">5 — с двумя перекусами</option></select></label><label>Максимум минут на блюдо<input name="maxTime" type="number" min="5" max="90" step="1" required value="${profile.maxTime}"></label></div><fieldset><legend>Какие группы продуктов исключить?</legend><div class="allergen-options">${Object.entries(allergens).map(([key, title]) => `<label><input type="checkbox" name="allergens" value="${key}" ${profile.allergens.includes(key) ? 'checked' : ''}> ${title}</label>`).join('')}</div></fieldset><p class="field-hint">Для глютена исключаются также овсяные блюда. При аллергии проверяйте маркировку: помощник не оценивает следы аллергенов.</p><div class="settings-summary"><strong>${profile.protein} г белка · ${profile.kcal} ккал в день</strong><span>Выбрано любимых продуктов: ${profile.likedFoods.length} · исключено: ${profile.excludedFoods.length}</span><span>30 дней · без повторения блюд</span></div>`;
    body.innerHTML = `<form id="profile-form">${content}<p id="planner-error" class="planner-error" role="alert"></p><div class="wizard-actions">${step > 0 ? '<button type="button" id="back-step" class="secondary">Назад</button>' : ''}<button type="submit" class="primary">${step === 2 ? 'Составить меню на 30 дней' : 'Дальше'} <span>→</span></button></div></form>`;
    for (const name of ['diet', 'goal', 'meals']) if (body.querySelector(`[name="${name}"]`)) body.querySelector(`[name="${name}"]`).value = profile[name];
    if (step === 0) {
      updateSelectionStatus();
      body.querySelectorAll('[name^="food-"]').forEach(input => input.addEventListener('change', () => { collect(); updateSelectionStatus(); }));
    }
    if (step === 1) {
      const updatePresets = () => {
        for (const key of ['kcal', 'protein']) body.querySelectorAll(`[data-${key}]`).forEach(button => button.setAttribute('aria-pressed', String(Number(body.querySelector(`[name=${key}]`).value) === Number(button.dataset[key]))));
        updateCarbs();
      };
      for (const key of ['kcal', 'protein']) body.querySelectorAll(`[data-${key}]`).forEach(button => button.addEventListener('click', () => { body.querySelector(`[name=${key}]`).value = button.dataset[key]; updatePresets(); }));
      for (const name of ['protein', 'kcal', 'fat']) body.querySelector(`[name="${name}"]`).addEventListener('input', updatePresets);
      updatePresets();
    }
    body.querySelector('#back-step')?.addEventListener('click', () => { collect(); step--; render(); });
    body.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      try { collect(); profile = normalizeProfile(profile); }
      catch (error) { body.querySelector('#planner-error').textContent = error.message; return; }
      if (step < 2) { step++; render(); root.querySelector('h2')?.setAttribute('tabindex', '-1'); root.querySelector('h2')?.focus(); return; }
      await makeMonth(body.querySelector('[type="submit"]'));
    });
  }
  function updateSelectionStatus() {
    const status = root.querySelector('#food-selection-status');
    if (status) status.textContent = `Хочу: ${profile.likedFoods.length} · исключено: ${profile.excludedFoods.length}`;
  }
  function collect() {
    const form = root.querySelector('form'); if (!form) return;
    const data = new FormData(form);
    for (const key of ['diet', 'goal', 'protein', 'kcal', 'fat', 'meals', 'maxTime']) if (data.has(key)) profile[key] = data.get(key);
    if (step === 0) {
      profile.likedFoods = Object.keys(foods).filter(id => data.get(`food-${id}`) === 'like');
      profile.excludedFoods = Object.keys(foods).filter(id => data.get(`food-${id}`) === 'exclude');
      profile.liked = ''; profile.excluded = '';
    }
    if (step === 2) profile.allergens = data.getAll('allergens');
  }
  function updateCarbs() {
    const fat = root.querySelector('[name=fat]');
    const carbs = root.querySelector('[name=carbs]');
    if (!fat || !carbs) return;
    carbs.value = fat.value === '' ? '' : Math.round((Number(root.querySelector('[name=kcal]').value) - Number(root.querySelector('[name=protein]').value) * 4 - Number(fat.value) * 9) / 4);
  }
  async function makeMonth(button) {
    const original = button.textContent; button.disabled = true; button.textContent = 'Подбираю 30 дней…';
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      const result = generateMonth(recipes, profile, { variant });
      if (result.error) throw new Error(result.error);
      month = result; activeDay = 0; step = 3; persist(); render(); root.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      let target = root.querySelector('#planner-error');
      if (!target) { target = document.createElement('p'); target.id = 'planner-error'; target.className = 'planner-error'; target.setAttribute('role', 'alert'); button.parentElement.after(target); }
      target.textContent = error.message; button.disabled = false; button.textContent = original;
    }
  }
  function persist() {
    try {
      localStorage.setItem('chef-profile', JSON.stringify(profile));
      localStorage.setItem('chef-month', JSON.stringify({ version: 3, days: month.days.map(day => ({ warnings: day.warnings, meals: day.meals.map(meal => ({ id: meal.recipe.id, portions: meal.portions, slot: meal.slot })) })) }));
    } catch { /* In-memory plan remains available. */ }
  }
  function renderMonth(body) {
    const day = month.days[activeDay], diff = roundNutrition(day.totals.protein - profile.protein);
    body.innerHTML = `<div class="month-heading"><div><p class="eyebrow">${escape(goalNames[profile.goal])}</p><h2>Твоё меню на 30 дней</h2><p>Приоритет — белок · ${profile.meals * 30} разных блюд · цель ${profile.protein} г белка и ${profile.kcal} ккал в день</p></div><div class="month-buttons"><button id="edit-profile" class="secondary">Изменить продукты и цели</button><button id="another-menu" class="secondary">Другой вариант меню</button><button id="export-menu" class="secondary">Скачать весь месяц</button></div></div><div class="day-picker" role="group" aria-label="Выбор дня">${month.days.map((_, index) => `<button data-day="${index}" class="chip ${index === activeDay ? 'active' : ''}" aria-pressed="${index === activeDay}">${index + 1}</button>`).join('')}</div><div class="daily-summary"><div><h3>День ${activeDay + 1}</h3><p>Белок: ${diff >= 0 ? '+' : ''}${number(diff)} г к цели</p>${profile.fat !== null ? `<p>Цели: Ж ${number(profile.fat)} г · У ${number(profile.carbs)} г</p>` : ''}</div><div class="nutrition"><div><strong>${number(day.totals.kcal)}</strong><span>ккал</span></div><div class="protein"><strong>${number(day.totals.protein)} г</strong><span>белки</span></div><div><strong>${number(day.totals.fat)} г</strong><span>жиры</span></div><div><strong>${number(day.totals.carbs)} г</strong><span>углеводы</span></div></div></div>${day.warnings?.length ? `<p class="plan-warning" role="status">${day.warnings.map(escape).join(' ')}</p>` : ''}<p id="replacement-status" class="field-hint" role="status" aria-live="polite"></p><div class="day-meals">${day.meals.map((meal, mealIndex) => {
      const nutrition = mealNutrition(meal.recipe, meal.portions);
      return `<article class="meal"><div class="meal-top"><span class="meal-emoji">${meal.recipe.emoji}</span><div><p class="eyebrow">${meal.slot} · ${meal.recipe.time} МИН</p><h3>${escape(meal.recipe.title)}</h3><p class="portion-badge">${meal.portions === 1 ? '1 базовая порция' : `${portionNumber(meal.portions)} × базовая порция`}</p><p>${number(nutrition.kcal)} ккал · белок ${number(nutrition.protein)} г · жиры ${number(nutrition.fat)} г · углеводы ${number(nutrition.carbs)} г</p></div></div><details><summary>Ингредиенты, расчёт КБЖУ и приготовление</summary>${nutritionTable(meal.recipe, meal.portions)}<h4>Как приготовить</h4><ol>${meal.recipe.steps.map(line => `<li>${escape(line)}</li>`).join('')}</ol></details><div class="meal-actions"><button class="secondary" type="button" data-replace-meal="${mealIndex}" aria-label="Заменить: ${escape(meal.recipe.title)}">⇄ Предложить другое блюдо</button><button class="recipe-link" data-base-recipe="${meal.recipe.id}">Открыть рецепт на 1 базовую порцию ↗</button></div></article>`;
    }).join('')}</div><p class="nutrition-note">Все блюда рассчитаны из массы ингредиентов и единой таблицы БЖУ на 100 г. Это средние справочные значения: сверяйте с упаковкой конкретного продукта. Сухой и готовый вес не взаимозаменяемы. Цели приблизительные; при недостижимом попадании ±10% выводится предупреждение. Замена подбирается случайно и автоматически сохраняется: размер порции корректируется, чтобы белок совпал с исходным до 0,1 г по справочнику. Калории, жиры и углеводы могут измениться. Блюда разные, но отдельные продукты могут встречаться снова.</p>`;
    body.querySelectorAll('[data-day]').forEach(button => button.addEventListener('click', () => { activeDay = Number(button.dataset.day); renderMonth(body); body.querySelector(`[data-day="${activeDay}"]`).focus(); }));
    body.querySelectorAll('[data-base-recipe]').forEach(button => button.addEventListener('click', () => openRecipe(button.dataset.baseRecipe)));
    body.querySelectorAll('[data-replace-meal]').forEach(button => button.addEventListener('click', () => {
      const mealIndex = Number(button.dataset.replaceMeal);
      const original = month.days[activeDay].meals[mealIndex];
      const beforeProtein = mealNutrition(original.recipe, original.portions).protein;
      try {
        month = replaceMeal(recipes, month, activeDay, mealIndex);
        const replacement = month.days[activeDay].meals[mealIndex];
        const afterProtein = mealNutrition(replacement.recipe, replacement.portions).protein;
        persist(); renderMonth(body);
        body.querySelector('#replacement-status').textContent = `Предлагаю «${replacement.recipe.title}» вместо «${original.recipe.title}». Белок: ${number(beforeProtein)} → ${number(afterProtein)} г. КБЖУ дня пересчитаны. Можно нажать ещё раз, чтобы получить другое блюдо.`;
        body.querySelector(`[data-replace-meal="${mealIndex}"]`).focus();
      } catch (error) { body.querySelector('#replacement-status').textContent = error.message; }
    }));
    body.querySelector('#edit-profile').addEventListener('click', () => { step = 0; render(); });
    body.querySelector('#another-menu').addEventListener('click', async event => { variant++; await makeMonth(event.currentTarget); });
    body.querySelector('#export-menu').addEventListener('click', () => {
      const text = ['БЕЛКОВЫЙ ШЕФ — МЕНЮ НА 30 ДНЕЙ', `${goalNames[profile.goal]} · ${profile.protein} г белка · ${profile.kcal} ккал в день`, 'КБЖУ справочные; мясо сырое, крупы сухие, бобовые варёные.\n', ...month.days.map((day, i) => `ДЕНЬ ${i + 1}\nКБЖУ: ${day.totals.kcal} ккал / Б ${day.totals.protein} г / Ж ${day.totals.fat} г / У ${day.totals.carbs} г\n${day.meals.map(meal => { const n = mealNutrition(meal.recipe, meal.portions); return `${meal.slot}: ${meal.recipe.title} (${meal.portions} × базовая порция)\nКБЖУ: ${n.kcal} ккал / Б ${n.protein} г / Ж ${n.fat} г / У ${n.carbs} г\n${scaledIngredients(meal.recipe, meal.portions).join('\n')}\n${meal.recipe.steps.map((line, j) => `${j + 1}. ${line}`).join('\n')}`; }).join('\n\n')}`)].join('\n\n');
      const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'Белковый-шеф-30-дней.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  render();
}
