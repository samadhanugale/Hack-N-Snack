package com.accenture.smartquiz.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class BulkDecisionResponse {

    private int processed;
    private int skipped;
    private List<String> skippedReasons;
}
