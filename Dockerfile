# Sử dụng node 18 (hoặc LTS mới hơn)
FROM node:18-slim

# Cài dependencies cho Chromium (puppeteer)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    chromium \
    libpangocairo-1.0-0 \
    libgbm-dev \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxi6 \
    libxdamage1 \
    libxtst6 \
    libnss3 \
    libxrandr2 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tạo thư mục cho ứng dụng
WORKDIR /app

# Copy file package.json và cài đặt
COPY package.json ./
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở port 3001 (nếu config tại server)
EXPOSE 3001

# Lệnh chạy khi container start
CMD ["npm", "start"]
