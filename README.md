# ⚡ PulseSync — Plataforma en Tiempo Real con WebSockets, Slack UI & WebRTC (Java 21 & Spring Boot)

![Java 21](https://img.shields.io/badge/Java-21%20LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-6DB33F?style=for-the-badge&logo=spring&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Native%20RFC%206455-00f2fe?style=for-the-badge)
![UI](https://img.shields.io/badge/UI-Slack%20%26%20shadcn%2Fui-8A2BE2?style=for-the-badge)
![WebRTC](https://img.shields.io/badge/WebRTC-Calls%20%26%20ScreenShare-FF5722?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-7%20Passed-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)

**PulseSync** es una plataforma moderna de comunicación y colaboración en tiempo real desarrollada con **Java 21** y **Spring Boot 3 (WebSockets nativos)**. Cuenta con una interfaz rediseñada con la estética visual de **Slack** y la elegancia de **shadcn/ui + Tailwind CSS**, soporte completo para **adjuntar archivos mediante Drag & Drop** (imágenes, documentos, código), **llamadas de voz/video en tiempo real (Huddle)** mediante **WebRTC P2P**, y **pantalla compartida en vivo (Screen Sharing)** con un solo clic.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Arquitectura de Software](#-arquitectura-de-software)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración de Puertos y Arranque](#-configuración-de-puertos-y-arranque)
- [Funcionalidades Detalladas](#-funcionalidades-detalladas)
  - [1. Interfaz Slack + shadcn/ui](#1-interfaz-estilo-slack--shadcnui)
  - [2. Adjuntos Drag & Drop](#2-adjuntos-drag--drop)
  - [3. Llamadas WebRTC (Huddle) y Pantalla Compartida](#3-llamadas-webrtc-huddle-y-pantalla-compartida)
  - [4. Encuestas en Vivo y Reacciones](#4-encuestas-interactivas-en-vivo-y-reacciones)
- [Protocolo y Mensajería WebSocket](#-protocolo-y-mensajería-websocket)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
- [Resolución de Problemas (Troubleshooting)](#-resolución-de-problemas-troubleshooting)
- [Pruebas Automatizadas](#-pruebas-automatizadas)
- [Historial de Commits Convencionales](#-historial-de-commits-convencionales)

---

## ✨ Características Principales

1. **Interfaz Inspirada en Slack + shadcn/ui**:
   - Barra lateral de espacios de trabajo (Rail 64px) con logotipo y accesos rápidos.
   - Panel de canales `# general`, `# tecnologia`, `# anuncios`, `# random` y lista de miembros en línea.
   - Tipografía con *Plus Jakarta Sans*, paleta de grises Zinc/Slate y bordes sutiles.
2. **Adjuntar Archivos Drag and Drop**:
   - Arrastra y suelta cualquier archivo directamente sobre el chat para previsualizarlo y enviarlo.
   - Previsualizaciones enriquecidas: imágenes con lightbox interactivo a pantalla completa y tarjetas de documentos con tamaño formateado y botón de descarga.
   - Zona de preparación (Staging Strip) para revisar archivos antes de enviar.
3. **Llamadas en Tiempo Real (Slack Huddle con WebRTC)**:
   - Inicia o únete a llamadas de voz y video directamente en el canal con latencia ultrabaja.
   - Cuadrícula de video dinámica (Video Grid) con indicador visual de quién está hablando.
   - Controles flotantes: silenciar/activar micrófono, encender/apagar cámara, pantalla completa y colgar.
4. **Pantalla Compartida en Tiempo Real (Screen Sharing)**:
   - Comparte tu pantalla o ventanas de aplicaciones con `navigator.mediaDevices.getDisplayMedia`.
   - Reemplazo dinámico de pista de video en WebRTC (`replaceTrack`) y visualización en escenario ampliado para los participantes.
5. **Comunicación Bidireccional WebSocket Nativa**:
   - Mensajería con latencia ultrabaja (<5ms) y búfer circular en memoria (últimos 100 mensajes).
   - Búferes ampliados a 25MB para soportar archivos adjuntos sin desconexión.
6. **Encuestas Interactivas en Vivo (Live Polling)**:
   - Barras de progreso animadas en tiempo real y prevención de doble voto por sesión.
7. **Reacciones con Emojis en Vivo**:
   - Reacciones instantáneas a mensajes con contadores sincronizados.
8. **Modo Claro / Oscuro**:
   - Persistencia en `localStorage` con variables CSS adaptadas a shadcn/ui.

---

## 🏛️ Arquitectura de Software

```
+-----------------------------------------------------------------------------------+
|                              Cliente Web (SPA)                                    |
|   • Interfaz Slack + shadcn/ui (Tailwind CSS + Plus Jakarta Sans + Lucide)        |
|   • Módulo Drag & Drop (FileReader Base64 + Staging Area + Lightbox)              |
|   • Motor WebRTC (RTCPeerConnection + getDisplayMedia Screen Share + Fallback)    |
|   • Motor de Audio Procedural (Web Audio API Chimes)                              |
+-----------------------------------------------------------------------------------+
                                   |                 ^
       Conexión WebSocket Nativa   |                 | Señalización WebRTC (P2P Mesh)
          ws://localhost:8085/ws   v                 | & Audio/Video en Tiempo Real
+-----------------------------------------------------------------------------------+
|                           Servidor Spring Boot 3                                  |
|   • WebSocket Layer: RealtimeWebSocketHandler (Buffers 25MB)                      |
|   • Enrutador de Señales WebRTC: handleCallSignal (offer, answer, candidate)       |
|   • Gestor de Estado: RealtimeService (Salas, Usuarios, Búfer Circular 100 msgs)  |
|   • Encuestas Interactivas: Poll Engine con cálculo de porcentajes dinámico       |
+-----------------------------------------------------------------------------------+
```

---

## 📁 Estructura del Proyecto

```
PROYECTO_WEBSOCKET/
├── pom.xml                                   # Dependencias Spring Boot 3 & WebSockets
├── README.md                                 # Documentación técnica completa
├── start.sh                                  # Script de arranque rápido con verificación
└── src/
    ├── main/
    │   ├── java/com/pulsesync/
    │   │   ├── PulseSyncApplication.java     # Entrypoint Spring Boot
    │   │   ├── config/
    │   │   │   └── WebSocketConfig.java      # Mapeo /ws con buffers de 25MB
    │   │   ├── handler/
    │   │   │   └── RealtimeWebSocketHandler.java # Despacho de mensajes y señalización
    │   │   ├── model/
    │   │   │   ├── ChatMessage.java          # Entidad de mensaje con adjuntos y reacciones
    │   │   │   ├── MessageType.java          # Enum de eventos (CHAT, CALL_SIGNAL, etc.)
    │   │   │   ├── Poll.java                 # Modelo de encuesta en vivo
    │   │   │   ├── PollOption.java           # Opción de encuesta con votos
    │   │   │   ├── Room.java                 # Modelo de sala temática
    │   │   │   ├── UserSession.java          # Sesión y perfil de usuario
    │   │   │   └── WsMessage.java            # Envoltorio del protocolo JSON
    │   │   └── service/
    │   │       └── RealtimeService.java      # Lógica de emisión, llamadas y estado
    │   └── resources/
    │       ├── application.properties        # Configuración del puerto 8085
    │       └── static/
    │           ├── index.html                # Interfaz Slack SPA con shadcn/ui
    │           ├── css/
    │           │   └── app.css               # Diseño Tailwind tokens, video grid y temas
    │           └── js/
    │               └── app.js                # Cliente WebSocket, Drag & Drop y WebRTC
    └── test/
        └── java/com/pulsesync/
            ├── RealtimeServiceTest.java      # Pruebas de salas, historial, encuestas y adjuntos
            └── WsMessageSerializationTest.java # Pruebas de serialización JSON y CALL_SIGNAL
```

---

## 🔌 Configuración de Puertos y Arranque

Por defecto, PulseSync se ejecuta en el **puerto `8085`** para evitar colisiones con el puerto estándar `8080` de Tomcat u otros microservicios locales.

### ¿Cómo verificar que el puerto está escuchando?

Ejecuta en tu terminal:

```bash
# Verificar socket activo
ss -tulpn | grep 8085
# o con lsof
lsof -i :8085

# Probar respuesta HTTP
curl -I http://localhost:8085/
```

### Cambiar el puerto

Puedes cambiar el puerto dinámicamente mediante la variable de entorno `PORT`:

```bash
PORT=9090 java -jar target/pulsesync-realtime-1.0.0.jar
```

O editando `src/main/resources/application.properties`:

```properties
server.port=${PORT:8085}
```

---

## 💡 Funcionalidades Detalladas

### 1. Interfaz Estilo Slack + shadcn/ui

- **Rail de Espacios de Trabajo (64px)**: Botón con logotipo `PS`, acceso a canales, indicador de llamada activa, alternador de modo oscuro/claro y avatar de usuario con presencia activa (punto verde).
- **Barra Lateral de Canales (260px)**: Selector de canales `# general`, `# tecnologia`, `# anuncios`, `# random`, lista de participantes en línea y dock flotante cuando estás en llamada.
- **Área de Entrada Enriquecida**: Barra con botones de formato (Negrita, Cursiva, Código), selector de emojis desplegable, botón para adjuntar archivos (`📎`) y botón de pantalla compartida.

### 2. Adjuntos Drag & Drop

- Arrastra cualquier archivo (imágenes `.png`, `.jpg`, `.gif`, documentos `.pdf`, código `.java`, `.py`, `.json`, archivos `.zip`) y suéltalo sobre la ventana del chat.
- Un overlay visual confirma la acción de soltar.
- Los archivos se sitúan en el área de preparación (*Staging Strip*) antes de enviarse, permitiendo eliminarlos con `✕` si te equivocas.
- Al enviar:
  - Las imágenes se muestran con previsualización inline y visor Lightbox a pantalla completa al hacer clic.
  - Los archivos se presentan como tarjetas de documento con icono descriptivo, tamaño formateado (KB/MB) y botón de descarga directa.

### 3. Llamadas WebRTC (Huddle) y Pantalla Compartida

- **Huddle de Canal**: Cualquier miembro puede hacer clic en "Huddle" para iniciar una sesión de voz y video en el canal actual.
- **Señalización WebRTC Nativa**: Utiliza el protocolo WebSocket existente con el mensaje `CALL_SIGNAL` (ofertas SDP, respuestas y candidatos ICE de Google STUN).
- **Pantalla Compartida**:
  - Al pulsar "Compartir Pantalla", se invoca `getDisplayMedia` en el navegador.
  - La pista de video se reemplaza instantáneamente en los Peers activos (`sender.replaceTrack`).
  - La cuadrícula de video cambia al modo escenario ampliado para facilitar la lectura de código y documentos.
- **Fallback Automático**: Si el navegador no cuenta con cámara física conectada, se genera un stream sintético interactivo (Canvas + Audio) que permite probar la llamada sin errores de hardware.

### 4. Encuestas Interactivas en Vivo y Reacciones

- Encuesta colapsable en cabecera con opciones dinámicas y barras de progreso porcentuales calculadas en tiempo real.
- Reacciones rápidas con emojis (`👍`, `🔥`, `🚀`, `❤️`) accesibles desde la barra de hover de cada mensaje.

---

## 🔌 Protocolo y Mensajería WebSocket

Los mensajes viajan encapsulados en la estructura `WsMessage`:

```json
{
  "type": "CHAT",
  "roomId": "general",
  "sender": "AlexDev",
  "avatar": "🚀",
  "content": "Revisa este informe",
  "timestamp": "2026-10-26T16:40:00Z",
  "payload": {
    "fileName": "reporte.pdf",
    "fileType": "application/pdf",
    "fileSize": 102400,
    "fileData": "data:application/pdf;base64,..."
  }
}
```

### Eventos Soportados:

| Evento | Dirección | Propósito |
| :--- | :--- | :--- |
| `JOIN` | Cliente ➔ Servidor | Solicitud inicial de conexión con usuario, avatar y sala |
| `USER_JOINED` / `USER_LEFT` | Servidor ➔ Cliente | Notificaciones de presencia en tiempo real |
| `USER_LIST` | Servidor ➔ Cliente | Lista sincronizada de participantes en la sala |
| `CHAT` | Bidireccional | Mensaje de texto y/o archivo adjunto |
| `HISTORY` | Servidor ➔ Cliente | Historial previo de los últimos 100 mensajes |
| `TYPING` | Bidireccional | Notificación de "está escribiendo..." |
| `REACTION` | Bidireccional | Agrega o incrementa una reacción emoji |
| `VOTE_POLL` | Cliente ➔ Servidor | Emisión de voto en la encuesta activa |
| `POLL_UPDATE` | Servidor ➔ Cliente | Transmisión global de resultados de encuesta |
| `ROOM_LIST` | Servidor ➔ Cliente | Listado de canales y número de usuarios en línea |
| `CHANGE_ROOM` | Cliente ➔ Servidor | Cambio de canal activo por el usuario |
| `CALL_SIGNAL` | Bidireccional | Señalización WebRTC (oferta, respuesta, ICE, pantalla compartida) |
| `CALL_STATE` | Servidor ➔ Cliente | Estado de llamadas activas en la sala |

---

## ⚙️ Requisitos Previos

- **Java JDK 21** o superior:
  ```bash
  java -version
  ```
- **Apache Maven 3.8+**:
  ```bash
  mvn -version
  ```

---

## 🚀 Instalación y Puesta en Marcha

### Opción 1: Con el script automático `start.sh`

```bash
cd /home/camper/Entorno-Aislado/PROYECTO_WEBSOCKET
./start.sh
```

### Opción 2: Con Maven Spring Boot Plugin

```bash
cd /home/camper/Entorno-Aislado/PROYECTO_WEBSOCKET
mvn spring-boot:run
```

### Opción 3: Compilar y ejecutar el JAR empaquetado

```bash
cd /home/camper/Entorno-Aislado/PROYECTO_WEBSOCKET
mvn clean package -DskipTests
java -jar target/pulsesync-realtime-1.0.0.jar
```

Abre en tu navegador:
👉 **`http://localhost:8085`**

---

## 🔧 Resolución de Problemas (Troubleshooting)

### 1. El puerto 8085 no arranca o indica "Address already in use"

Si otro proceso tiene retenido el puerto 8085, localízalo y termínalo:

```bash
# Ver qué proceso está usando el puerto 8085
lsof -i :8085

# Detener el proceso
kill -9 $(lsof -ti :8085)
```

O arranca en un puerto alternativo:

```bash
PORT=8090 mvn spring-boot:run
```

### 2. Estás en la carpeta equivocada del proyecto

Asegúrate de estar en el directorio `PROYECTO_WEBSOCKET` y no en `PROYECTO_JAVAFX`:

```bash
cd /home/camper/Entorno-Aislado/PROYECTO_WEBSOCKET
```

### 3. Permisos de Cámara o Pantalla Compartida

- En Chrome/Firefox, concede permisos cuando el navegador solicite acceso al micrófono o pantalla.
- Si estás en un contenedor Linux sin cámara web física, el sistema activará automáticamente el modo de simulación interactivo sin interrumpir la llamada.

---

## 🧪 Pruebas Automatizadas

Ejecuta el conjunto de pruebas unitarias:

```bash
mvn test
```

**Resultado**: 7 pruebas aprobadas (100% éxito):
- Inicialización y consistencia de salas.
- Sistema de votaciones y prevención de voto doble.
- Acumulación de reacciones emoji concurrentes.
- Modelo de mensaje con adjuntos (drag-and-drop).
- Serialización y deserialización de `WsMessage` y `CALL_SIGNAL`.

---

## 📝 Historial de Commits Convencionales

| Formato de Commit con Emojis | Descripción |
| :--- | :--- |
| `📦 build: ⚙️ inicializar proyecto Spring Boot 3 con dependencias WebSocket` | Configuración inicial y `.gitignore` |
| `✨ feat(model): 🧠 definir protocolo WsMessage, salas, mensajes y encuestas` | Modelos de datos del protocolo en tiempo real |
| `⚡ feat(service): 📡 implementar RealtimeService con salas y encuestas en vivo` | Lógica de emisión y gestión concurrente de estado |
| `🔌 feat(handler): 🤝 configurar WebSocketConfig y RealtimeWebSocketHandler` | Mapeo y despacho de conexiones nativas en `/ws` |
| `🎨 feat(ui): 📱 crear interfaz Glassmorphic responsiva para Mobile y Desktop` | HTML5, CSS3 con temas Dark/Light y cliente JS |
| `✅ test: 🧪 agregar pruebas unitarias para servicio y serialización JSON` | Suite de pruebas unitarias |
| `🐛 fix(model): 🔧 corregir serialización de Instant en UserSession con Jackson` | Corrección de serialización JSON en sesiones |
| `✨ feat(model): 📦 ampliar protocolo para adjuntos de archivos y WebRTC` | Soporte de adjuntos en `ChatMessage` y tipo `CALL_SIGNAL` |
| `🔌 feat(handler): ⚙️ configurar buffers de 25MB y enrutamiento WebRTC` | Soporte multimedia y retransmisión de señales en `RealtimeService` |
| `🎨 feat(ui): 💬 rediseñar interfaz estilo Slack con Tailwind CSS y shadcn` | UI Slack, rail lateral, header de canal y visor Lightbox |
| `📁 feat(attachments): 📎 implementar carga y previsualización con drag and drop` | Arrastre y suelta de archivos con área de preparación y descarga |
| `🎧 feat(webrtc): 🖥️ implementar llamadas en tiempo real y pantalla compartida` | Llamadas P2P, cambio dinámico de pistas de pantalla y fallback |
| `✅ test: 🧪 añadir pruebas unitarias para adjuntos y señalización CALL_SIGNAL` | Pruebas para archivos adjuntos y señales de videollamada |
| `📝 docs: 📚 documentar arquitectura Slack, WebRTC, drag & drop y puertos en README` | Guía de ejecución, solución de puertos y documentación completa |
| `🚀 chore: 🛠️ agregar script start.sh para arranque y verificación de puertos` | Script bash automatizado con verificación de procesos |
