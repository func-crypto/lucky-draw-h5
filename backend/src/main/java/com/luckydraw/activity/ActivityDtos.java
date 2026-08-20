package com.luckydraw.activity;

import java.util.List;

public final class ActivityDtos {
    private ActivityDtos() {
    }

    public record PrizeView(
            long id,
            String level,
            String name,
            String imageUrl,
            int initialStock,
            int remainingStock
    ) {
    }

    public record ActivityView(
            long id,
            String slug,
            String name,
            String status,
            int totalStock,
            int remainingStock,
            List<PrizeView> prizes
    ) {
    }
}
