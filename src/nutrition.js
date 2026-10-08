import { foods } from './foods.js';
export const roundNutrition = value => Math.round((value + 1e-8) * 10) / 10;
export function ingredientRows(components, portions = 1, database = foods) {
  if (!Number.isFinite(portions) || portions <= 0) throw new Error('Некорректный размер порции.');
  return components.map(([id, baseGrams]) => {
    if (!database[id] || !Number.isFinite(baseGrams) || baseGrams <= 0) throw new Error('Неизвестный продукт или некорректная масса.');
    const [name, p, f, c] = database[id];
    const grams = roundNutrition(baseGrams * portions);
    const protein = p * grams / 100, fat = f * grams / 100, carbs = c * grams / 100;
    return { id, name, grams, protein, fat, carbs, kcal: protein * 4 + fat * 9 + carbs * 4 };
  });
}
export function calculateNutrition(components, portions = 1, database = foods) {
  const totals = { protein: 0, fat: 0, carbs: 0, kcal: 0 };
  for (const row of ingredientRows(components, portions, database)) for (const key of Object.keys(totals)) totals[key] += row[key];
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundNutrition(value)]));
}
export function ingredientLines(components, portions = 1) {
  return ingredientRows(components, portions).map(row => `${row.name} — ${row.grams} г`);
}
