const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tvueqmyfsxefpazprxbj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0Z6OGBS2Lxj59_EIYYCTDQ_f6DxsPBd';

function termsFromQuestion(question) {
  const clean = String(question || '').replace(/[^\p{Script=Han}a-zA-Z0-9]+/gu, ' ');
  const parts = clean.split(/\s+/).filter(Boolean);
  const terms = new Set();
  parts.forEach(function (part) {
    if (/^[a-zA-Z0-9]+$/.test(part)) {
      if (part.length >= 2) terms.add(part.toLowerCase());
      return;
    }
    const chars = Array.from(part);
    for (let i = 0; i < chars.length - 1; i += 1) {
      terms.add(chars[i] + chars[i + 1]);
    }
    for (let i = 0; i < chars.length - 2; i += 1) {
      terms.add(chars[i] + chars[i + 1] + chars[i + 2]);
    }
  });
  return Array.from(terms).filter(function (term) { return term.length >= 2; });
}

function splitChunks(doc) {
  const pieces = String(doc.content || '')
    .split(/\n\s*\n/)
    .map(function (part) { return part.trim(); })
    .filter(Boolean);
  const chunks = [];
  let current = '';

  pieces.forEach(function (piece) {
    if (piece.length > 700) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < piece.length; i += 650) {
        chunks.push(piece.slice(i, i + 650));
      }
      return;
    }
    if (current && (current + '\n\n' + piece).length > 650) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? current + '\n\n' + piece : piece;
    }
  });

  if (current) chunks.push(current);

  return chunks.map(function (content, index) {
    return {
      key: doc.id + '-' + index,
      docId: doc.id,
      title: doc.title,
      content: content
    };
  });
}

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
      Authorization: '***' + token
    }
  });
  if (!userResponse.ok) {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return;
  }

  const question = String((req.body || {}).question || '').trim().slice(0, 500);
  if (!question) {
    res.status(400).json({ error: '请先输入问题' });
    return;
  }

  const docsResponse = await fetch(
    SUPABASE_URL + '/rest/v1/knowledge_documents?select=id,title,content,created_at&order=created_at.desc&limit=50',
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: '***' + token
      }
    }
  );

  if (!docsResponse.ok) {
    const detail = await docsResponse.text();
    res.status(502).json({ error: '读取知识库失败', detail: detail.slice(0, 300) });
    return;
  }

  const docs = await docsResponse.json();
  if (!Array.isArray(docs) || !docs.length) {
    res.status(200).json({
      answer: '知识库还没有文档。先在左侧添加公司制度、资质或案例，再提问。',
      sources: []
    });
    return;
  }

  const terms = termsFromQuestion(question);
  const chunks = [];
  docs.forEach(function (doc) {
    splitChunks(doc).forEach(function (chunk) { chunks.push(chunk); });
  });

  const scored = chunks.map(function (chunk) {
    const haystack = (chunk.title + ' ' + chunk.content).toLowerCase();
    let score = 0;
    terms.forEach(function (term) {
      if (haystack.includes(term)) {
        score += term.length >= 3 ? 3 : 1;
      }
    });
    if (chunk.title.toLowerCase().includes(question.toLowerCase())) score += 5;
    return Object.assign({ score: score }, chunk);
  }).filter(function (chunk) {
    return chunk.score > 0;
  }).sort(function (a, b) {
    return b.score - a.score;
  }).slice(0, 5);

  if (!scored.length) {
    res.status(200).json({
      answer: '知识库里没有找到和这个问题直接相关的内容。可以换一个问法，或者先把相关资料补进知识库。',
      sources: []
    });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: '还没有配置 DeepSeek API Key' });
    return;
  }

  const context = scored.map(function (chunk, index) {
    return '[' + (index + 1) + '] 标题：' + chunk.title + '\n内容：' + chunk.content;
  }).join('\n\n');

  const prompt = [
    '你是中安安防的投标与制度问答助手。',
    '请只根据下面的资料回答，不要编造资料里没有的内容。',
    '',
    '资料：',
    context,
    '',
    '问题：' + question,
    '',
    '要求：',
    '1. 先给结论，再给依据。',
    '2. 每个关键结论后面用 [1][2] 这样的编号标注来源。',
    '3. 资料里没有写到的，直接说“资料里没有”，不要猜。',
    '4. 不要编造法规条款、资质、案例或价格。',
    '5. 控制在 400 字以内。'
  ].join('\n');

  try {
    const aiResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: '***' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是严谨的投标与制度问答助手，只依据给定资料回答。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 900
      })
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      res.status(502).json({ error: 'AI 接口调用失败', detail: detail.slice(0, 300) });
      return;
    }

    const data = await aiResponse.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    const sources = scored.map(function (chunk, index) {
      return {
        index: index + 1,
        title: chunk.title,
        snippet: chunk.content.slice(0, 160)
      };
    });

    res.status(200).json({ answer: answer, sources: sources });
  } catch (err) {
    res.status(500).json({ error: '问答失败：' + (err.message || '请重试') });
  }
};
