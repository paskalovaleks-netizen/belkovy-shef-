import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from '../src/recipes.js';
import { extraRecipes } from '../src/catalog.js';
import { defaultProfile, generateMonth, replacementOptions, replaceMeal, eligibleRecipe, sumNutrition, mealNutrition } from '../src/planner.js';
const catalog = [...recipes, ...extraRecipes];
const month = generateMonth(catalog, { ...defaultProfile, excludedFoods: ['pork', 'salmon'], allergens: ['eggs'], maxTime: 30 });
assert.equal(month.error, undefined);

test('random replacement candidates retain exactly the original protein, restrictions and month uniqueness', () => {
  const used = new Set(month.days.flatMap(day => day.meals.map(meal => meal.recipe.id)));
  for (const mealIndex of [0, 1, 2, 3]) {
    const original = month.days[7].meals[mealIndex];
    const target = mealNutrition(original.recipe, original.portions).protein;
    const options = replacementOptions(catalog, month, 7, mealIndex);
    assert.ok(options.length > 0);
    assert.equal(new Set(options.map(option => option.meal.recipe.id)).size, options.length);
    for (const option of options) {
      assert.equal(option.meal.slot, original.slot);
      assert.equal(option.meal.recipe.category, original.slot);
      assert.ok(eligibleRecipe(option.meal.recipe, month.profile));
      assert.ok(!used.has(option.meal.recipe.id));
      assert.equal(mealNutrition(option.meal.recipe, option.meal.portions).protein, target);
      assert.ok(option.meal.portions >= 0.75 && option.meal.portions <= 2);
    }
  }
});
test('automatic replacement changes one meal, preserves daily protein and leaves the input intact', () => {
  const before = JSON.stringify(month);
  const result = replaceMeal(catalog, month, 7, 1, { random: () => 0 });
  assert.equal(JSON.stringify(month), before);
  assert.notEqual(result.days[7].meals[1].recipe.id, month.days[7].meals[1].recipe.id);
  assert.deepEqual(result.days[7].totals, sumNutrition(result.days[7].meals));
  assert.equal(result.days[7].totals.protein, month.days[7].totals.protein);
  for (let dayIndex = 0; dayIndex < 30; dayIndex++) {
    if (dayIndex !== 7) assert.strictEqual(result.days[dayIndex], month.days[dayIndex]);
    else for (const mealIndex of [0, 2, 3]) assert.strictEqual(result.days[dayIndex].meals[mealIndex], month.days[dayIndex].meals[mealIndex]);
  }
  assert.equal(new Set(result.days.flatMap(day => day.meals.map(meal => meal.recipe.id))).size, 120);
});
test('different random draws recommend different matching dishes without a selection step', () => {
  const first = replaceMeal(catalog, month, 7, 1, { random: () => 0 });
  const last = replaceMeal(catalog, month, 7, 1, { random: () => 0.999 });
  assert.notEqual(first.days[7].meals[1].recipe.id, last.days[7].meals[1].recipe.id);
  assert.equal(first.days[7].totals.protein, last.days[7].totals.protein);
});
test('no protein match, exhausted catalog and invalid positions preserve the original menu', () => {
  const before = JSON.stringify(month);
  const existing = month.days.flatMap(day => day.meals.map(meal => meal.recipe));
  assert.deepEqual(replacementOptions(existing, month, 0, 0), []);
  assert.throws(() => replaceMeal(existing, month, 0, 0), /тем же количеством белка/);
  const tinyProtein = { ...month.days[0].meals[0].recipe, id: 'tiny-protein', components: [['apple', 10]] };
  assert.throws(() => replaceMeal([tinyProtein], month, 0, 0), /тем же количеством белка/);
  assert.throws(() => replacementOptions(catalog, month, 40, 0));
  assert.throws(() => replacementOptions(catalog, month, 0, -1));
  assert.equal(JSON.stringify(month), before);
});
test('repeated automatic replacements keep both the protein and every other meal unchanged', () => {
  let current = month;
  const target = month.days[7].totals.protein;
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = current.days[7].meals[2].recipe.id;
    current = replaceMeal(catalog, current, 7, 2, { random: () => (attempt + 1) / 5 });
    assert.notEqual(current.days[7].meals[2].recipe.id, previous);
    assert.equal(current.days[7].totals.protein, target);
    assert.equal(new Set(current.days.flatMap(day => day.meals.map(meal => meal.recipe.id))).size, 120);
  }
});
