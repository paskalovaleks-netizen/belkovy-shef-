import { photoFoods } from '../src/photo-foods.js';
const schema = { type: 'object', additionalProperties: false, required: ['message', 'ingredients'], properties: {
  message: { type: 'string' }, ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'foodId', 'gramsEstimate', 'uncertainty'], properties: {
    name: { type: 'string' }, foodId: { type: ['string', 'null'], enum: [...Object.keys(photoFoods), null] }, gramsEstimate: { type: 'number' }, uncertainty: { type: 'string', enum: ['low', 'medium', 'high'] }
  } } }
} };
export function validatePhoto(image) {
  if (typeof image !== 'string' || image.length > 1500000) throw new Error('Слишком большой или некорректный снимок.');
  const match = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error('Поддерживаются JPEG, PNG и WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length < 32) throw new Error('Файл не похож на поддерживаемое изображение.');
  return image;
}
export function createPhotoHandler({ apiKey = process.env.CHEF_AI_KEY, model = process.env.CHEF_AI_MODEL || 'gpt-4.1-mini', fetchImpl = fetch } = {}) {
  const requests = new Map();
  return async (req, res, next = () => { res.writeHead(404); res.end(); }) => {
    if (req.url?.split('?')[0] !== '/api/food-photo') { next(); return; }
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'POST') { send(405, { error: 'Используйте POST.' }); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { send(403, { error: 'Запрос разрешён только из приложения.' }); return; } }
      catch { send(403, { error: 'Некорректный источник запроса.' }); return; }
    }
    if (!apiKey) { send(503, { error: 'Распознавание фото ещё не подключено. Нужен серверный ключ CHEF_AI_KEY. Пока можно выбрать продукты на снимке вручную.' }); return; }
    if (!req.headers['content-type']?.includes('application/json')) { send(415, { error: 'Ожидается JSON.' }); return; }
    const now = Date.now();
    for (const [ip, values] of requests) if (values.every(time => time < now - 60000)) requests.delete(ip);
    const ip = req.socket.remoteAddress || 'unknown';
    const recent = (requests.get(ip) || []).filter(time => time > now - 60000);
    if (recent.length >= 5 || requests.size > 1000) { send(429, { error: 'Слишком много снимков. Подождите минуту.' }); return; }
    requests.set(ip, [...recent, now]);
    let input;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1600000) { send(413, { error: 'Снимок слишком большой.' }); return; } chunks.push(chunk); }
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      validatePhoto(input.image);
      if (input.totalWeight !== null && input.totalWeight !== undefined && (!Number.isFinite(input.totalWeight) || input.totalWeight < 0.1 || input.totalWeight > 3000)) throw new Error('Масса блюда должна быть от 0,1 до 3000 г.');
    } catch (error) { send(400, { error: error.message === 'Масса блюда должна быть от 0,1 до 3000 г.' ? error.message : 'Некорректное фото или масса блюда.' }); return; }
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ model, max_completion_tokens: 2000, messages: [
          { role: 'system', content: `Ты помощник повара. Распознай еду на фотографии и предложи отдельные ингредиенты из справочника: ${JSON.stringify(Object.fromEntries(Object.entries(photoFoods).map(([id, values]) => [id, values[0]])))}. Не рассчитывай белок и КБЖУ сам: их посчитает приложение. Для готовой еды выбирай cooked-* для мяса, рыбы и круп, не сырые продукты или сухую крупу. Овощи и молочные продукты сопоставляй с подходящими названиями. Нельзя достоверно определить массу и скрытые ингредиенты по снимку. gramsEstimate — только предположение, uncertainty указывай честно. Если пользователь указал массу блюда, распределяй её между видимыми ингредиентами приблизительно, не выдавай их веса за измерение. Обязательно попроси проверить веса, масло и соусы в message. Не добавляй масло или соус, если не видны: попроси уточнить. Если продукт нельзя сопоставить, foodId null. Если фото не содержит еды, ingredients пустой и понятное сообщение по-русски. Не придумывай продукты для неразличимого снимка.` },
          { role: 'user', content: [{ type: 'text', text: input.totalWeight ? `Известная масса блюда без тарелки: ${input.totalWeight} г.` : 'Масса блюда неизвестна. Все веса должны быть помечены как предположение.' }, { type: 'image_url', image_url: { url: input.image, detail: 'low' } }] }
        ], response_format: { type: 'json_schema', json_schema: { name: 'food_photo', strict: true, schema } } })
      });
      if (!response.ok) {
        if (response.status === 401) { send(503, { code: 'ai_key_rejected', error: 'Сервис распознавания отклонил настроенный ключ API (401). Замените CHEF_AI_KEY в настройках среды и перезапустите сервер. Пока доступен ручной расчёт.' }); return; }
        if (response.status === 429) { send(503, { code: 'ai_limit', error: 'У сервиса ИИ исчерпан лимит или слишком много запросов. Проверьте лимиты API; пока доступен ручной расчёт.' }); return; }
        send(502, { error: 'Не удалось распознать фото. Проверьте доступ к ИИ или выберите продукты вручную.' }); return;
      }
      const data = await response.json();
      const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      if (typeof result.message !== 'string' || !Array.isArray(result.ingredients) || result.ingredients.length > 20) throw new Error();
      const ingredients = result.ingredients.map(item => {
        if (typeof item.name !== 'string' || (item.foodId !== null && !Object.hasOwn(photoFoods, item.foodId)) || !Number.isFinite(item.gramsEstimate) || item.gramsEstimate < 0.1 || item.gramsEstimate > 3000 || !['low', 'medium', 'high'].includes(item.uncertainty)) throw new Error();
        return { name: item.name.slice(0, 120), foodId: item.foodId, gramsEstimate: Math.round(item.gramsEstimate * 10) / 10, uncertainty: item.uncertainty };
      });
      send(200, { message: result.message.slice(0, 2000), ingredients });
    } catch { send(502, { error: 'ИИ не смог дать корректный состав. Попробуйте другой снимок или выберите продукты вручную.' }); }
  };
}
