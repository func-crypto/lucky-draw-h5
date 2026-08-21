import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const { userKey } = await req.json();

  if (!userKey) {
    return Response.json({ error: 'user_key_required' }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('draw_lucky_prize', {
    p_user_key: userKey
  });

  if (error) {
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 409 }
    );
  }

  return Response.json(data);
});
