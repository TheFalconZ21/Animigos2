#!/usr/bin/env bash
# Aprovisionamiento idempotente de Animigos Backend en AWS EC2 Ubuntu 24.04 (t2.small: 1 vCPU, 2 GB RAM)
# Uso: sudo bash deploy/aws/setup_ec2_ubuntu24.sh
set -euo pipefail

APP_USER="ubuntu"
REPO_DIR="/home/ubuntu/Animigos2"
BACKEND_DIR="${REPO_DIR}/animigos-backend"

echo "=== [1/7] Configurando Swap de 2 GB para proteger t2.small ==="
if ! swapon --show | grep -q '/swapfile'; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=20
    grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=20' >> /etc/sysctl.conf
    echo "Swap de 2 GB activado."
else
    echo "Swap ya existe, omitiendo."
fi

echo "=== [2/7] Instalando Nginx, Certbot, Redis y herramientas Python ==="
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx redis-server python3-venv python3-pip git

echo "=== [3/7] Configurando Redis (128 MB maxmemory, solo 127.0.0.1) ==="
REDIS_CONF="/etc/redis/redis.conf"
if [ -f "$REDIS_CONF" ]; then
    sed -i 's/^# *maxmemory .*/maxmemory 128mb/' "$REDIS_CONF"
    sed -i 's/^maxmemory .*/maxmemory 128mb/' "$REDIS_CONF"
    grep -q '^maxmemory ' "$REDIS_CONF" || echo 'maxmemory 128mb' >> "$REDIS_CONF"
    sed -i 's/^# *maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
    sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
    grep -q '^maxmemory-policy ' "$REDIS_CONF" || echo 'maxmemory-policy allkeys-lru' >> "$REDIS_CONF"
fi
systemctl enable --now redis-server
systemctl restart redis-server

echo "=== [4/7] Ajustando PostgreSQL 16 para t2.small (2 GB RAM) y cerrando listen externo ==="
PG_CONF_DIR="/etc/postgresql/16/main/conf.d"
if [ -d "$PG_CONF_DIR" ]; then
    cat > "${PG_CONF_DIR}/99-animigos-t2small.conf" <<'EOF'
# Tuning Animigos para EC2 t2.small (2 GB RAM)
listen_addresses = 'localhost'
max_connections = 50
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 4MB
maintenance_work_mem = 64MB
EOF
    systemctl restart postgresql
fi

echo "=== [5/7] Preparando entorno virtual Python, migraciones y estáticos ==="
sudo -u "$APP_USER" bash -c "
set -e
cd '${BACKEND_DIR}'
if [ ! -d '.venv' ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py check
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
"

echo "=== [6/7] Instalando servicio systemd (Daphne) y sitio Nginx ==="
cp "${REPO_DIR}/deploy/aws/animigos-daphne.service" /etc/systemd/system/animigos-daphne.service
systemctl daemon-reload
systemctl enable --now animigos-daphne
systemctl restart animigos-daphne

cp "${REPO_DIR}/deploy/aws/nginx-api.animigos.app.conf" /etc/nginx/sites-available/api.animigos.app
ln -sf /etc/nginx/sites-available/api.animigos.app /etc/nginx/sites-enabled/api.animigos.app
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "=== [7/7] Configurando backup diario pg_dump (retención 7 días) ==="
mkdir -p /var/backups/animigos
chown postgres:postgres /var/backups/animigos
cat > /etc/cron.d/animigos-pg-backup <<'EOF'
0 4 * * * postgres pg_dump animigos_db | gzip > /var/backups/animigos/animigos_db_$(date +\%F).sql.gz && find /var/backups/animigos -name '*.sql.gz' -mtime +7 -delete
EOF
chmod 644 /etc/cron.d/animigos-pg-backup

echo ""
echo "================================================================"
echo " Setup base completado."
echo " Siguiente paso: emitir certificado SSL gratis con Certbot:"
echo "   sudo certbot --nginx -d api.animigos.app"
echo "================================================================"
