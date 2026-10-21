(function () {
  function init() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const links = nav.querySelector('.nav-links');
    if (!links || nav.querySelector('.nav-toggle')) return;

    nav.classList.add('has-menu');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-label', '打开菜单');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(button);

    function close() {
      nav.classList.remove('menu-open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', '打开菜单');
    }

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      const open = nav.classList.toggle('menu-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });

    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) close();
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
