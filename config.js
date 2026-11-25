/* config.js — ключи для настоящего входа. Без них всё работает в локальном режиме. */
window.ROMMY_CONFIG = {
  /* Вход через Google: создай OAuth Client ID (Web application) в Google Cloud Console,
     добавь адрес сайта в «Authorized JavaScript origins» и вставь id сюда. */
  googleClientId: '',

  /* Если когда-нибудь появится бэкенд (Supabase/Firebase) — его адрес и ключ сюда,
     форум переключится на общий сервер. Пока пусто: аккаунты и темы живут в браузере. */
  backendUrl: '',
  backendKey: '',

  /* Общий счётчик посетителей (сервис Abacus, без регистрации и ключей).
     Это имя «папки» со счётчиками; поменяешь — счёт начнётся с нуля. */
  counterNamespace: 'rommy-tech-site'
};
