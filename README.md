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

### Recipe: a mod-created panel

This is the first of these mods to create its own panel rather than inject
into an existing one. Three things are required, each learned from a failed
attempt:

1. **Create it the way the game does.** Append a `<panel id="..." src="coui://ui/mods/<mod>/page.html" fit="dock-top-left" no-gpu no-keyboard yield-focus>`
   element to the live game page and call `api.Panel.bindElement(element)`.
   The engine accepts panels created after startup.
2. **Lay the element out as a block** (`style="display: block"`). The engine's
   view region is the element's bounding box; an unknown element is inline, so
   its box is one text line at the baseline of the dock inside it, and the
   view ends up one line tall in the wrong place.
3. **Give the page's `<body-dock>` an explicit block size.** The page reports
   the dock's measured size to the main view, which sizes the view from it; an
   inline dock measures 0x0.

The page itself is a normal panel page: `bundle://boot/boot.js`, a knockout
model, `app.registerWithCoherent(model, handlers)`, `ko.applyBindings`.
Messages flow with `api.Panel.message('<panel id>', ...)` from the main view
and `api.Panel.message(api.Panel.parentId, ...)` from the page. Elements that
should take the mouse carry `pointer-events: all`; everything else falls
through to the world.

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
