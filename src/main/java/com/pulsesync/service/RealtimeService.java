package com.pulsesync.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pulsesync.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Servicio central que gestiona el estado en tiempo real: usuarios, salas,
 * mensajes con historial acotado, encuestas interactivas y emisión WebSocket.
 */
@Service
public class RealtimeService {
    private static final Logger log = LoggerFactory.getLogger(RealtimeService.class);
    private static final int MAX_HISTORY_PER_ROOM = 100;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Sesiones activas: sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> wsSessions = new ConcurrentHashMap<>();
    // Metadatos de usuario: sessionId -> UserSession
    private final Map<String, UserSession> userSessions = new ConcurrentHashMap<>();

    // Salas disponibles: roomId -> Room
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    // Historial de mensajes: roomId -> List<ChatMessage>
    private final Map<String, List<ChatMessage>> roomHistories = new ConcurrentHashMap<>();

    // Encuesta interactiva activa
    private volatile Poll activePoll;

    public RealtimeService() {
        initDefaultRooms();
        initDefaultPoll();
    }

    private void initDefaultRooms() {
        Room rGeneral = new Room("general", "General", "💬", "Charla comunitaria y bienvenida");
        Room rTech = new Room("tecnologia", "Tecnología", "⚡", "Debates de desarrollo, Java y WebSockets");
        Room rAnnounce = new Room("anuncios", "Anuncios", "📢", "Noticias y actualizaciones importantes");
        Room rRandom = new Room("random", "Random", "🎲", "Memes, juegos y temas varios");

        rooms.put(rGeneral.getId(), rGeneral);
        rooms.put(rTech.getId(), rTech);
        rooms.put(rAnnounce.getId(), rAnnounce);
        rooms.put(rRandom.getId(), rRandom);

        rooms.keySet().forEach(id -> roomHistories.put(id, new CopyOnWriteArrayList<>()));

        // Mensaje de bienvenida inicial en #general
        ChatMessage welcomeMsg = new ChatMessage("general", "PulseSync Bot", "🤖",
                "¡Bienvenidos a la plataforma de comunicación en tiempo real PulseSync! 🚀");
        welcomeMsg.addReaction("👋");
        welcomeMsg.addReaction("🔥");
        roomHistories.get("general").add(welcomeMsg);
    }

    private void initDefaultPoll() {
        List<PollOption> options = List.of(
                new PollOption("opt-1", "WebSockets Nativos (Java / JS)"),
                new PollOption("opt-2", "Spring Boot + STOMP"),
                new PollOption("opt-3", "gRPC / HTTP/2 Streaming"),
                new PollOption("opt-4", "Server-Sent Events (SSE)")
        );
        activePoll = new Poll("poll-1", "¿Cuál es tu arquitectura favorita para tiempo real en 2026?", options);
    }

    public synchronized void registerUser(WebSocketSession wsSession, String username, String avatar, String requestedRoom) {
        String sessionId = wsSession.getId();
        wsSessions.put(sessionId, wsSession);

        String room = (requestedRoom != null && rooms.containsKey(requestedRoom)) ? requestedRoom : "general";
        UserSession userSession = new UserSession(sessionId, username, avatar, room);
        userSessions.put(sessionId, userSession);

        updateRoomCounts();

        // 1. Enviar configuración inicial al nuevo usuario
        sendToSession(wsSession, createMessage(MessageType.ROOM_LIST, null, rooms.values()));
        sendToSession(wsSession, createMessage(MessageType.HISTORY, room, roomHistories.getOrDefault(room, List.of())));
        sendToSession(wsSession, createMessage(MessageType.USER_LIST, room, getOnlineUsersInRoom(room)));
        sendToSession(wsSession, createMessage(MessageType.POLL_UPDATE, null, activePoll));

        // 2. Notificar a los demás usuarios de la sala
        WsMessage joinBroadcast = createMessage(MessageType.USER_JOINED, room, userSession);
        joinBroadcast.setSender(username);
        joinBroadcast.setAvatar(avatar);
        joinBroadcast.setContent(username + " se ha conectado a la sala.");
        broadcastToRoom(room, joinBroadcast, sessionId);

        // 3. Notificar actualización de usuarios y salas a todos
        broadcastRoomList();
        broadcastUserList(room);

        log.info("Usuario '{}' ({}) conectado en sala '{}'", username, sessionId, room);
    }

    public void handleChatMessage(String sessionId, String content) {
        UserSession user = userSessions.get(sessionId);
        if (user == null || content == null || content.trim().isEmpty()) {
            return;
        }

        String roomId = user.getCurrentRoom();
        ChatMessage msg = new ChatMessage(roomId, user.getUsername(), user.getAvatar(), content.trim());

        List<ChatMessage> history = roomHistories.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>());
        if (history.size() >= MAX_HISTORY_PER_ROOM) {
            history.remove(0);
        }
        history.add(msg);

        WsMessage wsMsg = createMessage(MessageType.CHAT, roomId, msg);
        wsMsg.setSender(user.getUsername());
        wsMsg.setAvatar(user.getAvatar());
        wsMsg.setContent(content.trim());
        broadcastToRoom(roomId, wsMsg, null);
    }

    public void handleTyping(String sessionId, boolean isTyping) {
        UserSession user = userSessions.get(sessionId);
        if (user == null) return;

        WsMessage msg = createMessage(MessageType.TYPING, user.getCurrentRoom(), Map.of(
                "username", user.getUsername(),
                "isTyping", isTyping
        ));
        msg.setSender(user.getUsername());
        broadcastToRoom(user.getCurrentRoom(), msg, sessionId);
    }

    public void handleReaction(String sessionId, String messageId, String emoji) {
        UserSession user = userSessions.get(sessionId);
        if (user == null || messageId == null || emoji == null) return;

        String roomId = user.getCurrentRoom();
        List<ChatMessage> history = roomHistories.get(roomId);
        if (history == null) return;

        ChatMessage targetMsg = history.stream()
                .filter(m -> m.getId().equals(messageId))
                .findFirst()
                .orElse(null);

        if (targetMsg != null) {
            targetMsg.addReaction(emoji);
            WsMessage msg = createMessage(MessageType.REACTION, roomId, Map.of(
                    "messageId", messageId,
                    "emoji", emoji,
                    "reactions", targetMsg.getReactions()
            ));
            broadcastToRoom(roomId, msg, null);
        }
    }

    public void switchRoom(String sessionId, String newRoomId) {
        UserSession user = userSessions.get(sessionId);
        WebSocketSession wsSession = wsSessions.get(sessionId);
        if (user == null || wsSession == null || !rooms.containsKey(newRoomId)) return;

        String oldRoom = user.getCurrentRoom();
        if (oldRoom.equals(newRoomId)) return;

        // Notificar salida de la sala previa
        WsMessage leaveMsg = createMessage(MessageType.USER_LEFT, oldRoom, user);
        leaveMsg.setContent(user.getUsername() + " cambió de sala.");
        broadcastToRoom(oldRoom, leaveMsg, sessionId);
        broadcastUserList(oldRoom);

        // Asignar nueva sala
        user.setCurrentRoom(newRoomId);
        updateRoomCounts();
        broadcastRoomList();

        // Enviar historial y usuarios de la nueva sala al usuario
        sendToSession(wsSession, createMessage(MessageType.HISTORY, newRoomId, roomHistories.getOrDefault(newRoomId, List.of())));
        sendToSession(wsSession, createMessage(MessageType.USER_LIST, newRoomId, getOnlineUsersInRoom(newRoomId)));

        // Notificar entrada en la nueva sala
        WsMessage enterMsg = createMessage(MessageType.USER_JOINED, newRoomId, user);
        enterMsg.setContent(user.getUsername() + " entró en la sala.");
        broadcastToRoom(newRoomId, enterMsg, sessionId);
        broadcastUserList(newRoomId);
    }

    public void handlePollVote(String sessionId, String optionId) {
        if (activePoll == null || optionId == null) return;

        boolean success = activePoll.vote(sessionId, optionId);
        if (success) {
            WsMessage msg = createMessage(MessageType.POLL_UPDATE, null, activePoll);
            broadcastToAll(msg);
        }
    }

    public synchronized void removeUser(String sessionId) {
        UserSession user = userSessions.remove(sessionId);
        wsSessions.remove(sessionId);

        if (user != null) {
            String room = user.getCurrentRoom();
            updateRoomCounts();

            WsMessage leftMsg = createMessage(MessageType.USER_LEFT, room, user);
            leftMsg.setContent(user.getUsername() + " se ha desconectado.");
            broadcastToRoom(room, leftMsg, null);

            broadcastRoomList();
            broadcastUserList(room);
            log.info("Usuario '{}' desconectado.", user.getUsername());
        }
    }

    public List<UserSession> getOnlineUsersInRoom(String roomId) {
        return userSessions.values().stream()
                .filter(u -> roomId.equals(u.getCurrentRoom()))
                .toList();
    }

    private void updateRoomCounts() {
        for (Room room : rooms.values()) {
            long count = userSessions.values().stream()
                    .filter(u -> room.getId().equals(u.getCurrentRoom()))
                    .count();
            room.setOnlineCount((int) count);
        }
    }

    public void broadcastRoomList() {
        WsMessage msg = createMessage(MessageType.ROOM_LIST, null, rooms.values());
        broadcastToAll(msg);
    }

    public void broadcastUserList(String roomId) {
        WsMessage msg = createMessage(MessageType.USER_LIST, roomId, getOnlineUsersInRoom(roomId));
        broadcastToRoom(roomId, msg, null);
    }

    public void broadcastToRoom(String roomId, WsMessage message, String excludeSessionId) {
        String json = toJson(message);
        if (json == null) return;

        TextMessage textMsg = new TextMessage(json);
        for (UserSession user : userSessions.values()) {
            if (roomId.equals(user.getCurrentRoom())) {
                String sid = user.getSessionId();
                if (excludeSessionId != null && excludeSessionId.equals(sid)) {
                    continue;
                }
                WebSocketSession session = wsSessions.get(sid);
                if (session != null && session.isOpen()) {
                    try {
                        session.sendMessage(textMsg);
                    } catch (IOException e) {
                        log.warn("Error enviando mensaje a sesión {}: {}", sid, e.getMessage());
                    }
                }
            }
        }
    }

    public void broadcastToAll(WsMessage message) {
        String json = toJson(message);
        if (json == null) return;

        TextMessage textMsg = new TextMessage(json);
        for (WebSocketSession session : wsSessions.values()) {
            if (session != null && session.isOpen()) {
                try {
                    session.sendMessage(textMsg);
                } catch (IOException e) {
                    log.warn("Error enviando broadcast a sesión {}: {}", session.getId(), e.getMessage());
                }
            }
        }
    }

    public void sendToSession(WebSocketSession session, WsMessage message) {
        if (session != null && session.isOpen()) {
            String json = toJson(message);
            if (json != null) {
                try {
                    session.sendMessage(new TextMessage(json));
                } catch (IOException e) {
                    log.warn("Error enviando mensaje directo a {}: {}", session.getId(), e.getMessage());
                }
            }
        }
    }

    private WsMessage createMessage(MessageType type, String roomId, Object payload) {
        WsMessage msg = new WsMessage();
        msg.setType(type);
        msg.setRoomId(roomId);
        msg.setPayload(payload);
        return msg;
    }

    public String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.error("Error serializando JSON: {}", e.getMessage());
            return null;
        }
    }

    public Poll getActivePoll() {
        return activePoll;
    }

    public Map<String, Room> getRooms() {
        return rooms;
    }
}
