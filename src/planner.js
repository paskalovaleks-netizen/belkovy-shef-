import { foods } from './foods.js';
import { calculateNutrition, ingredientLines, ingredientRows } from './nutrition.js';
export const defaultProfile = { goal: 'maintain', protein: 120, kcal: 2000, fat: null, carbs: null, meals: 4, maxTime: 40, diet: 'all', excluded: '', liked: '', allergens: [], likedFoods: [], excludedFoods: [] };
export const goalNames = { lose: 'Снижение веса', maintain: 'Поддержание веса', gain: 'Набор массы' };
const allergenPatterns = {
  dairy: /творог|йогурт|молоко|сыр/iu,
  eggs: /яйц|яичн/iu,
  fish: /лосос|тунец|треск|рыб/iu,
  nuts: /орех|миндал/iu,
  soy: /тофу|соев/iu,
  gluten: /хлеб|булгур|кускус|пшенич|овсян|овсяные/iu
};
export function normalizeProfile(input = {}) {
  const profile = { ...defaultProfile, ...input };
  for (const [key, min, max] of [['protein', 20, 300], ['kcal', 1000, 4000], ['meals', 3, 5], ['maxTime', 5, 90]]) {
    profile[key] = Number(profile[key]);
    if (!Number.isFinite(profile[key]) || profile[key] < min || profile[key] > max || !Number.isInteger(profile[key])) throw new Error('Проверьте числовые значения в настройках.');
  }
  if (!Object.hasOwn(goalNames, profile.goal) || !['all', 'vegetarian', 'vegan'].includes(profile.diet)) throw new Error('Выберите цель и тип питания.');
  if (profile.protein * 4 >= profile.kcal) throw new Error('Цель по калориям должна оставлять место для жиров и углеводов, а не только для белка.');
  if (profile.fat !== null && profile.fat !== '') {
    profile.fat = Number(profile.fat);
    if (!Number.isFinite(profile.fat) || profile.fat < 0 || profile.fat > 200) throw new Error('Жиры должны быть в диапазоне 0–200 г в день.');
    profile.carbs = Math.round((profile.kcal - profile.protein * 4 - profile.fat * 9) / 4);
    if (profile.carbs < 0) throw new Error('Указанные белки и жиры превышают выбранную калорийность.');
  } else { profile.fat = null; profile.carbs = null; }
  profile.liked = String(profile.liked || '').trim().slice(0, 300);
  profile.excluded = String(profile.excluded || '').trim().slice(0, 300);
  for (const key of ['likedFoods', 'excludedFoods']) profile[key] = Array.isArray(profile[key]) ? [...new Set(profile[key].filter(id => Object.hasOwn(foods, id)))] : [];
  profile.likedFoods = profile.likedFoods.filter(id => !profile.excludedFoods.includes(id));
  profile.allergens = Array.isArray(profile.allergens) ? profile.allergens.filter(key => Object.hasOwn(allergenPatterns, key)) : [];
  return profile;
}
function preferenceMatch(ingredients, value) {
  const groups = { 'рыба': /лосос|тунец|рыб/iu, 'рыбу': /лосос|тунец|рыб/iu, 'мясо': /куриц|курин|индей|говядин|свинин/iu, 'курица': /куриц|курин/iu, 'курицу': /куриц|курин/iu, 'молочка': /творог|йогурт|молоко|сыр/iu, 'орехи': /орех|миндал/iu, 'грибы': /гриб|шампиньон/iu, 'лосось': /лосос/iu, 'лосося': /лосос/iu, 'гречка': /гречк/iu, 'овсянка': /овсян|овсяные/iu, 'индейка': /индей/iu, 'индейку': /индей/iu, 'яйца': /яйц|яичн/iu, 'соя': /соев|тофу/iu };
  return groups[value] ? groups[value].test(ingredients) : ingredients.includes(value);
}
export function eligibleRecipe(recipe, profile) {
  const ingredients = recipe.ingredients.join(' ').toLocaleLowerCase('ru');
  if ((profile.excludedFoods || []).some(id => recipe.components?.some(([foodId]) => foodId === id))) return false;
  if (recipe.time > profile.maxTime) return false;
  if (profile.diet !== 'all' && /куриц|курин|индей|лосос|тунец|треск|рыб|кролик|говядин|свинин/iu.test(ingredients)) return false;
  if (profile.diet === 'vegan' && /творог|йогурт|молоко|сыр|яйц|яичн|мёд|мед/iu.test(ingredients)) return false;
  if (profile.allergens.some(key => allergenPatterns[key].test(ingredients))) return false;
  return !profile.excluded.toLocaleLowerCase('ru').split(/[,;\n]/u).map(value => value.trim()).filter(Boolean).some(value => {
    return preferenceMatch(ingredients, value);
  });
}
const nutritionCache = new WeakMap();
export function mealNutrition(recipe, portions = 1) {
  if (!nutritionCache.has(recipe)) nutritionCache.set(recipe, new Map());
  const cached = nutritionCache.get(recipe);
  if (!cached.has(portions)) cached.set(portions, calculateNutrition(recipe.components, portions));
  return cached.get(portions);
}
export function sumNutrition(meals) {
  const result = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const meal of meals) {
    const nutrition = mealNutrition(meal.recipe, meal.portions);
    for (const key of Object.keys(result)) result[key] += nutrition[key];
  }
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}
function score(totals, profile) {
  return Math.abs(totals.protein - profile.protein) / profile.protein * 6 + Math.abs(totals.kcal - profile.kcal) / profile.kcal + (profile.fat !== null && profile.fat !== undefined ? Math.abs(totals.fat - profile.fat) / Math.max(profile.fat, 10) * 0.3 : 0) + (profile.carbs !== null && profile.carbs !== undefined ? Math.abs(totals.carbs - profile.carbs) / Math.max(profile.carbs, 10) * 0.2 : 0);
}
function nutritionWarnings(totals, profile) {
  const warnings = [];
  if (Math.abs(totals.protein - profile.protein) > profile.protein * 0.1) warnings.push('В этом каталоге не удалось попасть в цель по белку с точностью ±10%.');
  if (Math.abs(totals.kcal - profile.kcal) > profile.kcal * 0.1) warnings.push('В этом каталоге не удалось попасть в цель по калориям с точностью ±10%.');
  for (const [key, label] of [['fat', 'жирам'], ['carbs', 'углеводам']]) if (profile[key] !== null && Math.abs(totals[key] - profile[key]) > Math.max(profile[key] * 0.1, 2)) warnings.push(`Не удалось попасть в цель по ${label} с точностью ±10%.`);
  return warnings;
}
export function generateMenu(items, input, { variant = 0, replaceIndex = null, current = null } = {}) {
  const profile = normalizeProfile(input);
  const slots = ['Завтрак', 'Обед', 'Ужин'];
  if (profile.meals >= 4) slots.splice(2, 0, 'Перекус');
  if (profile.meals === 5) slots.push('Перекус');
  const available = items.filter(recipe => eligibleRecipe(recipe, profile));
  let beam = [{ meals: [], totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, rank: 0 }];
  for (let index = 0; index < slots.length; index++) {
    let candidates = available.filter(recipe => recipe.category === slots[index]);
    if (current && replaceIndex === index) candidates = candidates.filter(recipe => recipe.id !== current[index]?.recipe.id);
    if (!candidates.length) return { profile, meals: [], totals: null, error: `Для приёма «${slots[index]}» нет ${replaceIndex === index ? 'другой подходящей' : 'подходящей'} еды. Измените ограничения или время приготовления.` };
    const preferred = profile.liked.toLocaleLowerCase('ru').split(/[,;\n]/u).map(s => s.trim()).filter(Boolean);
    candidates.sort((a, b) => {
      const selectedDelta = (profile.likedFoods || []).filter(id => b.components?.some(([foodId]) => foodId === id)).length - (profile.likedFoods || []).filter(id => a.components?.some(([foodId]) => foodId === id)).length;
      const preferenceDelta = selectedDelta || preferred.filter(word => preferenceMatch(b.ingredients.join(' ').toLocaleLowerCase('ru'), word)).length - preferred.filter(word => preferenceMatch(a.ingredients.join(' ').toLocaleLowerCase('ru'), word)).length;
      const ratio = profile.protein / profile.kcal;
      return preferenceDelta || Math.abs(a.protein / a.kcal - ratio) - Math.abs(b.protein / b.kcal - ratio);
    });
    const favored = candidates.slice(0, 8);
    const ratio = profile.protein / profile.kcal;
    const matched = [...candidates].sort((a, b) => Math.abs(a.protein / a.kcal - ratio) - Math.abs(b.protein / b.kcal - ratio));
    candidates = [...new Map([...favored, ...matched].map(recipe => [recipe.id, recipe])).values()].slice(0, 16);
    const next = [];
    for (const partial of beam) {
      const fixed = current && replaceIndex !== null && index !== replaceIndex ? current[index] : null;
      const choices = fixed ? [fixed] : candidates.flatMap(recipe => [0.75, 1, 1.25, 1.5, 2].map(portions => ({ recipe, portions, slot: slots[index] })));
      for (const meal of choices) {
        if (partial.meals.some(entry => entry.recipe.id === meal.recipe.id)) continue;
        if (!eligibleRecipe(meal.recipe, profile)) continue;
        const meals = [...partial.meals, meal];
        const n = mealNutrition(meal.recipe, meal.portions);
        const totals = { kcal: Math.round((partial.totals.kcal + n.kcal) * 10) / 10, protein: Math.round((partial.totals.protein + n.protein) * 10) / 10, fat: Math.round((partial.totals.fat + n.fat) * 10) / 10, carbs: Math.round((partial.totals.carbs + n.carbs) * 10) / 10 };
        const fraction = (index + 1) / slots.length;
        const interim = score(totals, { protein: profile.protein * fraction, kcal: profile.kcal * fraction, fat: profile.fat === null ? null : profile.fat * fraction, carbs: profile.carbs === null ? null : profile.carbs * fraction });
        const repeats = meals.length - new Set(meals.map(entry => entry.recipe.id)).size;
        next.push({ meals, totals, rank: interim + repeats * 0.18 });
      }
    }
    next.sort((a, b) => a.rank - b.rank);
    beam = next.slice(0, 60);
  }
  const unique = [...new Map(beam.map(entry => [entry.meals.map(meal => `${meal.recipe.id}:${meal.portions}`).join('|'), entry])).values()];
  unique.sort((a, b) => (score(a.totals, profile) + (a.meals.length - new Set(a.meals.map(m => m.recipe.id)).size) * 0.18) - (score(b.totals, profile) + (b.meals.length - new Set(b.meals.map(m => m.recipe.id)).size) * 0.18));
  if (!unique.length) return { profile, meals: [], totals: null, error: 'Не удалось составить меню с выбранными ограничениями.' };
  const chosen = unique[((variant % Math.min(unique.length, 12)) + Math.min(unique.length, 12)) % Math.min(unique.length, 12)];
  return { profile, meals: chosen.meals, totals: chosen.totals, warnings: nutritionWarnings(chosen.totals, profile) };
}

export function replacementOptions(items, month, dayIndex, mealIndex, { limit = Infinity } = {}) {
  const day = month.days?.[dayIndex];
  const original = day?.meals?.[mealIndex];
  if (!Number.isInteger(dayIndex) || !Number.isInteger(mealIndex) || !original) throw new Error('Выберите существующее блюдо в меню.');
  const profile = normalizeProfile(month.profile);
  const used = new Set(month.days.flatMap(entry => entry.meals.map(meal => meal.recipe.id)));
  const fixed = day.meals.filter((_, index) => index !== mealIndex);
  const targetProtein = mealNutrition(original.recipe, original.portions).protein;
  const options = [];
  const considered = new Set();
  for (const recipe of items) {
    if (considered.has(recipe.id) || used.has(recipe.id) || recipe.category !== original.slot || !eligibleRecipe(recipe, profile)) continue;
    considered.add(recipe.id);
    const baseProtein = ingredientRows(recipe.components).reduce((sum, row) => sum + row.protein, 0);
    if (baseProtein <= 0) continue;
    const idealPortions = targetProtein / baseProtein;
    if (idealPortions < 0.749 || idealPortions > 2.001) continue;
    // Ingredient masses round to 0.1 g. Search around the ideal scale so the
    // actual ingredient calculation retains exactly the displayed protein.
    let best = null;
    for (let step = 0; step <= 20; step++) {
      const offset = step === 0 ? 0 : Math.ceil(step / 2) * 0.0001 * (step % 2 ? -1 : 1);
      const portions = Math.round((idealPortions + offset) * 10000) / 10000;
      if (portions < 0.75 || portions > 2 || mealNutrition(recipe, portions).protein !== targetProtein) continue;
      const meal = { recipe, portions, slot: original.slot };
      const totals = sumNutrition([...fixed, meal]);
      const rank = score(totals, profile);
      if (!best || rank < best.rank) best = { meal, totals, rank, warnings: nutritionWarnings(totals, profile) };
    }
    if (best) options.push(best);
  }
  options.sort((a, b) => a.rank - b.rank);
  return options.slice(0, limit);
}

export function replaceMeal(items, month, dayIndex, mealIndex, { random = Math.random } = {}) {
  const options = replacementOptions(items, month, dayIndex, mealIndex);
  if (!options.length) throw new Error('Других подходящих блюд с тем же количеством белка и без повторов в месяце нет. Текущее блюдо сохранено.');
  // Randomize recommendations while keeping calories near the user's goal
  // whenever the catalog permits it. Protein already matches exactly.
  const withinCalories = options.filter(option => Math.abs(option.totals.kcal - month.profile.kcal) <= month.profile.kcal * 0.1);
  const pool = (withinCalories.length ? withinCalories : options).slice(0, 10);
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Не удалось подобрать случайную замену. Попробуйте ещё раз.');
  const choice = pool[Math.floor(draw * pool.length)];
  const days = month.days.map((day, index) => index === dayIndex ? {
    ...day,
    meals: day.meals.map((meal, mealPosition) => mealPosition === mealIndex ? choice.meal : meal),
    totals: choice.totals,
    warnings: choice.warnings
  } : day);
  return { ...month, days };
}
export function scaledIngredients(recipe, portions) {
  return ingredientLines(recipe.components, portions);
}

export function generateMonth(items, input, { variant = 0 } = {}) {
  const profile = normalizeProfile(input);
  const used = new Set();
  const days = [];
  for (let day = 0; day < 30; day++) {
    const menu = generateMenu(items.filter(recipe => !used.has(recipe.id)), profile, { variant: variant + day });
    if (menu.error) return { profile, days: [], error: `Не хватает разных блюд на 30 дней: день ${day + 1}. ${menu.error} Готовое меню не сохранено.` };
    // No duplicate dish is allowed even within the same day.
    const seen = new Set();
    if (menu.meals.some(meal => seen.has(meal.recipe.id) || !seen.add(meal.recipe.id))) return { profile, days: [], error: 'Недостаточно уникальных блюд для выбранных настроек.' };
    menu.meals.forEach(meal => used.add(meal.recipe.id));
    days.push(menu);
  }
  return { profile, days };
}
