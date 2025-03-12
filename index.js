const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const nodemailer = require("nodemailer");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser")
const sharedSession = require("express-socket.io-session");
const { text } = require("body-parser");

const app = express();  
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");   
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

const sessionMiddleWaRe = session({
    secret: "MySecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}) 

app.use(cookieParser())
app.use(sessionMiddleWaRe)

// app.use(session({
//     secret: "MySecretKey",
//     resave: false,
//     saveUninitialized: false,
//     cookie: { secure: false }
// }));

const transporter = nodemailer.createTransport({
    host: "smtp.mail.me.com", 
    port: 587,
    secure: false,
    auth: {
        user: "g.surov@icloud.com",
        pass: "keck-ddbj-mqor-zopg"
    }
});

const sendEmail = async () => {
    try {
        let info = await transporter.sendMail({
            from: '"Admin" <g.surov@icloud.com>', 
            to: "georgiisurov@gmail.com",
            subject: "TEST",
            text: "Hello!",
            html: "<b>Привет! это текстовое письмо и хватит<b> "
        }); 
        console.log("Email sent!", info.messageId);
    } 
    catch (error) {
        console.error(error);
    }
};

sendEmail();

const ADMIN = {
    username: "admin",
    password: "admin101"
};

const USERS_FILE = path.join(__dirname, "users.json");

const loadUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, "utf8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
};

let users = loadUsers();

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, email, password: hashedPassword, role: "user", visits: 1 });
    saveUsers(users);
    res.redirect("/login");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN.username && password === ADMIN.password) {
        req.session.user = username;
        req.session.role = "Admin";
        return res.redirect("/");
    }
    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user.username;
        req.session.role = user.role;
        user.visits += 1;
        req.session.visits = users.visits;
        return res.redirect("/");
    } else {
        res.render("login", { error: "Неверное имя пользователя или пароль!" });
    }
});

app.post("/profile/edit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const { username, email, password } = req.body;
    const user = users.find(u => u.username === req.session.user);

    user.username = username;
    user.email = email;

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
    }

    saveUsers(users);
    req.session.user = username;
    res.redirect("/");
});

app.get("/login", (req, res) => {
    res.render("login", { error: null });
});

app.get("/", (req, res) => {
    res.render("index", { user: req.session.user, role: req.session.role });
});

app.get('/admusers', (req, res) => {
    if (!req.session.user || req.session.role !== "Admin") {
        return res.redirect('/');
    }

    res.render('admusers', { users });
});

app.get("/profile/edit", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const user = users.find(u => u.username === req.session.user);
    res.render("editProfile", { user });
});

app.get("/chat", (req, res) => {
    res.render("chat");
});

io.use(sharedSession(sessionMiddleWaRe, { autoSave:true } ))

io.on('connection', (socket) => { 
    console.log('🔵 Пользователь подключился ' + socket.id);
    
    const username = socket.handshake.session.user || "Guest" ;

    socket.on('chat message', (msg) => {
        io.emit('chat message', {username, text:msg});
        console.log(`💬 Сообщение от ${username}: ${msg}`);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Пользователь отключился');
    });
});

const PORT = "8070";
server.listen(PORT, () => {
    console.log(`Server is up! http://localhost:${PORT}`);
});
