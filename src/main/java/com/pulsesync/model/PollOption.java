package com.pulsesync.model;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Opción de una encuesta interactiva.
 */
public class PollOption {
    private final String id;
    private final String text;
    private final AtomicInteger votes;

    public PollOption(String id, String text) {
        this.id = id;
        this.text = text;
        this.votes = new AtomicInteger(0);
    }

    public void incrementVote() {
        votes.incrementAndGet();
    }

    public String getId() {
        return id;
    }

    public String getText() {
        return text;
    }

    public int getVotes() {
        return votes.get();
    }
}
