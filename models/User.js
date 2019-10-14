const Mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
var UserSchema = new Mongoose.Schema({
    username : String,
    password : String,
    file : []
});
UserSchema.plugin(passportLocalMongoose);
module.exports = Mongoose.model("User",UserSchema);