# Planet Roster for Planetary Annihilation: TITANS

An always-on list, on the left of the screen, of your units on the planet you
are looking at. Units are grouped into categories, each unit type shows its
strategic icon and count, and clicking a row selects those units.

| Identifier | `com.pa.bteam.planetroster` |
|-----------|-----------------------------|

Client mod only. Nothing is sent to the server and other players do not need
it.

## What it shows

Groups, always listed in this order, with rows only for unit types you
actually have on the planet:

Commanders (commander and sub-commanders), Fabbers, Bots, Vehicles, Air,
Naval, Orbital, Factories, Economy, Defense, Structures, Other.

- The header shows the planet name and total unit count. The dot pins the
  roster to the current planet; otherwise it follows the camera.
- Fabber, commander and factory rows show an idle count when any are idle.
- Click a row to select exactly those units. Click a group header to select
  the whole group on that planet.
- The toggle at the left of the header collapses the roster to one line; the
  choice is remembered.

## How it works

Everything visible in the HUD is a separate panel composited over the world,
and DOM added to the main live game page is never drawn. So the main view
script (`live_game.js`) creates a new `<panel>` element pointing at
`roster.html`, the same way the game's own `live_game.html` declares its
panels, and feeds it render state once a second.

Data sources, all client side:

- `api.camera.getFocus(holodeck).planet()` for the planet in view.
- `api.getWorldView(0).getArmyUnits(armyIndex, planet)` for the army's units
  on that planet, grouped by spec with unit ids.
- Each unit's own spec JSON (`/pa/units/.../unit.json`, fetched once per type)
  for its `unit_types` tags, which drive the grouping.
- `model.itemDetails` for localised names and strategic icons.
- Idle fabber and factory counts the engine pushes to the control group bar,
  forwarded by `control_group_bar.js`.

Selection uses `api.select.unitsById` with the ids from the last poll.

## Developer install

Run from this folder in PowerShell after every edit:

```powershell
.\install-dev.ps1
```

This copies the mod into `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\mods\com.pa.bteam.planetroster`.
Return to the main menu or restart PA afterwards, then enable "Planet Roster"
under Community Mods, Installed. `.\uninstall-dev.ps1` removes it.

### Debugging

The client log (`%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\log\PA-<date>.txt`)
shows `[planetroster] panel element created`, `[planetroster] loaded`, and on
the first poll a line naming the planet and how many unit types were found.

## License

MIT, see `LICENSE`.
