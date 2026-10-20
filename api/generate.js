const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tvueqmyfsxefpazprxbj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_0Z6OGBS2Lxj59_EIYYCTDQ_f6DxsPBd';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST 请求' });
    return;
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + token
    }
  });

  if (!userResponse.ok) {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: '还没有配置 DeepSeek API Key' });
    return;
  }

  const body = req.body || {};
  const school = String(body.school || '').trim().slice(0, 80);
  const type = String(body.type || '小学').trim().slice(0, 20);
  const students = String(body.students || '').trim().slice(0, 20);
  const area = String(body.area || '').trim().slice(0, 20);
  const entrances = String(body.entrances || '').trim().slice(0, 20);
  const scope = String(body.scope || '人防 + 机器人').trim().slice(0, 30);
  const style = String(body.style || '正式方案').trim().slice(0, 20);
  const risks = Array.isArray(body.risks) ? body.risks.slice(0, 8).map(function (item) {
    return String(item).trim().slice(0, 30);
  }).filter(Boolean) : [];

  if (!school) {
    res.status(400).json({ error: '请填写学校名称' });
    return;
  }

  const prompt = [
    '你是校园安保方案工程师，擅长把人防、技防和巡逻机器人组合成可执行方案。',
    '请根据以下信息，写一份中文《校园安保服务方案（初稿）》，用于向学校领导汇报。',
    '',
    '学校名称：' + school,
    '学校类型：' + type,
    '学生人数：' + (students || '需现场核实'),
    '占地面积：' + (area || '需现场核实') + ' 平方米',
    '出入口数量：' + (entrances || '需现场核实'),
    '重点风险：' + (risks.length ? risks.join('、') : '需现场评估'),
    '服务范围：' + scope,
    '输出风格：' + style,
    '',
    '要求：',
    '1. 用 Markdown，二级标题分节：项目理解、风险分析、岗位与巡逻配置、机器人部署、巡检频次、应急处置、实施计划、报价边界、下一步。',
    '2. 具体、可执行，不要空话；数字要来自输入，不确定的写“需现场核实”。',
    '3. 不要编造法规条款、资质或案例；不要承诺无法验证的效果。',
    '4. 最后列出“需要学校确认的 5 个问题”。',
    '5. 控制在 1200 字以内。'
  ].join('\n');

  try {
    const aiResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是校园安保方案工程师，输出务实、可执行的中文方案。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 1600
      })
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      res.status(502).json({ error: 'AI 接口调用失败', detail: detail.slice(0, 300) });
      return;
    }

    const data = await aiResponse.json();
    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (!text) {
      res.status(502).json({ error: 'AI 返回了空内容，请重试' });
      return;
    }

    res.status(200).json({ text: text });
  } catch (err) {
    res.status(500).json({ error: '生成失败：' + (err.message || '请重试') });
  }
};
