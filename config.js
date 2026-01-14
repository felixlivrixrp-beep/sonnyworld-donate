// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD...", // Замените на ваш ключ
    authDomain: "sonnyworld-donate.firebaseapp.com",
    projectId: "sonnyworld-donate",
    storageBucket: "sonnyworld-donate.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Настройки сервера
const SERVER_CONFIG = {
    ip: "play.sonnyworld.net",
    rcon: {
        host: "localhost", // Адрес RCON
        port: 25575,       // Порт RCON
        password: ""       // Пароль RCON
    },
    discordWebhook: "https://discord.com/api/webhooks/...", // Webhook Discord
    yoomoneyWallet: "410011...", // Кошелек ЮMoney
    adminPassword: "admin123" // Пароль админ панели
};

// LuckPerms команды для каждой привилегии
const LUCKPERMS_COMMANDS = {
    "D.Helper": [
        "lp user {nickname} parent add d.helper",
        "lp user {nickname} permission set essentials.hat true",
        "lp user {nickname} meta setprefix \"&7[&aD.Helper&7] &f\""
    ],
    "Helper": [
        "lp user {nickname} parent add helper",
        "lp user {nickname} permission set essentials.tpa true",
        "lp user {nickname} permission set essentials.fly true",
        "lp user {nickname} meta setprefix \"&7[&eHelper&7] &f\""
    ],
    "Moder": [
        "lp user {nickname} parent add moder",
        "lp user {nickname} permission set essentials.vanish true",
        "lp user {nickname} permission set essentials.gamemode true",
        "lp user {nickname} meta setprefix \"&7[&9Moder&7] &f\""
    ],
    "Ml.Admin": [
        "lp user {nickname} parent add ml.admin",
        "lp user {nickname} permission set essentials.* true",
        "lp user {nickname} permission set worldedit.* true",
        "lp user {nickname} meta setprefix \"&7[&cMl.Admin&7] &f\""
    ],
    "Admin": [
        "lp user {nickname} parent add admin",
        "lp user {nickname} permission set *",
        "lp user {nickname} meta setprefix \"&7[&6Admin&7] &f\""
    ]
};
