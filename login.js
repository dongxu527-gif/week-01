(function () {
  const cfg = window.ZHONGAN_SUPABASE;
  const client = supabase.createClient(cfg.url, cfg.key);
  const form = document.getElementById('login-form');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const error = document.getElementById('login-error');
  const button = document.getElementById('login-btn');

  client.auth.getSession().then(function (result) {
    if (result.data && result.data.session) {
      window.location.replace(nextPage());
    }
  });

  function nextPage() {
    const next = new URLSearchParams(window.location.search).get('next');
    return ['inspection.html', 'proposal.html', 'knowledge.html'].includes(next) ? next : 'inspection.html';
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    error.textContent = '';
    const emailValue = email.value.trim();
    const passwordValue = password.value;

    if (!emailValue || !passwordValue) {
      error.textContent = '请填写邮箱和密码。';
      return;
    }

    button.disabled = true;
    button.textContent = '登录中…';

    const result = await client.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue
    });

    if (result.error) {
      error.textContent = '登录失败：邮箱或密码不对。';
      button.disabled = false;
      button.textContent = '登录';
      return;
    }

    window.location.replace(nextPage());
  });
})();
