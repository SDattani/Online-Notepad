const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    title : {
        type : String,
        required : true,
        trim : true,
        maxLength : 200,
    },
    content : {
        type : String,
        default : '',
        maxLength : 50000,
    }, 
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true,
    },
},
{
    timestamps : true,
});

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;