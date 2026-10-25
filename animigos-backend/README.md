# 🎬 Animigos Backend (Django REST Framework)

Backend monolítico para **Animigos**, construido con **Python 3.13**, **Django 5.2**, **Django REST Framework (DRF)** y **django-cors-headers**.

---

## 🚀 Inicio Rápido

### 1. Activar el Entorno Virtual
En Windows (PowerShell):
```powershell
.\animigos-backend\.venv\Scripts\Activate.ps1
```

### 2. Iniciar el Servidor de Desarrollo
```powershell
cd animigos-backend
python manage.py runserver 8000
```
El servidor estará disponible en: `http://localhost:8000/`

---

## 🛠️ Panel de Administración (Django Admin)
Acceso directo a la gestión de animes, salas grupales y votos:
* **URL:** [http://localhost:8000/admin/](http://localhost:8000/admin/)
* **Usuario:** `admin`
* **Contraseña:** `admin1234`

---

## 📡 Endpoints de la API REST

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/` | Estado del backend y sitemap de endpoints |
| `GET` | `/api/animes/` | Catálogo de animes (paginado, filtros por `?genre=`, `?studio=`, `?year=`, `?q=`) |
| `GET` | `/api/animes/top/` | Top 24 animes con mejor puntuación |
| `GET` | `/api/animes/studios/` | Resumen de estudios de animación y cantidad de títulos |
| `GET` | `/api/groups/` | Listar salas de decisión creadas |
| `POST` | `/api/groups/` | Crear una nueva sala (`name`, `description`, `creator_name`) |
| `GET` | `/api/groups/by_code/?code=XYZ` | Buscar sala por código de invitación |
| `POST` | `/api/groups/<id>/join/` | Unirse a la sala como invitado (`guest_name`, `guest_token`) |
| `POST` | `/api/groups/<id>/nominate/` | Postular un anime candidato a la sala (`anime_id`, `suggested_by`) |
| `POST` | `/api/groups/<id>/vote/` | Votar por un anime candidato (0-10) y recalcular felicidad |
| `POST` | `/api/groups/<id>/select_winner/` | Marcar el anime seleccionado para ver en grupo |

---

## 🧠 Algoritmo de Felicidad Grupal
La lógica pura de felicidad grupal está implementada en:
`groups/services/happiness.py`

Calcula dinámicamente para cada candidato:
1. **Media de interés:** Promedio de ganas de los integrantes.
2. **Penalización por dispersión:** Detecta si hay desacuerdo fuerte.
3. **Ponderaciones externas:** Calificación global en MAL y popularidad.
4. **Explicabilidad:** Razones en lenguaje natural sobre el consenso grupal.

---

## 📦 Ingesta de Catálogo desde el Dataset
Para importar más títulos desde el dataset oficial en CSV:
```powershell
python manage.py load_anime_data --limit 500
```

---

## 🗄️ Conexión a Base de Datos (SQLite / PostgreSQL)
* **Desarrollo local (Automático):** Usa SQLite (`db.sqlite3`), sin necesidad de instalar o levantar servicios externos.
* **Producción / AWS RDS PostgreSQL:** Si configuras variables en tu archivo `.env`:
  ```env
  POSTGRES_DB=animigos
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=tu_password
  POSTGRES_HOST=tu-rds-endpoint.amazonaws.com
  POSTGRES_PORT=5432
  ```
  Django conmutará automáticamente al motor PostgreSQL mediante `psycopg`.
