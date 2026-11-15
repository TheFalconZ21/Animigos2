# 🎌 Animigos

> Plataforma full-stack para recomendación inteligente de anime, agenda y contador de tareas pendientes, consenso algorítmico grupal (*Algoritmo de Felicidad*) y watch parties en tiempo real.

---

## 🚀 Inicio Rápido y Guía de Levantamiento

Para ver el paso a paso detallado, configuración de entorno virtual, variables de entorno, base de datos híbrida (PostgreSQL / SQLite) y servidor de desarrollo, consulta la guía didáctica completa:

📖 **[Guía Didáctica de Instalación, Configuración y Levantamiento](GUIA_INSTALACION_Y_LEVANTAMIENTO.md)**

---

## ⚡ Comandos Rápidos de Arranque

### 1. Backend (Django + Daphne ASGI)
```bash
cd animigos-backend
.\.venv\Scripts\activate      # En Windows (o 'source .venv/bin/activate' en Linux/macOS)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend (React 19 + Vite)
```bash
cd animigos-frontend
npm install
npm run dev
```

Visita en tu navegador: **`http://localhost:5173/`**

---

## 🏛️ Estructura del Proyecto

- `animigos-frontend/`: Aplicación cliente desarrollada en React 19, TypeScript, Vite y TanStack Query.
- `animigos-backend/`: API REST y servidor de WebSockets en Django 5, Django REST Framework y Daphne (ASGI).
- `AGENTS.md`: Directivas de desarrollo, estándares de seguridad y reglas de arquitectura estética.
