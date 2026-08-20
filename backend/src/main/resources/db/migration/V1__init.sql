CREATE TABLE activity (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL,
    start_at TIMESTAMP NULL,
    end_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_activity_slug UNIQUE (slug)
);

CREATE TABLE prize (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT NOT NULL,
    level_name VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    image_url VARCHAR(512) NULL,
    initial_stock INT NOT NULL,
    remaining_stock INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prize_activity FOREIGN KEY (activity_id) REFERENCES activity(id),
    CONSTRAINT ck_prize_initial_stock CHECK (initial_stock >= 0),
    CONSTRAINT ck_prize_remaining_stock CHECK (remaining_stock >= 0)
);

CREATE TABLE draw_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT NOT NULL,
    openid VARCHAR(128) NOT NULL,
    prize_id BIGINT NOT NULL,
    prize_level_snapshot VARCHAR(64) NOT NULL,
    prize_name_snapshot VARCHAR(128) NOT NULL,
    prize_image_snapshot VARCHAR(512) NULL,
    drawn_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_draw_activity FOREIGN KEY (activity_id) REFERENCES activity(id),
    CONSTRAINT fk_draw_prize FOREIGN KEY (prize_id) REFERENCES prize(id),
    CONSTRAINT uk_draw_activity_openid UNIQUE (activity_id, openid)
);

CREATE INDEX idx_draw_activity_time ON draw_record(activity_id, drawn_at);
CREATE INDEX idx_prize_activity ON prize(activity_id);

INSERT INTO activity(id, slug, name, status) VALUES (1, 'demo', '幸运现场抽奖', 'ACTIVE');

INSERT INTO prize(activity_id, level_name, name, image_url, initial_stock, remaining_stock, sort_order, enabled) VALUES
(1, '一等奖', '音响', NULL, 20, 20, 10, TRUE),
(1, '二等奖', '咖啡杯', NULL, 50, 50, 20, TRUE),
(1, '三等奖', '黄麻手提袋', NULL, 80, 80, 30, TRUE),
(1, '幸运奖', '小花盆', NULL, 110, 110, 40, TRUE);
