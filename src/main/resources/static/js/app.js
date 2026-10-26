/**
 * ==========================================================================
 * PULSESYNC - CLIENTE SLACK WEBSOCKET, DRAG & DROP Y WEBRTC SCREEN SHARE
 * ==========================================================================
 */

(function () {
    'use strict';

    // --- CONFIGURACIÓN & ESTADO GLOBAL ---
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
        typingTimer: null,

        // Archivos adjuntos pendientes (Staged files)
        stagedFiles: [],

        // Estado WebRTC (Llamadas & Screen Share)
        call: {
            inCall: false,
            localStream: null,
            screenStream: null,
            isScreenSharing: false,
            isMicMuted: false,
            isCamOff: false,
            peerConnections: new Map(), // remoteSessionId -> RTCPeerConnection
            remoteStreams: new Map(),     // remoteSessionId -> MediaStream
            roomCallActive: false
        }
    };

    // STUN Servers públicos de Google para WebRTC
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // --- SELECTORES DOM ---
    const DOM = {
        // Modal de Ingreso
        joinModal: document.getElementById('joinModal'),
        joinForm: document.getElementById('joinForm'),
        usernameInput: document.getElementById('usernameInput'),
        avatarSelector: document.getElementById('avatarSelector'),
        initialRoomSelect: document.getElementById('initialRoomSelect'),

        // Sidebar & Perfil
        currentUserName: document.getElementById('currentUserName'),
        currentUserAvatar: document.getElementById('currentUserAvatar'),
        currentUserAvatarRail: document.getElementById('currentUserAvatarRail'),
        statusText: document.getElementById('statusText'),
        connectionStatusBadge: document.getElementById('connectionStatusBadge'),
        roomList: document.getElementById('roomList'),
        usersList: document.getElementById('usersList'),
        infoMembersCount: document.getElementById('infoMembersCount'),
        totalRoomsBadge: document.getElementById('totalRoomsBadge'),
        huddleIndicatorDot: document.getElementById('huddleIndicatorDot'),

        // Header Chat
        activeRoomTitle: document.getElementById('activeRoomTitle'),
        activeRoomDesc: document.getElementById('activeRoomDesc'),
        activeRoomIcon: document.getElementById('activeRoomIcon'),
        roomOnlineCount: document.getElementById('roomOnlineCount'),
        startCallBtn: document.getElementById('startCallBtn'),
        shareScreenHeaderBtn: document.getElementById('shareScreenHeaderBtn'),
        togglePollBtn: document.getElementById('togglePollBtn'),
        roomCallBanner: document.getElementById('roomCallBanner'),
        joinCallBannerBtn: document.getElementById('joinCallBannerBtn'),

        // Drag & Drop
        chatDropTarget: document.getElementById('chatDropTarget'),
        dropOverlay: document.getElementById('dropOverlay'),
        dropRoomLabel: document.getElementById('dropRoomLabel'),
        stagedAttachments: document.getElementById('stagedAttachments'),
        fileAttachmentInput: document.getElementById('fileAttachmentInput'),
        triggerFileBtn: document.getElementById('triggerFileBtn'),
        inputShareScreenBtn: document.getElementById('inputShareScreenBtn'),

        // Chat & Mensajes
        messagesContainer: document.getElementById('messagesContainer'),
        messagesLoading: document.getElementById('messagesLoading'),
        messagesList: document.getElementById('messagesList'),
        typingIndicator: document.getElementById('typingIndicator'),
        typingText: document.getElementById('typingText'),
        chatForm: document.getElementById('chatForm'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),

        // Formato rápido & Emojis
        btnBold: document.getElementById('btnBold'),
        btnItalic: document.getElementById('btnItalic'),
        btnCode: document.getElementById('btnCode'),
        emojiToggleBtn: document.getElementById('emojiToggleBtn'),
        emojiPickerPop: document.getElementById('emojiPickerPop'),

        // Encuesta
        pollCard: document.getElementById('pollCard'),
        pollHeaderToggle: document.getElementById('pollHeaderToggle'),
        pollQuestion: document.getElementById('pollQuestion'),
        pollTotalVotes: document.getElementById('pollTotalVotes'),
        pollOptionsContainer: document.getElementById('pollOptionsContainer'),
        pollChevron: document.getElementById('pollChevron'),

        // Modal de Llamada (WebRTC Huddle)
        callModal: document.getElementById('callModal'),
        callRoomTitle: document.getElementById('callRoomTitle'),
        callParticipantCountBadge: document.getElementById('callParticipantCountBadge'),
        minimizeCallModalBtn: document.getElementById('minimizeCallModalBtn'),
        videoGrid: document.getElementById('videoGrid'),
        localVideoContainer: document.getElementById('localVideoContainer'),
        localVideo: document.getElementById('localVideo'),
        localVideoPlaceholder: document.getElementById('localVideoPlaceholder'),
        localUserLabel: document.getElementById('localUserLabel'),
        callMicToggleBtn: document.getElementById('callMicToggleBtn'),
        callCamToggleBtn: document.getElementById('callCamToggleBtn'),
        callScreenShareToggleBtn: document.getElementById('callScreenShareToggleBtn'),
        screenShareBtnLabel: document.getElementById('screenShareBtnLabel'),
        callHangupBtn: document.getElementById('callHangupBtn'),

        // Mini Dock de Huddle
        huddleMiniDock: document.getElementById('huddleMiniDock'),
        dockMuteBtn: document.getElementById('dockMuteBtn'),
        dockLeaveBtn: document.getElementById('dockLeaveBtn'),

        // Lightbox de Imágenes
        imageLightboxModal: document.getElementById('imageLightboxModal'),
        lightboxImage: document.getElementById('lightboxImage'),
        lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn'),
        closeLightboxBtn: document.getElementById('closeLightboxBtn'),

        // Controles de Sistema
        soundToggleBtn: document.getElementById('soundToggleBtn'),
        soundIcon: document.getElementById('soundIcon'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        themeIcon: document.getElementById('themeIcon'),
        toastContainer: document.getElementById('toastContainer')
    };

    // --- MOTOR DE AUDIO SINTÉTICO (WEB AUDIO API) ---
    const SoundEngine = {
        ctx: null,
        init() {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        play(freq, type = 'sine', duration = 0.12, gain = 0.1) {
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
            } catch (e) {}
        },
        messageReceived() {
            this.play(587.33, 'sine', 0.1, 0.1); // D5
            setTimeout(() => this.play(880.0, 'sine', 0.14, 0.08), 60); // A5
        },
        userJoined() {
            this.play(523.25, 'triangle', 0.12, 0.08); // C5
            setTimeout(() => this.play(659.25, 'triangle', 0.15, 0.08), 90); // E5
        },
        reactionPop() {
            this.play(1046.5, 'sine', 0.08, 0.12); // C6
        },
        callRing() {
            this.play(440, 'sine', 0.2, 0.15);
            setTimeout(() => this.play(880, 'sine', 0.25, 0.15), 180);
        }
    };

    // --- INICIALIZACIÓN ---
    function init() {
        applyTheme(state.theme);
        updateSoundButton();
        setupEventListeners();
        setupDragAndDrop();

        if (state.currentUser.username) {
            DOM.usernameInput.value = state.currentUser.username;
            selectAvatar(state.currentUser.avatar);
        }

        DOM.joinModal.classList.remove('hidden');
        renderIcons();
    }

    function renderIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // --- WEBSOCKET CLIENT ---
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
                showToast(`⚡ Conectado al servidor WebSocket PulseSync`);

                // Enviar JOIN inicial
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
                    console.error('Error parseando mensaje WebSocket:', e);
                }
            };

            state.socket.onclose = () => {
                updateConnectionStatus('offline', 'Desconectado');
                attemptReconnect();
            };

            state.socket.onerror = (err) => {
                console.warn('Error en conexión WebSocket:', err);
                state.socket.close();
            };
        } catch (e) {
            updateConnectionStatus('offline', 'Error de red');
            attemptReconnect();
        }
    }

    function attemptReconnect() {
        if (state.reconnectAttempts >= state.maxReconnectAttempts) {
            updateConnectionStatus('offline', 'Sin conexión');
            showToast('⚠️ No se pudo reconectar con el servidor.');
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

    // --- DISPATCHER DE MENSAJES RECIBIDOS ---
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
                appendSystemMessage(`🟢 ${msg.content || (msg.sender + ' se unió a la sala')}`);
                SoundEngine.userJoined();
                break;

            case 'USER_LEFT':
                appendSystemMessage(`🔴 ${msg.content || (msg.sender + ' salió de la sala')}`);
                // Si el usuario estaba en llamada, cerrar su peer
                if (msg.payload && msg.payload.sessionId) {
                    handleRemoteUserLeft(msg.payload.sessionId);
                }
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

            case 'CALL_SIGNAL':
                handleWebRTCSignal(msg);
                break;

            default:
                console.log('Mensaje WebSocket:', msg);
        }
    }

    // --- RENDERIZADO DE INTERFAZ SLACK ---

    function renderRoomList(rooms) {
        state.rooms = rooms || [];
        DOM.roomList.innerHTML = '';
        DOM.totalRoomsBadge.textContent = state.rooms.length;

        state.rooms.forEach(room => {
            const isActive = room.id === state.activeRoom;
            const li = document.createElement('li');
            li.className = `flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition ${
                isActive
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`;
            li.dataset.roomId = room.id;

            li.innerHTML = `
                <div class="flex items-center space-x-2 truncate">
                    <span class="text-sm">${room.icon || '💬'}</span>
                    <span class="truncate"># ${escapeHtml(room.name)}</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/30 text-primary' : 'bg-accent text-muted-foreground'}">${room.onlineCount || 0}</span>
            `;

            li.addEventListener('click', () => {
                if (room.id !== state.activeRoom) {
                    switchRoom(room.id);
                }
            });

            DOM.roomList.appendChild(li);
        });

        // Actualizar Cabecera
        const current = state.rooms.find(r => r.id === state.activeRoom);
        if (current) {
            DOM.activeRoomTitle.textContent = `# ${current.name}`;
            DOM.activeRoomDesc.textContent = current.description;
            DOM.activeRoomIcon.textContent = current.icon || '💬';
            DOM.roomOnlineCount.textContent = current.onlineCount || 0;
            DOM.dropRoomLabel.textContent = `#${current.name}`;
            DOM.callRoomTitle.textContent = `#${current.name}`;
        }
    }

    function switchRoom(roomId) {
        // Si estamos en llamada y cambiamos de sala, colgar
        if (state.call.inCall) {
            leaveCall();
        }

        state.activeRoom = roomId;
        state.currentUser.room = roomId;
        DOM.messagesLoading.classList.remove('hidden');
        DOM.messagesList.innerHTML = '';

        sendWsMessage('CHANGE_ROOM', null, null, { roomId: roomId });

        document.querySelectorAll('#roomList li').forEach(el => {
            const match = el.dataset.roomId === roomId;
            el.className = `flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition ${
                match
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`;
        });
    }

    function renderUserList(users) {
        state.onlineUsers = users || [];
        DOM.usersList.innerHTML = '';
        DOM.infoMembersCount.textContent = state.onlineUsers.length;
        DOM.roomOnlineCount.textContent = state.onlineUsers.length;

        state.onlineUsers.forEach(u => {
            const isMe = u.username === state.currentUser.username;
            const li = document.createElement('li');
            li.className = 'flex items-center space-x-2 px-2.5 py-1 rounded-lg text-xs hover:bg-accent/30 transition';
            li.innerHTML = `
                <div class="relative">
                    <span class="text-sm">${escapeHtml(u.avatar || '👤')}</span>
                    <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-background"></span>
                </div>
                <span class="truncate ${isMe ? 'font-semibold text-primary' : 'text-foreground/90'}">
                    ${escapeHtml(u.username)} ${isMe ? '<span class="text-[10px] text-muted-foreground font-normal">(tú)</span>' : ''}
                </span>
            `;
            DOM.usersList.appendChild(li);
        });
    }

    function renderHistory(messages) {
        DOM.messagesLoading.classList.add('hidden');
        DOM.messagesList.innerHTML = '';

        if (!messages || messages.length === 0) {
            appendSystemMessage('✨ Este es el inicio de la conversación en #' + state.activeRoom + '. ¡Escribe un mensaje o arrastra un archivo!');
            return;
        }

        messages.forEach(msg => appendChatMessage(msg, false));
        scrollToBottom();
    }

    // --- RENDERIZADO DE MENSAJE TIPO SLACK CON ARCHIVOS ADJUNTOS ---
    function appendChatMessage(msg, scroll = true) {
        if (!msg) return;
        DOM.messagesLoading.classList.add('hidden');

        const isOwn = msg.sender === state.currentUser.username;
        const timeStr = formatTime(msg.timestamp);

        const row = document.createElement('div');
        row.className = 'message-row group flex items-start space-x-3 px-3 py-2 rounded-lg hover:bg-accent/40 transition relative';
        row.dataset.msgId = msg.id;

        // Renderizado de Adjunto (si existe)
        let attachmentHtml = '';
        if (msg.fileData) {
            const isImage = msg.fileType && msg.fileType.startsWith('image/');
            const formattedSize = formatFileSize(msg.fileSize || 0);

            if (isImage) {
                attachmentHtml = `
                    <div class="mt-2 inline-block rounded-xl overflow-hidden border border-border shadow-md max-w-sm bg-black/10">
                        <img src="${msg.fileData}" alt="${escapeHtml(msg.fileName || 'imagen')}"
                            class="chat-preview-img max-h-64 object-cover cursor-pointer hover:opacity-90 transition"
                            data-fullsrc="${msg.fileData}" data-filename="${escapeHtml(msg.fileName || 'imagen.png')}" />
                        <div class="p-2 bg-card/80 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                            <span class="truncate max-w-[200px] font-medium text-foreground">${escapeHtml(msg.fileName || 'imagen.png')}</span>
                            <div class="flex items-center space-x-2">
                                <span>${formattedSize}</span>
                                <a href="${msg.fileData}" download="${escapeHtml(msg.fileName || 'imagen.png')}" class="text-primary hover:underline font-semibold" title="Descargar">⬇️</a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Tarjeta de Archivo tipo Slack
                attachmentHtml = `
                    <div class="mt-2 flex items-center space-x-3 p-3 rounded-xl border border-border bg-card/70 max-w-md shadow-sm">
                        <div class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xl shrink-0">
                            📄
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-semibold text-foreground truncate">${escapeHtml(msg.fileName || 'archivo')}</p>
                            <p class="text-[11px] text-muted-foreground">${formattedSize} • ${escapeHtml(msg.fileType || 'Archivo adjunto')}</p>
                        </div>
                        <a href="${msg.fileData}" download="${escapeHtml(msg.fileName || 'archivo')}"
                           class="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition shrink-0 flex items-center space-x-1">
                            <span>Descargar</span>
                        </a>
                    </div>
                `;
            }
        }

        // Barra de acciones flotante estilo Slack al pasar el cursor
        row.innerHTML = `
            <div class="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-lg shrink-0 border border-border">
                ${escapeHtml(msg.avatar || '👤')}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-baseline space-x-2">
                    <span class="font-bold text-xs text-foreground tracking-tight ${isOwn ? 'text-primary' : ''}">${escapeHtml(msg.sender)}</span>
                    <span class="text-[10px] text-muted-foreground font-mono">${timeStr}</span>
                </div>
                ${msg.content ? `<div class="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap leading-relaxed select-text">${formatMessageContent(msg.content)}</div>` : ''}
                ${attachmentHtml}
                <!-- Bandeja de Reacciones -->
                <div class="reactions-tray mt-1.5 flex flex-wrap gap-1" id="reactions-${msg.id}">
                    ${renderReactionsHtml(msg.reactions)}
                </div>
            </div>

            <!-- Toolbar de hover estilo Slack -->
            <div class="message-actions-toolbar">
                <button type="button" class="btn-quick-react p-1 rounded hover:bg-accent text-xs" data-emoji="👍" title="Me gusta">👍</button>
                <button type="button" class="btn-quick-react p-1 rounded hover:bg-accent text-xs" data-emoji="🔥" title="Fuego">🔥</button>
                <button type="button" class="btn-quick-react p-1 rounded hover:bg-accent text-xs" data-emoji="🚀" title="Cohete">🚀</button>
                <button type="button" class="btn-quick-react p-1 rounded hover:bg-accent text-xs" data-emoji="❤️" title="Corazón">❤️</button>
            </div>
        `;

        // Listeners para toolbar de reacciones
        row.querySelectorAll('.btn-quick-react').forEach(btn => {
            btn.addEventListener('click', () => {
                reactToMessage(msg.id, btn.dataset.emoji);
            });
        });

        // Click en preview de imagen para lightbox
        const previewImg = row.querySelector('.chat-preview-img');
        if (previewImg) {
            previewImg.addEventListener('click', () => {
                openLightbox(previewImg.dataset.fullsrc, previewImg.dataset.filename);
            });
        }

        // Reacciones al hacer clic en las píldoras
        attachReactionListeners(row.querySelector(`#reactions-${msg.id}`), msg.id);

        DOM.messagesList.appendChild(row);

        if (scroll) {
            scrollToBottom();
        }
    }

    function appendSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-center my-2 text-[11px] text-muted-foreground font-medium';
        div.innerHTML = `<span class="px-3 py-1 bg-accent/40 rounded-full border border-border">${escapeHtml(text)}</span>`;
        DOM.messagesList.appendChild(div);
        scrollToBottom();
    }

    function renderReactionsHtml(reactions) {
        if (!reactions || Object.keys(reactions).length === 0) return '';
        let html = '';
        for (const [emoji, count] of Object.entries(reactions)) {
            html += `
                <button type="button" class="reaction-pill inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs bg-accent/60 border border-border hover:border-primary transition" data-emoji="${emoji}">
                    <span>${emoji}</span>
                    <span class="text-[11px] font-semibold text-muted-foreground">${count}</span>
                </button>
            `;
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
        if (!tray) return;
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

    // --- FORMATO DE TEXTO (MARKDOWN BÁSICO) ---
    function formatMessageContent(text) {
        if (!text) return '';
        let escaped = escapeHtml(text);
        // Negrita: **texto**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Cursiva: *texto*
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Código en línea: `código`
        escaped = escaped.replace(/`(.*?)`/g, '<code class="bg-accent px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>');
        return escaped;
    }

    // --- ENCUESTA INTERACTIVA EN VIVO ---
    function renderPoll(poll) {
        if (!poll) return;
        state.poll = poll;

        DOM.pollQuestion.textContent = poll.question;
        DOM.pollTotalVotes.textContent = `${poll.totalVotes} votos`;
        DOM.pollOptionsContainer.innerHTML = '';

        const total = Math.max(poll.totalVotes, 1);

        poll.options.forEach(opt => {
            const percent = poll.totalVotes > 0 ? Math.round((opt.votes / total) * 100) : 0;

            const row = document.createElement('div');
            row.className = 'group relative overflow-hidden rounded-lg border border-border p-2 cursor-pointer hover:border-primary transition';

            row.innerHTML = `
                <div class="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-500 ease-out" style="width: ${percent}%;"></div>
                <div class="relative flex items-center justify-between text-xs font-medium z-10">
                    <span class="truncate pr-2">${escapeHtml(opt.text)}</span>
                    <span class="text-muted-foreground font-mono text-[11px] shrink-0">${opt.votes} (${percent}%)</span>
                </div>
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

    // --- INDICADOR DE ESCRITURA ---
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
            DOM.typingIndicator.style.opacity = '1';
        } else {
            DOM.typingIndicator.style.opacity = '0';
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

    // ==============================================================
    // DRAG AND DROP & GESTIÓN DE ARCHIVOS ADJUNTOS
    // ==============================================================
    function setupDragAndDrop() {
        let dragCounter = 0;

        // Prevenir comportamiento por defecto en toda la ventana
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Eventos sobre el contenedor del chat
        DOM.chatDropTarget.addEventListener('dragenter', (e) => {
            dragCounter++;
            DOM.dropOverlay.classList.remove('hidden');
        });

        DOM.chatDropTarget.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                DOM.dropOverlay.classList.add('hidden');
            }
        });

        DOM.chatDropTarget.addEventListener('dragover', (e) => {
            e.dataTransfer.dropEffect = 'copy';
        });

        DOM.chatDropTarget.addEventListener('drop', (e) => {
            dragCounter = 0;
            DOM.dropOverlay.classList.add('hidden');

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleSelectedFiles(files);
            }
        });

        // Eventos mediante botón "Adjuntar"
        DOM.triggerFileBtn.addEventListener('click', () => {
            DOM.fileAttachmentInput.click();
        });

        DOM.fileAttachmentInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSelectedFiles(e.target.files);
                DOM.fileAttachmentInput.value = '';
            }
        });
    }

    function handleSelectedFiles(fileList) {
        Array.from(fileList).forEach(file => {
            // Límite de tamaño: 20MB
            if (file.size > 20 * 1024 * 1024) {
                showToast(`⚠️ "${file.name}" supera el límite de 20MB.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const staged = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: e.target.result
                };
                state.stagedFiles.push(staged);
                renderStagedFiles();
            };
            reader.readAsDataURL(file);
        });
    }

    function renderStagedFiles() {
        if (state.stagedFiles.length === 0) {
            DOM.stagedAttachments.classList.add('hidden');
            DOM.stagedAttachments.innerHTML = '';
            return;
        }

        DOM.stagedAttachments.classList.remove('hidden');
        DOM.stagedAttachments.innerHTML = '';

        state.stagedFiles.forEach((f, idx) => {
            const card = document.createElement('div');
            card.className = 'flex items-center space-x-2 bg-card border border-border px-2.5 py-1.5 rounded-lg text-xs shadow-sm';

            const isImg = f.type.startsWith('image/');
            const iconHtml = isImg
                ? `<img src="${f.data}" class="w-6 h-6 rounded object-cover" />`
                : `<span class="text-base">📄</span>`;

            card.innerHTML = `
                ${iconHtml}
                <div class="max-w-[140px] truncate">
                    <p class="font-semibold truncate">${escapeHtml(f.name)}</p>
                    <p class="text-[10px] text-muted-foreground">${formatFileSize(f.size)}</p>
                </div>
                <button type="button" class="text-muted-foreground hover:text-destructive p-0.5 rounded transition" data-idx="${idx}" title="Quitar archivo">✕</button>
            `;

            card.querySelector('button').addEventListener('click', () => {
                state.stagedFiles.splice(idx, 1);
                renderStagedFiles();
            });

            DOM.stagedAttachments.appendChild(card);
        });
    }

    function sendMessage() {
        const text = DOM.messageInput.value.trim();
        const hasFiles = state.stagedFiles.length > 0;

        if (!text && !hasFiles) return;

        if (hasFiles) {
            // Enviar cada archivo adjunto
            state.stagedFiles.forEach(file => {
                sendWsMessage('CHAT', text, {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData: file.data
                });
            });
            state.stagedFiles = [];
            renderStagedFiles();
        } else {
            sendWsMessage('CHAT', text);
        }

        DOM.messageInput.value = '';
        DOM.messageInput.style.height = 'auto';

        if (state.typingTimer) {
            clearTimeout(state.typingTimer);
            sendWsMessage('TYPING', null, { isTyping: false });
        }
    }

    // ==============================================================
    // WEBRTC - LLAMADA EN TIEMPO REAL & COMPARTIR PANTALLA (HUDDLE)
    // ==============================================================

    async function startOrJoinCall(screenShareImmediate = false) {
        if (state.call.inCall) {
            showCallModal();
            if (screenShareImmediate && !state.call.isScreenSharing) {
                toggleScreenShare();
            }
            return;
        }

        try {
            await acquireLocalMedia();
            state.call.inCall = true;

            showCallModal();
            updateHuddleUI(true);

            // Anunciar entrada en el Huddle
            sendCallSignal({
                signalType: 'join_call'
            });

            showToast(`🎧 Te has unido al Huddle de #${state.activeRoom}`);
            SoundEngine.callRing();

            if (screenShareImmediate) {
                setTimeout(() => toggleScreenShare(), 500);
            }
        } catch (err) {
            console.error('Error al inicializar la llamada:', err);
            showToast('⚠️ No se pudo iniciar el dispositivo de audio/video.');
        }
    }

    async function acquireLocalMedia() {
        try {
            // Intentar adquirir cámara y micrófono reales
            state.call.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
        } catch (e) {
            console.warn('Cámara no detectada o permisos denegados. Generando stream sintético para pruebas:', e);
            // Fallback sintético para entornos aislados o sin webcam física
            state.call.localStream = createSyntheticStream();
        }

        DOM.localVideo.srcObject = state.call.localStream;
        DOM.localUserLabel.textContent = `${state.currentUser.username} (Tú)`;
    }

    // Generador de stream sintético (Canvas con avatar + Audio) para entornos sin cámara física
    function createSyntheticStream() {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');

        let angle = 0;
        function drawFrame() {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Gradiente de fondo
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#312e81');
            grad.addColorStop(1, '#09090b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Círculo animado
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
            ctx.fillStyle = '#4f46e5';
            ctx.fill();

            // Avatar y texto
            ctx.font = '50px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(state.currentUser.avatar || '🚀', canvas.width / 2, canvas.height / 2 - 5);

            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(state.currentUser.username, canvas.width / 2, canvas.height / 2 + 55);

            angle += 0.05;
            requestAnimationFrame(drawFrame);
        }
        drawFrame();

        const canvasStream = canvas.captureStream(30);

        // Pista de audio sintética silenciosa
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001; // Casi inaudible
        osc.connect(gain);
        gain.connect(dst);
        osc.start();

        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
            canvasStream.addTrack(audioTrack);
        }

        return canvasStream;
    }

    // Conexión WebRTC P2P
    function getOrCreatePeerConnection(remoteSessionId, remoteUsername, remoteAvatar) {
        if (state.call.peerConnections.has(remoteSessionId)) {
            return state.call.peerConnections.get(remoteSessionId);
        }

        const pc = new RTCPeerConnection(rtcConfig);
        state.call.peerConnections.set(remoteSessionId, pc);

        // Añadir pistas locales al peer
        if (state.call.localStream) {
            state.call.localStream.getTracks().forEach(track => {
                pc.addTrack(track, state.call.localStream);
            });
        }

        // Manejar candidatos ICE locales
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignal({
                    signalType: 'candidate',
                    targetSessionId: remoteSessionId,
                    candidate: event.candidate
                });
            }
        };

        // Recibir pistas remotas
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0] || new MediaStream([event.track]);
            state.call.remoteStreams.set(remoteSessionId, remoteStream);
            renderRemoteVideoTile(remoteSessionId, remoteStream, remoteUsername, remoteAvatar);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                removeRemoteVideoTile(remoteSessionId);
                state.call.peerConnections.delete(remoteSessionId);
                state.call.remoteStreams.delete(remoteSessionId);
                updateCallParticipantCount();
            }
        };

        return pc;
    }

    // Enrutador de Señales WebRTC recibidas
    async function handleWebRTCSignal(msg) {
        const payload = msg.payload;
        if (!payload || !payload.signalType) return;

        const senderSessionId = payload.senderSessionId;
        const senderUsername = payload.senderUsername || msg.sender;
        const senderAvatar = payload.senderAvatar || msg.avatar;

        // Si la señal es de una llamada activa en la sala
        if (payload.signalType === 'join_call') {
            DOM.roomCallBanner.classList.remove('hidden');
            DOM.huddleIndicatorDot.classList.remove('hidden');

            // Si ya estamos en llamada, ser el iniciador de la oferta al nuevo participante
            if (state.call.inCall) {
                const pc = getOrCreatePeerConnection(senderSessionId, senderUsername, senderAvatar);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                sendCallSignal({
                    signalType: 'offer',
                    targetSessionId: senderSessionId,
                    sdp: pc.localDescription
                });
            }
            return;
        }

        if (payload.signalType === 'offer') {
            if (!state.call.inCall) return;

            const pc = getOrCreatePeerConnection(senderSessionId, senderUsername, senderAvatar);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendCallSignal({
                signalType: 'answer',
                targetSessionId: senderSessionId,
                sdp: pc.localDescription
            });
            updateCallParticipantCount();
            return;
        }

        if (payload.signalType === 'answer') {
            const pc = state.call.peerConnections.get(senderSessionId);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                updateCallParticipantCount();
            }
            return;
        }

        if (payload.signalType === 'candidate') {
            const pc = state.call.peerConnections.get(senderSessionId);
            if (pc && payload.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                } catch (e) {
                    console.warn('Error añadiendo ICE candidate:', e);
                }
            }
            return;
        }

        if (payload.signalType === 'leave_call') {
            handleRemoteUserLeft(senderSessionId);
            return;
        }

        if (payload.signalType === 'screen_share_start') {
            showToast(`🖥️ ${senderUsername} está compartiendo pantalla`);
            const tile = document.getElementById(`remoteTile-${senderSessionId}`);
            if (tile) {
                tile.classList.add('screen-share-stage');
            }
            return;
        }

        if (payload.signalType === 'screen_share_stop') {
            const tile = document.getElementById(`remoteTile-${senderSessionId}`);
            if (tile) {
                tile.classList.remove('screen-share-stage');
            }
            return;
        }
    }

    function sendCallSignal(data) {
        sendWsMessage('CALL_SIGNAL', null, data);
    }

    // Render de Video Remoto en el Grid
    function renderRemoteVideoTile(sessionId, stream, username, avatar) {
        let tile = document.getElementById(`remoteTile-${sessionId}`);
        if (!tile) {
            tile = document.createElement('div');
            tile.id = `remoteTile-${sessionId}`;
            tile.className = 'video-tile animate-in zoom-in-95 duration-200';
            tile.innerHTML = `
                <video autoplay playsinline class="w-full h-full object-cover"></video>
                <div class="video-tile-meta">
                    <span>${escapeHtml(avatar || '👤')}</span>
                    <span>${escapeHtml(username || 'Participante')}</span>
                </div>
            `;
            DOM.videoGrid.appendChild(tile);
        }

        const videoEl = tile.querySelector('video');
        if (videoEl && videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
        }

        updateCallParticipantCount();
    }

    function removeRemoteVideoTile(sessionId) {
        const tile = document.getElementById(`remoteTile-${sessionId}`);
        if (tile) {
            tile.remove();
        }
    }

    function handleRemoteUserLeft(sessionId) {
        removeRemoteVideoTile(sessionId);
        const pc = state.call.peerConnections.get(sessionId);
        if (pc) {
            pc.close();
            state.call.peerConnections.delete(sessionId);
            state.call.remoteStreams.delete(sessionId);
        }
        updateCallParticipantCount();

        if (state.call.peerConnections.size === 0) {
            DOM.roomCallBanner.classList.add('hidden');
            DOM.huddleIndicatorDot.classList.add('hidden');
        }
    }

    function updateCallParticipantCount() {
        const total = 1 + state.call.peerConnections.size;
        DOM.callParticipantCountBadge.textContent = `${total} participante${total > 1 ? 's' : ''}`;
    }

    // COMPARTIR PANTALLA EN TIEMPO REAL (SCREEN SHARING)
    async function toggleScreenShare() {
        if (!state.call.inCall) {
            await startOrJoinCall(true);
            return;
        }

        if (!state.call.isScreenSharing) {
            try {
                // Solicitar captura de pantalla del navegador
                state.call.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always'
                    },
                    audio: true
                });

                const screenTrack = state.call.screenStream.getVideoTracks()[0];

                // Reemplazar la pista de video en todos los Peer Connections activos
                state.call.peerConnections.forEach(pc => {
                    const senders = pc.getSenders();
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(screenTrack);
                    }
                });

                // Mostrar en el tile local
                DOM.localVideo.srcObject = state.call.screenStream;
                DOM.localVideoContainer.classList.add('screen-share-stage');

                state.call.isScreenSharing = true;
                DOM.screenShareBtnLabel.textContent = 'Dejar de Compartir';
                DOM.callScreenShareToggleBtn.classList.remove('bg-indigo-600');
                DOM.callScreenShareToggleBtn.classList.add('bg-amber-600');

                // Notificar inicio de pantalla compartida
                sendCallSignal({ signalType: 'screen_share_start' });
                showToast('🖥️ Estás compartiendo tu pantalla con los miembros del canal');

                // Si el usuario presiona "Dejar de compartir" en la barra nativa del navegador
                screenTrack.onended = () => {
                    stopScreenSharing();
                };

            } catch (err) {
                console.warn('Compartir pantalla cancelado o denegado:', err);
            }
        } else {
            stopScreenSharing();
        }
    }

    function stopScreenSharing() {
        if (!state.call.isScreenSharing) return;

        if (state.call.screenStream) {
            state.call.screenStream.getTracks().forEach(t => t.stop());
            state.call.screenStream = null;
        }

        // Restaurar la pista de video de la cámara/avatar original
        if (state.call.localStream) {
            const originalVideoTrack = state.call.localStream.getVideoTracks()[0];
            state.call.peerConnections.forEach(pc => {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender && originalVideoTrack) {
                    videoSender.replaceTrack(originalVideoTrack);
                }
            });

            DOM.localVideo.srcObject = state.call.localStream;
        }

        DOM.localVideoContainer.classList.remove('screen-share-stage');
        state.call.isScreenSharing = false;
        DOM.screenShareBtnLabel.textContent = 'Compartir Pantalla';
        DOM.callScreenShareToggleBtn.classList.remove('bg-amber-600');
        DOM.callScreenShareToggleBtn.classList.add('bg-indigo-600');

        sendCallSignal({ signalType: 'screen_share_stop' });
        showToast('⏹️ Has dejado de compartir pantalla');
    }

    // Toggle Micrófono
    function toggleMic() {
        if (!state.call.localStream) return;
        state.call.isMicMuted = !state.call.isMicMuted;

        state.call.localStream.getAudioTracks().forEach(track => {
            track.enabled = !state.call.isMicMuted;
        });

        DOM.callMicToggleBtn.classList.toggle('bg-destructive', state.call.isMicMuted);
        DOM.dockMuteBtn.classList.toggle('text-destructive', state.call.isMicMuted);
        document.getElementById('localMicIcon').textContent = state.call.isMicMuted ? '🔇' : '🎙️';
        showToast(state.call.isMicMuted ? '🔇 Micrófono silenciado' : '🎙️ Micrófono activado');
    }

    // Toggle Cámara
    function toggleCamera() {
        if (!state.call.localStream) return;
        state.call.isCamOff = !state.call.isCamOff;

        state.call.localStream.getVideoTracks().forEach(track => {
            track.enabled = !state.call.isCamOff;
        });

        DOM.callCamToggleBtn.classList.toggle('bg-destructive', state.call.isCamOff);
        DOM.localVideoPlaceholder.classList.toggle('hidden', !state.call.isCamOff);
        DOM.localVideo.classList.toggle('hidden', state.call.isCamOff);
    }

    // Colgar / Salir de la llamada
    function leaveCall() {
        if (!state.call.inCall) return;

        stopScreenSharing();

        // Parar streams locales
        if (state.call.localStream) {
            state.call.localStream.getTracks().forEach(t => t.stop());
            state.call.localStream = null;
        }

        // Cerrar peer connections
        state.call.peerConnections.forEach(pc => pc.close());
        state.call.peerConnections.clear();
        state.call.remoteStreams.clear();

        // Notificar a los peers que salimos
        sendCallSignal({ signalType: 'leave_call' });

        // Limpiar DOM de videos remotos
        document.querySelectorAll('.video-tile:not(#localVideoContainer)').forEach(el => el.remove());

        state.call.inCall = false;
        updateHuddleUI(false);
        DOM.callModal.classList.add('hidden');

        showToast('📞 Has salido del Huddle');
    }

    function showCallModal() {
        DOM.callModal.classList.remove('hidden');
        renderIcons();
    }

    function updateHuddleUI(inCall) {
        DOM.huddleMiniDock.classList.toggle('hidden', !inCall);
        DOM.startCallBtn.classList.toggle('bg-emerald-500/20', inCall);
        DOM.startCallBtn.classList.toggle('border-emerald-500', inCall);
        DOM.huddleIndicatorDot.classList.toggle('hidden', !inCall);
    }

    // --- LIGHTBOX DE IMÁGENES ---
    function openLightbox(src, filename) {
        DOM.lightboxImage.src = src;
        DOM.lightboxDownloadBtn.href = src;
        DOM.lightboxDownloadBtn.download = filename || 'imagen.png';
        DOM.imageLightboxModal.classList.remove('hidden');
    }

    function closeLightbox() {
        DOM.imageLightboxModal.classList.add('hidden');
        DOM.lightboxImage.src = '';
    }

    // --- EVENT LISTENERS GENERALES ---
    function setupEventListeners() {
        // Modal de Registro inicial
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
            DOM.currentUserAvatarRail.textContent = state.currentUser.avatar;

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

        // Envío de chat
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

        // Botones de formato rápido
        DOM.btnBold.addEventListener('click', () => wrapSelection('**', '**'));
        DOM.btnItalic.addEventListener('click', () => wrapSelection('*', '*'));
        DOM.btnCode.addEventListener('click', () => wrapSelection('`', '`'));

        // Desplegable de Emojis
        DOM.emojiToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.emojiPickerPop.classList.toggle('hidden');
        });

        DOM.emojiPickerPop.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-pick');
            if (btn) {
                DOM.messageInput.value += btn.textContent;
                DOM.messageInput.focus();
                DOM.emojiPickerPop.classList.add('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            if (!DOM.emojiPickerPop.contains(e.target) && e.target !== DOM.emojiToggleBtn) {
                DOM.emojiPickerPop.classList.add('hidden');
            }
        });

        // Controles de Llamada / Huddle
        DOM.startCallBtn.addEventListener('click', () => startOrJoinCall(false));
        DOM.joinCallBannerBtn.addEventListener('click', () => startOrJoinCall(false));
        DOM.shareScreenHeaderBtn.addEventListener('click', () => startOrJoinCall(true));
        DOM.inputShareScreenBtn.addEventListener('click', () => startOrJoinCall(true));

        DOM.callMicToggleBtn.addEventListener('click', toggleMic);
        DOM.callCamToggleBtn.addEventListener('click', toggleCamera);
        DOM.callScreenShareToggleBtn.addEventListener('click', toggleScreenShare);
        DOM.callHangupBtn.addEventListener('click', leaveCall);

        DOM.dockMuteBtn.addEventListener('click', toggleMic);
        DOM.dockLeaveBtn.addEventListener('click', leaveCall);

        DOM.minimizeCallModalBtn.addEventListener('click', () => {
            DOM.callModal.classList.add('hidden');
        });

        DOM.huddleMiniDock.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                showCallModal();
            }
        });

        // Encuesta Toggle
        DOM.pollHeaderToggle.addEventListener('click', () => {
            DOM.pollCard.classList.toggle('collapsed');
            DOM.pollChevron.classList.toggle('rotate-180');
        });

        DOM.togglePollBtn.addEventListener('click', () => {
            DOM.pollCard.scrollIntoView({ behavior: 'smooth' });
        });

        // Lightbox
        DOM.closeLightboxBtn.addEventListener('click', closeLightbox);
        DOM.imageLightboxModal.addEventListener('click', (e) => {
            if (e.target === DOM.imageLightboxModal) {
                closeLightbox();
            }
        });

        // Tema Claro / Oscuro
        DOM.themeToggleBtn.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('pulse_theme', state.theme);
            applyTheme(state.theme);
        });

        // Sonido
        DOM.soundToggleBtn.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            localStorage.setItem('pulse_sound', state.soundEnabled);
            updateSoundButton();
            if (state.soundEnabled) {
                SoundEngine.reactionPop();
            }
        });
    }

    function wrapSelection(prefix, suffix) {
        const input = DOM.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const val = input.value;
        const selected = val.substring(start, end) || 'texto';

        input.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
        input.focus();
        input.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }

    function selectAvatar(emoji) {
        state.currentUser.avatar = emoji;
        DOM.avatarSelector.querySelectorAll('.avatar-opt').forEach(btn => {
            const isMatch = btn.dataset.avatar === emoji;
            btn.classList.toggle('border-primary', isMatch);
            btn.classList.toggle('bg-primary/20', isMatch);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            DOM.themeIcon.textContent = '🌙';
        } else {
            document.documentElement.classList.remove('dark');
            DOM.themeIcon.textContent = '☀️';
        }
    }

    function updateSoundButton() {
        DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    }

    function updateConnectionStatus(type, text) {
        DOM.statusText.textContent = text;
        const dot = DOM.connectionStatusBadge.querySelector('span:first-child');
        if (type === 'online') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
            DOM.connectionStatusBadge.className = 'flex items-center space-x-1.5 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal';
        } else if (type === 'connecting') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse';
            DOM.connectionStatusBadge.className = 'flex items-center space-x-1.5 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-normal';
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
            DOM.connectionStatusBadge.className = 'flex items-center space-x-1.5 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-normal';
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
        });
    }

    function formatTime(isoString) {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-item pointer-events-auto bg-card text-card-foreground border border-border px-3.5 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center space-x-2 max-w-sm';
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    // Inicializar app cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);

})();
