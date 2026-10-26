package com.pulsesync;

import com.pulsesync.model.ChatMessage;
import com.pulsesync.model.Poll;
import com.pulsesync.model.PollOption;
import com.pulsesync.model.Room;
import com.pulsesync.service.RealtimeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RealtimeServiceTest {

    private RealtimeService realtimeService;

    @BeforeEach
    void setUp() {
        realtimeService = new RealtimeService();
    }

    @Test
    @DisplayName("Debe inicializar las salas por defecto correctamente")
    void testInitialRooms() {
        Map<String, Room> rooms = realtimeService.getRooms();
        assertNotNull(rooms);
        assertEquals(4, rooms.size());
        assertTrue(rooms.containsKey("general"));
        assertTrue(rooms.containsKey("tecnologia"));
        assertTrue(rooms.containsKey("anuncios"));
        assertTrue(rooms.containsKey("random"));
    }

    @Test
    @DisplayName("Debe inicializar la encuesta en vivo con opciones válidas")
    void testInitialPoll() {
        Poll poll = realtimeService.getActivePoll();
        assertNotNull(poll);
        assertEquals("poll-1", poll.getId());
        assertEquals(4, poll.getOptions().size());
        assertEquals(0, poll.getTotalVotes());
    }

    @Test
    @DisplayName("Debe registrar votos en la encuesta y prevenir votos duplicados por sesión")
    void testPollVoting() {
        Poll poll = realtimeService.getActivePoll();
        String sessionId1 = "session-abc-1";
        String sessionId2 = "session-abc-2";

        // Voto 1
        boolean vote1 = poll.vote(sessionId1, "opt-1");
        assertTrue(vote1, "El primer voto debe ser aceptado");
        assertEquals(1, poll.getTotalVotes());
        assertTrue(poll.hasVoted(sessionId1));

        // Intento de doble voto por la misma sesión
        boolean duplicateVote = poll.vote(sessionId1, "opt-2");
        assertFalse(duplicateVote, "No debe permitir votar dos veces con la misma sesión");
        assertEquals(1, poll.getTotalVotes());

        // Voto 2 por otra sesión
        boolean vote2 = poll.vote(sessionId2, "opt-2");
        assertTrue(vote2, "El voto de otra sesión debe ser aceptado");
        assertEquals(2, poll.getTotalVotes());
    }

    @Test
    @DisplayName("Debe registrar y acumular reacciones en mensajes de chat")
    void testChatMessageReactions() {
        ChatMessage msg = new ChatMessage("general", "Alex", "🚀", "Hola mundo");
        assertEquals(0, msg.getReactions().size());

        msg.addReaction("🔥");
        assertEquals(1, msg.getReactions().get("🔥"));

        msg.addReaction("🔥");
        assertEquals(2, msg.getReactions().get("🔥"));

        msg.addReaction("👍");
        assertEquals(1, msg.getReactions().get("👍"));
    }
}
