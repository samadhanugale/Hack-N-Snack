package com.accenture.smartquiz.dto.request;

import java.util.List;

/** Self-service: the current user sets which technology stacks they're skilled in. */
public record UpdateMyStacksRequest(List<Long> stackIds) {
}
