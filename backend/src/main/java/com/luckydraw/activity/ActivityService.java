package com.luckydraw.activity;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ActivityService {
    private final JdbcTemplate jdbcTemplate;

    public ActivityService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public ActivityDtos.ActivityView getBySlug(String slug) {
        var activities = jdbcTemplate.query(
                "SELECT id, slug, name, status FROM activity WHERE slug = ?",
                (rs, rowNum) -> new ActivityRow(
                        rs.getLong("id"),
                        rs.getString("slug"),
                        rs.getString("name"),
                        rs.getString("status")
                ),
                slug
        );

        if (activities.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "活动不存在");
        }

        ActivityRow activity = activities.getFirst();
        List<ActivityDtos.PrizeView> prizes = jdbcTemplate.query(
                """
                SELECT id, level_name, name, image_url, initial_stock, remaining_stock
                FROM prize
                WHERE activity_id = ? AND enabled = TRUE
                ORDER BY sort_order, id
                """,
                (rs, rowNum) -> new ActivityDtos.PrizeView(
                        rs.getLong("id"),
                        rs.getString("level_name"),
                        rs.getString("name"),
                        rs.getString("image_url"),
                        rs.getInt("initial_stock"),
                        rs.getInt("remaining_stock")
                ),
                activity.id()
        );

        int totalStock = prizes.stream().mapToInt(ActivityDtos.PrizeView::initialStock).sum();
        int remainingStock = prizes.stream().mapToInt(ActivityDtos.PrizeView::remainingStock).sum();

        return new ActivityDtos.ActivityView(
                activity.id(),
                activity.slug(),
                activity.name(),
                activity.status(),
                totalStock,
                remainingStock,
                prizes
        );
    }

    private record ActivityRow(long id, String slug, String name, String status) {
    }
}
