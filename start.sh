#!/usr/bin/env bash
# ==============================================================================
# PulseSync — Script de Arranque y Verificación de Puerto
# ==============================================================================

set -e

PORT=${PORT:-8085}
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "⚡ ==================================================="
echo "⚡ PulseSync — Servidor en Tiempo Real (Slack & WebRTC)"
echo "⚡ ==================================================="
echo "📁 Directorio: $DIR"
echo "🔌 Puerto objetivo: $PORT"
echo ""

# Verificar si el puerto ya está en uso
PID_OCCUPIED=$(lsof -ti :$PORT 2>/dev/null || ss -tulpn 2>/dev/null | grep ":$PORT " | awk '{print $NF}' | sed 's/.*pid=\([0-9]*\).*/\1/' || true)

if [ -n "$PID_OCCUPIED" ]; then
    echo "⚠️  El puerto $PORT ya está en uso por el proceso PID: $PID_OCCUPIED"
    echo "💡 Puedes detenerlo con: kill -9 $PID_OCCUPIED"
    echo ""
    read -p "¿Deseas detener el proceso anterior y continuar? (s/N): " -r RESP
    if [[ "$RESP" =~ ^[sSyY]$ ]]; then
        kill -9 $PID_OCCUPIED 2>/dev/null || true
        sleep 1
        echo "✅ Proceso anterior terminado."
    else
        echo "Cancelado."
        exit 1
    fi
fi

# Compilar si no existe el JAR
if [ ! -f "target/pulsesync-realtime-1.0.0.jar" ]; then
    echo "📦 Compilando y empaquetando proyecto con Maven..."
    mvn clean package -DskipTests
fi

echo "🚀 Iniciando servidor Spring Boot en http://localhost:$PORT ..."
java -jar target/pulsesync-realtime-1.0.0.jar
