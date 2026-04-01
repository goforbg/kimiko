# Reacher Self-Hosted Setup

## Server Info
- **IP:** 188.245.198.59
- **Provider:** Hetzner (cx23, Ubuntu 22.04)
- **SSH Key:** ~/.ssh/hetzner_reacher

## Config
- **Domain:** verify.inboxpirates.com
- **From Email:** bg@verify.inboxpirates.com
- **Hello Name:** inboxpirates.com
- **API Secret:** xP9mK2vL7qN4wR8tY3uA6jF1dH5cB0eZ

## docker-compose.yml
```yaml
services:
  reacher:
    image: reacherhq/backend:latest
    container_name: reacher
    restart: unless-stopped
    environment:
      - RCH__API__SECRET=xP9mK2vL7qN4wR8tY3uA6jF1dH5cB0eZ
      - RCH__HELLO_NAME=inboxpirates.com
      - RCH__FROM_EMAIL=bg@verify.inboxpirates.com
    expose:
      - "8080"

  caddy:
    image: caddy:2
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - reacher

volumes:
  caddy_data:
  caddy_config:
```

## Caddyfile
```
verify.inboxpirates.com {
  reverse_proxy reacher:8080
}
```

## Install Steps (run on server as root)

### 1. Install Docker
```bash
apt update -y
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update -y
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
```

### 2. Create Reacher folder and files
```bash
mkdir -p /opt/reacher
cd /opt/reacher
# Write docker-compose.yml and Caddyfile (see above)
```

### 3. Firewall
```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

### 4. Start
```bash
cd /opt/reacher
docker compose up -d
docker ps
```

### 5. Test
```
https://verify.inboxpirates.com
```
