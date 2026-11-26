from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import math
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from server import CityServer


class MultiplayerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.database = Path(cls.temp.name) / 'accounts.sqlite3'
        cls.server = CityServer(('127.0.0.1', 0), cls.database)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def setUp(self):
        with self.server.lock:
            self.server.players.clear()
            self.server.attempts.clear()
            self.server.advance_lobby()
            self.server.match_rule = 'time-120'
            if self.server.map_id != 'testa':
                self.server.reset_world('testa')

    def start(self, *members):
        for cookie, player in members:
            self.assertEqual(self.request('/api/powers', dict(id=player['id'], powers=['smoke', 'disguise']), cookie=cookie)[0], 200)
            self.assertEqual(self.request('/api/ready', dict(id=player['id'], ready=True), cookie=cookie)[0], 200)
        self.assertEqual(self.request('/api/start', {'id': members[0][1]['id']}, cookie=members[0][0])[0], 200)

    def request(self, path, data=None, cookie=None, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=4)
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        if origin:
            headers['Origin'] = origin
        connection.request('GET' if data is None else 'POST', path,
                           None if data is None else json.dumps(data), headers)
        response = connection.getresponse()
        status, result, session = response.status, json.loads(response.read()), response.getheader('Set-Cookie')
        connection.close()
        return status, result, session.split(';')[0] if session else None

    def account(self, username):
        status, _, cookie = self.request('/api/register', {'username': username, 'password': 'test-password-123'})
        self.assertEqual(status, 200)
        return cookie

    def set_gold(self, username, gold):
        with self.server.db() as db:
            db.execute('UPDATE accounts SET gold=? WHERE username=?', (gold, username))

    def test_progression_is_persistent_account_scoped_and_enforced(self):
        cookie = self.account('Unlocker')
        other = self.account('StillLocked')
        self.assertEqual(self.request('/api/progression')[0], 401)
        initial = self.request('/api/progression', cookie=cookie)[1]
        self.assertEqual(initial['gold'], 1)
        self.assertEqual(initial['assassins'], list(range(6)))
        self.assertEqual(initial['abilities'], ['smoke', 'disguise'])
        self.assertEqual(initial['costs']['assassin'], [0, 0, 0, 0, 0, 0, 1, 3, 3, 5, 5, 5, 5, 5, 10, 10, 10, 10])
        self.assertEqual(initial['costs']['ability'], dict(smoke=0, disguise=0, firecrackers=2,
                         invisibility=3, cult=3, sprint=1, decoy=3, mute=2, gun=1))
        self.assertEqual(self.request('/api/join', {'outfit': 8}, cookie=cookie)[0], 403)
        player = self.request('/api/join', {}, cookie=cookie)[1]['player']
        self.assertEqual(self.request('/api/character', {'id': player['id'], 'outfit': 8}, cookie=cookie)[0], 403)
        self.assertEqual(self.request('/api/powers', {'id': player['id'], 'powers': ['smoke', 'gun']}, cookie=cookie)[0], 403)
        self.assertEqual(self.request('/api/unlock', {'kind': 'assassin', 'item': 8}, cookie=cookie)[0], 409)
        self.set_gold('Unlocker', 20)
        unlocked = self.request('/api/unlock', {'kind': 'assassin', 'item': 8}, cookie=cookie)[1]
        self.assertEqual(unlocked['gold'], 17)
        self.assertIn(8, unlocked['assassins'])
        self.assertEqual(self.request('/api/unlock', {'kind': 'assassin', 'item': 8}, cookie=cookie)[0], 409)
        self.assertEqual(self.request('/api/character', {'id': player['id'], 'outfit': 8}, cookie=cookie)[0], 200)
        unlocked = self.request('/api/unlock', {'kind': 'ability', 'item': 'gun'}, cookie=cookie)[1]
        self.assertEqual(unlocked['gold'], 16)
        self.assertEqual(self.request('/api/powers', {'id': player['id'], 'powers': ['smoke', 'gun']}, cookie=cookie)[0], 200)
        self.assertEqual(self.request('/api/progression', cookie=other)[1], initial)
        restarted = CityServer(('127.0.0.1', 0), self.database)
        try:
            user_id = next(key for key, value in self.server.players.items() if value['id'] == player['id'])
            self.assertEqual(restarted.progression(user_id), unlocked)
        finally:
            restarted.server_close()
        for item in ({'kind': 'assassin', 'item': True}, {'kind': 'ability', 'item': []},
                     {'kind': 'assassin', 'item': 0}, {'kind': 'unknown', 'item': 8}):
            self.assertEqual(self.request('/api/unlock', item, cookie=cookie)[0], 400)
        with ThreadPoolExecutor(max_workers=2) as pool:
            purchases = list(pool.map(lambda _: self.request('/api/unlock',
                {'kind': 'ability', 'item': 'mute'}, cookie=cookie)[0], range(2)))
        self.assertEqual(sorted(purchases), [200, 409])
        self.assertEqual(self.request('/api/progression', cookie=cookie)[1]['gold'], 14)
        self.set_gold('Unlocker', 2)
        status, result, _ = self.request('/api/unlock', {'kind': 'ability', 'item': 'decoy'}, cookie=cookie)
        self.assertEqual((status, result['error']), (409, 'You need 3 gold coins to unlock this item.'))
        progression = self.request('/api/progression', cookie=cookie)[1]
        self.assertEqual(progression['gold'], 2)
        self.assertNotIn('decoy', progression['abilities'])

    def test_existing_database_gets_starting_gold_once(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'legacy.sqlite3'
            with sqlite3.connect(database) as db:
                db.execute('CREATE TABLE accounts (id INTEGER PRIMARY KEY, username TEXT, salt TEXT, password_hash TEXT)')
                db.execute("INSERT INTO accounts VALUES (1, 'Legacy', 'salt', 'hash')")
            upgraded = CityServer(('127.0.0.1', 0), database)
            try:
                self.assertEqual(upgraded.progression(1)['gold'], 1)
                self.assertEqual(upgraded.unlock(1, 'assassin', 6)['gold'], 0)
            finally:
                upgraded.server_close()
            reopened = CityServer(('127.0.0.1', 0), database)
            try:
                self.assertEqual(reopened.progression(1)['gold'], 0)
                self.assertIn(6, reopened.progression(1)['assassins'])
            finally:
                reopened.server_close()

    def test_pricing_migration_relocks_all_accounts_once(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / 'legacy.sqlite3'
            with sqlite3.connect(database) as db:
                db.execute('CREATE TABLE accounts (id INTEGER PRIMARY KEY, username TEXT, gold INTEGER)')
                db.executemany('INSERT INTO accounts VALUES (?, ?, ?)', [(1, 'First', 17), (2, 'Second', 19)])
                db.execute('CREATE TABLE unlocks (user_id INTEGER, kind TEXT, item TEXT)')
                db.executemany('INSERT INTO unlocks VALUES (?, ?, ?)',
                               [(1, 'assassin', '8'), (1, 'ability', 'gun'), (2, 'ability', 'sprint')])
            upgraded = CityServer(('127.0.0.1', 0), database)
            try:
                for user_id, balance in [(1, 17), (2, 19)]:
                    progression = upgraded.progression(user_id)
                    self.assertEqual(progression['gold'], balance)
                    self.assertEqual(progression['assassins'], list(range(6)))
                    self.assertEqual(progression['abilities'], ['smoke', 'disguise'])
                upgraded.unlock(2, 'ability', 'firecrackers')
            finally:
                upgraded.server_close()
            reopened = CityServer(('127.0.0.1', 0), database)
            try:
                self.assertIn('firecrackers', reopened.progression(2)['abilities'])
                self.assertEqual(reopened.progression(2)['gold'], 17)
            finally:
                reopened.server_close()

    def test_accounts_persist_and_passwords_are_hashed(self):
        cookie = self.account('Wayfarer')
        self.assertEqual(self.request('/api/session', cookie=cookie)[:2], (200, {'username': 'Wayfarer'}))
        self.assertEqual(self.request('/api/register', {'username': 'wayfarer', 'password': 'test-password-123'})[0], 409)
        self.assertEqual(self.request('/api/login', {'username': 'Wayfarer', 'password': 'wrong-password'})[0], 401)
        status, account, logged_in = self.request('/api/login', {'username': 'WAYFARER', 'password': 'test-password-123'})
        self.assertEqual((status, account['username']), (200, 'Wayfarer'))
        self.assertNotEqual(logged_in, cookie)
        with sqlite3.connect(self.database) as db:
            stored = db.execute('SELECT salt, password_hash FROM accounts WHERE username = ?', ('Wayfarer',)).fetchone()
            self.assertNotIn('test-password-123', stored)
        restarted = CityServer(('127.0.0.1', 0), self.database)
        with restarted.db() as db:
            self.assertEqual(db.execute('SELECT username FROM accounts WHERE username = ?', ('Wayfarer',)).fetchone()[0], 'Wayfarer')
        restarted.server_close()
        self.assertEqual(self.request('/api/logout', {}, cookie=logged_in)[0], 200)
        self.assertEqual(self.request('/api/session', cookie=logged_in)[0], 401)

    def test_female_characters_can_join_and_are_shared(self):
        cookie = self.account('Weaver')
        self.set_gold('Weaver', 18)
        for outfit in range(8, 12):
            self.assertEqual(self.request('/api/unlock', {'kind': 'assassin', 'item': outfit}, cookie=cookie)[0], 200)
            status, result, _ = self.request('/api/join', {'outfit': outfit}, cookie=cookie)
            self.assertEqual(status, 200)
            player_id = result['player']['id']
            player = next(p for p in self.server.snapshot() if p['id'] == player_id)
            self.assertEqual(player['outfit'], outfit)
            self.assertEqual(self.request('/api/leave', {'id': player_id}, cookie=cookie)[0], 200)
        self.assertEqual(self.request('/api/join', {'outfit': 18}, cookie=cookie)[0], 400)

    def test_new_assassins_require_purchase_and_are_shared(self):
        for username, outfits, remaining in [('BellwardGuard', (12, 13), 10), ('BellwardRoyal', (14, 15), 0),
                                             ('BellwardHeirs', (16, 17), 0)]:
            cookie = self.account(username)
            self.set_gold(username, 20)
            for outfit in outfits:
                self.assertEqual(self.request('/api/join', {'outfit': outfit}, cookie=cookie)[0], 403)
                status, progression, _ = self.request('/api/unlock', {'kind': 'assassin', 'item': outfit},
                                                      cookie=cookie)
                self.assertEqual(status, 200)
                self.assertIn(outfit, progression['assassins'])
                status, result, _ = self.request('/api/join', {'outfit': outfit}, cookie=cookie)
                self.assertEqual(status, 200)
                player_id = result['player']['id']
                self.assertEqual(next(p['outfit'] for p in self.server.snapshot() if p['id'] == player_id), outfit)
                self.assertEqual(self.request('/api/leave', {'id': player_id}, cookie=cookie)[0], 200)
            self.assertEqual(progression['gold'], remaining)

    def test_two_players_receive_movement_and_leave_events(self):
        first, second = self.account('Mercer'), self.account('Scribe')
        self.assertEqual(self.request('/api/join', {'outfit': 1})[0], 401)
        self.assertEqual(self.request('/api/join', {'outfit': 99}, cookie=first)[0], 400)
        one = self.request('/api/join', {'outfit': 1}, cookie=first)[1]['player']
        two = self.request('/api/join', {'outfit': 3}, cookie=second)[1]['player']
        self.assertNotEqual(one['id'], two['id'])
        self.assertNotEqual((one['x'], one['z']), (two['x'], two['z']))
        self.assertEqual(self.request('/api/join', {'outfit': 1}, cookie=first)[0], 409)
        connections = []
        try:
            streams = []
            for cookie in (first, second):
                connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=4)
                connection.request('GET', '/api/events', headers={'Cookie': cookie})
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                connections.append(connection)
                streams.append(response)

            def snapshot(stream):
                while True:
                    line = stream.readline()
                    if line.startswith(b'data: '):
                        return json.loads(line[6:])['players']

            for stream in streams:
                players = snapshot(stream)
                self.assertEqual({p['id'] for p in players}, {one['id'], two['id']})
                self.assertTrue(all('username' not in p for p in players))
            self.start((first, one), (second, two))
            time.sleep(.1)
            movement = dict(one, x=one['x'] + .3, stride=1, phase=.5)
            self.assertEqual(self.request('/api/move', movement, cookie=first)[0], 200)
            for stream in streams:
                for _ in range(20):
                    players = snapshot(stream)
                    remote = next(p for p in players if p['id'] == one['id'])
                    if remote['x'] == movement['x']:
                        break
                self.assertEqual(remote['x'], movement['x'])
                self.assertEqual(remote['stride'], 1)
                self.assertEqual(remote['outfit'], 1)
            correction = {'ok': False, 'correction': {
                'x': movement['x'], 'z': movement['z'], 'angle': movement['angle'],
                'revision': remote['revision'],
            }}
            self.assertEqual(self.request('/api/move', dict(movement, x=40), cookie=first)[:2], (200, correction))
            self.assertEqual(self.request('/api/move', dict(movement, x=50), cookie=first)[:2], (200, correction))
            self.assertEqual(self.request('/api/move', movement, cookie=first)[:2], (200, {'ok': True}))
            self.assertEqual(self.request('/api/move', dict(movement, x=float('nan')), cookie=first)[0], 400)
            self.assertEqual(self.request('/api/move', movement, cookie=second)[0], 409)
            self.assertEqual(self.request('/api/leave', {'id': one['id']}, cookie=first)[0], 200)
            for _ in range(20):
                players = snapshot(streams[1])
                if len(players) == 1:
                    break
            self.assertEqual([p['id'] for p in players], [two['id']])
            self.assertEqual(self.request('/api/leave', {'id': two['id']}, cookie=second)[0], 200)
        finally:
            for connection in connections:
                connection.close()

    def test_expired_connections_are_removed(self):
        cookie = self.account('Pilgrim')
        self.request('/api/join', {'outfit': 5}, cookie=cookie)
        with self.server.lock:
            player = next(p for p in self.server.players.values() if p['outfit'] == 5)
            player['seen'] -= 16
        self.assertEqual(self.request('/api/server')[1]['online'], 0)

    def test_movement_shares_each_activity_only_while_joined_at_its_zone(self):
        cookie = self.account('Listener')
        player = self.request('/api/join', {'outfit': 2}, cookie=cookie)[1]['player']
        self.start((cookie, player))
        freeze = patch.object(self.server.combat, 'advance_crowd')
        freeze.start()
        self.addCleanup(freeze.stop)
        for number, activity in ((0, 'conversation'), (4, 'market')):
            with self.subTest(activity=activity):
                with self.server.lock:
                    participant = next(iter(self.server.players.values()))
                    seats = self.server.combat.zones[number]['zone']['seats']
                    occupied = self.server.combat.occupied_slots(number)
                    seat = next(seat for i, seat in enumerate(seats) if i not in occupied)
                    participant.update(x=seat['x'], z=seat['z'])
                    movement = dict(id=participant['id'], **seat, stride=0, phase=0, zone=number)
                for update, expected in (({}, activity), ({'stride': 1}, None),
                                         ({'zone': 1}, None), ({'zone': None}, None)):
                    self.assertEqual(self.request('/api/move', dict(movement, **update), cookie=cookie)[0], 200)
                    self.assertEqual(self.server.snapshot()[0]['activity'], expected)

    def test_movement_updates_stealth_for_sprinting_and_blending(self):
        cookie = self.account('CrowdWalker')
        player = self.request('/api/join', {'outfit': 2}, cookie=cookie)[1]['player']
        self.start((cookie, player))
        world = self.server.combat
        participant = next(iter(self.server.players.values()))
        member = next(iter(world.npcs.values()))
        world.npcs = {member['id']: member}
        world.walking_groups[6] = dict(number=6, x=5, z=16, angle=0)
        member.update(x=5, z=16, stride=0, crowd_group=6, crowd_slot=0)
        freeze = patch.object(world, 'advance_crowd')
        freeze.start()
        self.addCleanup(freeze.stop)
        now = time.monotonic()
        participant.update(updated=now, stealth_at=now)
        movement = dict(player, stride=0, phase=0)
        with patch('server.time.monotonic', return_value=now) as clock:
            def move(expected, **updates):
                status, result, _ = self.request('/api/move', dict(movement, **updates), cookie=cookie)
                self.assertEqual((status, result), (200, {'ok': True}))
                self.assertAlmostEqual(world.state(participant)['stealth'], expected)

            move(100, x=4.25, sprinting=True)
            clock.return_value += .25
            move(93.75, x=4.25, sprinting=True)
            clock.return_value += .25
            move(95, x=4.25, blendGroup=6)
            clock.return_value += .25
            move(97.5, x=4.25, blendGroup=6)
            clock.return_value += .25
            move(100, x=4.25)
            clock.return_value += .25
            move(100, x=4.25)

            seat = world.zones[1]['zone']['seats'][1]
            participant.update(x=seat['x'], z=seat['z'])
            move(100, **seat, zone=1)
            clock.return_value += .25
            move(102.5, **seat, zone=1)
        self.assertNotIn('stealth', world.public(participant))

    def test_bench_api_blocks_movement_and_items_then_frees_seat(self):
        cookie = self.account('BenchSitter')
        player = self.request('/api/join', {}, cookie=cookie)[1]['player']
        self.start((cookie, player))
        with self.server.lock:
            live = next(p for p in self.server.players.values() if p['id'] == player['id'])
            seat = self.server.combat.benches['bench-0']['seats'][0]
            live.update(x=seat['x'], z=seat['z']-1)
        self.assertEqual(self.request('/api/action', dict(id=player['id'], action='bench', victim='bench-0'), cookie=cookie)[0], 200)
        with self.server.lock:
            live['busy_until'] = 0
            revision = live['revision']
            self.assertEqual(self.server.combat.public(live)['bench'], 'bench-0')
            position = live['x'], live['z']
        self.assertEqual(self.request('/api/move', dict(id=player['id'], x=position[0]+1, z=position[1],
            angle=0, stride=1, phase=0, revision=revision), cookie=cookie)[0], 200)
        self.assertEqual(self.request('/api/power', dict(id=player['id'], slot=0), cookie=cookie)[0], 409)
        with self.server.lock:
            self.assertEqual((live['x'], live['z']), position)
            self.assertEqual(live['power_timers'], {})
        self.assertEqual(self.request('/api/action', dict(id=player['id'], action='bench'), cookie=cookie)[0], 200)
        with self.server.lock:
            self.assertIsNone(live['bench'])
            self.assertFalse(self.server.combat.blocked(live['x'], live['z'], .32))

    def test_hay_api_holds_position_and_shares_occupancy(self):
        cookie = self.account('HayHider')
        player = self.request('/api/join', {}, cookie=cookie)[1]['player']
        self.start((cookie, player))
        with self.server.lock:
            live = next(p for p in self.server.players.values() if p['id'] == player['id'])
            live.update(x=1, z=17.8)
        self.assertEqual(self.request('/api/action', dict(id=player['id'], action='hay', victim='hay-0'), cookie=cookie)[0], 200)
        with self.server.lock:
            live['busy_until'] = 0
            revision = live['revision']
            self.assertEqual(self.server.combat.public(live)['haybale'], 'hay-0')
        self.assertEqual(self.request('/api/move', dict(id=player['id'], x=2, z=17,
            angle=0, stride=1, phase=0, revision=revision), cookie=cookie)[0], 200)
        with self.server.lock:
            self.assertEqual((live['x'], live['z']), (1, 16))
        self.assertEqual(self.request('/api/action', dict(id=player['id'], action='hay'), cookie=cookie)[0], 200)
        with self.server.lock:
            self.assertIsNone(live['haybale'])

    def test_combat_api_shares_score_and_blocks_repeated_hits(self):
        cookie = self.account('PracticeTester')
        player = self.request('/api/join', {'outfit': 0}, cookie=cookie)[1]['player']
        self.start((cookie, player))
        with self.server.lock:
            bot = self.server.combat.bot
            bot.update(x=player['x']+1, z=player['z'], dead_until=0, stunned_until=0,
                       target_id=player['id'], attack_at=0)
        action = dict(id=player['id'], action='stun', victim='practice-player')
        self.assertEqual(self.request('/api/action', action)[0], 401)
        status, result, _ = self.request('/api/action', action, cookie=cookie)
        self.assertEqual((status, result['delta'], result['score']), (200, 0, 0))
        self.assertEqual(self.request('/api/action', action, cookie=cookie)[0], 409)
        with self.server.lock:
            current = next(p for p in self.server.players.values() if p['id'] == player['id'])
            self.assertEqual(current['assassinations'], 0)
            current['cooldown'] = 0
            bot['stunned_until'] = 0
        status, result, _ = self.request('/api/action', dict(action, action='kill'), cookie=cookie)
        self.assertEqual((status, result['delta'], result['score']), (200, 150, 150))
        with self.server.lock:
            self.assertGreater(bot['dead_until'], time.monotonic())
            self.assertNotEqual(current['target_id'], bot['id'])
            self.assertEqual(current['assassinations'], 1)
            # Restore the shared fixture for subsequent multiplayer checks.
            bot.update(dead_until=0, stunned_until=0, x=6, z=16, attack_at=0)
        self.request('/api/leave', {'id': player['id']}, cookie=cookie)

    def test_match_rewards_credit_placement_and_assassinations_once(self):
        members = []
        for i in range(5):
            cookie = self.account(f'RewardPlayer{i}')
            player = self.request('/api/join', {}, cookie=cookie)[1]['player']
            members.append((cookie, player))
        self.start(*members)
        with self.server.lock:
            for player, score, kills in zip(self.server.entrants, (400, 300, 200, 200, 100), (2, 0, 0, 1, 1)):
                player.update(score=score, assassinations=kills)
        cookie, player = members[-1]
        self.assertEqual(self.request('/api/progression', cookie=cookie)[1]['gold'], 1)
        self.assertEqual(self.request('/api/leave', dict(id=player['id']), cookie=cookie)[0], 200)
        with self.server.lock:
            self.server.deadline = time.monotonic()-.01
        for _ in range(2):
            lobby = self.request('/api/server')[1]['lobby']
            self.assertEqual(lobby['phase'], 'results')
            self.assertEqual([(p['username'], p['assassinations'], p['score'], p['coins'], p['rank'])
                              for p in lobby['results']],
                             [('RewardPlayer0', 2, 400, 5, 1),
                              ('RewardPlayer1', 0, 300, 2, 2),
                              ('RewardPlayer2', 0, 200, 1, 3),
                              ('RewardPlayer3', 1, 200, 2, 3),
                              ('RewardPlayer4', 1, 100, 1, 5)])
            self.assertEqual([self.request('/api/progression', cookie=cookie)[1]['gold']
                              for cookie, _ in members], [6, 3, 2, 3, 2])

    def test_lobby_permissions_character_lock_and_match_cycle(self):
        first, second = self.account('LobbyLeader'), self.account('LobbyGuest')
        self.set_gold('LobbyLeader', 6)
        one = self.request('/api/join', {'outfit': 0}, cookie=first)[1]['player']
        self.assertEqual(self.request('/api/join', {'outfit': 0}, cookie=second)[0], 409)
        two = self.request('/api/join', {'outfit': 1}, cookie=second)[1]['player']
        def post(path, cookie=first, player=one, **data):
            return self.request('/api/'+path, dict(id=player['id'], **data), cookie=cookie)
        self.assertEqual(self.request('/api/server')[1]['lobby']['leader'], one['id'])
        self.assertEqual(post('start', second, two)[0], 403)
        self.assertEqual(post('start')[0], 409)
        self.assertEqual(post('move', x=4,z=16,angle=0,stride=1,phase=0)[0], 409)
        self.assertEqual(post('action', action='kill', victim='practice-player')[0], 409)
        self.assertEqual(post('ready', ready='yes')[0], 400)
        self.assertEqual(post('character', outfit=18)[0], 400)
        self.assertEqual(post('character', outfit=1)[0], 409)
        self.assertEqual(post('ready', ready=True)[0], 409)
        self.assertEqual(post('power', slot=0)[0], 409)
        for powers in (['smoke', 'smoke'], ['bad', None], [['smoke'], None], ['smoke']):
            self.assertEqual(post('powers', powers=powers)[0], 400)
        self.assertEqual(post('powers', powers=['smoke', None])[0], 200)
        self.assertEqual(post('ready', ready=True)[0], 409)
        self.assertEqual(post('powers', powers=['smoke', 'disguise'])[0], 200)
        self.assertEqual(post('ready', ready=True)[0], 200)
        self.assertEqual(self.request('/api/unlock', {'kind': 'ability', 'item': 'cult'}, cookie=first)[0], 200)
        lobby = post('powers', powers=['cult', 'disguise'])[1]['lobby']
        self.assertFalse(lobby['players'][0]['ready'])
        self.assertEqual(post('ready', ready=True)[0], 200)
        self.assertEqual(self.request('/api/unlock', {'kind': 'assassin', 'item': 8}, cookie=first)[0], 200)
        lobby = post('character', outfit=8)[1]['lobby']
        self.assertFalse(lobby['players'][0]['ready'])
        self.assertEqual(lobby['players'][0]['outfit'], 8)
        self.start((first, one), (second, two))
        lobby = self.request('/api/server')[1]['lobby']
        self.assertEqual(lobby['phase'], 'playing')
        self.assertGreater(lobby['remaining'], 119)
        self.assertLessEqual(lobby['remaining'], 120)
        self.assertEqual(post('character', outfit=2)[0], 409)
        self.assertEqual(post('powers', powers=['cult', 'disguise'])[0], 409)
        self.assertEqual(post('power', slot=True)[0], 400)
        self.assertEqual(post('power', slot=0)[0], 200)
        self.assertEqual(post('power', slot=0)[0], 409)
        self.assertEqual(post('ready', ready=False)[0], 409)
        self.assertEqual(post('start')[0], 409)
        third = self.account('LateArrival')
        self.assertEqual(self.request('/api/join', {'outfit': 2}, cookie=third)[0], 409)
        with self.server.lock:
            players = list(self.server.players.values())
            players[0]['score'], players[1]['score'] = -50, 200
            self.server.deadline = time.monotonic()-.01
            players[1].update(stealth=100, stealth_at=self.server.deadline-1, hidden_charge=198)
        lobby = self.request('/api/server')[1]['lobby']
        self.assertEqual(lobby['phase'], 'results')
        self.assertEqual([p['score'] for p in lobby['results']], [250, -50])
        self.assertEqual([p['username'] for p in lobby['results']], ['LobbyGuest', 'LobbyLeader'])
        self.assertEqual(post('action', action='kill', victim='practice-player')[0], 409)
        self.assertEqual(post('character', outfit=2)[0], 409)
        with self.server.lock:
            self.server.deadline = time.monotonic()-.01
        lobby = self.request('/api/server')[1]['lobby']
        self.assertEqual(lobby['phase'], 'lobby')
        self.assertFalse(any(p['ready'] for p in lobby['players']))
        self.assertEqual(lobby['players'][0]['outfit'], 8)
        self.assertTrue(all('powers' not in p for p in lobby['players']))
        private = post('ready', ready=False)[1]['lobby']['players']
        self.assertEqual(private[0]['powers'], ['smoke', 'disguise'])
        self.assertNotIn('powers', private[1])
        guest = post('ready', second, two, ready=False)[1]['lobby']['players']
        self.assertNotIn('powers', guest[0])
        self.assertEqual(guest[1]['powers'], ['smoke', 'disguise'])
        self.start((first, one), (second, two))
        self.assertTrue(all(p['hidden_charge'] == 0 for p in self.server.players.values()))
        self.assertEqual(post('power', slot=0)[0], 200)
        self.assertTrue(all(p['score']==0 and p['dead_until']==0 for p in self.server.players.values()))

    def test_match_rules_permissions_timing_and_score_finish(self):
        leader, guest = self.account('RuleLeader'), self.account('RuleGuest')
        one = self.request('/api/join', {}, cookie=leader)[1]['player']
        two = self.request('/api/join', {}, cookie=guest)[1]['player']
        def choose(cookie, player, rule):
            return self.request('/api/match-rule', {'id': player['id'], 'rule': rule}, cookie=cookie)
        self.assertEqual(choose(guest, two, 'time-300')[0], 403)
        self.assertEqual(choose(leader, one, 'time-30')[0], 400)
        for rule in ('time-120', 'time-300', 'time-600', 'score-500', 'score-1000', 'score-1500'):
            self.assertEqual(choose(leader, one, rule)[1]['lobby']['matchRule'], rule)
        self.assertEqual(choose(leader, one, 'time-300')[0], 200)
        self.start((leader, one), (guest, two))
        lobby = self.request('/api/server')[1]['lobby']
        self.assertGreater(lobby['remaining'], 299)
        self.assertEqual(choose(leader, one, 'score-500')[0], 409)
        with self.server.lock:
            self.server.deadline = time.monotonic() - 11
            self.server.advance_lobby()
        self.assertEqual(choose(leader, one, 'score-500')[0], 200)
        self.start((leader, one), (guest, two))
        with self.server.lock:
            player = next(iter(self.server.players.values()))
            player['score'] = 499
            self.server.advance_lobby()
            self.assertEqual(self.server.phase, 'playing')
            player['score'] = 500
            self.server.advance_lobby()
            self.assertEqual(self.server.phase, 'results')
            self.assertEqual(self.server.results[0]['score'], 500)
            self.assertEqual(self.server.results[0]['coins'], 3)
            self.assertGreater(self.server.deadline - time.monotonic(), 9)

    def test_map_selection_is_shared_and_locks_for_the_match(self):
        leader, guest = self.account('MapLeader'), self.account('MapGuest')
        one = self.request('/api/join', {'outfit': 0}, cookie=leader)[1]['player']
        two = self.request('/api/join', {'outfit': 1}, cookie=guest)[1]['player']

        def choose(map_id, cookie=leader, player=one):
            return self.request('/api/map', dict(id=player['id'], map=map_id), cookie=cookie)

        initial = self.request('/api/server')[1]['lobby']
        self.assertEqual(initial['maps'], {'testa': 'Testa', 'betrahold': 'Betrahold'})
        self.assertEqual(initial['map'], 'testa')
        self.assertEqual(choose('betrahold', guest, two)[0], 403)
        self.assertEqual(choose('unknown')[0], 400)
        self.request('/api/powers', dict(id=one['id'], powers=['smoke', 'disguise']), cookie=leader)
        self.assertEqual(self.request('/api/ready', dict(id=one['id'], ready=True), cookie=leader)[0], 200)
        status, result, _ = choose('betrahold')
        self.assertEqual(status, 200)
        self.assertEqual(result['lobby']['map'], 'betrahold')
        self.assertFalse(any(p['ready'] for p in result['lobby']['players']))
        self.assertGreater(result['lobby']['worldRevision'], initial['worldRevision'])
        self.assertEqual(self.request('/api/server')[1]['lobby']['map'], 'betrahold')

        self.start((leader, one), (guest, two))
        self.assertEqual(choose('testa')[0], 409)
        with self.server.lock:
            world = self.server.combat
            players = list(self.server.players.values())
            for player, spawn in zip(players, world.player_spawns):
                self.assertEqual((player['x'], player['z']), (spawn['x'], spawn['z']))
            self.assertGreater(math.dist(players[0]['spawn'], players[1]['spawn']), 20)
            player = players[1]
            player.update(x=47.5, z=-26.5, updated=time.monotonic())
            revision = player['revision']
        movement = dict(id=two['id'], x=47.5, z=-26.5, angle=0, stride=0, phase=0, revision=revision)
        self.assertTrue(self.request('/api/move', movement, cookie=guest)[1]['ok'])
        with self.server.lock:
            player.update(dead_until=time.monotonic()-.01)
            world.last -= .1
            world.advance()
            self.assertEqual((player['x'], player['z']), player['spawn'])
            self.server.deadline = time.monotonic()-11
        lobby = self.request('/api/server')[1]['lobby']
        self.assertEqual((lobby['phase'], lobby['map']), ('lobby', 'betrahold'))
        self.assertEqual(choose('testa')[1]['lobby']['map'], 'testa')

    def test_leader_transfers_after_leave_and_disconnect(self):
        first, second = self.account('FirstLeader'), self.account('NextLeader')
        one = self.request('/api/join', {'outfit': 0}, cookie=first)[1]['player']
        two = self.request('/api/join', {'outfit': 1}, cookie=second)[1]['player']
        self.request('/api/leave', {'id': one['id']}, cookie=first)
        self.assertEqual(self.request('/api/server')[1]['lobby']['leader'], two['id'])
        one = self.request('/api/join', {'outfit': 0}, cookie=first)[1]['player']
        with self.server.lock:
            next(p for p in self.server.players.values() if p['id']==two['id'])['seen'] -= 16
        self.assertEqual(self.request('/api/server')[1]['lobby']['leader'], one['id'])
        self.request('/api/leave', {'id': one['id']}, cookie=first)
        self.assertIsNone(self.request('/api/server')[1]['lobby']['leader'])

    def test_cross_origin_and_invalid_credentials_are_rejected(self):
        self.assertEqual(self.request('/api/login', {}, origin='https://another.example')[0], 403)
        self.assertEqual(self.request('/api/register', {'username': '<script>', 'password': 'test-password-123'})[0], 400)
        self.assertEqual(self.request('/api/register', {'username': 'Baker', 'password': 'short'})[0], 400)


if __name__ == '__main__':
    unittest.main()
