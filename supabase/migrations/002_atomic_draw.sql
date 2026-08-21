create or replace function draw_lucky_prize(p_user_key text)
returns json
language plpgsql
security definer
as $$
declare
  existing_record draw_records%rowtype;
  selected_prize prizes%rowtype;
  verify text;
begin
  if p_user_key is null or trim(p_user_key) = '' then
    raise exception 'user_key_required';
  end if;

  select * into existing_record
  from draw_records
  where user_key = p_user_key;

  if found then
    return json_build_object(
      'success', true,
      'repeated', true,
      'verifyCode', existing_record.verify_code,
      'prizeId', existing_record.prize_id
    );
  end if;

  select * into selected_prize
  from prizes
  where remain_count > 0
  order by random()
  limit 1
  for update;

  if not found then
    raise exception 'sold_out';
  end if;

  update prizes
  set remain_count = remain_count - 1
  where id = selected_prize.id
    and remain_count > 0;

  verify := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into draw_records(user_key, prize_id, verify_code)
  values(p_user_key, selected_prize.id, verify);

  return json_build_object(
    'success', true,
    'repeated', false,
    'prizeId', selected_prize.id,
    'prizeName', selected_prize.name,
    'verifyCode', verify
  );
end;
$$;
