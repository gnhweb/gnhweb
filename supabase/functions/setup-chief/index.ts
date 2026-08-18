

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: existingChief, error: checkError } = await supabaseAdmin.from('user_roles').select('user_id, name').eq('role', 'chief').eq('is_active', true).maybeSingle();
    if (checkError) return new Response(JSON.stringify({ error: '계정 확인 중 오류가 발생했습니다' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (existingChief) return new Response(JSON.stringify({ error: '이미 부장 계정이 존재합니다: ' + existingChief.name }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { email, password, name, gender } = await req.json();
    if (!email || !password || !name) return new Response(JSON.stringify({ error: '이메일, 비밀번호, 이름을 모두 입력해주세요' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (password.length < 8) return new Response(JSON.stringify({ error: '비밀번호는 8자 이상이어야 합니다' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role: 'chief', gender: gender || null } });
    if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!authData.user) return new Response(JSON.stringify({ error: '사용자 생성에 실패했습니다' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({ user_id: authData.user.id, role: 'chief', name, club: null, zone: null, gender: gender || null, is_active: true });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: '권한 설정 중 오류: ' + roleError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, message: '부장 계정이 성공적으로 생성되었습니다. 로그인 페이지로 이동합니다.', email, name }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

