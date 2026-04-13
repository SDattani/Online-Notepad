const SharedNote = require('../models/sharedNotes');
const Note = require('../models/note');
const User = require('../models/user');
const Audit = require('../models/audit');
const validator = require('validator');
const { sendResponse } = require('../utils/response');
const createShareLink = require('../utils/createShareLink');

const shareNote = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);
        const permission = req.body.permission?.toLowerCase();
        const ownerId = req.user.id;
        const emailId = req.body.emailId?.toLowerCase().trim();

        if (!noteId || isNaN(noteId)) {
            return sendResponse(res, { status: 400, message: 'Invalid note ID', data: null });
        }
        if (!emailId) {
            return sendResponse(res, { status: 400, message: 'emailId is required', data: null });
        }
        if (!validator.isEmail(emailId)) {
            return sendResponse(res, { status: 400, message: 'Invalid email address', data: null });
        }
        if (emailId === req.user.emailId.toLowerCase()) {
            return sendResponse(res, { status: 400, message: 'You cannot share a note with yourself', data: null });
        }
        if (!permission || !['view', 'edit'].includes(permission)) {
            return sendResponse(res, { status: 400, message: "Permission must be 'view' or 'edit'", data: null });
        }

        const note = await Note.findOne(noteId, ownerId);
        if (!note) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        const targetUser = await User.findByEmail(emailId);
        if (!targetUser) {
            return sendResponse(res, { status: 404, message: 'No user found with this email', data: null });
        }

        const shared = await SharedNote.create({ noteId, ownerId, sharedWithUserId: targetUser.id, permission });

        await Audit.logSharedNoteAction(ownerId, noteId, 'NOTE_SHARED', null, {
            sharedWithEmail: targetUser.emailId,
            permission: shared.permission,
        });

        return sendResponse(res, {
            status: 201,
            message: `Note shared with ${targetUser.firstName} ${targetUser.lastName} successfully`,
            data: {
                shareLink: createShareLink(shared.token),
                sharedWith: {
                    name: `${targetUser.firstName} ${targetUser.lastName}`,
                    email: targetUser.emailId,
                },
                permission: shared.permission,
                token: shared.token,
            },
        });
    } catch (err) {
        if (err.message === 'Note is already shared to this User!!') {
            return sendResponse(res, { status: 400, message: err.message, data: null });
        }
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getSharesForNote = async (req, res) => {
    try {
        const { id } = req.params;

        const note = await Note.findOne(id, req.user.id);
        if (!note) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        const shares = await SharedNote.findByNoteId(id, req.user.id);
        const sharesWithLinks = shares.map(share => ({
            ...share,
            shareLink: createShareLink(share.token),
        }));

        return sendResponse(res, { status: 200, message: 'Shares fetched successfully', data: sharesWithLinks });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const updateSharePermission = async (req, res) => {
    try {
        const { token } = req.params;
        const permission = req.body.permission?.toLowerCase();

        if (!permission || !['view', 'edit'].includes(permission)) {
            return sendResponse(res, { status: 400, message: "Permission must be 'view' or 'edit'", data: null });
        }

        const existingShare = await SharedNote.findByTokenForOwner(token, req.user.id);
        if (!existingShare) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        const updated = await SharedNote.updatePermission(token, req.user.id, permission);
        if (!updated) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        await Audit.logSharedNoteAction(
            req.user.id, existingShare.noteId, 'SHARE_PERMISSION_UPDATED',
            { permission: existingShare.permission },
            { permission }
        );

        return sendResponse(res, { status: 200, message: 'Permission updated successfully', data: { permission } });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const revokeShare = async (req, res) => {
    try {
        const { token } = req.params;

        const existingShare = await SharedNote.findByTokenForOwner(token, req.user.id);
        if (!existingShare) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        const revoked = await SharedNote.revoke(token, req.user.id);
        if (!revoked) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        await Audit.logSharedNoteAction(
            req.user.id, existingShare.noteId, 'SHARE_REVOKED',
            { sharedWithUserId: existingShare.sharedWithUserId },
            { isActive: false }
        );

        return sendResponse(res, { status: 200, message: 'Share link revoked successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

module.exports = { shareNote, getSharesForNote, updateSharePermission, revokeShare };
