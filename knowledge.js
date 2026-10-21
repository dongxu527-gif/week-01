(function () {
  const cfg = window.ZHONGAN_SUPABASE || {};
  const client = window.supabase.createClient(cfg.url, cfg.key);
  const BEARER = 'Bea' + 'rer ';

  const docForm = document.getElementById('doc-form');
  const docTitle = document.getElementById('doc-title');
  const docContent = document.getElementById('doc-content');
  const docFile = document.getElementById('doc-file');
  const docError = document.getElementById('doc-error');
  const docList = document.getElementById('doc-list');
  const docCount = document.getElementById('doc-count');
  const messages = document.getElementById('messages');
  const askForm = document.getElementById('ask-form');
  const question = document.getElementById('question');
  const askError = document.getElementById('ask-error');
  const askBtn = document.getElementById('ask-btn');
  const userEmail = document.getElementById('user-email');
  const logout = document.getElementById('logout');

  let documents = [];
  let session = null;

  function showError(target, message) {
    target.textContent = message || '';
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendMessage(role, text, sources) {
    const el = document.createElement('div');
    el.className = 'message ' + role;
    const p = document.createElement('p');
    p.textContent = text;
    el.appendChild(p);

    if (sources && sources.length) {
      const box = document.createElement('div');
      box.className = 'sources';
      sources.forEach(function (source) {
        const item = document.createElement('div');
        item.className = 'source';
        const strong = document.createElement('strong');
        strong.textContent = '[' + source.index + '] ' + source.title;
        item.appendChild(strong);
        item.appendChild(document.createTextNode(' — ' + source.snippet));
        box.appendChild(item);
      });
      el.appendChild(box);
    }

    messages.appendChild(el);
    scrollBottom();
    return el;
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

  async function loadDocuments() {
    const result = await client
      .from('knowledge_documents')
      .select('id,title,content,created_at')
      .order('created_at', { ascending: false });

    if (result.error) {
      docList.innerHTML = '<p class="empty-small">读取失败：' + result.error.message + '</p>';
      return;
    }

    documents = result.data || [];
    renderDocuments();
  }

  function renderDocuments() {
    docCount.textContent = documents.length + ' 篇';
    docList.innerHTML = '';

    if (!documents.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-small';
      empty.textContent = '还没有文档，先添加第一篇。';
      docList.appendChild(empty);
      return;
    }

    documents.forEach(function (doc) {
      const item = document.createElement('div');
      item.className = 'doc-item';

      const title = document.createElement('div');
      title.className = 'doc-title';
      title.textContent = doc.title;

      const meta = document.createElement('div');
      meta.className = 'doc-meta';
      const size = document.createElement('span');
      size.textContent = doc.content.length + ' 字';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'doc-delete';
      del.textContent = '删除';
      del.addEventListener('click', function () {
        removeDocument(doc);
      });
      meta.appendChild(size);
      meta.appendChild(del);

      item.appendChild(title);
      item.appendChild(meta);
      docList.appendChild(item);
    });
  }

  async function removeDocument(doc) {
    if (!window.confirm('确定删除“' + doc.title + '”？删除后问答就查不到这篇资料了。')) return;
    const result = await client.from('knowledge_documents').delete().eq('id', doc.id);
    if (result.error) {
      showError(docError, '删除失败：' + result.error.message);
      return;
    }
    await loadDocuments();
  }

  docFile.addEventListener('change', function () {
    const file = docFile.files && docFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      docContent.value = String(reader.result || '');
      if (!docTitle.value.trim()) {
        docTitle.value = file.name.replace(/\.(txt|md)$/i, '');
      }
      docFile.value = '';
    };
    reader.readAsText(file, 'utf-8');
  });

  docForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    showError(docError, '');

    const title = docTitle.value.trim();
    const content = docContent.value.trim();
    if (!title) {
      showError(docError, '请填写文档标题。');
      docTitle.focus();
      return;
    }
    if (content.length < 20) {
      showError(docError, '文档内容太短，至少写 20 个字。');
      docContent.focus();
      return;
    }

    const button = document.getElementById('doc-save');
    button.disabled = true;
    button.textContent = '保存中…';

    const result = await client.from('knowledge_documents').insert({ title: title, content: content });

    button.disabled = false;
    button.textContent = '保存文档';

    if (result.error) {
      showError(docError, '保存失败：' + result.error.message);
      return;
    }

    docTitle.value = '';
    docContent.value = '';
    await loadDocuments();
  });

  askForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    showError(askError, '');

    const text = question.value.trim();
    if (!text) {
      showError(askError, '请先输入问题。');
      question.focus();
      return;
    }

    appendMessage('user', text);
    question.value = '';
    askBtn.disabled = true;
    askBtn.textContent = '查询中…';

    const sessionResult = await client.auth.getSession();
    const active = sessionResult.data && sessionResult.data.session;
    if (!active) {
      window.location.replace('login.html?next=knowledge.html');
      return;
    }

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: BEARER + active.access_token
        },
        body: JSON.stringify({ question: text })
      });

      if (response.status === 401) {
        window.location.replace('login.html?next=knowledge.html');
        return;
      }

      if (response.status === 503) {
        appendMessage('assistant', '还没有配置 DeepSeek API Key，暂时不能生成回答。');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        appendMessage('assistant', '查询失败：' + (data.error || '请重试'));
        return;
      }

      appendMessage('assistant', data.answer || '没有返回内容。', data.sources || []);
    } catch (err) {
      appendMessage('assistant', '查询失败：' + (err.message || '请检查网络后重试'));
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = '提问';
    }
  });


  document.getElementById('export-docs').addEventListener('click', function () {
    if (!documents.length) {
      window.alert('知识库还没有文档。');
      return;
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documents: documents
    };
    downloadFile(JSON.stringify(payload, null, 2), '知识库备份-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json;charset=utf-8');
  });

  logout.addEventListener('click', async function () {
    await client.auth.signOut();
    window.location.replace('login.html');
  });

  async function init() {
    const result = await client.auth.getSession();
    const active = result.data && result.data.session;
    if (!active) {
      window.location.replace('login.html?next=knowledge.html');
      return;
    }
    session = active;
    userEmail.textContent = active.user && active.user.email ? active.user.email : '';
    await loadDocuments();
  }

  init();
})();
