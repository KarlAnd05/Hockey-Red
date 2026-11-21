/* ==========================================================================
   Lebanon Hockey admin - Live entry
   --------------------------------------------------------------------------
   The screen a coach holds at the rink. Three zones, nothing that needs a
   scroll to act: a sticky bar with the score, the period and the clock; two
   big buttons; and the list of what has been recorded so far.

   Three things here are deliberate and should not be "tidied":

   1. There is NO running clock. The authority is the board on the wall. A
      second clock in a phone drifts, keeps running through a timeout and
      pauses wrong, which would put confidently wrong times on an official
      document. The coach looks up and types five keystrokes.

   2. The composer is rendered inline, not through LHAdmin.openModal. openModal
      centres a desktop form and focuses its first input, which pops the
      keyboard over the player tiles; the composer also has to survive a
      re-render of the event list.

   3. Saving goes through a queue in localStorage, so a dropped connection
      loses nothing. Every queued event carries a clientId, and the server
      answers a replay with the row it already made - which is what makes
      retrying safe instead of duplicating goals.

   What this does NOT give: the page has to have been loaded while online.
   There is no service worker, so a cold load in a dead zone shows nothing.
   Load it in the lobby and it survives the ice.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;
  const { guard } = window.LHAdmin;

  const host = document.querySelector('[data-live]');
  if (!host) return;

  /* --- state ------------------------------------------------------------- */
  let gameId = Number(new URLSearchParams(window.location.search).get('game')) || null;
  let data = null; /* the whole live payload: game, sheet, events, vocabulary */
  let period = '1';
  let composer = null;
  let queue = [];
  let flushing = false;
  let retryTimer = null;
  let online = true;

  const dateLabel = (value) => (value ? formatDate(value) : 'Date not set');
  const sideLabel = (side) =>
    side === 'them' ? data.game.opponentLabel : data.game.teamName || 'Us';

  /* The clock is remembered between events, because consecutive events are
     usually seconds apart and retyping four digits is the main cost of a row. */
  const clockInput = () => host.querySelector('[data-live-clock]');
  const clockValue = () => String(clockInput() ? clockInput().value : '').trim();

  /* ========================================================================
     The retry queue
     ======================================================================== */
  const queueKey = () => 'lh.live.' + gameId + '.queue';

  /* Storage can be absent, blocked or full. None of that may stop the screen
     working, so every read and write is guarded and the queue also lives in
     memory for the life of the page. */
  function loadQueue() {
    queue = [];
    try {
      const raw = window.localStorage.getItem(queueKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) queue = parsed;
    } catch (error) {
      /* a private window, cleared site data, or a half-written value */
    }
  }

  function saveQueue() {
    try {
      if (queue.length) window.localStorage.setItem(queueKey(), JSON.stringify(queue));
      else window.localStorage.removeItem(queueKey());
    } catch (error) {
      /* in memory only from here on */
    }
  }

  /* crypto.randomUUID needs a secure context and is undefined over plain http
     on a LAN address - which is exactly where a rink laptop serves this from. */
  function clientId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (error) {
      /* fall through to the timestamp */
    }
    return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function schedule() {
    if (retryTimer) return;
    retryTimer = window.setTimeout(function () {
      retryTimer = null;
      flush();
    }, 15000);
  }

  async function flush() {
    if (flushing || !queue.length || !gameId) return;
    flushing = true;
    paintState();

    try {
      while (queue.length) {
        const next = queue[0];
        let answer = null;

        try {
          answer = await api('/api/admin/games/' + gameId + '/events', {
            method: 'POST',
            body: next.body,
          });
        } catch (error) {
          /* No status means the request never reached the server: keep it and
             try again. A status means the server read it and refused it, and
             sending it again will not change that - so drop it with a message
             rather than let one bad row wedge every event behind it. */
          if (error.status === undefined) {
            online = false;
            break;
          }
          queue.shift();
          saveQueue();
          toast(error.message || 'That event was refused and has been dropped.', 'error');
          continue;
        }

        online = true;
        queue.shift();
        saveQueue();
        adopt(answer);
      }
    } finally {
      flushing = false;
      paintScore();
      paintEvents();
      paintState();
      if (queue.length) schedule();
    }
  }

  /* Every event write answers with the whole sheet, so the screen takes the
     server's version wholesale rather than patching its own copy. */
  function adopt(payload) {
    if (!payload || !payload.game) return;
    data.game = payload.game;
    data.sheet = payload.sheet;
    data.events = payload.events;
    data.goalies = payload.goalies;
    data.summary = payload.summary;
    data.warnings = payload.warnings;
  }

  window.addEventListener('online', function () {
    online = true;
    flush();
  });
  window.addEventListener('offline', function () {
    online = false;
    paintState();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) flush();
  });
  window.addEventListener('beforeunload', function (event) {
    if (!queue.length) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  });

  /* ========================================================================
     Reading the state
     ======================================================================== */
  const lineById = (id) => (data.sheet || []).find((line) => line.id === Number(id)) || null;

  const squad = (side) =>
    (data.sheet || []).filter(
      (line) => line.side === side && line.played && line.role !== 'staff'
    );

  /* The opponent only has tiles when the opponent is another team on this
     site. Otherwise a jersey number is all a scorekeeper has to go on. */
  const hasOpponentSquad = () => squad('them').length > 0;

  function queuedGoals(side) {
    return queue.filter((item) => item.body.kind === 'goal' && item.body.side === side).length;
  }

  const countedGoals = (side) =>
    (data.events || []).filter((e) => e.kind === 'goal' && e.side === side).length +
    queuedGoals(side);

  /* ========================================================================
     Painting
     ======================================================================== */
  function renderShell() {
    const g = data.game;

    host.innerHTML =
      '<div class="live-bar">' +
      '  <div class="live-bar-top">' +
      '    <a class="live-back" href="games.html">&larr; Sheets</a>' +
      '    <p class="live-fixture">' +
      escapeHtml(g.teamName || 'Us') +
      ' v ' +
      escapeHtml(g.opponentLabel) +
      ' <span>' +
      escapeHtml(dateLabel(g.playedAt)) +
      '</span></p>' +
      '    <span class="live-state" data-live-state aria-live="polite"></span>' +
      '  </div>' +
      '  <div class="live-bar-main">' +
      '    <p class="live-score" data-live-score></p>' +
      '    <div class="live-periods" role="group" aria-label="Period">' +
      (data.periods || ['1', '2', '3'])
        .map(
          (value) =>
            '<button type="button" data-period="' +
            escapeHtml(value) +
            '" title="' +
            escapeHtml((data.periodLabels || {})[value] || value) +
            '">' +
            escapeHtml((data.periodShorts || {})[value] || value) +
            '</button>'
        )
        .join('') +
      '    </div>' +
      '    <label class="live-clock">' +
      '      <span>Clock</span>' +
      '      <input type="text" data-live-clock inputmode="numeric" autocomplete="off"' +
      '        placeholder="MM:SS" maxlength="5" aria-label="Clock, minutes and seconds">' +
      '    </label>' +
      '  </div>' +
      '  <p class="live-score-note" data-live-score-note hidden></p>' +
      '</div>' +
      '<div class="live-grid">' +
      '  <div class="live-left">' +
      '    <div class="live-actions">' +
      '      <button type="button" class="live-big goal" data-add="goal">+ Goal</button>' +
      '      <button type="button" class="live-big penalty" data-add="penalty">+ Penalty</button>' +
      '    </div>' +
      '    <div class="live-composer" data-composer hidden></div>' +
      '  </div>' +
      '  <div class="live-right">' +
      '    <div data-events></div>' +
      '  </div>' +
      '</div>';

    paintScore();
    paintEvents();
    paintState();
  }

  function paintScore() {
    const g = data.game;
    const us = countedGoals('us');
    const them = countedGoals('them');

    const score = host.querySelector('[data-live-score]');
    if (score) {
      score.innerHTML =
        '<span>' +
        escapeHtml(g.usLabel) +
        '</span> ' +
        escapeHtml(String(us)) +
        ' <small>&ndash;</small> ' +
        escapeHtml(String(them)) +
        ' <span>' +
        escapeHtml(g.themLabel) +
        '</span>';
    }

    /* The headline score on the record stays typed - see the warning in
       GET /api/admin/games/:id. This offers to copy the counted goals across
       rather than doing it silently. */
    const note = host.querySelector('[data-live-score-note]');
    if (!note) return;

    const typed = g.scoreFor !== null && g.scoreAgainst !== null;
    if (typed && g.scoreFor === us && g.scoreAgainst === them) {
      note.hidden = true;
      note.innerHTML = '';
      return;
    }

    note.hidden = false;
    note.innerHTML =
      (typed
        ? 'The score on the record says ' +
          escapeHtml(String(g.scoreFor)) +
          '&ndash;' +
          escapeHtml(String(g.scoreAgainst)) +
          '. '
        : 'No final score has been set yet. ') +
      '<button type="button" class="mini-button" data-use-counted>Use ' +
      escapeHtml(String(us)) +
      '&ndash;' +
      escapeHtml(String(them)) +
      '</button>';
  }

  function paintState() {
    const el = host.querySelector('[data-live-state]');
    if (!el) return;

    if (queue.length) {
      el.className = 'live-state is-waiting';
      el.innerHTML =
        (online ? '' : 'Offline &middot; ') +
        escapeHtml(String(queue.length)) +
        ' not saved yet';
    } else if (!online) {
      el.className = 'live-state is-offline';
      el.textContent = 'Offline';
    } else {
      el.className = 'live-state is-saved';
      el.textContent = 'Saved';
    }

    host.querySelectorAll('[data-period]').forEach(function (button) {
      button.classList.toggle('is-on', button.dataset.period === period);
    });
  }

  function who(person) {
    if (!person) return '<span class="live-nobody">not credited</span>';
    const number = person.jerseyNumber === null ? '' : '#' + person.jerseyNumber + ' ';
    return escapeHtml(number) + escapeHtml(person.name || 'Unnamed');
  }

  function eventLine(event) {
    if (event.kind === 'goal') {
      const assists = (event.assists || []).map(who).join(', ');
      return (
        '<strong>Goal</strong> ' +
        who(event.scorer) +
        (assists ? ' <span class="live-assists">A: ' + assists + '</span>' : '') +
        (event.situation && event.situation !== 'EQ'
          ? ' <span class="live-chip-inline">' + escapeHtml(event.situation) + '</span>'
          : '')
      );
    }

    return (
      '<strong>Penalty</strong> ' +
      who(event.player) +
      ' <span class="live-assists">' +
      escapeHtml(String(event.minutes)) +
      ' min' +
      (event.offence
        ? ' &middot; ' + escapeHtml(event.offenceLabel || event.offence)
        : ' &middot; no offence recorded') +
      '</span>'
    );
  }

  /* A queued event is drawn from the payload that is waiting to be sent, so
     the coach sees it the moment they press Save. */
  function pendingLine(item) {
    const body = item.body;
    const name = (id) => {
      const line = id ? lineById(id) : null;
      if (line) {
        return (line.jerseyNumber === null ? '' : '#' + line.jerseyNumber + ' ') + line.name;
      }
      return body.jerseyNumber ? '#' + body.jerseyNumber : body.name || 'not credited';
    };

    if (body.kind === 'goal') {
      const assists = [body.assist1LineId, body.assist2LineId].filter(Boolean).map(name);
      return (
        '<strong>Goal</strong> ' +
        escapeHtml(name(body.scorerLineId)) +
        (assists.length
          ? ' <span class="live-assists">A: ' + escapeHtml(assists.join(', ')) + '</span>'
          : '')
      );
    }

    return (
      '<strong>Penalty</strong> ' +
      escapeHtml(name(body.lineId)) +
      ' <span class="live-assists">' +
      escapeHtml(String(body.minutes)) +
      ' min' +
      (body.offence ? ' &middot; ' + escapeHtml(body.offence) : '') +
      '</span>'
    );
  }

  function paintEvents() {
    const target = host.querySelector('[data-events]');
    if (!target) return;

    const shortOf = (value) => (data.periodShorts || {})[value] || value;

    /* Newest first: what the coach scans between whistles. */
    const rows = (data.events || []).slice().reverse();
    const newest = rows.length ? rows[0] : null;

    const pending = queue
      .slice()
      .reverse()
      .map(
        (item) =>
          '<li class="live-event is-pending">' +
          '<span class="live-when">' +
          escapeHtml(shortOf(item.body.period)) +
          ' &middot; ' +
          escapeHtml(item.body.time || '--:--') +
          '</span>' +
          '<span class="live-what">' +
          pendingLine(item) +
          '</span>' +
          '<span class="live-pending-dot" title="Waiting to be saved">waiting</span>' +
          '</li>'
      )
      .join('');

    const saved = rows
      .map(
        (event) =>
          '<li class="live-event is-' +
          escapeHtml(event.side) +
          '" data-event="' +
          escapeHtml(String(event.id)) +
          '">' +
          '<span class="live-when">' +
          escapeHtml(event.periodShort || shortOf(event.period)) +
          ' &middot; ' +
          escapeHtml(event.time || '--:--') +
          '</span>' +
          '<span class="live-what">' +
          '<span class="live-whose">' +
          escapeHtml(sideLabel(event.side)) +
          '</span>' +
          eventLine(event) +
          '</span>' +
          '<span class="live-event-actions">' +
          '<button type="button" class="mini-button" data-edit-event>Fix</button>' +
          (newest && newest.id === event.id
            ? '<button type="button" class="mini-button danger" data-undo-event>Undo</button>'
            : '<button type="button" class="mini-button danger" data-delete-event>Delete</button>') +
          '</span>' +
          '</li>'
      )
      .join('');

    target.innerHTML =
      '<h2 class="live-list-heading">Recorded' +
      (rows.length || queue.length
        ? ' <span>' + escapeHtml(String(rows.length + queue.length)) + '</span>'
        : '') +
      '</h2>' +
      (rows.length || queue.length
        ? '<ul class="live-events">' + pending + saved + '</ul>'
        : '<p class="live-empty">Nothing recorded yet. Press <strong>+ Goal</strong> or ' +
          '<strong>+ Penalty</strong> when something happens.</p>');
  }

  /* ========================================================================
     The composer
     ======================================================================== */
  function openComposer(kind, event) {
    composer = {
      kind,
      id: event ? event.id : null,
      side: event ? event.side : 'us',
      period: event ? event.period : period,
      time: event ? event.time : clockValue(),
      scorerLineId: event && event.scorer ? event.scorer.lineId : null,
      assists:
        event && event.assists ? event.assists.map((a) => a.lineId).filter(Boolean) : [],
      situation: event && event.situation ? event.situation : 'EQ',
      lineId: event && event.player ? event.player.lineId : null,
      minutes: event && event.minutes !== undefined ? event.minutes : 2,
      offence: event ? event.offence || '' : '',
      jerseyNumber:
        event && event.jerseyNumber !== undefined && event.jerseyNumber !== null
          ? String(event.jerseyNumber)
          : '',
      name: event ? event.name || '' : '',
      offencesOpen: false,
      error: '',
    };
    paintComposer();
  }

  function closeComposer() {
    composer = null;
    paintComposer();
  }

  /* First tap is the scorer, the next two are the assists, and tapping an
     already-chosen tile clears it. No "now pick the assist" step. */
  function tapTile(lineId) {
    const id = Number(lineId);

    if (composer.kind === 'penalty') {
      composer.lineId = composer.lineId === id ? null : id;
      paintComposer();
      return;
    }

    if (composer.scorerLineId === id) {
      composer.scorerLineId = null;
    } else if (composer.assists.includes(id)) {
      composer.assists = composer.assists.filter((value) => value !== id);
    } else if (composer.scorerLineId === null) {
      composer.scorerLineId = id;
    } else if (composer.assists.length < 2) {
      composer.assists.push(id);
    } else {
      toast('A goal takes a scorer and two assists at most.', 'error');
    }

    paintComposer();
  }

  function tileRole(line) {
    if (composer.kind === 'penalty') return composer.lineId === line.id ? 'is-picked' : '';
    if (composer.scorerLineId === line.id) return 'is-scorer';
    const at = composer.assists.indexOf(line.id);
    if (at === 0) return 'is-assist1';
    if (at === 1) return 'is-assist2';
    return '';
  }

  function tiles() {
    const lines = squad(composer.side)
      .slice()
      .sort(function (a, b) {
        if (a.jerseyNumber === null && b.jerseyNumber === null) {
          return String(a.name).localeCompare(String(b.name));
        }
        if (a.jerseyNumber === null) return 1;
        if (b.jerseyNumber === null) return -1;
        return a.jerseyNumber - b.jerseyNumber;
      });

    if (!lines.length) {
      return (
        '<p class="live-note">' +
        (composer.side === 'them'
          ? 'This opponent has no squad on this site, so put their jersey number in below.'
          : 'Nobody is named on the sheet for us yet. Add the squad on the game sheet first.') +
        '</p>' +
        '<label class="live-field"><span>Jersey number</span>' +
        '<input type="text" inputmode="numeric" maxlength="2" data-jersey value="' +
        escapeHtml(composer.jerseyNumber) +
        '" placeholder="#"></label>' +
        '<label class="live-field"><span>Name, if you have it</span>' +
        '<input type="text" data-name value="' +
        escapeHtml(composer.name) +
        '" placeholder="Optional"></label>'
      );
    }

    return (
      '<div class="live-tiles">' +
      lines
        .map(
          (line) =>
            '<button type="button" class="live-tile ' +
            tileRole(line) +
            /* No jersey number yet means the name is the only identifier, so
               the tile leads with it instead of showing a dash. */
            (line.jerseyNumber === null ? ' is-unnumbered' : '') +
            '" data-tile="' +
            escapeHtml(String(line.id)) +
            '">' +
            '<span class="live-tile-number">' +
            escapeHtml(line.jerseyNumber === null ? '--' : '#' + line.jerseyNumber) +
            '</span>' +
            '<span class="live-tile-name">' +
            escapeHtml(String(line.name || 'Unnamed').split(' ').slice(-1)[0]) +
            '</span>' +
            '</button>'
        )
        .join('') +
      '</div>'
    );
  }

  function readout() {
    if (composer.kind === 'penalty') {
      const line = composer.lineId ? lineById(composer.lineId) : null;
      if (line) return 'P ' + (line.jerseyNumber === null ? line.name : '#' + line.jerseyNumber);
      return composer.jerseyNumber ? 'P #' + composer.jerseyNumber : 'Nobody chosen yet';
    }

    const label = (id) => {
      const line = lineById(id);
      if (!line) return '';
      return line.jerseyNumber === null ? line.name : '#' + line.jerseyNumber;
    };

    const parts = [];
    if (composer.scorerLineId) parts.push('G ' + label(composer.scorerLineId));
    else if (composer.jerseyNumber) parts.push('G #' + composer.jerseyNumber);
    composer.assists.forEach(function (id) {
      parts.push('A ' + label(id));
    });

    return parts.length ? parts.join(' &middot; ') : 'A goal with nobody credited yet';
  }

  function chips(name, values, current, labelFor) {
    return (
      '<div class="live-chips" role="group">' +
      values
        .map(
          (value) =>
            '<button type="button" class="live-chip' +
            (String(current) === String(value) ? ' is-on' : '') +
            '" data-' +
            name +
            '="' +
            escapeHtml(String(value)) +
            '">' +
            escapeHtml(labelFor ? labelFor(value) : String(value)) +
            '</button>'
        )
        .join('') +
      '</div>'
    );
  }

  function offenceChips() {
    const all = data.offences || {};
    const shortcuts = data.topCodes || data.commonOffences || [];

    if (composer.offencesOpen) {
      return (
        '<div class="live-offence-all">' +
        Object.keys(all)
          .sort()
          .map(
            (code) =>
              '<button type="button" class="live-chip' +
              (composer.offence === code ? ' is-on' : '') +
              '" data-offence="' +
              escapeHtml(code) +
              '">' +
              escapeHtml(code) +
              ' <small>' +
              escapeHtml(all[code]) +
              '</small></button>'
          )
          .join('') +
        '</div>'
      );
    }

    const picked = composer.offence && !shortcuts.includes(composer.offence);

    return (
      '<div class="live-chips">' +
      shortcuts
        .map(
          (code) =>
            '<button type="button" class="live-chip' +
            (composer.offence === code ? ' is-on' : '') +
            '" data-offence="' +
            escapeHtml(code) +
            '" title="' +
            escapeHtml(all[code] || code) +
            '">' +
            escapeHtml(code) +
            '</button>'
        )
        .join('') +
      (picked
        ? '<button type="button" class="live-chip is-on" data-offence="' +
          escapeHtml(composer.offence) +
          '">' +
          escapeHtml(composer.offence) +
          '</button>'
        : '') +
      '<button type="button" class="live-chip is-more" data-offences-open>More&hellip;</button>' +
      '</div>'
    );
  }

  function paintComposer() {
    const target = host.querySelector('[data-composer]');
    if (!target) return;

    if (!composer) {
      target.hidden = true;
      target.innerHTML = '';
      document.body.classList.remove('live-composing');
      return;
    }

    target.hidden = false;
    document.body.classList.add('live-composing');

    const minutesLabels = data.penaltyMinutesLabels || {};

    target.innerHTML =
      '<div class="live-composer-head">' +
      '  <h2>' +
      (composer.id ? 'Fix this ' : 'New ') +
      escapeHtml(composer.kind) +
      '</h2>' +
      '  <button type="button" class="close" data-composer-close aria-label="Close">&times;</button>' +
      '</div>' +
      /* The side toggle lives here, not in the bar: one that carries over
         from the last event is a classic mis-entry. */
      '<div class="live-row">' +
      '  <div class="live-chips live-sides" role="group" aria-label="Which side">' +
      '    <button type="button" class="live-chip' +
      (composer.side === 'us' ? ' is-on' : '') +
      '" data-side="us">' +
      escapeHtml(data.game.teamName || 'Us') +
      '</button>' +
      '    <button type="button" class="live-chip' +
      (composer.side === 'them' ? ' is-on' : '') +
      '" data-side="them">' +
      escapeHtml(data.game.opponentLabel) +
      '</button>' +
      '  </div>' +
      '  <label class="live-field live-field-time"><span>Time</span>' +
      '    <input type="text" data-time inputmode="numeric" maxlength="5" placeholder="MM:SS" value="' +
      escapeHtml(composer.time) +
      '"></label>' +
      '</div>' +
      tiles() +
      '<p class="live-readout">' +
      readout() +
      '</p>' +
      (composer.kind === 'goal'
        ? '<p class="live-label">Situation</p>' +
          chips(
            'situation',
            Object.keys(data.situations || { EQ: 'Equal strength' }),
            composer.situation,
            (code) => code
          )
        : '<p class="live-label">Minutes</p>' +
          chips(
            'minutes',
            data.penaltyMinutes || [2, 5, 10, 20, 0],
            composer.minutes,
            (value) => (Number(value) === 0 ? 'PS' : String(value))
          ) +
          '<p class="live-label">Offence</p>' +
          offenceChips()) +
      (composer.error
        ? '<p class="live-error">' + escapeHtml(composer.error) + '</p>'
        : '') +
      '<button type="button" class="live-save" data-save-event>' +
      (composer.id ? 'Save the correction' : 'Save') +
      '</button>';
  }

  /* ========================================================================
     Saving
     ======================================================================== */
  function composerBody() {
    const body = {
      kind: composer.kind,
      side: composer.side,
      period: composer.period,
      time: composer.time,
    };

    const number = String(composer.jerseyNumber).trim();

    if (composer.kind === 'goal') {
      body.scorerLineId = composer.scorerLineId;
      body.assist1LineId = composer.assists[0] || null;
      body.assist2LineId = composer.assists[1] || null;
      body.situation = composer.situation;
    } else {
      body.lineId = composer.lineId;
      body.minutes = composer.minutes;
      body.offence = composer.offence;
    }

    /* Only meaningful for a side with no squad here; harmless otherwise. */
    if (!composer.scorerLineId && !composer.lineId) {
      body.jerseyNumber = number === '' ? null : Number(number);
      body.name = composer.name;
    }

    return body;
  }

  async function saveComposer() {
    /* An uncredited goal is legal - IIHF allows a team goal, and a coach who
       could not see the number has to be able to record THAT a goal happened.
       A time is all that is insisted on. */
    if (!composer.time) {
      composer.error = 'Put the time from the board in first.';
      paintComposer();
      return;
    }

    const body = composerBody();

    if (composer.id) {
      /* A correction is made with time to spare, so it goes straight out
         rather than into the queue - a queued PATCH of a row that is itself
         still queued is a knot nobody can untie at the rink. */
      const answer = await api('/api/admin/games/' + gameId + '/events/' + composer.id, {
        method: 'PATCH',
        body,
      });
      adopt(answer);
      closeComposer();
      paintScore();
      paintEvents();
      paintState();
      return;
    }

    body.clientId = clientId();
    queue.push({ body });
    saveQueue();

    /* The composer closes because the event is now safely in the queue, not
       because the server has answered. */
    closeComposer();
    paintScore();
    paintEvents();
    paintState();
    flush();
  }

  async function removeEvent(id) {
    const answer = await api('/api/admin/games/' + gameId + '/events/' + id, {
      method: 'DELETE',
    });
    adopt(answer);
    paintScore();
    paintEvents();
    paintState();
  }

  /* ========================================================================
     Loading
     ======================================================================== */
  async function loadGame(id) {
    gameId = Number(id);
    host.innerHTML = '<div class="admin-loading">Loading the sheet&hellip;</div>';
    data = await api('/api/admin/games/' + gameId + '/live');
    period = '1';
    composer = null;
    loadQueue();
    renderShell();
    flush();
  }

  async function loadChooser() {
    host.innerHTML = '<div class="admin-loading">Looking for a game&hellip;</div>';
    const answer = await api('/api/admin/live/games');

    if (!answer.games.length) {
      host.innerHTML =
        '<div class="admin-empty">No game within a week of today. ' +
        '<a href="games.html">Create one on the game sheets screen</a>, then come back.</div>';
      return;
    }

    host.innerHTML =
      '<div class="live-chooser">' +
      '<h2>Which game?</h2>' +
      answer.games
        .map(
          (game) =>
            '<button type="button" class="live-pick" data-pick-game="' +
            escapeHtml(String(game.id)) +
            '">' +
            '<strong>' +
            escapeHtml(game.teamName || 'Us') +
            ' v ' +
            escapeHtml(game.opponentLabel) +
            '</strong>' +
            '<span>' +
            escapeHtml(dateLabel(game.playedAt)) +
            (game.venue ? ' &middot; ' + escapeHtml(game.venue) : '') +
            ' &middot; ' +
            escapeHtml(String(game.lineCount || 0)) +
            ' named</span>' +
            '</button>'
        )
        .join('') +
      '</div>';
  }

  /* ========================================================================
     One listener each, so a re-render never has to rebind anything
     ======================================================================== */
  host.addEventListener('click', function (event) {
    const pick = event.target.closest('[data-pick-game]');
    if (pick) {
      guard(() => loadGame(pick.dataset.pickGame));
      return;
    }

    if (!data) return;

    const periodButton = event.target.closest('[data-period]');
    if (periodButton) {
      period = periodButton.dataset.period;
      if (composer) composer.period = period;
      paintState();
      paintComposer();
      return;
    }

    const add = event.target.closest('[data-add]');
    if (add) {
      openComposer(add.dataset.add, null);
      return;
    }

    if (event.target.closest('[data-composer-close]')) {
      closeComposer();
      return;
    }

    const counted = event.target.closest('[data-use-counted]');
    if (counted) {
      guard(async () => {
        await api('/api/admin/games/' + gameId, {
          method: 'PATCH',
          body: { scoreFor: countedGoals('us'), scoreAgainst: countedGoals('them') },
        });
        /* The game PATCH answers {ok:true}, so read the record back rather
           than guess what it now says. */
        data.game = (await api('/api/admin/games/' + gameId + '/live')).game;
        paintScore();
        toast('Score set from the events.', 'success');
      });
      return;
    }

    const editEvent = event.target.closest('[data-edit-event]');
    if (editEvent) {
      const id = Number(editEvent.closest('[data-event]').dataset.event);
      const found = (data.events || []).find((e) => e.id === id);
      if (found) openComposer(found.kind, found);
      return;
    }

    const undo = event.target.closest('[data-undo-event], [data-delete-event]');
    if (undo) {
      const id = Number(undo.closest('[data-event]').dataset.event);
      guard(() => removeEvent(id));
      return;
    }

    if (!composer) return;

    const side = event.target.closest('[data-side]');
    if (side) {
      composer.side = side.dataset.side;
      /* Switching sides discards a choice made against the other squad,
         which is the point: those tiles were different people. */
      composer.scorerLineId = null;
      composer.assists = [];
      composer.lineId = null;
      paintComposer();
      return;
    }

    const tile = event.target.closest('[data-tile]');
    if (tile) {
      tapTile(tile.dataset.tile);
      return;
    }

    const situation = event.target.closest('[data-situation]');
    if (situation) {
      composer.situation = situation.dataset.situation;
      paintComposer();
      return;
    }

    const minutes = event.target.closest('[data-minutes]');
    if (minutes) {
      composer.minutes = Number(minutes.dataset.minutes);
      paintComposer();
      return;
    }

    const offence = event.target.closest('[data-offence]');
    if (offence) {
      composer.offence = composer.offence === offence.dataset.offence ? '' : offence.dataset.offence;
      composer.offencesOpen = false;
      paintComposer();
      return;
    }

    if (event.target.closest('[data-offences-open]')) {
      composer.offencesOpen = true;
      paintComposer();
      return;
    }

    if (event.target.closest('[data-save-event]')) {
      guard(() => saveComposer());
    }
  });

  /* Typing is kept on the state object as it happens, so a repaint of the
     composer never loses what is half-entered. */
  host.addEventListener('input', function (event) {
    const target = event.target;

    if (target.matches('[data-live-clock]')) {
      if (composer && !composer.id) composer.time = target.value.trim();
      return;
    }

    if (!composer) return;
    if (target.matches('[data-time]')) composer.time = target.value.trim();
    if (target.matches('[data-jersey]')) composer.jerseyNumber = target.value.trim();
    if (target.matches('[data-name]')) composer.name = target.value.trim();
  });

  /* Enter in the clock field opens a goal, which is the common case. */
  host.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    if (!event.target.matches('[data-live-clock]') || !data) return;
    event.preventDefault();
    openComposer('goal', null);
  });

  guard(() => (gameId ? loadGame(gameId) : loadChooser()));
})();
