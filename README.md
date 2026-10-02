# Web login + phòng 3D (React + Node.js + PostgreSQL)

## 1. Cài PostgreSQL và tạo database (trên VPS)
sudo apt update && sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'DOI_MAT_KHAU';"
sudo -u postgres psql -c "CREATE DATABASE appdb OWNER appuser;"

## 2. Cấu hình server
cd server && cp .env.example .env && nano .env
(sửa DATABASE_URL cho đúng mật khẩu, JWT_SECRET đặt chuỗi ngẫu nhiên dài)
npm install

## 3. Build giao diện
cd ../client && npm install && npm run build

## 4. Chạy bằng pm2
cd ../server && pm2 start index.js --name app3d && pm2 save
sudo ufw allow 3000   ->  http://IP_VPS:3000
