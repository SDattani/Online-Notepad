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

    // Drop the legacy otps table if it exists
    await db.execute('DROP TABLE IF EXISTS otps');

    await db.execute(`
        CREATE TABLE IF NOT EXISTS user_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            userId INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            previousData JSON,
            newData JSON,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_action (userId)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS note_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            userId INT NOT NULL,
            noteId INT,
            action VARCHAR(100) NOT NULL,
            previousData JSON,
            newData JSON,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
            INDEX idx_note_history (noteId),
            INDEX idx_note_user (userId)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS shared_note_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            userId INT NOT NULL,
            noteId INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            previousData JSON,
            newData JSON,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
            INDEX idx_shared_history (noteId),
            INDEX idx_shared_user (userId)
        )
    `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        ownerId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS team_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teamId INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        createdBy INT NOT NULL,
        parentRoleId INT DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parentRoleId) REFERENCES team_roles(id) ON DELETE SET NULL,
        UNIQUE KEY unique_role_per_team (teamId, name)
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roleId INT NOT NULL,
        permissionId INT NOT NULL,
        FOREIGN KEY (roleId) REFERENCES team_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_role_permission (roleId, permissionId)
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS team_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teamId INT NOT NULL,
        userId INT NOT NULL,
        roleId INT NOT NULL,
        invitedBy INT NOT NULL,
        status ENUM('pending', 'active', 'removed') DEFAULT 'pending',
        joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (roleId) REFERENCES team_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_team_member (teamId, userId)
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS team_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teamId INT,
        performedBy INT,
        action VARCHAR(100) NOT NULL,
        previousData JSON,
        newData JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE SET NULL,
        FOREIGN KEY (performedBy) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_team_audit (teamId),
        INDEX idx_team_audit_user (performedBy)
    )
`);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_refresh_token (token),
        INDEX idx_refresh_user (userId)
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