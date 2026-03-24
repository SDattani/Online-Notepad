const mysql = require('mysql2/promise');

let db;


const connectDB = async () => {
    db = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
    });

    await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firstName VARCHAR(100) NOT NULL,
            lastName VARCHAR(100),
            emailId VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            isTwoFactorEnabled BOOLEAN DEFAULT FALSE,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT,
            userId INT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS shared_notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            noteId INT NOT NULL,
            ownerId INT NOT NULL,
            sharedWithUserId INT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            permission ENUM('view', 'edit') NOT NULL DEFAULT 'view',
            isActive BOOLEAN DEFAULT TRUE,
         createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (sharedWithUserId) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        otp VARCHAR(6) NOT NULL,
        tempToken VARCHAR(64) NOT NULL UNIQUE,
        expiresAt TIMESTAMP NOT NULL,
        isUsed BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    console.log('Tables ready!');
    return db;
};

const getDB = () => {
    if (!db) throw new Error('DB not initialized. Call connectDB first.');
    return db;
};

module.exports = { connectDB, getDB };