// Planet Roster - control group bar panel (live_game_control_group_bar scene)
//
// The engine pushes idle fabber and factory counts, per planet and per unit
// type, only to this panel. Forward every update to the main live_game view
// so the roster can show idle counts next to builders.
(function () {
    'use strict';

    if (!window.api || !api.Panel || !window.handlers)
        return;

    var stock = handlers.idle_unit_counts;
    handlers.idle_unit_counts = function (payload) {
        if (stock)
            stock(payload);
        if (api.Panel.parentId)
            api.Panel.message(api.Panel.parentId, 'planet_roster.idle', payload);
    };

    console.log('[planetroster] control group bar forwarding idle counts');
})();
