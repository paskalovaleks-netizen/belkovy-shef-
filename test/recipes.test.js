import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes, filterRecipes } from '../src/recipes.js';

test('search finds ingredients regardless of case and whitespace', () => {
  assert.deepEqual(filterRecipes(recipes, { query: '  КИНОА  ' }).map(r => r.id), ['bowl']);
});
test('category, time and protein filters combine', () => {
  assert.deepEqual(filterRecipes(recipes, { category: 'Завтрак', quick: true, highProtein: true }).map(r => r.id), ['pancakes']);
});
test('favorites filter only includes selected recipes', () => {
  assert.deepEqual(filterRecipes(recipes, { favoritesOnly: true, favorites: ['yogurt'] }).map(r => r.id), ['yogurt']);
  assert.equal(filterRecipes(recipes, { favoritesOnly: true }).length, 0);
});
test('unknown search has no results, defaults include the entire catalog', () => {
  assert.equal(filterRecipes(recipes, { query: 'несуществующий ингредиент' }).length, 0);
  assert.equal(filterRecipes(recipes).length, recipes.length);
});
test('all recipes have unique IDs, complete instructions and consistent per-serving nutrition', () => {
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length);
  for (const r of recipes) {
    assert.ok(r.ingredients.length > 0 && r.steps.length > 0);
    for (const field of ['kcal', 'protein', 'fat', 'carbs', 'time']) assert.ok(Number.isFinite(r[field]) && r[field] > 0);
    assert.ok(Math.abs(r.kcal - (r.protein * 4 + r.fat * 9 + r.carbs * 4)) <= 0.9, 'Only final rounding may differ from 4/9/4');
  }
});
