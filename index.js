const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const User = require("./models/User");
var passport = require('passport');
const LocalStrategy = require('passport-local');
const PassportLocalMongoose = require('passport-local-mongoose');
var flash = require('connect-flash');
const app = express();
///app.use(express.cookieParser('keyboard cat'));
//app.use(express.session({ cookie: { maxAge: 60000 }}));

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
//passport.use(User.createStrategy());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
const mongoURI = '';
mongoose.connect(mongoURI);
const conn = mongoose.createConnection(mongoURI);
// const MongoClient = require('mongodb').MongoClient;
// //const uri = "mongodb+srv://vinayak:<password>@cluster0-ipdrn.mongodb.net/admin?retryWrites=true&w=majority";
// const client = new MongoClient(mongoURI, { useNewUrlParser: true });
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });
let gfs;

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
  //var username = req.body.username
  //req.body.password
  User.register(new User({username:req.body.username}),req.body.password,function(err,user){
    if(err){
      console.log(err);
      return res.render('register');
    }
    passport.authenticate('local')(req,res,function(){      
        res.redirect('/up');
    })
   })
 });
 app.get('/login',function(req,res){
  res.render('login',{message : req.flash("info"),mess : req.flash("err")});
})
app.post('/login',
  passport.authenticate('local', 
  { successRedirect: '/up',
  failureRedirect: '/login' }),
  function(req,res){
    //req.flash("err","Invalid username/password")
  }
);
app.get('/logout',function(req,res){
  req.logout();
  res.redirect("/");
})

app.get('/up',isLoggedIn, (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render('index', { files: false });
    } else {
      res.render('index', { files: files });
    }
  });
});
//Auth Routes end
// @route GET /
// @desc Loads form
// @route POST /upload
// @desc  Uploads file to DB

// ************    Insert authentication middleware in this route!   ************
app.post('/upload', (req, res) => {
  const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
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
    res.redirect('/');
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

    res.redirect('/');
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
