# Minecraft TikTok Show MVP

Gifts create compact 7 x 7 x 7 flag objects that fall into one fixed arena:

```js
const ARENA = {
  origin: { x: 100, y: 70, z: 100 },
  spawnHeight: 92
}
```

Spawn and break are separate queues. A new object can fall while the bot is still breaking the previous one. TNT, lightning, fireworks, mobs, weather, and panic effects run as instant events and do not block the queues.

## Run

```bash
npm start
```

Trigger gifts:

```bash
curl -X POST http://localhost:3001/gift \
  -H "Content-Type: application/json" \
  -d '{"gift":"gg","username":"donatorName"}'
```

Supported gifts:

- `gg` or `germany`: Germany object
- `rose` or `ukraine`: Ukraine object
- `tiktok` or `france`: France object
- `poland`: Poland object
- `galaxy` or `tnt`: TNT instant event
- `big gift`: bigger TNT and stronger chaos chance

Status:

```bash
curl http://localhost:3001/status
```

The response includes `botPose`, queue state, and `cameraSync`.

## OBS First-Person POV

Mineflayer does not render video. Use a real Minecraft client for the stream POV.

1. In `.env`, enable camera sync:

```env
ENABLE_CAMERA_SYNC=true
CAMERA_USERNAME=scandi
CAMERA_MODE=first_person
CAMERA_SYNC_INTERVAL_MS=60
```

2. On Windows, join the server in Minecraft under the nickname `scandi`.

3. In Minecraft, run:

```mcfunction
/gamemode spectator scandi
```

The app also tries this automatically after the Mineflayer bot spawns.

4. Keep the Minecraft view in first person. Do not use F5.

5. OBS captures the Minecraft window with the player `scandi`.

6. Start Node.js:

```bash
npm start
```

After startup, `scandi` should repeat the Mineflayer bot position and head rotation.

`CameraSync` synchronizes:

- position
- yaw
- pitch

Default sync interval is `60ms`. If the camera is too jittery, increase:

```env
CAMERA_SYNC_INTERVAL_MS=70
```

If camera shakes are too strong, reduce `cameraShakeIntensity` in:

```txt
src/config/botBehavior.js
```

If `scandi` does not move:

- check `ENABLE_CAMERA_SYNC=true`
- check `CAMERA_USERNAME=scandi`
- check RCON host, port, and password
- check that `scandi` is online on the server
- check `/status` and look at the `cameraSync` block

## Resource Pack Mapping

Mineflayer does not render graphics or create new blocks. Resource packs only replace textures for vanilla block IDs on the Minecraft client.

Each country uses one vanilla gravity block. The resource pack changes that block texture into the country flag block.

OBS captures the Minecraft client for `scandi`, so install the resource pack in the `scandi` client. Mineflayer does not use the resource pack.

Mapping:

- `sand` -> Ukraine
- `red_sand` -> Germany
- `white_concrete_powder` -> Poland
- `blue_concrete_powder` -> France
- `green_concrete_powder` -> Italy
- `yellow_concrete_powder` -> Spain
- `black_concrete_powder` -> Lithuania
- `gravel` -> USA
- `orange_concrete_powder` -> Austria
- `light_blue_concrete_powder` -> Argentina

If you see normal `sand`, `red_sand`, or `gravel`, the resource pack is not enabled for `scandi` or the matching PNG was not replaced. If you see flags, the resource pack works.

A template is included in:

```txt
resource-pack-template/
```

Replace these files in `resource-pack-template/assets/minecraft/textures/block/`:

- `sand.png`
- `red_sand.png`
- `white_concrete_powder.png`
- `blue_concrete_powder.png`
- `green_concrete_powder.png`
- `yellow_concrete_powder.png`
- `black_concrete_powder.png`
- `gravel.png`
- `orange_concrete_powder.png`
- `light_blue_concrete_powder.png`

Then zip the contents of `resource-pack-template/` and enable that resource pack in the Minecraft client used for OBS.

### Resource Pack Texture Guide

Each PNG should be `16x16` or `32x32`. Avoid transparency for normal block textures unless you know the target Minecraft version supports the effect you want.

- `sand.png`: Ukraine flag block.
- `red_sand.png`: Germany flag block.
- `white_concrete_powder.png`: Poland flag block.
- `blue_concrete_powder.png`: France flag block.
- `green_concrete_powder.png`: Italy flag block.
- `yellow_concrete_powder.png`: Spain flag block.
- `black_concrete_powder.png`: Lithuania flag block.
- `gravel.png`: USA flag block.
- `orange_concrete_powder.png`: Austria flag block.
- `light_blue_concrete_powder.png`: Argentina flag block.

### Installing the Resource Pack

1. Open `%appdata%\.minecraft\resourcepacks`.
2. Copy `resource-pack-template/`.
3. Rename the copied folder to `TikTokFlagsPack`.
4. Put custom textures into `assets/minecraft/textures/block/`.
5. Start Minecraft as `scandi`.
6. Enable the resource pack in `Settings -> Resource Packs`.
7. OBS captures the Minecraft window with `scandi`.

The resource pack is only needed on the `scandi` client. Mineflayer does not use it.

## Performance Notes

- Lightning and fireworks are capped per spawn.
- Chaos has a low default chance.
- RCON filters noisy command responses like `No blocks were filled`.
- Objects are not cleared with one large `/fill air`; the bot breaks visible blocks with `bot.dig` and uses `/setblock air` only as fallback.
