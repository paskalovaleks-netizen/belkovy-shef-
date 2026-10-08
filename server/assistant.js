import { normalizeProfile } from '../src/planner.js';
const schema = {
  type: 'object', additionalProperties: false, required: ['message', 'profile'], properties: {
    message: { type: 'string' }, profile: { type: 'object', additionalProperties: false,
      required: ['goal', 'protein', 'kcal', 'meals', 'maxTime', 'diet', 'liked', 'excluded', 'allergens'], properties: {
        goal: { type: 'string', enum: ['lose', 'maintain', 'gain'] }, protein: { type: 'integer' }, kcal: { type: 'integer' }, meals: { type: 'integer' }, maxTime: { type: 'integer' },
        diet: { type: 'string', enum: ['all', 'vegetarian', 'vegan'] }, liked: { type: 'string' }, excluded: { type: 'string' },
        allergens: { type: 'array', items: { type: 'string', enum: ['dairy', 'eggs', 'fish', 'nuts', 'soy', 'gluten'] } }
      }
    }
  }
};
export function createAssistantHandler({ apiKey = process.env.CHEF_AI_KEY, model = process.env.CHEF_AI_MODEL || 'gpt-4.1-mini', fetchImpl = fetch } = {}) {
  const requests = new Map();
  return async function handler(req, res, next = () => { res.writeHead(404); res.end(); }) {
    const route = req.url?.split('?')[0];
    if (route !== '/api/assistant' && route !== '/api/assistant/status') { next(); return; }
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && route.endsWith('/status')) { send(200, { available: Boolean(apiKey) }); return; }
    if (req.method !== 'POST' || route.endsWith('/status')) { send(405, { error: 'Метод не поддерживается.' }); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { send(403, { error: 'Запрос разрешён только из приложения.' }); return; } }
      catch { send(403, { error: 'Некорректный источник запроса.' }); return; }
    }
    if (!apiKey) { send(503, { error: 'ИИ-диалог ещё не подключён. Заполните пожелания в форме: меню на 30 дней работает без API. Для ИИ нужен серверный ключ CHEF_AI_KEY.' }); return; }
    if (!req.headers['content-type']?.includes('application/json')) { send(415, { error: 'Ожидается JSON.' }); return; }
    const now = Date.now();
    for (const [ip, times] of requests) if (times.every(time => time < now - 60000)) requests.delete(ip);
    const ip = req.socket.remoteAddress || 'unknown';
    const recent = (requests.get(ip) || []).filter(time => time > now - 60000);
    if (recent.length >= 8 || requests.size > 1000) { send(429, { error: 'Слишком много сообщений. Попробуйте через минуту.' }); return; }
    requests.set(ip, [...recent, now]);
    let data;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 16000) { send(413, { error: 'Сообщение слишком большое.' }); return; } chunks.push(chunk); }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000) throw new Error();
      data.profile = normalizeProfile(data.profile);
    } catch { send(400, { error: 'Проверьте сообщение и настройки питания.' }); return; }
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ model, max_completion_tokens: 1200, messages: [
          { role: 'system', content: 'Ты помощник повара «Белковый шеф». Общайся по-русски. Извлеки пищевые пожелания пользователя в профиль. Не составляй рецепты: локальный алгоритм создаёт 30 дней без повторов. Не обещай точные КБЖУ. Сохраняй все текущие настройки, если пользователь их не меняет. Любимые и исключённые продукты записывай через запятую в именительном падеже (курица, рыба, морковь). Аллергии и запреты важнее предпочтений. Не назначай медицинскую диету или автоматическую калорийность. Если белок или калории не указаны, попроси их уточнить в message, сохраняя текущие значения. Диапазоны: protein 20..300 г, kcal 1000..4000, meals 3..5, maxTime 5..90 минут. Не считай, что месяц может содержать одинаковые блюда.' },
          { role: 'user', content: JSON.stringify({ currentProfile: data.profile, request: data.message }) }
        ], response_format: { type: 'json_schema', json_schema: { name: 'chef_preferences', strict: true, schema } } })
      });
      if (!response.ok) { send(502, { error: 'Сервис ИИ не ответил успешно. Проверьте серверный ключ, доступ и лимит API. Форма продолжает работать.' }); return; }
      const output = await response.json();
      const result = JSON.parse(output.choices?.[0]?.message?.content || '{}');
      const profile = normalizeProfile(result.profile);
      if (typeof result.message !== 'string') throw new Error();
      send(200, { message: result.message.slice(0, 2000), profile });
    } catch { send(502, { error: 'Не удалось получить корректный ответ ИИ. Попробуйте ещё раз или заполните форму.' }); }
  };
}
