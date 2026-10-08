// Planet Roster - the panel page. Receives render state from the main live
// game view (live_game.js) via 'roster.update' and sends selection requests
// back to it.
var model;
var handlers = {};

$(document).ready(function () {
    'use strict';

    function RosterModel() {
        var self = this;

        self.planet = ko.observable(-1);
        self.planetName = ko.observable('');
        self.pinned = ko.observable(false);
        self.unitCount = ko.observable(0);
        self.groups = ko.observableArray([]);
        self.status = ko.observable('');
        self.collapsed = ko.observable(false).extend({ local: 'planetroster_collapsed' });
        // Tiles (icon + count) by default; a list with names is available.
        self.listLayout = ko.observable(false).extend({ local: 'planetroster_list_layout' });
        self.toggleLayout = function () { self.listLayout(!self.listLayout()); };

        var send = function (name, payload) {
            if (api.Panel.parentId)
                api.Panel.message(api.Panel.parentId, name, payload || {});
        };

        self.toggleCollapsed = function () { self.collapsed(!self.collapsed()); };
        self.togglePin = function () { send('planet_roster.pin'); };
        self.selectRow = function (row) {
            console.log('[planetroster] row clicked: ' + row.spec + ' x' + row.count);
            send('planet_roster.select', { spec: row.spec });
        };
        self.selectGroup = function (group) {
            console.log('[planetroster] group clicked: ' + group.key + ' total ' + group.total);
            if (group.total > 0)
                send('planet_roster.select', { group: group.key });
        };

        self.update = function (payload) {
            self.planet(payload.planet);
            self.planetName(payload.planetName || '');
            self.pinned(!!payload.pinned);
            self.unitCount(payload.unitCount || 0);
            self.groups(payload.groups || []);
            self.status(payload.status || '');
        };
    }

    model = new RosterModel();

    var received = 0;
    handlers['roster.update'] = function (payload) {
        if (!payload)
            return;
        model.update(payload);
        received = received + 1;
        if (received === 1)
            console.log('[planetroster] roster page received first update: planet=' + payload.planet + ' units=' + payload.unitCount);
    };

    console.log('[planetroster] roster page script running, pageId=' + api.Panel.pageId + ' parentId=' + api.Panel.parentId);

    // inject per scene mods
    if (window.scene_mod_list && scene_mod_list['planet_roster'])
        loadMods(scene_mod_list['planet_roster']);

    // setup send/recv messages and signals
    app.registerWithCoherent(model, handlers);

    // Activates knockout.js
    ko.applyBindings(model);

    // Ask the main view for the current state right away.
    if (api.Panel.parentId)
        api.Panel.message(api.Panel.parentId, 'planet_roster.ready', {});
    console.log('[planetroster] roster page bound, body ' + document.body.offsetWidth + 'x' + document.body.offsetHeight);
});
