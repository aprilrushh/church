// 화면에서 쓸 공개 설정값(공개키만). 비밀키는 절대 여기 넣지 않음.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    aiEnabled: !!(process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY)
  }));
};
