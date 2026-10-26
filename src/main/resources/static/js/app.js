/**
 * ==========================================================================
 * PULSESYNC - CLIENTE WEBSOCKET & LOGICA DE INTERFAZ EN TIEMPO REAL
 * ==========================================================================
 */

(function () {
    'use strict';

    // --- ESTADO DE LA APLICACIÓN ---
    const state = {
        socket: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        reconnectTimer: null,
        
        currentUser: {
            username: localStorage.getItem('pulse_username') || '',
            avatar: localStorage.getItem('pulse_avatar') || '🚀',
            room: 'general'
        },
        
        activeRoom: 'general',
        rooms: [],
        onlineUsers: [],
        poll: null,
        userVotedPoll: false,
        
        soundEnabled: localStorage.getItem('pulse_sound') !== 'false',
        theme: localStorage.getItem('pulse_theme') || 'dark',
        
        typingUsers: new Set(),
        typingTimer: null
    };

    // --- ELEMENTOS DOM ---
    const DOM = {
        // Modal
        joinModal: document.getElementById('joinModal'),
        joinForm: document.getElementById('joinForm'),
        usernameInput: document.getElementById('usernameInput'),
        avatarSelector: document.getElementById('avatarSelector'),
        initialRoomSelect: document.getElementById('initialRoomSelect'),
        
        // Status & User
        connectionStatus: document.getElementById('connectionStatus'),
        statusText: document.getElementById('statusText'),
        currentUserName: document.getElementById('currentUserName'),
        currentUserAvatar: document.getElementById('currentUserAvatar'),
        
        // Layout & Navigation
        sidebar: document.getElementById('sidebar'),
        infoPanel: document.getElementById('infoPanel'),
        mobileBackdrop: document.getElementById('mobileBackdrop'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        mobileMembersBtn: document.getElementById('mobileMembersBtn'),
        mobilePollBtn: document.getElementById('mobilePollBtn'),
        mobileTabs: document.querySelectorAll('.mobile-tab-btn'),
        
        // Rooms
        roomList: document.getElementById('roomList'),
        activeRoomTitle: document.getElementById('activeRoomTitle'),
        activeRoomDesc: document.getElementById('activeRoomDesc'),
        activeRoomIcon: document.getElementById('activeRoomIcon'),
        roomOnlineCount: document.getElementById('roomOnlineCount'),
        totalRoomsBadge: document.getElementById('totalRoomsBadge'),
        
        // Poll
        pollCard: document.getElementById('pollCard'),
        pollHeaderToggle: document.getElementById('pollHeaderToggle'),
        pollQuestion: document.getElementById('pollQuestion'),
        pollTotalVotes: document.getElementById('pollTotalVotes'),
        pollOptionsContainer: document.getElementById('pollOptionsContainer'),
        
        // Chat
        messagesContainer: document.getElementById('messagesContainer'),
        messagesLoading: document.getElementById('messagesLoading'),
        messagesList: document.getElementById('messagesList'),
        typingIndicator: document.getElementById('typingIndicator'),
        typingText: document.getElementById('typingText'),
        chatForm: document.getElementById('chatForm'),
        messageInput: document.getElementById('messageInput'),
        quickEmojiBtns: document.querySelectorAll('.emoji-chip'),
        
        // Members & Activity
        usersList: document.getElementById('usersList'),
        infoMembersCount: document.getElementById('infoMembersCount'),
        activityFeed: document.getElementById('activityFeed'),
        
        // Controls
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        themeIcon: document.getElementById('themeIcon'),
        soundToggleBtn: document.getElementById('soundToggleBtn'),
        soundIcon: document.getElementById('soundIcon'),
        toastContainer: document.getElementById('toastContainer')
    };

    // --- MOTOR DE SONIDO PROCEDURAL (WEB AUDIO API) ---
    const SoundEngine = {
        ctx: null,
        init() {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        play(freq, type = 'sine', duration = 0.1, gain = 0.1) {
            if (!state.soundEnabled) return;
            try {
                this.init();
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                g.gain.setValueAtTime(gain, this.ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(g);
                g.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                // Audio no disponible
            }
        },
        messageReceived() {
            this.play(587.33, 'sine', 0.12, 0.12); // Re5
            setTimeout(() => this.play(880.0, 'sine', 0.14, 0.12), 60); // La5
        },
        userJoined() {
            this.play(523.25, 'triangle', 0.15, 0.1); // Do5
            setTimeout(() => this.play(659.25, 'triangle', 0.15, 0.1), 100); // Mi5
        },
        reactionPop() {
            this.play(1046.5, 'sine', 0.08, 0.15); // Do6
        }
    };

    // --- INICIALIZACIÓN ---
    function init() {
        applyTheme(state.theme);
        updateSoundButton();
        setupEventListeners();

        // Si ya hay usuario guardado, pre-llenar modal
        if (state.currentUser.username) {
            DOM.usernameInput.value = state.currentUser.username;
            selectAvatar(state.currentUser.avatar);
        }

        // Mostrar modal de ingreso
        DOM.joinModal.classList.remove('hidden');
    }

    // --- CONEXIÓN WEBSOCKET NATIVO ---
    function connectWebSocket() {
        clearTimeout(state.reconnectTimer);
        updateConnectionStatus('connecting', 'Conectando...');

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            state.socket = new WebSocket(wsUrl);

            state.socket.onopen = () => {
                state.reconnectAttempts = 0;
                updateConnectionStatus('online', 'En línea');
                showToast(`⚡ Conectado al servidor WebSocket en tiempo real`);
                
                // Enviar mensaje de JOIN
                sendWsMessage('JOIN', null, null, {
                    sender: state.currentUser.username,
                    avatar: state.currentUser.avatar,
                    roomId: state.activeRoom
                });
            };

            state.socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleIncomingMessage(msg);
                } catch (e) {
                    console.error('Error parseando JSON de WebSocket:', e);
                }
            };

            state.socket.onclose = () => {
                updateConnectionStatus('offline', 'Desconectado');
                attemptReconnect();
            };

            state.socket.onerror = (err) => {
                console.warn('Error en WebSocket:', err);
                state.socket.close();
            };
        } catch (e) {
            updateConnectionStatus('offline', 'Fallo de red');
            attemptReconnect();
        }
    }

    function attemptReconnect() {
        if (state.reconnectAttempts >= state.maxReconnectAttempts) {
            updateConnectionStatus('offline', 'Sin conexión');
            showToast('⚠️ No se pudo reconectar al servidor tras varios intentos.');
            return;
        }

        state.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, state.reconnectAttempts), 10000);
        updateConnectionStatus('connecting', `Reconectando (${state.reconnectAttempts})...`);

        state.reconnectTimer = setTimeout(() => {
            connectWebSocket();
        }, delay);
    }

    function sendWsMessage(type, content = null, payload = null, overrides = {}) {
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
            showToast('⚠️ Desconectado: esperando reconexión WebSocket...');
            return;
        }

        const msg = {
            type: type,
            roomId: overrides.roomId || state.activeRoom,
            sender: overrides.sender || state.currentUser.username,
            avatar: overrides.avatar || state.currentUser.avatar,
            content: content,
            payload: payload
        };

        state.socket.send(JSON.stringify(msg));
    }

    // --- PROCESAMIENTO DE MENSAJES RECIBIDOS ---
    function handleIncomingMessage(msg) {
        switch (msg.type) {
            case 'ROOM_LIST':
                renderRoomList(msg.payload);
                break;

            case 'USER_LIST':
                renderUserList(msg.payload);
                break;

            case 'HISTORY':
                renderHistory(msg.payload);
                break;

            case 'CHAT':
                appendChatMessage(msg.payload);
                if (msg.sender !== state.currentUser.username) {
                    SoundEngine.messageReceived();
                }
                break;

            case 'USER_JOINED':
                appendSystemMessage(`🟢 ${msg.content}`);
                addActivity(`🟢 ${msg.sender} se unió`);
                SoundEngine.userJoined();
                break;

            case 'USER_LEFT':
                appendSystemMessage(`🔴 ${msg.content}`);
                addActivity(`🔴 ${msg.sender} salió`);
                break;

            case 'TYPING':
                handleTypingUpdate(msg.payload);
                break;

            case 'REACTION':
                updateMessageReactions(msg.payload);
                SoundEngine.reactionPop();
                break;

            case 'POLL_UPDATE':
                renderPoll(msg.payload);
                break;

            default:
                console.log('Mensaje no manejado:', msg);
        }
    }

    // --- RENDERIZADO DE VISTAS ---

    function renderRoomList(rooms) {
        state.rooms = rooms || [];
        DOM.roomList.innerHTML = '';
        DOM.totalRoomsBadge.textContent = state.rooms.length;

        state.rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = `room-item ${room.id === state.activeRoom ? 'active' : ''}`;
            li.dataset.roomId = room.id;
            li.innerHTML = `
                <div class="room-left">
                    <span class="room-icon">${room.icon}</span>
                    <span class="room-name">#${room.name}</span>
                </div>
                <span class="room-online-badge">${room.onlineCount}</span>
            `;

            li.addEventListener('click', () => {
                if (room.id !== state.activeRoom) {
                    switchRoom(room.id);
                }
                closeMobileDrawers();
            });

            DOM.roomList.appendChild(li);
        });

        // Actualizar cabecera activa
        const current = state.rooms.find(r => r.id === state.activeRoom);
        if (current) {
            DOM.activeRoomTitle.textContent = `#${current.name}`;
            DOM.activeRoomDesc.textContent = current.description;
            DOM.activeRoomIcon.textContent = current.icon;
            DOM.roomOnlineCount.textContent = current.onlineCount;
        }
    }

    function switchRoom(roomId) {
        state.activeRoom = roomId;
        state.currentUser.room = roomId;
        DOM.messagesLoading.style.display = 'flex';
        DOM.messagesList.innerHTML = '';

        sendWsMessage('CHANGE_ROOM', null, null, { roomId: roomId });

        // Actualizar visual en la lista
        document.querySelectorAll('.room-item').forEach(el => {
            el.classList.toggle('active', el.dataset.roomId === roomId);
        });
    }

    function renderHistory(messages) {
        DOM.messagesLoading.style.display = 'none';
        DOM.messagesList.innerHTML = '';

        if (!messages || messages.length === 0) {
            appendSystemMessage('✨ Inicio del historial en esta sala. ¡Sé el primero en enviar un mensaje!');
            return;
        }

        messages.forEach(msg => appendChatMessage(msg, false));
        scrollToBottom();
    }

    function appendChatMessage(msg, scroll = true) {
        if (!msg) return;
        DOM.messagesLoading.style.display = 'none';

        const isOwn = msg.sender === state.currentUser.username;
        const timeStr = formatTime(msg.timestamp);

        const wrapper = document.createElement('div');
        wrapper.className = `message-bubble-wrapper ${isOwn ? 'own-message' : ''}`;
        wrapper.dataset.msgId = msg.id;

        wrapper.innerHTML = `
            <div class="msg-avatar">${escapeHtml(msg.avatar || '👤')}</div>
            <div class="msg-content-box">
                <div class="msg-header">
                    <span class="msg-sender">${escapeHtml(msg.sender)}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-bubble">${escapeHtml(msg.content)}</div>
                <div class="reactions-tray" id="reactions-${msg.id}">
                    ${renderReactionsHtml(msg.reactions)}
                </div>
            </div>
        `;

        // Doble clic o clic en burbuja para reacción rápida
        wrapper.querySelector('.msg-bubble').addEventListener('dblclick', () => {
            reactToMessage(msg.id, '❤️');
        });

        DOM.messagesList.appendChild(wrapper);

        if (scroll) {
            scrollToBottom();
        }
    }

    function appendSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'system-message';
        div.textContent = text;
        DOM.messagesList.appendChild(div);
        scrollToBottom();
    }

    function renderReactionsHtml(reactions) {
        if (!reactions || Object.keys(reactions).length === 0) return '';
        let html = '';
        for (const [emoji, count] of Object.entries(reactions)) {
            html += `<span class="reaction-pill" data-emoji="${emoji}">${emoji} ${count}</span>`;
        }
        return html;
    }

    function updateMessageReactions(payload) {
        if (!payload || !payload.messageId) return;
        const tray = document.getElementById(`reactions-${payload.messageId}`);
        if (tray) {
            tray.innerHTML = renderReactionsHtml(payload.reactions);
            attachReactionListeners(tray, payload.messageId);
        }
    }

    function attachReactionListeners(tray, messageId) {
        tray.querySelectorAll('.reaction-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                reactToMessage(messageId, pill.dataset.emoji);
            });
        });
    }

    function reactToMessage(messageId, emoji) {
        sendWsMessage('REACTION', null, {
            messageId: messageId,
            emoji: emoji
        });
    }

    function renderUserList(users) {
        state.onlineUsers = users || [];
        DOM.usersList.innerHTML = '';
        DOM.infoMembersCount.textContent = state.onlineUsers.length;
        DOM.roomOnlineCount.textContent = state.onlineUsers.length;

        state.onlineUsers.forEach(u => {
            const li = document.createElement('li');
            li.className = 'user-item';
            const isMe = u.username === state.currentUser.username;
            li.innerHTML = `
                <span class="user-item-avatar">${escapeHtml(u.avatar || '👤')}</span>
                <span class="user-item-name">${escapeHtml(u.username)} ${isMe ? '(Tú)' : ''}</span>
            `;
            DOM.usersList.appendChild(li);
        });
    }

    function renderPoll(poll) {
        if (!poll) return;
        state.poll = poll;

        DOM.pollQuestion.textContent = poll.question;
        DOM.pollTotalVotes.textContent = `${poll.totalVotes} votos totales`;
        DOM.pollOptionsContainer.innerHTML = '';

        const total = Math.max(poll.totalVotes, 1);

        poll.options.forEach(opt => {
            const percent = poll.totalVotes > 0 ? Math.round((opt.votes / total) * 100) : 0;

            const row = document.createElement('div');
            row.className = `poll-option-row ${state.userVotedPoll ? 'voted' : ''}`;
            row.dataset.optionId = opt.id;

            row.innerHTML = `
                <div class="poll-progress-bar" style="width: ${percent}%;"></div>
                <span class="poll-opt-text">${escapeHtml(opt.text)}</span>
                <span class="poll-opt-stats">${opt.votes} (${percent}%)</span>
            `;

            row.addEventListener('click', () => {
                if (!state.userVotedPoll) {
                    sendWsMessage('VOTE_POLL', null, { optionId: opt.id });
                    state.userVotedPoll = true;
                    showToast(`🗳️ Tu voto para "${opt.text}" ha sido registrado`);
                } else {
                    showToast('Ya has participado en esta votación.');
                }
            });

            DOM.pollOptionsContainer.appendChild(row);
        });
    }

    function handleTypingUpdate(payload) {
        if (!payload || !payload.username) return;
        if (payload.username === state.currentUser.username) return;

        if (payload.isTyping) {
            state.typingUsers.add(payload.username);
        } else {
            state.typingUsers.delete(payload.username);
        }

        if (state.typingUsers.size > 0) {
            const names = Array.from(state.typingUsers).join(', ');
            DOM.typingText.textContent = `${names} está escribiendo...`;
            DOM.typingIndicator.classList.add('active');
        } else {
            DOM.typingIndicator.classList.remove('active');
        }
    }

    function addActivity(text) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `<span>${text}</span> <small style="color:var(--text-muted);">${formatTime(new Date().toISOString())}</small>`;
        DOM.activityFeed.prepend(item);

        if (DOM.activityFeed.children.length > 8) {
            DOM.activityFeed.removeChild(DOM.activityFeed.lastChild);
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Formulario de ingreso inicial
        DOM.joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = DOM.usernameInput.value.trim();
            if (!username) return;

            state.currentUser.username = username;
            state.currentUser.room = DOM.initialRoomSelect.value;
            state.activeRoom = DOM.initialRoomSelect.value;

            localStorage.setItem('pulse_username', username);
            localStorage.setItem('pulse_avatar', state.currentUser.avatar);

            DOM.currentUserName.textContent = username;
            DOM.currentUserAvatar.textContent = state.currentUser.avatar;

            DOM.joinModal.classList.add('hidden');
            connectWebSocket();
        });

        // Selector de avatar
        DOM.avatarSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.avatar-opt');
            if (btn) {
                selectAvatar(btn.dataset.avatar);
            }
        });

        // Envío de mensajes en el chat
        DOM.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });

        DOM.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            } else {
                emitTyping();
            }
        });

        // Emojis rápidos
        DOM.quickEmojiBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.messageInput.value += btn.dataset.emoji;
                DOM.messageInput.focus();
            });
        });

        // Colapsar / Expandir widget de encuesta
        DOM.pollHeaderToggle.addEventListener('click', () => {
            DOM.pollCard.classList.toggle('collapsed');
        });

        // Alternador de tema claro/oscuro
        DOM.themeToggleBtn.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('pulse_theme', state.theme);
            applyTheme(state.theme);
        });

        // Alternador de sonido
        DOM.soundToggleBtn.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            localStorage.setItem('pulse_sound', state.soundEnabled);
            updateSoundButton();
            if (state.soundEnabled) {
                SoundEngine.reactionPop();
            }
        });

        // Drawer Móvil
        DOM.mobileMenuBtn.addEventListener('click', () => {
            DOM.sidebar.classList.add('open');
            DOM.mobileBackdrop.classList.add('active');
        });

        DOM.mobileBackdrop.addEventListener('click', closeMobileDrawers);

        DOM.mobileMembersBtn.addEventListener('click', () => {
            DOM.infoPanel.style.display = DOM.infoPanel.style.display === 'flex' ? 'none' : 'flex';
        });

        DOM.mobilePollBtn.addEventListener('click', () => {
            DOM.pollCard.classList.remove('collapsed');
            DOM.pollCard.scrollIntoView({ behavior: 'smooth' });
        });

        // Pestañas inferiores móviles
        DOM.mobileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                DOM.mobileTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const target = tab.dataset.tab;
                if (target === 'rooms') {
                    DOM.sidebar.classList.add('open');
                    DOM.mobileBackdrop.classList.add('active');
                } else if (target === 'members') {
                    DOM.infoPanel.style.display = 'flex';
                } else if (target === 'poll') {
                    DOM.pollCard.classList.remove('collapsed');
                    DOM.pollCard.scrollIntoView({ behavior: 'smooth' });
                } else {
                    closeMobileDrawers();
                }
            });
        });
    }

    function selectAvatar(emoji) {
        state.currentUser.avatar = emoji;
        DOM.avatarSelector.querySelectorAll('.avatar-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.avatar === emoji);
        });
    }

    function sendMessage() {
        const text = DOM.messageInput.value.trim();
        if (!text) return;

        sendWsMessage('CHAT', text);
        DOM.messageInput.value = '';
        DOM.messageInput.style.height = 'auto';

        // Detener indicador de escritura propio
        if (state.typingTimer) {
            clearTimeout(state.typingTimer);
            sendWsMessage('TYPING', null, { isTyping: false });
        }
    }

    function emitTyping() {
        if (!state.typingTimer) {
            sendWsMessage('TYPING', null, { isTyping: true });
        }
        clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => {
            sendWsMessage('TYPING', null, { isTyping: false });
            state.typingTimer = null;
        }, 2200);
    }

    function closeMobileDrawers() {
        DOM.sidebar.classList.remove('open');
        DOM.mobileBackdrop.classList.remove('active');
        if (window.innerWidth <= 900) {
            DOM.infoPanel.style.display = 'none';
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        DOM.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function updateSoundButton() {
        DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    }

    function updateConnectionStatus(type, text) {
        const dot = DOM.connectionStatus.querySelector('.status-dot');
        dot.className = `status-dot ${type}`;
        DOM.statusText.textContent = text;
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
        });
    }

    function formatTime(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Arrancar la aplicación
    document.addEventListener('DOMContentLoaded', init);

})();
