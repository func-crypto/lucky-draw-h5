package com.luckydraw.lottery;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class LotteryServiceTest {
    @Autowired
    private LotteryService lotteryService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetPool() {
        jdbcTemplate.update("DELETE FROM draw_record");
        jdbcTemplate.update("UPDATE prize SET remaining_stock = initial_stock WHERE activity_id = 1");
    }

    @Test
    void sameUserOnlyConsumesOnePrize() {
        var first = lotteryService.draw("demo", "wx-user-a");
        var second = lotteryService.draw("demo", "wx-user-a");

        assertThat(second.drawId()).isEqualTo(first.drawId());
        assertThat(second.prizeId()).isEqualTo(first.prizeId());
        assertThat(second.replayed()).isTrue();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM draw_record", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT SUM(remaining_stock) FROM prize", Integer.class)).isEqualTo(259);
    }

    @Test
    void poolNeverOversellsAndEventuallyExhaustsExactInventory() {
        Map<String, Integer> winners = new HashMap<>();
        for (int i = 0; i < 260; i++) {
            var result = lotteryService.draw("demo", "wx-user-" + i);
            winners.merge(result.prizeName(), 1, Integer::sum);
        }

        assertThat(winners.getOrDefault("音响", 0)).isEqualTo(20);
        assertThat(winners.getOrDefault("咖啡杯", 0)).isEqualTo(50);
        assertThat(winners.getOrDefault("黄麻手提袋", 0)).isEqualTo(80);
        assertThat(winners.getOrDefault("小花盆", 0)).isEqualTo(110);
        assertThat(jdbcTemplate.queryForObject("SELECT SUM(remaining_stock) FROM prize", Integer.class)).isZero();

        assertThrows(ResponseStatusException.class,
                () -> lotteryService.draw("demo", "wx-user-overflow"));
    }
}
