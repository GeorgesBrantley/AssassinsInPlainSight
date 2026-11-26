"use strict";

const ABILITY_PATHS={
  smoke:'M4 18h14a4 4 0 0 0 0-8 5 5 0 0 0-9-3 4 4 0 0 0-5 6 3 3 0 0 0 0 5Z',
  disguise:'M3 6c3-1 6 0 9 1 3-1 6-2 9-1 0 7-3 13-6 11l-3-2-3 2C6 19 3 13 3 6Zm4 4 3 1m7-1-3 1',
  firecrackers:'m12 3 2 6 7-2-4 6 4 5-7-1-3 5-2-7-6-1 5-4-2-6 6 3',
  invisibility:'M9 3h6m-5 0v6L5 18q-1 3 3 3h8q4 0 3-3l-5-9V3M8 15h8',
  cult:'M9 20v-3a3 3 0 0 1 6 0v3M3 17v-2a3 3 0 0 1 4-3m14 5v-2a3 3 0 0 0-4-3M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0M3 7h3m12 0h3',
  sprint:'m13 3-8 11h6l-1 7 9-12h-7l1-6',
  decoy:'M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0M7 21v-4a5 5 0 0 1 10 0v4M3 4v13m18-13v13',
  mute:'M4 9h4l5-5v16l-5-5H4V9m13 0 5 6m0-6-5 6',
  gun:'M3 7h18v5H10v8H5v-8H3V7m7 5h6v4h-6'
};
function abilityIcon(id) { return `<svg class="ability-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ABILITY_PATHS[id] || ABILITY_PATHS.disguise}"/></svg>`; }


class Multiplayer {
  constructor({onAccount, onJoin, onDisconnect, onPhase, onRoster, onMap, onWorldReset}) {
    this.progression=null;
    this.menuPage="home";
    this.unlockPending=false;
    this.onPhase=onPhase;
    this.onRoster=onRoster;
    this.onMap=onMap;
    this.onWorldReset=onWorldReset;
    this.lobby=null;
    this.lobbyKey="";
    this.lobbyPending=null;
    this.renderedPowers=null;
    this.onAccount=onAccount;
    this.onJoin=onJoin;
    this.onDisconnect=onDisconnect;
    this.remote=new Map();
    this.npcs=new Map();
    this.state=null;
    this.effects=[];
    this.killFeedKey="";
    this.actionPending=false;
    this.pendingPowers=new Set();
    this.id=null;
    this.stream=null;
    this.reconnectTimer=null;
    this.registering=false;
    this.lastSent=0;
    this.sending=false;
    this.joining=false;
    this.$=id=>document.getElementById(id);
    this.$("account-form").addEventListener("submit",event=>{
      event.preventDefault(); this.authenticate();
    });
    this.$("account-toggle").addEventListener("click",()=>{
      this.registering=!this.registering;
      this.$("account-title").textContent=this.registering?"Make yourself known":"Log in to the city";
      this.$("account-submit").firstChild.textContent=this.registering?"Create account ":"Log in ";
      this.$("account-toggle").textContent=this.registering?"Already a citizen? Log in":"New here? Create an account";
      this.$("password").autocomplete=this.registering?"new-password":"current-password";
      this.$("account-message").textContent=this.registering?"Username: 3–20 letters, numbers, or underscores.":"";
    });
    this.$("logout").addEventListener("click",async()=>{
      try {
        await this.request("/api/logout",{});
        this.setAccount(null);
      } catch (error) { this.$("server-message").textContent=error.message; }
    });
    this.$("ready").addEventListener("click",()=>this.lobbyAction("ready",{ready:!this.lobby?.players.find(p=>p.id===this.id)?.ready}));
    this.$("lobby-mode").addEventListener("change",event=>this.lobbyAction("game-mode",{mode:event.currentTarget.value}));
    this.$("lobby-rule").addEventListener("change",event=>this.lobbyAction("match-rule",{rule:event.currentTarget.value}));
    this.$("lobby-map").addEventListener("change",event=>this.lobbyAction("map",{map:event.currentTarget.value}));
    this.$("start-match").addEventListener("click",()=>this.lobbyAction("start"));
    window.addEventListener("pagehide",()=>this.leave());
    window.addEventListener("pageshow",event=>{
      if (event.persisted && this.username) {
        this.onAccount(true);
        this.population();
      }
    });
    this.$("menu-home").addEventListener("click",()=>this.showMenu("home"));
    this.$("menu-unlocks").addEventListener("click",()=>{
      this.showMenu("unlocks");
      if (this.username) this.loadProgression();
    });
    this.restore();
    this.populationTimer=setInterval(()=>{
      if (!this.id && this.username) this.population();
    },5000);
  }

  async request(path, data, keepalive=false) {
    let response;
    try {
      response=await fetch(path,{
        method:data===undefined?"GET":"POST",
        headers:data===undefined?{}:{"Content-Type":"application/json"},
        body:data===undefined?undefined:JSON.stringify(data),
        credentials:"same-origin", cache:"no-store", keepalive,
        signal:AbortSignal.timeout(8000),
      });
    } catch (_) { throw new Error("Cannot reach the city server. Check your connection and try again."); }
    let result;
    try { result=await response.json(); }
    catch (_) { throw new Error("Start Assassins in Plain Sight with python3 server.py to enable accounts and multiplayer."); }
    if (!response.ok) {
      const error=new Error(result.error || "The server could not complete that request.");
      error.status=response.status;
      throw error;
    }
    return result;
  }

  async restore() {
    try {
      const account=await this.request("/api/session");
      this.setAccount(account.username);
    } catch (error) {
      this.$("account-message").textContent=error.status===401?"":error.message;
    } finally { this.$("account-submit").disabled=false; }
  }

  setAccount(username) {
    this.username=username;
    this.$("account-overlay").hidden=Boolean(username);
    this.$("account-name").textContent=username || "";
    this.$("password").value="";
    this.onAccount(Boolean(username));
    this.progression=null;
    this.renderedPowers=null;
    this.showMenu("home");
    if (username) { this.loadProgression(); this.population(); }
    else this.$("username").focus();
  }

  async authenticate() {
    this.$("account-submit").disabled=true;
    this.$("account-toggle").disabled=true;
    this.$("account-message").textContent=this.registering?"Creating your account…":"Opening the gates…";
    try {
      const result=await this.request(this.registering?"/api/register":"/api/login",{
        username:this.$("username").value.trim(), password:this.$("password").value,
      });
      this.$("account-message").textContent="";
      this.setAccount(result.username);
    } catch (error) { this.$("account-message").textContent=error.message; }
    finally {
      this.$("account-submit").disabled=false;
      this.$("account-toggle").disabled=false;
    }
  }

  showMenu(page) {
    this.menuPage=page;
    const unlocks=page==="unlocks", joined=Boolean(this.id);
    this.$("menu-intro").hidden=unlocks || joined;
    this.$("map-picker").hidden=unlocks || !joined;
    this.$("loadout-panel").hidden=unlocks || !joined;
    this.$("join-panel").hidden=unlocks || joined;
    this.$("lobby-controls").hidden=unlocks || !joined;
    this.$("unlocks-panel").hidden=!unlocks;
    this.$("menu-home").textContent=joined ? "Lobby" : "Main menu";
    this.$("menu-home").setAttribute("aria-pressed",String(!unlocks));
    this.$("menu-unlocks").setAttribute("aria-pressed",String(unlocks));
  }

  async loadProgression() {
    const username=this.username;
    const previousProgression=this.progression;
    try {
      const progression=await this.request("/api/progression");
      if (this.username!==username || this.progression!==previousProgression) return;
      this.progression=progression;
      this.renderUnlocks();
      if (this.lobby) this.renderLobby(this.lobby);
    } catch(error) { this.$("unlock-message").textContent=error.message; }
  }

  renderUnlocks() {
    if (!this.progression) return;
    const costs=this.progression.costs;
    this.$("gold-balance").textContent=this.progression.gold;
    for (const [kind,entries,owned] of [
      ["assassin",ROSTER.map((a,i)=>[i,a]),this.progression.assassins],
      ["ability",Object.entries(this.lobby?.powers || {}),this.progression.abilities],
    ]) {
      this.$(kind==="assassin" ? "unlock-assassins" : "unlock-abilities").replaceChildren(...entries.map(([id,item])=>{
        const card=document.createElement("button");
        card.type="button"; card.className="unlock-item";
        const unlocked=owned.includes(id);
        const cost=costs?.[kind]?.[id];
        card.disabled=unlocked || cost===undefined || this.unlockPending || this.progression.gold<cost;
        if (kind==="ability") card.innerHTML=abilityIcon(id);
        else {
          const portrait=this.$("roster").children[id]?.querySelector("img");
          if (portrait) { const img=portrait.cloneNode(); img.alt=""; card.append(img); }
        }
        const name=document.createElement("strong"); name.textContent=item.name;
        const status=document.createElement("small");
        status.textContent=unlocked ? "✓ Unlocked" : cost===undefined ? "Locked" : `Locked · Unlock for ${cost} ◉`;
        card.append(name,status); card.classList.toggle("owned",unlocked);
        card.title=item.description;
        card.addEventListener("click",()=>this.unlock(kind,id));
        return card;
      }));
    }
  }

  async unlock(kind,item) {
    if (this.unlockPending) return;
    this.unlockPending=true; this.renderUnlocks();
    this.$("unlock-message").textContent="Unlocking…";
    try {
      this.progression=await this.request("/api/unlock",{kind,item});
      this.renderedPowers=null;
      if (this.lobby) this.renderLobby(this.lobby);
      this.$("unlock-message").textContent="Unlocked. Available in your next loadout.";
    } catch(error) { this.$("unlock-message").textContent=error.message; }
    finally { this.unlockPending=false; this.renderUnlocks(); }
  }

  async population() {
    try {
      const server=await this.request("/api/server");
      this.$("server-population").textContent=`${server.online} online`;
      if (this.id) return;
      this.renderLobby(server.lobby);
    } catch (error) {
      this.$("server-population").textContent="Unavailable";
      this.$("server-message").textContent=error.message;
      this.$("enter").disabled=true;
    }
  }

  async join(outfit) {
    if (this.joining || this.id) return;
    this.joining=true;
    this.$("roster").inert=true;
    this.$("enter").disabled=true;
    this.$("logout").disabled=true;
    this.$("server-message").textContent="Joining the lobby…";
    try {
      const {player}=await this.request("/api/join",{outfit});
      this.id=player.id;
      const stream=new EventSource("/api/events");
      this.stream=stream;
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error("The city connection timed out. Try joining again.")),8000);
        stream.onmessage=event=>{
          if (this.stream!==stream) return;
          const snapshot=JSON.parse(event.data);
          const worldRevision=snapshot.lobby.worldRevision;
          if (worldRevision<this.lobby?.worldRevision) return;
          if (worldRevision!==this.snapshotWorldRevision) {
            this.snapshotWorldRevision=worldRevision;
            this.npcs.clear();
            this.remote.clear();
            this.walkingGroups=[];
            this.onWorldReset();
          }
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer=null;
          this.state=snapshot.self;
          const receivedAt=performance.now();
          this.state.receivedAt=receivedAt;
          this.effects=snapshot.effects.map(effect=>({...effect,receivedAt}));
          this.renderLobby(snapshot.lobby);
          this.renderKillFeed(snapshot.kill_feed || []);
          this.stampAnimation(this.state);
          this.receive([...snapshot.players, ...(snapshot.bot ? [snapshot.bot] : [])]);
          this.receive(snapshot.npcs,this.npcs);
          this.walkingGroups=snapshot.walking_groups;
          clearTimeout(timeout);
          this.$("connection-status").textContent="";
          this.$("resume").disabled=false;
          resolve();
        };
        stream.onerror=()=>{
          if (this.stream!==stream) return;
          if (this.joining) {
            clearTimeout(timeout);
            reject(new Error("Lost connection to the city. Try joining again."));
            return;
          }
          const disconnect=()=>this.disconnected("Connection lost. Leave the server and rejoin to continue.");
          if (stream.readyState===EventSource.CLOSED) disconnect();
          else if (this.reconnectTimer===null) this.reconnectTimer=setTimeout(disconnect,8000);
        };
      });
      this.lastSent=0;
      this.onJoin(player);
      this.$("server-message").textContent="";
    } catch (error) {
      this.leave();
      this.$("server-message").textContent=error.message;
      if (error.status===401) this.setAccount(null);
      else if (error.status===409) await this.population();
    } finally {
      this.joining=false;
      if (this.lobby) this.renderLobby(this.lobby);
      else this.$("roster").inert=false;
      this.$("logout").disabled=false;
    }
  }

  async lobbyAction(action, data={}) {
    if (!this.id || this.lobbyPending) return;
    this.lobbyPending={mode:action==="game-mode" ? data.mode : null,powers:action==="powers" ? data.powers : null,map:action==="map" ? data.map : null,rule:action==="match-rule" ? data.rule : null};
    this.renderLobby(this.lobby);
    const id=this.id;
    try {
      const result=await this.request(`/api/${action}`,{id:this.id,...data});
      if (this.id!==id) return;
      // The stream delivers the new map and its actors in the same snapshot.
      if (action!=="map" && action!=="game-mode" && action!=="start") this.renderLobby(result.lobby);
      this.$("server-message").textContent="";
    } catch (error) {
      if (this.id===id) this.$("server-message").textContent=error.message;
    } finally {
      this.lobbyPending=null;
      if (this.lobby) this.renderLobby(this.lobby);
    }
  }

  renderLobby(lobby) {
    if (!lobby || lobby.worldRevision<this.lobby?.worldRevision) return;
    const previous=this.lobby?.phase;
    const previousMap=this.lobby?.map;
    const receivedResults=!this.lobby?.results.length && lobby.results.some(p=>p.id===this.id);
    this.lobby=lobby;
    if (receivedResults) this.loadProgression();
    const joined=Boolean(this.id), me=lobby.players.find(p=>p.id===this.id);
    if (joined && lobby.phase==="playing" && (previous!=="playing" || previousMap!==lobby.map)) this.onMap(lobby.map);
    this.$("enter").hidden=joined;
    this.$("logout").hidden=joined;
    this.showMenu(this.menuPage);
    const ready=this.$("ready"), readyLabel=me?.ready ? "Not ready" : "Ready up";
    if (ready.textContent!==readyLabel) ready.textContent=readyLabel;
    const lobbyOpen=lobby.phase==="lobby", missingSlot=me?.powers.indexOf(null);
    const pending=Boolean(this.lobbyPending);
    const mapPicker=this.$("lobby-map");
    if (!mapPicker.options.length) {
      mapPicker.replaceChildren(...Object.entries(lobby.maps).map(([id,name])=>new Option(name,id)));
    }
    const mapId=this.lobbyPending?.map ?? lobby.map;
    if (mapPicker.value!==mapId) mapPicker.value=mapId;
    mapPicker.disabled=!lobbyOpen || pending || !me || lobby.leader!==this.id;
    const mapName=this.$("lobby-map-name"), mapHelp=this.$("lobby-map-help");
    const help=lobby.leader===this.id
      ? "Changing the map clears everyone’s ready status."
      : "The lobby leader chooses the map.";
    if (mapName.textContent!==lobby.maps[lobby.map]) mapName.textContent=lobby.maps[lobby.map];
    if (mapHelp.textContent!==help) mapHelp.textContent=help;
    const modePicker=this.$("lobby-mode");
    modePicker.value=this.lobbyPending?.mode ?? lobby.gameMode;
    modePicker.disabled=!lobbyOpen || pending || !me || lobby.leader!==this.id;
    this.$("lobby-mode-help").textContent=lobby.gameMode==="competitive"
      ? "Players only · Leaders attract more hunters · New target on stun · 3–10s between winning contracts · Requires 2 players."
      : "Practice rival enabled · Citizens can be targets. Changing mode clears everyone’s ready status.";
    const rulePicker=this.$("lobby-rule");
    rulePicker.value=this.lobbyPending?.rule ?? lobby.matchRule;
    rulePicker.disabled=!lobbyOpen || pending || !me || lobby.leader!==this.id;
    this.$("lobby-rule-help").textContent=lobby.leader===this.id
      ? "Changing the match rule clears everyone’s ready status."
      : "The lobby leader chooses the match rule.";
    this.$("start-match").textContent=`Start · ${rulePicker.selectedOptions[0]?.textContent ?? "match"}`;
    ready.disabled=!lobbyOpen || pending || !me || missingSlot!==-1;
    this.$("start-match").hidden=!joined || lobby.leader!==this.id;
    this.$("start-match").disabled=!lobbyOpen || pending || !lobby.players.every(p=>p.ready) || (lobby.gameMode==="competitive" && lobby.players.length<2);
    const status=this.$("lobby-status");
    const lobbyMessage=this.lobbyPending?.powers ? "Saving powers…"
      : this.lobbyPending ? "Updating lobby…"
      : missingSlot>=0 ? "Select two abilities to ready up."
      : lobby.leader===this.id ? "You are the lobby leader. Start when everyone is ready."
      : "Ready up, then wait for the lobby leader to start.";
    if (status.textContent!==lobbyMessage) status.textContent=lobbyMessage;
    const taken=new Set(lobby.players.filter(p=>p.id!==this.id).map(p=>p.outfit));
    const full=!this.progression || !this.progression.assassins.some(i=>!taken.has(i));
    this.$("enter").disabled=this.joining || !lobbyOpen || full;
    this.$("enter").firstChild.textContent=full ? "No assassins available " : lobbyOpen ? "Join lobby " : "Match underway ";
    this.$("roster").inert=this.joining || pending || (joined && !lobbyOpen);
    this.onRoster(taken,me?.outfit,this.progression?.assassins || []);
    if (me) this.renderPowers(lobby.powers,this.lobbyPending?.powers ?? me.powers,!lobbyOpen || pending);
    const preview=this.$("current-lobby");
    const summary=lobby.players.map(p=>`${p.username} · ${ROSTER[p.outfit].name} · ${p.ready ? "Ready" : "Preparing"}`);
    if (!summary.length) summary.push("Lobby open · Be the first assassin to join");
    if (preview.dataset.summary!==JSON.stringify(summary)) {
      preview.dataset.summary=JSON.stringify(summary);
      preview.replaceChildren(...summary.map(label=>{const li=document.createElement("li");li.textContent=label;return li;}));
    }
    if (this.unlockCatalog!==lobby.powers && JSON.stringify(this.unlockCatalog)!==JSON.stringify(lobby.powers)) {
      this.unlockCatalog=lobby.powers; this.renderUnlocks();
    }
    const seconds=Math.ceil(lobby.remaining);
    const scoreMatch=lobby.matchRule.startsWith("score-");
    this.$("match-time-label").textContent=scoreMatch ? "TARGET" : "TIME";
    this.$("match-time").textContent=scoreMatch ? Number(lobby.matchRule.slice(6)).toLocaleString() : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
    this.$("results-countdown").textContent=`Returning to lobby in ${seconds}s…`;
    this.$("results-overlay").hidden=!joined || lobby.phase!=="results";
    const key=JSON.stringify([lobby.players,lobby.results,lobby.leader]);
    if (key!==this.lobbyKey) {
      this.lobbyKey=key;
      this.$("lobby-players").replaceChildren(...lobby.players.map(p=>{
        const row=document.createElement("li");
        const name=document.createElement("strong");
        name.textContent=p.username;
        const image=document.createElement("img");
        image.src=document.querySelectorAll("#roster .character img")[p.outfit]?.src || "";
        image.alt=ROSTER[p.outfit].name;
        const detail=document.createElement("small");
        detail.textContent=`${ROSTER[p.outfit].name} · ${p.ready ? "Ready" : "Preparing"}${p.id===lobby.leader ? " · Leader" : ""}`;
        row.append(name,image,detail);
        return row;
      }));
      this.$("results-players").replaceChildren(...lobby.results.map(p=>{
        const row=document.createElement("tr");
        for (const value of [p.username,p.assassinations,p.score,p.coins]) {
          const cell=document.createElement("td"); cell.textContent=value; row.append(cell);
        }
        return row;
      }));
    }
    if (joined && previous!==lobby.phase) this.onPhase(lobby.phase);
  }

  renderPowers(catalog, powers, disabled) {
    this.$("power-loadout").disabled=disabled;
    if (this.renderedPowers && this.renderedPowersDisabled===disabled && powers.every((power,slot)=>power===this.renderedPowers[slot])) return;
    this.renderedPowersDisabled=disabled;
    this.renderedPowers=[...powers];
    const count=powers.filter(Boolean).length;
    this.$("ability-selection-status").textContent=`${count} / 2 selected · ${count===2 ? "Deselect an ability to choose another." : "Choose two to ready up."}`;
    const focused=document.activeElement?.closest("#ability-picker .ability-card")?.dataset.ability;
    const cards=Object.entries(catalog).map(([id,power])=>{
      const card=document.createElement("button");
      card.type="button"; card.className="ability-card"; card.dataset.ability=id;
      card.innerHTML=abilityIcon(id);
      const name=document.createElement("strong"); name.textContent=power.name; card.append(name);
      const locked=!this.progression?.abilities.includes(id), slot=powers.indexOf(id), selected=slot!==-1;
      const status=document.createElement("small");
      status.textContent=locked ? "Locked · 1 ◉ in Unlocks" : selected ? `✓ Selected · Key ${slot+1}` : "Select";
      card.append(status);
      card.disabled=disabled || locked || (!selected && count===2);
      card.setAttribute("aria-pressed",String(selected));
      card.setAttribute("aria-label",`${power.name}${locked ? " · Locked" : selected ? " · Selected" : ""}`);
      card.title=`${power.description} · ${power.cooldown}s cooldown`;
      card.classList.toggle("locked",locked);
      card.addEventListener("click",()=>{
        if (disabled || locked || this.lobbyPending) return;
        const next=[...powers];
        if (selected) next[slot]=null;
        else {
          const empty=next.indexOf(null);
          if (empty===-1) return;
          next[empty]=id;
        }
        this.lobbyAction("powers",{powers:next});
      });
      return card;
    });
    this.$("ability-picker").replaceChildren(...cards);
    if (focused) cards.find(card=>card.dataset.ability===focused && !card.disabled)?.focus({preventScroll:true});
  }

  stampAnimation(state) {
    if (state.animation) state.animation.receivedAt=performance.now();
  }

  receive(players, actors=this.remote) {
    const present=new Set();
    for (const state of players) {
      if (state.id===this.id) continue;
      present.add(state.id);
      this.stampAnimation(state);
      let actor=actors.get(state.id);
      if (!actor) {
        actor={...state,seed:state.seed ?? 1.7,scale:CHARACTER_SCALE};
        actors.set(state.id,actor);
      }
      actor.crowd_group=state.crowd_group; actor.crowd_slot=state.crowd_slot;
      actor.bench_goal=state.bench_goal;
      actor.outfit=state.outfit;
      actor.bench=state.bench; actor.bench_seat=state.bench_seat;
      actor.haybale=state.haybale;
      actor.invisible=state.invisible;
      actor.boosted=state.boosted;
      actor.dead=state.dead; actor.stunned=state.stunned; actor.activity=state.activity;
      if (actor.revision!==state.revision) Object.assign(actor,state);
      actor.animation=state.animation;
      actor.target=state;
    }
    for (const id of actors.keys()) if (!present.has(id)) actors.delete(id);
  }

  async act(action, victim) {
    if (!this.id || this.lobby?.phase!=="playing" || this.actionPending) return;
    this.actionPending=true;
    try { return await this.request("/api/action",{id:this.id,action,victim}); }
    finally { this.actionPending=false; }
  }

  async usePower(slot, victim) {
    if (!this.id || this.lobby?.phase!=="playing" || this.pendingPowers.has(slot)) return;
    const id=this.id;
    this.pendingPowers.add(slot);
    try { return await this.request("/api/power",{id,slot,victim}); }
    finally { this.pendingPowers.delete(slot); }
  }

  get reconnecting() { return this.reconnectTimer!==null; }

  tick(dt, player) {
    if (this.state) {
      const state=this.state;
      player.bench=state.bench; player.bench_seat=state.bench_seat;
      player.haybale=state.haybale;
      player.animation=state.animation;
      if (state.busy || player.revision!==state.revision || state.dead>0 || state.stunned>0) {
        Object.assign(player,{x:state.x,z:state.z,angle:state.angle,stride:0,revision:state.revision});
      }
    }
    for (const actor of [...this.remote.values(),...this.npcs.values()]) {
      const target=actor.target, amount=1-Math.exp(-dt*14);
      actor.x+=(target.x-actor.x)*amount;
      actor.z+=(target.z-actor.z)*amount;
      actor.angle=turnTo(actor.angle,target.angle,amount);
      actor.stride+=(target.stride-actor.stride)*amount;
      actor.phase+=actor.stride*12*dt;
    }
    const now=performance.now();
    if (!this.id || this.lobby?.phase!=="playing" || this.joining || this.reconnecting || this.sending || now-this.lastSent<80) return;
    this.lastSent=now;
    this.sending=true;
    const id=this.id, revision=player.revision;
    this.request("/api/move",{id,x:player.x,z:player.z,angle:player.angle,stride:player.stride,
      phase:player.phase%(Math.PI*2),zone:player.zone,crowdGroup:player.crowdGroup,crowdSlot:player.crowdSlot,blendGroup:player.blendGroup,sprinting:player.sprinting,revision})
      .then(({correction})=>{
        if (correction && this.id===id && this.lobby?.phase==="playing"
            && player.revision===revision && revision===correction.revision) {
          Object.assign(player,correction,{stride:0});
        }
      })
      .catch(error=>{ if (this.id===id && error.status && !(error.status===409 && error.message==="The match is not running.")) this.disconnected(error.message); })
      .finally(()=>{ this.sending=false; });
  }

  renderKillFeed(entries) {
    const key=JSON.stringify(entries);
    if (key===this.killFeedKey) return;
    this.killFeedKey=key;
    const feed=this.$("kill-feed");
    const ids=new Set(entries.map(entry=>String(entry.id)));
    for (const row of [...feed.children]) {
      if (!ids.has(row.dataset.id)) row.remove();
    }
    for (const entry of entries) {
      if ([...feed.children].some(row=>row.dataset.id===String(entry.id))) continue;
      const tier=["savage","bloody","stealth","incognito"].includes(entry.tier) ? entry.tier : "savage";
      const label=entry.method==="gun" ? "Gun kill" : `${tier[0].toUpperCase()+tier.slice(1)} kill`;
      const row=document.createElement("li");
      row.className="kill-feed-entry";
      row.dataset.id=entry.id;
      row.dataset.tier=tier;
      row.setAttribute("aria-label",`${entry.attacker} · ${label} · ${entry.target}`);
      const attacker=document.createElement("span"), target=document.createElement("span");
      attacker.className="kill-feed-attacker"; target.className="kill-feed-target";
      attacker.textContent=entry.attacker; target.textContent=entry.target;
      attacker.title=entry.attacker; target.title=entry.target;
      const icon=document.createElement("span");
      icon.className="kill-feed-icon"; icon.title=label;
      icon.setAttribute("aria-hidden","true");
      icon.innerHTML=entry.method==="gun" ? abilityIcon("gun") :
        `<svg viewBox="0 0 24 24"><use href="#i-stealth-${tier}"/></svg>`;
      row.append(attacker,icon,target);
      feed.prepend(row);
    }
  }

  disconnected(message) {
    this.leave();
    this.$("connection-status").textContent=message;
    this.$("resume").disabled=true;
    this.onDisconnect();
  }

  leave() {
    const id=this.id;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer=null;
    this.stream?.close();
    this.stream=null;
    this.id=null;
    this.snapshotWorldRevision=undefined;
    this.walkingGroups=[];
    this.remote.clear();
    this.npcs.clear();
    this.state=null;
    this.effects=[];
    this.renderKillFeed([]);
    this.lobby=null;
    this.renderedPowers=null;
    this.$("results-overlay").hidden=true;
    this.$("enter").hidden=false;
    this.$("logout").hidden=false;
    this.$("lobby-controls").hidden=true;
    this.$("enter").disabled=true;
    this.showMenu("home");
    this.onRoster(new Set(),undefined,this.progression?.assassins || []);
    if (id) this.request("/api/leave",{id},true).catch(()=>{});
  }
}
