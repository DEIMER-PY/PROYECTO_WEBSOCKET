package com.pulsesync.model;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Modelo de mensaje de chat persistido en el historial de la sala.
 */
public class ChatMessage {
    private final String id;
    private final String roomId;
    private final String sender;
    private final String avatar;
    private final String content;
    private final String timestamp;
    private final Map<String, Integer> reactions; // emoji -> count

    public ChatMessage(String roomId, String sender, String avatar, String content) {
        this.id = UUID.randomUUID().toString();
        this.roomId = roomId;
        this.sender = sender;
        this.avatar = avatar;
        this.content = content;
        this.timestamp = Instant.now().toString();
        this.reactions = new ConcurrentHashMap<>();
    }

    public synchronized void addReaction(String emoji) {
        reactions.merge(emoji, 1, Integer::sum);
    }

    public String getId() {
        return id;
    }

    public String getRoomId() {
        return roomId;
    }

    public String getSender() {
        return sender;
    }

    public String getAvatar() {
        return avatar;
    }

    public String getContent() {
        return content;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public Map<String, Integer> getReactions() {
        return reactions;
    }
}
