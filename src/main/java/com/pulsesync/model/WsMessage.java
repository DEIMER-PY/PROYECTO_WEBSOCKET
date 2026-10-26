package com.pulsesync.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Envoltorio estándar de mensajes WebSocket intercambiados entre cliente y servidor.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WsMessage {
    private MessageType type;
    private String roomId;
    private String sender;
    private String avatar;
    private String content;
    private String timestamp;
    private Object payload;

    public WsMessage() {
        this.timestamp = Instant.now().toString();
    }

    public WsMessage(MessageType type, String content) {
        this();
        this.type = type;
        this.content = content;
    }

    public static WsMessage of(MessageType type) {
        WsMessage msg = new WsMessage();
        msg.setType(type);
        return msg;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public Object getPayload() {
        return payload;
    }

    public void setPayload(Object payload) {
        this.payload = payload;
    }
}
