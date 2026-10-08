export function mountPhoneOptions(container) {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const localFile = location.protocol === 'file:' || document.documentElement.dataset.offlineFile === 'true';
  const secure = window.isSecureContext === true;
  let installPrompt = null;
  let offlineReady = false;
  let installed = standalone;
  container.innerHTML = `
    <div class="phone-card">
      <div><p class="eyebrow">ВСЕГДА ПОД РУКОЙ</p><h2>Белковый шеф на телефоне</h2>
        <p>Ваше меню, рецепты и расчёт КБЖУ — в удобном мобильном формате.</p></div>
      <div class="phone-actions"><button class="primary" id="install-app" hidden>Установить приложение</button>
        <a class="secondary" id="phone-download" href="./belkovy-shef.html" download="belkovy-shef.html">Скачать файл приложения</a>
        <a class="secondary" href="#phone-guide">Как добавить на экран</a></div>
      <p id="phone-status" role="status" aria-live="polite"></p>
      <details id="phone-guide"><summary>Установка и скачанный файл</summary>
        <p><strong>iPhone:</strong> откройте HTTPS-сайт в Safari → «Поделиться» → «На экран “Домой”» → «Добавить». Если есть переключатель «Открывать как веб-приложение», включите его.</p>
        <p><strong>Android:</strong> откройте HTTPS-сайт в Chrome и нажмите «Установить приложение», когда появится кнопка. Можно также открыть меню Chrome → «Добавить на главный экран» → «Установить».</p>
        <p><strong>Файл для скачивания:</strong> содержит меню и рецепты в одном HTML. На Android попробуйте открыть его из «Загрузок» в браузере. Если файловый просмотрщик или браузер не запускает приложение, используйте HTTPS-сайт. На iPhone обычный просмотр HTML в «Файлах» не запускает приложение; нужна установка из Safari по HTTPS-ссылке.</p>
        <p>После первого открытия сайта и готовности офлайн-версии меню и расчёт работают без интернета. Автораспознавание фото требует связи и подключённого ИИ-сервиса. Настройки и меню сохраняются на этом устройстве; TXT можно скачать из меню.</p>
      </details>
    </div>
    <nav class="phone-nav" aria-label="Навигация на телефоне">
      <a href="#personal-menu"><span aria-hidden="true">🍽</span>Меню</a>
      <a href="#food-photo"><span aria-hidden="true">📷</span>Фото еды</a>
      <a href="#recipes"><span aria-hidden="true">🥗</span>Рецепты</a>
      <a href="#phone-app"><span aria-hidden="true">📱</span>На телефон</a>
    </nav>`;
  const button = container.querySelector('#install-app');
  const status = container.querySelector('#phone-status');
  const guide = container.querySelector('#phone-guide');
  container.querySelector('a[href="#phone-guide"]').addEventListener('click', () => { guide.open = true; });
  function updateStatus() {
    if (localFile) status.textContent = 'Это скачанная версия приложения. Меню и ручной расчёт работают без сервера. Сохранение настроек зависит от поддержки браузера.';
    else if (installed) status.textContent = `Приложение открыто с главного экрана.${offlineReady ? ' Меню и рецепты готовы к работе без интернета.' : ''}`;
    else if (offlineReady) status.textContent = 'Меню и рецепты готовы к работе без интернета. Добавьте приложение на главный экран по инструкции ниже.';
    else if (secure) status.textContent = 'Чтобы сохранить иконку на телефоне, воспользуйтесь установкой или инструкцией ниже.';
    else status.textContent = 'Установка с иконкой и офлайн-версия сайта доступны по HTTPS-ссылке. Вы также можете скачать отдельный файл.';
  }
  if (localFile) container.querySelector('#phone-download').hidden = true;
  updateStatus();
  window.addEventListener('beforeinstallprompt', event => {
    if (localFile || installed) return;
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      status.textContent = choice.outcome === 'accepted'
        ? 'Запрос установки принят. Дождитесь завершения установки на телефоне.'
        : 'Можно установить позже через меню браузера. Меню и настройки доступны на этом устройстве.';
    } catch { updateStatus(); }
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    button.hidden = true;
    status.textContent = `Приложение установлено. Открывайте его с главного экрана.${offlineReady ? ' Меню и рецепты доступны без интернета.' : ''}`;
  });
  if (!localFile && secure && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      offlineReady = true;
      updateStatus();
    }).catch(() => {
      status.textContent = 'Офлайн-версию сайта пока не удалось подготовить. Приложение работает с интернетом; отдельный файл доступен для скачивания.';
    });
  }
}
