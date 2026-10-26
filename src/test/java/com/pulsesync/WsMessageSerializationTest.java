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
}
