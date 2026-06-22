package com.accenture.smartquiz;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmartQuizAiHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartQuizAiHubApplication.class, args);
    }
}
