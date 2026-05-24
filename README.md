# Minecraft TikTok Show MVP

Gifts create compact 7 x 7 x 7 flag objects that fall into one fixed arena:

```js
const ARENA = {
	origin: { x: 100, y: 70, z: 100 },
	spawnHeight: 92,
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

Supported gifts (STRICT tier mapping):

Cheap (4x4x4 objects)

- `gg` -> Germany
- `rose` -> Ukraine
- `tiktok` -> France
- `perfume` -> Russia
- `finger heart` -> France
- `heart me` -> Spain
- `poland` -> Poland
- `lithuania` -> Lithuania

Medium (5x5x5 objects)

- `cap` -> Germany
- `hand heart` -> Ukraine
- `love you` -> Poland
- `sunglasses` -> Italy
- `donut` -> Russia

Expensive (7x7x7 objects + effects)

- `galaxy` -> USA + TNT chaos
- `lion` -> Germany + lightning
- `universe` -> Ukraine + fireworks
- `rocket` -> USA + TNT chaos
- `castle` -> France
- `money gun` -> Russia + TNT chaos
- `drama queen` -> Russia + lightning

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

2. Start the Minecraft server.

3. Start Node.js:

```bash
npm start
```

4. Join the server in Minecraft under the nickname `scandi`.

5. Enable the resource pack in the `scandi` Minecraft client.

6. In Minecraft, run:

```mcfunction
/gamemode spectator scandi
/spectate BotName scandi
```

Replace `BotName` with the Mineflayer bot username from `/status`.

7. Keep the Minecraft view in first person. Do not use F5.

8. OBS captures the Minecraft window with the player `scandi`.

After startup, `scandi` should spectate the Mineflayer bot. If `ENABLE_CAMERA_SYNC=true`, the app also tries to keep `scandi` synced to the bot camera.

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
- `gray_concrete_powder` -> Russia

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
- `gray_concrete_powder.png`

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
- `gray_concrete_powder.png`: Russia flag block.

### Installing the Resource Pack

1. Open `%appdata%\.minecraft\resourcepacks`.
2. Copy `resource-pack-template/`.
3. Rename the copied folder to `TikTokFlagsPack`.
4. Put custom textures into `assets/minecraft/textures/block/`.
5. Start Minecraft as `scandi`.
6. Enable the resource pack in `Settings -> Resource Packs`.
7. OBS captures the Minecraft window with `scandi`.

The resource pack is only needed on the `scandi` client. Mineflayer does not use it.

### Custom Flag Music

Custom flag sounds are loaded from the same resource pack used by the `scandi` client.

1. Convert audio to `.ogg`.
2. Put files here:

```txt
resource-pack-template/assets/minecraft/sounds/flags/
```

3. Use these file names:

- `ukraine.ogg`
- `germany.ogg`
- `poland.ogg`
- `france.ogg`
- `italy.ogg`
- `spain.ogg`
- `lithuania.ogg`
- `usa.ogg`
- `austria.ogg`
- `argentina.ogg`
- `russia.ogg`

4. Enable the resource pack on the `scandi` client.
5. Test in Minecraft:

```mcfunction
/playsound flags.germany master @a
```

Use short 5-15 second versions, not full anthems, so overlapping gifts do not turn the stream audio into noise.

## TikTok Live Setup

This project exposes a simple HTTP API. Any TikTok Live connector (your own script / OBS tool / bridge) can forward events into it.

1. Start the bot:

```bash
npm start
```

2. Forward TikTok gift events into:

- `POST http://localhost:3001/gift`
- JSON body example:

```json
{ "gift": "gg", "username": "viewer" }
```

3. Forward like spikes into:

- `POST http://localhost:3001/likes`
- JSON body example:

```json
{ "count": 200, "username": "viewer" }
```

If you don’t have a TikTok connector yet, use the curl tests below to validate the full pipeline.

# Real TikTok Live Setup

1. Install dependencies:

```bash
npm install
```

2. Add your TikTok Live username to `.env`:

```env
TIKTOK_USERNAME=your_tiktok_username
```

Use the unique TikTok username from the live URL, without `@`.

3. Start your TikTok stream.

4. Start the Minecraft bot:

```bash
npm start
```

5. In the console, check for:

```txt
[TIKTOK] connected
[TIKTOK] roomId=...
[TIKTOK] username=...
```

Real TikTok events use the same internal flow as the curl tests:

- gifts call the existing gift handler
- likes call the existing like tracker
- follows show a title and fireworks near the bot
- shares spawn lightning near the arena

If `TIKTOK_USERNAME` is missing or still set to the placeholder, TikTok Live is disabled and the HTTP test endpoints continue to work.

## TikTok Gift Setup (Tier System)

1 gift = 1 spawn event (no partial matching).

- Cheap gift -> `4x4x4`
- Medium gift -> `5x5x5`
- Expensive gift -> `7x7x7`

## Test Endpoints

```bash
curl -X POST http://localhost:3001/gift -H "Content-Type: application/json" -d '{"gift":"gg","username":"test"}'

curl -X POST http://localhost:3001/gift -H "Content-Type: application/json" -d '{"gift":"rose","username":"test"}'

curl -X POST http://localhost:3001/gift -H "Content-Type: application/json" -d '{"gift":"perfume","username":"test"}'

curl -X POST http://localhost:3001/gift -H "Content-Type: application/json" -d '{"gift":"money gun","username":"bigDonator"}'

curl -X POST http://localhost:3001/likes -H "Content-Type: application/json" -d '{"count":200}'

curl -X POST http://localhost:3001/test-sound -H "Content-Type: application/json" -d '{"sound":"flags.russia"}'

curl -X POST http://localhost:3001/test-country-sound -H "Content-Type: application/json" -d '{"country":"ukraine"}'
```

## Flag Music Debug

If an anthem does not play when a flag spawns:

1. Test directly in Minecraft:

```mcfunction
/playsound flags.ukraine master @a ~ ~ ~ 10 1
```

2. If the direct Minecraft command works but the flag spawn does not, the problem is in the Node.js `playFlagMusic` flow.

3. Check Node.js logs for:

```txt
[SPAWN] calling playFlagMusic
[FLAG_MUSIC] command=
```

4. Test the API sound path:

```bash
curl -X POST http://localhost:3001/test-sound -H "Content-Type: application/json" -d '{"sound":"flags.ukraine"}'
curl -X POST http://localhost:3001/test-country-sound -H "Content-Type: application/json" -d '{"country":"ukraine"}'
```

# Stream Launch Checklist

- Start Minecraft server
- Start Node.js bot
- Join as `scandi`
- Enable resource pack
- `/gamemode spectator scandi`
- `/spectate BotName scandi`
- Start OBS
- Test `/playsound flags.germany master scandi`
- Test gift `gg`
- Test gift `rose`
- Test gift `perfume`
- Test `/likes 200`
- Go live

## Performance Notes

- Lightning and fireworks are capped per spawn.
- Chaos has a low default chance.
- RCON filters noisy command responses like `No blocks were filled`.
- Objects are not cleared with one large `/fill air`; the bot breaks visible blocks with `bot.dig` and uses `/setblock air` only as fallback.
