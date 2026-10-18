# 📦 Animigos Rescue Kit — Guía de Migración
### Vite + React + Bootstrap 5 + AWS RDS PostgreSQL

Este paquete contiene todos los activos esenciales y la lógica de negocio pura extraída del proyecto **Animigos**, adaptada para iniciar una nueva aplicación moderna, ligera y desacoplada de Supabase y Tailwind.

---

## 📂 Contenido del Kit

```text
animigos-rescue-kit/
│
├── database/
│   └── schema-aws-rds-postgresql.sql     # Esquema SQL listo para AWS RDS / Aurora
│
├── core-engine/                          # Lógica pura de negocio en TypeScript (Sin dependencias)
│   ├── happiness-score.ts                # Algoritmo de Felicidad Grupal v1 + Explicabilidad
│   ├── guest-session.service.ts          # Gestión de sesiones locales para Invitados
│   ├── seasonal.service.ts               # Cálculo de temporadas y calendario semanal
│   ├── catalog-data.ts                   # Modelos, tipos e interfaces de catálogo
│   └── index.ts                          # Barrel export de todo el Core Engine
│
└── bootstrap-templates/                  # Componentes base en React usando Bootstrap 5
    ├── CandidateVotingCard.tsx           # Votación interactiva y cálculo de felicidad
    └── AnimeCatalogCard.tsx              # Ficha de catálogo y postulación a grupos
```

---

## 🚀 Paso 1: Configurar la Base de Datos en AWS RDS

1. **Crear la Instancia en AWS:**
   - Entra a la consola de AWS $\rightarrow$ **Amazon RDS** $\rightarrow$ **Create database**.
   - Motor: **PostgreSQL** (versión 15 o 16 recomendada).
   - Plantilla: *Free Tier* (si aplica) o *Dev/Test* (`db.t4g.micro` o `db.t3.micro`).
   - Configura el usuario maestro (`postgres`) y tu contraseña.
   - En **Connectivity**, habilita *Public Access* (si te conectarás desde tu máquina local durante desarrollo) o configura el Security Group para permitir el puerto `5432`.

2. **Ejecutar el Esquema SQL:**
   - Conéctate a tu base de datos mediante DBeaver, pgAdmin o terminal:
     ```bash
     psql -h tu-rds-endpoint.amazonaws.com -U postgres -d animigos -f database/schema-aws-rds-postgresql.sql
     ```
   - El script creará automáticamente todas las tablas:
     - `users`, `profiles`, `user_preferences`
     - `anime_cache` (para almacenar datos de MyAnimeList)
     - `personal_lists` y `personal_list_items`
     - `shared_lists`, `shared_list_members` (con soporte para miembros registrados e invitados)
     - `shared_list_candidates` y `shared_list_votes` (escala 0-10)
     - `group_watch_progress`, `friendships` y `notifications`

---

## ⚡ Paso 2: Crear el Nuevo Frontend con Vite + React + Bootstrap

1. **Inicializar el proyecto Vite:**
   ```bash
   npm create vite@latest animigos-front -- --template react-ts
   cd animigos-front
   ```

2. **Instalar Bootstrap y Lucide Icons:**
   ```bash
   npm install bootstrap @popperjs/core react-bootstrap lucide-react
   ```

3. **Configurar Bootstrap en `src/main.tsx`:**
   Agrega las siguientes importaciones al inicio de `src/main.tsx`:
   ```tsx
   import "bootstrap/dist/css/bootstrap.min.css";
   import "bootstrap/dist/js/bootstrap.bundle.min.js";
   ```

4. **Copiar el Core Engine:**
   Copia la carpeta `animigos-rescue-kit/core-engine/` al directorio `src/core/` de tu nuevo proyecto:
   ```bash
   cp -r animigos-rescue-kit/core-engine src/core
   ```

5. **Copiar los Componentes Bootstrap:**
   Copia los archivos de `animigos-rescue-kit/bootstrap-templates/` a `src/components/`.

---

## 💡 Paso 3: Cómo Conectar el Frontend a AWS RDS

Como una SPA en Vite se ejecuta en el navegador del cliente, requiere una API backend para consultar PostgreSQL de forma segura:

### Opciones de Backend recomendadas:
1. **API REST Ligera en Node.js + Express / Fastify (o NestJS):**
   - Usa un ORM o Query Builder moderno como **Prisma** o **Kysely**:
     ```bash
     npx prisma init
     npx prisma db pull  # Lee las tablas existentes en RDS automáticamente
     ```
2. **AWS Serverless (API Gateway + AWS Lambda):**
   - Ideal para bajo costo y escalabilidad automática sin servidores dedicados.

---

## 🧪 Ejemplo de Uso Rápido: Algoritmo de Felicidad

```tsx
import { calculateHappinessScore } from "./core";

const resultado = calculateHappinessScore({
  malId: 52991,
  title: "Frieren: Beyond Journey's End",
  malScore: 9.32,
  malScoredBy: 550000,
  episodesCount: 28,
  totalMembersCount: 4,
  votes: [
    { voterId: "user-1", voterName: "Lucas", interestScore: 10 },
    { voterId: "user-2", voterName: "Sofía", interestScore: 9 },
    { voterId: "user-3", voterName: "Mauricio", interestScore: 8 },
    { voterId: "guest-token-abc", voterName: "Invitado", interestScore: 9 },
  ],
});

console.log("Puntuación Final:", resultado.finalScore); // ej. 9.4 / 10
console.log("Razones:", resultado.explanations);
// -> ["¡Consenso alto! Todos los integrantes mostraron mucho interés..."]
```
