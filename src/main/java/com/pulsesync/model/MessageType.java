package com.pulsesync.model;

/**
 * Tipos de mensajes y eventos en el protocolo WebSocket de PulseSync.
 */
public enum MessageType {
    JOIN,            // Cliente solicita unirse
    USER_JOINED,     // Servidor notifica que un usuario se unió
    USER_LEFT,       // Servidor notifica que un usuario se desconectó
    USER_LIST,       // Lista de usuarios en línea
    CHAT,            // Mensaje de chat
    HISTORY,         // Historial de mensajes de la sala
    TYPING,          // Indicador de "escribiendo..."
    REACTION,        // Reacción con emoji a un mensaje
    VOTE_POLL,       // Voto en la encuesta en vivo
    POLL_UPDATE,     // Actualización del estado de la encuesta
    ROOM_LIST,       // Lista de salas disponibles y participantes
    CHANGE_ROOM,     // Cambio de sala activa por el cliente
    CALL_SIGNAL,     // Señalización WebRTC (llamadas de audio/video y pantalla compartida)
    CALL_STATE,      // Estado de participantes en llamada dentro de la sala
    ERROR            // Notificación de error
}
