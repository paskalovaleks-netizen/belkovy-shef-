import { foods } from './foods.js';
import { calculateNutrition } from './nutrition.js';
// Средние значения на 100 г готового продукта: вода при готовке меняет концентрацию БЖУ.
export const photoFoods = {
  ...foods,
  'cooked-chicken': ['Куриное филе готовое, без добавленного масла', 31, 3.6, 0],
  'cooked-turkey': ['Индейка готовая, без добавленного масла', 29, 3, 0],
  'cooked-rabbit': ['Кролик готовый, без добавленного масла', 29, 8, 0],
  'cooked-beef': ['Говядина готовая, без добавленного масла', 27, 12, 0],
  'cooked-pork': ['Свинина готовая, без добавленного масла', 27, 10, 0],
  'cooked-salmon': ['Лосось готовый, без добавленного масла', 23, 13, 0],
  'cooked-cod': ['Треска готовая, без добавленного масла', 23, 1, 0],
  'cooked-rice': ['Рис варёный', 2.7, 0.3, 28],
  'cooked-buckwheat': ['Гречка варёная', 3.4, 0.6, 20],
  'cooked-quinoa': ['Киноа варёная', 4.4, 1.9, 21],
  'cooked-bulgur': ['Булгур варёный', 3.1, 0.2, 19],
  'cooked-oats': ['Овсяная каша на воде', 2.5, 1.5, 12]
};
export function calculatePhotoNutrition(entries) {
  if (!entries.length || entries.some(entry => !photoFoods[entry.foodId] || !Number.isFinite(Number(entry.grams)) || Number(entry.grams) < 0.1 || Number(entry.grams) > 3000)) throw new Error('Выберите каждый продукт и укажите его массу от 0,1 до 3000 г.');
  return calculateNutrition(entries.map(entry => [entry.foodId, Number(entry.grams)]), 1, photoFoods);
}
