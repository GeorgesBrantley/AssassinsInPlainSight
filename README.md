# Assassins in Plain Sight

## How to run this locally

From the project directory, start the game server with Python 3.9 or newer (no extra packages needed):

```bash
python3 server.py
```

If you have npm installed, the equivalent shortcut is:

```bash
npm start
```

Then open [http://localhost:8000](http://localhost:8000) in a browser with hardware acceleration enabled. Press `Ctrl-C` in the terminal to stop the server.

Create an account with a username and password, then click **Join lobby** from the main menu. The main menu shows the current lobby; the city loads when the match starts. After joining, choose an available assassin and two abilities. Returning players can log in with the same credentials. Usernames are case insensitive and contain 3–20 letters, numbers, or underscores; passwords contain 8–128 characters.

The server runs one shared lobby. The first player to join becomes the leader; leadership passes to the next player if they leave or disconnect. The lobby shows each player’s selected assassin and name. Choose an unclaimed character and equip two different powers privately, then press **Ready up**. Changing your character or powers clears your ready status. Once everyone (including the leader) is ready, the leader can press **Start**. Solo games with the practice rival are supported.

The lobby starts with **Betrahold** selected. It has a central bell hall, two fountain plazas, and connected market streets. The lobby leader can choose **Testa**, the original city, under **Match map**. Everyone sees the selected map, and changing it clears readiness.

The lobby leader chooses a match rule: **2, 5, or 10 minutes**, or first to **500, 1,000, or 1,500 points**. Changing the rule clears readiness. Timed matches show a shared countdown; points matches end as soon as a player reaches the target. Character and power choices lock for the match, and new arrivals wait for the next lobby. When the match ends, movement and combat stop and the final standings show players ranked by points, highest first (ties share a rank). After **10 seconds**, everyone returns to the same lobby with their character and power selections retained and readiness cleared. Scores and the city combat state reset at the start of each match.

During a match, players can see each other move in their chosen outfits. There are no overhead name tags. Use separate browser profiles or a private window to test two accounts on one computer. Each account can join once at a time. Taking a break stops your movement while the shared city continues; leaving the match returns to the lobby join screen. Disconnected players disappear after about 15 seconds.

For other computers on the same network, open `http://<server-computer-LAN-IP>:8000` and allow the server through the computer's firewall. All players must connect to the same running server. To change the listening address or port, use `python3 server.py --host 0.0.0.0 --port 8000`.

Accounts and sessions persist in `data/bellward.sqlite3`, which is excluded from Git and static assets. Passwords use salted PBKDF2-SHA256 hashes; login sessions use HttpOnly, SameSite cookies. Back up this database to retain accounts. Live player positions are held in memory and reset when the server restarts.

## Progression and unlocks

New accounts start with **1 gold coin**. Open **Unlocks** from the main menu or lobby to purchase assassins and abilities at the listed prices. See the [unlock price list](UNLOCKS.md) for details. The pricing update relocks previous purchases once and preserves each account’s current gold balance. New purchases and gold persist across logins and server restarts.

The first six assassins, Smoke Cloud, and Disguise are available immediately. The other twelve assassins and seven abilities require an unlock. Every ability has its own icon in the lobby, collection, and in-game loadout.

Joining reserves an available owned assassin; change it in the lobby before readying up. Each assassin can be claimed by only one player. Locked assassins and abilities cannot be selected, and the server validates ownership even for direct API requests. Purchases are atomic, so duplicate requests cannot charge twice or spend below zero.

At the end of each match, players earn **3 coins for first place**, **2 for second**, and **1 for third**, plus **1 coin per contract kill** at any rank. Tied players earn the same placement reward. The final standings show each player’s total coins earned.

## Controls

- `W` `A` `S` `D`: move
- Click the game view to capture the mouse. Move the mouse to look around from over your character's shoulder. The reticle stays in the middle of the screen.
- Hold the left mouse button for one second with the reticle on a target within Gun range (30 city units). Releasing early or aiming away cancels the hold. The blue diamond follows the locked target until they move out of range or you click empty space. Hold on another target to switch.
- `Shift`: run
- `E`: eliminate the focused character within 2.2 city units and clear line of sight
- `Q`: stun the focused character within the same range
- `F`: sit on an available bench seat, hide in a nearby hay bale, join a conversation, inspect goods, or walk with a group. Press `F` again to stand or leave a hay bale; move or press `F` to leave a group.
- `Esc`: pause and release the mouse. Click **Resume** to return.

Use **1** and **2** to activate your equipped powers. Attacks and targeted powers use your blue lock when you have one. Otherwise, they use the orange focus under the reticle. The HUD counts down the active effect, then starts the cooldown.

| Power | Effect | Cooldown |
| --- | --- | --- |
| Smoke Cloud | Creates a wide, opaque cloud of smoke for 4 seconds. | 15s |
| Disguise | Copies the focused character’s appearance for 15 seconds from up to 12 units away. | 15s |
| Firecrackers | Sends citizens within 4 units sprinting for 4 seconds. | 25s |
| Invisibility Potion | Vanish for 6 seconds with a burst on activation and reappearance. Instantly fills stealth to 150 (Incognito) and holds it there until invisibility ends. Attacks, stuns, blending, and other abilities are blocked while invisible; movement is allowed. | 20s |
| Cult | Gives citizens within 8 units your current appearance for the rest of the match. | 25s |
| Sprint Boost | Doubles walking and running speed for 10 seconds. | 15s |
| Decoy | Sends one civilian within 12 units sprinting in a random direction for 5 seconds. | 20s |
| Mute | Targets a character within 12 units and disables their powers and contract compass for 6 seconds if they’re a player. | 15s |
| Gun | Fires a visible shot at the focused character from up to 30 units away. Stealth drops before the kill is scored. | 30s |

On touch devices, drag to look around. Aim the centered dot and tap a power button to use a targeted power. The Kill and Stun buttons work on the nearest eligible character.

Conversation zones and market zones at every stall glow faintly blue on the ground. Walking groups carry a blue zone and have five places shared by citizens and players. Press F nearby to join an open place; your character steers around members and matches the group's walking pace through turns and stops. Move or press F again to leave. Joining a stationary zone walks you to an open spot and gives you the same gestures other players see on citizens. At stalls, characters face the goods, lean in to inspect them, and gesture as they bargain. Each match starts with 150 citizens. Each independently switches to a different natural state after 15–90 seconds. Group walkers join a nearby group with a vacancy or start one, then follow the city paths with random turns at junctions. Activity seekers reserve an open market, conversation, or bench seat and stay until their state changes. Loners choose short and long walks around obstacles. Three citizen profiles favor one state, choosing it with triple weight and tending to stay longer. A fourth profile weights the three states equally. Player abilities can temporarily interrupt these routines.

Five straw hay bales sit around the city, including three near the starting market. Press **F** within reach to hide or exit. Entry, exit, and shove animations throw up a puff of straw visible to everyone. Each bale holds one player; entering an occupied bale shoves its occupant onto clear ground. While hidden, movement is held and stealth regenerates exactly like crowd blending: **10 per second, up to 150**, with normal Hidden charge awards. The practice rival cannot see hidden occupants.

Aim at a bale and press **E** to search and eliminate its occupant, or **Q** to search and stun. Empty bales give no points. Hidden characters cannot be selected directly; the bale itself is the target. From inside, aim at a nearby character and use **E/Q** to emerge with an ambush animation. Normal reach, cooldown, and scoring rules apply. Powers require leaving the bale first. On touch devices, use the crowd button to enter/leave and the Kill/Stun buttons to attack.

Benches have **2 or 4 individual seats**. Press **F** near a free seat to sit, and **F** again to stand. Sitting holds your position and generates stealth like crowd blending: **10 per second up to 150**, with the same Hidden charge rewards. Citizens walk to available seats, sit for a while, then stand and return to the crowd. Seats are shared between players and citizens; a full bench must have a seat freed before someone else can sit.

Seated characters remain visible and targetable. Use **E/Q** to eliminate or stun someone on a bench, or to stand and attack a nearby character from your seat. Both sides use seated combat animations, and combat releases the occupied seat. Normal reach, cooldowns, and scoring apply. **All items and abilities are unavailable while sitting on a bench or hiding in hay**; stand or exit first. Touch controls use the crowd button to sit/stand and the Kill/Stun buttons to attack.

## Contracts and practice rival

Your contract target’s portrait appears at the top left. Your score, match timer, and player-only minimap sit at the bottom left, while the stealth ring sits at the top right. The circular compass shows a general bearing, widens as you get closer, and flashes blue when the target is in an unobstructed line of sight. At very close range it fills the circle.

The gold stealth ring starts full. Its center icon shows your current stealth tier, and up to three icons below the ring show how many opponents have you as their target. Sprinting drains stealth by 25 per second. Walking or standing still restores 5 per second, up to 100. Blending with a group restores 10 per second, up to 150, with the extra stealth shown in a thin outer ring. Outside a blend, overflow fades at 15 per second in addition to any sprint drain. Firecrackers, Gun, and Smoke Cloud each subtract 100 stealth.

The Hidden meter below the stealth ring gains 0 charge per second in Savage, 1 in Bloody, 2 in Stealth, and 3 in Incognito. Two pursuers multiply Hidden generation by 1.5, and three or more multiply it by 2. Each 200 charge awards **50 match points** and starts a new cycle. Hidden charge starts at zero each match.

The bottom-right kill feed shows the attacker’s username, kill-tier icon (or gun icon for ranged kills), and victim. Citizens and the practice rival use descriptive names. The latest five eliminations stay visible for ten seconds and clear for each match.

Contract kills assign a new target and award points based on your stealth at the moment of the kill.

| Stealth | Award | Points |
| --- | --- | --- |
| 50 or below | Savage Kill | 50 |
| Above 50 and below 100 | Bloody Kill | 100 |
| 100 through 125 | Stealth Kill | 150 |
| Above 125 | Incognito Kill | 200 |

Off-contract kills cost **50 points** at every stealth tier and replace your current contract as soon as a different target is available. Stunning costs **10 points**, except stunning someone who has you as their target costs **0**. Actions have a one-second cooldown. Stuns play a strike and stagger animation, with sparks circling the stunned character for four seconds. Eliminations play a shared attacker strike and victim fall animation, and movement pauses briefly during the strike. Eliminated characters remain on the ground for six seconds before respawning. Scores reset at the start of each match.

If another player stuns you, your current contract clears and the HUD counts down to a different target. The server picks a random delay of **3–10 seconds** from the moment the stun lands.

A server-controlled **Scribe practice rival** joins automatically and is your first target. It slowly approaches the nearest active player and warns for three seconds before eliminating them. Aim at the rival during the warning and press Q for a free defensive stun, or E for an elimination. The rival respawns and continues practicing with you. Its shared state, all citizens, contracts, score changes, stuns, and eliminations are handled by the Python server. Pausing leaves your character in the live city.

The lobby leader can choose **Test** (the default, with the practice rival and civilian contracts) or **Competitive** (at least two human players, with player-only contracts). Competitive assigns a new target on stun and waits a random 3–10 seconds after a contract elimination. Higher-ranked players have greater odds of being hunted; multiple hunters can share a target and some players may have none. Tied scores have equal odds. In a two-player match, the same opponent is reused once alive. Changing modes clears everyone’s ready status.

Restart the Python server after updating server code and refresh the browser to load the new controls.

## Project layout

- `dist/index.html`: game entry point
- `dist/style.css`: interface styling
- `dist/engine.js`: WebGL renderer and geometry helpers
- `dist/city.js`: city data and scene generation
- `dist/game.js`: game logic and input handling
- `dist/multiplayer.js`: account interface, server connection, and remote player interpolation
- `server.py`: threaded HTTP server, SQLite accounts, sessions, movement/combat API, and live event stream
- `combat.py`: shared crowd movement, practice rival, contracts, and combat validation
- `world.json` and `world-betrahold.json` contain the exported collision geometry, starting crowds, and spawns for Testa and Betrahold. Regenerate both with `node scripts/export-world.mjs` after changing a map layout.
- `tests/test_server.py`: account and multiplayer integration checks
- `.openai/hosting.json`: static hosting configuration pointing at `dist`

## Future public hosting

Accounts and multiplayer require the Python process and persistent storage. Serving only `dist` with `python3 -m http.server` or the existing static Sites configuration will not enable these features. The tracked `.openai/hosting.json` describes the earlier static deployment; this change has not deployed a public multiplayer backend.

For public hosting, run `server.py` behind an HTTPS reverse proxy, preserve same-origin `/api/*` routes, disable proxy buffering for `/api/events`, and set `BELLWARD_SECURE_COOKIES=1`. Use one server process for the shared city and keep its database on a persistent volume. This is a small-server implementation with client collision checks and server movement bounds/speed checks, not a distributed authoritative simulation.

Run integration checks with `python3 -m unittest discover -s tests` (or `npm test`).
Run walking-group movement and blue-zone simulations with `node tests/walking-groups.cjs`.
Run bench placement and seated animation checks with `node tests/benches.cjs`.
