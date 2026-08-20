package com.luckydraw.lottery;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class LotteryService {
    private final JdbcTemplate jdbcTemplate;

    public LotteryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public LotteryDtos.DrawResult draw(String slug, String openid) {
        validateOpenId(openid);

        ActivityLock activity = lockActivity(slug);
        if (!"ACTIVE".equals(activity.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "活动当前不可参与");
        }

        Optional<LotteryDtos.DrawResult> existing = findMyDraw(activity.id(), openid, true);
        if (existing.isPresent()) {
            return existing.get();
        }

        List<PrizeCandidate> candidates = jdbcTemplate.query(
                """
                SELECT id, level_name, name, image_url, remaining_stock
                FROM prize
                WHERE activity_id = ? AND enabled = TRUE AND remaining_stock > 0
                ORDER BY sort_order, id
                FOR UPDATE
                """,
                (rs, rowNum) -> new PrizeCandidate(
                        rs.getLong("id"),
                        rs.getString("level_name"),
                        rs.getString("name"),
                        rs.getString("image_url"),
                        rs.getInt("remaining_stock")
                ),
                activity.id()
        );

        long totalRemaining = candidates.stream().mapToLong(PrizeCandidate::remainingStock).sum();
        if (totalRemaining <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "本次活动奖品已全部抽完");
        }

        long ticket = ThreadLocalRandom.current().nextLong(totalRemaining);
        PrizeCandidate selected = selectCandidate(candidates, ticket);

        int updated = jdbcTemplate.update(
                "UPDATE prize SET remaining_stock = remaining_stock - 1 WHERE id = ? AND remaining_stock > 0",
                selected.id()
        );
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "奖品库存发生变化，请重试");
        }

        Instant drawnAt = Instant.now();
        jdbcTemplate.update(
                """
                INSERT INTO draw_record(
                    activity_id, openid, prize_id, prize_level_snapshot, prize_name_snapshot,
                    prize_image_snapshot, drawn_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                activity.id(),
                openid,
                selected.id(),
                selected.level(),
                selected.name(),
                selected.imageUrl(),
                Timestamp.from(drawnAt)
        );

        Long drawId = jdbcTemplate.queryForObject(
                "SELECT id FROM draw_record WHERE activity_id = ? AND openid = ?",
                Long.class,
                activity.id(),
                openid
        );

        return new LotteryDtos.DrawResult(
                drawId,
                selected.id(),
                selected.level(),
                selected.name(),
                selected.imageUrl(),
                drawnAt,
                false
        );
    }

    @Transactional(readOnly = true)
    public Optional<LotteryDtos.DrawResult> findMyDraw(String slug, String openid) {
        validateOpenId(openid);
        Long activityId = jdbcTemplate.query(
                "SELECT id FROM activity WHERE slug = ?",
                rs -> rs.next() ? rs.getLong("id") : null,
                slug
        );
        if (activityId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "活动不存在");
        }
        return findMyDraw(activityId, openid, true);
    }

    private ActivityLock lockActivity(String slug) {
        var rows = jdbcTemplate.query(
                "SELECT id, status FROM activity WHERE slug = ? FOR UPDATE",
                (rs, rowNum) -> new ActivityLock(rs.getLong("id"), rs.getString("status")),
                slug
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "活动不存在");
        }
        return rows.getFirst();
    }

    private Optional<LotteryDtos.DrawResult> findMyDraw(long activityId, String openid, boolean replayed) {
        List<LotteryDtos.DrawResult> rows = jdbcTemplate.query(
                """
                SELECT id, prize_id, prize_level_snapshot, prize_name_snapshot,
                       prize_image_snapshot, drawn_at
                FROM draw_record
                WHERE activity_id = ? AND openid = ?
                """,
                (rs, rowNum) -> new LotteryDtos.DrawResult(
                        rs.getLong("id"),
                        rs.getLong("prize_id"),
                        rs.getString("prize_level_snapshot"),
                        rs.getString("prize_name_snapshot"),
                        rs.getString("prize_image_snapshot"),
                        rs.getTimestamp("drawn_at").toInstant(),
                        replayed
                ),
                activityId,
                openid
        );
        return rows.stream().findFirst();
    }

    private PrizeCandidate selectCandidate(List<PrizeCandidate> candidates, long ticket) {
        long cursor = ticket;
        for (PrizeCandidate candidate : candidates) {
            if (cursor < candidate.remainingStock()) {
                return candidate;
            }
            cursor -= candidate.remainingStock();
        }
        throw new IllegalStateException("奖池权重计算异常");
    }

    private void validateOpenId(String openid) {
        if (openid == null || openid.isBlank() || openid.length() > 128) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户身份无效");
        }
    }

    private record ActivityLock(long id, String status) {
    }

    private record PrizeCandidate(long id, String level, String name, String imageUrl, int remainingStock) {
    }
}
