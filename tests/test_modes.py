import random
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from combat import APIError, Combat
from server import CityServer


class GameModeTest(unittest.TestCase):
    def setUp(self):
        self.server = SimpleNamespace(players={}, game_mode='competitive')
        self.world = Combat(self.server)
        for index in range(4):
            player = dict(id=str(index), outfit=index, x=4+index, z=16,
                          angle=0, stride=0, phase=0)
            self.world.initialize(player)
            self.server.players[index] = player
        self.players = list(self.server.players.values())
        self.now = time.monotonic()

    def advance(self, seconds):
        with patch('combat.time.monotonic', return_value=self.now+seconds):
            self.world.advance()

    def test_competitive_excludes_bot_and_civilians_from_contracts(self):
        self.assertNotIn(self.world.bot, self.world.actors())
        for player in self.players:
            self.assertIsNone(player['target_id'])
            self.world.assign(player, self.now)
            self.assertIn(player['target_id'], {p['id'] for p in self.players if p is not player})
        self.world.bot['target_id'] = self.players[0]['id']
        for player in self.players:
            player['target_id'] = None
        self.assertEqual(self.world.pursuer_count(self.players[0]), 0)
        with self.assertRaises(APIError):
            self.world.visible_target(self.players[0], self.world.bot['id'], self.now)
        with patch.object(self.world, 'hit') as hit:
            self.advance(1)
            hit.assert_not_called()

    def test_test_mode_spawns_rival_and_allows_civilian_contracts(self):
        self.server.game_mode = 'test'
        self.world.initialize(self.players[0])
        self.assertEqual(self.players[0]['target_id'], self.world.bot['id'])
        self.assertIn(self.world.bot, self.world.actors())
        with patch('combat.random.choice', return_value=next(iter(self.world.npcs.values()))) as choice:
            self.world.assign(self.players[0], self.now)
        self.assertTrue(any(a['kind'] == 'npc' for a in choice.call_args.args[0]))
        self.assertTrue(self.players[0]['target_id'].startswith('npc-'))

    def test_successful_kill_waits_three_to_ten_seconds(self):
        hunter, victim = self.players[:2]
        for delay in (3, 10):
            with self.subTest(delay=delay):
                hunter.update(target_id=victim['id'], target_reassignment=None)
                victim['dead_until'] = 0
                with patch('combat.random.uniform', return_value=delay):
                    self.world.hit(hunter, victim, 'kill', self.now)
                self.assertIsNone(hunter['target_id'])
                self.assertEqual(hunter['target_reassignment'][0], self.now+delay)
                self.world.last = self.now
                self.advance(delay-.1)
                self.assertIsNone(hunter['target_id'])
                self.advance(delay)
                self.assertIsNotNone(hunter['target_id'])
                self.assertNotEqual(hunter['target_id'], victim['id'])
                self.assertIsNone(hunter['target_reassignment'])

    def test_wrong_kill_immediately_replaces_contract_if_possible(self):
        hunter, old_target, victim, replacement = self.players
        hunter['target_id'] = old_target['id']

        result = self.world.hit(hunter, victim, 'kill', self.now)

        self.assertEqual(result['delta'], -50)
        self.assertEqual(self.world.state(old_target)['score'], 50)
        self.assertEqual(victim['score'], 0)
        self.assertEqual(replacement['score'], 0)
        self.assertEqual(self.world.state(hunter)['target']['id'], replacement['id'])
        self.assertIsNone(hunter['target_reassignment'])

    def test_wrong_kill_waits_for_a_different_target_if_necessary(self):
        hunter, old_target, victim = self.players[:3]
        self.server.players.pop(3)
        hunter['target_id'] = old_target['id']

        self.world.hit(hunter, victim, 'kill', self.now)

        self.assertIsNone(hunter['target_id'])
        self.advance(1)
        self.assertIsNone(hunter['target_id'])
        self.advance(6.1)
        self.assertEqual(hunter['target_id'], victim['id'])
        self.assertIsNone(hunter['target_reassignment'])

    def test_stun_immediately_changes_target(self):
        hunter, victim, old_target = self.players[:3]
        victim['target_id'] = old_target['id']
        self.world.hit(hunter, victim, 'stun', self.now)
        self.assertEqual(hunter['stunned_until'], self.now+4)
        self.assertEqual(victim['stunned_until'], self.now+1)
        self.assertIsNotNone(victim['target_id'])
        self.assertNotEqual(victim['target_id'], old_target['id'])
        self.assertIsNone(victim['target_reassignment'])

    def test_duel_reuses_only_opponent_and_retries_after_respawn(self):
        hunter, victim = self.players[:2]
        self.server.players = {0: hunter, 1: victim}
        hunter['target_id'] = victim['id']
        with patch('combat.random.uniform', return_value=3):
            self.world.hit(hunter, victim, 'kill', self.now)
        self.advance(3)
        self.assertIsNone(hunter['target_id'])
        self.advance(6.1)
        self.assertEqual(hunter['target_id'], victim['id'])
        self.assertIsNone(hunter['target_reassignment'])
        del self.server.players[1]
        self.advance(7)
        self.assertIsNone(hunter['target_id'])

    def test_rank_weights_allow_multiple_hunters_and_unhunted_players(self):
        for index, player in enumerate(self.players):
            player['score'] = index*100
        rng = random.Random(42)
        counts = dict.fromkeys([p['id'] for p in self.players[1:]], 0)
        with patch('combat.random.choices', side_effect=rng.choices):
            for _ in range(1000):
                self.world.assign(self.players[0], self.now)
                counts[self.players[0]['target_id']] += 1
            multiple = False
            for _ in range(30):
                for player in self.players:
                    self.world.assign(player, self.now)
                hunters = [self.world.pursuer_count(p) for p in self.players]
                multiple |= hunters[-1] > 1 and hunters[0] == 0
        self.assertGreater(counts['3'], counts['2'])
        self.assertGreater(counts['2'], counts['1'])
        self.assertTrue(multiple)
        for player in self.players:
            player['score'] = 0
        with patch('combat.random.choices', return_value=[self.players[1]]) as choose:
            self.world.assign(self.players[0], self.now)
        self.assertEqual(choose.call_args.kwargs['weights'], [1, 1, 1])

    def test_mode_selection_permissions_validation_and_readiness(self):
        # Exercise lobby methods without starting or stopping a server.
        server = SimpleNamespace(phase='lobby', players=self.server.players,
                                 game_mode='test', map_id='testa')
        for player in self.players:
            player['ready'] = True
        with patch.object(CityServer, 'reset_world') as reset:
            server.reset_world = reset
            for player, mode in ((self.players[1], 'competitive'), (self.players[0], 'invalid'),
                                 (self.players[0], [])):
                with self.assertRaises(APIError):
                    CityServer.choose_game_mode(server, player, mode)
            CityServer.choose_game_mode(server, self.players[0], 'competitive')
            self.assertEqual(server.game_mode, 'competitive')
            self.assertTrue(all(not p['ready'] for p in self.players))
            reset.assert_called_once_with('testa')
            server.phase = 'playing'
            with self.assertRaises(APIError):
                CityServer.choose_game_mode(server, self.players[0], 'test')

    def test_competitive_start_requires_two_players(self):
        player = self.players[0]
        player['ready'] = True
        server = SimpleNamespace(phase='lobby', players={0: player}, game_mode='competitive')
        with self.assertRaisesRegex(APIError, 'two players'):
            CityServer.start_match(server, player)
