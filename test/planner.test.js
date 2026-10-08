import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from '../src/recipes.js';
import { extraRecipes } from '../src/catalog.js';
import { defaultProfile, generateMonth, eligibleRecipe, scaledIngredients, normalizeProfile, sumNutrition } from '../src/planner.js';
const catalog = [...recipes, ...extraRecipes];
test('30 days have 120 unique dishes with accurate portion totals', () => {
  const result = generateMonth(catalog, defaultProfile);
  assert.equal(result.error, undefined);
  assert.equal(result.days.length, 30);
  const meals = result.days.flatMap(day => day.meals);
  assert.equal(meals.length, 120);
  assert.equal(new Set(meals.map(meal => meal.recipe.id)).size, 120);
  for (const day of result.days) {
    assert.deepEqual(day.totals, sumNutrition(day.meals));
    assert.ok(Math.abs(day.totals.protein - result.profile.protein) <= result.profile.protein * 0.1);
    assert.ok(Math.abs(day.totals.kcal - result.profile.kcal) <= result.profile.kcal * 0.1);
    assert.ok(day.meals.every(meal => eligibleRecipe(meal.recipe, result.profile)));
  }
});
test('five meals have no repeated dishes, including two snacks per day', () => {
  const result = generateMonth(catalog, { ...defaultProfile, meals: 5 });
  assert.equal(result.error, undefined);
  assert.equal(new Set(result.days.flatMap(day => day.meals.map(meal => meal.recipe.id))).size, 150);
});
test('plant-based month excludes animal foods and respects product exclusions', () => {
  const profile = { ...defaultProfile, diet: 'vegan', excluded: 'морковь', protein: 90 };
  const result = generateMonth(catalog, profile);
  assert.equal(result.error, undefined);
  for (const meal of result.days.flatMap(day => day.meals)) {
    assert.ok(eligibleRecipe(meal.recipe, profile));
    assert.doesNotMatch(meal.recipe.ingredients.join(' '), /морковь|куриц|индей|лосос|тунец|творог|йогурт|сыр|молоко|яйц/iu);
  }
});
test('impossible constraints fail explicitly and do not return an incomplete month', () => {
  const result = generateMonth(catalog, { ...defaultProfile, maxTime: 5 });
  assert.match(result.error, /Не хватает/);
  assert.deepEqual(result.days, []);
});
test('allergens, case-insensitive exclusions, invalid targets and portion scaling', () => {
  assert.equal(eligibleRecipe(recipes.find(r => r.id === 'pancakes'), { ...defaultProfile, allergens: ['dairy'] }), false);
  assert.equal(eligibleRecipe(recipes.find(r => r.id === 'salmon'), { ...defaultProfile, excluded: 'РЫБА' }), false);
  assert.equal(eligibleRecipe(recipes.find(r => r.id === 'salmon'), { ...defaultProfile, excluded: 'лосось' }), false);
  assert.throws(() => normalizeProfile({ protein: -1 }));
  assert.throws(() => normalizeProfile({ protein: 300, kcal: 1000 }));
  assert.equal(scaledIngredients(recipes[0], 1.5)[0], 'Куриное филе (сырое) — 225 г');
});
test('generated recipes have distinct names and ingredient compositions', () => {
  assert.equal(new Set(extraRecipes.map(r => r.title)).size, extraRecipes.length);
  assert.equal(new Set(extraRecipes.map(r => r.ingredients.join('|'))).size, extraRecipes.length);
});
