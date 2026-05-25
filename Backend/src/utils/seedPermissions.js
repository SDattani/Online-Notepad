const { getDB } = require('../config/database');

const permissions = [
    { action: 'note:create',    description: 'Can create notes' },
    { action: 'note:edit',      description: 'Can edit notes' },
    { action: 'note:delete',    description: 'Can delete notes' },
    { action: 'note:view',      description: 'Can view notes' },
    { action: 'note:share',     description: 'Can share notes with others' },
    { action: 'member:invite',  description: 'Can invite members to the team' },
    { action: 'member:remove',  description: 'Can remove members from the team' },
    { action: 'role:create',    description: 'Can create roles' },
    { action: 'role:assign',    description: 'Can assign roles to members' },
    { action: 'role:delete',    description: 'Can delete roles' },
    { action: 'audit:view',     description: 'Can view audit logs' },
];

const seedPermissions = async () => {
    const db = getDB();
    for (const perm of permissions) {
        await db.execute(
            `INSERT IGNORE INTO permissions (action, description) VALUES (?, ?)`,
            [perm.action, perm.description]
        );
    }
    console.log('Permissions seeded!');
};

module.exports = seedPermissions;