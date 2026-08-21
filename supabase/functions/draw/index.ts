import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createVerifyCode, pickPrize } from './lottery.ts';

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

  const { data: exists } = await supabase
    .from('draw_records')
    .select('id, verify_code, prize_id')
    .eq('user_key', userKey)
    .maybeSingle();

  if (exists) {
    return Response.json({
      success: true,
      repeated: true,
      verifyCode: exists.verify_code,
      prizeId: exists.prize_id
    });
  }

  const { data: prizes, error: prizeError } = await supabase
    .from('prizes')
    .select('id,name,remain_count')
    .gt('remain_count', 0);

  if (prizeError || !prizes) {
    return Response.json({ error: 'prize_query_failed' }, { status: 500 });
  }

  const prize = pickPrize(prizes);

  const { data: updated, error: updateError } = await supabase
    .from('prizes')
    .update({ remain_count: prize.remain_count - 1 })
    .eq('id', prize.id)
    .gt('remain_count', 0)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    return Response.json({ error: 'draw_conflict' }, { status: 409 });
  }

  const verifyCode = createVerifyCode();

  const { error: insertError } = await supabase
    .from('draw_records')
    .insert({
      user_key: userKey,
      prize_id: prize.id,
      verify_code: verifyCode
    });

  if (insertError) {
    return Response.json({ error: 'record_failed' }, { status: 500 });
  }

  return Response.json({
    success: true,
    repeated: false,
    prizeId: prize.id,
    prizeName: prize.name,
    verifyCode
  });
});
