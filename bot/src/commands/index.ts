import type { Command, ComponentHandler } from "../discord/types.js";
import { about } from "./about.js";
import { build } from "./build.js";
import { compare } from "./compare.js";
import { counter } from "./counter.js";
import { dailyPlayHandler } from "./daily-play.js";
import { emblem } from "./emblem.js";
import { events } from "./events.js";
import { help } from "./help.js";
import { hero, heroButtonsHandler } from "./hero.js";
import { invite } from "./invite.js";
import { item } from "./item.js";
import { leaderboard } from "./leaderboard.js";
import { mlbbdle } from "./mlbbdle.js";
import { nickname, nicknameMenu } from "./nickname.js";
import { patch } from "./patch.js";
import { quiz, quizButtonsHandler } from "./quiz.js";
import { servertime } from "./servertime.js";
import { setup } from "./setup.js";
import { skins } from "./skins.js";
import { spell } from "./spell.js";
import { tierlist } from "./tierlist.js";

/** Every slash command, registered globally by `npm run deploy-commands`. */
export const COMMANDS: Command[] = [
  hero, build, counter, tierlist, compare, item, emblem, spell, patch, skins, events,
  nickname, mlbbdle, quiz, leaderboard, servertime, setup, help, invite, about,
];

export const COMPONENTS: ComponentHandler[] = [heroButtonsHandler, nicknameMenu, quizButtonsHandler, dailyPlayHandler];

/** Commands by their English name, which is what interactions carry. */
export function commandMap(): Map<string, Command> {
  return new Map(COMMANDS.map((c) => [c.data().name, c]));
}
