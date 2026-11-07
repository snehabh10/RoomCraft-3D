# RoomCraft 3D

A browser-based 3D interior-design game built with Three.js, WebGL, Vite and GSAP.

## Run in VS Code

1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Open Terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Open the localhost address shown by Vite.

## Included systems

- 3D room with walls, floor, ceiling, window, curtains and door
- Procedural furniture
- Furniture catalogue
- 3D click/drag placement
- Rotation, scaling, delete and duplicate
- Smart wall/floor snapping
- Material library with per-surface colour + texture customization
- Design styles
- Day / afternoon / sunset / night lighting
- Dynamic directional sunlight
- Cleaning
- Unboxing animation
- Design challenge
- Rule-based scoring
- XP and levels
- Save/load with localStorage
- Undo/redo
- Photo mode
- Before/after mode
- Multiple room templates
- Keyboard shortcuts
- Shadows and PBR-style materials

## Controls

- Drag: move selected furniture
- R: rotate
- Delete: delete selected item
- P: photo mode
- Ctrl+Z: undo
- Ctrl+Y: redo
- Mouse wheel: zoom
- Mouse drag on empty space: orbit camera

## Notes

The project intentionally uses procedural fallback furniture so it works without downloading external 3D assets. GLB/GLTF assets can be added later through the asset loader architecture.

This is an original college Computer Graphics project and is not a copy of any commercial game's proprietary assets or UI.

## Surface Customization

Open **Materials** and choose a target: selected furniture/object, floor, each wall, ceiling, door, window glass, or curtains. Choose a base colour, procedural texture (wood, marble, stone, fabric, leather, metal, tiles, glass, plain), and roughness, then apply it. The textures are generated locally in the browser so the project does not depend on external image files.


## Distinct Room Templates

Each room template now has its own visual identity and fixed architectural details:
- **Living Room:** warm wood floor, curtains, window, sofa-and-coffee-table layout, rug, plants and shelving.
- **Bedroom:** warmer timber floor, cooler curtains, bed, bedside table, wardrobe, rug and plant.
- **Kitchen:** stone-like floor, tiled backsplash, lower and upper cabinets, counter, sink and faucet, cooktop with burners, refrigerator and island.
- **Bathroom:** cool tile palette, shower zone with glass screen, shower base, vanity and basin, mirror, toilet, frosted window and towel rail.
- **Study:** wood floor, wide window, desk, office chair, bookshelf, laptop and task lamp.

These rooms use procedural geometry and generated materials, so they are distinct interactive 3D layouts rather than separate photographic models.


## Room layout update

Removed the pre-placed decorative floor lamps from the default Living Room, Bedroom, and Study layouts so the middle of each room stays clear. The optional Lamp item remains available in the furniture catalogue if a user wants to add one.
