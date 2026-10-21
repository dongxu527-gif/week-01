(function () {
  const cfg = window.ZHONGAN_SUPABASE || {};
  const client = window.supabase.createClient(cfg.url, cfg.key);

  const loading = document.getElementById('loading');
  const denied = document.getElementById('denied');
  const deniedText = document.getElementById('denied-text');
  const dashboard = document.getElementById('dashboard');
  const userEmail = document.getElementById('user-email');
  const logout = document.getElementById('logout');
  const refresh = document.getElementById('refresh');
  const schoolSearch = document.getElementById('school-search');
  const schoolSave = document.getElementById('school-save');
  const schoolCancel = document.getElementById('school-cancel');
  const schoolDetails = document.querySelector('.add-school');

  let profile = null;
  let schools = [];
  let inspections = [];
  let docsCount = 0;
  let members = [];
  let editingSchoolId = null;

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function statusClass(value) {
    if (value === '服务中') return 'status-active';
    if (value === '试点') return 'status-pilot';
    return 'status-ended';
  }

  function showDenied(message) {
    loading.hidden = true;
    dashboard.hidden = true;
    denied.hidden = false;
    deniedText.textContent = message;
  }

  async function loadProfile() {
    const sessionResult = await client.auth.getSession();
    const active = sessionResult.data && sessionResult.data.session;
    if (!active) {
      window.location.replace('login.html?next=admin.html');
      return false;
    }

    userEmail.textContent = active.user && active.user.email ? active.user.email : '';
    const result = await client.from('profiles').select('id,email,role').eq('id', active.user.id).maybeSingle();
    if (result.error) {
      showDenied('读取账号权限失败：' + result.error.message);
      return false;
    }
    if (!result.data) {
      showDenied('这个账号还没有开通后台权限。请联系管理员在 Supabase 的 profiles 表里添加。');
      return false;
    }
    profile = result.data;
    if (profile.role !== 'admin') {
      showDenied('当前账号是巡检员，没有后台权限。需要管理员在“团队成员”里把角色改成 admin。');
      return false;
    }
    return true;
  }

  async function loadData() {
    const results = await Promise.all([
      client.from('schools').select('*').order('created_at', { ascending: false }),
      client.from('inspection_records').select('*').order('inspection_date', { ascending: false }).limit(500),
      client.from('knowledge_documents').select('id', { count: 'exact', head: true }),
      client.from('profiles').select('id,email,role,created_at').order('created_at', { ascending: true })
    ]);

    for (let i = 0; i < results.length; i += 1) {
      if (results[i].error) {
        showDenied('读取数据失败：' + results[i].error.message);
        return false;
      }
    }

    schools = results[0].data || [];
    inspections = results[1].data || [];
    docsCount = results[2].count || 0;
    members = results[3].data || [];
    return true;
  }

  function renderStats() {
    setText('stat-schools', schools.length);
    setText('stat-records', inspections.length);
    setText('stat-open', inspections.filter(function (r) { return r.status !== '已闭环'; }).length);
    setText('stat-high', inspections.filter(function (r) { return r.severity === '高' && r.status !== '已闭环'; }).length);
    setText('stat-docs', docsCount);
  }

  function renderSchools() {
    const body = document.getElementById('schools-body');
    const empty = document.getElementById('schools-empty');
    const keyword = schoolSearch.value.trim().toLowerCase();
    const list = schools.filter(function (school) {
      if (!keyword) return true;
      return [school.name, school.address, school.contact_name, school.contact_phone]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });

    document.getElementById('schools-sub').textContent = keyword
      ? '显示 ' + list.length + ' / 共 ' + schools.length + ' 个'
      : '共 ' + schools.length + ' 个';
    body.innerHTML = '';

    if (!list.length) {
      empty.hidden = false;
      empty.textContent = keyword ? '没有匹配的学校。' : '还没有学校，先新增一个。';
      return;
    }
    empty.hidden = true;

    list.forEach(function (school) {
      const related = inspections.filter(function (r) { return r.school_id === school.id || (!r.school_id && r.school === school.name); });
      const last = related.length ? related.map(function (r) { return r.inspection_date; }).sort().slice(-1)[0] : '—';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="school-name">' + escapeHtml(school.name) + '</span><span class="school-meta">' + escapeHtml(school.address || '') + '</span></td>' +
        '<td>' + escapeHtml(school.type) + '</td>' +
        '<td><span class="badge ' + statusClass(school.status) + '">' + escapeHtml(school.status) + '</span></td>' +
        '<td>' + related.length + '</td>' +
        '<td>' + escapeHtml(last) + '</td>' +
        '<td><button class="edit-btn" type="button" data-id="' + escapeHtml(school.id) + '">编辑</button><button class="delete-btn" type="button" data-id="' + escapeHtml(school.id) + '" aria-label="删除学校">×</button></td>';
      body.appendChild(tr);
    });
  }

  function resetSchoolForm() {
    document.getElementById('school-form').reset();
    document.getElementById('school-type').value = '小学';
    document.getElementById('school-status').value = '服务中';
    document.getElementById('school-error').textContent = '';
    editingSchoolId = null;
    schoolSave.textContent = '保存学校';
    schoolCancel.hidden = true;
  }

  function startSchoolEdit(school) {
    editingSchoolId = school.id;
    document.getElementById('school-name').value = school.name || '';
    document.getElementById('school-type').value = school.type || '小学';
    document.getElementById('school-address').value = school.address || '';
    document.getElementById('school-contact').value = school.contact_name || '';
    document.getElementById('school-phone').value = school.contact_phone || '';
    document.getElementById('school-status').value = school.status || '服务中';
    document.getElementById('school-error').textContent = '';
    schoolSave.textContent = '更新学校';
    schoolCancel.hidden = false;
    schoolDetails.open = true;
    schoolDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderHighRisk() {
    const list = document.getElementById('high-list');
    const empty = document.getElementById('high-empty');
    const high = inspections
      .filter(function (r) { return r.severity === '高' && r.status !== '已闭环'; })
      .sort(function (a, b) { return String(b.inspection_date).localeCompare(String(a.inspection_date)); })
      .slice(0, 8);

    list.innerHTML = '';
    if (!high.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    high.forEach(function (record) {
      const item = document.createElement('div');
      item.className = 'high-item';
      item.innerHTML =
        '<div class="high-title">' + escapeHtml(record.school) + ' · ' + escapeHtml(record.category) + '</div>' +
        '<div class="high-desc">' + escapeHtml(record.description) + '</div>' +
        '<div class="high-meta">' + escapeHtml(record.inspection_date) + ' · ' + escapeHtml(record.status) + ' · ' + escapeHtml(record.inspector) + '</div>';
      list.appendChild(item);
    });
  }

  function renderMembers() {
    const body = document.getElementById('members-body');
    body.innerHTML = '';
    members.forEach(function (member) {
      const tr = document.createElement('tr');
      const isSelf = profile && member.id === profile.id;
      tr.innerHTML =
        '<td>' + escapeHtml(member.email || '—') + (isSelf ? ' <span class="school-meta">（我）</span>' : '') + '</td>' +
        '<td><select class="role-select" data-id="' + escapeHtml(member.id) + '"' + (isSelf ? ' disabled' : '') + '>' +
          ['admin', 'inspector'].map(function (role) {
            return '<option value="' + role + '"' + (member.role === role ? ' selected' : '') + '>' + role + '</option>';
          }).join('') +
        '</select></td>' +
        '<td>' + escapeHtml(String(member.created_at || '').slice(0, 10)) + '</td>';
      body.appendChild(tr);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function refreshAll() {
    loading.hidden = false;
    dashboard.hidden = true;
    denied.hidden = true;

    const ok = await loadData();
    if (!ok) return;

    loading.hidden = true;
    dashboard.hidden = false;
    renderStats();
    renderSchools();
    renderHighRisk();
    renderMembers();
  }

  document.getElementById('school-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = document.getElementById('school-name').value.trim();
    const type = document.getElementById('school-type').value;
    const address = document.getElementById('school-address').value.trim();
    const contact = document.getElementById('school-contact').value.trim();
    const phone = document.getElementById('school-phone').value.trim();
    const status = document.getElementById('school-status').value;
    const error = document.getElementById('school-error');

    error.textContent = '';
    if (!name) {
      error.textContent = '请填写学校名称。';
      return;
    }

    const payload = {
      name: name,
      type: type,
      address: address,
      contact_name: contact,
      contact_phone: phone,
      status: status
    };

    const result = editingSchoolId
      ? await client.from('schools').update(payload).eq('id', editingSchoolId)
      : await client.from('schools').insert(payload);

    if (result.error) {
      error.textContent = (editingSchoolId ? '更新失败：' : '保存失败：') + result.error.message;
      return;
    }

    resetSchoolForm();
    await refreshAll();
  });

  document.getElementById('schools-body').addEventListener('click', async function (event) {
    const editButton = event.target.closest('.edit-btn');
    if (editButton) {
      const editId = editButton.getAttribute('data-id');
      const schoolToEdit = schools.find(function (item) { return item.id === editId; });
      if (schoolToEdit) startSchoolEdit(schoolToEdit);
      return;
    }

    const button = event.target.closest('.delete-btn');
    if (!button) return;
    const id = button.getAttribute('data-id');
    const school = schools.find(function (item) { return item.id === id; });
    if (!school) return;
    if (!window.confirm('确定删除“' + school.name + '”？巡检记录不会被删除，但学校列表里会移除。')) return;
    const result = await client.from('schools').delete().eq('id', id);
    if (result.error) {
      window.alert('删除失败：' + result.error.message);
      return;
    }
    if (editingSchoolId === id) resetSchoolForm();
    await refreshAll();
  });

  document.getElementById('members-body').addEventListener('change', async function (event) {
    const select = event.target.closest('.role-select');
    if (!select) return;
    const id = select.getAttribute('data-id');
    const role = select.value;
    const result = await client.from('profiles').update({ role: role }).eq('id', id);
    if (result.error) {
      window.alert('修改角色失败：' + result.error.message);
      await refreshAll();
      return;
    }
    await refreshAll();
  });

  schoolSearch.addEventListener('input', renderSchools);
  schoolCancel.addEventListener('click', resetSchoolForm);

  refresh.addEventListener('click', refreshAll);
  logout.addEventListener('click', async function () {
    await client.auth.signOut();
    window.location.replace('login.html');
  });

  async function init() {
    const allowed = await loadProfile();
    if (!allowed) return;
    await refreshAll();
  }

  init();
})();
