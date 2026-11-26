"""Shared crowd, contracts, and server-authoritative practice combat."""
from collections import deque
import json
import math
from pathlib import Path
import random
import time

class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


MAP_NAMES = {'testa': 'Testa', 'betrahold': 'Betrahold'}
MAP_FILES = {'testa': 'world.json', 'betrahold': 'world-betrahold.json'}
ASSASSIN_COSTS = (0, 0, 0, 0, 0, 0, 5, 5, 5, 10, 10, 10, 10, 10, 15, 15, 15, 15)  # Roster order in dist/game.js.
OUTFIT_COUNT = len(ASSASSIN_COSTS)

REACH = 2.2
CULT_RADIUS = 8
FIRECRACKER_RADIUS = 4
STUN_DURATION = 4
STUN_TARGET_DELAY = (3, 10)
STEALTH_BASE = 100
STEALTH_MAX = 150
STEALTH_MOVE_TIMEOUT = .5
BLOODY_THRESHOLD = 50
INCOGNITO_THRESHOLD = 125
HIDDEN_GOAL = 200
HIDDEN_AWARD = 50
HIDDEN_RATES = {'savage': 0, 'bloody': 1, 'stealth': 2, 'incognito': 3}
HIDDEN_PURSUER_MULTIPLIERS = (1, 1, 1.5, 2)
KILL_AWARDS = {
    'savage': ('Savage Kill', 50),
    'bloody': ('Bloody Kill', 100),
    'stealth': ('Stealth Kill', 150),
    'incognito': ('Incognito Kill', 200),
}
LOUD_POWERS = {'firecrackers', 'gun', 'smoke'}
POWERS = {
    'smoke': dict(name='Smoke Cloud', duration=4, cooldown=15, cost=0, description='Create a large plume of smoke.'),
    'disguise': dict(name='Disguise', duration=15, cooldown=15, cost=0, target='character', range=12,
                     description='Copy the targeted character’s appearance.'),
    'firecrackers': dict(name='Firecrackers', duration=4, cooldown=25, cost=5,
                         description=f'Send citizens within {FIRECRACKER_RADIUS} units sprinting in random directions.'),
    'invisibility': dict(name='Invisibility Potion', duration=6, cooldown=20, cost=5,
                         description='Vanish and hold full Incognito stealth for 6 seconds. Actions and other powers are blocked until you reappear.'),
    'cult': dict(name='Cult', duration=0, cooldown=25, cost=10, description='Give nearby citizens your current appearance for the rest of the match.'),
    'sprint': dict(name='Sprint Boost', duration=10, cooldown=15, cost=2, multiplier=2, description='Double your movement speed.'),
    'decoy': dict(name='Decoy', duration=5, cooldown=20, cost=5, target='npc', range=12,
                  description='Send one citizen sprinting in a random direction.'),
    'mute': dict(name='Mute', duration=6, cooldown=15, cost=10, target='character', range=12,
                 description='Disable the targeted player’s powers and contract compass.'),
    'gun': dict(name='Gun', duration=.8, cooldown=30, cost=5, target='character', range=30,
                description='Eliminate a character from range with a visible shot.'),
}


class Combat:
    def __init__(self, server, map_id='testa'):
        self.server = server
        world = json.loads((Path(__file__).parent / MAP_FILES[map_id]).read_text())
        self.limits = world['limits']
        self.player_spawns = world['playerSpawns']
        self.walls = world['walls']
        self.haybales = {b['id']: b for b in world.get('haybales', [])}
        self.benches = {b['id']: b for b in world.get('benches', [])}
        self.last = time.monotonic()
        self.zones = {g['number']: g for g in world['groups'] if g['zone']}
        self.walking_groups = {}
        self.next_group = max(self.zones)+1
        self.walkable = {(x,z) for x in range(self.limits['x0'], self.limits['x1'])
                         for z in range(self.limits['z0'], self.limits['z1'])
                         if not self.blocked(x+.5, z+.5, .30)}
        self.npcs = {}
        pool = sorted({player['outfit'] for player in server.players.values()})
        if len(pool) < 6:
            pool.extend(random.sample([outfit for outfit in range(OUTFIT_COUNT)
                                       if outfit not in pool], 6-len(pool)))
        # Full sets give every model identical crowd cover. Shuffle appearances
        # so no model is tied to a particular area.
        outfits = pool * (len(world['npcs']) // len(pool))
        random.shuffle(outfits)
        for i, (actor, outfit) in enumerate(zip(world['npcs'], outfits)):
            actor.update(id=f'npc-{i}', kind='npc', outfit=outfit, score=0, target_id=None,
                         dead_until=0, stunned_until=0, revision=0, route=[])
            self.npcs[actor['id']] = actor
        self.bot = dict(id='practice-player', kind='bot', outfit=3, **world['rivalSpawn'],
                        stride=0, phase=0, score=0, target_id=None,
                        dead_until=0, stunned_until=0, revision=0, route=[], attack_at=0)
        if map_id != 'testa':
            self.bot['spawn'] = self.bot['x'], self.bot['z']
        self.roads = self.build_roads(world['landmarks'])
        profiles = (['group_walk', 'activity', 'loner', 'balanced'] * ((len(self.npcs)+3)//4))[:len(self.npcs)]
        random.shuffle(profiles)
        for actor, profile in zip(self.npcs.values(), profiles):
            actor.update(profile=profile, spawn=(actor['x'], actor['z']))
            self.change_state(actor, self.last)
        self.effects = []
        self.kill_feed = deque(maxlen=5)
        self.kill_sequence = 0

    @staticmethod
    def feed_name(actor):
        if actor['kind'] == 'player':
            return actor.get('username', actor['id'])
        return 'Scribe practice rival' if actor['kind'] == 'bot' else 'Citizen'

    def recent_kills(self):
        now = time.monotonic()
        return [{key: value for key, value in entry.items() if key != 'created'}
                for entry in self.kill_feed if now-entry['created'] < 10]

    @property
    def competitive(self):
        return getattr(self.server, 'game_mode', 'test') == 'competitive'

    def actors(self):
        return list(self.server.players.values()) + list(self.npcs.values()) + ([] if self.competitive else [self.bot])

    def pursuer_count(self, player):
        count = sum(actor['target_id'] == player['id'] for actor in self.server.players.values())
        return min(3, count + (not self.competitive and self.bot['target_id'] == player['id']))

    def inside(self, x, z, radius):
        limits = self.limits
        return (limits['x0']+radius <= x <= limits['x1']-radius
                and limits['z0']+radius <= z <= limits['z1']-radius)

    def blocked(self, x, z, radius=.22, height=0):
        return not self.inside(x, z, radius) or any(
            w['height'] >= height and w['x0']-radius < x < w['x1']+radius
            and w['z0']-radius < z < w['z1']+radius for w in self.walls)

    def sight(self, a, b, radius=.03, height=1.2):
        distance = math.hypot(a['x']-b['x'], a['z']-b['z'])
        steps = max(1, math.ceil(distance/.15))
        return all(not self.blocked(a['x']+(b['x']-a['x'])*i/steps,
                                    a['z']+(b['z']-a['z'])*i/steps, radius, height)
                   for i in range(steps+1))

    @staticmethod
    def active(actor, now):
        return actor['dead_until'] <= now and actor['stunned_until'] <= now

    def initialize(self, player):
        player.update(kind='player', score=0, assassinations=0,
                      target_id=None if self.competitive else self.bot['id'], target_reassignment=None, dead_until=0,
                      stunned_until=0, revision=0, cooldown=0, busy_until=0, muted_until=0, power_timers={},
                      haybale=None, bench=None, bench_seat=None, activity=None, stealth=STEALTH_BASE, stealth_at=time.monotonic(),
                      hidden_charge=0, hidden_awarded_until=0,
                      sprinting=False, blend_group=None, crowd_group=None, crowd_slot=None, notice='' if self.competitive else 'Contract assigned: The Scribe · Practice rival')

    def social_activity(self, player, number):
        group = self.zones.get(number) if type(number) is int else None
        if not group or player['stride'] > .3:
            return None
        zone = group['zone']
        slot = player.get('crowd_slot')
        if player.get('crowd_group') == number and type(slot) is int and 0 <= slot < len(zone['seats']):
            seat = zone['seats'][slot]
            if math.hypot(player['x']-seat['x'], player['z']-seat['z']) <= .35:
                return zone['type']
        return None

    def reserve_player_slot(self, player, number, slot):
        player.update(crowd_group=None, crowd_slot=None)
        if type(number) is not int:
            return
        group = self.zones.get(number) or self.walking_groups.get(number)
        if not group or math.hypot(player['x']-group['x'], player['z']-group['z']) > 5.5:
            return
        seats = group['zone']['seats'] if number in self.zones else None
        free = set(range(len(seats) if seats else 5))-self.occupied_slots(number)
        if slot is None and free:
            slot = min(free, key=lambda i: math.hypot(player['x']-seats[i]['x'],
                       player['z']-seats[i]['z'])) if seats else min(free)
        if type(slot) is int and slot in free:
            player.update(crowd_group=number, crowd_slot=slot)

    def in_walking_group(self, player, number, now):
        group = self.walking_groups.get(number) if type(number) is int else None
        if not group or player.get('sprinting') or player['stride'] > 1.1:
            return False
        members = [a for a in self.actors() if a is not player and a.get('crowd_group') == number]
        members = [actor for actor in members if not actor.get('bench') and self.active(actor, now) and actor['stride'] <= 1.1
                   and now >= max(actor.get('panic_until', 0), actor.get('decoy_until', 0))]
        if not members:
            return False
        center = dict(x=sum(a['x'] for a in members)/len(members),
                      z=sum(a['z'] for a in members)/len(members))
        return (math.hypot(player['x']-center['x'], player['z']-center['z']) <= 2.35
                and sum(math.hypot(player['x']-a['x'], player['z']-a['z']) <= 3
                        and self.sight(player, a, .1, 0) for a in members) >= 1)

    @classmethod
    def stealth_interval(cls, value, dt, rate, minimum, maximum):
        end = max(minimum, min(maximum, value + rate*dt))
        low, high = sorted((value, end))
        moving_time = min(dt, (high-low)/abs(rate))
        # Each crossed threshold adds one charge per second spent above it while moving.
        charge = sum(max(0, high-max(low, threshold))/abs(rate)
                     for threshold in (BLOODY_THRESHOLD, STEALTH_BASE, INCOGNITO_THRESHOLD))
        return end, charge + (dt-moving_time)*HIDDEN_RATES[cls.stealth_tier(end)]

    @classmethod
    def change_stealth(cls, value, dt, *, sprinting=False, blending=False):
        if blending:
            return cls.stealth_interval(value, dt, 10, 0, STEALTH_MAX)
        charge = 0
        if value > STEALTH_BASE:
            bleed = 40 if sprinting else 15
            overflow_time = min(dt, (value-STEALTH_BASE)/bleed)
            value, charge = cls.stealth_interval(value, overflow_time, -bleed, STEALTH_BASE, STEALTH_MAX)
            dt -= overflow_time
            if dt <= 0:
                return value, charge
        rate = -25 if sprinting else 5
        value, base_charge = cls.stealth_interval(value, dt, rate, 0, STEALTH_BASE)
        return value, charge + base_charge

    def update_stealth(self, player, now):
        start = player['stealth_at']
        if now <= start:
            return
        player['stealth_at'] = now
        if player['dead_until'] > now:
            return
        start = max(start, player['dead_until'])
        invisible_end = player['power_timers'].get('invisibility', (0, 0))[0]
        protected_time = max(0, min(now, invisible_end)-start)
        charge = protected_time * HIDDEN_RATES['incognito']
        if protected_time or self.power_active(player, 'invisibility', now):
            player['stealth'] = STEALTH_MAX
            start += protected_time
        movement_time = now-start if player.get('haybale') or player.get('bench') else max(0, min(now, player.get('updated', start) + STEALTH_MOVE_TIMEOUT)-start)
        value, movement_charge = self.change_stealth(
            player['stealth'], movement_time, sprinting=player['sprinting'],
            blending=bool(player.get('bench')) or bool(player.get('haybale')) or bool(player['activity']) or self.in_walking_group(player, player['blend_group'], now))
        player['stealth'], idle_charge = self.change_stealth(value, max(0, now-start-movement_time))
        multiplier = HIDDEN_PURSUER_MULTIPLIERS[self.pursuer_count(player)]
        total = player['hidden_charge'] + (charge + movement_charge + idle_charge)*multiplier
        awards = int((total + 1e-9) // HIDDEN_GOAL)
        player['hidden_charge'] = max(0, total - awards*HIDDEN_GOAL)
        if awards:
            player['score'] += awards*HIDDEN_AWARD
            player['hidden_awarded_until'] = now + 2.5

    @staticmethod
    def stealth_tier(stealth):
        if stealth > INCOGNITO_THRESHOLD:
            return 'incognito'
        if stealth >= STEALTH_BASE:
            return 'stealth'
        if stealth > BLOODY_THRESHOLD:
            return 'bloody'
        return 'savage'

    @staticmethod
    def power_active(actor, power, now):
        return actor.get('power_timers', {}).get(power, (0, 0))[0] > now

    def appearance(self, actor, now):
        return actor['disguise_outfit'] if self.power_active(actor, 'disguise', now) else actor['outfit']

    def movement_budget(self, player, now):
        start = max(now-1, player['updated'])
        end, _ = player['power_timers'].get('sprint', (0, 0))
        # Allow time for the final boosted movement packet to reach the server.
        spec = POWERS['sprint']
        boost_start = end - spec['duration']
        boosted = max(0, min(now, end+.25)-max(start, boost_start)) if end else 0
        return 5.6 * (now-start + boosted*(spec['multiplier']-1)) + .35

    def visible_target(self, player, victim_id, now):
        victim = next((actor for actor in self.actors() if actor['id'] == victim_id), None)
        if (not victim or victim is player or victim['dead_until'] > now
                or victim.get('haybale') or self.power_active(victim, 'invisibility', now)):
            raise APIError(409, 'That character is unavailable.')
        return victim

    def require_reach(self, player, victim, reach):
        if math.hypot(victim['x']-player['x'], victim['z']-player['z']) > reach or not self.sight(player, victim):
            raise APIError(409, 'Move closer with a clear line of sight.')

    def use_power(self, player, slot, victim_id=None):
        if type(slot) is not int or not 0 <= slot < len(player['powers']) or not player['powers'][slot]:
            raise APIError(400, 'Choose an equipped power.')
        now = time.monotonic()
        if not self.active(player, now) or now < player.get('busy_until', 0):
            raise APIError(409, 'Wait until you can act again.')
        if self.power_active(player, 'invisibility', now):
            raise APIError(409, 'You cannot act while invisible.')
        if player.get('haybale') or player.get('bench'):
            raise APIError(409, 'Leave the bench or hay bale before using items.')
        if now < player['muted_until']:
            raise APIError(409, 'You are muted and cannot use powers.')
        power = player['powers'][slot]
        timers = player['power_timers']
        if now < timers.get(power, (0, 0))[1]:
            raise APIError(409, 'That power is still recharging or active.')

        spec = POWERS[power]
        end = now + spec['duration']
        target = None
        result = {'ok': True}
        if 'target' in spec:
            target = self.visible_target(player, victim_id, now)
            if spec['target'] == 'npc' and (target['kind'] != 'npc' or not self.active(target, now)):
                raise APIError(409, 'Aim at an active citizen to use Decoy.')
            self.require_reach(player, target, spec['range'])

        if power in LOUD_POWERS:
            self.update_stealth(player, now)
            player.update(stealth=max(0, player['stealth']-STEALTH_BASE), activity=None, blend_group=None, crowd_group=None, crowd_slot=None)

        if power == 'invisibility':
            self.update_stealth(player, now)
            player.update(stealth=STEALTH_MAX, stealth_at=now, activity=None, blend_group=None, crowd_group=None, crowd_slot=None,
                          invisibility_end_effect=end)
        elif power == 'disguise':
            player['disguise_outfit'] = self.appearance(target, now)
        elif power in ('firecrackers', 'cult'):
            outfit = self.appearance(player, now)
            radius = CULT_RADIUS if power == 'cult' else FIRECRACKER_RADIUS
            for npc in self.npcs.values():
                if math.hypot(npc['x'] - player['x'], npc['z'] - player['z']) > radius:
                    continue
                if power == 'cult':
                    npc['outfit'] = outfit
                else:
                    npc.update(panic_until=end, panic_turn=0)
        elif power == 'decoy':
            target.update(decoy_until=end, decoy_angle=random.uniform(0, math.tau))
        elif power == 'mute' and target['kind'] == 'player':
            target['muted_until'] = max(target['muted_until'], end)
        elif power == 'gun':
            result = self.hit(player, target, 'kill', now, ranged=True)

        timers[power] = (end, end + spec['cooldown'])
        visual_duration = spec['duration'] if power in ('smoke', 'firecrackers', 'gun') else .8
        origin = target if power in ('decoy', 'mute') else player
        effect = dict(power=power, x=origin['x'], z=origin['z'], started=now, duration=visual_duration)
        if power == 'gun':
            effect.update(target_x=target['x'], target_z=target['z'])
        self.effects.append(effect)
        return result

    def visible_effects(self):
        now = time.monotonic()
        self.effects = [effect for effect in self.effects if now < effect['started'] + effect['duration']]
        return [dict({k: v for k, v in effect.items() if k != 'started'}, age=now-effect['started'])
                for effect in self.effects]

    def sprint(self, actor, now, dt):
        decoy = now < actor.get('decoy_until', 0)
        if decoy:
            angle = actor['decoy_angle']
        else:
            if now >= actor['panic_turn']:
                actor.update(panic_angle=random.uniform(0, math.tau), panic_turn=now + random.uniform(.3, .7))
            angle = actor['panic_angle']
        goal = (actor['x'] + math.sin(angle)*2, actor['z'] + math.cos(angle)*2)
        if self.walk(actor, goal, min(dt, .1), 4.6):
            if decoy:
                actor['decoy_angle'] = random.uniform(0, math.tau)
            else:
                actor['panic_turn'] = 0
        else:
            actor['stride'] = 1.42
            actor['phase'] += dt*5
        actor['activity'] = None

    def path(self, actor, goal):
        start = (math.floor(actor['x']), math.floor(actor['z']))
        finish = (math.floor(goal[0]), math.floor(goal[1]))
        queue, prev = deque([start]), {start: None}
        while queue and finish not in prev:
            x, z = queue.popleft()
            for cell in ((x-1,z),(x+1,z),(x,z-1),(x,z+1)):
                if cell not in prev and cell in self.walkable:
                    prev[cell] = (x,z)
                    queue.append(cell)
        if finish not in prev:
            return []
        route, cell = [], finish
        while cell != start:
            route.append((cell[0]+.5, cell[1]+.5))
            cell = prev[cell]
        return route[::-1]

    def walk(self, actor, goal, dt, speed):
        dx, dz = goal[0]-actor['x'], goal[1]-actor['z']
        d = math.hypot(dx,dz)
        step = min(d, dt*speed)
        if d > .03:
            nx, nz = actor['x']+dx*step/d, actor['z']+dz*step/d
            if not self.blocked(nx,nz):
                actor.update(x=nx,z=nz,angle=math.atan2(-dx,-dz),stride=min(1,speed),phase=actor['phase']+step*7)
                return d <= step+.05
        actor['stride'] = 0
        return True

    def build_roads(self, landmarks):
        # Join nearby landmarks along navigable cells. Shared cells are junctions.
        roads = {}
        points = [self.nearest_cell(x, z, self.walkable) for x, z in landmarks]
        for i, point in enumerate(points):
            nearby = sorted(set(points)-{point}, key=lambda p: math.dist(point, p))[:3]
            for end in nearby + [points[i-1]]:
                previous = point
                for x, z in self.path(dict(x=point[0]+.5, z=point[1]+.5), end):
                    cell = math.floor(x), math.floor(z)
                    roads.setdefault(previous, set()).add(cell)
                    roads.setdefault(cell, set()).add(previous)
                    previous = cell
        return roads

    @staticmethod
    def nearest_cell(x, z, cells):
        return min(cells, key=lambda cell: (cell[0]+.5-x)**2 + (cell[1]+.5-z)**2)

    def occupied_slots(self, number, exclude=None):
        return {a['crowd_slot'] for a in self.actors() if a is not exclude
                and a.get('crowd_group') == number and a.get('crowd_slot') is not None}

    def change_state(self, actor, now):
        if actor.get('bench'):
            self.leave_bench(actor, now)
        actor.pop('bench_goal', None)
        options = [s for s in ('group_walk', 'activity', 'loner') if s != actor.get('natural_state')]
        profile = actor['profile']
        state = random.choices(options, weights=[3 if s == profile else 1 for s in options])[0]
        factor = 1 if profile == 'balanced' else (1.2 if profile == state else .5)
        # Sample inside the adjusted range, avoiding synchronized clamped endpoints.
        duration = random.triangular(max(15, 15*factor), min(90, 90*factor),
                                     min(90, 52.5*factor))
        actor.update(natural_state=state, change_at=now+duration, activity=None, stride=0,
                     crowd_group=None, crowd_slot=None, route=[], repath=0, wander_goal=None)
        if state == 'group_walk':
            nearby = sorted(self.walking_groups.values(),
                            key=lambda g: math.hypot(actor['x']-g['x'], actor['z']-g['z']))
            for group in nearby:
                free = set(range(5))-self.occupied_slots(group['number'])
                if free and math.hypot(actor['x']-group['x'], actor['z']-group['z']) <= 10:
                    break
            else:
                number = self.next_group
                self.next_group += 1
                cell = self.nearest_cell(actor['x'], actor['z'], self.roads)
                goal = cell[0]+.5, cell[1]+.5
                group = dict(number=number, x=actor['x'], z=actor['z'], angle=actor['angle'],
                             pace=random.uniform(.8, 1), cell=cell, previous=None,
                             path=self.path(actor, goal) or [goal], stride=0, phase=0)
                self.walking_groups[number] = group
                free = {0}
            actor.update(crowd_group=group['number'], crowd_slot=min(free))

    def choose_activity(self, actor):
        places = []
        for number, group in self.zones.items():
            occupied = self.occupied_slots(number)
            for index, seat in enumerate(group['zone']['seats']):
                if index not in occupied:
                    places.append((seat, number, index))
        for bench in self.benches.values():
            for index, seat in self.free_bench_seats(bench):
                places.append((seat, bench['id'], index))
        if places:
            _, number, index = min(places, key=lambda p: math.hypot(
                p[0]['x']-actor['x'], p[0]['z']-actor['z']))
            if number in self.zones:
                actor.update(crowd_group=number, crowd_slot=index)
            else:
                actor['bench_goal'] = number, index

    def advance_crowd(self, now, dt):
        for number, group in list(self.walking_groups.items()):
            if not self.occupied_slots(number):
                del self.walking_groups[number]
                continue
            if not group['path']:
                cell = group['cell']
                choices = self.roads[cell]-{group['previous']}
                next_cell = random.choice(sorted(choices or self.roads[cell]))
                group.update(previous=cell, cell=next_cell,
                             path=[(next_cell[0]+.5, next_cell[1]+.5)])
            if self.walk(group, group['path'][0], dt, group['pace']):
                group['path'].pop(0)
        for actor in self.npcs.values():
            if not self.active(actor, now) or now < actor.get('busy_until', 0):
                actor['stride'] = 0
                continue
            if now < max(actor.get('panic_until', 0), actor.get('decoy_until', 0)):
                if actor.get('bench'):
                    self.leave_bench(actor, now, animate=False)
                actor['route'].clear()
                self.sprint(actor, now, dt)
                continue
            if now >= actor['change_at']:
                self.change_state(actor, now)
                if now < actor.get('busy_until', 0):
                    continue
            state = actor['natural_state']
            if state == 'group_walk':
                group = self.walking_groups[actor['crowd_group']]
                slot = actor['crowd_slot']
                angle = group['angle']+(slot-1)*math.pi/2
                radius = 1.15 if slot else 0
                goal = group['x']+math.sin(angle)*radius, group['z']+math.cos(angle)*radius
                if self.blocked(*goal, .32):
                    goal = group['x'], group['z']
                self.walk_zone_route(actor, goal, now, dt, 1.65)
            elif state == 'activity':
                if actor.get('bench'):
                    continue
                if actor['crowd_group'] is None and not actor.get('bench_goal'):
                    self.choose_activity(actor)
                if actor.get('bench_goal'):
                    number, index = actor['bench_goal']
                    seat = self.benches[number]['seats'][index]
                    goal = self.bench_exit(seat)
                    if self.walk_zone_route(actor, goal, now, dt):
                        actor.pop('bench_goal')
                        self.sit_bench(actor, number, now, index)
                elif actor['crowd_group'] is not None:
                    zone = self.zones[actor['crowd_group']]['zone']
                    seat = zone['seats'][actor['crowd_slot']]
                    if self.walk_zone_route(actor, (seat['x'], seat['z']), now, dt):
                        actor.update(activity=zone['type'], angle=seat['angle'])
            else:
                if actor['wander_goal'] is None:
                    angle, length = random.uniform(0, math.tau), random.uniform(2, 14)
                    actor['wander_goal'] = (actor['x']+math.sin(angle)*length,
                                            actor['z']+math.cos(angle)*length)
                if self.walk(actor, actor['wander_goal'], dt, 1.05):
                    actor['wander_goal'] = None

    def walk_zone_route(self, actor, goal, now, dt, speed=.95):
        if math.hypot(actor['x']-goal[0], actor['z']-goal[1]) <= .06:
            actor['stride'] = 0
            actor['route'].clear()
            return True
        if not actor['route'] and now >= actor.get('repath', 0):
            actor['repath'] = now+.5
            if not self.sight(actor, {'x': goal[0], 'z': goal[1]}, .22, 0):
                actor['route'] = self.path(actor, goal)
        if actor['route']:
            if self.walk(actor, actor['route'][0], dt, speed):
                actor['route'].pop(0)
        else:
            self.walk(actor, goal, dt, speed)
        return False

    def assign(self, actor, now, *, exclude=None):
        pool = list(self.server.players.values()) if self.competitive else self.actors()
        eligible = [a for a in pool if a is not actor and a['dead_until'] <= now]
        candidates = [a for a in eligible if a['id'] != exclude]
        # In a duel the previous opponent is the only possible contract.
        if self.competitive and len(pool) == 2 and not candidates:
            candidates = eligible
        if self.competitive and candidates:
            # Tied scores have equal odds. Higher ranks attract more hunters;
            # independent draws allow multiple hunters and unassigned prey.
            scores = sorted({p['score'] for p in pool})
            weights = [(scores.index(p['score']) + 1) ** 2 for p in candidates]
            actor['target_id'] = random.choices(candidates, weights=weights, k=1)[0]['id']
        else:
            actor['target_id'] = random.choice(candidates)['id'] if candidates else None

    def delay_target(self, actor, now, previous):
        actor.update(target_id=None,
                     target_reassignment=(now + random.uniform(3, 10), previous))

    def advance(self):
        now = time.monotonic()
        dt = min(.25, now-self.last)
        if dt < .04:
            return
        self.last = now
        actors = self.actors()
        by_id = {a['id']: a for a in actors}
        for actor in actors:
            if actor['kind'] == 'player':
                self.update_stealth(actor, now)
                ended = actor.get('invisibility_end_effect')
                if ended is not None and now >= ended:
                    self.effects.append(dict(power='invisibility', phase='end', x=actor['x'], z=actor['z'],
                                             started=ended, duration=.8))
                    actor.pop('invisibility_end_effect')
            if actor['dead_until'] and actor['dead_until'] <= now:
                first_spawn = self.player_spawns[0]
                x, z = actor.get('spawn', (first_spawn['x'], first_spawn['z']))
                actor.pop('animation', None)
                actor.update(dead_until=0, stunned_until=0, x=x, z=z, stride=0, activity=None,
                             revision=actor['revision']+1, route=[])
            if actor['kind'] in ('player','bot'):
                reassignment = actor.get('target_reassignment')
                if reassignment is not None:
                    ready_at, previous_target = reassignment
                    if now >= ready_at:
                        self.assign(actor, now, exclude=previous_target)
                        if actor['target_id'] is not None:
                            actor['target_reassignment'] = None
                    continue
                target = by_id.get(actor['target_id'])
                if not target or target['dead_until'] > now:
                    self.assign(actor, now)
        self.advance_crowd(now, dt)
        if self.competitive:
            return
        bot = self.bot
        humans = [a for a in self.server.players.values()
                  if self.active(a, now) and not a.get('haybale') and not self.power_active(a, 'invisibility', now)]
        if humans and self.active(bot,now) and now >= bot.get('busy_until',0):
            victim = min(humans, key=lambda p: math.hypot(p['x']-bot['x'],p['z']-bot['z']))
            bot['target_id'] = victim['id']
            distance = math.hypot(victim['x']-bot['x'],victim['z']-bot['z'])
            if distance > 1.7 or not self.sight(bot,victim):
                bot['attack_at'] = 0
                if not bot['route'] or now >= bot.get('repath',0):
                    bot['route'] = self.path(bot,(victim['x'],victim['z']))
                    bot['repath'] = now+1
                if bot['route'] and self.walk(bot,bot['route'][0],dt,1.25):
                    bot['route'].pop(0)
            else:
                bot['stride'] = 0
                if not bot['attack_at']:
                    bot['attack_at'] = max(now+3,bot.get('cooldown',0))
                if now >= bot['attack_at'] and self.sight(bot,victim):
                    self.hit(bot,victim,'kill',now)
                    bot['attack_at'] = 0
                    bot['cooldown'] = now+10
        else:
            bot.update(stride=0,attack_at=0)

    @staticmethod
    def bench_exit(seat):
        angle = seat['angle']
        return seat['x']-math.sin(angle)*.99, seat['z']-math.cos(angle)*.99

    def free_bench_seats(self, bench):
        occupied = {(a.get('bench'), a.get('bench_seat')) for a in self.actors() if a.get('bench')}
        occupied.update((a['bench_goal'][0], a['bench_goal'][1]) for a in self.npcs.values() if a.get('bench_goal'))
        return [(i, seat) for i, seat in enumerate(bench['seats']) if (bench['id'], i) not in occupied]

    def sit_bench(self, actor, bench_id, now, seat_index=None):
        if actor.get('haybale') or actor.get('bench'):
            raise APIError(409, 'Leave your current hiding place first.')
        bench = self.benches.get(bench_id)
        if not bench:
            raise APIError(400, 'Choose a bench.')
        seats = [(i, s) for i, s in self.free_bench_seats(bench)
                 if seat_index is None or i == seat_index]
        seats = [(i, s) for i, s in seats if math.hypot(actor['x']-s['x'], actor['z']-s['z']) <= REACH
                 and self.sight(actor, s)]
        if not seats:
            raise APIError(409, 'Move closer to an available bench seat.')
        index, seat = min(seats, key=lambda item: math.hypot(actor['x']-item[1]['x'], actor['z']-item[1]['z']))
        if actor['kind'] == 'player':
            self.update_stealth(actor, now)
        origin = actor['x'], actor['z']
        actor.update(bench=bench_id, bench_seat=index, x=seat['x'], z=seat['z'], angle=seat['angle'],
                     stride=0, activity='bench', sprinting=False, blend_group=None, crowd_group=None, crowd_slot=None,
                     revision=actor['revision']+1, busy_until=now+.7,
                     animation=dict(kind='bench-sit', started=now, duration=.7,
                                    x=origin[0], z=origin[1], angle=seat['angle']))

    def leave_bench(self, actor, now, *, animate=True):
        bench = self.benches.get(actor.get('bench'))
        if not bench:
            return
        seat = bench['seats'][actor['bench_seat']]
        x, z = self.bench_exit(seat)
        if self.blocked(x, z, .32):
            raise APIError(409, 'The bench exit is blocked.')
        if actor['kind'] == 'player':
            self.update_stealth(actor, now)
        actor.update(bench=None, bench_seat=None, activity=None, x=x, z=z, stride=0,
                     revision=actor['revision']+1)
        if animate:
            actor.update(busy_until=now+.7, animation=dict(kind='bench-rise', started=now,
                         duration=.7, x=seat['x'], z=seat['z'], angle=seat['angle']))


    def hay_puff(self, bale, now):
        self.effects.append(dict(power='hay', x=bale['x'], z=bale['z'], started=now, duration=.8))

    def leave_hay(self, player, now, *, shoved=False, animate=True):
        bale = self.haybales.get(player.get('haybale'))
        if not bale:
            return
        # Find a clear landing place around the bale, including nearby scenery.
        landing = next(((bale['x']+math.sin(i*math.tau/16)*1.9,
                         bale['z']+math.cos(i*math.tau/16)*1.9) for i in range(16)
                        if not self.blocked(bale['x']+math.sin(i*math.tau/16)*1.9,
                                            bale['z']+math.cos(i*math.tau/16)*1.9, .32)), None)
        if landing is None:
            raise APIError(409, 'The hay bale exit is blocked.')
        self.update_stealth(player, now)
        player.update(haybale=None, x=landing[0], z=landing[1], stride=0,
                      revision=player['revision']+1, activity=None, sprinting=False, blend_group=None, crowd_group=None, crowd_slot=None)
        self.hay_puff(bale, now)
        if animate:
            player.update(busy_until=now+.65,
                          animation=dict(kind='hay-shove' if shoved else 'hay-exit', started=now,
                                         duration=.65, x=bale['x'], z=bale['z'], angle=player['angle']))

    def enter_hay(self, player, bale_id, now):
        bale = self.haybales.get(bale_id)
        if not bale:
            raise APIError(400, 'Choose a hay bale.')
        self.require_reach(player, bale, REACH)
        occupant = next((a for a in self.server.players.values() if a.get('haybale') == bale_id), None)
        if occupant:
            self.leave_hay(occupant, now, shoved=True)
            occupant['notice'] = 'Shoved out of the hay bale!'
        self.update_stealth(player, now)
        origin = player['x'], player['z']
        player.update(haybale=bale_id, x=bale['x'], z=bale['z'], stride=0, sprinting=False,
                      activity=None, blend_group=None, crowd_group=None, crowd_slot=None, revision=player['revision']+1, busy_until=now+.65,
                      animation=dict(kind='hay-enter', started=now, duration=.65,
                                     x=origin[0], z=origin[1], angle=player['angle']))
        self.hay_puff(bale, now)

    def hit(self, attacker, victim, action, now, *, ranged=False):
        if self.power_active(attacker, 'invisibility', now):
            raise APIError(409, 'You cannot act while invisible.')
        bench_attack = bool(attacker.get('bench'))
        bench_victim = bool(victim.get('bench'))
        bench_attack_origin = (attacker['x'], attacker['z'])
        bench_origin = (victim['x'], victim['z'])
        ambush = bool(attacker.get('haybale'))
        search = bool(victim.get('haybale'))
        for actor in (attacker, victim):
            actor.pop('bench_goal', None)
            if actor.get('bench'):
                self.leave_bench(actor, now, animate=False)
            if actor.get('haybale'):
                self.leave_hay(actor, now, animate=False)
        heading = math.atan2(attacker['x']-victim['x'], attacker['z']-victim['z'])
        for actor in (attacker, victim):
            if actor['kind'] == 'player':
                self.update_stealth(actor, now)
                actor.update(sprinting=False, blend_group=None, crowd_group=None, crowd_slot=None)
        attacker['activity'] = victim['activity'] = None
        if action == 'kill':
            duration = POWERS['gun']['duration'] if ranged else .85
            attacker.update(angle=heading, stride=0, busy_until=now+duration,
                            animation=dict(kind='shoot' if ranged else 'eliminate', started=now, duration=duration,
                                           x=attacker['x'], z=attacker['z'], angle=heading))
            victim['animation'] = dict(kind='fall', started=now, duration=1.15,
                                       x=victim['x'], z=victim['z'], angle=heading)
            victim.update(dead_until=now+6, stride=0, revision=victim['revision']+1,
                          notice='Eliminated. Respawning in 6 seconds.')
            on_contract = attacker['target_id'] == victim['id']
            tier = self.stealth_tier(attacker['stealth']) if attacker['kind'] == 'player' else None
            if tier and on_contract:
                message, delta = KILL_AWARDS[tier]
            elif on_contract:
                message, delta = 'Target eliminated', 100
            else:
                message, delta = 'Wrong character eliminated', -50
            self.kill_sequence += 1
            self.kill_feed.append(dict(id=self.kill_sequence, created=now,
                                       attacker=self.feed_name(attacker), target=self.feed_name(victim),
                                       tier=tier or 'savage', method='gun' if ranged else 'melee'))
            if on_contract:
                if attacker['kind'] == 'player':
                    attacker['assassinations'] += 1
                if self.competitive and attacker['kind'] == 'player':
                    self.delay_target(attacker, now, victim['id'])
                else:
                    self.assign(attacker, now)
            elif attacker['kind'] == 'player' and attacker['target_id'] is not None:
                previous_target = attacker['target_id']
                self.assign(attacker, now, exclude=previous_target)
                if attacker['target_id'] is None:
                    attacker['target_reassignment'] = (now, previous_target)
        else:
            delta = 0 if victim['target_id'] == attacker['id'] else -10
            attacker['animation'] = dict(kind='stun-strike', started=now, duration=.55,
                                         x=attacker['x'], z=attacker['z'], angle=heading)
            victim.update(stunned_until=now+STUN_DURATION, stride=0, revision=victim['revision']+1,
                          notice='',
                          animation=dict(kind='stagger', started=now, duration=STUN_DURATION,
                                         x=victim['x'], z=victim['z'], angle=victim['angle']))
            if victim['kind'] == 'player':
                pending = victim['target_reassignment']
                previous_target = pending[1] if pending else victim['target_id']
                if self.competitive:
                    victim['target_reassignment'] = None
                    self.assign(victim, now, exclude=previous_target)
                else:
                    ready_at = now + random.uniform(*STUN_TARGET_DELAY)
                    victim.update(target_id=None, target_reassignment=(ready_at, previous_target))
            message = 'Pursuer stunned' if delta == 0 else 'Character stunned'
        if not ranged and (ambush or search):
            attacker['animation']['kind'] = ('hay-ambush-' if ambush else 'hay-search-') + action
            attacker['busy_until'] = now + attacker['animation']['duration']
        if not ranged and (bench_attack or bench_victim):
            attacker['animation']['kind'] = ('bench-attack-' if bench_attack else 'bench-target-') + action
            if bench_attack:
                attacker['animation'].update(x=bench_attack_origin[0], z=bench_attack_origin[1])
            attacker['busy_until'] = now + attacker['animation']['duration']
        if bench_victim:
            victim['animation'].update(kind='bench-fall' if action == 'kill' else 'bench-stagger',
                                       x=bench_origin[0], z=bench_origin[1])
        attacker['score'] += delta
        attacker['notice'] = f'{message} · {delta:+d} points'
        attacker['cooldown'] = now+1
        return dict(score=attacker['score'], delta=delta, message=attacker['notice'])

    def action(self, player, data):
        now = time.monotonic()
        if data.get('action') not in ('kill','stun','hay','bench'):
            raise APIError(400,'Choose eliminate or stun.')
        if self.power_active(player, 'invisibility', now):
            raise APIError(409, 'You cannot act while invisible.')
        if not self.active(player,now) or now < max(player.get('cooldown',0), player.get('busy_until',0)):
            raise APIError(409,'Wait until you can act again.')
        if data['action'] == 'bench':
            if player.get('bench'):
                self.leave_bench(player, now)
            else:
                self.sit_bench(player, data.get('victim'), now)
            return dict(ok=True)
        if data['action'] == 'hay':
            if player.get('bench'):
                raise APIError(409, 'Leave the bench first.')
            if player.get('haybale'):
                self.leave_hay(player, now)
            else:
                self.enter_hay(player, data.get('victim'), now)
            return dict(ok=True)
        bale = self.haybales.get(data.get('victim'))
        if bale:
            self.require_reach(player, bale, REACH)
            victim = next((a for a in self.server.players.values()
                           if a is not player and a.get('haybale') == bale['id']), None)
            if victim is None:
                raise APIError(409, 'There is nobody in this hay bale.')
        else:
            victim = self.visible_target(player, data.get('victim'), now)
        if not self.active(victim, now):
            raise APIError(409, 'That character is unavailable.')
        self.require_reach(player, victim, REACH)
        return self.hit(player,victim,data['action'],now)

    def public(self, actor, *, contract=False):
        now = time.monotonic()
        result = {k: actor[k] for k in ('id','kind','outfit','x','z','angle','stride','phase','revision')}
        if contract and 'username' in actor:
            result['username'] = actor['username']
        if 'seed' in actor:
            result['seed'] = actor['seed']
        if not contract:
            result['outfit'] = self.appearance(actor, now)
        result['invisible'] = self.power_active(actor, 'invisibility', now)
        result['haybale'] = actor.get('haybale')
        result['crowd_group'] = actor.get('crowd_group')
        result['crowd_slot'] = actor.get('crowd_slot')
        result['bench_goal'] = actor.get('bench_goal')
        result['bench'] = actor.get('bench')
        result['bench_seat'] = actor.get('bench_seat')
        result['boosted'] = self.power_active(actor, 'sprint', now)
        result['busy'] = now < actor.get('busy_until', 0)
        activity = actor.get('activity') if self.active(actor, now) and not result['busy'] else None
        result.update(dead=max(0,actor['dead_until']-now), stunned=max(0,actor['stunned_until']-now),
                      activity=activity, talking=activity == 'conversation')
        animation = actor.get('animation')
        result['animation'] = None
        if animation and (actor['dead_until'] > now or now < animation['started']+animation['duration']):
            result['animation'] = {k: animation[k] for k in ('kind','duration','x','z','angle')}
            result['animation']['age'] = max(0, now-animation['started'])
        return result

    def state(self, player):
        actors = self.actors()
        target = next((a for a in actors if a['id'] == player['target_id']), None)
        now = time.monotonic()
        reassignment = player['target_reassignment']
        powers = []
        for power in player.get('powers', []):
            end, ready = player['power_timers'].get(power, (0, 0))
            powers.append(dict(id=power, active=max(0, end-now), cooldown=max(0, ready-max(now, end))))
        return dict(**self.public(player), score=player['score'], stealth=player['stealth'], powers=powers,
                    stealth_tier=self.stealth_tier(player['stealth']), pursuers=self.pursuer_count(player),
                    hidden_progress=player['hidden_charge']/HIDDEN_GOAL,
                    hidden_awarded=now < player['hidden_awarded_until'],
                    muted=max(0, player['muted_until']-now),
                    target=self.public(target, contract=True) if target else None,
                    target_wait=max(0, reassignment[0]-now) if reassignment else None,
                    notice=player.get('notice',''), warning=bool(not self.competitive and self.bot['target_id']==player['id'] and self.bot['attack_at']
                    and self.active(self.bot,time.monotonic())))
