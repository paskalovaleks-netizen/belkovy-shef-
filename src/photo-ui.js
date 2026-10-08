import { photoFoods, calculatePhotoNutrition } from './photo-foods.js';
const photoEscape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function mountPhotoAnalyzer(root) {
  let image = null, entries = [], requestVersion = 0, aiAvailable = false;
  root.innerHTML = `<div class="catalog-heading"><div><p class="eyebrow">БЕЛОК В ТВОЕЙ ТАРЕЛКЕ</p><h2>Сфотографируй еду</h2><p class="field-hint">Распознай продукты, проверь массу — получи расчёт белка и остальных КБЖУ.</p></div></div><div class="photo-workspace"><div class="photo-upload"><div class="photo-placeholder">📷<span>Твоя тарелка</span></div><img id="food-photo-preview" alt="Выбранный снимок блюда" hidden><div class="photo-buttons"><label class="secondary photo-file-label">Сфотографировать<input id="photo-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label class="secondary photo-file-label">Загрузить фото<input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp"></label></div><label class="photo-weight-label">Если известна масса всего блюда, г<input id="photo-total-weight" type="number" min="0.1" max="3000" step="0.1" placeholder="Без тарелки, необязательно"></label><button id="recognize-photo" class="primary" disabled>Распознать продукты на фото</button><p id="photo-availability" class="field-hint">${location.protocol === 'file:' ? 'Автораспознавание доступно в серверной версии с подключённым ИИ. Здесь можно загрузить фото и выбрать продукты вручную.' : 'Проверяю доступность распознавания…'}</p><p class="field-hint">Снимок отправится в OpenAI только по нажатию «Распознать». Он не сохраняется в приложении; фото и его история исчезают после перезагрузки страницы. На телефоне кнопка съёмки откроет камеру, если это поддерживает браузер.</p></div><div class="photo-calculation"><p id="photo-message" role="status" aria-live="polite">По одному фото невозможно точно измерить массу и узнать скрытые ингредиенты. Проверь готовый вес продуктов, добавленное масло и соусы.</p><div id="photo-ingredients"></div><div class="photo-buttons"><button id="photo-add" class="secondary">+ Добавить продукт</button><button id="photo-calculate" class="primary">Подтвердить состав и рассчитать</button></div><p id="photo-error" class="planner-error" role="alert"></p><div id="photo-result" aria-live="polite"></div></div></div>`;
  const preview = root.querySelector('#food-photo-preview');
  const button = root.querySelector('#recognize-photo');
  function clearResult() { root.querySelector('#photo-result').innerHTML = ''; root.querySelector('#photo-error').textContent = ''; }
  function renderEntries() {
    root.querySelector('#photo-ingredients').innerHTML = entries.length ? entries.map((entry, index) => `<div class="photo-ingredient"><label>Продукт ${index + 1}<select data-photo-food="${index}" aria-label="Продукт ${index + 1}"><option value="">Выбери продукт и способ приготовления</option>${Object.entries(photoFoods).map(([id, food]) => `<option value="${id}" ${entry.foodId === id ? 'selected' : ''}>${photoEscape(food[0])}</option>`).join('')}</select></label><label>Масса, г<input data-photo-grams="${index}" aria-label="Масса продукта ${index + 1}, г" type="number" min="0.1" max="3000" step="0.1" value="${entry.grams}"></label><button class="photo-remove" data-photo-remove="${index}" aria-label="Удалить продукт ${index + 1}">×</button>${entry.estimated ? `<p class="field-hint photo-estimate">ИИ предположил: ${photoEscape(entry.name)} · масса не измерена. ${entry.uncertainty === 'high' ? 'Высокая неопределённость.' : entry.uncertainty === 'medium' ? 'Средняя неопределённость.' : 'Нужна проверка состава и массы.'}</p>` : ''}</div>`).join('') : '<p class="field-hint">После распознавания здесь появятся продукты. Их также можно выбрать вручную — расчёт работает без ИИ.</p>';
    root.querySelectorAll('[data-photo-food]').forEach(select => select.addEventListener('change', () => { entries[Number(select.dataset.photoFood)].foodId = select.value; clearResult(); }));
    root.querySelectorAll('[data-photo-grams]').forEach(input => input.addEventListener('input', () => { entries[Number(input.dataset.photoGrams)].grams = input.value; clearResult(); }));
    root.querySelectorAll('[data-photo-remove]').forEach(remove => remove.addEventListener('click', () => { entries.splice(Number(remove.dataset.photoRemove), 1); clearResult(); renderEntries(); }));
  }
  async function selectImage(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const version = ++requestVersion; button.disabled = true; image = null; clearResult(); entries = []; renderEntries(); preview.hidden = true; root.querySelector('.photo-placeholder').hidden = false;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Выберите JPEG, PNG или WebP размером до 20 МБ. HEIC нужно сначала преобразовать в JPEG.');
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d'); if (!context) throw new Error('Браузер не поддерживает обработку снимка.');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const converted = canvas.toDataURL('image/jpeg', 0.82);
        if (converted.length > 1500000) throw new Error('После обработки снимок слишком большой. Выберите более простой или меньший файл.');
        if (version !== requestVersion) return;
        image = converted; preview.src = image; preview.hidden = false; root.querySelector('.photo-placeholder').hidden = true;
        root.querySelector('#photo-message').textContent = 'Фото готово. Распознай его с ИИ или выбери продукты и готовый вес вручную.';
      } finally { bitmap.close(); }
    } catch (error) { if (version === requestVersion) root.querySelector('#photo-error').textContent = error.message || 'Не удалось прочитать снимок.'; }
    finally { if (version === requestVersion) { button.disabled = !image || !aiAvailable; button.textContent = 'Распознать продукты на фото'; } event.target.value = ''; }
  }
  root.querySelector('#photo-camera').addEventListener('change', selectImage);
  root.querySelector('#photo-upload').addEventListener('change', selectImage);
  root.querySelector('#photo-add').addEventListener('click', () => { entries.push({ foodId: '', grams: 100 }); clearResult(); renderEntries(); });
  root.querySelector('#photo-total-weight').addEventListener('input', clearResult);
  button.addEventListener('click', async () => {
    if (!image || !aiAvailable) return;
    const version = ++requestVersion; button.disabled = true; button.textContent = 'Распознаю…'; clearResult();
    try {
      const rawWeight = root.querySelector('#photo-total-weight').value;
      const totalWeight = rawWeight === '' ? null : Number(rawWeight);
      if (totalWeight !== null && (!Number.isFinite(totalWeight) || totalWeight < 0.1 || totalWeight > 3000)) throw new Error('Укажите массу блюда от 0,1 до 3000 г или оставьте поле пустым.');
      const response = await fetch('/api/food-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, totalWeight }), signal: AbortSignal.timeout(35000) });
      const result = await response.json(); if (version !== requestVersion) return;
      if (!response.ok) { if (result.code === 'ai_key_rejected') { aiAvailable = false; root.querySelector('#photo-availability').textContent = 'Сервис отклонил ключ API. Автораспознавание недоступно; ручной расчёт работает.'; } throw new Error(result.error || 'Не удалось распознать фото.'); }
      entries = result.ingredients.map(item => ({ foodId: item.foodId || '', grams: item.gramsEstimate, name: item.name, uncertainty: item.uncertainty, estimated: true }));
      root.querySelector('#photo-message').textContent = result.message; renderEntries();
    } catch (error) { if (version === requestVersion) root.querySelector('#photo-error').textContent = error.message || 'Распознавание недоступно.'; }
    finally { if (version === requestVersion) { button.disabled = !image || !aiAvailable; button.textContent = 'Распознать продукты на фото'; } }
  });
  root.querySelector('#photo-calculate').addEventListener('click', () => {
    clearResult();
    try {
      const nutrition = calculatePhotoNutrition(entries);
      const mass = Math.round(entries.reduce((sum, entry) => sum + Number(entry.grams), 0) * 10) / 10;
      const known = Number(root.querySelector('#photo-total-weight').value);
      const difference = known > 0 && Math.abs(mass - known) > Math.max(1, known * 0.02);
      root.querySelector('#photo-result').innerHTML = `<div class="photo-protein-result"><span>Белок в выбранной порции</span><strong>${nutrition.protein.toLocaleString('ru-RU')} г</strong><p>Масса продуктов: ${mass.toLocaleString('ru-RU')} г</p><div class="nutrition"><div><strong>${nutrition.kcal}</strong><span>ккал</span></div><div class="protein"><strong>${nutrition.protein} г</strong><span>белки</span></div><div><strong>${nutrition.fat} г</strong><span>жиры</span></div><div><strong>${nutrition.carbs} г</strong><span>углеводы</span></div></div></div>${difference ? `<p class="plan-warning">Сумма введённых масс (${mass} г) отличается от массы блюда (${known} г). Проверьте порцию: приложение не подгоняет веса автоматически.</p>` : ''}<p class="field-hint">Ориентировочный расчёт по указанным массам и справочным БЖУ на 100 г. Если веса предложены ИИ, это оценка, а не измерение. Готовая и сырая масса имеют разные значения БЖУ; добавьте масло и соусы отдельно.</p>`;
    } catch (error) { root.querySelector('#photo-error').textContent = error.message; }
  });
  renderEntries();
  if (location.protocol !== 'file:') fetch('/api/assistant/status').then(response => response.json()).then(status => {
    aiAvailable = status.available === true;
    button.disabled = !image || !aiAvailable;
    root.querySelector('#photo-availability').textContent = aiAvailable ? 'Сервис настроен; доступ проверяется при распознавании. Проверьте продукты и массу после ответа.' : 'Автораспознавание не подключено. Можно выбрать продукты вручную; серверу нужен ключ CHEF_AI_KEY.';
  }).catch(() => { root.querySelector('#photo-availability').textContent = 'Сервер распознавания недоступен. Ручной расчёт продолжает работать.'; });
}
