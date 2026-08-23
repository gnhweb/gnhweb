import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const { data: authData } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };

    if (!authData.user) return json({ error: '로그인이 필요합니다.' }, 401);

    if (req.method === 'POST') {
      const body = await req.json();
      if (!body?.question_text) return json({ error: '제보할 문제 정보가 없습니다.' }, 400);

      const reporterName =
        authData.user.user_metadata?.name ||
        authData.user.user_metadata?.full_name ||
        authData.user.email?.split('@')[0] ||
        '익명';

      const { error } = await supabase.from('quiz_question_reports').insert({
        question_id: body.question_id || null,
        question_text: String(body.question_text).slice(0, 2000),
        question_options: Array.isArray(body.question_options) ? body.question_options : null,
        question_answer: body.question_answer ? String(body.question_answer).slice(0, 500) : null,
        reason: body.reason ? String(body.reason).slice(0, 300) : null,
        reporter_name: reporterName,
        status: 'pending',
      });

      if (error) throw error;
      return json({ success: true });
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      if (!body?.report_id) return json({ error: '제보 ID가 없습니다.' }, 400);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();
      const { data: extraRoles } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', authData.user.id);
      const allRoles = [roles?.role, ...(extraRoles || []).map((r: any) => r.role)].filter(Boolean);
      if (!allRoles.some((role) => ['teacher', 'chief'].includes(role))) {
        return json({ error: '교사 또는 부장만 제보를 처리할 수 있습니다.' }, 403);
      }

      const { error } = await supabase
        .from('quiz_question_reports')
        .update({ status: body.status || 'resolved' })
        .eq('id', body.report_id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('quiz-report error:', err);
    return json({ error: err instanceof Error ? err.message : '제보 처리 중 오류가 발생했습니다.' }, 500);
  }
});
