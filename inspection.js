(function () {
  const cfg = window.ZHONGAN_SUPABASE || {};
  const client = window.supabase.createClient(cfg.url, cfg.key);
  const TABLE = 'inspection_records';
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
  const backup = document.getElementById('backup');
  const restoreFile = document.getElementById('restore-file');
  const migrate = document.getElementById('migrate');
  const logout = document.getElementById('logout');
  const userEmail = document.getElementById('user-email');
  const schoolOptions = document.getElementById('school-options');
  const formTitle = document.getElementById('form-title');
  const saveRecord = document.getElementById('save-record');
  const cancelEdit = document.getElementById('cancel-edit');

  const toast = document.createElement('div');
  toast.className = 'toast';
  document.body.appendChild(toast);

  let records = [];
  let schools = [];
  let session = null;
  let editingId = null;

  function todayValue() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function findSchoolId(name) {
    const target = String(name || '').trim();
    const found = schools.find(function (school) { return school.name.trim() === target; });
    return found ? found.id : null;
  }

  function renderSchoolOptions() {
    if (!schoolOptions) return;
    schoolOptions.innerHTML = schools.map(function (school) {
      return '<option value="' + escapeHtml(school.name) + '"></option>';
    }).join('');
  }

  async function loadSchools() {
    const result = await client.from('schools').select('id,name').order('name');
    if (!result.error) {
      schools = result.data || [];
      renderSchoolOptions();
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
    }, 2400);
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

  function statusSelect(record) {
    const options = ['待处理', '处理中', '已闭环'].map(function (value) {
      return '<option value="' + value + '"' + (value === record.status ? ' selected' : '') + '>' + value + '</option>';
    }).join('');
    return '<select class="status-select ' + statusClass(record.status) + '" data-id="' + escapeHtml(record.id) + '" aria-label="修改状态">' + options + '</select>';
  }

  function rowToRecord(row) {
    return {
      id: row.id,
      school: row.school,
      date: row.inspection_date,
      inspector: row.inspector,
      category: row.category,
      severity: row.severity,
      status: row.status,
      description: row.description,
      schoolId: row.school_id,
      createdAt: row.created_at
    };
  }

  function recordToRow(record) {
    return {
      school: record.school,
      inspection_date: record.date,
      inspector: record.inspector,
      category: record.category,
      severity: record.severity,
      status: record.status,
      description: record.description,
      school_id: record.schoolId || findSchoolId(record.school) || null
    };
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function normalizeLocalRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const schoolValue = String(raw.school || '').trim();
    const dateValue = String(raw.date || raw.inspection_date || '').slice(0, 10);
    const inspectorValue = String(raw.inspector || '').trim();
    const descriptionValue = String(raw.description || '').trim();
    if (!schoolValue || !inspectorValue || descriptionValue.length < 4) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
    const categories = ['门岗', '围墙', '监控', '消防', '照明', '其他'];
    const severities = ['低', '中', '高'];
    const statuses = ['待处理', '处理中', '已闭环'];
    return {
      id: raw.id && isUuid(raw.id) ? String(raw.id) : uid(),
      school: schoolValue,
      date: dateValue,
      inspector: inspectorValue,
      category: categories.includes(raw.category) ? raw.category : '其他',
      severity: severities.includes(raw.severity) ? raw.severity : '中',
      status: statuses.includes(raw.status) ? raw.status : '待处理',
      description: descriptionValue,
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString()
    };
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
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
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
        '<td data-label="状态">' + statusSelect(record) + '</td>' +
        '<td class="action-cell"><button class="edit-btn" type="button" data-id="' + escapeHtml(record.id) + '">编辑</button><button class="delete-btn" type="button" data-id="' + escapeHtml(record.id) + '" aria-label="删除这条记录">×</button></td>';
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

  function startEdit(record) {
    editingId = record.id;
    formTitle.textContent = '编辑巡检记录';
    saveRecord.textContent = '更新记录';
    cancelEdit.hidden = false;
    school.value = record.school;
    date.value = record.date;
    inspector.value = record.inspector;
    category.value = record.category;
    severity.value = record.severity;
    status.value = record.status;
    description.value = record.description;
    formError.textContent = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function endEdit() {
    editingId = null;
    formTitle.textContent = '新增巡检记录';
    saveRecord.textContent = '保存记录';
    cancelEdit.hidden = true;
    formError.textContent = '';
  }

  async function fetchRecords() {
    const result = await client
      .from(TABLE)
      .select('*')
      .order('inspection_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    records = (result.data || []).map(rowToRecord);
  }

  async function insertRecord(values) {
    const result = await client
      .from(TABLE)
      .insert(recordToRow(values))
      .select()
      .single();
    if (result.error) throw result.error;
    return rowToRecord(result.data);
  }

  async function updateRecord(id, values) {
    const row = recordToRow(values);
    row.updated_at = new Date().toISOString();
    const result = await client.from(TABLE).update(row).eq('id', id);
    if (result.error) throw result.error;
  }

  async function updateStatus(id, value) {
    const result = await client.from(TABLE).update({ status: value, updated_at: new Date().toISOString() }).eq('id', id);
    if (result.error) throw result.error;
  }

  async function deleteRecord(id) {
    const result = await client.from(TABLE).delete().eq('id', id);
    if (result.error) throw result.error;
  }

  async function importRows(rows) {
    const result = await client.from(TABLE).upsert(rows, { onConflict: 'id' });
    if (result.error) throw result.error;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function localRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return (Array.isArray(data) ? data : []).map(normalizeLocalRecord).filter(Boolean);
    } catch (err) {
      return [];
    }
  }

  function updateMigrateButton() {
    const local = localRecords();
    migrate.hidden = !local.length;
    migrate.textContent = local.length ? '导入本地旧数据 (' + local.length + ')' : '导入本地旧数据';
  }

  function bindEvents() {
    form.addEventListener('submit', async function (event) {
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

      try {
        if (editingId) {
          await updateRecord(editingId, values);
          const index = records.findIndex(function (item) { return item.id === editingId; });
          if (index >= 0) {
            records[index] = Object.assign({}, records[index], values, { schoolId: findSchoolId(values.school) });
          }
          endEdit();
          resetForm(true);
          refresh();
          showToast('巡检记录已更新');
        } else {
          const record = await insertRecord(values);
          records.unshift(record);
          refresh();
          resetForm(true);
          showToast('巡检记录已保存');
        }
      } catch (err) {
        formError.textContent = (editingId ? '更新失败：' : '保存失败：') + (err.message || '请重试');
      }
    });

    recordsBody.addEventListener('click', async function (event) {
      const editButton = event.target.closest('.edit-btn');
      if (editButton) {
        const editId = editButton.getAttribute('data-id');
        const recordToEdit = records.find(function (item) { return item.id === editId; });
        if (recordToEdit) startEdit(recordToEdit);
        return;
      }

      const button = event.target.closest('.delete-btn');
      if (!button) return;
      const id = button.getAttribute('data-id');
      const record = records.find(function (item) { return item.id === id; });
      if (!record) return;
      if (!window.confirm('确定删除“' + record.school + '”在 ' + record.date + ' 的这条记录吗？')) return;
      try {
        await deleteRecord(id);
        records = records.filter(function (item) { return item.id !== id; });
        if (editingId === id) { endEdit(); resetForm(false); }
        refresh();
        showToast('记录已删除');
      } catch (err) {
        showToast('删除失败：' + (err.message || '请重试'));
      }
    });

    recordsBody.addEventListener('change', async function (event) {
      const select = event.target.closest('.status-select');
      if (!select) return;
      const id = select.getAttribute('data-id');
      const record = records.find(function (item) { return item.id === id; });
      if (!record) return;
      const nextStatus = select.value;
      try {
        await updateStatus(id, nextStatus);
        record.status = nextStatus;
        updateStats();
        render();
        showToast('状态已更新');
      } catch (err) {
        showToast('状态更新失败：' + (err.message || '请重试'));
        render();
      }
    });

    cancelEdit.addEventListener('click', function () {
      endEdit();
      resetForm(false);
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

    document.getElementById('sample').addEventListener('click', async function () {
      if (records.some(function (record) { return String(record.school).startsWith('示例·'); })) {
        showToast('示例数据已经加载过，不再重复添加');
        return;
      }
      const today = todayValue();
      const samples = [
        { school: '示例·实验小学', date: today, inspector: '张师傅', category: '围墙', severity: '高', status: '待处理', description: '东侧围墙监控盲区，夜间无法看清，建议加装补光灯。' },
        { school: '示例·实验小学', date: today, inspector: '张师傅', category: '门岗', severity: '中', status: '处理中', description: '上下学高峰访客登记排队，建议增加一名临时引导员。' },
        { school: '示例·第一中学', date: today, inspector: '李队长', category: '消防', severity: '低', status: '已闭环', description: '教学楼二层灭火器压力正常，已做月度检查记录。' }
      ];
      const rows = samples.map(function (item) {
        const row = recordToRow(item);
        row.id = uid();
        row.created_at = new Date().toISOString();
        return row;
      });
      try {
        await importRows(rows);
        await fetchRecords();
        refresh();
        showToast('已加载 3 条示例记录');
      } catch (err) {
        showToast('加载示例失败：' + (err.message || '请重试'));
      }
    });

    backup.addEventListener('click', function () {
      if (!records.length) {
        showToast('没有可备份的记录');
        return;
      }
      const payload = { version: 1, exportedAt: new Date().toISOString(), records: records };
      downloadFile(JSON.stringify(payload, null, 2), '巡检台账备份-' + todayValue() + '.json', 'application/json;charset=utf-8');
      showToast('备份文件已导出');
    });

    restoreFile.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const data = JSON.parse(String(reader.result || ''));
          const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : []);
          const normalized = incoming.map(normalizeLocalRecord).filter(Boolean);
          if (!normalized.length) {
            showToast('导入失败：没有有效记录');
            return;
          }
          const existing = new Set(records.map(function (record) { return record.id; }));
          const additions = normalized.filter(function (record) { return !existing.has(record.id); });
          if (!additions.length) {
            showToast('没有新增记录（可能已导入过）');
            return;
          }
          if (!window.confirm('导入 ' + additions.length + ' 条记录？将与现有记录合并。')) return;
          const rows = additions.map(function (record) {
            const row = recordToRow(record);
            row.id = record.id;
            row.created_at = record.createdAt;
            return row;
          });
          await importRows(rows);
          await fetchRecords();
          refresh();
          showToast('已导入 ' + additions.length + ' 条记录');
        } catch (err) {
          showToast('导入失败：' + (err.message || '文件不是有效的 JSON'));
        } finally {
          restoreFile.value = '';
        }
      };
      reader.readAsText(file, 'utf-8');
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
          .map(function (value) { return '"' + String(value).replace(/"/g, '""') + '"'; })
          .join(',');
      });
      const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      downloadFile(csv, '巡检台账-' + todayValue() + '.csv', 'text/csv;charset=utf-8;');
      showToast('已导出 ' + list.length + ' 条记录');
    });

    migrate.addEventListener('click', async function () {
      const local = localRecords();
      if (!local.length) {
        showToast('没有本地旧数据');
        updateMigrateButton();
        return;
      }
      const existing = new Set(records.map(function (record) { return record.id; }));
      const additions = local.filter(function (record) { return !existing.has(record.id); });
      if (!additions.length) {
        showToast('本地数据已经导入过了');
        return;
      }
      if (!window.confirm('把本地 ' + additions.length + ' 条旧记录导入数据库？')) return;
      const rows = additions.map(function (record) {
        const row = recordToRow(record);
        row.id = record.id;
        row.created_at = record.createdAt;
        return row;
      });
      try {
        await importRows(rows);
        await fetchRecords();
        refresh();
        migrate.hidden = true;
        showToast('本地旧数据已导入 ' + additions.length + ' 条');
      } catch (err) {
        showToast('导入失败：' + (err.message || '请重试'));
      }
    });

    logout.addEventListener('click', async function () {
      await client.auth.signOut();
      window.location.replace('login.html');
    });
  }

  async function init() {
    const result = await client.auth.getSession();
    const current = result.data && result.data.session;
    if (!current) {
      window.location.replace('login.html?next=inspection.html');
      return;
    }
    session = current;
    userEmail.textContent = current.user && current.user.email ? current.user.email : '';

    try {
      await loadSchools();
      await fetchRecords();
    } catch (err) {
      showToast('读取数据库失败：' + (err.message || '请刷新重试'));
    }

    bindEvents();
    date.value = todayValue();
    refresh();
    updateMigrateButton();
  }

  init();
})();
