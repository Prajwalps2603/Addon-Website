// Spec tables. Each subcategory has a template in catalog.json (label plus an example value).
// A product starts from the template and PRODUCT_SPECS corrects what its own title says:
//   'key': 'value'   replaces the template's example for that row
//   'key': null      drops a row that does not apply to this product
//   'Label': 'value' (a key the template does not have) adds a row with that label
// Rows a product does not mention keep the template's example.
import { choiceList } from './shared.js';

const PRODUCT_SPECS = {
  // ---- Exterior Styling ------------------------------------------------------
  'ADN-EXT-001': { pieces: '1', width: '1640 mm', weight: '1.8 kg' },
  'ADN-EXT-002': { finish: 'Carbon-look', pieces: '3', width: '1750 mm', paintReady: 'No, the carbon-look surface is the finish', weight: '2.4 kg' },
  'ADN-EXT-003': {
    material: 'Flexible EPDM rubber',
    pieces: '1 roll',
    width: '2.5 m long, cut to length on the car',
    groundClearanceChange: 'About 15 mm lower',
    mounting: 'Automotive tape and self-tapping screws',
    paintReady: 'No',
    weight: '1.1 kg',
  },
  'ADN-EXT-004': { length: '1090 mm', mounting: 'Bolts through the hatch plus automotive tape' },
  'ADN-EXT-005': { brakeLight: 'None', length: '1180 mm', mounting: 'Bolts through the boot lid plus automotive tape', weight: '1.4 kg' },
  'ADN-EXT-006': { finish: 'Unpainted primer', brakeLight: 'None', length: '1100 mm', paintReady: 'Yes, arrives in primer' },
  'ADN-EXT-007': {
    finish: 'Carbon-look',
    brakeLight: 'None',
    length: '1210 mm',
    mounting: 'Bolts through the boot lid plus automotive tape',
    paintReady: 'No, the carbon-look surface is the finish',
    weight: '1.2 kg',
  },
  'ADN-EXT-008': { material: 'ABS plastic' },
  'ADN-EXT-009': {
    material: 'ABS plastic',
    pieces: '2 (left and right side skirt)',
    finish: 'Gloss black',
    paintService: 'Not needed, supplied finished',
    fitment: 'Fits under the factory sills, no cutting',
    weight: '4.2 kg',
  },
  'ADN-EXT-010': {
    material: 'Flexible ABS and polyurethane',
    pieces: '7 (front lip, two side skirts, four diffuser fins)',
    finish: 'Textured black',
    fitment: 'Universal: trimmed to length on the car',
    weight: '6 kg',
  },
  'ADN-EXT-011': { exhaustCutOuts: 'Quad-exit look, two each side', brakeLight: 'None' },
  'ADN-EXT-012': { exhaustCutOuts: 'Single, on the factory side', brakeLight: 'Centre LED, steady red', weight: '2.1 kg' },
  'ADN-EXT-013': { lighting: 'None' },
  'ADN-EXT-014': { pattern: 'Vertical slats', lighting: 'Built-in white LED DRL bars' },
  'ADN-EXT-015': { pattern: 'Diamond stud', finish: 'Black and chrome', lighting: 'None' },
  'ADN-EXT-016': { material: 'ABS with plated finish', vinylLife: null },
  'ADN-EXT-017': { material: 'Cast vinyl', finish: 'Matte black', adhesive: 'Pressure-sensitive, with air-release backing' },
  'ADN-EXT-018': { material: 'Cast vinyl', adhesive: 'Pressure-sensitive, with air-release backing' },
  'ADN-EXT-019': { material: 'ABS' },
  'ADN-EXT-020': {
    material: null,
    plateSize: 'Chosen in the designer', // replaced by the list of sizes, since the plate is sold in variants
    finish: 'Printed to your design',
    fasteners: null,
    plateVisibility: null,
    'Made to order': 'Yes, from the design you save',
    Marking: 'Marked on the back as a display piece',
    Use: 'Display only. Not a registration plate and never for the road.',
  },
  'ADN-EXT-021': { material: 'ABS plastic', mounting: 'Clips on in place of the factory cap' },
  'ADN-EXT-022': {
    material: 'Acrylic',
    finish: 'Smoked with a chrome line',
    mounting: 'Automotive tape along the door frame',
    pieces: '4',
    indicatorCutOut: null,
  },
  'ADN-EXT-023': { coverage: 'Windscreen, rear window and the 4 side windows of a hatchback' },
  'ADN-EXT-024': { coverage: 'Windscreen, rear window and the 4 side windows of a sedan' },
  'ADN-EXT-025': {
    filmType: 'Ceramic heat-rejection film, metal-free',
    thickness: '2 mil (about 50 microns)',
    coverage: 'Windscreen, rear window and up to 6 side windows of an SUV or MUV',
  },

  // ---- Interior & Comfort ----------------------------------------------------
  'ADN-INT-001': { coverSize: null },
  'ADN-INT-002': {
    diameter: null,
    shape: 'Round and flat-bottom wheels',
    gripMaterial: 'Perforated leatherette',
    insert: null,
    airbag: null,
    switchgear: null,
    coverSize: 'M, for 37 to 38 cm wheels',
    Fixing: 'Stitched on with the needle and thread supplied',
  },
  'ADN-INT-003': { diameter: '370 mm', insert: 'LED shift display in the top of the rim', coverSize: null },
  'ADN-INT-004': {
    diameter: null,
    shape: 'Round and flat-bottom wheels',
    gripMaterial: 'Suede-touch',
    insert: 'Red centre marker at the top of the rim',
    stitchColour: 'Black',
    airbag: null,
    switchgear: null,
    Fixing: 'Slips on, no stitching',
  },
  'ADN-INT-005': { shiftPattern: '5-speed insert', pedalFixing: null },
  'ADN-INT-006': {
    weight: '45 g each',
    thread: null,
    shiftPattern: null,
    gearbox: 'Automatic with paddle shifters',
    pedalFixing: null,
    Fixing: 'Clamps over the factory paddles with grub screws',
  },
  'ADN-INT-008': {
    fit: 'Laser-measured for the model',
    material: 'TPE, one moulded piece per footwell',
    layers: '1',
    rowsCovered: '3',
    edgeHeight: '45 mm raised sides',
    pieces: '4',
  },
  'ADN-INT-010': {
    fit: 'Custom cut for the boot floor',
    material: 'TPE',
    layers: '1',
    rowsCovered: 'Boot floor only',
    edgeHeight: '50 mm raised edge',
    backing: 'Anti-skid underside',
    pieces: '1',
  },
  'ADN-INT-011': { material: 'Leatherette' },
  'ADN-INT-012': { pattern: 'Sport bolsters with contrast piping' },
  'ADN-INT-013': {
    fit: 'Universal, straps to any seat',
    material: 'Memory foam with a breathable mesh cover',
    foam: '60 mm, contoured',
    sideAirbags: 'Does not cover the side of the seat',
    rows: null,
    pieces: '2 (lumbar cushion, neck cushion)',
    pattern: null,
  },
  'ADN-INT-015': {
    lightPoints: '4',
    colours: '8 colours',
    control: 'Inline button',
    musicSync: 'No',
    guideType: 'LED strips',
    power: '5V from a USB port',
    currentDraw: 'Under 1 A',
    zones: '4 footwells',
  },
  'ADN-INT-016': { lightPoints: '22', power: '12V through plug-in factory connectors', zones: 'Dashboard, 4 doors, footwells, centre console' },
  'ADN-INT-017': {
    display: '3.5 inch head-up display',
    readouts: 'Speed, RPM, coolant temp',
    themes: '2 switchable layouts',
    connection: 'OBD-II port',
    gaugeDiameter: null,
    sensorIncluded: null,
    odometer: null,
  },
  'ADN-INT-018': { connection: 'Plug-in harness', gaugeDiameter: null, sensorIncluded: null },
  'ADN-INT-020': { keyType: 'Smart key', material: 'Soft TPU', weight: '14 g' },
  'ADN-INT-021': { organiserCapacity: null },
  'ADN-INT-022': {
    fit: 'Universal, sits on the boot floor',
    fixing: 'Anti-slip base with hook-and-loop strips',
    mesh: null,
    pieces: '1',
    foldedSize: 'Folds flat to 5 cm',
    Compartments: '3',
  },

  // ---- Lighting --------------------------------------------------------------
  'ADN-LGT-002': {
    lightSource: 'LED, 7 inch round',
    lowBeam: '30 W per side',
    output: '3600 lm per side',
    drl: 'Halo ring',
    indicators: 'Uses the factory indicators',
    connector: 'H4 plug',
  },
  'ADN-LGT-003': {
    lightSource: 'Tri-beam LED projector',
    lowBeam: '40 W per side',
    highBeam: '55 W per side',
    output: '5400 lm per side',
    drl: 'Yes, with welcome animation',
  },
  'ADN-LGT-004': { startUpAnimation: 'No' },
  'ADN-LGT-005': { indicators: 'Amber' },
  'ADN-LGT-006': {
    functions: 'Tail, brake, indicator, reverse, connecting light bar',
    lens: 'Red polycarbonate',
    connector: 'Plug-in to the factory harness, with a separate feed for the light bar',
  },
  'ADN-LGT-008': {
    socket: 'H11',
    power: '30 W per bulb',
    output: '6000 lm per pair',
    colourTemperature: '6000 K white and 3000 K yellow, switchable',
    cooling: 'Aluminium body with a mini fan',
  },
  'ADN-LGT-009': {
    socket: 'T10 (W5W) wedge',
    power: '1.5 W per bulb',
    output: '120 lm per bulb',
    cooling: 'Aluminium base, no fan',
    errorFree: 'Built-in resistor, error-free on most cars',
    ingressRating: null,
    ratedLife: '20000 hours',
    Quantity: 'Pack of 10',
  },
  'ADN-LGT-011': {
    type: 'LED fog lamp with bezel',
    power: '18 W per side',
    cutOff: 'Wide and low, left-hand traffic',
    harness: 'Plugs into the factory fog lamp connector',
  },
  'ADN-LGT-012': {
    type: 'Bi-LED projector retrofit, 3 inch',
    colour: 'White 6000 K',
    fit: 'Inside the headlamp housing, in place of the reflector bowl',
    harness: 'Drivers and H4 or H7 adaptor leads included',
  },
  'ADN-LGT-014': {
    functions: 'Amber sequential indicator',
    length: null,
    power: '5 W per side',
    trigger: 'Factory indicator feed',
    fit: 'Replaces the factory mirror indicator lens',
  },
  'ADN-LGT-016': {
    power: '20 W per pod',
    output: '1800 lm per pod',
    colour: 'White 6000 K',
    mount: 'A-pillar brackets on the factory hinge bolts',
  },
  'ADN-LGT-018': {
    strips: '4 sill plates (2 front, 2 rear)',
    colours: 'White',
    control: 'Lights when the door opens',
    ingressRating: 'IP65',
    power: '12V from the door courtesy feed',
    doorTrigger: 'Yes, through the door switch',
  },

  // ---- Performance -----------------------------------------------------------
  'ADN-PRF-001': { pipe: null, heatShield: null, neckDiameter: null, engineFitment: '1.2 litre four-cylinder petrol' },
  'ADN-PRF-002': {
    type: 'Cold air intake kit with cone filter',
    pipe: 'Mandrel-bent aluminium',
    heatShield: 'Included',
    neckDiameter: '76 mm',
    engineFitment: 'Petrol engines. Tell us your engine when you order.',
  },
  'ADN-PRF-003': { pipe: null, heatShield: null, neckDiameter: null, engineFitment: '1.5 litre petrol and 1.5 litre diesel. Tell us which when you order.' },
  'ADN-PRF-004': { outletDiameter: '2 x 76 mm', soundLevel: 'No change: a tip is cosmetic', catalyticConverter: 'Not affected' },
  'ADN-PRF-005': {
    inletDiameter: '57 mm',
    outletDiameter: '2 x 89 mm',
    length: null,
    fixing: 'Bolts to the factory flange and hangers',
    soundLevel: 'Louder than the factory silencer under load',
  },
  'ADN-PRF-006': {
    inletDiameter: '51 mm',
    outletDiameter: '76 mm, slant cut',
    length: '180 mm',
    finish: 'Polished',
    soundLevel: 'No change: a tip is cosmetic',
    catalyticConverter: 'Not affected',
  },
  'ADN-PRF-008': {
    type: 'Progressive lowering springs',
    damping: 'Uses the factory dampers',
    rideHeightRange: '30 mm lower, fixed',
    springRate: 'Progressive, about 20 percent stiffer than stock',
    topMounts: 'Uses the factory mounts',
    body: 'Cold-wound steel, powder coated',
    warranty: '1 year',
    Quantity: 'Set of 4',
  },
  'ADN-PRF-009': {
    type: 'Front strut tower brace',
    damping: null,
    rideHeightRange: null,
    springRate: null,
    topMounts: 'Bolts to the strut top nuts',
    body: 'Aluminium bar with steel end plates',
    alignment: 'Not needed',
    warranty: '1 year',
  },
  'ADN-PRF-010': { rotorSize: null, rotorStyle: null, caliper: 'Fits the factory caliper', minimumWheelSize: null, brakeFluid: null },
  'ADN-PRF-011': {
    padCompound: null,
    rotorSize: '288 x 25 mm',
    caliper: 'Fits the factory caliper',
    minimumWheelSize: null,
    brakeFluid: null,
    bedIn: '300 km gentle use, with new pads',
  },
  'ADN-PRF-012': { hoseBuild: null, coreSize: null },
  'ADN-PRF-013': {
    type: 'Baffled oil catch can',
    modes: null,
    connection: 'In line with the crankcase breather hose',
    reversible: 'No, the breather hose is cut',
    hoseBuild: 'Oil-resistant rubber, 2 lengths included',
    coreSize: null,
    Capacity: '300 ml, with dipstick and drain',
  },
  'ADN-PRF-014': { harness: null },
  'ADN-PRF-015': {
    type: '4-point harness',
    shell: null,
    upholstery: null,
    harnessSlots: null,
    mounting: 'Bolt-in eyebolts and backing plates included',
    seatWeight: null,
  },

  // ---- Wheels & Tyres --------------------------------------------------------
  'ADN-WHL-001': {
    diameter: '15 inch',
    width: '6J',
    boltPattern: '4x100',
    offset: 'ET38',
    finish: 'Gloss black machined',
    loadRating: '560 kg per wheel',
    weight: '7.4 kg per wheel',
    suggestedTyreSize: '185/65 R15',
  },
  'ADN-WHL-002': {
    diameter: '16 inch',
    width: '6.5J or 7J, by size',
    boltPattern: '4x100',
    offset: 'ET40 (6.5J) or ET35 (7J)',
    finish: 'Gunmetal',
    loadRating: '600 kg per wheel',
    weight: '8.6 kg per wheel',
    suggestedTyreSize: '195/50 R16',
  },
  'ADN-WHL-003': { width: '7J, 7.5J or 8J, by size', offset: 'ET40 (7J and 7.5J) or ET35 (8J)' },
  'ADN-WHL-004': {
    boltPattern: '5x100',
    offset: 'ET42',
    centreBore: '57.1 mm',
    finish: 'Hyper silver',
    weight: '9.6 kg per wheel',
    suggestedTyreSize: '215/45 R17',
  },
  'ADN-WHL-005': {
    width: '8J',
    boltPattern: '6x139.7',
    offset: 'ET20',
    centreBore: '106.1 mm',
    finish: 'Matte black',
    loadRating: '1100 kg per wheel',
    weight: '12.4 kg per wheel',
    suggestedTyreSize: '265/65 R17',
  },
  'ADN-WHL-006': { spacerThickness: null, spacerType: null, hubRingSize: null, Finish: 'Neo chrome' },
  'ADN-WHL-007': {
    thread: 'M12 x 1.5 extended studs',
    seat: null,
    material: 'Forged aluminium',
    quantity: '2',
    hubRingSize: null,
    'Bolt pattern (PCD)': '4x100',
  },
  'ADN-WHL-008': { centreCapDiameter: null, rimStripLength: null, Colour: 'Red' },
  'ADN-WHL-009': {
    material: 'ABS with a weighted floating badge',
    heatRating: null,
    fixing: 'Push-fit clips',
    quantity: '4',
    rimStripLength: null,
  },
  'ADN-WHL-013': { diameter: '13 inch', finish: 'Silver' },
  'ADN-WHL-014': { diameter: '14 inch', finish: 'Black and silver' },
  'ADN-WHL-015': { diameter: '15 inch', finish: 'Gloss black with red accents' },
  'ADN-WHL-011': {
    maxPressure: null,
    flowRate: null,
    power: null,
    autoCutOff: null,
    display: null,
    light: null,
    dutyCycle: null,
    Pieces: '25',
    Tools: 'T-handle reamer and insertion tool',
    Plugs: '15 tubeless repair strips',
    'Also in the kit': 'Rubber cement, valve caps, valve cores, blade, carry case',
    'Works on': 'Tubeless car and motorcycle tyres',
  },

  // ---- Audio & Tech ----------------------------------------------------------
  'ADN-AUD-002': {
    screen: '10.1 inch QLED, 2000 x 1200',
    memory: '8 GB RAM, 128 GB storage',
    cameraInputs: '360 degree camera input, plus reverse and front',
  },
  'ADN-AUD-003': {
    memory: '2 GB RAM, 32 GB storage',
    phoneMirroring: 'Wired, works with Apple CarPlay and Android Auto',
    sound: '4 x 45 W, 16-band equaliser',
    preOuts: 'Front, rear, sub, 2 V',
  },
  'ADN-AUD-005': {
    type: '2-way coaxial',
    power: '60 W RMS, 180 W peak',
    sensitivity: '90 dB',
    frequencyResponse: '60 Hz to 20 kHz',
    mountingDepth: '55 mm',
    cone: 'Polypropylene',
    tweeter: '20 mm, mounted on the cone',
    crossover: 'Built in',
  },
  'ADN-AUD-006': {
    power: '80 W RMS, 240 W peak',
    crossover: '12 dB per octave, inline, with plug-in adaptor harness',
    Fit: 'Factory front door and tweeter positions, adaptor rings included',
  },
  'ADN-AUD-008': {
    type: '4-channel amplifier',
    driver: null,
    power: '4 x 75 W RMS at 4 ohm',
    frequencyResponse: '20 Hz to 20 kHz',
    controls: 'Gain, high-pass and low-pass filters per channel pair',
    size: '220 x 130 x 45 mm',
  },
  'ADN-AUD-010': { thickness: '2.5 mm', coverage: '60 sq ft', sheets: '30 of 46 x 40 cm' },
  'ADN-AUD-012': {
    channels: 'Front only',
    resolution: '2K (1440p) front',
    gps: 'Not fitted',
    wiFi: '2.4 GHz, phone app',
    display: '2 inch IPS',
  },
  'ADN-AUD-013': {
    channels: 'Front, cabin and rear',
    resolution: '2K front, 1080p cabin and rear',
    fieldOfView: '140 degrees front, 120 degrees cabin and rear',
  },
  'ADN-AUD-014': { sensors: null, detectionRange: null, alert: null },
  'ADN-AUD-015': {
    camera: '4 cameras, AHD 1080p, 180 degree each',
    guidelines: 'Dynamic, with a 3D top view',
    sensors: null,
    detectionRange: null,
    alert: null,
    Calibration: 'Mat calibration at fitting',
  },
  'ADN-AUD-017': { mountType: null, wirelessCharging: null, phoneWidth: null },
  'ADN-AUD-018': {
    output: '15 W wireless',
    input: 'USB-C, 9 V 2 A or higher',
    wirelessCharging: '15 W, magnetic alignment',
    phoneWidth: 'Any phone with a magnetic ring; a ring sticker is included',
  },

  // ---- 4x4 & Overland --------------------------------------------------------
  'ADN-TRL-001': { extras: 'Side rails and wind deflector included' },
  'ADN-TRL-002': {
    type: 'Flat roof carrier',
    material: 'Powder-coated steel',
    size: '1500 x 1200 mm',
    dynamicLoad: '60 kg while driving',
    staticLoad: '200 kg when parked',
    mounting: 'Clamps to the roof gutters, no drilling',
    rackWeight: '24 kg',
    channels: null,
    extras: 'Rear ladder included',
  },
  'ADN-TRL-003': {
    type: 'Aero cross bars',
    material: 'Aluminium with a rubber top strip',
    size: '1200 mm bars',
    staticLoad: null,
    mounting: 'Clamps to the factory roof rails, lockable',
    rackWeight: '4.5 kg per pair',
    channels: 'T-slot on each bar',
    extras: '2 keys included',
  },
  'ADN-TRL-004': { recoveryPoints: null },
  'ADN-TRL-005': {
    part: 'Rock sliders with step plates',
    material: '3 mm steel tube and plate',
    serviceAccess: null,
    weight: '38 kg per pair',
    recoveryPoints: null,
  },
  'ADN-TRL-006': { airRam: null },
  'ADN-TRL-007': { airRam: 'Cyclone pre-cleaner head, 89 mm' },
  'ADN-TRL-009': {
    length: '42 inch, curved',
    power: '240 W',
    output: '21600 lm',
    Brackets: 'Windscreen-frame brackets for the listed car included',
  },
  'ADN-TRL-010': {
    item: 'Snatch strap, 2 bow shackles, gloves, bag',
    length: '9 m strap',
    stretch: 'About 20 percent',
    material: 'Nylon webbing strap, forged steel shackles',
    winchPull: null,
    winchRope: null,
  },
  'ADN-TRL-011': {
    item: 'Traction boards, pair',
    length: '1.1 m each',
    minimumBreakingStrength: null,
    stretch: null,
    material: 'Reinforced nylon',
    winchPull: null,
    winchRope: null,
    storage: 'Carry bag with mounting straps',
  },
  'ADN-TRL-012': { panelMaterial: null },
  'ADN-TRL-013': {
    capacity: null,
    material: null,
    holder: null,
    spout: null,
    seal: null,
    Pouches: '3 removable pouches included',
    Mounting: 'Bolts to the factory tailgate points, no drilling',
  },
  'ADN-TRL-014': {
    type: 'Side awning',
    sleeps: null,
    openSize: '2.5 x 2.5 m',
    mattress: null,
    ladder: null,
    weight: '12 kg',
    needs: 'A roof rack or cross bars to bolt to',
    Lighting: 'Built-in LED strip, 12V',
    Poles: 'Telescopic aluminium, with guy ropes and pegs',
  },
  'ADN-TRL-015': { flareWidth: null },
  'ADN-TRL-016': {
    material: 'ABS, textured black',
    stepWidth: null,
    load: null,
    surface: null,
    mounting: 'Factory arch points with the clips and screws supplied',
  },

  // ---- Car Care & Utility ----------------------------------------------------
  'ADN-CAR-001': { protection: null, towelWeight: null },
  'ADN-CAR-002': { volume: '500 ml', dilution: 'Ready to use', ph: null, towelWeight: null },
  'ADN-CAR-003': { volume: '1 litre shampoo', protection: null, 'Kit contents': 'Shampoo, microfibre wash mitt, grit guard, 2 drying towels' },
  'ADN-CAR-004': { brakeFluidGrade: null, coolant: null },
  'ADN-CAR-005': { kitContents: null },
  'ADN-CAR-006': {
    peakCurrent: null,
    starts: null,
    battery: null,
    outputs: null,
    protection: null,
    light: 'LED torch included',
    kitContents: '42 pieces including tow rope, warning triangle, jumper cables and first-aid pouch',
  },
  'ADN-CAR-007': { uvProtection: 'UV-resistant outer layer' },
  'ADN-CAR-008': { purifierFilter: null, purifierAirflow: null, power: null, warranty: null },
  'ADN-CAR-009': { washerPressure: null, washerFlow: null },

  // ---- Addon Merchandise -----------------------------------------------------
  'ADN-MER-001': { print: 'Puff print wordmark, tyre-mark sleeve print', Colour: 'Black' },
  'ADN-MER-002': { print: 'Embroidered wordmark, pit lane back print', details: 'Full zip, two side pockets, lined hood', Colour: 'Charcoal' },
  'ADN-MER-003': { cap: null, Colour: 'White' },
  'ADN-MER-004': {
    fabric: 'Cotton twill',
    fit: 'One size, adjustable strap',
    print: 'Embroidered wheel logo',
    neck: null,
    care: 'Hand wash cold, dry in shade',
    cap: 'Six-panel, curved peak, adjustable strap',
  },
  'ADN-MER-006': { movingPart: 'Free-spinning turbine', Finish: 'Polished silver' },
  'ADN-MER-008': { stickerMaterial: null, signMaterial: null },
};

// The box contents have their own list on the product page, taken from the copy module.
const SKIPPED_KEYS = new Set(['inTheBox']);

function warrantyPeriod(months) {
  if (months % 12 !== 0) return `${months} months`;
  return months === 12 ? '1 year' : `${months / 12} years`;
}

// The template's wording is kept when it agrees with the product's own warranty ("1 year on stitching"),
// replaced by the plain period when it does not, and dropped for parts sold without a warranty.
function warrantyValue(example, months) {
  if (months <= 0) return null;
  const period = warrantyPeriod(months);
  return example.includes(period) ? example : period;
}

/**
 * The spec rows of one product: [{ label, value }].
 *   template        catalog.specTemplates[subcategory]
 *   warrantyMonths  from the product's Straight Label
 *   variantPlan     { name, specKey, values } when the product is sold in variants: the row for
 *                   specKey (or a new row named after the option) lists the choices
 */
export function buildSpecs(product, template, { warrantyMonths, variantPlan = null }) {
  const own = PRODUCT_SPECS[product.sku] ?? {};
  const templateKeys = new Set(template.attributes.map((attribute) => attribute.key));
  const choices = variantPlan ? choiceList(variantPlan.values) : null;
  const rows = [];
  let warrantyRow = null;

  for (const attribute of template.attributes) {
    if (SKIPPED_KEYS.has(attribute.key)) continue;
    let value = attribute.example;
    if (Object.hasOwn(own, attribute.key)) value = own[attribute.key];
    else if (attribute.key === 'warranty') value = warrantyValue(attribute.example, warrantyMonths);
    if (variantPlan?.specKey === attribute.key) value = choices;
    if (value === null || value === '') continue;
    const row = { label: attribute.label, value: String(value) };
    if (attribute.key === 'warranty') warrantyRow = row;
    else rows.push(row);
  }

  for (const [label, value] of Object.entries(own)) {
    if (!templateKeys.has(label) && value !== null) rows.push({ label, value: String(value) });
  }
  if (variantPlan && !templateKeys.has(variantPlan.specKey)) rows.push({ label: variantPlan.name, value: choices });
  if (warrantyRow) rows.push(warrantyRow);
  return rows;
}

/** SKUs in PRODUCT_SPECS, so a test can check each one is still in the catalogue. */
export const SPEC_SKUS = Object.keys(PRODUCT_SPECS);
