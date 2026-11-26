import math
from collections import Counter
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from combat import Combat, APIError, MAP_FILES, OUTFIT_COUNT


class CrowdSpawnTest(unittest.TestCase):
    def test_each_map_has_a_distinct_walkable_spawn_for_every_roster_slot(self):
        for map_id in MAP_FILES:
            with self.subTest(map_id=map_id):
                world = Combat(SimpleNamespace(players={}), map_id)
                spawns = {(point['x'], point['z']) for point in world.player_spawns}
                self.assertEqual(len(spawns), OUTFIT_COUNT)
                self.assertTrue(all(not world.blocked(x, z, .32) for x, z in spawns))
                start, *destinations = world.player_spawns
                for point in destinations:
                    self.assertTrue(world.path(start, (point['x'], point['z'])))

    def test_pool_includes_players_and_has_equal_model_counts_on_each_map(self):
        for map_id in MAP_FILES:
            for count in range(OUTFIT_COUNT+1):
                # Include high-index (unlockable) characters even in small lobbies.
                selected = list(reversed(range(OUTFIT_COUNT)))[:count]
                server = SimpleNamespace(players={i: dict(outfit=outfit)
                                                  for i, outfit in enumerate(selected)})
                with self.subTest(map_id=map_id, players=count):
                    world = Combat(server, map_id)
                    counts = Counter(actor['outfit'] for actor in world.npcs.values())
                    self.assertEqual(len(counts), max(6, count))
                    self.assertTrue(set(selected) <= counts.keys())
                    self.assertTrue(counts.keys() <= set(range(OUTFIT_COUNT)))
                    self.assertEqual(len(set(counts.values())), 1)
                    self.assertEqual(len(world.npcs), 150 // max(6, count) * max(6, count))
                    if count >= 6:
                        self.assertEqual(set(counts), set(selected))


class BetraholdNavigationTest(unittest.TestCase):
    def test_spawns_and_interaction_points_share_a_walkable_network(self):
        world = Combat(SimpleNamespace(players={}), 'betrahold')
        start = world.player_spawns[0]
        points = [*world.player_spawns[1:], world.bot, *world.npcs.values()]
        points.extend(seat for group in world.zones.values() for seat in group['zone']['seats'])
        points.extend(dict(zip(('x', 'z'), world.bench_exit(seat)))
                      for bench in world.benches.values() for seat in bench['seats'])
        for bale in world.haybales.values():
            exits = [(bale['x']+math.sin(i*math.tau/16)*1.9, bale['z']+math.cos(i*math.tau/16)*1.9)
                     for i in range(16)]
            landing = next((point for point in exits if not world.blocked(*point, .32)), None)
            self.assertIsNotNone(landing, bale['id'])
            points.append(dict(x=landing[0], z=landing[1]))
        self.assertFalse(world.blocked(start['x'], start['z'], .32))
        for point in points:
            x, z = point['x'], point['z']
            with self.subTest(x=x, z=z):
                self.assertFalse(world.blocked(x, z, .32))
                self.assertTrue(world.path(start, (x, z)))


class CombatTest(unittest.TestCase):
    def setUp(self):
        self.server = SimpleNamespace(players={})
        self.world = Combat(self.server)
        self.world.walls = []
        self.player = dict(id='one',outfit=0,x=4,z=16,angle=0,stride=0,phase=0)
        self.world.initialize(self.player)
        self.server.players[1] = self.player
        self.bot = self.world.bot
        self.bot.update(x=5,z=16,target_id='one')

    def action(self, action='kill', victim=None):
        return self.world.action(self.player,dict(action=action,victim=(victim or self.bot)['id']))

    def sit(self, actor=None, bench_id='bench-0'):
        actor = actor or self.player
        seat = self.world.benches[bench_id]['seats'][0]
        actor.update(x=seat['x'], z=seat['z']-1)
        self.world.action(actor, dict(action='bench', victim=bench_id))

    def test_bench_sit_stand_and_blend_stealth(self):
        self.sit()
        self.assertEqual(self.player['bench'], 'bench-0')
        public = self.world.public(self.player)
        self.assertEqual(public['bench_seat'], 0)
        self.assertEqual(public['animation']['kind'], 'bench-sit')
        start = self.player['stealth_at']
        self.player.update(stealth=100, updated=start-10)
        self.world.update_stealth(self.player, start+5)
        self.assertEqual(self.player['stealth'], 150)
        self.assertGreater(self.player['hidden_charge'], 10)
        self.player['busy_until'] = 0
        self.world.action(self.player, dict(action='bench'))
        self.assertIsNone(self.player['bench'])
        self.assertEqual(self.player['animation']['kind'], 'bench-rise')
        self.assertEqual(len(self.world.free_bench_seats(self.world.benches['bench-0'])), 2)

    def test_bench_two_and_four_seats_cannot_be_double_booked(self):
        for bench in self.world.benches.values():
            seated = []
            for i, seat in enumerate(bench['seats']):
                npc = list(self.world.npcs.values())[i]
                npc.update(x=seat['x'], z=seat['z']-1)
                self.world.sit_bench(npc, bench['id'], time.monotonic(), i)
                seated.append(npc)
            self.assertIn(len(seated), (2, 4))
            self.assertEqual(self.world.free_bench_seats(bench), [])
            self.player.update(x=bench['x'], z=bench['z']-1)
            with self.assertRaises(APIError):
                self.world.action(self.player, dict(action='bench', victim=bench['id']))
            for npc in seated:
                self.world.leave_bench(npc, time.monotonic(), animate=False)

    def test_all_items_blocked_in_bench_and_hay_without_consuming_cooldown(self):
        from combat import POWERS
        for place in ('bench', 'hay'):
            self.world.initialize(self.player)
            if place == 'bench':
                self.sit()
            else:
                self.player.update(x=1, z=17.8)
                self.hay()
            self.player['busy_until'] = 0
            for power in POWERS:
                self.player['powers'] = [power]
                with self.assertRaises(APIError):
                    self.world.use_power(self.player, 0, self.bot['id'])
                self.assertNotIn(power, self.player['power_timers'])
            self.assertEqual(len(self.world.effects), 1 if place == 'hay' else 0)

    def test_bench_rejects_distance_invisibility_busy_and_hay(self):
        self.player.update(x=20, z=20)
        with self.assertRaises(APIError):
            self.world.action(self.player, dict(action='bench', victim='bench-0'))
        for field in ('stunned_until', 'busy_until'):
            self.player[field] = time.monotonic()+10
            with self.assertRaises(APIError):
                self.sit()
            self.player[field] = 0
        self.player['power_timers']['invisibility'] = (time.monotonic()+6, 0)
        with self.assertRaises(APIError):
            self.sit()
        self.player['power_timers'].clear()
        self.player['haybale'] = 'hay-0'
        with self.assertRaises(APIError):
            self.sit()

    def test_seated_player_can_kill_or_stun_and_releases_seat(self):
        for action in ('kill', 'stun'):
            self.world.initialize(self.player)
            self.sit()
            self.player['busy_until'] = 0
            self.bot.update(x=self.player['x'], z=self.player['z']-1, dead_until=0, stunned_until=0)
            self.action(action)
            self.assertIsNone(self.player['bench'])
            self.assertEqual(self.player['animation']['kind'], 'bench-attack-'+action)
            self.assertGreater(self.bot['dead_until' if action == 'kill' else 'stunned_until'], time.monotonic())

    def test_seated_npc_can_be_killed_or_stunned_and_releases_seat(self):
        npc = next(iter(self.world.npcs.values()))
        for action in ('kill', 'stun'):
            self.world.initialize(self.player)
            npc.update(dead_until=0, stunned_until=0)
            seat = self.world.benches['bench-0']['seats'][0]
            npc.update(x=seat['x'], z=seat['z']-1)
            self.world.sit_bench(npc, 'bench-0', time.monotonic())
            self.player.update(x=seat['x'], z=seat['z']-1)
            self.action(action, npc)
            self.assertIsNone(npc['bench'])
            self.assertEqual(self.player['animation']['kind'], 'bench-target-'+action)
            self.assertEqual(npc['animation']['kind'], 'bench-fall' if action == 'kill' else 'bench-stagger')

    def test_npc_walks_to_bench_sits_then_leaves_and_panics(self):
        npc = next(iter(self.world.npcs.values()))
        self.world.npcs = {npc['id']: npc}
        bench = self.world.benches['small-bench-0']
        seat = bench['seats'][0]
        now = self.world.last
        x, z = self.world.bench_exit(seat)
        npc.update(natural_state='activity', crowd_group=None, crowd_slot=None, route=[],
                   x=x+1.35, z=z, change_at=now+60)
        for step in range(100):
            self.world.advance_crowd(now+step*.1, .1)
            if npc.get('bench'):
                break
        self.assertEqual(npc.get('bench'), bench['id'])
        self.assertEqual(npc['animation']['kind'], 'bench-sit')
        self.world.advance_crowd(now+59, .1)
        self.assertEqual(npc['bench'], bench['id'])
        npc.update(panic_until=now+65, panic_turn=0)
        self.world.advance_crowd(now+61, .1)
        self.assertIsNone(npc['bench'])
        self.assertEqual(npc['natural_state'], 'activity')
        self.world.advance_crowd(now+66, .1)
        self.assertNotEqual(npc['natural_state'], 'activity')

    def hay(self, player=None):
        return self.world.action(player or self.player, dict(action='hay', victim='hay-0'))

    def test_hay_entry_exit_and_shared_animation(self):
        self.player.update(x=1, z=17.8)
        self.hay()
        self.assertEqual(self.player['haybale'], 'hay-0')
        self.assertEqual(self.world.public(self.player)['animation']['kind'], 'hay-enter')
        self.assertEqual(self.world.visible_effects()[0]['power'], 'hay')
        self.player['busy_until'] = 0
        self.hay()
        self.assertIsNone(self.player['haybale'])
        self.assertEqual(self.player['animation']['kind'], 'hay-exit')
        self.assertFalse(self.world.blocked(self.player['x'], self.player['z'], .32))

    def test_hay_rejects_distant_invisible_stunned_and_busy_entrants(self):
        self.player.update(x=20, z=20)
        with self.assertRaises(APIError):
            self.hay()
        self.player.update(x=1, z=17.8)
        now = time.monotonic()
        for field in ('stunned_until', 'busy_until'):
            self.player[field] = now+10
            with self.assertRaises(APIError):
                self.hay()
            self.player[field] = 0
        self.player['power_timers']['invisibility'] = (now+6, now+26)
        with self.assertRaises(APIError):
            self.hay()

    def test_hay_new_entrant_shoves_out_occupant(self):
        self.player.update(x=1, z=17.8)
        self.hay()
        other = dict(id='two', outfit=1, x=1, z=17.8, angle=0, stride=0, phase=0)
        self.world.initialize(other)
        self.server.players[2] = other
        self.hay(other)
        self.assertIsNone(self.player['haybale'])
        self.assertEqual(self.player['animation']['kind'], 'hay-shove')
        self.assertEqual(other['haybale'], 'hay-0')

    def test_hay_generates_blend_stealth_without_movement_packets(self):
        self.player.update(x=1, z=17.8)
        self.hay()
        start = self.player['stealth_at']
        self.player.update(stealth=100, updated=start-10)
        self.world.update_stealth(self.player, start+5)
        self.assertEqual(self.player['stealth'], 150)
        self.assertGreater(self.player['hidden_charge'], 10)

    def test_hay_search_resolves_occupant_and_clears_hiding_on_death(self):
        self.player.update(x=1, z=17.8)
        self.hay()
        other = dict(id='two', outfit=1, x=1, z=17.8, angle=0, stride=0, phase=0)
        self.world.initialize(other)
        self.server.players[2] = other
        with self.assertRaises(APIError):
            self.world.action(other, dict(action='kill', victim='one'))
        self.world.action(other, dict(action='kill', victim='hay-0'))
        self.assertIsNone(self.player['haybale'])
        self.assertGreater(self.player['dead_until'], time.monotonic())
        self.assertEqual(other['animation']['kind'], 'hay-search-kill')

    def test_hay_ambush_stun_exits_and_uses_combat_scoring(self):
        self.player.update(x=1, z=17.8)
        self.hay()
        self.player['busy_until'] = 0
        self.bot.update(x=1, z=17.8)
        result = self.action('stun')
        self.assertEqual(result['delta'], 0)
        self.assertIsNone(self.player['haybale'])
        self.assertEqual(self.player['animation']['kind'], 'hay-ambush-stun')
        self.assertGreater(self.bot['stunned_until'], time.monotonic())

    def test_empty_hay_search_does_not_award_points(self):
        self.player.update(x=1, z=17.8)
        with self.assertRaises(APIError):
            self.world.action(self.player, dict(action='kill', victim='hay-0'))
        self.assertEqual(self.player['score'], 0)

    def test_kill_feed_records_usernames_tier_and_method(self):
        self.player['username'] = 'Hunter'
        victim = dict(id='two', username='Target', outfit=1, x=5, z=16, angle=0, stride=0, phase=0)
        self.world.initialize(victim)
        self.server.players[2] = victim
        self.world.hit(self.player, victim, 'kill', time.monotonic(), ranged=True)
        entry = self.world.recent_kills()[0]
        self.assertEqual(entry, dict(id=1, attacker='Hunter', target='Target', tier='stealth', method='gun'))
        with self.assertRaises(APIError):
            self.action(victim=victim)
        self.assertEqual(len(self.world.recent_kills()), 1)

    def test_kill_feed_expires_and_resets_with_world(self):
        now = time.monotonic()
        with patch('combat.time.monotonic', return_value=now):
            self.action()
            self.assertEqual(self.world.recent_kills()[0]['target'], 'Scribe practice rival')
        with patch('combat.time.monotonic', return_value=now+10):
            self.assertEqual(self.world.recent_kills(), [])
        self.assertEqual(Combat(self.server).recent_kills(), [])

    def test_kill_feed_excludes_stuns_and_keeps_latest_five(self):
        self.action('stun')
        self.assertEqual(self.world.recent_kills(), [])
        now = time.monotonic()
        for _ in range(7):
            self.world.hit(self.player, self.bot, 'kill', now)
        self.assertEqual([entry['id'] for entry in self.world.recent_kills()], [3, 4, 5, 6, 7])
        self.assertEqual(self.world.feed_name(next(iter(self.world.npcs.values()))), 'Citizen')

    def test_target_kill_scores_once_and_reassigns(self):
        result = self.action()
        self.assertEqual(result['message'], 'Stealth Kill · +150 points')
        self.assertEqual(result['delta'], 150)
        self.assertEqual(self.player['score'], 150)
        self.assertNotEqual(self.player['target_id'],self.bot['id'])
        self.assertGreater(self.bot['dead_until'],time.monotonic())
        with self.assertRaises(APIError):
            self.action()
        self.assertEqual(self.player['score'], 150)

    def test_contract_kill_awards_at_stealth_boundaries(self):
        cases = [(0, 'Savage Kill', 50), (50, 'Savage Kill', 50), (50.01, 'Bloody Kill', 100),
                 (99.99, 'Bloody Kill', 100), (100, 'Stealth Kill', 150),
                 (125, 'Stealth Kill', 150), (125.01, 'Incognito Kill', 200), (150, 'Incognito Kill', 200)]
        with patch('combat.time.monotonic', return_value=1000):
            for stealth, name, points in cases:
                with self.subTest(stealth=stealth):
                    self.world.initialize(self.player)
                    self.player['stealth'] = stealth
                    self.bot['dead_until'] = 0
                    result = self.action()
                    self.assertEqual(result['delta'], points)
                    self.assertEqual(result['message'], f'{name} · +{points} points')

    def test_stealth_rates_caps_and_overflow(self):
        def change(*args, **kwargs):
            return self.world.change_stealth(*args, **kwargs)[0]
        self.assertEqual(change(100, 1, sprinting=True), 75)
        self.assertEqual(change(10, 1, sprinting=True), 0)
        self.assertEqual(change(50, 1), 55)
        self.assertEqual(change(95, 1), 100)
        self.assertEqual(change(100, 1, blending=True), 110)
        self.assertEqual(change(125, 3, blending=True), 150)
        self.assertEqual(change(150, 1), 135)
        self.assertEqual(change(105, 1), 100)
        self.assertEqual(change(150, 1, sprinting=True), 110)
        self.assertEqual(change(120, 1, sprinting=True), 87.5)

    def test_hidden_charge_integrates_time_at_each_tier(self):
        change = self.world.change_stealth
        self.assertEqual(change(0, 1), (5, 0))
        self.assertEqual(change(60, 1), (65, 1))
        self.assertEqual(change(100, 1), (100, 2))
        self.assertEqual(change(150, 1, blending=True), (150, 3))
        self.assertEqual(change(120, 1, blending=True), (130, 2.5))
        self.assertEqual(change(95, 2), (100, 3))
        self.assertEqual(change(100, 2, sprinting=True), (50, 2))
        self.assertAlmostEqual(change(130, 1)[1], 2 + 5/15)

    def test_hidden_bonus_pays_once_resets_and_keeps_next_cycle_charge(self):
        self.player.update(stealth_at=1000, hidden_charge=198)
        self.world.update_stealth(self.player, 1001)
        with patch('combat.time.monotonic', return_value=1001):
            state = self.world.state(self.player)
        self.assertEqual(state['score'], 50)
        self.assertEqual(state['hidden_progress'], 0)
        self.assertTrue(state['hidden_awarded'])
        self.assertNotIn('hidden_charge', self.world.public(self.player))
        self.world.update_stealth(self.player, 1001)
        self.assertEqual(self.player['score'], 50)
        self.world.update_stealth(self.player, 1002)
        self.assertEqual(self.player['hidden_charge'], 2)
        self.player['dead_until'] = 1006
        self.world.update_stealth(self.player, 1005)
        self.assertEqual(self.player['hidden_charge'], 2)
        self.world.update_stealth(self.player, 1007)
        self.assertEqual(self.player['hidden_charge'], 4)

    def test_hidden_generation_scales_with_current_pursuers(self):
        self.bot['target_id'] = None
        for count, expected in enumerate((2, 2, 3, 4, 4)):
            if count:
                pursuer = dict(id=f'pursuer-{count}')
                self.world.initialize(pursuer)
                pursuer['target_id'] = self.player['id']
                self.server.players[count+1] = pursuer
            self.player.update(stealth_at=1000, hidden_charge=198, score=0)
            self.world.update_stealth(self.player, 1001)
            with self.subTest(pursuers=count):
                self.assertEqual(self.player['score'], 50)
                self.assertEqual(self.player['hidden_charge'], expected-2)

    def test_walking_blend_requires_an_active_visible_group_and_walking_pace(self):
        members = [next(iter(self.world.npcs.values()))]
        self.world.npcs = {a['id']: a for a in members}
        self.world.walking_groups[6] = dict(number=6, x=4, z=16)
        members[0].update(crowd_group=6, x=4, z=16, stride=.9)
        self.player.update(blend_group=6, stride=.9)
        now = time.monotonic()
        self.assertTrue(self.world.in_walking_group(self.player, 6, now))
        self.player['sprinting'] = True
        self.assertFalse(self.world.in_walking_group(self.player, 6, now))
        self.player.update(sprinting=False, stride=1.4)
        self.assertFalse(self.world.in_walking_group(self.player, 6, now))
        self.player['stride'] = .9
        for field in ('stunned_until', 'dead_until', 'panic_until', 'decoy_until'):
            with self.subTest(field=field):
                members[0][field] = now+4
                self.assertFalse(self.world.in_walking_group(self.player, 6, now))
                members[0][field] = 0
        self.player['z'] = 15
        self.world.walls = [dict(x0=3, x1=6, z0=15.4, z1=15.6, height=2)]
        self.assertFalse(self.world.in_walking_group(self.player, 6, now))

    def test_walking_blend_covers_blue_zone_but_not_distant_players(self):
        member = next(iter(self.world.npcs.values()))
        self.world.npcs = {member['id']: member}
        self.world.walking_groups[6] = dict(number=6, x=4.3, z=16)
        member.update(crowd_group=6, x=4.3, z=16, stride=.9)
        now = time.monotonic()
        self.player.update(x=4.3, z=18.1, stride=.9)
        self.assertTrue(self.world.in_walking_group(self.player, 6, now))
        self.player['z'] = 18.6
        self.assertFalse(self.world.in_walking_group(self.player, 6, now))
        self.assertFalse(self.world.in_walking_group(self.player, 10, now))
        self.assertFalse(self.world.in_walking_group(self.player, '6', now))

    def test_successful_smoke_and_firecrackers_remove_one_hundred_stealth(self):
        self.player['powers'] = ['smoke', 'firecrackers']
        self.player['stealth'] = 150
        with patch('combat.time.monotonic', return_value=self.player['stealth_at']):
            self.world.use_power(self.player, 0)
            self.assertEqual(self.world.state(self.player)['stealth'], 50)
            with self.assertRaises(APIError):
                self.world.use_power(self.player, 0)
            self.assertEqual(self.player['stealth'], 50)
            self.world.use_power(self.player, 1)
            self.assertEqual(self.player['stealth'], 0)

    def test_wrong_npc_and_player_cost_fifty(self):
        npc = next(iter(self.world.npcs.values()))
        npc.update(x=5,z=16)
        self.assertEqual(self.action(victim=npc)['delta'],-50)
        other=dict(id='two',outfit=1,x=5,z=16,angle=0,stride=0,phase=0)
        self.world.initialize(other)
        self.server.players[2]=other
        self.player.update(cooldown=0, busy_until=0)
        self.assertEqual(self.action(victim=other)['delta'],-50)
        self.assertEqual(self.player['assassinations'], 0)

    def test_off_contract_incognito_kill_costs_fifty_and_replaces_contract(self):
        npc = next(iter(self.world.npcs.values()))
        npc.update(x=5, z=16)
        self.player.update(stealth=126, stealth_at=1000)
        with patch('combat.time.monotonic', return_value=1000):
            result = self.action(victim=npc)
        self.assertEqual(result['message'], 'Wrong character eliminated · -50 points')
        self.assertEqual(result['delta'], -50)
        self.assertEqual(self.player['score'], -50)
        state = self.world.state(self.player)
        self.assertIsNotNone(state['target'])
        self.assertNotIn(state['target']['id'], (self.bot['id'], npc['id']))
        self.assertIsNone(state['target_wait'])

    def test_defensive_stun_free_other_stun_penalty(self):
        self.assertEqual(self.action('stun')['delta'],0)
        self.assertGreater(self.bot['stunned_until'],time.monotonic())
        self.assertEqual(self.player['stunned_until'], 0)
        self.player['cooldown']=0
        npc=next(iter(self.world.npcs.values()))
        npc.update(x=5,z=16)
        self.player['target_id'] = npc['id']
        revision = self.player['revision']
        now = time.monotonic()
        with patch('combat.time.monotonic', return_value=now) as clock:
            self.assertEqual(self.action('stun',npc)['delta'], -25)
            self.assertEqual(self.player['stunned_until'], now+4)
            state = self.world.public(npc)
            self.assertAlmostEqual(state['stunned'], 1)
            self.assertEqual(state['animation']['duration'], 1)
            self.assertEqual(self.player['revision'], revision+1)
            clock.return_value = now+1
            self.assertTrue(self.world.active(npc, clock.return_value))
            with self.assertRaisesRegex(APIError, 'Wait until you can act again'):
                self.action(victim=npc)
            clock.return_value = now+4
            self.assertTrue(self.world.active(self.player, clock.return_value))
        self.assertEqual(self.player['score'], -25)

    def test_range_walls_self_and_incapacitation_rejected(self):
        self.bot['x']=20
        with self.assertRaises(APIError): self.action()
        self.bot['x']=5
        self.world.walls=[dict(x0=4.4,x1=4.6,z0=15,z1=17,height=3)]
        with self.assertRaises(APIError): self.action()
        self.world.walls=[]
        with self.assertRaises(APIError): self.action(victim=self.player)
        self.player['stunned_until']=time.monotonic()+2
        with self.assertRaises(APIError): self.action()
        self.assertEqual(self.player['score'],0)

    def test_bot_telegraphs_attacks_and_respawns(self):
        # Avoid crowd routing while exercising the practice rival.
        self.world.npcs={}
        self.world.last-=.1
        self.world.advance()
        self.assertTrue(self.world.state(self.player)['warning'])
        self.assertEqual(self.player['dead_until'],0)
        self.bot['attack_at']=time.monotonic()-.01
        self.world.last-=.1
        self.world.advance()
        self.assertGreater(self.player['dead_until'],time.monotonic())
        self.assertEqual(self.bot['score'],100)
        self.assertEqual(self.player['score'],0)
        self.player['spawn'] = (4, 16)
        self.bot['target_id'] = self.player['id']
        for revision, index in enumerate((1, 2), start=2):
            previous = self.player['spawn']
            spawn = self.world.player_spawns[index]
            self.player['dead_until'] = time.monotonic()-.01
            self.world.last -= .1
            with patch('combat.random.choice', return_value=spawn) as choose:
                self.world.advance()
            candidates = choose.call_args.args[0]
            self.assertIn(spawn, candidates)
            self.assertNotIn(previous, [(point['x'], point['z']) for point in candidates])
            self.assertEqual(self.player['dead_until'], 0)
            self.assertEqual(self.player['revision'], revision)
            self.assertEqual((self.player['x'], self.player['z'], self.player['angle']),
                             (spawn['x'], spawn['z'], spawn['angle']))

    def test_elimination_animations_shared_and_expire_at_respawn(self):
        now = time.monotonic()
        self.world.hit(self.player, self.bot, 'kill', now)
        attacker = self.world.public(self.player)['animation']
        victim = self.world.public(self.bot)['animation']
        self.assertEqual(attacker['kind'], 'eliminate')
        self.assertEqual(victim['kind'], 'fall')
        self.assertAlmostEqual(attacker['angle'], victim['angle'])
        self.assertEqual((victim['x'], victim['z']), (5, 16))
        self.assertGreater(self.player['busy_until'], now)
        self.assertNotIn('started', attacker)
        self.assertGreaterEqual(attacker['age'], 0)
        # A late snapshot must preserve the settled corpse without restarting the fall.
        self.player['animation']['started'] -= 2
        self.bot['animation']['started'] -= 2
        self.assertIsNone(self.world.public(self.player)['animation'])
        self.assertGreater(self.world.public(self.bot)['animation']['age'], 2)
        self.bot['dead_until'] = time.monotonic()-.01
        self.world.last -= .1
        self.world.advance()
        self.assertIsNone(self.world.public(self.bot)['animation'])

    def test_stun_shares_a_strike_and_stagger_without_locking_the_attacker(self):
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.action('stun')
            attacker = self.world.public(self.player)
            victim = self.world.public(self.bot)
            self.assertEqual(attacker['animation']['kind'], 'stun-strike')
            self.assertFalse(attacker['busy'])
            self.assertEqual(victim['animation']['kind'], 'stagger')
            self.assertEqual(victim['animation']['duration'], victim['stunned'])
            clock.return_value = 1001
            self.assertIsNone(self.world.public(self.player)['animation'])
            self.assertEqual(self.world.public(self.bot)['animation']['age'], 1)
            clock.return_value = 1004
            self.assertIsNone(self.world.public(self.bot)['animation'])

    def test_stunned_player_gets_a_different_target_after_the_delay(self):
        attacker = dict(id='two', outfit=1, x=5, z=16, angle=0, stride=0, phase=0)
        self.world.initialize(attacker)
        self.server.players[2] = attacker
        old_target = self.bot['id']
        for delay in (3, 10):
            with self.subTest(delay=delay), patch('combat.time.monotonic', return_value=1000) as clock:
                self.world.initialize(self.player)
                self.player['target_id'] = attacker['id']
                attacker['cooldown'] = 0
                self.world.last = 999.9
                with patch('combat.random.uniform', return_value=delay) as choose_delay:
                    result = self.world.action(attacker, dict(action='stun', victim=self.player['id']))
                    choose_delay.assert_called_once_with(3, 10)

                self.assertEqual(result['delta'], 0)
                state = self.world.state(self.player)
                self.assertIsNone(state['target'])
                self.assertEqual(state['target_wait'], delay)
                self.assertEqual(self.world.state(attacker)['target']['id'], old_target)

                clock.return_value = 1000 + delay - .1
                self.world.advance()
                self.assertIsNone(self.world.state(self.player)['target'])

                clock.return_value = 1000 + delay
                self.world.advance()
                state = self.world.state(self.player)
                self.assertNotEqual(state['target']['id'], attacker['id'])
                self.assertIsNone(state['target_wait'])
                self.assertEqual(state['stunned'], max(0, 4 - delay))

    def test_power_duration_and_cooldown_are_sequential(self):
        powers = [('smoke', 4, 15), ('disguise', 15, 15), ('firecrackers', 4, 25),
                  ('invisibility', 6, 20), ('cult', 0, 25)]
        citizen = next(iter(self.world.npcs.values()))
        citizen.update(x=5, z=16)
        for power, duration, cooldown in powers:
            with self.subTest(power=power), patch('combat.time.monotonic', return_value=1000) as clock:
                self.world.initialize(self.player)
                self.player['powers'] = [power, None]
                victim = citizen['id'] if power == 'disguise' else None
                self.world.use_power(self.player, 0, victim)
                self.assertEqual(self.world.state(self.player)['powers'][0],
                                 dict(id=power, active=duration, cooldown=cooldown))
                if duration:
                    clock.return_value += duration / 2
                    self.assertEqual(self.world.state(self.player)['powers'][0]['cooldown'], cooldown)
                clock.return_value = 1000 + duration + cooldown - 1
                self.assertEqual(self.world.state(self.player)['powers'][0]['cooldown'], 1)
                with self.assertRaises(APIError):
                    self.world.use_power(self.player, 0, victim)
                clock.return_value += 1
                self.world.use_power(self.player, 0, victim)

    def test_smoke_is_shared_at_cast_position_for_four_seconds(self):
        self.player['powers'] = ['smoke', None]
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.use_power(self.player, 0)
            self.player['x'] += 9
            clock.return_value += 3
            self.assertEqual(self.world.visible_effects(), [
                dict(power='smoke', x=4, z=16, duration=4, age=3)])
            clock.return_value += 1
            self.assertEqual(self.world.visible_effects(), [])

    def test_disguise_ends_and_invisibility_prevents_being_targeted(self):
        self.player['powers'] = ['disguise', 'invisibility']
        citizen = next(iter(self.world.npcs.values()))
        citizen.update(x=18, z=16, outfit=2)
        with patch('combat.time.monotonic', return_value=1000) as clock:
            with self.assertRaises(APIError):
                self.world.use_power(self.player, 0)
            with self.assertRaises(APIError):
                self.world.use_power(self.player, 0, citizen['id'])
            citizen['x'] = 5
            self.world.use_power(self.player, 0, citizen['id'])
            self.assertEqual(self.world.public(self.player)['outfit'], citizen['outfit'])
            self.assertEqual(self.world.public(self.player, contract=True)['outfit'], self.player['outfit'])
            self.world.use_power(self.player, 1)
            self.assertTrue(self.world.public(self.player)['invisible'])
            with self.assertRaises(APIError):
                self.world.action(self.bot, dict(action='kill', victim=self.player['id']))
            self.world.last = 999.9
            self.world.advance()
            self.assertFalse(self.world.state(self.player)['warning'])
            clock.return_value += 6
            self.assertFalse(self.world.public(self.player)['invisible'])
            clock.return_value += 9
            self.assertEqual(self.world.public(self.player)['outfit'], self.player['outfit'])

    def test_invisibility_fills_and_holds_stealth_then_resumes_drain_at_expiry(self):
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.initialize(self.player)
            self.player.update(powers=['invisibility', 'smoke'], stealth=12,
                               sprinting=True, updated=1000)
            self.world.use_power(self.player, 0)
            self.assertEqual(self.world.state(self.player)['stealth'], 150)
            self.assertEqual(self.world.state(self.player)['stealth_tier'], 'incognito')
            for elapsed in (1, 3, 5.99, 6):
                clock.return_value = 1000 + elapsed
                self.player['updated'] = clock.return_value
                self.world.update_stealth(self.player, clock.return_value)
                self.assertEqual(self.player['stealth'], 150)
            self.assertAlmostEqual(self.player['hidden_charge'], 18)
            clock.return_value = 1006.5
            self.player['updated'] = clock.return_value
            self.world.update_stealth(self.player, clock.return_value)
            self.assertAlmostEqual(self.player['stealth'], 130)

    def test_invisibility_delayed_update_only_drains_after_expiry(self):
        with patch('combat.time.monotonic', return_value=1000):
            self.world.initialize(self.player)
            self.player['powers'] = ['invisibility', 'smoke']
            self.world.use_power(self.player, 0)
            self.world.update_stealth(self.player, 1007)
            self.assertEqual(self.player['stealth'], 135)

    def test_invisibility_blocks_actions_and_powers_without_side_effects(self):
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.initialize(self.player)
            self.player['powers'] = ['invisibility', 'gun']
            self.world.use_power(self.player, 0)
            for elapsed in (0, 3, 5.999):
                clock.return_value = 1000 + elapsed
                for action in ('kill', 'stun'):
                    with self.assertRaisesRegex(APIError, 'cannot act while invisible'):
                        self.action(action)
                    with self.assertRaisesRegex(APIError, 'cannot act while invisible'):
                        self.world.hit(self.player, self.bot, action, clock.return_value)
                for power in ('gun', 'smoke', 'disguise', 'sprint', 'cult', 'mute', 'decoy', 'firecrackers'):
                    self.player['powers'][1] = power
                    with self.assertRaisesRegex(APIError, 'cannot act while invisible'):
                        self.world.use_power(self.player, 1, self.bot['id'])
                self.assertEqual(self.player['stealth'], 150)
                self.assertEqual(self.player['score'], 0)
                self.assertEqual(self.bot['dead_until'], 0)
                self.assertEqual(self.bot['stunned_until'], 0)
                self.assertEqual(set(self.player['power_timers']), {'invisibility'})
                self.assertEqual(len(self.world.effects), 1)
            clock.return_value = 1006
            self.player['powers'][1] = 'smoke'
            self.world.use_power(self.player, 1)
            self.assertEqual(self.action()['delta'], 50)

    def test_invisibility_effects_on_cast_and_end_at_current_position_once(self):
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.initialize(self.player)
            self.player['powers'] = ['invisibility', None]
            self.world.use_power(self.player, 0)
            self.assertEqual(self.world.visible_effects(), [
                dict(power='invisibility', x=4, z=16, duration=.8, age=0)])
            self.player.update(x=12, z=18)
            clock.return_value = 1006
            self.world.last = 1005.9
            self.world.advance()
            self.assertEqual(self.world.visible_effects(), [
                dict(power='invisibility', phase='end', x=12, z=18, duration=.8, age=0)])
            clock.return_value += .1
            self.world.advance()
            self.assertEqual(len(self.world.visible_effects()), 1)
            clock.return_value = 1007
            self.assertEqual(self.world.visible_effects(), [])

    def test_crowd_powers_affect_only_nearby_civilians(self):
        close, edge, mid, far = list(self.world.npcs.values())[:4]
        close.update(x=5, z=16, outfit=2)
        edge.update(x=8, z=16)
        mid.update(x=10, z=16, outfit=3)
        far.update(x=20, z=16, outfit=3)
        self.player['powers'] = ['firecrackers', 'cult']
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.use_power(self.player, 0)
            self.assertEqual(close['panic_until'], 1004)
            self.assertEqual(edge['panic_until'], 1004)
            self.assertNotIn('panic_until', mid)
            self.assertNotIn('panic_until', far)
            self.assertNotIn('panic_until', self.bot)
            self.world.last = 999.9
            self.world.advance()
            self.assertEqual(close['stride'], 1.42)
            self.assertNotEqual((close['x'], close['z']), (5, 16))
            self.world.use_power(self.player, 1)
            self.assertEqual(mid['outfit'], self.player['outfit'])
            clock.return_value += 40
            self.world.advance()
            self.assertLessEqual(close['stride'], 1)
            self.assertEqual(self.world.public(close)['outfit'], self.player['outfit'])
            self.assertEqual(self.world.public(far)['outfit'], 3)
            self.assertEqual(self.world.public(self.bot)['outfit'], 3)

    def test_state_transitions_population_and_shared_capacity(self):
        citizens = list(self.world.npcs.values())
        self.assertEqual(len(citizens), 150)
        self.assertEqual({a['profile'] for a in citizens}, {'balanced','activity','loner','group_walk'})
        self.assertEqual(len({a['change_at'] for a in citizens}), 150)
        for actor in citizens:
            previous = actor['natural_state']
            self.world.change_state(actor, 100)
            self.assertNotEqual(previous, actor['natural_state'])
            self.assertTrue(115 <= actor['change_at'] <= 190)
        number = 10000
        self.world.walking_groups[number] = dict(number=number, x=4, z=16)
        for i, actor in enumerate(citizens[:4]):
            actor.update(crowd_group=number, crowd_slot=i)
        self.world.reserve_player_slot(self.player, number, 4)
        self.assertEqual(self.world.occupied_slots(number), set(range(5)))
        extra = dict(x=4, z=16)
        self.world.reserve_player_slot(extra, number, 4)
        self.assertIsNone(extra['crowd_group'])

    def test_activity_holds_conversation_seat_until_transition(self):
        actor = next(iter(self.world.npcs.values()))
        self.world.npcs = {actor['id']:actor}
        seat = self.world.zones[0]['zone']['seats'][1]
        actor.update(**seat, natural_state='activity', change_at=100, crowd_group=None, crowd_slot=None)
        self.world.advance_crowd(10, .1)
        self.assertEqual((actor['crowd_group'], actor['crowd_slot']), (0, 1))
        self.world.advance_crowd(99, .1)
        self.assertEqual(actor['activity'], 'conversation')
        self.world.advance_crowd(100, .1)
        self.assertNotEqual(actor['crowd_group'], 0)
        self.assertIsNone(actor['activity'])

    def test_sprint_boost_doubles_movement_budget_during_effect(self):
        self.player.update(powers=['sprint', None], updated=999)
        with patch('combat.time.monotonic', return_value=1000) as clock:
            baseline = self.world.movement_budget(self.player, 1000)
            self.world.use_power(self.player, 0)
            self.player['updated'] = 1000
            self.assertAlmostEqual(self.world.movement_budget(self.player, 1001), (baseline-.35)*2+.35)
            self.assertEqual(self.world.state(self.player)['powers'][0], dict(id='sprint', active=10, cooldown=15))
            clock.return_value = 1010
            self.assertFalse(self.world.public(self.player)['boosted'])
            self.assertAlmostEqual(self.world.movement_budget(self.player, 1012), baseline)

    def test_decoy_sends_one_civilian_in_a_single_direction(self):
        chosen, bystander = list(self.world.npcs.values())[:2]
        chosen.update(x=6, z=16)
        self.player['powers'] = ['decoy', None]
        with patch('combat.time.monotonic', return_value=1000) as clock:
            with self.assertRaises(APIError):
                self.world.use_power(self.player, 0, self.bot['id'])
            self.world.use_power(self.player, 0, chosen['id'])
            angle = chosen['decoy_angle']
            self.world.sprint(chosen, 1001, .1)
            self.world.sprint(chosen, 1002, .1)
            self.assertEqual(chosen['decoy_angle'], angle)
            self.assertAlmostEqual(chosen['x'], 6+math.sin(angle)*.92)
            self.assertAlmostEqual(chosen['z'], 16+math.cos(angle)*.92)
            self.assertNotIn('decoy_until', bystander)
            clock.return_value += 5
            self.assertEqual(self.world.state(self.player)['powers'][0], dict(id='decoy', active=0, cooldown=20))

    def test_mute_blocks_player_powers_until_it_expires(self):
        victim = dict(id='two',outfit=1,x=8,z=16,angle=0,stride=0,phase=0,powers=['smoke', None])
        self.world.initialize(victim)
        self.server.players[2] = victim
        self.player['powers'] = ['mute', None]
        with patch('combat.time.monotonic', return_value=1000) as clock:
            self.world.use_power(self.player, 0, victim['id'])
            self.assertEqual(self.world.state(victim)['muted'], 6)
            with self.assertRaisesRegex(APIError, 'muted'):
                self.world.use_power(victim, 0)
            clock.return_value += 6
            self.assertEqual(self.world.state(victim)['muted'], 0)
            self.world.use_power(victim, 0)
            clock.return_value = 1021
            self.world.use_power(self.player, 0, self.bot['id'])
            self.assertNotIn('muted_until', self.bot)

    def test_gun_validates_range_and_sight_then_shares_the_shot(self):
        self.player['powers'] = ['gun', None]
        self.player.update(stealth=150, stealth_at=1000)
        self.bot.update(x=34.1, z=16)
        with patch('combat.time.monotonic', return_value=1000) as clock:
            with self.assertRaisesRegex(APIError, 'line of sight'):
                self.world.use_power(self.player, 0, self.bot['id'])
            self.bot['x'] = 34
            self.world.walls = [dict(x0=9,x1=10,z0=15,z1=17,height=3)]
            with self.assertRaisesRegex(APIError, 'line of sight'):
                self.world.use_power(self.player, 0, self.bot['id'])
            self.world.walls = []
            self.assertEqual(self.player['stealth'], 150)
            result = self.world.use_power(self.player, 0, self.bot['id'])
            self.assertEqual(result['message'], 'Savage Kill · +50 points')
            self.assertEqual(self.player['assassinations'], 1)
            self.assertEqual(self.player['stealth'], 50)
            self.assertEqual(self.world.public(self.player)['animation']['kind'], 'shoot')
            self.assertEqual(self.world.public(self.bot)['animation']['kind'], 'fall')
            effect, = self.world.visible_effects()
            self.assertEqual((effect['target_x'], effect['target_z']), (34, 16))
            clock.return_value = 1001
            self.assertAlmostEqual(self.world.state(self.player)['powers'][0]['cooldown'], 29.8)

    def test_off_contract_gun_kill_awards_the_assigned_player(self):
        target = dict(id='two', outfit=1, x=7, z=16, angle=0, stride=0, phase=0)
        self.world.initialize(target)
        self.server.players[2] = target
        self.player.update(target_id=target['id'], powers=['gun', None])

        result = self.world.use_power(self.player, 0, self.bot['id'])

        self.assertEqual(result['delta'], -50)
        self.assertEqual(self.world.state(target)['score'], 50)
        self.assertEqual(self.bot['score'], 0)

    def test_public_state_keeps_contracts_private(self):
        public=self.world.public(self.player)
        self.assertNotIn('target_id',public)
        self.assertNotIn('token',public)
        self.assertNotIn('pursuers',public)
        self.assertNotIn('stealth_tier',public)
        state=self.world.state(self.player)
        self.assertEqual(state['target']['id'],'practice-player')
        self.assertEqual(state['score'],0)
        self.assertEqual(state['stealth_tier'], 'stealth')

    def test_pursuers_follow_current_assignments_and_cap_at_three(self):
        self.assertEqual(self.world.state(self.player)['pursuers'], 1)
        for index in range(2, 6):
            other = dict(id=f'player-{index}')
            self.world.initialize(other)
            other['target_id'] = self.player['id']
            self.server.players[index] = other
        self.assertEqual(self.world.state(self.player)['pursuers'], 3)
        for index in range(2, 5):
            self.server.players[index]['target_id'] = None
        self.assertEqual(self.world.state(self.player)['pursuers'], 2)
        del self.server.players[5]
        self.bot['target_id'] = None
        self.assertEqual(self.world.state(self.player)['pursuers'], 0)


if __name__ == '__main__':
    unittest.main()
