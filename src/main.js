import './style.css';
import { mountPhotoAnalyzer } from './photo-ui.js';
import { nutritionTable } from './planner-ui.js';
import { recipes as originalRecipes, filterRecipes } from './recipes.js';
import { extraRecipes } from './catalog.js';
import { mountPlanner } from './planner-ui.js';
import { mountPhoneOptions } from './mobile-ui.js';
const recipes = [...originalRecipes, ...extraRecipes];

let favorites = [];
try {
  const stored = JSON.parse(localStorage.getItem('chef-favorites') || '[]');
  if (Array.isArray(stored)) favorites = stored.filter(id => recipes.some(recipe => recipe.id === id));
} catch { /* Storage can be unavailable; favorites still work for this session. */ }
const state = { query: '', category: 'Все', quick: false, highProtein: false, favoritesOnly: false, favorites };
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const app = document.querySelector('#app');
app.innerHTML = `
  <header class="header"><a class="brand" href="#" aria-label="Белковый шеф — главная"><span class="brand-icon">б.</span>белковый шеф<span class="brand-dot">●</span></a><nav aria-label="Основная навигация"><a class="nav-active" href="#personal-menu">Моё меню</a><a href="#recipes">Рецепты</a><a href="#food-photo">Фото еды</a><button id="favorites-nav">${heart}<span>Избранное</span><span id="favorite-count">0</span></button></nav></header>
  <main>
    <section id="personal-menu"></section>
    <section id="food-photo"></section>
    <section id="phone-app"></section>
    <section class="hero"><div class="hero-copy"><p class="eyebrow"><span></span> ВКУСНО. ПРОСТО. С ПОЛЬЗОЙ.</p><h1>Больше белка.<br>Больше <em>вкуса.</em></h1><p class="intro">Еда, которая заботится о тебе.<br>Простые рецепты с понятным составом<br>и КБЖУ на каждую порцию.</p><a class="primary" href="#recipes">Найти свой рецепт <span>↗</span></a><div class="hero-note"><span class="mini-avatars">🥑 🍋 🥦</span><span>Обычные продукты.<br><strong>Необыкновенно вкусно.</strong></span></div></div><div class="hero-art" role="img" aria-label="Иллюстрация тарелки с зеленью, курицей, авокадо и томатами"><div class="art-circle"></div><div class="plate"><div class="greens">🥬</div><div class="avocado">🥑</div><div class="tomatoes">🍅</div><div class="chicken">🍗</div><div class="lemon">🍋</div></div><div class="floating protein-label"><span>💪</span><div><strong>${recipes.find(recipe => recipe.id === 'bowl').protein} г белка</strong><small>в одной порции</small></div></div><div class="floating time-label">◷ <strong>25 минут</strong><small>и обед готов</small></div><span class="art-spark spark-one">✳</span><span class="art-spark spark-two">✳</span><span class="art-caption">Хорошая еда — хорошее настроение</span></div></section>
    <section class="catalog" id="recipes"><div class="catalog-heading"><div><p class="eyebrow">ТВОЁ МЕНЮ НА КАЖДЫЙ ДЕНЬ</p><h2>Что приготовим?</h2></div><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Рецепт или ингредиент" aria-label="Поиск рецептов или ингредиентов"></label></div><div class="filter-row"><div class="categories" role="group" aria-label="Тип приёма пищи">${['Все', 'Завтрак', 'Обед', 'Ужин', 'Перекус'].map((category, i) => `<button data-category="${category}" class="chip ${i === 0 ? 'active' : ''}" aria-pressed="${i === 0}">${category}</button>`).join('')}</div><div class="extra-filters"><label><input type="checkbox" id="quick"> До 20 минут</label><label><input type="checkbox" id="protein"> От 30 г белка</label></div></div><div class="result-bar"><p id="result-count" role="status" aria-live="polite"></p><button id="reset" hidden>Сбросить фильтры</button></div><div id="grid" class="grid"></div><p class="nutrition-note">КБЖУ указаны на одну порцию и являются ориентировочными. Значения зависят от марки продуктов, их массы и способа приготовления.</p></section>
    <section class="banner"><span>🌿</span><div><h2>Забота о себе начинается с тарелки.</h2><p>Готовь в удовольствие, ешь разнообразно и находи свои любимые сочетания.</p></div><span class="banner-star">✳</span></section>
  </main><footer><a class="brand" href="#">белковый шеф<span class="brand-dot">●</span></a><span>Простые рецепты. Хорошие привычки.</span><span>Сделано с заботой ♡</span></footer>
  <dialog id="recipe-dialog"><button class="close" aria-label="Закрыть рецепт">×</button><div id="recipe-content"></div></dialog>`;

function nutrition(recipe) {
  return `<div class="nutrition" aria-label="КБЖУ на одну порцию"><div><strong>${recipe.kcal}</strong><span>ккал</span></div><div class="protein"><strong>${recipe.protein} г</strong><span>белки</span></div><div><strong>${recipe.fat} г</strong><span>жиры</span></div><div><strong>${recipe.carbs} г</strong><span>углеводы</span></div></div>`;
}
function render() {
  const matches = filterRecipes(recipes, state);
  document.querySelector('#grid').innerHTML = matches.length ? matches.map(recipe => `<article class="card"><div class="card-art" style="--card-color:${recipe.color}"><span class="food-emoji" aria-hidden="true">${recipe.emoji}</span><span class="category-label">${recipe.category}</span><button class="favorite ${state.favorites.includes(recipe.id) ? 'saved' : ''}" data-favorite="${recipe.id}" aria-label="${state.favorites.includes(recipe.id) ? 'Удалить из избранного' : 'Добавить в избранное'}: ${recipe.title}" aria-pressed="${state.favorites.includes(recipe.id)}">${heart}</button><span class="time">◷ ${recipe.time} мин</span></div><div class="card-body"><button class="recipe-title" data-recipe="${recipe.id}">${recipe.title}<span aria-hidden="true">↗</span></button><p class="portion">КБЖУ · на одну порцию</p>${nutrition(recipe)}</div></article>`).join('') : '<div class="empty"><span>🥣</span><h3>Пока ничего не нашлось</h3><p>Попробуйте другой ингредиент или сбросьте фильтры.</p></div>';
  document.querySelector('#result-count').textContent = `${state.favoritesOnly ? 'Избранное · ' : ''}Найдено рецептов: ${matches.length}`;
  document.querySelector('#favorite-count').textContent = state.favorites.length;
  document.querySelector('#favorites-nav').classList.toggle('selected', state.favoritesOnly);
  document.querySelector('#favorites-nav').setAttribute('aria-pressed', state.favoritesOnly);
  document.querySelector('#reset').hidden = !(state.query || state.category !== 'Все' || state.quick || state.highProtein || state.favoritesOnly);
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = button.dataset.category === state.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
}
function openRecipe(id) {
  const recipe = recipes.find(item => item.id === id);
  if (!recipe) return;
  document.querySelector('#recipe-content').innerHTML = `<div class="dialog-art" style="background:${recipe.color}">${recipe.emoji}</div><p class="eyebrow">${recipe.category} · ${recipe.time} МИН · 1 ПОРЦИЯ</p><h2>${recipe.title}</h2><p>${recipe.description}</p>${nutrition(recipe)}${nutritionTable(recipe)}<h3>Ингредиенты</h3><ul>${recipe.ingredients.map(item => `<li>${item}</li>`).join('')}</ul><h3>Как приготовить</h3><ol>${recipe.steps.map(step => `<li>${step}</li>`).join('')}</ol><p class="nutrition-note">КБЖУ ориентировочные, на одну порцию.</p>`;
  document.querySelector('#recipe-dialog').showModal();
}
app.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
    try { localStorage.setItem('chef-favorites', JSON.stringify(state.favorites)); } catch { /* Keep in-memory favorites. */ }
    render();
    document.querySelector(`[data-favorite="${id}"]`)?.focus();
  }
  const recipeButton = event.target.closest('[data-recipe]');
  if (recipeButton) openRecipe(recipeButton.dataset.recipe);
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) { state.category = categoryButton.dataset.category; render(); }
});
document.querySelector('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
document.querySelector('#quick').addEventListener('change', event => { state.quick = event.target.checked; render(); });
document.querySelector('#protein').addEventListener('change', event => { state.highProtein = event.target.checked; render(); });
document.querySelector('#favorites-nav').addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; render(); document.querySelector('#recipes').scrollIntoView({ behavior: 'smooth' }); });
document.querySelector('#reset').addEventListener('click', () => {
  Object.assign(state, { query: '', category: 'Все', quick: false, highProtein: false, favoritesOnly: false });
  document.querySelector('#search').value = '';
  document.querySelector('#quick').checked = false;
  document.querySelector('#protein').checked = false;
  render();
});
const dialog = document.querySelector('#recipe-dialog');
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
render();

mountPlanner(document.querySelector('#personal-menu'), recipes, openRecipe);

mountPhotoAnalyzer(document.querySelector('#food-photo'));
mountPhoneOptions(document.querySelector('#phone-app'));
