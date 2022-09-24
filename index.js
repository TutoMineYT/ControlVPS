var cookieSession = require('cookie-session')
var express = require('express')
const randomstring = require("randomstring")
const megadb = require("megadb")
const db = new megadb.crearDB("webData")
var bodyParser = require('body-parser');
const { exec } = require("child_process");
const fs = require('fs');

var app = express()
app.listen(9090)
app.set('trust proxy', 1) // trust first proxy
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/assets'));
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}))

fs.unlink("./logs/logs.txt", async(error) => {})

app.get("/", async (req, res) => {
  let name = await db.obtener("keys." + req.session.key)
  if(req.session.key) {
    if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    return res.redirect("/")
  }
  }
    res.render("index.ejs", { req: req, name: name })
})
app.get("/login", async (req, res) => {
  if(req.session.key) return res.redirect("/admin")
  res.render("login.ejs", { req: req })
})
app.get("/logout", async (req, res) => {
  if(!req.session.key) return res.redirect("/login")
  req.session.key = null
  res.redirect("/")
})
app.get("/admin", async (req, res) => {
  if(!req.session.key) return res.redirect("/login")
  if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    res.redirect("/login")
  }
  let name = await db.obtener("keys." + req.session.key)
    res.render("admin.ejs", { req: req, name: name })
})
app.get("/changePass", async (req, res) => {
  if(!req.session.key) return res.redirect("/login")
  if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    res.redirect("/login")
  }
  let name = await db.obtener("keys." + req.session.key)
    res.render("changePass.ejs", { req: req, name: name })
})

app.get("/api/:action", async (req, res) => {
  let action = req.params.action
  if(!req.params) return res.status(404).send("Invalid action provided/requested.")

  if(!req.session.key) return res.redirect("/login")
  if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    res.redirect("/login")
  }

  if(action === "reboot") {
    exec("reboot", () => {
      res.redirect("/admin")
    });
  }
  if(action === "shutdown") {
    exec("shutdown -s", () => {
      res.redirect("/admin")
    });
  }
  if(action === "logs") {
    try {
      const data = fs.readFileSync('./logs/logs.txt', 'UTF-8');
    const array = data.split(/\r?\n/);
    res.render("logs.ejs", { req: req, array: array })
    } catch (e) {
    res.render("logs.ejs", { req: req, array: [ "No logs" ] })
    }
  }
})

app.post("/api/command", async (req, res) => {
  if(!req.session.key) return res.redirect("/login")
  if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    res.redirect("/login")
  }
  let command = req.body.command
  if(!command) return res.redirect("/admin")
  exec(command + ">> ./logs/logs.txt", () => {
    res.redirect("/admin")
  });
})
app.post("/api/changePass", async (req, res) => {
  if(!req.session.key) return res.redirect("/login")
  if(!db.tiene("keys." + req.session.key)) {
    req.session.key = null
    res.redirect("/login")
  }
  let password = req.body.password
  let confirmpassword = req.body.confirmpassword
  if(!password || !confirmpassword) return res.redirect("/changePass?status=error&error=missing_fields")
  if(password !== confirmpassword) return res.redirect("/changePass?status=error&error=not_same_password")

  let username = await db.obtener("keys." + req.session.key)

  db.establecer("users." + username + ".password", password)
  res.redirect("/changePass?status=success")
  setTimeout(() => {
    db.eliminar("keys")
  }, 500)
 
})

app.post("/login", async (req, res) => {
  let key = req.session.key
  if(key) return res.redirect("/admin")
  if(!req.body.username || !req.body.password) return res.redirect("/login")

  let username = req.body.username
  let password = req.body.password

  if(!db.tiene("users." + username)) return res.redirect("/login?error=no_account")
  if((await db.obtener("users." + username + ".password")) !== password) return res.redirect("/login?error=no_account")

  let num = random(170, 500)
  let newkey = randomstring.generate(num)

  db.establecer("keys." + newkey, username)
  req.session.key = newkey

  res.redirect("/admin")

})



function random(min,max){
  return Math.floor((Math.random() * (max-min)) +min);
}



