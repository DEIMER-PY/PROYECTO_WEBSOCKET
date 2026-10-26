package com.pulsesync.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pulsesync.model.WsMessage;
import com.pulsesync.service.RealtimeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

/**
 * Manejador principal de conexiones y mensajes de WebSocket nativo.
 */
@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(RealtimeWebSocketHandler.class);

    private final RealtimeService realtimeService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RealtimeWebSocketHandler(RealtimeService realtimeService) {
        this.realtimeService = realtimeService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("Conexión WebSocket establecida. Session ID: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            String payload = message.getPayload();
            WsMessage wsMsg = objectMapper.readValue(payload, WsMessage.class);

            if (wsMsg.getType() == null) {
                log.warn("Mensaje sin tipo recibido de {}: {}", session.getId(), payload);
                return;
            }

            switch (wsMsg.getType()) {
                case JOIN -> {
                    String username = wsMsg.getSender() != null ? wsMsg.getSender().trim() : "Anónimo";
                    String avatar = wsMsg.getAvatar() != null ? wsMsg.getAvatar() : "🚀";
                    realtimeService.registerUser(session, username, avatar, wsMsg.getRoomId());
                }
                case CHAT -> realtimeService.handleChatMessage(session.getId(), wsMsg.getContent());
                case TYPING -> {
                    boolean isTyping = true;
                    if (wsMsg.getPayload() instanceof Map<?, ?> map && map.containsKey("isTyping")) {
                        isTyping = Boolean.parseBoolean(map.get("isTyping").toString());
                    }
                    realtimeService.handleTyping(session.getId(), isTyping);
                }
                case REACTION -> {
                    if (wsMsg.getPayload() instanceof Map<?, ?> map) {
                        String msgId = (String) map.get("messageId");
                        String emoji = (String) map.get("emoji");
                        realtimeService.handleReaction(session.getId(), msgId, emoji);
                    }
                }
                case VOTE_POLL -> {
                    if (wsMsg.getPayload() instanceof Map<?, ?> map) {
                        String optId = (String) map.get("optionId");
                        realtimeService.handlePollVote(session.getId(), optId);
                    }
                }
                case CHANGE_ROOM -> realtimeService.switchRoom(session.getId(), wsMsg.getRoomId());
                default -> log.debug("Tipo de mensaje no controlado directamente: {}", wsMsg.getType());
            }
        } catch (Exception e) {
            log.error("Error procesando mensaje WebSocket de {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("Conexión WebSocket cerrada. Session ID: {}, Status: {}", session.getId(), status);
        realtimeService.removeUser(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("Error de transporte en sesión {}: {}", session.getId(), exception.getMessage());
        realtimeService.removeUser(session.getId());
    }
}
