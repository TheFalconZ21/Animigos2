# Despliegue de Animigos Backend en AWS EC2 (`api.animigos.app`)

Esta carpeta contiene las plantillas listas para producción en tu instancia **EC2 `t2.small` (`34.231.198.115` — Ubuntu 24.04 LTS)**.

## 1. Conectar a la EC2 y clonar/actualizar el repositorio

```bash
ssh -i animigos-key.pem ubuntu@34.231.198.115
git clone https://github.com/TheFalconZ21/Animigos2.git ~/Animigos2
# (o si ya existe: cd ~/Animigos2 && git pull origin main)
```

## 2. Crear `~/Animigos2/animigos-backend/.env`

```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<genera-una-clave-aleatoria-larga>
DJANGO_ALLOWED_HOSTS=api.animigos.app,34.231.198.115,127.0.0.1,localhost

REQUIRE_POSTGRES=True
POSTGRES_DB=animigos_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<tu-password-seguro-de-postgres>
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

REDIS_URL=redis://127.0.0.1:6379/0
SESSION_COOKIE_DOMAIN=.animigos.app
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SAMESITE=Lax

GEMINI_API_KEY=<tu-key-opcional>
TMDB_API_KEY=<tu-key-opcional>
```

> Puedes generar `DJANGO_SECRET_KEY` en la EC2 con:
> `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`

## 3. Ejecutar el aprovisionamiento automático

```bash
cd ~/Animigos2
sudo bash deploy/aws/setup_ec2_ubuntu24.sh
```

## 4. Activar HTTPS con Certbot (Let's Encrypt)

```bash
sudo certbot --nginx -d api.animigos.app
```

## 5. Verificar estado y poblar catálogo (si la BD está nueva)

```bash
curl -I https://api.animigos.app/api/animes/
sudo systemctl status animigos-daphne --no-pager

# Solo si la tabla animes_anime aún está vacía:
cd ~/Animigos2/animigos-backend
.venv/bin/python manage.py load_anime_bulk
.venv/bin/python manage.py load_anime_history
.venv/bin/python manage.py load_anime_recommendations
.venv/bin/python manage.py load_anime_relations
.venv/bin/python manage.py seed_initial_data
```

## 6. Apuntar el Frontend en Vercel a `https://api.animigos.app`

Una vez confirmado que `https://api.animigos.app/api/animes/` devuelve HTTP 200:
- En Vercel (`animigos` $\rightarrow$ Environment Variables):
  - `VITE_API_URL=https://api.animigos.app`
  - `VITE_WS_URL=wss://api.animigos.app`
- Ejecutar **Redeploy** en Vercel.
