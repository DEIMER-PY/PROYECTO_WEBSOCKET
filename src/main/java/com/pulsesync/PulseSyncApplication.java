package com.pulsesync;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada principal para el servidor de comunicación en tiempo real PulseSync.
 */
@SpringBootApplication
public class PulseSyncApplication {

    public static void main(String[] args) {
        SpringApplication.run(PulseSyncApplication.class, args);
    }
}
