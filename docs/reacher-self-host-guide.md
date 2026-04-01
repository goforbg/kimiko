# How to Self-Host Reacher.email

Source: leadgenjay.com/aia guide

## Why Self-Hosting Reacher Matters
- Performs live SMTP verification
- Requires outbound port 25 for best accuracy
- Works best on a VPS that explicitly allows SMTP traffic

---

## Step 0: Get the Right VPS
- Must allow outbound port 25
- OS: Ubuntu 22.04 or 24.04
- RAM: 2 GB minimum (4 GB recommended)
- Save IP address and root password

## Step 1: Log Into Your Server
```bash
ssh root@YOUR_VPS_IP
```

## Step 2: Install Docker
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
docker --version
```

## Step 3: Create the Reacher Folder
```bash
mkdir -p /opt/reacher
cd /opt/reacher
```

## Step 4: docker-compose.yml
```yaml
services:
  reacher:
    image: reacherhq/backend:latest
    container_name: reacher
    restart: unless-stopped
    environment:
      - RCH__API__SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING
      - RCH__HELLO_NAME=yourdomain.com
      - RCH__FROM_EMAIL=verify@yourdomain.com
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

## Step 5: Caddyfile (HTTPS)
```
reacher.yourdomain.com {
  reverse_proxy reacher:8080
}
```

## Step 6: Point Your Domain (DNS)
- Type: A
- Name: reacher
- Value: YOUR_VPS_IP
- Proxy: DNS only (not proxied)

## Step 7: Open Firewall
```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

## Step 8: Start Reacher
```bash
docker compose up -d
docker ps
```

Visit: https://reacher.yourdomain.com

## Step 9: Verify Port 25
```bash
nc -vz gmail-smtp-in.l.google.com 25
```
Should say: `succeeded`
