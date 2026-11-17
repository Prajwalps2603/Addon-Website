// Shop-voice copy per subcategory. The product builder combines this with each
// product's own title and specs: nothing here names a specific product.
// Pure data.

export const SUBCATEGORY_COPY = {
  // ---- Exterior Styling ----------------------------------------------------
  'front-splitters': {
    intro: 'A front splitter or lip bolts under the bumper and makes the nose of the car look lower and wider. At road speeds it is a styling part, not downforce. Before buying, measure your ground clearance: most lips take away about 20 mm.',
    highlights: [
      'Fixes to the underside of the bumper with screws and automotive tape, so no holes show from outside',
      'Flexible enough to survive the odd scrape; a hard hit on a speed breaker will still mark it',
      'Model-specific pieces follow the bumper line; universal strips are cut to length on the car',
      'Can be removed later, though the screw holes under the bumper remain',
    ],
    boxContents: ['Splitter or lip sections', 'Screws', 'Automotive tape, pre-applied', 'Fitting guide'],
  },
  'spoilers-wings': {
    intro: 'A spoiler finishes the roof line or boot edge. On a road car it changes the look far more than the airflow. Check how it mounts: ours bolt through the panel as well as tape, because tape alone does not hold at highway speed.',
    highlights: [
      'Bolts through the boot lid or hatch with a gasket, backed by automotive tape',
      'Shaped for the listed car, so it follows the panel without gaps at the ends',
      'Paint-ready versions arrive in primer for a body shop to match to your colour code',
      'Versions with a brake light join the high-mount brake light feed',
    ],
    boxContents: ['Spoiler', 'Bolts and washers', 'Gasket tape', 'Wiring lead (brake light versions)', 'Fitting guide'],
  },
  'body-kits': {
    intro: 'A body kit adds a front lip, side skirts and a rear piece over the factory bumpers and sills. The parts are the easy bit: alignment and paint decide whether it looks factory or stuck on. Line up a body shop before you order.',
    highlights: [
      'Fits over the factory bumpers and sills: nothing original is cut away on model-specific kits',
      'Supplied in primer unless stated, ready for paint to your colour code',
      'Lowers the visual line of the car by 20 to 40 mm, and the real clearance at the lip by about the same',
      'Universal kits need trimming on the car and suit hatchbacks and sedans only',
      'Ships by surface freight in a rigid carton',
    ],
    boxContents: ['Kit pieces as listed in the title', 'Screws and clips', 'Automotive tape', 'Fitting guide'],
  },
  'rear-diffusers': {
    intro: 'A rear diffuser fills the lower bumper with fins and gives the tail a wider, more planted look. It is cosmetic at road speed. Check the cut-outs against your exhaust position and any parking sensors before buying.',
    highlights: [
      'Mounts to the lower bumper with screws and automotive tape',
      'Exhaust cut-outs are placed for the listed car',
      'Some cars need the lower valance trimmed where it will not be seen',
      'Versions with a centre light wire into the brake lamp feed',
    ],
    boxContents: ['Diffuser', 'Screws', 'Automotive tape', 'Wiring lead (lit versions)', 'Fitting guide'],
  },
  grilles: {
    intro: 'A replacement grille changes the face of the car more than any other single part. It clips into the factory mounting points, usually with the bumper off. If your variant has a front camera or radar, confirm the cut-out before ordering.',
    highlights: [
      'Uses the factory clip points: no cutting of the bumper',
      'Reuses the factory emblem where the design keeps one',
      'Keep the original grille: it goes straight back in if you sell the car',
      'Lit versions need an ignition feed for the DRL bars',
    ],
    boxContents: ['Grille', 'Clips and screws', 'DRL wiring lead (lit versions)', 'Fitting guide'],
  },
  'emblems-decals': {
    intro: 'Badges, lettering and vinyl graphics change how a car looks for little money, and they come off again. Everything here sticks on. The result depends on a clean, cool panel and ten minutes of measuring before you peel anything.',
    highlights: [
      'Pre-applied automotive adhesive: no drilling',
      'Cast vinyl and plated ABS that cope with car washes and sun',
      'Comes off with gentle heat, without marking sound factory paint',
      'Lettering kits include an alignment template',
    ],
    boxContents: ['Emblems or decal sheets', 'Alignment template or transfer film', 'Cleaning wipe', 'Fitting guide'],
  },
  'plate-frames': {
    intro: 'A frame tidies the edge of the registration plate. Show plates are a different thing: display pieces for a garage wall or a photo shoot, never for the road. A frame is only worth fitting if it leaves the whole HSRP visible.',
    highlights: [
      'Frames sit around the plate and leave every character and security mark uncovered',
      'Sized for the standard 500 x 120 mm car plate',
      'Fits with the existing plate holder screws: the HSRP rivets are not touched',
      'Show plates are made to order and marked as display pieces on the back',
    ],
    boxContents: ['Frames or show plate, as ordered', 'Screws and caps', 'Fitting note'],
  },
  'exterior-trim': {
    intro: 'Mirror caps, door visors and small trim pieces change details rather than the whole car. Most clip or tape on in under an hour. Check the listing against your exact variant: mirrors with cameras or indicators need the right cut-out.',
    highlights: [
      'Clips over or replaces the factory part, or fixes with automotive tape',
      'Door visors let you crack the window open in rain without water coming in',
      'Mirror caps keep the indicator cut-out where the mirror has one',
      'Removable: keep the factory parts and nothing is permanent',
    ],
    boxContents: ['Trim pieces as listed in the title', 'Automotive tape or clips', 'Cleaning wipe', 'Fitting guide'],
  },
  'sun-control-films': {
    intro: 'A sun control film on the inside of the glass cuts the heat and UV coming into the cabin without making the windows dark. The rules set how much light the glass must let through, so ours are clear films, not black ones. The price includes application at our studio: book a fitting slot when you order.',
    highlights: [
      'Keeps factory glass above the legal light limits: 70 percent for the windscreen and rear window, 50 percent for the side windows',
      'Blocks most UV and a good share of the heat, so the AC cools the cabin sooner',
      'Clear from inside and outside: no mirror finish and no dark look',
      'No metal layer, so phone signal, GPS and FASTag work as before',
      'Applied at our studio and included in the price; allow 2 to 3 hours',
    ],
    boxContents: ['Film for one car of the listed body type, cut on the car', 'Application at our studio', 'Care card'],
  },

  // ---- Interior & Comfort --------------------------------------------------
  'steering-wheels': {
    intro: 'This is the one part you touch every second you drive. A cover changes the feel for a few hundred rupees; a replacement wheel changes the shape and the grip but involves the airbag. For a wheel swap, use a fitter who has done your model before.',
    highlights: [
      'Replacement wheels reuse the factory airbag module and steering buttons',
      'Covers are sized by rim diameter: measure across the wheel before ordering',
      'Stitch-on covers sit tighter than slip-on ones and do not twist in the hand',
      'Perforated and suede-touch grips stay cooler than plain leatherette after the car has stood in the sun',
    ],
    boxContents: ['Steering wheel or cover, as ordered', 'Needle and thread (stitch-on covers)', 'Fitting guide'],
  },
  'gear-knobs': {
    intro: 'A weighted gear knob makes each shift feel more deliberate, and paddle extensions bring the paddles closer to your fingers. Both are small, reversible changes. Check your lever thread, and whether reverse needs a lift collar, before ordering a knob.',
    highlights: [
      'Solid aluminium, so it does not flex or rattle on the lever',
      'Thread adaptors in the box cover the common lever sizes',
      'Metal gets hot in a parked car in summer: a cloth over it saves your palm',
      'Refitting the original takes five minutes',
    ],
    boxContents: ['Gear knob or paddle extensions, as ordered', 'Thread adaptors or grub screws', 'Allen key'],
  },
  'floor-mats': {
    intro: 'Mats take the mud, sand and spilled chai so the carpet does not. Custom-cut mats cover the footwell edge to edge and lock on the factory hooks, which is what keeps them away from the pedals. Order for your exact model and generation.',
    highlights: [
      'Cut for the listed car, including the dead pedal and the tunnel',
      'Raised edges hold water and mud until you tip them out',
      'The driver mat locks on the factory hooks so it cannot creep forward',
      'Wipe or hose clean, dry in shade and drop back in',
    ],
    boxContents: ['Mat or liner set as listed in the title', 'Retaining clips where needed'],
  },
  'seat-covers': {
    intro: 'Seat covers protect the fabric you will be judged on at resale and make the cabin easier to keep clean. Pattern-cut covers for your model sit flat and keep the airbag seams free. Tell us your variant: seat shapes differ between trims.',
    highlights: [
      'Patterned for the listed model, with cut-outs for levers, armrests and belt buckles',
      'Tear-away stitching on the side that covers a seat airbag',
      'Foam-backed leatherette that wipes clean',
      'A fitter gets them wrinkle-free in two to three hours',
    ],
    boxContents: ['Front and rear seat covers', 'Headrest and armrest covers', 'Straps and hooks', 'Fitting guide'],
  },
  'ambient-lighting': {
    intro: 'Ambient lighting puts thin lines of light along the dash, doors and footwells. Done well it looks factory; done badly it looks like a festival. Decide first whether you want a simple USB footwell kit or a full kit that needs the door trims off.',
    highlights: [
      'Light guides press into the trim gaps, so no panel is cut',
      'Colour and brightness set from a phone app or remote',
      'Draws under 2 A: less than a phone charger',
      'Full kits take power from an ignition-switched fuse, so they go off with the car',
    ],
    boxContents: ['Light strips and guides', 'Control box', 'Wiring harness', 'Fuse tap or USB lead', 'Fitting guide'],
  },
  'gauges-displays': {
    intro: 'A head-up display reads speed and engine data from the OBD port and shows it near your line of sight. A replacement cluster swaps the whole instrument panel. The first is a ten-minute plug-in; the second needs coding by a specialist.',
    highlights: [
      'Reads from the car through the OBD port or a plug-in harness: no sensors to add',
      'Shows speed, engine speed and coolant temperature as a minimum',
      'Replacement clusters read the odometer from the car and cannot be edited',
      'Unplug it and the car is back to standard',
    ],
    boxContents: ['Display unit', 'OBD cable or plug-in harness', 'Anti-slip pad or mounting hardware', 'User guide'],
  },
  'key-covers': {
    intro: 'A key cover protects a smart key that costs several thousand rupees to replace, and makes two identical keys easy to tell apart. Key shapes differ by model and by year, so match the button layout in the photos to your key.',
    highlights: [
      'Made for the listed key shape, with every button marked and reachable',
      'Does not reduce the remote range',
      'The emergency key blade still slides out',
      'Fits in seconds with no tools',
    ],
    boxContents: ['Key cover', 'Keyring or strap'],
  },
  'sunshades-organisers': {
    intro: 'Window shades keep the sun off rear passengers and parked interiors; organisers stop shopping and tools sliding around the boot. Neither needs fitting. Shades are cut per window, so order for your exact model.',
    highlights: [
      'Magnetic frames snap onto the metal window surround: no suction cups',
      'Mesh cuts glare and heat while rear passengers can still see out',
      'Folds flat into a pouch when not in use',
      'Organisers collapse flat and strap down so they do not slide under braking',
    ],
    boxContents: ['Shades or organiser, as ordered', 'Storage pouch or tie-down straps'],
  },

  // ---- Lighting ------------------------------------------------------------
  headlights: {
    intro: 'A complete headlamp assembly replaces the factory unit with LED projectors, DRLs and often sequential indicators. You get a sharper beam and a newer face. The beam must be aimed after fitting: a good lamp aimed badly is worse than the old one.',
    highlights: [
      'Plugs into the factory headlamp connector',
      'Beam pattern for left-hand traffic, as driven in India',
      'White light only, with amber indicators',
      'Sealed housings rated against dust and water',
      'Keep the original lamps: they refit if you sell the car',
    ],
    boxContents: ['Left and right headlamp assemblies', 'Adapter leads where needed', 'Fitting guide'],
  },
  'tail-lights': {
    intro: 'LED tail lamps swap in on the factory mounting points and change how the car looks from behind, day and night. Most are a four-nut, one-plug job per side. If you drive in fog or heavy rain, choose a clear or red lens over a smoked one.',
    highlights: [
      'Bolts to the factory mounting points and plugs into the factory connector',
      'Red tail and brake light, amber indicators, white reverse light',
      'LEDs light up faster than bulbs, so the driver behind sees you brake sooner',
      'Sets with a connecting light bar need an extra feed across the boot lid',
    ],
    boxContents: ['Left and right tail lamps', 'Seals', 'Wiring lead (light-bar sets)', 'Fitting guide'],
  },
  'led-bulbs': {
    intro: 'LED bulbs replace halogen bulbs in the same socket and give whiter light for less current. In a projector they work well. In a plain reflector they can scatter light into oncoming eyes, so check which housing you have and re-aim the beam afterwards.',
    highlights: [
      'Same socket as the halogen bulb: check the code on your old bulb before ordering',
      'Headlight and fog bulbs carry a built-in decoder to prevent bulb-out warnings on most cars',
      'Draws less current than halogen, so less load on the wiring',
      'Headlight bulbs need space behind the lamp for the heat sink and driver',
    ],
    boxContents: ['LED bulbs as listed in the title', 'Drivers or decoders where needed', 'Cable ties', 'Fitting guide'],
  },
  'fog-projectors': {
    intro: 'Fog lamps throw a low, wide beam under fog and rain instead of into it. Yellow cuts glare better than white in bad weather, which is why the dual-colour sets are worth it. Check that your bumper has fog lamp pockets before ordering a model-specific set.',
    highlights: [
      'Sharp horizontal cut-off, so the light stays below oncoming drivers',
      'Dual-colour sets switch between white and yellow from the same switch',
      'Relay harness and switch included, so the factory wiring carries no extra load',
      'Model-specific sets bolt into the factory fog lamp pockets',
      'Retrofit projectors go inside the headlamp and need a specialist to open and reseal it',
    ],
    boxContents: ['Pair of lamps or projectors', 'Relay harness with fuse', 'Switch', 'Bezels or brackets where listed', 'Fitting guide'],
  },
  drls: {
    intro: 'Daytime running lamps make the car easier to see in daylight; sequential indicators make your turn signal harder to miss. They need an ignition feed and an indicator tap, so neat wiring matters more than the part itself.',
    highlights: [
      'White running light that switches to amber with the indicator',
      'Comes on with the ignition, so there is no separate switch to forget',
      'Flexible strips follow the headlamp or bumper edge',
      'Sealed against water for use outside the car',
    ],
    boxContents: ['Pair of DRL strips or indicator units', 'Control module', 'Wiring leads', 'Fitting guide'],
  },
  'aux-lights': {
    intro: 'Driving lights add distance on unlit highways and ghat roads. They are for empty roads only: switch them off and cover them when there is traffic. Always wire them through the relay harness in the box, never off the headlight feed.',
    highlights: [
      'Relay, fuse and switch included in the harness',
      'Clip-on yellow filters for fog and dust',
      'Die-cast aluminium bodies that shed heat',
      'Brackets bolt to a bumper beam, crash-bar mount or A-pillar',
      'Covers included for use in traffic',
    ],
    boxContents: ['Pair of lamps', 'Brackets and bolts', 'Relay harness with fuse and switch', 'Filter caps or covers', 'Fitting guide'],
  },
  'accent-underbody': {
    intro: 'Accent lighting is for car meets, shoots and your own driveway. Underbody glow is not for public roads, and we say so on every listing. If you want something usable every day, lit door sills come on only when a door opens.',
    highlights: [
      'Underbody strips are sealed for water and road spray',
      'Colour and effects set from a phone app',
      'Runs through its own inline fuse',
      'Underbody kits: show and private land use only',
    ],
    boxContents: ['Light strips or sill plates', 'Control box', 'Wiring with inline fuse', 'Clips and cable ties', 'Fitting guide'],
  },

  // ---- Performance & Handling ----------------------------------------------
  'air-intakes': {
    intro: 'A performance filter flows a little more air and can be washed and reused instead of replaced. Expect a sharper intake sound and a small gain at the top of the rev range, not a different car. Match the part to your engine, not just your model.',
    highlights: [
      'Drop-in filters fit the factory airbox with no modification',
      'Washable: clean and re-oil about every 15,000 km',
      'Intake kits include a heat shield to keep hot engine-bay air out',
      'All emissions equipment stays in place',
    ],
    boxContents: ['Filter or intake kit, as ordered', 'Clamps and brackets (kits)', 'Fitting guide'],
  },
  exhaust: {
    intro: 'An exhaust tip dresses the tailpipe and changes nothing else. A replacement rear section changes the sound and should be chosen with your ears and your neighbours in mind. Measure your tailpipe diameter before ordering a tip.',
    highlights: [
      'Stainless steel, so it does not rust through like mild steel',
      'Tips clamp on: no welding',
      'Replacement systems keep the catalytic converter',
      'A tip needs about 60 mm of straight, visible tailpipe to grip',
    ],
    boxContents: ['Tip or exhaust section, as ordered', 'Clamps and bolts', 'Gaskets (systems)', 'Fitting guide'],
  },
  suspension: {
    intro: 'Springs and coilovers lower the car and cut body roll; a strut brace stiffens the front end a little. All of them trade some comfort for control. Be honest about your roads and how many people you carry before you lower anything.',
    highlights: [
      'Lowering springs work with the factory dampers and give a fixed drop',
      'Coilovers let you set ride height and damping yourself',
      'A four-wheel alignment is needed straight after fitting',
      'Tell your insurer about a ride-height change',
      'Keep the original parts: the car can go back to standard',
    ],
    boxContents: ['Springs, coilovers or brace, as ordered', 'Adjustment spanners (coilovers)', 'Fitting guide'],
  },
  brakes: {
    intro: 'Better pads and rotors give a firmer pedal and resist fade on long descents. They do not shorten a panic stop much on their own: tyres do that. Always do both sides of an axle together, and bed new pads in gently.',
    highlights: [
      'Direct replacement for the factory parts on the listed cars',
      'Ceramic pads make less dust on the wheels than standard pads',
      'Slotted rotors clear gas and water from the pad face',
      'Needs about 300 km of gentle braking to bed in',
    ],
    boxContents: ['Pads or rotors as listed in the title', 'Shims or fitting hardware where needed', 'Bed-in instructions'],
  },
  'tuning-hardware': {
    intro: 'These are bolt-on and plug-in parts for people who like to tinker. A throttle controller sharpens pedal response without touching the engine. We do not sell emissions-delete parts or remap files.',
    highlights: [
      'Throttle controllers plug in at the accelerator pedal connector',
      'Adds no power: it changes how quickly the pedal asks for it',
      'Unplug it and the car is exactly as it left the factory',
      'Catch cans must be plumbed back to the intake as a closed loop',
    ],
    boxContents: ['Controller or catch can, as ordered', 'Harness or hoses and clamps', 'Mounting pad or bracket', 'User guide'],
  },
  'racing-seats': {
    intro: 'Bucket seats and harnesses hold you in place on a track. They are motorsport parts: on the road, the factory seat with its airbag and three-point belt is the safer choice. Rails for your car are sold separately, so ask us before ordering.',
    highlights: [
      'Deep side bolsters hold you at the hips and shoulders',
      'Harness slots in the backrest for 4-point belts',
      'Bolts to the factory floor points using car-specific rails',
      'Listed for track and motorsport use',
    ],
    boxContents: ['Seat or harness, as ordered', 'Mounting bolts', 'Fitting guide'],
  },

  // ---- Wheels & Tyres ------------------------------------------------------
  'alloy-wheels': {
    intro: 'Wheels change the stance of a car more than anything else you can bolt on. They are sold by bolt pattern, so the first check is your PCD, then offset and centre bore. Tyres are not included.',
    highlights: [
      'Sold as a set of four, with hub rings where the centre bore is larger than the hub',
      'Low-pressure cast aluminium with a stated load rating per wheel',
      'Keep the tyre size within about 3 percent of the stock rolling diameter',
      'Needs mounting, balancing and torquing at a tyre shop',
      'Re-torque the nuts after the first 50 km',
    ],
    boxContents: ['4 alloy wheels', 'Centre caps', 'Hub rings where needed'],
  },
  'wheel-hardware': {
    intro: 'Lug nuts and spacers are small parts that carry the whole car. Thread size and seat type must match your studs and wheels exactly. If you are not sure of either, send us a photo of your current nut before ordering.',
    highlights: [
      'Lug nuts are forged steel with a 60 degree conical seat for aftermarket alloy wheels',
      'Thread size is stated in the title: M12 x 1.5 and M12 x 1.25 do not interchange',
      'Spacers are hub-centric and come with their own studs',
      'Fit with a torque wrench and re-check after 50 km',
    ],
    boxContents: ['Lug nuts or spacers as listed in the title', 'Socket key where needed'],
  },
  'wheel-styling': {
    intro: 'Caliper covers and centre caps finish a wheel for very little money. They are cosmetic: a caliper cover does nothing for braking. Check the gap between your caliper and the wheel spokes before ordering covers.',
    highlights: [
      'Heat-resistant ABS that sits over the factory caliper',
      'Needs at least 3 mm between the cover and the wheel',
      'Centre caps push in from the front and are sized by diameter',
      'Removable without marking the caliper',
    ],
    boxContents: ['Covers or caps as listed in the title', 'Brackets and high-temperature adhesive (covers)'],
  },
  'wheel-covers': {
    intro: 'Wheel covers, also called wheel cups, clip over steel wheels and make a base model look finished for a fraction of the price of alloys. They are sized by wheel diameter, so check the size on your tyre wall before ordering: 175/65 R14 means a 14 inch wheel.',
    highlights: [
      'Sized by diameter: 13, 14 or 15 inch, for steel wheels only',
      'A steel retaining ring and clips hold the cover against the wheel rim',
      'Cut-out for the tyre valve, so you can check pressure without taking the cover off',
      'UV-stabilised plastic that does not go chalky in the sun',
      'Fits by hand in a few minutes, with no tools',
    ],
    boxContents: ['4 wheel covers', '4 retaining rings, fitted'],
  },
  'tyre-inflators': {
    intro: 'A 12V inflator and a puncture kit get you moving again without waiting for help. Tubeless punctures in the tread can be plugged at the roadside in ten minutes. Keep both in the boot, not at home.',
    highlights: [
      'Inflators run from the 12V socket with a cable long enough to reach all four wheels',
      'Set the pressure and the inflator stops by itself',
      'Inflators have a built-in light for night use',
      'Plug kits work on tubeless tyres only, and only in the tread area',
    ],
    boxContents: ['Inflator or repair kit, as ordered', 'Hose and nozzle adaptors', 'Carry bag or case'],
  },
  tpms: {
    intro: 'A tyre pressure monitor shows the pressure and temperature of each tyre and warns you of a slow puncture before the tyre is ruined. External sensors screw on in place of the valve caps. Skip it if your car already has factory TPMS.',
    highlights: [
      'Sensors screw onto the valves: no tyre removal',
      'Solar display sits on the dash with no wiring',
      'Alerts for low pressure, high pressure, fast leak and high temperature',
      'Sensor batteries last about two years and can be replaced',
    ],
    boxContents: ['Display unit', '4 sensors', 'Lock nuts and spanner', 'Anti-slip pad', 'User guide'],
  },

  // ---- Audio & Tech --------------------------------------------------------
  'head-units': {
    intro: 'A touchscreen head unit replaces the factory stereo and brings phone mirroring, a bigger screen and camera inputs. Model-specific units come with the fascia frame and a coupler harness, so nothing is cut. Check that your steering controls and factory camera are supported before ordering.',
    highlights: [
      'Wireless phone mirroring that works with Apple CarPlay and Android Auto',
      'Fascia frame and plug-in harness for the listed cars',
      'Steering wheel audio buttons are retained through the supplied control box',
      'Reverse camera input, with pre-outs for an amplifier and subwoofer',
      'Keep the factory unit: it refits if you sell the car',
    ],
    boxContents: ['Head unit', 'Fascia frame', 'Coupler harness', 'Steering control box', 'GPS antenna', 'Microphone', 'USB leads'],
  },
  speakers: {
    intro: 'Speakers are where a car audio upgrade should start. Coaxials are a direct swap; components split the tweeter out and sound clearer but take more fitting. Check the mounting depth against your door before ordering.',
    highlights: [
      '6.5 inch (165 mm) drivers, the size most front doors take',
      '4 ohm, so they run from a factory or aftermarket head unit',
      'Component sets include separate tweeters and crossovers',
      'They sound noticeably better in a damped door',
    ],
    boxContents: ['Speakers as listed in the title', 'Grilles', 'Crossovers and tweeter mounts (component sets)', 'Screws and speaker wire'],
  },
  'subwoofers-amps': {
    intro: 'A subwoofer adds the low notes door speakers cannot reach; an amplifier gives speakers the clean power a head unit does not have. Both need a fused power cable from the battery and a proper earth. Fit them after the speakers, not instead of them.',
    highlights: [
      'High-level and RCA inputs, so it works with factory and aftermarket head units',
      'Under-seat subwoofers leave the boot free',
      'Class D amplifiers run cool and draw less current',
      'Needs a power cable kit with a fuse near the battery',
    ],
    boxContents: ['Subwoofer or amplifier, as ordered', 'Bass remote (subwoofers)', 'Input harness', 'Mounting brackets', 'User guide'],
  },
  'sound-damping': {
    intro: 'Butyl damping sheets stick to the inside of door skins and floor panels to stop them ringing. The doors feel heavier, speakers sound fuller and road noise drops a little. It is slow, careful work, and it is not removable.',
    highlights: [
      'Butyl rubber with an aluminium foil face',
      'No bitumen, so no tar smell in summer heat',
      'Works by adding mass to thin panels: about a quarter coverage already makes a difference',
      'Roller included: the sheet must be pressed hard to bond',
    ],
    boxContents: ['Damping sheets as listed in the title', 'Roller'],
  },
  'dash-cams': {
    intro: 'A dash cam records what happened when it is your word against theirs. Front-only is enough for most people; a rear camera helps with hits from behind. Buy a high-endurance memory card with it: ordinary cards wear out quickly.',
    highlights: [
      'Loop recording that overwrites the oldest clips and locks the clip when it senses an impact',
      'Runs from the 12V socket; parking mode needs a hardwire kit',
      'Supercapacitor instead of a lithium battery, which copes better with a hot dashboard',
      'Clips are viewed and downloaded over Wi-Fi on a phone app',
    ],
    boxContents: ['Camera unit or units', 'Windscreen mounts', '12V power adapter and cable', 'Rear camera cable (multi-channel)', 'Trim tool and cable clips'],
  },
  'parking-safety': {
    intro: 'A reverse camera shows what the mirrors cannot: the low wall, the child, the bike parked behind. It needs a screen with a camera input. A 360 kit adds three more cameras and needs careful calibration to be useful.',
    highlights: [
      'Wide-angle view with guidelines',
      'Sealed for water: it lives next to the number plate',
      'Powers on with reverse gear from the reverse lamp feed',
      '360 kits stitch four cameras into a top view and need calibration mats on fitting',
    ],
    boxContents: ['Camera or cameras', 'Video and power cables', 'Control box (360 kits)', 'Hole saw and brackets', 'Fitting guide'],
  },
  horns: {
    intro: 'A twin-tone horn set gives a fuller, clearer note than the single horn most small cars leave the factory with. It stays inside the legal sound limit. We do not sell pressure horns or musical horns.',
    highlights: [
      'High and low tone pair that sounds together',
      '12V, and bolts to the factory horn bracket',
      'Use a relay when running two horns from one feed',
      'Mount with the opening facing down so water drains out',
    ],
    boxContents: ['2 horns (high and low tone)', 'Brackets and nuts'],
  },
  'chargers-mounts': {
    intro: 'A fast charger and a steady phone mount are the two things every car needs on day one. Check your phone supports the charging standard before paying for the wattage. Mount the phone below your line of sight to the road.',
    highlights: [
      'USB-C Power Delivery for phones that support fast charging',
      'Protection against over-current, over-heating and short circuit',
      'Plugs into any 12V socket',
      'Mounts hold the phone by clamp or magnet and release with one hand',
    ],
    boxContents: ['Charger or mount, as ordered', 'USB-C cable', 'Vent clip or dash pad (mounts)'],
  },

  // ---- 4x4 & Overland ------------------------------------------------------
  'roof-racks': {
    intro: 'A roof rack or pair of cross bars carries what will not fit inside. Every roof has a load limit set by the car maker, and it is lower than most people think. Know that number, and the difference between the moving and parked rating, before loading up.',
    highlights: [
      'Mounts to factory roof rails, gutters or fixed points',
      'Dynamic (driving) and static (parked) load ratings stated separately',
      'Aluminium construction, so it does not rust',
      'Adds some wind noise and fuel use at highway speed',
      'Needs two people to fit',
    ],
    boxContents: ['Rack or cross bars, as ordered', 'Mounting feet and clamps', 'Bolts and Allen key', 'Locks and keys (lockable bars)', 'Fitting guide'],
  },
  'underbody-armour': {
    intro: 'Skid plates and rock sliders take the hit so the sump, sills and doors do not. They are for people who actually drive off tarmac. We do not sell bull bars or crash guards: they are not allowed on public roads.',
    highlights: [
      'Bolts to factory chassis points: no welding',
      'Cut-outs keep the oil drain plug reachable',
      'Powder-coated against rust',
      'Heavy: plan for a lift and a second pair of hands',
    ],
    boxContents: ['Skid plate or sliders, as ordered', 'Brackets and bolts', 'Fitting guide'],
  },
  snorkels: {
    intro: 'A snorkel raises the engine air intake to roof height so the engine breathes cleaner air in dust and stays dry in deeper water. It needs a hole cut in the wing, and it does not waterproof the electrics or the breathers. Fit it only if you will use it.',
    highlights: [
      'UV-stable plastic body that does not go chalky in the sun',
      'Cutting template included for the listed car',
      'Seals to the factory airbox',
      'Permanent: the wing is cut',
    ],
    boxContents: ['Snorkel body and head', 'Cutting template', 'Hose and clamps', 'Brackets and stainless bolts', 'Fitting guide'],
  },
  'light-bars': {
    intro: 'A light bar turns night into day on a trail. That is exactly why it is not for public roads: it must be off and covered there. Wire it through the relay harness in the box and seal any roof wiring entry.',
    highlights: [
      'Combo beam: spot in the centre for distance, flood at the edges for width',
      'Relay harness and switch included',
      'Aluminium housing sealed against water and dust',
      'Cover included for use on public roads',
      'For off-road use only',
    ],
    boxContents: ['Light bar', 'Brackets and bolts', 'Relay harness with fuse and switch', 'Cover', 'Fitting guide'],
  },
  'recovery-gear': {
    intro: 'Recovery gear is what gets a stuck car out without breaking it or hurting someone. Straps and shackles are rated: know the rating and your vehicle weight. And know where your rated recovery points are before you need them.',
    highlights: [
      'Minimum breaking strength stated on every strap and shackle',
      'Snatch straps stretch to pull a car free smoothly',
      'Traction boards work alone, with no second vehicle',
      'Packs into a bag that lives in the boot',
    ],
    boxContents: ['Recovery items as listed in the title', 'Storage bag'],
  },
  'jerry-cans-storage': {
    intro: 'A jerry can adds range where pumps are far apart; a storage panel keeps tools and straps off the cabin floor. Cans ship empty. Mount them where the weight is supported and away from the exhaust.',
    highlights: [
      'Cans are steel with a locking cap and gasket',
      'The holder bolts on and locks the can in place',
      'Pouring spout included with cans',
      'Storage panels use the standard MOLLE grid for pouches',
    ],
    boxContents: ['Can with holder, or panel with pouches, as ordered', 'Spout (cans)', 'Bolts and keys'],
  },
  'overland-camping': {
    intro: 'An awning gives you shade and a dry spot beside the car in two minutes. It bolts to a roof rack or cross bars, so you need those first. It is a fair-weather shelter: take it down in strong wind.',
    highlights: [
      'Rolls out from a zipped bag on the side of the rack',
      'Telescopic legs and guy ropes for uneven ground',
      'Water-resistant fabric with a UV coating',
      'Needs a roof rack or cross bars to mount to',
    ],
    boxContents: ['Awning in storage bag', 'Mounting brackets and bolts', 'Legs, guy ropes and pegs'],
  },
  'side-steps-flares': {
    intro: 'Side steps make a tall SUV easier to climb into, which matters most to children and older passengers. Fender flares cover wider tyres. Both bolt to factory points on the listed cars.',
    highlights: [
      'Bolts to factory chassis or body points: no drilling on the listed cars',
      'Anti-slip tread on the step surface',
      'Load rating stated per side',
      'Steps reduce the clearance under the sills a little',
    ],
    boxContents: ['Steps or flares as listed in the title', 'Brackets and bolts', 'Fitting guide'],
  },

  // ---- Car Care & Utility --------------------------------------------------
  detailing: {
    intro: 'Good wash products remove dirt without stripping wax or scratching the clear coat. The method matters as much as the bottle: shade, two buckets and a clean mitt. Start with shampoo and a drying towel before anything fancier.',
    highlights: [
      'pH-neutral, so it is safe on wax, sealants and ceramic coatings',
      'Shampoos dilute in a bucket or a foam cannon',
      'Safe on paint, glass and plastic trim',
      'Dilution and shelf life are printed on the label',
    ],
    boxContents: ['Product as listed in the title'],
  },
  'fluids-additives': {
    intro: 'A fuel system cleaner dissolves deposits on injectors and valves over one tank of fuel. It helps an older engine that idles roughly; it does nothing for a healthy one. Use one bottle per tank, at the stated interval.',
    highlights: [
      'For petrol engines only',
      'One bottle treats one tank',
      'Pours straight into the fuel filler',
      'Ships by surface, so delivery takes a little longer',
    ],
    boxContents: ['1 bottle'],
  },
  'emergency-gear': {
    intro: 'A jump starter gets a flat battery going without a second car; an emergency kit covers the rest of a bad day. Both are useless if they are at home. Keep them in the boot and recharge the jump starter every three months.',
    highlights: [
      'Jump starters turn over petrol and diesel engines from a pack you can hold in one hand',
      'Clamps protected against reverse connection and sparks',
      'The jump starter doubles as a power bank and torch',
      'Roadside kits include a warning triangle and a tow rope',
    ],
    boxContents: ['Jump starter or kit, as ordered', 'Clamps and charging cable (jump starters)', 'Carry case'],
  },
  'car-covers': {
    intro: 'A body cover keeps sun, dust, bird droppings and rain off a car parked outdoors. It must go on a clean car, or it grinds the dust into the paint. Covers sized for the model stay on in wind; loose universal ones do not.',
    highlights: [
      'Sized for the listed car, with mirror pockets',
      'Soft inner lining against the paint',
      'Elastic hem and belly straps for windy days',
      'Folds into its own carry bag',
    ],
    boxContents: ['Car cover', 'Belly straps', 'Carry bag'],
  },
  fragrances: {
    intro: 'A vent perfume should make the cabin smell clean, not announce itself. Start on the lowest setting. If anyone in the car gets headaches from fragrance, leave it out.',
    highlights: [
      'Clips to any horizontal vent slat',
      'Adjustable strength',
      'Lasts about 45 days in normal use',
      'Keep the liquid off the dashboard plastic',
    ],
    boxContents: ['Vent clip with perfume'],
  },
  'cleaning-tools': {
    intro: 'A cordless vacuum handles the crumbs, sand and pet hair between proper cleans. It will not match a workshop machine, and it does not need to. Empty it often and wash the filter monthly.',
    highlights: [
      'Cordless, with USB-C charging',
      'Washable filter',
      'Nozzles for seat gaps, vents and mats',
      'About 25 minutes of running per charge',
    ],
    boxContents: ['Vacuum', 'Nozzle set', 'Charging cable', 'Storage bag'],
  },

  // ---- Addon Merchandise ---------------------------------------------------
  'hoodies-jackets': {
    intro: 'Heavy cotton fleece hoodies for cold-morning drives and late garage nights. The fit is regular and unisex. Check the size chart in centimetres before ordering.',
    highlights: [
      'Cotton fleece, brushed inside',
      'Regular unisex fit, sizes S to XXL',
      'Lined hood with metal eyelets',
      'Made in India',
    ],
    boxContents: ['1 hoodie'],
  },
  'tees-caps': {
    intro: 'Plain, heavy cotton tees and a cap with the wheel logo. The tee has a relaxed fit. Check the size chart before ordering.',
    highlights: [
      'Combed cotton with a ribbed crew neck',
      'Relaxed unisex fit, sizes S to XXL',
      'Cap is six-panel with an adjustable strap',
      'Made in India',
    ],
    boxContents: ['1 tee or cap, as ordered'],
  },
  'key-chains': {
    intro: 'Small metal key chains with a moving part: a wheel that spins or a turbine that turns. A cheap gift for anyone who likes cars. They are solid metal, so they add weight to a key.',
    highlights: [
      'Zinc alloy with a plated finish',
      'Free-spinning wheel or turbine',
      'Split ring for keys',
      'Comes in a gift box',
    ],
    boxContents: ['1 key chain', 'Gift box'],
  },
  bags: {
    intro: 'A 35 litre duffel sized for a helmet, shoes and a change of clothes. Use it for track days, the gym or a weekend away. It is water-resistant, not waterproof.',
    highlights: [
      'Water-resistant 900D polyester',
      'Separate shoe pocket',
      'Padded, detachable shoulder strap',
      '35 litre main compartment',
    ],
    boxContents: ['1 duffel bag', 'Shoulder strap'],
  },
  'garage-decor': {
    intro: 'Framed prints for the garage, the study or the workshop wall. Printed on matte art paper behind an acrylic front. Hang it out of direct sun.',
    highlights: [
      'A3 print on matte art paper',
      'Black frame with an acrylic front',
      'Hook fitted, ready to hang',
      'Packed with corner protectors',
    ],
    boxContents: ['1 framed print'],
  },
};
