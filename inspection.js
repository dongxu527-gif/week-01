(function () {
  const STORAGE_KEY = 'zhongan_inspection_records_v1';
  const form = document.getElementById('record-form');
  const school = document.getElementById('school');
  const date = document.getElementById('date');
  const inspector = document.getElementById('inspector');
  const category = document.getElementById('category');
  const severity = document.getElementById('severity');
  const status = document.getElementById('status');
  const description = document.getElementById('description');
  const formError = document.getElementById('form-error');
  const recordsBody = document.getElementById('records-body');
  const empty = document.getElementById('empty');
  const recordsSub = document.getElementById('records-sub');
  const search = document.getElementById('search');
  const filterSeverity = document.getElementById('filter-severity');
  const filterStatus = document.getElementById('filter-status');
  const toast = document.createElement('div');
  toast.className = 'toast';
  document.body.appendChild(toast);

  let records = loadRecords();

  function todayValue() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (err) {
      showToast('保存失败：浏览器存储不可用');
      return false;
    }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  }

  function severityClass(value) {
    if (value === '高') return 'sev-high';
    if (value === '中') return 'sev-medium';
    return 'sev-low';
  }

  function statusClass(value) {
    if (value === '待处理') return 'status-open';
    if (value === '处理中') return 'status-progress';
    return 'status-closed';
  }

  function filteredRecords() {
    const keyword = search.value.trim().toLowerCase();
    const sev = filterSeverity.value;
    const stat = filterStatus.value;

    return records
      .filter(function (record) {
        if (sev && record.severity !== sev) return false;
        if (stat && record.status !== stat) return false;
        if (!keyword) return true;
        return [record.school, record.inspector, record.description, record.category]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }

  function updateStats() {
    const now = new Date();
    const monthPrefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('stat-total').textContent = records.length;
    document.getElementById('stat-open').textContent = records.filter(function (r) { return r.status !== '已闭环'; }).length;
    document.getElementById('stat-high').textContent = records.filter(function (r) { return r.severity === '高' && r.status !== '已闭环'; }).length;
    document.getElementById('stat-month').textContent = records.filter(function (r) { return String(r.date).startsWith(monthPrefix); }).length;
  }

  function render() {
    const list = filteredRecords();
    recordsSub.textContent = '共 ' + list.length + ' 条' + (list.length !== records.length ? '（筛选后）' : '');
    recordsBody.innerHTML = '';

    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.forEach(function (record) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td data-label="日期">' + escapeHtml(record.date) + '</td>' +
        '<td data-label="学校 / 项目"><span class="record-school">' + escapeHtml(record.school) + '</span><span class="record-category">' + escapeHtml(record.category) + '</span></td>' +
        '<td data-label="巡检人">' + escapeHtml(record.inspector) + '</td>' +
        '<td data-label="问题" class="record-desc-cell"><span class="record-desc">' + escapeHtml(record.description) + '</span></td>' +
        '<td data-label="严重程度"><span class="badge ' + severityClass(record.severity) + '">' + escapeHtml(record.severity) + '</span></td>' +
        '<td data-label="状态"><span class="badge ' + statusClass(record.status) + '">' + escapeHtml(record.status) + '</span></td>' +
        '<td class="action-cell"><button class="delete-btn" type="button" data-id="' + escapeHtml(record.id) + '" aria-label="删除这条记录">×</button></td>';
      recordsBody.appendChild(tr);
    });
  }

  function refresh() {
    updateStats();
    render();
  }

  function resetForm(keepContext) {
    const keepDate = keepContext ? date.value : todayValue();
    const keepInspector = keepContext ? inspector.value : '';
    form.reset();
    date.value = keepDate;
    inspector.value = keepInspector;
    severity.value = '中';
    status.value = '待处理';
    formError.textContent = '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    formError.textContent = '';

    const values = {
      school: school.value.trim(),
      date: date.value,
      inspector: inspector.value.trim(),
      category: category.value,
      severity: severity.value,
      status: status.value,
      description: description.value.trim()
    };

    if (!values.school) { formError.textContent = '请填写学校或项目名称。'; school.focus(); return; }
    if (!values.date) { formError.textContent = '请选择巡检日期。'; date.focus(); return; }
    if (!values.inspector) { formError.textContent = '请填写巡检人。'; inspector.focus(); return; }
    if (values.description.length < 4) { formError.textContent = '问题描述至少写 4 个字。'; description.focus(); return; }

    records.push(Object.assign({}, values, { id: uid(), createdAt: new Date().toISOString() }));
    if (!saveRecords()) return;

    refresh();
    resetForm(true);
    showToast('巡检记录已保存');
  });

  recordsBody.addEventListener('click', function (event) {
    const button = event.target.closest('.delete-btn');
    if (!button) return;
    const id = button.getAttribute('data-id');
    const record = records.find(function (item) { return item.id === id; });
    if (!record) return;
    if (!window.confirm('确定删除“' + record.school + '”在 ' + record.date + ' 的这条记录吗？')) return;
    records = records.filter(function (item) { return item.id !== id; });
    if (saveRecords()) {
      refresh();
      showToast('记录已删除');
    }
  });

  search.addEventListener('input', render);
  filterSeverity.addEventListener('change', render);
  filterStatus.addEventListener('change', render);

  document.getElementById('clear-filters').addEventListener('click', function () {
    search.value = '';
    filterSeverity.value = '';
    filterStatus.value = '';
    render();
  });

  document.getElementById('sample').addEventListener('click', function () {
    const today = todayValue();
    const samples = [
      {
        school: '示例·实验小学',
        date: today,
        inspector: '张师傅',
        category: '围墙',
        severity: '高',
        status: '待处理',
        description: '东侧围墙监控盲区，夜间无法看清，建议加装补光灯。'
      },
      {
        school: '示例·实验小学',
        date: today,
        inspector: '张师傅',
        category: '门岗',
        severity: '中',
        status: '处理中',
        description: '上下学高峰访客登记排队，建议增加一名临时引导员。'
      },
      {
        school: '示例·第一中学',
        date: today,
        inspector: '李队长',
        category: '消防',
        severity: '低',
        status: '已闭环',
        description: '教学楼二层灭火器压力正常，已做月度检查记录。'
      }
    ];
    records = records.concat(samples.map(function (item) {
      return Object.assign({}, item, { id: uid(), createdAt: new Date().toISOString() });
    }));
    if (saveRecords()) {
      refresh();
      showToast('已加载 3 条示例记录');
    }
  });

  document.getElementById('export').addEventListener('click', function () {
    const list = filteredRecords();
    if (!list.length) {
      showToast('没有可导出的记录');
      return;
    }
    const headers = ['日期', '学校/项目', '巡检人', '问题类型', '严重程度', '状态', '问题描述'];
    const rows = list.map(function (record) {
      return [record.date, record.school, record.inspector, record.category, record.severity, record.status, record.description]
        .map(function (value) {
          return '"' + String(value).replace(/"/g, '""') + '"';
        })
        .join(',');
    });
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '巡检台账-' + todayValue() + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('已导出 ' + list.length + ' 条记录');
  });

  date.value = todayValue();
  refresh();
})();
