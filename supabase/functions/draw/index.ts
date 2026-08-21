import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const { userKey } = await req.json();

  if (!userKey) {
    return new Response(JSON.stringify({ error: 'user_key_required' }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: exists } = await supabase
    .from('draw_records')
    .select('id, verify_code')
    .eq('user_key', userKey)
    .maybeSingle();

  if (exists) {
    return Response.json({
      success: true,
      verifyCode: exists.verify_code,
      repeated: true
    });
  }

  return Response.json({
    success: false,
    message: 'draw_logic_pending'
  });
});
