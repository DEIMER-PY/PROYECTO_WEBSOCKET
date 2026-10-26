package com.pulsesync.model;

import java.time.Instant;

/**
 * Representa la sesión y datos de perfil de un usuario conectado.
 */
public class UserSession {
    private final String sessionId;
    private String username;
    private String avatar;
    private String currentRoom;
    private final String joinedAt;

    public UserSession(String sessionId, String username, String avatar, String currentRoom) {
        this.sessionId = sessionId;
        this.username = username;
        this.avatar = avatar;
        this.currentRoom = currentRoom;
        this.joinedAt = Instant.now().toString();
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getCurrentRoom() {
        return currentRoom;
    }

    public void setCurrentRoom(String currentRoom) {
        this.currentRoom = currentRoom;
    }

    public String getJoinedAt() {
        return joinedAt;
    }
}
