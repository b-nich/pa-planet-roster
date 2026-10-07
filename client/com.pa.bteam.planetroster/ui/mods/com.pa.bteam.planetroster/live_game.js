// Planet Roster - main live game view (live_game scene): panel host + data
//
// Everything visible in the HUD is a separate panel composited over the 3D
// world; DOM added to the main page is never drawn. So this script creates a
// new <panel> element on the left side pointing at roster.html (the same way
// live_game.html declares its own panels), then feeds it data:
//   api.camera.getFocus(holodeck).planet()               -> planet in view
//   api.getWorldView(0).getArmyUnits(armyIndex, planet)  -> { spec: [unitId, ...] }
//   /pa/units/.../unit.json  (fetched once per spec)      -> unit_types for grouping
//   model.itemDetails[spec]                               -> name, strategic icon
//   idle counts forwarded from the control group bar       -> idle builders
// Selection requests from the panel are served with api.select.unitsById.
//
// Runs after `model = new LiveGameViewModel()` and before ko.applyBindings.
(function () {
    'use strict';

    var TAG = '[planetroster]';
    var MOD_ID = 'com.pa.bteam.planetroster';
    var PANEL = 'planet_roster';
    var PAGE = 'coui://ui/mods/' + MOD_ID + '/roster.html';
    var POLL_MS = 1000;

    if (!window.model || !window.handlers || !model.armyId || !window.api || !api.Panel) {
        console.error(TAG + ' live game model not available; mod disabled');
        return;
    }

    var log = function (text) { console.log(TAG + ' ' + text); };

    // ------------------------------------------------------------------
    // Panel element (left side)
    // ------------------------------------------------------------------
    var container = document.createElement('div');
    container.className = 'planetroster-cont ignoreMouse';
    container.setAttribute('style', 'position: fixed; left: 0px; top: 150px; width: 320px; min-height: 40px; z-index: 5; pointer-events: none;');
    var panelElement = document.createElement('panel');
    panelElement.id = PANEL;
    // The engine's view region is this element's bounding box. An unknown
    // element lays out inline, so its box would be one text line at the
    // baseline of the dock inside it, not the dock itself. Make it a block.
    panelElement.setAttribute('style', 'display: block;');
    panelElement.setAttribute('src', PAGE);
    panelElement.setAttribute('no-gpu', '');
    panelElement.setAttribute('no-keyboard', '');
    panelElement.setAttribute('yield-focus', '');
    panelElement.setAttribute('fit', 'dock-top-left');
    container.appendChild(panelElement);
    document.body.appendChild(container);
    try {
        api.Panel.bindElement(panelElement);
        log('panel element bound for ' + PAGE);
    }
    catch (e) {
        console.error(TAG + ' panel creation failed', e);
    }

    // Diagnostics: did the engine actually create a view for the element?
    var describePanel = function (when) {
        var p = api.panels && api.panels[PANEL];
        var rect = container.getBoundingClientRect();
        var dock = panelElement.querySelector('panel-dock');
        log('panel check (' + when + '): ' +
            (p ? ('object present, engine id=' + p.id + ' visible=' + p.visible + ' fit=' + p.fit + ' region=' + JSON.stringify(p.region))
               : 'NO panel object (engine refused the create call or it was destroyed)') +
            ' container=' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height) +
            ' jqVisible=' + $(container).is(':visible') + '/' + $(panelElement).is(':visible') +
            ' dock=' + (dock ? Math.round(dock.getBoundingClientRect().width) + 'x' + Math.round(dock.getBoundingClientRect().height) : 'none') +
            ' panelsKnown=' + _.keys(api.panels || {}).join(','));
    };
    setTimeout(function () { describePanel('3s'); }, 3000);
    setTimeout(function () { describePanel('15s'); }, 15000);

    // ------------------------------------------------------------------
    // Spec lookups
    // ------------------------------------------------------------------
    var baseSpec = function (spec) { return String(spec).replace(/\.json.*$/, '.json'); };

    var detailsFor = function (spec) {
        if (!model.itemDetails)
            return null;
        return model.itemDetails[spec] || model.itemDetails[baseSpec(spec)] || null;
    };

    var nameFor = function (spec) {
        var details = detailsFor(spec);
        var name = details ? ko.unwrap(details.name) : null;
        if (!name) {
            var match = /\/([^\/]+)\.json/.exec(spec || '');
            return match ? match[1].replace(/_/g, ' ') : String(spec);
        }
        return String(name).indexOf('!LOC:') === 0 ? loc(name) : String(name);
    };

    var iconFor = function (spec) {
        var details = detailsFor(spec);
        var sicon = details ? ko.unwrap(details.sicon) : null;
        return sicon ? 'coui://ui/main/atlas/icon_atlas/img/strategic_icons/icon_si_' + sicon + '.png' : '';
    };

    // unit_types per spec, fetched from the unit's JSON once. Many units (all
    // commander variants, for example) declare no unit_types of their own and
    // inherit them through base_spec, so follow that chain.
    var typesCache = {};        // base spec -> array of UNITTYPE_* (or null while loading)
    var MAX_BASE_DEPTH = 6;

    var fetchSpecTypes = function (path, depth, done) {
        // Specs live at coui://pa/units/...; the stock code reaches them via a
        // protocol-relative "//pa/..." URL. Fetch as text and parse ourselves.
        $.ajax({ url: 'coui:/' + path, dataType: 'text' }).done(function (text) {
            var json = null;
            try {
                json = JSON.parse(text);
            }
            catch (e) {
                log('unit spec ' + path + ' is not JSON: ' + e);
            }
            var types = (json && json.unit_types) || [];
            if (types.length || !json || !json.base_spec || depth >= MAX_BASE_DEPTH) {
                done(types);
                return;
            }
            fetchSpecTypes(baseSpec(json.base_spec), depth + 1, done);
        }).fail(function (xhr, status) {
            log('could not read unit spec coui:/' + path + ' (' + status + ')');
            done([]);
        });
    };

    var typesFor = function (spec) {
        var base = baseSpec(spec);
        if (typesCache.hasOwnProperty(base))
            return typesCache[base];
        typesCache[base] = null;
        fetchSpecTypes(base, 0, function (types) {
            typesCache[base] = types;
            if (!types.length)
                log('no unit_types found for ' + base + ' (or its base specs); grouped as Other');
            dirty = true;
        });
        return null;
    };

    // ------------------------------------------------------------------
    // Grouping. First matching rule wins.
    // ------------------------------------------------------------------
    var GROUPS = [
        { key: 'commanders', name: '!LOC:Commanders', test: function (t) { return t.Commander || t.SupportCommander; } },
        { key: 'fabbers',    name: '!LOC:Fabbers',    test: function (t) { return t.Mobile && t.Fabber; } },
        { key: 'bots',       name: '!LOC:Bots',       test: function (t) { return t.Mobile && t.Bot; } },
        { key: 'vehicles',   name: '!LOC:Vehicles',   test: function (t) { return t.Mobile && (t.Tank || t.Vehicle) && !t.Naval; } },
        { key: 'air',        name: '!LOC:Air',        test: function (t) { return t.Mobile && t.Air; } },
        { key: 'naval',      name: '!LOC:Naval',      test: function (t) { return t.Mobile && (t.Naval || t.Sub); } },
        { key: 'orbital',    name: '!LOC:Orbital',    test: function (t) { return t.Mobile && t.Orbital; } },
        { key: 'factories',  name: '!LOC:Factories',  test: function (t) { return t.Structure && t.Factory; } },
        { key: 'economy',    name: '!LOC:Economy',    test: function (t) { return t.Structure && (t.Economy || t.MetalProduction || t.EnergyProduction); } },
        { key: 'defense',    name: '!LOC:Defense',    test: function (t) { return t.Structure && t.Defense; } },
        { key: 'structures', name: '!LOC:Structures', test: function (t) { return t.Structure; } },
        { key: 'other',      name: '!LOC:Other',      test: function () { return true; } }
    ];
    var BUILDER_GROUPS = { commanders: true, fabbers: true, factories: true };

    var groupFor = function (spec) {
        var types = typesFor(spec);
        if (!types)
            return 'other';     // not loaded yet
        var t = {};
        _.forEach(types, function (type) { t[String(type).replace(/^UNITTYPE_/, '')] = true; });
        for (var i = 0; i < GROUPS.length; ++i)
            if (GROUPS[i].test(t))
                return GROUPS[i].key;
        return 'other';
    };

    // ------------------------------------------------------------------
    // Idle counts per planet per spec, forwarded from the control group bar
    // ------------------------------------------------------------------
    var idleByPlanet = {};      // planet id -> spec -> idle count
    handlers['planet_roster.idle'] = function (payload) {
        var next = {};
        _.forEach(['fabber', 'factory'], function (group) {
            _.forEach((payload && payload[group]) || {}, function (element, planetId) {
                var bucket = next[planetId] || (next[planetId] = {});
                _.forEach((element && element.spec_counts) || {}, function (count, spec) {
                    bucket[spec] = (bucket[spec] || 0) + (Number(count) || 0);
                });
            });
        });
        idleByPlanet = next;
        dirty = true;
    };

    // ------------------------------------------------------------------
    // Focus planet
    // ------------------------------------------------------------------
    var focusPlanet = function () {
        try {
            var holodeckId = (api.Holodeck && api.Holodeck.focused && api.Holodeck.focused.id) || 0;
            var focus = api.camera.getFocus(holodeckId);
            var planet = focus && focus.planet ? focus.planet() : -1;
            return _.isFinite(planet) ? planet : -1;
        }
        catch (e) {
            return -1;
        }
    };

    var planetName = function (index) {
        var planets = model.celestialViewModels ? model.celestialViewModels() : [];
        var vm = planets[index];
        var name = vm ? ko.unwrap(vm.name) : null;
        return name || (loc('!LOC:Planet') + ' ' + (index + 1));
    };

    // ------------------------------------------------------------------
    // State and polling
    // ------------------------------------------------------------------
    var pinnedPlanet = -1;      // -1 = follow the camera
    var lastIds = {};           // spec -> [unit ids] on the displayed planet
    var lastGroupSpecs = {};    // group key -> [specs]
    var dirty = false;
    var fetching = false;
    var loggedOnce = false;

    var sent = 0;
    var send = function (payload) {
        api.Panel.message(PANEL, 'roster.update', payload);
        sent = sent + 1;
        if (sent === 1 || sent === 10)
            log('sent update #' + sent + ': planet=' + payload.planet + ' units=' + payload.unitCount + ' groups=' + (payload.groups || []).length);
    };

    var build = function (planet, bySpec) {
        var groups = {};
        _.forEach(GROUPS, function (group) {
            groups[group.key] = { key: group.key, name: loc(group.name), total: 0, idle: 0, rows: [] };
        });
        var idle = idleByPlanet[String(planet)] || {};
        var units = 0;
        lastIds = {};
        lastGroupSpecs = {};

        _.forEach(bySpec, function (ids, spec) {
            var count = (ids && ids.length) || 0;
            if (!count)
                return;
            units = units + count;
            lastIds[spec] = ids;
            var key = groupFor(spec);
            (lastGroupSpecs[key] = lastGroupSpecs[key] || []).push(spec);
            var group = groups[key];
            var idleCount = BUILDER_GROUPS[key] ? (idle[spec] || idle[baseSpec(spec)] || 0) : 0;
            group.total = group.total + count;
            group.idle = group.idle + idleCount;
            group.rows.push({ spec: spec, name: nameFor(spec), icon: iconFor(spec), count: count, idle: idleCount });
        });

        var list = _.map(GROUPS, function (group) {
            var g = groups[group.key];
            g.rows = _.sortBy(g.rows, function (row) { return -row.count; });
            return g;
        });

        send({
            planet: planet,
            planetName: planetName(planet),
            pinned: pinnedPlanet >= 0,
            unitCount: units,
            groups: list,
            status: ''
        });
    };

    var refresh = function () {
        if (fetching)
            return;
        var armyIndex = model.armyIndex ? model.armyIndex() : -1;
        var planet = pinnedPlanet >= 0 ? pinnedPlanet : focusPlanet();
        if (!_.isFinite(armyIndex) || armyIndex < 0 || planet < 0) {
            send({ planet: -1, planetName: '', pinned: pinnedPlanet >= 0, unitCount: 0, groups: [],
                   status: armyIndex < 0 ? loc('!LOC:No army') : loc('!LOC:No planet in view') });
            return;
        }
        fetching = true;
        try {
            api.getWorldView(0).getArmyUnits(armyIndex, planet).then(function (bySpec) {
                fetching = false;
                dirty = false;
                if (!loggedOnce) {
                    loggedOnce = true;
                    log('planet ' + planet + ' (' + planetName(planet) + '): ' + _.keys(bySpec || {}).length + ' unit types');
                }
                build(planet, bySpec || {});
            }, function (error) {
                fetching = false;
                log('getArmyUnits failed: ' + JSON.stringify(error));
            });
        }
        catch (e) {
            fetching = false;
            log('refresh threw: ' + e);
        }
    };

    var lastPlanet = -2;
    var tick = function () {
        try {
            var planet = pinnedPlanet >= 0 ? pinnedPlanet : focusPlanet();
            if (planet !== lastPlanet) {
                lastPlanet = planet;
                dirty = true;
            }
            refresh();
        }
        catch (e) {
            log('tick threw: ' + e);
        }
    };
    setInterval(tick, POLL_MS);
    // Re-send quickly when spec types or idle data arrive between polls.
    setInterval(function () {
        if (dirty && !fetching)
            refresh();
    }, 250);

    // ------------------------------------------------------------------
    // Requests from the panel
    // ------------------------------------------------------------------
    handlers['planet_roster.select'] = function (payload) {
        var ids = [];
        if (payload && payload.spec && lastIds[payload.spec])
            ids = lastIds[payload.spec];
        else if (payload && payload.group && lastGroupSpecs[payload.group])
            _.forEach(lastGroupSpecs[payload.group], function (spec) { ids = ids.concat(lastIds[spec] || []); });
        if (!ids.length)
            return;
        api.select.unitsById(ids, false);
        if (payload.track && api.camera && api.camera.track)
            api.camera.track(true);
    };

    handlers['planet_roster.pin'] = function () {
        pinnedPlanet = pinnedPlanet >= 0 ? -1 : focusPlanet();
        dirty = true;
        refresh();
    };

    handlers['planet_roster.ready'] = function () {
        dirty = true;
        refresh();
    };

    log('loaded');
})();
