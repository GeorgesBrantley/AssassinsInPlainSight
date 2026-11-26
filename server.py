"""Account store, shared city, and static server for Assassins in Plain Sight (Python 3.9+)."""
import argparse
from combat import Combat, APIError, ASSASSIN_COSTS, MAP_NAMES, OUTFIT_COUNT, POWERS
from contextlib import contextmanager
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
GAME_TITLE = 'Assassins in Plain Sight'
SESSION_AGE = 7 * 24 * 3600
ABILITY_COSTS = {key: power['cost'] for key, power in POWERS.items()}
MATCH_RULES = {'time-120': 120, 'time-300': 300, 'time-600': 600,
               'score-500': 500, 'score-1000': 1000, 'score-1500': 1500}
RESULTS_SECONDS = 10


def migrate_unlocks(db):
    db.execute('BEGIN IMMEDIATE')
    columns = {row[1] for row in db.execute('PRAGMA table_info(accounts)')}
    if 'gold' not in columns:
        db.execute('ALTER TABLE accounts ADD COLUMN gold INTEGER NOT NULL DEFAULT 20')
    db.execute("""CREATE TABLE IF NOT EXISTS unlocks (
        user_id INTEGER NOT NULL, kind TEXT NOT NULL, item TEXT NOT NULL,
        PRIMARY KEY(user_id, kind, item))""")
    if db.execute('PRAGMA user_version').fetchone()[0] == 0:
        # Relock purchases from the previous pricing schedule once per database.
        db.execute('DELETE FROM unlocks')
        db.execute('PRAGMA user_version = 1')


class CityServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, database):
        self.database = str(database)
        Path(database).parent.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    salt TEXT NOT NULL, password_hash TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires REAL NOT NULL);
            """)
            migrate_unlocks(db)
        self.lock = threading.RLock()
        self.players = {}
        self.attempts = {}
        self.phase = 'lobby'
        self.deadline = 0
        self.results = []
        self.entrants = []
        self.map_id = 'betrahold'
        self.match_rule = 'time-120'
        self.game_mode = 'test'
        self.world_revision = 0
        self.combat = Combat(self, self.map_id)
        super().__init__(address, Handler)

    @contextmanager
    def db(self):
        connection = sqlite3.connect(self.database, timeout=10)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def progression(self, user_id):
        with self.db() as db:
            gold = db.execute('SELECT gold FROM accounts WHERE id = ?', (user_id,)).fetchone()[0]
            owned = set(db.execute('SELECT kind, item FROM unlocks WHERE user_id = ?', (user_id,)))
        return dict(gold=gold,
                    assassins=[i for i, cost in enumerate(ASSASSIN_COSTS)
                               if cost == 0 or ('assassin', str(i)) in owned],
                    abilities=[key for key, cost in ABILITY_COSTS.items()
                               if cost == 0 or ('ability', key) in owned],
                    costs=dict(assassin=list(ASSASSIN_COSTS), ability=ABILITY_COSTS))

    def unlock(self, user_id, kind, item):
        cost = 0
        if kind == 'assassin' and type(item) is int and 0 <= item < len(ASSASSIN_COSTS):
            cost = ASSASSIN_COSTS[item]
        elif kind == 'ability' and isinstance(item, str):
            cost = ABILITY_COSTS.get(item, 0)
        if cost == 0:
            raise APIError(400, 'Choose a locked assassin or ability.')
        item = str(item)
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM unlocks WHERE user_id=? AND kind=? AND item=?',
                          (user_id, kind, item)).fetchone():
                raise APIError(409, 'You already own this item.')
            if not db.execute('UPDATE accounts SET gold=gold-? WHERE id=? AND gold>=?',
                              (cost, user_id, cost)).rowcount:
                unit = 'coin' if cost == 1 else 'coins'
                raise APIError(409, f'You need {cost} gold {unit} to unlock this item.')
            db.execute('INSERT INTO unlocks VALUES (?, ?, ?)', (user_id, kind, item))
        return self.progression(user_id)

    def snapshot(self):
        now = time.monotonic()
        with self.lock:
            for key, player in list(self.players.items()):
                if now - player['seen'] > 15:
                    del self.players[key]
            self.advance_lobby(now)
            if self.phase == 'playing':
                self.combat.advance()
                self.advance_lobby()
            return [self.combat.public(p) for p in self.players.values()]


    def advance_lobby(self, now=None):
        now = time.monotonic() if now is None else now
        timed_out = self.match_rule.startswith('time-') and now >= self.deadline
        target_reached = self.match_rule.startswith('score-') and any(
            p['score'] >= MATCH_RULES[self.match_rule] for p in self.entrants)
        if self.phase == 'playing' and (timed_out or target_reached):
            ended = self.deadline if timed_out else now
            for player in self.players.values():
                self.combat.update_stealth(player, ended)
            results, payouts = [], []
            standings = sorted(self.entrants, key=lambda p: (-p['score'], p['username'].lower()))
            for position, player in enumerate(standings, start=1):
                if not results or player['score'] != results[-1]['score']:
                    rank = position
                earned = max(0, 4-rank) + player['assassinations']
                results.append(dict(id=player['id'], username=player['username'], outfit=player['outfit'],
                                    rank=rank, assassinations=player['assassinations'],
                                    score=player['score'], coins=earned))
                if earned:
                    payouts.append((earned, player['account_id']))
            if payouts:
                with self.db() as db:
                    db.executemany('UPDATE accounts SET gold=gold+? WHERE id=?', payouts)
            self.results = results
            self.phase = 'results'
            self.deadline = ended + RESULTS_SECONDS
            for p in self.players.values():
                p['stride'] = 0
        if self.phase == 'results' and now >= self.deadline:
            self.phase = 'lobby'
            for p in self.players.values():
                p['ready'] = False
        if not self.players:
            self.phase, self.results, self.entrants = 'lobby', [], []

    def lobby(self, viewer=None):
        self.advance_lobby()
        members = list(self.players.values())
        return dict(phase=self.phase, matchRule=self.match_rule, gameMode=self.game_mode,
                    duration=MATCH_RULES[self.match_rule] if self.match_rule.startswith('time-') else None,
                    map=self.map_id, maps=MAP_NAMES, worldRevision=self.world_revision,
                    remaining=max(0, self.deadline-time.monotonic()) if self.phase == 'results' or (self.phase == 'playing' and self.match_rule.startswith('time-')) else 0,
                    leader=members[0]['id'] if members else None,
                    players=[dict(id=p['id'], username=p['username'], outfit=p['outfit'],
                                  ready=p['ready'], **({'powers': p['powers']} if p is viewer else {})) for p in members],
                    powers=POWERS, results=self.results)

    def check_character(self, outfit, player=None):
        if type(outfit) is not int or not 0 <= outfit < OUTFIT_COUNT:
            raise APIError(400, 'Choose a character first.')
        if any(p is not player and p['outfit'] == outfit for p in self.players.values()):
            raise APIError(409, 'That character is already taken.')

    def choose_map(self, player, map_id):
        if self.phase != 'lobby':
            raise APIError(409, 'The map is locked until the next lobby.')
        if player is not next(iter(self.players.values()), None):
            raise APIError(403, 'Only the lobby leader can choose the map.')
        if not isinstance(map_id, str) or map_id not in MAP_NAMES:
            raise APIError(400, 'Choose an available map.')
        if map_id != self.map_id:
            self.reset_world(map_id)
            for member in self.players.values():
                member['ready'] = False

    def choose_match_rule(self, player, rule):
        if self.phase != 'lobby':
            raise APIError(409, 'The match rule is locked until the next lobby.')
        if player is not next(iter(self.players.values()), None):
            raise APIError(403, 'Only the lobby leader can choose the match rule.')
        if not isinstance(rule, str) or rule not in MATCH_RULES:
            raise APIError(400, 'Choose an available match rule.')
        if rule != self.match_rule:
            self.match_rule = rule
            for member in self.players.values():
                member['ready'] = False

    def choose_game_mode(self, player, mode):
        if self.phase != 'lobby':
            raise APIError(409, 'The game mode is locked until the next lobby.')
        if player is not next(iter(self.players.values()), None):
            raise APIError(403, 'Only the lobby leader can choose the game mode.')
        if not isinstance(mode, str) or mode not in ('test', 'competitive'):
            raise APIError(400, 'Choose an available game mode.')
        if mode != self.game_mode:
            self.game_mode = mode
            self.reset_world(self.map_id)
            for member in self.players.values():
                member['ready'] = False

    def place_player(self, player, slot):
        spawns = self.combat.player_spawns
        spawn = spawns[slot]
        respawn = spawn if self.map_id == 'betrahold' else spawns[0]
        revision = player.get('revision', -1) + 1
        self.combat.initialize(player)
        for key in ('animation', 'invisibility_end_effect'):
            player.pop(key, None)
        player.update(**spawn, spawn=(respawn['x'], respawn['z']),
                      stride=0, phase=0, revision=revision, updated=time.monotonic())

    def reset_world(self, map_id):
        self.combat = Combat(self, map_id)
        self.map_id = map_id
        self.world_revision += 1
        for slot, player in enumerate(self.players.values()):
            self.place_player(player, slot)

    def start_match(self, player):
        if self.phase != 'lobby':
            raise APIError(409, 'Wait for the next lobby.')
        if player is not next(iter(self.players.values()), None):
            raise APIError(403, 'Only the lobby leader can start the game.')
        if not all(p['ready'] for p in self.players.values()):
            raise APIError(409, 'Everyone must be ready before starting.')
        if self.game_mode == 'competitive' and len(self.players) < 2:
            raise APIError(409, 'Competitive requires at least two players.')
        self.reset_world(self.map_id)
        now = time.monotonic()
        if self.game_mode == 'competitive':
            for member in self.players.values():
                self.combat.assign(member, now)
        self.entrants = list(self.players.values())
        self.results = []
        self.phase, self.deadline = 'playing', now + MATCH_RULES[self.match_rule] if self.match_rule.startswith('time-') else 0


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def json_response(self, data, status=200, cookie=None):
        encoded = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(encoded)

    def session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            raw = cookie['bellward_session'].value
        except (KeyError, ValueError):
            raise APIError(401, 'Please log in to join the city.')
        token = hashlib.sha256(raw.encode()).hexdigest()
        with self.server.db() as db:
            row = db.execute('SELECT accounts.id, username FROM sessions JOIN accounts ON accounts.id = sessions.user_id WHERE token = ? AND expires > ?', (token, time.time())).fetchone()
        if not row:
            raise APIError(401, 'Your session expired. Please log in again.')
        return token, row[0], row[1]

    def do_GET(self):
        path = urlsplit(self.path).path
        try:
            if path == '/api/session':
                _, _, username = self.session()
                return self.json_response({'username': username})
            if path == '/api/progression':
                _, user_id, _ = self.session()
                return self.json_response(self.server.progression(user_id))
            if path == '/api/server':
                with self.server.lock:
                    online = len(self.server.snapshot())
                    name = MAP_NAMES[self.server.map_id]
                    return self.json_response({'name': f'{GAME_TITLE} · {name}', 'online': online, 'lobby': self.server.lobby()})
            if path == '/api/events':
                return self.events()
            if path.startswith('/api/'):
                raise APIError(404, 'Unknown endpoint.')
            return super().do_GET()
        except APIError as error:
            self.close_connection = True
            self.json_response({'error': error.message}, error.status)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass

    def do_POST(self):
        try:
            # Same-origin requests only; the session cookie is never exposed to JS.
            origin = self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                raise APIError(403, 'Use the game on this server to continue.')
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                raise APIError(415, 'Expected JSON.')
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 2048:
                    raise ValueError()
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError()
            except (ValueError, UnicodeDecodeError):
                raise APIError(400, 'Invalid request.')
            path = urlsplit(self.path).path
            if path in ('/api/register', '/api/login'):
                return self.authenticate(path, data)
            token, user_id, username = self.session()
            if path == '/api/unlock':
                return self.json_response(self.server.unlock(user_id, data.get('kind'), data.get('item')))
            if path == '/api/logout':
                with self.server.lock:
                    self.server.players.pop(user_id, None)
                with self.server.db() as db:
                    db.execute('DELETE FROM sessions WHERE token = ?', (token,))
                return self.json_response({'ok': True}, cookie='bellward_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if path == '/api/join':
                outfit = data.get('outfit')
                with self.server.lock:
                    self.server.snapshot()
                    if self.server.phase != 'lobby':
                        raise APIError(409, 'A match is underway. Join when the lobby reopens.')
                    if user_id in self.server.players:
                        raise APIError(409, 'This account is already in the city. Leave the other tab or wait a few seconds after closing it.')
                    owned = self.server.progression(user_id)['assassins']
                    if outfit is None:
                        outfit = next((i for i in owned if not any(p['outfit'] == i for p in self.server.players.values())), None)
                        if outfit is None:
                            raise APIError(409, 'All your assassins are taken. Unlock another or wait for a space.')
                    self.server.check_character(outfit)
                    if outfit not in owned:
                        raise APIError(403, 'Unlock this assassin before selecting it.')
                    player = dict(id=secrets.token_hex(12), account_id=user_id, token=token, outfit=outfit,
                                  username=username, ready=False, powers=[None, None],
                                  seen=time.monotonic(), stream=None)
                    self.server.place_player(player, len(self.server.players))
                    self.server.players[user_id] = player
                    return self.json_response({'player': {k: player[k] for k in ('id', 'x', 'z', 'angle')}})
            if path in ('/api/move', '/api/leave', '/api/action', '/api/ready', '/api/character', '/api/powers', '/api/power', '/api/start', '/api/map', '/api/match-rule', '/api/game-mode'):
                with self.server.lock:
                    self.server.snapshot()
                    player = self.server.players.get(user_id)
                    if not player or player['token'] != token or data.get('id') != player['id']:
                        raise APIError(409, 'You have left the server. Join again to continue.')
                    if path == '/api/leave':
                        del self.server.players[user_id]
                        return self.json_response({'ok': True})
                    if path == '/api/start':
                        self.server.start_match(player)
                        return self.json_response({'lobby': self.server.lobby(player)})
                    if path == '/api/game-mode':
                        self.server.choose_game_mode(player, data.get('mode'))
                        return self.json_response({'lobby': self.server.lobby(player)})
                    if path == '/api/match-rule':
                        self.server.choose_match_rule(player, data.get('rule'))
                        return self.json_response({'lobby': self.server.lobby(player)})
                    if path == '/api/map':
                        self.server.choose_map(player, data.get('map'))
                        return self.json_response({'lobby': self.server.lobby(player)})
                    if path in ('/api/ready', '/api/character', '/api/powers'):
                        if self.server.phase != 'lobby':
                            raise APIError(409, 'Characters, powers, and readiness are locked until the next lobby.')
                        if path == '/api/ready':
                            if type(data.get('ready')) is not bool:
                                raise APIError(400, 'Choose ready or not ready.')
                            if data['ready'] and not all(player['powers']):
                                raise APIError(409, 'Choose two powers before readying up.')
                            player['ready'] = data['ready']
                        elif path == '/api/character':
                            outfit = data.get('outfit')
                            self.server.check_character(outfit, player)
                            if outfit not in self.server.progression(user_id)['assassins']:
                                raise APIError(403, 'Unlock this assassin before selecting it.')
                            if outfit != player['outfit']:
                                player.update(outfit=outfit, ready=False)
                        else:
                            powers = data.get('powers')
                            if not isinstance(powers, list) or len(powers) != 2 or any(
                                    p is not None and (not isinstance(p, str) or p not in POWERS) for p in powers
                            ) or (powers[0] is not None and powers[0] == powers[1]):
                                raise APIError(400, 'Choose different powers for the two slots.')
                            if any(p is not None and p not in self.server.progression(user_id)['abilities'] for p in powers):
                                raise APIError(403, 'Unlock this ability before equipping it.')
                            if powers != player['powers']:
                                player.update(powers=powers, ready=False)
                        return self.json_response({'lobby': self.server.lobby(player)})
                    if self.server.phase != 'playing':
                        raise APIError(409, 'The match is not running.')
                    if path == '/api/power':
                        result = self.server.combat.use_power(player, data.get('slot'), data.get('victim'))
                        self.server.advance_lobby()
                        return self.json_response(result)
                    if path == '/api/action':
                        result = self.server.combat.action(player, data)
                        self.server.advance_lobby()
                        return self.json_response(result)
                    if (player.get('haybale') or player.get('bench') or not self.server.combat.active(player, time.monotonic())
                            or time.monotonic() < player.get('busy_until',0)):
                        return self.json_response({'ok': True})
                    if 'revision' in data and data['revision'] != player['revision']:
                        return self.json_response({'ok': True})
                    fields = ('x', 'z', 'angle', 'stride', 'phase')
                    if any(type(data.get(k)) not in (int, float) or not math.isfinite(data[k]) for k in fields):
                        raise APIError(400, 'Invalid movement.')
                    if not 0 <= data['stride'] <= 1.5:
                        raise APIError(400, 'Invalid movement.')
                    now = time.monotonic()
                    allowed = self.server.combat.movement_budget(player, now)
                    inside_city = self.server.combat.inside(data['x'], data['z'], .32)
                    distance = math.hypot(data['x'] - player['x'], data['z'] - player['z'])
                    if not inside_city or distance > allowed:
                        correction = {key: player[key] for key in ('x', 'z', 'angle', 'revision')}
                        return self.json_response({'ok': False, 'correction': correction})
                    self.server.combat.update_stealth(player, now)
                    player.update({k: data[k] for k in fields})
                    sprinting = data.get('sprinting') is True and distance > 0
                    zone = data.get('zone', data.get('circle'))
                    invisible = self.server.combat.power_active(player, 'invisibility', now)
                    crowd = data.get('crowdGroup', zone if zone is not None else data.get('blendGroup'))
                    self.server.combat.reserve_player_slot(player, None if sprinting or invisible else crowd,
                                                          data.get('crowdSlot'))
                    reserved = player['crowd_group']
                    player.update(updated=now, seen=now, sprinting=sprinting,
                                  activity=None if reserved is None or reserved != zone else self.server.combat.social_activity(player, zone),
                                  blend_group=reserved if reserved == data.get('blendGroup') else None)
                return self.json_response({'ok': True})
            raise APIError(404, 'Unknown endpoint.')
        except APIError as error:
            self.close_connection = True
            self.json_response({'error': error.message}, error.status)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass

    def authenticate(self, path, data):
        now = time.monotonic()
        with self.server.lock:
            self.server.attempts = {k: v for k, v in self.server.attempts.items() if now - v[0] < 60}
            attempts = self.server.attempts.setdefault(self.client_address[0], [now, 0])
            attempts[1] += 1
            if attempts[1] > 20:
                raise APIError(429, 'Too many attempts. Try again in a minute.')
        username, password = data.get('username', ''), data.get('password', '')
        if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_]{3,20}', username):
            raise APIError(400, 'Use 3–20 letters, numbers, or underscores for your username.')
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            raise APIError(400, 'Use a password with 8–128 characters.')
        with self.server.db() as db:
            db.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            row = db.execute('SELECT id, username, salt, password_hash FROM accounts WHERE username = ?', (username,)).fetchone()
            if path == '/api/register':
                salt = secrets.token_hex(16)
                digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
                try:
                    cursor = db.execute('INSERT INTO accounts(username, salt, password_hash) VALUES (?, ?, ?)', (username, salt, digest))
                except sqlite3.IntegrityError:
                    raise APIError(409, 'That username is already taken.')
                user_id = cursor.lastrowid
            else:
                salt = row[2] if row else '00' * 16
                digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
                if not row or not hmac.compare_digest(digest, row[3]):
                    raise APIError(401, 'Incorrect username or password.')
                user_id, username = row[:2]
            raw = secrets.token_urlsafe(32)
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(raw.encode()).hexdigest(), user_id, time.time() + SESSION_AGE))
        secure = '; Secure' if os.environ.get('BELLWARD_SECURE_COOKIES') == '1' else ''
        self.json_response({'username': username}, cookie=f'bellward_session={raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_AGE}{secure}')

    def events(self):
        token, user_id, username = self.session()
        stream = secrets.token_hex(8)
        with self.server.lock:
            player = self.server.players.get(user_id)
            if not player or player['token'] != token:
                raise APIError(409, 'Join the server first.')
            player['stream'] = stream
        self.close_connection = True
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache, no-transform')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        self.connection.settimeout(10)
        while True:
            with self.server.lock:
                current = self.server.players.get(user_id)
                if current is not player or player['stream'] != stream:
                    break
                player['seen'] = time.monotonic()
            with self.server.lock:
                players = self.server.snapshot()
                payload = json.dumps({'players': players, 'lobby': self.server.lobby(player),
                    'walking_groups': [{k: g[k] for k in ('number', 'x', 'z', 'angle')}
                                       for g in self.server.combat.walking_groups.values()],
                    'npcs': [self.server.combat.public(a) for a in self.server.combat.npcs.values()],
                    'bot': None if self.server.combat.competitive else self.server.combat.public(self.server.combat.bot),
                    'effects': self.server.combat.visible_effects() if self.server.phase == 'playing' else [],
                    'kill_feed': self.server.combat.recent_kills() if self.server.phase == 'playing' else [],
                    'self': self.server.combat.state(player)})
            self.wfile.write(f'data: {payload}\n\n'.encode())
            self.wfile.flush()
            time.sleep(.1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--database', default=str(ROOT / 'data' / 'bellward.sqlite3'))
    args = parser.parse_args()
    server = CityServer((args.host, args.port), args.database)
    print(f'{GAME_TITLE} is running at http://localhost:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
