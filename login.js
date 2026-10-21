(function () {
  const cfg = window.ZHONGAN_SUPABASE;
  const client = supabase.createClient(cfg.url, cfg.key);
  const form = document.getElementById('login-form');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const error = document.getElementById('login-error');
  const button = document.getElementById('login-btn');
  const togglePassword = document.getElementById('toggle-password');
  const showReset = document.getElementById('show-reset');
  const resetPanel = document.getElementById('reset-panel');
  const resetEmail = document.getElementById('reset-email');
  const sendReset = document.getElementById('send-reset');
  const resetStatus = document.getElementById('reset-status');
  const backLogin = document.getElementById('back-login');
  const newPasswordPanel = document.getElementById('new-password-panel');
  const newPassword = document.getElementById('new-password');
  const updatePassword = document.getElementById('update-password');
  const newPasswordStatus = document.getElementById('new-password-status');

  const recoveryLink = window.location.hash.indexOf('type=recovery') !== -1 || window.location.search.indexOf('type=recovery') !== -1;

  client.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') {
      form.hidden = true;
      resetPanel.hidden = true;
      newPasswordPanel.hidden = false;
    }
  });

  client.auth.getSession().then(function (result) {
    if (result.data && result.data.session && !recoveryLink) {
      window.location.replace(nextPage());
    }
  });

  function nextPage() {
    const next = new URLSearchParams(window.location.search).get('next');
    return ['inspection.html', 'proposal.html', 'knowledge.html', 'admin.html'].includes(next) ? next : 'inspection.html';
  }

  togglePassword.addEventListener('click', function () {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    togglePassword.textContent = show ? '隐藏' : '显示';
  });

  showReset.addEventListener('click', function () {
    resetPanel.hidden = false;
    resetEmail.value = email.value.trim();
    resetStatus.textContent = '';
    resetEmail.focus();
  });

  backLogin.addEventListener('click', function () {
    resetPanel.hidden = true;
  });

  sendReset.addEventListener('click', async function () {
    const target = resetEmail.value.trim();
    resetStatus.textContent = '';
    if (!target) {
      resetStatus.textContent = '请先填写邮箱。';
      return;
    }
    sendReset.disabled = true;
    sendReset.textContent = '发送中…';
    const redirectTo = window.location.href.split('?')[0].split('#')[0];
    const result = await client.auth.resetPasswordForEmail(target, { redirectTo: redirectTo });
    sendReset.disabled = false;
    sendReset.textContent = '发送重置邮件';
    if (result.error) {
      resetStatus.textContent = '发送失败：' + result.error.message;
      return;
    }
    resetStatus.textContent = '如果这个邮箱已开通账号，重置邮件已经发出，请查收（含垃圾箱）。';
  });

  updatePassword.addEventListener('click', async function () {
    const value = newPassword.value;
    newPasswordStatus.textContent = '';
    if (value.length < 6) {
      newPasswordStatus.textContent = '密码至少 6 位。';
      return;
    }
    updatePassword.disabled = true;
    updatePassword.textContent = '保存中…';
    const result = await client.auth.updateUser({ password: value });
    updatePassword.disabled = false;
    updatePassword.textContent = '保存新密码';
    if (result.error) {
      newPasswordStatus.textContent = '保存失败：' + result.error.message;
      return;
    }
    newPasswordStatus.textContent = '密码已更新，正在进入系统…';
    window.setTimeout(function () {
      window.location.replace('inspection.html');
    }, 800);
  });

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
