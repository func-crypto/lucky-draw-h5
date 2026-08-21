export type Prize = {
  id: string;
  name: string;
  remain_count: number;
};

export class LotteryError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function pickPrize(prizes: Prize[]): Prize {
  const available = prizes.filter((p) => p.remain_count > 0);

  if (available.length === 0) {
    throw new LotteryError('SOLD_OUT', '奖品已抽完');
  }

  const total = available.reduce((sum, item) => sum + item.remain_count, 0);
  let ticket = crypto.getRandomValues(new Uint32Array(1))[0] % total;

  for (const prize of available) {
    if (ticket < prize.remain_count) {
      return prize;
    }
    ticket -= prize.remain_count;
  }

  return available[available.length - 1];
}

export function createVerifyCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
