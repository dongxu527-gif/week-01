(function () {
  const form = document.getElementById('quote-form');
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

  function numberValue(input, fallback) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
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

    return data;
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

  [rate, people, days, shift, management, tax, discount].forEach(function (input) {
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);
  });

  document.getElementById('reset').addEventListener('click', function () {
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

    const text = [
      '中安安防 · 安保服务报价单',
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
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = '报价单已复制，可以直接发给客户。';
    } catch (err) {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      copyStatus.textContent = '报价单已复制，可以直接发给客户。';
    }
  });

  calculate();
})();
