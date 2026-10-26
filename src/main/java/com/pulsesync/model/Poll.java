package com.pulsesync.model;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Encuesta interactiva en tiempo real donde los usuarios conectados pueden votar una sola vez.
 */
public class Poll {
    private final String id;
    private final String question;
    private final List<PollOption> options;
    private final Set<String> votedSessionIds;

    public Poll(String id, String question, List<PollOption> options) {
        this.id = id;
        this.question = question;
        this.options = new ArrayList<>(options);
        this.votedSessionIds = ConcurrentHashMap.newKeySet();
    }

    public synchronized boolean vote(String sessionId, String optionId) {
        if (votedSessionIds.contains(sessionId)) {
            return false; // Ya votó
        }

        for (PollOption option : options) {
            if (option.getId().equals(optionId)) {
                option.incrementVote();
                votedSessionIds.add(sessionId);
                return true;
            }
        }
        return false;
    }

    public boolean hasVoted(String sessionId) {
        return votedSessionIds.contains(sessionId);
    }

    public int getTotalVotes() {
        return options.stream().mapToInt(PollOption::getVotes).sum();
    }

    public String getId() {
        return id;
    }

    public String getQuestion() {
        return question;
    }

    public List<PollOption> getOptions() {
        return Collections.unmodifiableList(options);
    }
}
