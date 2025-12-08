# iRequest - Hệ thống quản lý yêu cầu

Một ứng dụng web quản lý yêu cầu được xây dựng với Node.js, Express, Handlebars và Supabase PostgreSQL.

## 🚀 Tính năng

### Tính năng cơ bản

- ✅ Xác thực người dùng (đăng ký/đăng nhập/quên mật khẩu)
- ✅ Tạo và quản lý yêu cầu
- ✅ Dashboard với thống kê
- ✅ Hệ thống bình luận
- ✅ Theo dõi trạng thái yêu cầu
- ✅ Quản lý hồ sơ người dùng
- ✅ Thông báo realtime
- ✅ Responsive design

### Tính năng nâng cao (v2.0)

- 🆕 **Quản lý Nhân viên**: CRUD, phân quyền, đặt lại mật khẩu
- 🆕 **Quản lý Phòng ban**: Cơ cấu tổ chức, gán quản lý
- 🆕 **Quản lý Workflow**: Tự động hóa quy trình xử lý
- 🆕 **Workflow Steps**: Định nghĩa các bước với phê duyệt
- 🆕 **Tin nhắn**: Chat 1-1 và nhóm, gửi file
- 🆕 **Cài đặt hệ thống**: Email, bảo mật, backup
- 🆕 **Trang cá nhân**: Thống kê, lịch sử hoạt động
- ⭐ **Dynamic Form Builder**: Form động dựa trên workflow (NEW!)

👉 **[Xem chi tiết tính năng mới](FEATURES.md)**  
👉 **[Hướng dẫn Dynamic Form Builder](QUICKSTART.md)**

## 🛠 Công nghệ sử dụng

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Template Engine**: Handlebars (HBS)
- **Frontend**: Bootstrap 5, Font Awesome
- **Authentication**: JWT + Sessions
- **Security**: Helmet, bcryptjs
- **Development**: Nodemon

## 📋 Yêu cầu hệ thống

- Node.js >= 14.x
- npm >= 6.x
- Supabase project hoặc PostgreSQL database

## 🔧 Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/hoanghaip2005/Web_Irequest_Superbase.git
cd Web_Irequest_Superbase
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` và cấu hình thông tin database:

```env
# Supabase Database Configuration
DB_HOST=aws-1-ap-south-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.axotbdldierjitagqfrz
DB_PASSWORD=1234
DB_POOL_MODE=transaction

# Application Configuration
PORT=3000
NODE_ENV=development

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

### 4. Tạo database schema

Chạy file `supabase_schema.sql` trong Supabase SQL Editor hoặc PostgreSQL:

```bash
# Sử dụng psql
psql "$DATABASE_URL" -f supabase_schema.sql

# Hoặc copy nội dung file vào Supabase SQL Editor
```

### 5. Chạy migration để thêm dữ liệu mẫu

```bash
# Thêm quyền thực thi cho script
chmod +x run-migration.sh

# Chạy migration
./run-migration.sh
```

Migration sẽ tạo:

- ✅ Priorities (Cao, Trung bình, Thấp)
- ✅ Roles (Admin, Manager, User)
- ✅ Statuses (Mới tạo, Đang xử lý, Hoàn thành, ...)
- ✅ Departments mẫu (IT, HR, Finance, ...)
- ✅ Admin user mặc định
- ✅ Workflow mẫu với 5 bước

**Tài khoản Admin mặc định:**

- Username: `admin`
- Password: `Admin@123`
- Email: `admin@irequest.com`

⚠️ **LƯU Ý**: Đổi mật khẩu ngay sau lần đăng nhập đầu tiên!

### 6. Chạy ứng dụng

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

Ứng dụng sẽ chạy tại: http://localhost:3000

## 📁 Cấu trúc project

```
Web_Irequest_Superbase/
├── config/
│   ├── database.js          # Cấu hình database
│   └── handlebars.js        # Cấu hình handlebars helpers
├── controllers/             # Controllers (chưa sử dụng)
├── middleware/
│   └── auth.js             # Authentication middleware
├── models/
│   ├── User.js             # User model
│   └── Request.js          # Request model
├── routes/
│   ├── index.js            # Route chính
│   ├── auth.js             # Authentication routes
│   ├── requests.js         # Request routes
│   ├── users.js            # User & profile routes
│   ├── notifications.js    # Notification routes
│   ├── employees.js        # 🆕 Employee management routes
│   ├── departments.js      # 🆕 Department management routes
│   ├── workflows.js        # 🆕 Workflow management routes
│   ├── chat.js             # 🆕 Chat routes
│   └── settings.js         # 🆕 Settings routes
├── views/
│   ├── layouts/
│   │   ├── main.hbs        # Layout chính (updated menu)
│   │   └── auth.hbs        # Layout cho auth pages
│   ├── auth/
│   │   ├── login.hbs       # Trang đăng nhập
│   │   ├── register.hbs    # Đăng ký
│   │   ├── forgot-password.hbs
│   │   └── reset-password.hbs
│   ├── requests/
│   │   ├── index.hbs       # Danh sách yêu cầu
│   │   ├── create.hbs      # Tạo yêu cầu
│   │   ├── detail.hbs      # Chi tiết yêu cầu
│   │   ├── my.hbs          # Yêu cầu của tôi
│   │   └── assigned.hbs    # Yêu cầu được giao
│   ├── employees/
│   │   └── index.hbs       # 🆕 Quản lý nhân viên
│   ├── departments/
│   │   └── index.hbs       # 🆕 Quản lý phòng ban
│   ├── workflows/
│   │   ├── index.hbs       # 🆕 Quản lý workflow
│   │   └── steps.hbs       # 🆕 Quản lý bước workflow
│   ├── chat/
│   │   └── index.hbs       # 🆕 Chat interface
│   ├── settings/
│   │   └── index.hbs       # 🆕 Cài đặt hệ thống
│   ├── users/
│   │   └── profile.hbs     # 🆕 Trang cá nhân
│   ├── notifications/
│   │   └── index.hbs       # Thông báo
│   ├── index.hbs           # Trang chủ
│   └── dashboard.hbs       # Dashboard
├── public/
│   ├── css/
│   │   ├── style.css       # Custom CSS
│   │   └── assigned-requests.css
│   └── js/
│       ├── app.js          # Frontend JavaScript
│       └── chat.js         # 🆕 Chat JavaScript
├── migrations/
│   └── add_sample_data.sql # 🆕 Migration script
├── app.js                  # Main application file
├── package.json
├── supabase_schema.sql     # Database schema
├── README.md
├── FEATURES.md             # 🆕 Chi tiết tính năng mới
└── run-migration.sh        # 🆕 Script chạy migration
```

## 🔐 Authentication

Ứng dụng sử dụng hybrid authentication:

- **Sessions**: Cho web interface
- **JWT**: Cho API endpoints
- **bcrypt**: Mã hóa password

## 📊 Database Schema

Xem file `supabase_schema.sql` để biết chi tiết về cấu trúc database. Bao gồm:

- Users management
- Request tracking
- Comments system
- Workflow management
- Notifications
- Role-based access control

## 🛡 Security Features

- **Row Level Security (RLS)**: Bảo vệ dữ liệu ở database level
- **CORS**: Cấu hình cross-origin requests
- **Helmet**: Security headers
- **Input validation**: Server-side validation
- **SQL Injection protection**: Parameterized queries

## 📱 API Endpoints

### Authentication

- `POST /auth/login` - Đăng nhập
- `POST /auth/register` - Đăng ký
- `GET /auth/logout` - Đăng xuất

### Requests

- `GET /requests` - Danh sách requests
- `POST /requests/create` - Tạo request mới
- `GET /requests/:id` - Chi tiết request
- `POST /requests/:id/comments` - Thêm comment

### Users

- `GET /users` - Danh sách users
- `GET /users/profile` - Hồ sơ cá nhân
- `POST /users/profile` - Cập nhật hồ sơ

### API JSON Endpoints

- `GET /api/health` - Health check
- `GET /api/requests` - Get requests (JSON)
- `POST /api/requests` - Create request (JSON)
- `GET /api/users` - Get users (JSON)

## 🔄 Development Workflow

1. **Tạo branch mới:**

```bash
git checkout -b feature/new-feature
```

2. **Develop và test:**

```bash
npm run dev
```

3. **Commit changes:**

```bash
git add .
git commit -m "Add new feature"
```

4. **Push và tạo PR:**

```bash
git push origin feature/new-feature
```

## 🐛 Troubleshooting

### Database Connection Issues

- Kiểm tra thông tin kết nối trong `.env`
- Đảm bảo Supabase project đang active
- Kiểm tra firewall/network restrictions

### Authentication Problems

- Verify JWT_SECRET trong `.env`
- Clear browser cookies/session
- Check session configuration

### Performance Issues

- Monitor database connection pool
- Check for N+1 queries
- Enable query logging for debugging

## 📦 Deployment

### Heroku Deployment

1. **Tạo Heroku app:**

```bash
heroku create your-app-name
```

2. **Set environment variables:**

```bash
heroku config:set DB_HOST=your-db-host
heroku config:set DB_PASSWORD=your-password
# ... other env vars
```

3. **Deploy:**

```bash
git push heroku main
```

### Vercel Deployment

1. **Install Vercel CLI:**

```bash
npm i -g vercel
```

2. **Deploy:**

```bash
vercel --prod
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📝 License

This project is licensed under the ISC License.

## 👥 Team

- **Developer**: Phạm Hoàng Hải
- **Email**: hoanghaip2005@gmail.com
- **GitHub**: [@hoanghaip2005](https://github.com/hoanghaip2005)

## 🔗 Links

- **Repository**: https://github.com/hoanghaip2005/Web_Irequest_Superbase
- **Issues**: https://github.com/hoanghaip2005/Web_Irequest_Superbase/issues
- **Supabase**: https://supabase.com/

---

**Happy Coding!** 🚀
