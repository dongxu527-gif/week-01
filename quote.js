(function () {
  const cfg = window.ZHONGAN_SUPABASE || {};
  const client = window.supabase.createClient(cfg.url, cfg.key);

  const form = document.getElementById('quote-form');
  const customer = document.getElementById('customer');
  const role = document.getElementById('role');
  const rate = document.getElementById('rate');
  const people = document.getElementById('people');
  const days = document.getElementById('days');
  const shift = document.getElementById('shift');
  const management = document.getElementById('management');
  const tax = document.getElementById('tax');
  const discount = document.getElementById('discount');
  const error = document.getElementById('error');
  const copyStatus = document.getElementById('copy-status');
  const quoteUser = document.getElementById('quote-user');
  const saveQuote = document.getElementById('save-quote');
  const printQuote = document.getElementById('print-quote');
  const historySection = document.getElementById('quote-history');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');

  const out = {
    role: document.getElementById('out-role'),
    scale: document.getElementById('out-scale'),
    shift: document.getElementById('out-shift'),
    labor: document.getElementById('out-labor'),
    management: document.getElementById('out-management'),
    tax: document.getElementById('out-tax'),
    discount: document.getElementById('out-discount'),
    total: document.getElementById('out-total')
  };

  const money = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0
  });

  let session = null;

  function numberValue(input, fallback) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function printDate() {
    const now = new Date();
    return now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
  }

  function calculate() {
    error.textContent = '';
    copyStatus.textContent = '';

    const roleName = role.value;
    const unitRate = numberValue(rate, -1);
    const headcount = numberValue(people, 0);
    const serviceDays = numberValue(days, 0);
    const shiftFactor = Number(shift.value);
    const managementRate = numberValue(management, 0);
    const taxRate = numberValue(tax, 0);
    const discountValue = numberValue(discount, 0);

    if (headcount < 1 || !Number.isInteger(headcount)) {
      error.textContent = '人数必须是大于 0 的整数。';
      return null;
    }
    if (serviceDays < 1 || !Number.isInteger(serviceDays)) {
      error.textContent = '服务天数必须是大于 0 的整数。';
      return null;
    }
    if (unitRate < 0) {
      error.textContent = '单价不能小于 0。';
      return null;
    }
    if (managementRate < 0 || managementRate > 30) {
      error.textContent = '管理费率应在 0% 到 30% 之间。';
      return null;
    }
    if (taxRate < 0 || taxRate > 20) {
      error.textContent = '税率应在 0% 到 20% 之间。';
      return null;
    }
    if (discountValue < 0) {
      error.textContent = '优惠金额不能小于 0。';
      return null;
    }

    const labor = Math.round(headcount * serviceDays * unitRate * shiftFactor);
    const managementFee = Math.round(labor * managementRate / 100);
    const taxFee = Math.round((labor + managementFee) * taxRate / 100);
    const total = Math.max(0, labor + managementFee + taxFee - Math.round(discountValue));

    const data = {
      customer: customer.value.trim(),
      roleName,
      unitRate,
      headcount,
      serviceDays,
      shiftFactor,
      managementRate,
      taxRate,
      discountValue: Math.round(discountValue),
      labor,
      managementFee,
      taxFee,
      total
    };

    out.role.textContent = roleName;
    out.scale.textContent = headcount + ' 人 × ' + serviceDays + ' 天';
    out.shift.textContent = shiftFactor.toFixed(1);
    out.labor.textContent = money.format(labor);
    out.management.textContent = money.format(managementFee);
    out.tax.textContent = money.format(taxFee);
    out.discount.textContent = '-' + money.format(data.discountValue);
    out.total.textContent = money.format(total);

    setText('print-customer', '客户：' + (data.customer || '未填写'));
    setText('print-date', '日期：' + printDate());
    setText('print-role', roleName);
    setText('print-rate', money.format(unitRate) + ' / 人 / 天');
    setText('print-people', headcount + ' 人');
    setText('print-days', serviceDays + ' 天');
    setText('print-shift', shiftFactor.toFixed(1));
    setText('print-labor', money.format(labor));
    setText('print-management', money.format(managementFee));
    setText('print-tax', money.format(taxFee));
    setText('print-discount', '-' + money.format(data.discountValue));
    setText('print-total', money.format(total));

    return data;
  }

  function quoteText(data) {
    const lines = ['中安安防 · 安保服务报价单'];
    if (data.customer) lines.push('客户：' + data.customer);
    lines.push(
      '岗位：' + data.roleName,
      '人数：' + data.headcount + ' 人',
      '天数：' + data.serviceDays + ' 天',
      '班次系数：' + data.shiftFactor.toFixed(1),
      '单价：' + money.format(data.unitRate) + '/人/天',
      '人员费用：' + money.format(data.labor),
      '管理费（' + data.managementRate + '%）：' + money.format(data.managementFee),
      '税费（' + data.taxRate + '%）：' + money.format(data.taxFee),
      '优惠：-' + money.format(data.discountValue),
      '合计：' + money.format(data.total),
      '备注：按示例单价估算，最终以现场评估和合同为准。'
    );
    return lines.join('\n');
  }

  function setLoginPrompt() {
    if (session) {
      quoteUser.textContent = session.user && session.user.email ? session.user.email : '已登录';
    } else {
      quoteUser.innerHTML = '未登录，保存报价需先登录：<a href="login.html?next=quote.html">去登录</a>';
    }
  }

  async function loadSession() {
    const result = await client.auth.getSession();
    session = result.data && result.data.session ? result.data.session : null;
    setLoginPrompt();
    if (session) await loadHistory();
  }

  async function loadHistory() {
    if (!session) {
      historySection.hidden = true;
      return;
    }
    const result = await client
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (result.error) {
      historySection.hidden = true;
      return;
    }

    historySection.hidden = false;
    renderHistory(result.data || []);
  }

  function renderHistory(list) {
    historyCount.textContent = list.length ? '最近 ' + list.length + ' 条' : '';
    historyList.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = '还没有保存过报价。';
      historyList.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'history-item';

      const date = document.createElement('span');
      date.className = 'history-date';
      date.textContent = String(item.created_at || '').slice(0, 10);

      const info = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'history-customer';
      name.textContent = item.customer || '未命名客户';
      const meta = document.createElement('span');
      meta.className = 'history-meta';
      meta.textContent = item.role + ' · ' + item.people + ' 人 × ' + item.days + ' 天';
      info.appendChild(name);
      info.appendChild(meta);

      const total = document.createElement('span');
      total.className = 'history-total';
      total.textContent = money.format(Number(item.total));

      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'history-load';
      load.textContent = '载入';
      load.addEventListener('click', function () {
        customer.value = item.customer || '';
        role.value = item.role;
        rate.value = item.rate;
        people.value = item.people;
        days.value = item.days;
        shift.value = String(item.shift);
        management.value = item.management_rate;
        tax.value = item.tax_rate;
        discount.value = item.discount;
        calculate();
        document.querySelector('.calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      row.appendChild(date);
      row.appendChild(info);
      row.appendChild(total);
      row.appendChild(load);
      historyList.appendChild(row);
    });
  }

  role.addEventListener('change', function () {
    const option = role.options[role.selectedIndex];
    if (option && option.dataset.rate) {
      rate.value = option.dataset.rate;
    }
    calculate();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    calculate();
  });

  [customer, rate, people, days, shift, management, tax, discount].forEach(function (input) {
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);
  });

  document.getElementById('reset').addEventListener('click', function () {
    customer.value = '';
    role.value = '门岗';
    rate.value = '260';
    people.value = '6';
    days.value = '30';
    shift.value = '1';
    management.value = '8';
    tax.value = '6';
    discount.value = '0';
    [rate, people, days, shift, management, tax, discount].forEach(function (input) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.getElementById('copy').addEventListener('click', async function () {
    const data = calculate();
    if (!data) return;

    try {
      await navigator.clipboard.writeText(quoteText(data));
      copyStatus.textContent = '报价单已复制，可以直接发给客户。';
    } catch (err) {
      const area = document.createElement('textarea');
      area.value = quoteText(data);
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      copyStatus.textContent = '报价单已复制，可以直接发给客户。';
    }
  });

  saveQuote.addEventListener('click', async function () {
    const data = calculate();
    if (!data) return;

    const sessionResult = await client.auth.getSession();
    session = sessionResult.data && sessionResult.data.session ? sessionResult.data.session : null;
    setLoginPrompt();
    if (!session) {
      copyStatus.textContent = '请先登录后再保存报价。';
      return;
    }

    saveQuote.disabled = true;
    saveQuote.textContent = '保存中…';
    const result = await client.from('quotes').insert({
      customer: data.customer || null,
      role: data.roleName,
      rate: data.unitRate,
      people: data.headcount,
      days: data.serviceDays,
      shift: data.shiftFactor,
      management_rate: data.managementRate,
      tax_rate: data.taxRate,
      discount: data.discountValue,
      labor: data.labor,
      management_fee: data.managementFee,
      tax_fee: data.taxFee,
      total: data.total,
      note: '按示例单价估算，最终以现场评估和合同为准。'
    });
    saveQuote.disabled = false;
    saveQuote.textContent = '保存报价';

    if (result.error) {
      copyStatus.textContent = '保存失败：' + window.friendlyError(result.error);
      return;
    }
    copyStatus.textContent = '报价已保存，可以在下方历史报价里载入。';
    await loadHistory();
  });

  printQuote.addEventListener('click', function () {
    if (!calculate()) return;
    window.print();
  });

  calculate();
  loadSession();
})();
