package com.luckydraw.lottery;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/activities")
public class LotteryController {
    private final LotteryService lotteryService;

    public LotteryController(LotteryService lotteryService) {
        this.lotteryService = lotteryService;
    }

    @GetMapping("/{slug}/me")
    public ResponseEntity<LotteryDtos.DrawResult> myResult(
            @PathVariable String slug,
            @RequestHeader("X-User-OpenId") String openid
    ) {
        return lotteryService.findMyDraw(slug, openid)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/{slug}/draw")
    public LotteryDtos.DrawResult draw(
            @PathVariable String slug,
            @RequestHeader("X-User-OpenId") String openid
    ) {
        return lotteryService.draw(slug, openid);
    }
}
