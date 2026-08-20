package com.luckydraw.lottery;

import java.time.Instant;

public final class LotteryDtos {
    private LotteryDtos() {
    }

    public record DrawResult(
            long drawId,
            long prizeId,
            String prizeLevel,
            String prizeName,
            String prizeImageUrl,
            Instant drawnAt,
            boolean replayed
    ) {
    }
}
