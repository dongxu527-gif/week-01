(function () {
  window.friendlyError = function (err) {
    const raw = String(
      (err && (err.message || err.error_description || err.details || err.hint || err)) || ''
    ).trim();

    if (!raw) return '操作失败，请稍后重试。';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|network error/i.test(raw)) {
      return '网络连接失败，请检查网络后重试。';
    }
    if (/JWT|session|token|not authenticated|refresh token/i.test(raw)) {
      return '登录已过期，请重新登录。';
    }
    if (/row-level security|permission denied|42501|not authorized|insufficient privilege/i.test(raw)) {
      return '没有权限执行这个操作。';
    }
    if (/duplicate key|unique constraint|23505/i.test(raw)) {
      return '这条记录已经存在，不要重复提交。';
    }
    if (/violates check constraint|23514/i.test(raw)) {
      return '填写的内容不符合要求，请检查后再试。';
    }
    if (/Invalid login credentials/i.test(raw)) {
      return '邮箱或密码不对。';
    }
    if (/Email not confirmed/i.test(raw)) {
      return '邮箱还没有验证，请先查收验证邮件。';
    }
    if (/rate limit|too many requests|429/i.test(raw)) {
      return '操作太频繁，请稍后再试。';
    }
    return '操作失败，请稍后重试。';
  };
})();
