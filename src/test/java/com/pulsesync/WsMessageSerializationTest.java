package com.pulsesync;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pulsesync.model.MessageType;
import com.pulsesync.model.WsMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WsMessageSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Debe serializar y deserializar WsMessage correctamente")
    void testMessageSerialization() throws Exception {
        WsMessage msg = new WsMessage(MessageType.CHAT, "Mensaje de prueba");
        msg.setRoomId("general");
        msg.setSender("UsuarioTest");
        msg.setAvatar("⚡");
        msg.setPayload(Map.of("key", "value"));

        String json = objectMapper.writeValueAsString(msg);
        assertNotNull(json);
        assertTrue(json.contains("\"type\":\"CHAT\""));
        assertTrue(json.contains("\"sender\":\"UsuarioTest\""));

        WsMessage deserialized = objectMapper.readValue(json, WsMessage.class);
        assertEquals(MessageType.CHAT, deserialized.getType());
        assertEquals("general", deserialized.getRoomId());
        assertEquals("UsuarioTest", deserialized.getSender());
        assertEquals("⚡", deserialized.getAvatar());
        assertEquals("Mensaje de prueba", deserialized.getContent());
    }

    @Test
    @DisplayName("Debe serializar y deserializar CALL_SIGNAL para WebRTC")
    void testCallSignalSerialization() throws Exception {
        WsMessage signal = new WsMessage(MessageType.CALL_SIGNAL, "Oferta de llamada");
        signal.setRoomId("general");
        signal.setPayload(Map.of("signalType", "offer", "sdp", "v=0..."));

        String json = objectMapper.writeValueAsString(signal);
        assertTrue(json.contains("\"type\":\"CALL_SIGNAL\""));

        WsMessage deserialized = objectMapper.readValue(json, WsMessage.class);
        assertEquals(MessageType.CALL_SIGNAL, deserialized.getType());
        assertNotNull(deserialized.getPayload());
    }
}
