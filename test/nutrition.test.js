import test from 'node:test';
import assert from 'node:assert/strict';
import { foods, foodGroups } from '../src/foods.js';
import { calculateNutrition, ingredientRows } from '../src/nutrition.js';
import { recipes } from '../src/recipes.js';
import { extraRecipes } from '../src/catalog.js';
import { eligibleRecipe, defaultProfile, normalizeProfile, mealNutrition, sumNutrition } from '../src/planner.js';

test('oats, cottage cheese 5% and peach cannot have 74 g protein in a single stated portion', () => {
  const components = [['oats', 55], ['cottage', 170], ['peach', 100]];
  const single = calculateNutrition(components);
  assert.equal(single.protein, 37.1);
  const double = calculateNutrition(components, 2);
  assert.equal(double.protein, 74.1);
  assert.deepEqual(ingredientRows(components, 2).map(row => row.grams), [110, 340, 200]);
  assert.equal(single.carbs, 48.1);
  assert.equal(single.fat, 12.7);
});
test('all catalog nutrition comes from ingredient weights, with cooked/dry states preserved', () => {
  for (const recipe of [...recipes, ...extraRecipes]) {
    const result = calculateNutrition(recipe.components);
    for (const key of ['protein', 'fat', 'carbs', 'kcal']) assert.equal(recipe[key], result[key], recipe.id + ': ' + key);
    for (const factor of [0.75, 1, 1.25, 1.5, 2]) {
      const expected = calculateNutrition(recipe.components, factor);
      assert.deepEqual(mealNutrition(recipe, factor), expected);
      const rows = ingredientRows(recipe.components, factor);
      const rawProtein = rows.reduce((total, row) => total + foods[row.id][1] * row.grams / 100, 0);
      assert.ok(Math.abs(expected.protein - rawProtein) <= 0.051);
    }
  }
  assert.match(foods.rice[0], /сухой/);
  assert.match(foods.lentils[0], /варёная/);
  assert.match(foods.chicken[0], /сырое/);
});
test('daily totals equal the displayed meals, not rounded base macros multiplied by portions', () => {
  const recipe = extraRecipes.find(r => r.id === 'breakfast-oats-cottage-peach');
  const totals = sumNutrition([{ recipe, portions: 2 }]);
  assert.equal(totals.protein, 74.1);
  assert.notEqual(totals.protein, recipe.protein * 2);
});
test('invalid masses, unknown products and invalid portion sizes fail rather than silently undercount', () => {
  assert.throws(() => calculateNutrition([['missing', 100]]));
  assert.throws(() => calculateNutrition([['oats', -1]]));
  assert.throws(() => calculateNutrition([['oats', 100]], NaN));
});
test('all products are listed once and click-based exclusions filter exact ingredient identities', () => {
  const ids = Object.values(foodGroups).flat();
  assert.equal(ids.length, Object.keys(foods).length);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['chicken', 'rabbit', 'beef', 'pork']) {
    const recipe = extraRecipes.find(r => r.components.some(([key]) => key === id));
    assert.ok(recipe);
    assert.equal(eligibleRecipe(recipe, { ...defaultProfile, maxTime: 90, excludedFoods: [id] }), false);
    assert.equal(eligibleRecipe(recipe, { ...defaultProfile, maxTime: 90, diet: 'vegetarian' }), false);
  }
});
test('fat targets leave consistent carbohydrate calories and reject impossible combinations', () => {
  const p = normalizeProfile({ ...defaultProfile, fat: 60 });
  assert.equal(p.carbs, 245);
  assert.throws(() => normalizeProfile({ ...defaultProfile, kcal: 1000, protein: 200, fat: 100 }));
});
