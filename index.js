const PassportLocalMongoose = require('passport-local-mongoose');
const GridFsStorage = require('multer-gridfs-storage');
const methodOverride = require('method-override');
const LocalStrategy = require('passport-local');
const bodyParser = require('body-parser');
const User = require("./models/User");
const Grid = require('gridfs-stream');
var flash = require('connect-flash');
const mongoose = require('mongoose');
var passport = require('passport');
const express = require('express');
const multer = require('multer');
const app = express();

// Middleware
app.use(require("express-session")({
  secret : "Hello there!",
  resave : false ,
  saveUninitialized : false
}))
app.use(bodyParser.urlencoded({extended : false}));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use( express.static( "public" ) );
app.use(function(req,res,next){
    res.locals.currUser = req.user;
    next();
})

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
const mongoURI = 'DATABASE_URL';
mongoose.connect(mongoURI);
const conn = mongoose.createConnection(mongoURI);

let gfs;
let loggedInUser;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});
app.get('/',function(req,res){
  res.render('home');
})
//Auth Routes
app.get('/register',function(req,res){
  res.render('register');
})
app.post('/register',function(req,res){

  User.register(new User({username:req.body.username}),req.body.password,function(err,user){
    if(err){
      console.log(err);
      return res.render('register');
    }
    passport.authenticate('local')(req,res,function(){      
        res.redirect('/up/'+req.body.username);
    })
   })
 });
 app.get('/login',function(req,res){
  res.render('login',{message : req.flash("info"),mess : req.flash("err")});
})
app.post('/login',
function(req,res){
  passport.authenticate('local')(req,res,function(){   
    loggedInUser = req.body.username;
    res.redirect('/up/'+req.body.username);
  })
}

);
app.get('/logout',function(req,res){
  req.logout();
  res.redirect("/");
})

app.get('/up/:id', isLoggedIn, (req, res) => {
  User.findOne({username : req.params.id}, function(err,user){
    if (user !== null)
    {
      loggedInUser = user;
    }
    
    if(err) res.json(err);
    else{      
      if(user == null){
        return res.render('index', { files: false });
      }

      var userFilesArray = user.file;
      
      res.render('index', {files: userFilesArray});
      
      // Functions to be added here :-

      /* 
        1. The User object is stored in the variable loggedInUser.
        2. Check the length of 'file' array of the user, e.g. if (loggedInUser.file.length !== 0).
        3. If there are files in the array, we nwwd to fetch the files. Search for the files in 
            uploads collection with the name of the file that will be stored in the 'file' array itself.
        4. Pass the files to 'index' page to display
      */


    };
  });
});
//Auth Routes end


// @route POST /upload
// @desc  Uploads file to DB
// ************    Insert authentication middleware in this route!   ************
app.post('/upload', (req, res) => {
  const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      fileName = file.originalname;
      return  { filename: file.originalname, bucketName: 'uploads' };
    }
  });
  
  let upload = multer({
    storage: storage
  }).single('file');
  
  
  upload(req,res, (err) => {
    if(err){
         res.json({error_code:1,err_desc:err});
         return;
    }
    var newFile = req.file.filename;
    var q = newFile.split(' ').join('_');
    loggedInUser.file.push(q);
    User.findByIdAndUpdate({_id: loggedInUser.id}, {$set: {file: loggedInUser.file}}).then((updatedDoc) => {})
    console.log(q);
    res.redirect('/up/' + loggedInUser.username);
  });
  
});

// @desc Download file with name 'filename'
app.get('/file/:filename', (req, res) => {
  gfs.collection('uploads'); //set collection name to lookup into

  /** First check if file exists */
  gfs.files.find({filename: req.params.filename}).toArray(function(err, files){
      if(!files || files.length === 0){
          return res.status(404).json({
              responseCode: 1,
              responseMessage: "error"
          });
      }
      // create read stream
      var readstream = gfs.createReadStream({
          filename: files[0].filename,
          root: "uploads"
      });
      // set the proper content type 
      res.set('Content-Type', files[0].contentType)
      // Return response
      return readstream.pipe(res);
  });
});

// @route GET /files
// @desc  Display all files in JSON
app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Files exist
    return res.json(files);
  });
});

// @route GET /files/:filename
// @desc  Display single file object
app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    // File exists
    return res.json(file);
  });
});

// @route DELETE /files/:id
// @desc  Delete file
app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }
    
    
    
    // 1. Delete the filename from user's file array and,

    // 2. update it in the database
    
    
    
    res.redirect('/up/' + loggedInUser.username);
  });
});
function isLoggedIn(req,res,next){
    if(req.isAuthenticated()){
      return next();
    }else{
      req.flash('info',"Please login first!");
      req.flash('err',"Invalid username/password");
      res.redirect("/login");

    }
}
const port = 8080;

app.listen(port, () => console.log(`Server started on port ${port}`));
