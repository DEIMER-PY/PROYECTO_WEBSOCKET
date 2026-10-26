# ⚡ PulseSync — Plataforma en Tiempo Real con WebSockets (Java 21 & Spring Boot)

![Java 21](https://img.shields.io/badge/Java-21%20LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-6DB33F?style=for-the-badge&logo=spring&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Native%20RFC%206455-00f2fe?style=for-the-badge)
![UI](https://img.shields.io/badge/UI-Mobile%20%26%20Desktop%20Responsive-8A2BE2?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-5%20Passed-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)

**PulseSync** es una plataforma moderna de comunicación y colaboración en tiempo real desarrollada con **Java 21** y **Spring Boot 3 (WebSockets nativos)**. Diseñada con un apartado visual *Glassmorphic* altamente pulido, cuenta con una interfaz completamente responsiva adaptada tanto para **dispositivos móviles** (drawer off-canvas, barra de navegación inferior táctil) como para **escritorio** (dashboard de 3 columnas con canales, chat, encuestas y monitor de usuarios).

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Diseño Responsivo (Mobile & Desktop)](#-diseño-responsivo-mobile--desktop)
- [Protocolo y Mensajería WebSocket](#-protocolo-y-mensajería-websocket)
- [Arquitectura de Software](#-arquitectura-de-software)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
- [Acceso Multiplataforma](#-acceso-multiplataforma)
- [Pruebas Automatizadas](#-pruebas-automatizadas)
- [Historial de Commits Convencionales](#-historial-de-commits-convencionales)

---

## ✨ Características Principales

1. **Comunicación Bidireccional en Tiempo Real**:
   - Mensajería instantánea de latencia ultrabaja (<5ms) utilizando el protocolo nativo `ws://` / `wss://`.
   - Historial de mensajes en búfer circular en memoria (últimos 100 mensajes por sala).
2. **Salas Temáticas (Multi-Room)**:
   - Navegación instantánea entre `#general`, `#tecnologia`, `#anuncios` y `#random` sin recargar la página.
   - Contadores de participantes por canal en vivo.
3. **Encuestas Interactivas en Vivo (Live Polling)**:
   - Sistema de votación en tiempo real con barras de progreso animadas calculadas dinámicamente sobre el total de votos de todos los clientes.
   - Prevención de doble voto por sesión.
4. **Reacciones con Emojis en Vivo**:
   - Reacciona a cualquier mensaje con `🔥`, `🚀`, `👍`, `❤️` o `🎉` con contadores sincronizados en vivo.
5. **Presencia y Roster Activo**:
   - Notificaciones automáticas de conexión (`USER_JOINED`) y desconexión (`USER_LEFT`).
   - Lista lateral de usuarios activos con avatar y nombre.
6. **Indicadores de Escritura (Typing Indicators)**:
   - Detección de teclado con animación de 3 puntos pulsantes y auto-cancelación tras 2.2 segundos.
7. **Sonido Procedural con Web Audio API**:
   - Chimes y alertas sintéticas generadas en el navegador sin archivos `.mp3` ni llamadas de red externas.
8. **Temas Dark / Light**:
   - Modo oscuro neón por defecto y modo claro elegante, persistidos en `localStorage`.

---

## 📱 Diseño Responsivo (Mobile & Desktop)

| Componente | Versión Escritorio (Desktop) | Versión Móvil (Mobile) |
| :--- | :--- | :--- |
| **Navegación** | Barra lateral fija de 280px con salas y perfil | Drawer off-canvas desplegable con botón `☰` o tap |
| **Roster / Info** | Panel derecho de 260px con miembros y actividad | Modal/overlay táctil accesible desde la barra superior |
| **Barra Inferior** | Oculta | Bottom Navigation Bar fija con accesos rápidos: `💬 Chat`, `📁 Salas`, `📊 Votación`, `👥 Usuarios` |
| **Entrada de Texto** | Área amplia con atajo `Enter` para enviar y `Shift+Enter` | Botón táctil grande optimizado para dedos (área mínima 44px) |
| **Encuesta** | Tarjeta superior colapsable sobre el chat | Modo expandible adaptado a pantallas táctiles |

---

## 🔌 Protocolo y Mensajería WebSocket

Los mensajes viajan como objetos JSON encapsulados en la estructura `WsMessage`:

```json
{
  "type": "CHAT",
  "roomId": "general",
  "sender": "AlexDev",
  "avatar": "🚀",
  "content": "¡Hola a todos en tiempo real!",
  "timestamp": "2026-10-26T16:40:00Z",
  "payload": null
}
```

### Eventos Soportados:
- `JOIN`: Solicitud inicial de conexión con nombre de usuario, avatar y sala elegida.
- `USER_JOINED` / `USER_LEFT`: Notificaciones del servidor sobre presencia.
- `USER_LIST`: Sincronización de participantes en la sala.
- `CHAT`: Transmisión de mensaje de texto.
- `HISTORY`: Carga del historial previo al ingresar a una sala.
- `TYPING`: Notificación de estado de escritura.
- `REACTION`: Agrega o incrementa una reacción emoji a un mensaje existente.
- `VOTE_POLL`: Emisión de voto en la encuesta activa.
- `POLL_UPDATE`: Transmisión global de resultados de la encuesta.
- `ROOM_LIST`: Listado de salas disponibles y participantes activos.
- `CHANGE_ROOM`: Petición de cambio de sala.

---

## 🏛️ Arquitectura de Software

```
+-------------------------------------------------------------+
|                      Cliente (Navegador)                    |
|        HTML5 Semantic  •  CSS3 Glassmorphic Responsive      |
|           Vanilla ES6 WebSocket  •  Web Audio API           |
+------------------------------+------------------------------+
                               | Conexión ws://host:8085/ws
                               v
+-------------------------------------------------------------+
|               Spring Boot 3 WebSocket Layer                 |
|             RealtimeWebSocketHandler (TextHandler)          |
+------------------------------+------------------------------+
                               | Event Dispatching
                               v
+-------------------------------------------------------------+
|                 RealtimeService (Singleton)                 |
|  - ConcurrentHashMap de sesiones y usuarios                 |
|  - Historial en memoria por canal (búfer circular)          |
|  - Engine de encuestas interactivas                         |
+-------------------------------------------------------------+
```

---

## 📁 Estructura del Proyecto

```
PROYECTO_WEBSOCKET/
├── .gitignore
├── pom.xml                                   # Dependencias Spring Boot WebSocket
├── README.md                                 # Documentación técnica
└── src/
    ├── main/
    │   ├── java/com/pulsesync/
    │   │   ├── PulseSyncApplication.java     # Entrypoint Spring Boot
    │   │   ├── config/
    │   │   │   └── WebSocketConfig.java      # Mapeo del endpoint /ws
    │   │   ├── handler/
    │   │   │   └── RealtimeWebSocketHandler.java # Manejador de eventos entrantes
    │   │   ├── model/
    │   │   │   ├── ChatMessage.java          # Entidad de mensaje con reacciones
    │   │   │   ├── MessageType.java          # Enum de eventos del protocolo
    │   │   │   ├── Poll.java                 # Modelo de encuesta en vivo
    │   │   │   ├── PollOption.java           # Opción de encuesta con votos
    │   │   │   ├── Room.java                 # Modelo de sala temática
    │   │   │   ├── UserSession.java          # Sesión y perfil de usuario
    │   │   │   └── WsMessage.java            # Envoltorio del protocolo JSON
    │   │   └── service/
    │   │       └── RealtimeService.java      # Lógica de emisión y gestión de estado
    │   └── resources/
    │       ├── application.properties        # Puerto 8085 y configuración
    │       └── static/
    │           ├── index.html                # Interfaz SPA responsiva
    │           ├── css/
    │           │   └── app.css               # Diseño Glassmorphism Mobile & Desktop
    │           └── js/
    │               └── app.js                # Cliente WebSocket nativo y audio
    └── test/
        └── java/com/pulsesync/
            ├── RealtimeServiceTest.java      # Pruebas de salas, historial y encuestas
            └── WsMessageSerializationTest.java # Pruebas de serialización JSON
```

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

1. **Navegar al directorio**:
   ```bash
   cd /home/camper/Entorno-Aislado/PROYECTO_WEBSOCKET
   ```

2. **Ejecutar el servidor con Maven**:
   ```bash
   mvn spring-boot:run
   ```

3. **O ejecutar desde el paquete JAR**:
   ```bash
   mvn package -DskipTests
   java -jar target/pulsesync-realtime-1.0.0.jar
   ```

El servidor iniciará en el puerto **8085**:
`http://localhost:8085`

---

## 🌐 Acceso Multiplataforma

### En Escritorio (Desktop):
Abre cualquier navegador web (Chrome, Firefox, Edge, Safari) e ingresa a:
👉 `http://localhost:8085`

### En Dispositivos Móviles (Smartphones / Tablets):
1. Asegúrate de que tu teléfono móvil esté conectado a la misma red WiFi o red local de tu máquina.
2. Obtén la IP local de tu equipo (ej. `192.168.1.100` con `ip a` o `hostname -I`).
3. Desde el navegador móvil, ingresa a:
   👉 `http://<TU_IP_LOCAL>:8085`
4. También puedes probar la experiencia móvil en tu escritorio abriendo las **Herramientas de Desarrollador** del navegador (`F12` o `Ctrl + Shift + M`) y activando la vista de dispositivo móvil (iPhone, Pixel, iPad).

---

## 🧪 Pruebas Automatizadas

El proyecto incluye pruebas unitarias que verifican la integridad del protocolo y del servicio en tiempo real:

```bash
mvn test
```

**Cobertura de pruebas**:
- Inicialización correcta de las 4 salas temáticas por defecto.
- Configuración y opciones de la encuesta interactiva.
- Registro de votos y prevención de votos duplicados por sesión.
- Registro, acumulación y persistencia de reacciones emoji sobre mensajes.
- Serialización y deserialización bidireccional JSON con Jackson.

---

## 📝 Historial de Commits Convencionales

| Formato de Commit | Descripción |
| :--- | :--- |
| `📦 build: ⚙️ inicializar proyecto Spring Boot 3 con dependencias WebSocket` | Configuración inicial y `.gitignore` |
| `✨ feat(model): 🧠 definir protocolo WsMessage, salas, mensajes y encuestas` | Modelos de datos del protocolo en tiempo real |
| `⚡ feat(service): 📡 implementar RealtimeService con salas y encuestas en vivo` | Lógica de emisión y gestión concurrente de estado |
| `🔌 feat(handler): 🤝 configurar WebSocketConfig y RealtimeWebSocketHandler` | Mapeo y despacho de conexiones nativas en `/ws` |
| `🎨 feat(ui): 📱 crear interfaz Glassmorphic responsiva para Mobile y Desktop` | HTML5, CSS3 con temas Dark/Light y cliente JS |
| `✅ test: 🧪 agregar pruebas unitarias para servicio y serialización JSON` | Suite de pruebas unitarias |
| `📝 docs: 📚 agregar documentación técnica y guía multiplataforma en README` | Documentación exhaustiva en Markdown |
