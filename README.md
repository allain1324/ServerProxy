# Headless SEO

## 1. Prerequisites

- **A VPS or Server** (Ubuntu, Debian, etc.) with:
    - **Docker** & **Docker Compose** installed (simplifies environment).
    - Ports **80** and **443** open for HTTP/HTTPS.
- **Nginx** installed on the host (or in Docker) to act as a reverse proxy.
- **A running Vue/Nuxt app** that sets dynamic meta tags (via `head()` in Nuxt, or another approach).
- **Basic knowledge** of editing config files, using the terminal, etc.

## 2. Setup

1. Pull code from project:

```bash
https://github.com/allain1324/ServerProxy
```

1. Run command: 

```bash
docker compose up -d --build
```

1. Check log (Optional) 

```bash
docker compose logs -f headless-seo-app
```

## 3. Configure Nginx Reverse Proxy

We want to route:

- **Bot** requests → `http://localhost:3001/render?url=...`
- **Users** → main app (for example, `http://localhost:3012`).

Below is a typical approach:

### 3.1. Nginx Main Config

**File:** `/etc/nginx/nginx.conf`

```bash
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;

    # Bot detection
    map $http_user_agent $is_bot {
        default 0;
        ~*(googlebot|facebookexternalhit|facebot|facebookcatalog|bingbot|linkedinbot|twitterbot|applebot|yandexbot|slackbot-linkexpanding|whatsapp|skypeuripreview|discordbot|telegrambot|pinterest|tumblr|viber|weixin|wechat|alexa|semrushbot|duckduckbot|baiduspider|sogou|exabot|ia_archiver|viberbot|slackbot) 1;
     }

    # We'll define how to route in an included server block
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}

```

### 3.2. Create a Server Block

**File:** `/etc/nginx/sites-available/seraphic.website.conf`

*(Adjust domain, paths, ports as needed.)*

```bash
server {
    server_name seraphic.website www.seraphic.website;

    listen 80;

    location / {
        # Route logic
        if ($is_bot) {
            rewrite ^/(.*)$ /render?url=$scheme://$host/$1 break;
            proxy_pass http://localhost:3001;
        }

        if ($is_bot = 0) {
            proxy_pass http://localhost:3012; # main app
        }

        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        # For WebSocket if your main app needs it
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}

```

**Explanation**:

1. Checks `$is_bot`: if **1**, rewrites to `/render?url=...` for the headless SEO server; else pass to main app.
2. The rewrite includes `https://seraphic.website/$1` so the SEO server sees the real path for your domain.
3. If you want SSL, you’ll do `listen 443 ssl;` plus your certificate config.

**Enable site**:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3.3. Test Bot Flow

Simulate a bot:

```bash
curl -A "FacebookExternalHit" https://seraphic.website/guest/event/abc123
```

Nginx sees `$is_bot=1`, rewrites to `/render?url=https://seraphic.website/guest/event/abc123`, and proxies to `localhost:3001`.

**Check** the Headless SEO server logs:

```bash
docker compose logs -f headless-seo-app
```

You should see a request for `/render?url=...`.

### 3.4. Test Normal User Flow

```bash
curl http://seraphic.website/guest/event/abc123
```

## 4. Troubleshooting

### 4.1 Fixing `414 Request-URI Too Large` in Nginx

1. **Why Are You Getting `414 Request-URI Too Large`?**

The error **414 Request-URI Too Large** happens when:

- The request URL (`/render?url=https://seraphic.website/...`) is **too long**.
- **Nginx limits request URI size** by default (`client_header_buffer_size` and `large_client_header_buffers`).

Since bots (like **FacebookExternalHit**) trigger the **rewrite**:

```bash
rewrite ^/(.*)$ /render?url=$scheme://$host/$1 break;
```

the final **proxied request** to `proxy.raijin.site` might exceed Nginx’s built-in limits.

1. **How to fix**
- Update `nginx.conf` (Global Config)
    
    Modify **`/etc/nginx/nginx.conf`** to allow longer request URIs:
    

```bash
http {
    # Increase header buffer sizes
    client_header_buffer_size 16k;
    large_client_header_buffers 4 32k;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Keep your other settings
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}

```

- Restart Nginx
1. **Why Does This Work?**

**`client_header_buffer_size 16k;`**

- Sets the buffer size for the request header (default is **1k** or **4k**).
- Increasing to **16k** allows larger URLs.

**`large_client_header_buffers 4 32k;`**

- Defines **how many large buffers** (4 buffers, 32k each) can be used.
- This handles **really long** URLs without throwing a 414 error.