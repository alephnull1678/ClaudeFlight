You are tasked with creating a **flight simulator** web app.

I will break this instruction down into the various features and core mechanics of the game - please aim to be as faithful to them as possible.

**Plane Control/Gameplay**

\-WASD should be pitch/yaw, while Q/E controls roll.

\-Shift is throttle, mouse is to look around.

\-Place as much emphasis as possible into the realism of the plane’s physics and motions.

\-The plane model should include a fuselage (body) and the two wings at minimum.

\-If the plane grazes land OR if it is descending at an alarmingly fast rate, a dynamic camera shake effect should be applied.

\-If the plane crashes too hard into land, a quick camera shake effect should play, simulate an “explosion” with various particles, remove control of the plane from the player, and prompt the user to reset.

\-Resetting should be controlled by R: this places the plane in a neutral position on/in the nearest chunk.

\-Pressing F should toggle the player in and out of first-person mode. There should be a smooth transition of the camera moving between the two different states.

\-Escape should bring up a pause menu. The pause menu should be graphically pleasing and minimalistic, and include a toggle for sound.

**Graphics**

\-Low-poly is key. Lean into that art style, but simultaneously keep it aesthetically pleasing to look at. Make visual decisions with intent.

\-Cel-shaded graphics (if possible) would make the low-poly style look more deliberate.

\-Make the sky something other than a solid color. Perhaps a variety of triangles can make it more visually interesting and tie it back to the low-poly style.

\-Rudimentary particle effects (smoke) should come from the plane, and there should be a visual cue for when the plane’s thrusters are on.

\-A FULL day/night cycle should be implemented with a corresponding moving sun/moon.

\-UI should show speed and altitude.

\-Speed should be represented both as a number and as a speedometer on the bottom right corner of the screen. Please ensure to make it as graphically pleasing to look at as possible.

\-Altitude should be shown as both a number and as a small graphic on the top right corner of the screen, with a vertical line and a small graphic representing the altitude of the plane (closer to the bottom of the vertical line = closer to the ground.)

\-Do NOT write the words “Speed” or “Altitude” anywhere around these UI elements: the visuals of these two elements should be enough to convey their purpose to the viewer.

\-Controls should appear on the top left corner, but again, make them graphically pleasing.

**Environment**

\-Infinite, procedurally generated with a chunk system!

\-Trees of various types and sizes to provide variety.

\-Terrain should NOT interpolate smoothly - keep it jagged to fit with low-poly style.

\-Terrain should have fluctuations in height to simulate hills, mountains, etc

\-Include rivers, ponds, lakes

\-Either include some sort of distance fog to hide chunk loading or include billboarded mountains in the background to simulate the feeling of distance.

\-Jagged clouds that move slowly across the sky.

\-Rarer details, such as houses, rock formations, and sandy areas should be included

**Biomes**

\-~10 various “biomes” should exist (smooth transitions between biomes aren’t necessary.) The biomes should be visually distinct by:

\-changing the colour of the ground,

\-changing the height fluctuations of the terrain, or

\-changing the frequency of key identifiers such as cloud frequency or rare detail frequency (e.g. one biome might have many homes, other might be very rocky, etc.)

\-A small text on the top of the screen should display the biome the plane is currently in.

**Audio**

\-a procedurally generated, simple motor sound should emit from the plane and increase in intensity greatly when thrusters are activated.