package com.accenture.smartquiz.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class BulkUploadResponse {

    private int totalRows;
    private int successCount;
    private int failureCount;
    private List<String> errors;

    /** Rows that were rejected because they matched an existing question too closely. */
    private List<BulkRowDuplicate> duplicates;

    @Getter
    @Builder
    public static class BulkRowDuplicate {
        private int rowNumber;
        private String questionStem;
        private double similarityPercent;
        private Long matchedId;
        private String matchedStem;
        private String matchedStatus;
    }
}
