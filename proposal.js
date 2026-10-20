(function () {
  const cfg = window.ZHONGAN_SUPABASE || {};
  const client = window.supabase.createClient(cfg.url, cfg.key);
  const form = document.getElementById('proposal-form');
  const school = document.getElementById('school');
  const type = document.getElementById('type');
  const students = document.getElementById('students');
  const area = document.getElementById('area');
  const entrances = document.getElementById('entrances');
  const scope = document.getElementById('scope');
  const style = document.getElementById('style');
  const formError = document.getElementById('form-error');
  const output = document.getElementById('output');
  const status = document.getElementById('ai-status');
  const generateBtn = document.getElementById('generate');
  const copyBtn = document.getElementById('copy');
  const downloadBtn = document.getElementById('download');
  const userEmail = document.getElementById('user-email');
  const logout = document.getElementById('logout');

  let currentMarkdown = '';
  let session = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown).replace(/\r/g, '').split('\n');
    let html = '';
    let listType = null;

    function closeList() {
      if (listType) {
        html += '</' + listType + '>';
        listType = null;
      }
    }

    lines.forEach(function (raw) {
      const line = raw.trim();
      if (!line) {
        closeList();
        return;
      }
      if (line.startsWith('### ')) {
        closeList();
        html += '<h3>' + inline(line.slice(4)) + '</h3>';
      } else if (line.startsWith('## ')) {
        closeList();
        html += '<h2>' + inline(line.slice(3)) + '</h2>';
      } else if (line.startsWith('# ')) {
        closeList();
        html += '<h2>' + inline(line.slice(2)) + '</h2>';
      } else if (/^[-*]\s+/.test(line)) {
        if (listType !== 'ul') {
          closeList();
          html += '<ul>';
          listType = 'ul';
        }
        html += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>';
      } else if (/^\d+\.\s+/.test(line)) {
        if (listType !== 'ol') {
          closeList();
          html += '<ol>';
          listType = 'ol';
        }
        html += '<li>' + inline(line.replace(/^\d+\.\s+/, '')) + '</li>';
      } else {
        closeList();
        html += '<p>' + inline(line) + '</p>';
      }
    });

    closeList();
    return html;
  }

  function getRisks() {
    return Array.from(document.querySelectorAll('input[name="risk"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function getData() {
    return {
      school: school.value.trim(),
      type: type.value,
      students: students.value.trim(),
      area: area.value.trim(),
      entrances: entrances.value.trim(),
      risks: getRisks(),
      scope: scope.value,
      style: style.value
    };
  }

  function localProposal(d) {
    const studentText = d.students || '需现场核实';
    const areaText = d.area || '需现场核实';
    const entranceText = d.entrances || '需现场核实';
    const riskText = d.risks.length ? d.risks.join('、') : '需现场评估';
    return [
      '## 项目理解',
      d.school + '是一所' + d.type + '，在校学生约 ' + studentText + ' 人，占地面积约 ' + areaText + ' 平方米，现有 ' + entranceText + ' 个出入口。学校希望在不影响教学秩序的前提下，把人防、技防和巡逻机器人组合成一套可执行、可检查的日常安全服务。',
      '',
      '## 风险分析',
      '根据目前提供的信息，重点风险集中在：' + riskText + '。',
      '',
      '- 上下学时段人流集中，门岗压力和交通疏导压力最大。',
      '- 围墙、操场、教学楼背面等区域容易出现视线盲区。',
      '- 夜间和宿舍区需要稳定的巡逻频次与记录机制。',
      '- 监控、消防、照明等设施需要和人员巡逻形成联动。',
      '',
      '以上判断需结合现场勘查确认，不能替代学校的安全风险评估。',
      '',
      '## 岗位与巡逻配置',
      '建议先按“门岗 + 巡逻岗 + 监控岗”三类岗位做试点配置：',
      '',
      '- 门岗：负责上下学护导、访客登记、车辆与人员进出管理。',
      '- 巡逻岗：按定时路线覆盖操场、围墙、教学楼和宿舍区。',
      '- 监控岗：负责视频巡查、异常上报和夜间值班记录。',
      '',
      '具体人数、班次和岗位时间需根据出入口数量、学校作息和现场风险确定。',
      '',
      '## 机器人部署',
      '建议先部署巡逻机器人承担重复性巡逻任务，优先覆盖操场、围墙和教学楼外围。机器人负责定时巡逻、夜间补光、异常记录和喊话提醒；保安负责判断、处置和与学校沟通。',
      '',
      '机器人数量、路线和充电点需现场勘查后确定。第一版不建议直接替代人工门岗。',
      '',
      '## 巡检频次',
      '- 上下学时段：门岗和护导岗位全员在岗。',
      '- 上课时段：每 2 小时至少一次重点区域巡逻。',
      '- 夜间：机器人按预设路线巡逻，保安定时抽查。',
      '- 每月：做一次设备、消防和应急流程检查。',
      '',
      '## 应急处置',
      '建议建立“发现—上报—处置—记录—复盘”的闭环：',
      '',
      '1. 发现异常后，现场人员先确保自身和学生安全。',
      '2. 通过对讲、电话或平台上报值班负责人。',
      '3. 按学校应急预案联动校方、保安和相关部门。',
      '4. 事件处理完后补齐记录，并在周会上复盘。',
      '',
      '## 实施计划',
      '- 第 1 周：现场勘查、出入口和风险点确认。',
      '- 第 2 周：岗位配置、巡逻路线和机器人路线设计。',
      '- 第 3 周：人员到位、设备调试、制度交底。',
      '- 第 4 周：试运行、问题修正、正式交付。',
      '',
      '## 报价边界',
      '本方案只覆盖安保服务与巡逻机器人服务，不含土建、网络改造、设备采购和学校原有系统改造。最终报价按岗位、人数、天数、班次和管理费核算，可使用公司报价计算器做初算。',
      '',
      '## 下一步',
      '建议先安排一次现场评估，确认出入口、重点区域、值班室、监控点位和机器人充电路线，再出正式方案和报价。',
      '',
      '## 需要学校确认的 5 个问题',
      '1. 学校目前最担心的三个安全场景是什么？',
      '2. 上下学时段有几个出入口需要同时开放？',
      '3. 夜间是否需要保安驻校，还是只做定时巡查？',
      '4. 现有监控、消防、照明哪些可以联动，哪些需要改造？',
      '5. 学校希望先做单点试点，还是直接做全校方案？'
    ].join('\n');
  }

  function setStatus(text, mode) {
    status.textContent = text;
    status.className = 'ai-status' + (mode ? ' ' + mode : '');
  }

  function setOutput(markdown, notice) {
    currentMarkdown = markdown;
    const noticeHtml = notice ? '<div class="notice">' + escapeHtml(notice) + '</div>' : '';
    output.innerHTML = noticeHtml + renderMarkdown(markdown);
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
  }

  function fillSample() {
    school.value = '郑州实验小学';
    type.value = '小学';
    students.value = '1800';
    area.value = '22000';
    entrances.value = '3';
    scope.value = '人防 + 机器人';
    style.value = '正式方案';
    document.querySelectorAll('input[name="risk"]').forEach(function (input) {
      input.checked = ['上下学人流', '围墙盲区', '监控盲区', '夜间巡逻'].includes(input.value);
    });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.textContent = '';
    const data = getData();

    if (!data.school) {
      formError.textContent = '请填写学校名称。';
      school.focus();
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '生成中…';
    setStatus('生成中…', '');

    try {
      const sessionResult = await client.auth.getSession();
      const active = sessionResult.data && sessionResult.data.session;
      if (!active) {
        window.location.replace('login.html?next=proposal.html');
        return;
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + active.access_token
        },
        body: JSON.stringify(data)
      });

      if (response.status === 401) {
        window.location.replace('login.html?next=proposal.html');
        return;
      }

      if (response.status === 503) {
        setOutput(localProposal(data), '当前还没有配置 DeepSeek API Key，先用本地模板生成。配置后会自动切换为 AI 生成。');
        setStatus('本地模板', 'demo');
        return;
      }

      if (!response.ok) {
        throw new Error('接口返回 ' + response.status);
      }

      const result = await response.json();
      if (!result.text) throw new Error('AI 返回空内容');
      setOutput(result.text, '');
      setStatus('AI 生成', 'ai');
    } catch (err) {
      setOutput(localProposal(data), 'AI 接口暂时不可用，已用本地模板生成初稿。错误：' + (err.message || '请重试'));
      setStatus('本地模板', 'demo');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = '生成方案初稿';
    }
  });

  document.getElementById('sample').addEventListener('click', fillSample);

  copyBtn.addEventListener('click', async function () {
    if (!currentMarkdown) return;
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      copyBtn.textContent = '已复制';
      window.setTimeout(function () { copyBtn.textContent = '复制'; }, 1600);
    } catch (err) {
      copyBtn.textContent = '复制失败';
    }
  });

  downloadBtn.addEventListener('click', function () {
    if (!currentMarkdown) return;
    const blob = new Blob([currentMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '校园安保方案-' + (school.value.trim() || '初稿') + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  logout.addEventListener('click', async function () {
    await client.auth.signOut();
    window.location.replace('login.html');
  });

  async function init() {
    const result = await client.auth.getSession();
    const active = result.data && result.data.session;
    if (!active) {
      window.location.replace('login.html?next=proposal.html');
      return;
    }
    session = active;
    userEmail.textContent = active.user && active.user.email ? active.user.email : '';
  }

  init();
})();
