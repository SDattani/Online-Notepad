# 📝 Online Notepad API

A RESTful API for an Online Notepad application built with **Node.js**, **Express**, and **MySQL**. Supports user authentication with JWT cookies, and full CRUD operations for notes.

---

## 🛠 Tech Stack

| Package | Purpose |
|---|---|
| express | Web framework |
| mysql2 | MySQL database driver |
| jsonwebtoken | JWT authentication |
| bcrypt | Password hashing |
| cookie-parser | Cookie handling |
| validator | Input validation |
| dotenv | Environment variables |
| swagger-ui-express | API documentation |
| swagger-jsdoc | Swagger from JSDoc comments |

---

## 📁 Project Structure

```
Online Notepad/
├── src/
│   ├── config/
│   │   └── database.js        # MySQL connection pool + auto table creation
│   ├── middleware/
│   │   └── Auth.js            # JWT authentication middleware
│   ├── models/
│   │   ├── user.js            # User model (SQL queries)
│   │   └── note.js            # Note model (SQL queries)
│   ├── routes/
│   │   ├── auth.js            # Signup, Login, Logout
│   │   ├── user.js            # View profile, Update password
│   │   └── note.js            # CRUD operations for notes
│   ├── utils/
│   │   └── validation.js      # Signup data validation
│   ├── docs/
│   │   └── swagger.config.js  # Swagger configuration
│   └── app.js                 # Entry point
├── .env                       # Environment variables (never commit!)
├── .env.example               # Environment variables template
├── .gitignore
├── database.sql               # SQL file to setup DB and tables
├── package.json
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js installed
- MySQL 8.0+ installed and running
- MySQL Workbench (optional, for viewing data)

---

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd online-notepad
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in your values:
```env
JWT_SECRET=your_jwt_secret_here
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=onlinenotepad
DB_PORT=3306
```

### 4. Setup MySQL database
Make sure MySQL is running, then run the SQL file:
```bash
mysql -u root -p < database.sql
```
Or open `database.sql` in MySQL Workbench and run it manually.

> ✅ Tables (`users` and `notes`) are also created automatically when the server starts.

### 5. Start the server

Development (with nodemon):
```bash
npm run dev
```

Production:
```bash
node src/app.js
```

You should see:
```
Tables ready!
Connected to MySQL successfully!
Server is Running on port 3000
```

---

## 📖 API Documentation

Swagger docs available at:
```
http://localhost:3000/api-docs
```

---

## 🔗 API Endpoints

### 🔐 Auth Routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/signup` | 🔓 Public | Register a new user |
| POST | `/login` | 🔓 Public | Login and get token cookie |
| POST | `/logout` | 🔒 Protected | Logout and clear cookie |

#### Signup
```http
POST /signup
Content-Type: application/json

{
    "firstName": "Sahil",
    "lastName": "Dattani",
    "emailId": "sahil@gmail.com",
    "password": "Sah#2003"
}
```

#### Login
```http
POST /login
Content-Type: application/json

{
    "emailId": "sahil@gmail.com",
    "password": "Sah#2003"
}
```

---

### 👤 User Routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET    | `/user/view`   | 🔒 Protected | Get logged-in user profile |
| PATCH  | `/user/password` | 🔒 Protected | Update password |

#### Update Password
```http
PATCH /user/password
Content-Type: application/json

{
    "oldPassword": "Sah#2003",
    "newPassword": "Sah#2904"
}
```

---

### 📝 Notes Routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/notes` | 🔒 Protected | Create a new note |
| GET | `/notes` | 🔒 Protected | Get all notes |
| GET | `/notes/:id` | 🔒 Protected | Get a single note by ID |
| PATCH | `/notes/:id` | 🔒 Protected | Update a note |
| DELETE | `/notes/:id` | 🔒 Protected | Delete a note |

#### Create Note
```http
POST /notes
Content-Type: application/json

{
    "title": "My First Note",
    "content": "This is my note\n\n- point one\n- point two\n\nDone."
}
```

#### Update Note
Only send the fields you want to update — other fields stay unchanged:
```http
PATCH /notes/:id
Content-Type: application/json

{
    "content": "Updated content only, title stays the same"
}
```

---

## 🔒 Authentication

This API uses **JWT tokens stored in HTTP cookies.**

- On login a cookie named `token` is set automatically
- All protected routes read this cookie via `UserAuth` middleware
- On logout the cookie is cleared
- Token expires in **7 days**

---

## 📝 Note Content Formatting

Notes support **Markdown syntax** — the backend stores plain text and the frontend renders it.

| What you type | How it renders |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `# Heading` | Big heading |
| `- item` | Bullet point |
| `1. item` | Numbered list |
| `\n` | New line |

✅ Emojis, multilingual text (Hindi 🇮🇳, Gujarati, Arabic, Japanese), and special characters are all fully supported.

---

## ⚠️ Validation Rules

### Signup
- `firstName` and `lastName` are required
- `emailId` must be a valid email
- `password` must be strong (uppercase, lowercase, number, symbol)

### Notes
- `title` is required, max **200 characters**
- `content` is optional, max **50,000 characters**

---

## 🗄️ Database Schema

### users table
| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| firstName | VARCHAR(100) | Required |
| lastName | VARCHAR(100) | Optional |
| emailId | VARCHAR(255) | Unique, required |
| password | VARCHAR(255) | Hashed with bcrypt |
| createdAt | TIMESTAMP | Auto generated |
| updatedAt | TIMESTAMP | Auto updated |

### notes table
| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| title | VARCHAR(200) | Required |
| content | TEXT | Optional, supports markdown |
| userId | INT | Foreign key → users.id |
| createdAt | TIMESTAMP | Auto generated |
| updatedAt | TIMESTAMP | Auto updated |

> 🔗 `userId` has a `FOREIGN KEY` constraint — deleting a user automatically deletes all their notes (`ON DELETE CASCADE`)

---

## 🔐 Security Features

- Passwords hashed with **bcrypt** (salt rounds: 10)
- JWT tokens expire in **7 days**
- All SQL queries use **prepared statements** — prevents SQL injection
- Sensitive data stored in **environment variables**
- `.env` file excluded from git via `.gitignore`

---

## 🧪 Testing

Import the Postman collection (`onlineNotepad_postman_collection.json`) included in the repo to test all endpoints.

> ⚠️ Always hit `/login` first before testing protected routes so the cookie is set.

---

## 👨‍💻 Author

**Sahil Dattani**
