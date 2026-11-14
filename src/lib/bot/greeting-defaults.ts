import type { BotLocale, GreetingKind } from "./kinds";

/**
 * The bot's default welcome and goodbye texts, word for word, in each of
 * the server languages (`bot/src/i18n/<locale>.json`, `ui.greetings`). The
 * dashboard shows the one the bot will actually post: the server's
 * language, not the page's. `tests/unit/bot-greeting-defaults.test.ts`
 * fails as soon as these drift from the bot's files.
 */
export const GREETING_DEFAULTS: Record<BotLocale, Record<GreetingKind, string>> = {
  en: {
    welcome: "Welcome to **{server}**, {user}! There are {count} of us now: pick your roles in Channels & Roles.",
    goodbye: "**{username}** has left the server.",
  },
  fr: {
    welcome: "Bienvenue sur **{server}**, {user} ! Nous sommes maintenant {count} : choisis tes rôles dans Salons et rôles.",
    goodbye: "**{username}** a quitté le serveur.",
  },
  it: {
    welcome: "Benvenuto su **{server}**, {user}! Ora siamo in {count}: scegli i tuoi ruoli in Canali e ruoli.",
    goodbye: "**{username}** ha lasciato il server.",
  },
  es: {
    welcome: "¡Te damos la bienvenida a **{server}**, {user}! Ya somos {count}: elige tus roles en Canales y roles.",
    goodbye: "**{username}** ha salido del servidor.",
  },
  id: {
    welcome: "Selamat datang di **{server}**, {user}! Sekarang kita ada {count} anggota: pilih peranmu di Saluran & Peran.",
    goodbye: "**{username}** telah keluar dari server.",
  },
};
