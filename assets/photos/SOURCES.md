# Where these photographs came from

Every file here was uploaded to the federation's Wix site and is carried over
with this migration. The site's own markup served resized, re-encoded copies
(`.../v1/fill/w_600,h_400,enc_avif/...`); dropping the `/v1/<transform>/`
segment from a Wix media URL returns the master that was uploaded, which is
what these are. They were then capped at a 1600px long edge and re-encoded
once (JPEG q85 progressive, PNG optimised), taking the set from 18.2 MB to
6.8 MB with no visible change at the sizes the site displays.

`server/lib/photos.js` maps each file to the row it belongs to.

To fetch any of them again:

```
https://static.wixstatic.com/media/<media id>
```

## In use

| File | Media id |
|---|---|
| `sponsors/pillar5.png` | `4a228d_c2507078bd7141a3ab13f5a11a12ca64~mv2.png` |
| `sponsors/egothera.jpg` | `4a228d_ef1ecf26bb6e40ccb8f9ca5d2c949124~mv2.jpg` |
| `sponsors/bawer.jpg` | `4a228d_f6bcf4627ac24d3a925d6f7e96509a12~mv2.jpg` |
| `sponsors/canelle.jpg` | `4a228d_70ef778db1434fffaee6fcf3f41c6cbd~mv2.jpg` |
| `sponsors/adonis.jpg` | `4a228d_934d4a858e3d42e6a0ce04775c78b8dd~mv2.jpg` |
| `sponsors/slc.jpg` | `4a228d_fc620daa0e9f44eca9d34d731324e1b2~mv2.jpg` |
| `sponsors/mr-mikes.jpg` | `4a228d_53ab8980a2784636807247564d083ed8~mv2.jpg` |
| `teams/mens-squad.jpg` | `4a228d_278a3f9f12d147aebb3e84cf836634c9~mv2.jpg` |
| `teams/womens-a.jpg` | `4a228d_933a65343bf04ec68933639a73a5d973~mv2.jpg` |
| `teams/youth-camp.png` | `4a228d_3eca13f6c558438f80a6f5cdaf540aca~mv2.png` |
| `news/ricardo-tabet.jpg` | `4a228d_701e604a13884f05909f3c5ba3339015~mv2.jpg` |
| `news/jocelyn-trepanier.jpg` | `4a228d_aa3745d56b134e89838afc48307a8333~mv2.jpg` |
| `news/gregg-kennedy.png` | `4a228d_f54f16fc516d4d799c6ae0cc4761bcda~mv2.png` |
| `products/jersey.png` | `cf1ce5_c7e9bb3794e74560b87086b6ec8d7c23~mv2.png` |
| `products/jacket.png` | `ce4c7b_94c84bb2668c4a01b5dc8afda706731d~mv2.png` |
| `products/crewneck.jpg` | `4a228d_8ffec63d90e54eb58803ad586f5e633c~mv2.jpg` |
| `products/t-shirt.jpg` | `4a228d_2bc3887cb8b947dbbe0b02866449aa4b~mv2.jpg` |
| `products/polo.jpg` | `4a228d_43b30f31db284a77860618be95751001~mv2.jpg` |
| `products/cap.jpg` | `4a228d_b3cdb27613964410a0512139c2547a0b~mv2.jpg` |
| `products/scarf.jpg` | `4a228d_4e1f7f7b2ac74898afc21049fa2ef125~mv2.jpg` |
| `products/cedar-trophy.jpg` | `4a228d_5ff7407510354dc0bf6c17568eb3de8f~mv2.jpg` |
| `products/puck-with-holder.jpg` | `4a228d_b7f6ad3ff73f45eab17dafbdb6a59676~mv2.jpg` |
| `products/lihf-pucks.jpg` | `4a228d_1c958191e0634bf1a3cee06449497aab~mv2.jpg` |
| `products/pin.jpg` | `4a228d_fca9625bb76b4580a4d13a2aec0c9139~mv2.jpg` |

## Not kept

These were downloaded too and are not in the repository, because nothing can
point at them yet: the `teams` table holds one photograph per squad and the
`products` table one per item. The ids are recorded so they can be fetched
again the moment there is a slot — a squad gallery, or a second product angle.

| What it is | Media id |
|---|---|
| Men's team, trophy lift | `4a228d_f41664b1a152444db588d1108ec89d0a~mv2.jpg` |
| Men's team, on-ice huddle | `4a228d_8c86c98a32c142a1945a6b8ee1852278~mv2.jpg` |
| Women's team, game action | `4a228d_4e9788446e7944c2a64a82dc92de2356~mv2.jpg` |
| Women's team, game action | `4a228d_2f4b8604bb154b31822601f0eb95dd08~mv2.jpg` |
| Women's team, game action | `4a228d_1ee18f7c86904389a2833444f994a27c~mv2.jpg` |
| Women's team, bench | `4a228d_69fa36f9808f4a8c912df638dd3689da~mv2.jpg` |
| Women's team, on-ice circle | `4a228d_15210a086c5a4354900d801d83b60fcb~mv2.jpg` |
| Jersey, second angle | `cf1ce5_7539b7e830d446c2b4d3cb034ebaf425~mv2.png` |
| Jacket, second angle | `ce4c7b_6362bc193ac94320856621614be0f9f6~mv2.png` |
| Cap, second angle | `4a228d_80aed21b515b46f1a91c3917180a6a64~mv2.jpg` |
| Pucks, second angle | `4a228d_e829daff39b842c59232e7fb27ca5a9b~mv2.jpg` |

## The Panthers set did not come from Wix

The **Lebanese Panthers** had no photograph anywhere on the old site. The
federation supplied its own set on 16 November 2026, from
`C:\Karl\Projects\Hockey\icehockeypics`. Those files are in
`teams/panthers/` and have **no media id** - they were never on Wix, so the
fetch-again URL at the top of this file does not apply to them.

| File | Original filename | What it shows |
|---|---|---|
| `teams/panthers/squad.jpg` | `IMG_5957.JPG` | The full squad with their manager - used as the team portrait |
| `teams/panthers/squad-white.jpg` | `20181008_193922.jpg` | The squad in white kit, goaltender in front |
| `teams/panthers/line-up.jpg` | `IMG_5962.JPG` | The team lined up along the boards |
| `teams/panthers/four-players.jpg` | `IMG_5965.JPG` | Four players including the goaltender |
| `teams/panthers/goaltender.jpg` | `IMG_5971.JPG` | The goaltender with two team-mates |
| `teams/panthers/team-talk.jpg` | `20190401_184955.jpg` | The team round a coaching board |
| `teams/panthers/training.jpg` | `20190114_193327.jpg` | A training session on the rink |
| `teams/panthers/drill.jpg` | `IMG-20181113-WA0184.jpg` | A skater working through a puck drill |

These are **not** the 1600px masters the rest of this folder holds. The
supplied originals are between 425x239 and 510x340, which is why
`.team-portrait` takes the picture's own width instead of filling the column -
scaling one up to the full page width is visibly soft. Higher-resolution
originals would be worth asking for.

### What was left in the folder, and why

- **Six 2026 photographs** (`IMG-20260518-*`, `IMG-20260520-*`,
  `IMG-20260705-*`) show a senior player in the red cedar jersey at an indoor
  European arena, and a dressing room at what the jerseys call the United
  Hockey Camp 2026. That is national-team material, not the Panthers, so it
  does not belong on this page. Worth placing somewhere - ask the federation
  which squad and which event.
- **`IMG-20181217-WA0022.jpg`** is a photograph of a printed newspaper page:
  *L'Orient-Le Jour*, 17 December 2018, "Les beaux balbutiements du hockey sur
  glace libanais" by Thomas Guichard, about the Panthers as the country's
  first team. Republishing a scan of someone else's newspaper page is their
  copyright, not the federation's, so it is not in the site. The article is
  worth **citing** on the About or News page - headline, paper and date - and
  linking to if L'Orient-Le Jour has it online.
- **`20181015_190702.jpg`, `20181015_190709.jpg`, `20181015_191104.jpg`,
  `20181210_113759.jpg`, `20190121_192925.jpg`, `IMG-20180608-WA0066.jpg`,
  `IMG-20181015-WA0118.jpg`** are further training and rink shots that
  duplicate what the seven in the gallery already show. Easy to add later
  through `TEAM_GALLERIES` in `server/lib/photos.js` if the federation wants a
  longer gallery.
