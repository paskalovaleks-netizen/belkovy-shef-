import { foods } from './foods.js';
import { calculateNutrition, ingredientLines } from './nutrition.js';
// Approximate nutrition per 100 g, consistently applied to each ingredient.

function create(id, title, category, time, components, steps, emoji) {
  const result = { id, title, category, time, components, ingredients: ingredientLines(components), steps, emoji, color: category === 'Завтрак' ? '#f0e3c8' : category === 'Перекус' ? '#e8dded' : '#e1e9ce', description: 'Количество ингредиентов и КБЖУ рассчитаны на одну базовую порцию.', ...calculateNutrition(components) };
  return result;
}
export const extraRecipes = [];
for (const grain of ['oats', 'rice', 'buckwheat', 'quinoa']) {
  for (const base of ['cottage', 'yogurt', 'tofu']) {
    for (const fruit of ['apple', 'banana', 'berries', 'pear', 'peach', 'orange', 'kiwi', 'plum', 'apricot', 'cherry']) {
      const title = `${foods[grain][0]} с ${foods[base][0].toLowerCase()} и ${foods[fruit][0].toLowerCase()}`;
      extraRecipes.push(create(`breakfast-${grain}-${base}-${fruit}`, title, 'Завтрак', grain === 'rice' ? 25 : 20, [[grain, 55], [base, 170], [fruit, 100]], [
        `Промойте крупу при необходимости. Сварите ${foods[grain][0].toLowerCase()} в воде по инструкции на упаковке.`,
        `Подготовьте ${foods[fruit][0].toLowerCase()}: вымойте, очистите при необходимости и нарежьте.`,
        `Дайте каше немного остыть, добавьте ${foods[base][0].toLowerCase()} и фрукты. Разомните тофу или творог для более нежной текстуры.`
      ], '🥣'));
    }
  }
}
for (const protein of ['chicken', 'turkey', 'rabbit', 'beef', 'pork', 'salmon', 'cod', 'tuna', 'tofu', 'lentils', 'beans']) {
  for (const grain of ['rice', 'buckwheat', 'quinoa', 'bulgur']) {
    for (const veg of ['broccoli', 'zucchini', 'tomato', 'carrot', 'spinach', 'pepper']) {
      const category = ['rice', 'quinoa'].includes(grain) ? 'Обед' : 'Ужин';
      const title = `${foods[protein][0]} · ${foods[grain][0].replace(' сухой', '').toLowerCase()} · ${foods[veg][0].toLowerCase()}`;
      const preparation = protein === 'rabbit' ? 'Нарежьте кролика небольшими кусочками и тушите с маслом и водой до полной готовности, не менее 71 °C внутри мяса.' : ['beef', 'pork'].includes(protein) ? 'Нарежьте мясо небольшими кусочками и готовьте на сковороде с маслом до полной готовности, не менее 71 °C внутри.' : protein === 'tuna' ? 'Используйте готовый консервированный тунец без жидкости, прогрейте с овощами в конце приготовления.' : ['chicken', 'turkey'].includes(protein) ? 'Нарежьте мясо и готовьте на сковороде с маслом до полной готовности. Температура внутри должна достигнуть 74 °C.' : ['salmon', 'cod'].includes(protein) ? 'Приготовьте рыбу на сковороде с маслом до температуры в центре 63 °C.' : protein === 'tofu' ? 'Нарежьте тофу кубиками и обжарьте с маслом 5–7 минут.' : 'Используйте уже сваренные бобовые. Промойте их и прогрейте на сковороде с маслом.';
      extraRecipes.push(create(`main-${protein}-${grain}-${veg}`, title, category, protein === 'rabbit' ? 60 : ['beef', 'pork'].includes(protein) ? 40 : 30, [[protein, 180], [grain, 60], [veg, 180], ['oil', 8]], [
        `Сварите ${foods[grain][0].toLowerCase()} по инструкции на упаковке.`, preparation,
        `Нарежьте ${foods[veg][0].toLowerCase()}, добавьте к основному продукту и готовьте 5–10 минут до мягкости. При необходимости добавьте немного воды.`,
        'Подавайте с готовой крупой. Добавьте соль и перец по вкусу.'
      ], protein === 'salmon' ? '🐟' : '🍲'));
    }
  }
}
for (const base of ['cottage', 'yogurt', 'tofu']) {
  for (const fruit of ['apple', 'banana', 'berries', 'pear', 'peach', 'orange', 'kiwi', 'plum', 'apricot', 'cherry']) {
    for (const topping of ['nuts', 'seeds', 'oats', 'quinoa', 'rice', 'buckwheat']) {
      extraRecipes.push(create(`snack-${base}-${fruit}-${topping}`, `${foods[base][0]} · ${foods[fruit][0].toLowerCase()} · ${foods[topping][0].replace(' сухая', '').toLowerCase()}`, 'Перекус', ['quinoa', 'rice', 'buckwheat'].includes(topping) ? 25 : topping === 'oats' ? 10 : 5, [[base, 180], [fruit, 100], [topping, 20]], [
        ['quinoa', 'oats', 'rice', 'buckwheat'].includes(topping) ? `Сварите ${foods[topping][0].toLowerCase()} в воде по инструкции на упаковке и остудите.` : `Измельчите ${foods[topping][0].toLowerCase()}.`,
        `Вымойте и нарежьте ${foods[fruit][0].toLowerCase()}.`,
        `Соедините ${foods[base][0].toLowerCase()}, фрукты и подготовленную добавку. Тофу предварительно разомните вилкой.`
      ], '🍨'));
    }
  }
}
