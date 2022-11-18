const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true })); // bodyparser

const MongoClient = require("mongodb").MongoClient;

// ejs사용
app.set("view engine", "ejs");

// form으로 post요청하려고 사용했다.
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

// 로그인 & 세션생성 위한 라이브러리(https://dev-dain.tistory.com/73)
// npm install passport passport-local express-session
const passport = require("passport");

const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");

app.use(
  session({ secret: "secret-key", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

//dotenv
require("dotenv").config();

app.use("/public", express.static("public"));

let db;
MongoClient.connect(
  process.env.DB_URL,
  { useUnifiedTopology: true },
  function (error, client) {
    if (error) return console.log(error);
    db = client.db("todoapp");

    app.listen(process.env.PORT, function () {
      console.log("listening on 8080");
    });
  }
);

app.get("/", function (req, res) {
  res.render("home.ejs");
});

app.get("/write", function (req, res) {
  res.render("write.ejs");
});

app.post("/newpost", function (req, res) {
  console.log(req.body);
  db.collection("counter").findOne(
    { name: "totalPost" },
    function (error, result) {
      let count = result.totalPost;
      db.collection("post").insertOne(
        {
          _id: count + 1,
          title: req.body.title,
          content: req.body.content,
          date: req.body.date,
          writer: req.user._id,
        },
        function (error, result) {
          db.collection("counter").updateOne(
            { name: "totalPost" },
            { $inc: { totalPost: 1 } },
            function (err, result) {
              if (err) return console.log(err);
              console.log("count+1됨");
              console.log(req.user._id);
              res.send(
                "이거 안해주면 페이지 멈춤. 싫으면 리다이렉트 이런것도 가능"
              );
            }
          );
        }
      );
    }
  );
});

app.get("/list", function (req, res) {
  db.collection("post")
    .find()
    .toArray(function (error, result) {
      res.render("list.ejs", { posts: result });
    });
});

app.delete("/delete", function (req, res) {
  req.body._id = parseInt(req.body._id);
  db.collection("post").deleteOne(
    { writer: req.user._id, _id: req.body._id },
    function (err, result) {
      res.sendStatus(400);
    }
  );
});

app.get("/detail/:id", function (req, res) {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (err, result) {
      res.render("detail.ejs", { post: result });
    }
  );
});

app.get("/edit/:id", function (req, res) {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (err, result) {
      res.render("edit.ejs", { post: result });
    }
  );
});

app.put("/edit", isLoggedIn, function (req, res) {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id), writer: req.user._id },
    {
      $set: {
        title: req.body.title,
        content: req.body.content,
        date: req.body.date,
      },
    },
    function (err, result) {
      if (result.modifiedCount === 0) console.log("권한 없어요");
      console.log(result);
      res.redirect("/list");
    }
  );
});

app.get("/login", function (req, res) {
  res.render("login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/fail",
  }),
  function (req, res) {
    console.log("로그인성공");
    res.redirect("/");
  }
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
    },
    function (입력한아이디, 입력한비번, done) {
      db.collection("login").findOne(
        { id: 입력한아이디 },
        function (에러, 결과) {
          if (에러) return done(에러);
          if (!결과) return done(null, false);
          if (입력한비번 == 결과.pw) {
            return done(null, 결과);
          } else {
            return done(null, false);
          }
        }
      );
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  db.collection("login").findOne({ id: id }, function (error, result) {
    done(null, result);
  });
});

app.get("/mypage", isLoggedIn, function (req, res) {
  console.log(req.user);
  res.render("mypage.ejs", { userData: req.user });
});

function isLoggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.send("로그인 안했습니다만");
  }
}

app.post("/register", function (req, res) {
  db.collection("login").findOne({ id: req.body.id }, function (err, result) {
    if (result) {
      return res.send("아이디 중복! 다른아이디로 회원가입 바랍니다.");
    }
    db.collection("login").insertOne(
      { id: req.body.id, pw: req.body.pw },
      function () {
        res.send("회원가입완료");
      }
    );
  });
});

app.get("/search", function (req, res) {
  db.collection("post")
    .find({ title: { $regex: req.query.value } })
    .toArray(function (err, result) {
      console.log(result);
    });
});

const { ObjectId } = require("mongodb");
app.post("/chat", function (req, res) {
  console.log(req.body);
  db.collection("chat").insertOne({
    member: [ObjectId(req.body.writer), req.user._id],
    date: new Date(),
    title: new Date() + "채팅방",
  });
});

app.get("/chat", isLoggedIn, function (req, res) {
  db.collection("chat")
    .find({ member: { $in: [req.user._id] } })
    .toArray(function (err, result) {
      console.log(result);
      res.render("chat.ejs", { chatroom: result });
    });
});

app.post("/message", function (req, res) {
  db.collection("message").insertOne(
    {
      parent: req.body.parent,
      content: req.body.content,
      date: new Date(),
      userid: req.user._id,
    },
    function (err, result) {}
  );
});
app.get("/message/:id", isLoggedIn, function (req, res) {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  db.collection("message")
    .find({ parent: req.params.id })
    .toArray(function (err, result) {
      res.write("event: test\n");
      res.write(`data: ${JSON.stringify(result)}\n\n`);

      const pipeline = [{ $match: { "fullDocument.parent": req.params.id } }];
      const collection = db.collection("message");
      const changeStream = collection.watch(pipeline);
      changeStream.on("change", (result) => {
        console.log(result.fullDocument);
        res.write("event: test\n");
        res.write(`data: ${JSON.stringify([result.fullDocument])}\n\n`);
      });
    });
});
