// Seed extras: product relations, Pick of Three, the Friday Five, sample fitted
// reports and questions, coupons and house builds. Pure data, keyed by SKU.
// Reports, questions and builds are inserted with is_demo = 1 and shown as "Sample".

// "You will also need" (requires) and "works well with" (pairs_with).
export const RELATIONS = [
  // Wheels
  { sku: 'ADN-WHL-001', relatedSku: 'ADN-WHL-006', kind: 'pairs_with', note: 'Alloy wheels need conical-seat nuts. This set is M12 x 1.5 (Hyundai, Honda, Toyota); Maruti Suzuki studs are M12 x 1.25, so ask us for that thread.' },
  { sku: 'ADN-WHL-002', relatedSku: 'ADN-WHL-006', kind: 'pairs_with', note: 'Alloy wheels need conical-seat nuts. This set is M12 x 1.5 (Hyundai, Honda, Toyota); Maruti Suzuki studs are M12 x 1.25, so ask us for that thread.' },
  { sku: 'ADN-WHL-003', relatedSku: 'ADN-WHL-006', kind: 'pairs_with', note: 'Creta and Seltos studs are M12 x 1.5, so this set fits. Factory nuts often have the wrong seat for an aftermarket wheel.' },
  { sku: 'ADN-WHL-005', relatedSku: 'ADN-WHL-006', kind: 'pairs_with', note: 'Fortuner and Hilux hubs have six studs, so you need 24 nuts. Order two sets.' },
  { sku: 'ADN-WHL-004', relatedSku: 'ADN-PRF-007', kind: 'pairs_with', note: 'Same cars, same bolt pattern. Set the ride height after the wheels and tyres are on.' },
  { sku: 'ADN-WHL-001', relatedSku: 'ADN-WHL-008', kind: 'pairs_with', note: 'Open spokes show the calipers. Check for 3 mm of clearance behind the spokes first.' },
  { sku: 'ADN-WHL-002', relatedSku: 'ADN-WHL-012', kind: 'pairs_with', note: 'New tyres are going on anyway. The cap sensors screw onto the new valves in a minute.' },
  { sku: 'ADN-WHL-007', relatedSku: 'ADN-WHL-006', kind: 'pairs_with', note: 'These spacers carry their own studs, so the wheel needs a second set of nuts. Check your thread first.' },
  { sku: 'ADN-WHL-010', relatedSku: 'ADN-WHL-011', kind: 'pairs_with', note: 'Plug the hole, then pump it up. One without the other gets you half-way home.' },
  { sku: 'ADN-WHL-011', relatedSku: 'ADN-WHL-010', kind: 'requires', note: 'A plugged tyre is still flat. You need an inflator to drive away.' },
  { sku: 'ADN-WHL-012', relatedSku: 'ADN-WHL-010', kind: 'pairs_with', note: 'The monitor tells you a tyre is low. This is how you fix it without hunting for a pump.' },

  // Lighting
  { sku: 'ADN-LGT-007', relatedSku: 'ADN-LGT-009', kind: 'pairs_with', note: 'White headlamps beside yellow parking bulbs look mismatched. These bring the small bulbs to the same colour.' },
  { sku: 'ADN-LGT-007', relatedSku: 'ADN-LGT-008', kind: 'pairs_with', note: 'Keep the fog lamps yellow for rain and fog: white glare bounces straight back at you.' },
  { sku: 'ADN-LGT-001', relatedSku: 'ADN-LGT-004', kind: 'pairs_with', note: 'The same sequential indicator pattern front and rear on the Swift.' },
  { sku: 'ADN-LGT-001', relatedSku: 'ADN-LGT-010', kind: 'pairs_with', note: 'The bumper is off for the headlamps. Fitting fog projectors in the same visit saves paying that labour twice.' },
  { sku: 'ADN-LGT-002', relatedSku: 'ADN-LGT-005', kind: 'pairs_with', note: 'LED at the front makes the stock Thar tail lamps look dated. These match.' },
  { sku: 'ADN-LGT-003', relatedSku: 'ADN-LGT-006', kind: 'pairs_with', note: 'Front and rear animations made as a pair for the Creta.' },
  { sku: 'ADN-LGT-012', relatedSku: 'ADN-LGT-013', kind: 'pairs_with', note: 'The headlamp is already open for the retrofit. Adding DRL strips then costs almost no extra labour.' },
  { sku: 'ADN-LGT-016', relatedSku: 'ADN-TRL-009', kind: 'pairs_with', note: 'Pods and roof bar can share one wiring run down the pillar. Do both in one visit.' },

  // Exterior
  { sku: 'ADN-EXT-002', relatedSku: 'ADN-EXT-011', kind: 'pairs_with', note: 'A front lip alone leaves the tail looking bare. This is the rear piece for the same car.' },
  { sku: 'ADN-EXT-007', relatedSku: 'ADN-EXT-021', kind: 'pairs_with', note: 'Same carbon-look finish, same car.' },
  { sku: 'ADN-EXT-013', relatedSku: 'ADN-LGT-001', kind: 'pairs_with', note: 'The bumper comes off for both jobs. Do them together and pay that labour once.' },
  { sku: 'ADN-EXT-014', relatedSku: 'ADN-LGT-002', kind: 'pairs_with', note: 'The headlamps sit in the grille on a Thar. Change both in one visit.' },
  { sku: 'ADN-EXT-015', relatedSku: 'ADN-LGT-003', kind: 'pairs_with', note: 'The bumper comes off for both jobs. Do them together and pay that labour once.' },

  // Audio and tech
  { sku: 'ADN-AUD-004', relatedSku: 'ADN-AUD-009', kind: 'pairs_with', note: 'A damped door gives these speakers a solid box to work in. Few things in car audio give more per rupee.' },
  { sku: 'ADN-AUD-005', relatedSku: 'ADN-AUD-009', kind: 'pairs_with', note: 'The door cards are off anyway. Damping the doors now costs only the sheets.' },
  { sku: 'ADN-AUD-006', relatedSku: 'ADN-AUD-009', kind: 'pairs_with', note: 'The door cards are off anyway. Damping the doors now costs only the sheets.' },
  { sku: 'ADN-AUD-004', relatedSku: 'ADN-AUD-008', kind: 'pairs_with', note: 'These are rated for 90 W RMS. A head unit gives them about 20; an amplifier lets them do what they were built for.' },
  { sku: 'ADN-AUD-007', relatedSku: 'ADN-AUD-009', kind: 'pairs_with', note: 'Bass makes thin panels buzz. Damp the doors and boot floor before you blame the subwoofer.' },
  { sku: 'ADN-AUD-010', relatedSku: 'ADN-AUD-004', kind: 'pairs_with', note: 'The whole interior is out for damping. It is the cheapest moment to change the front speakers.' },
  { sku: 'ADN-AUD-001', relatedSku: 'ADN-AUD-014', kind: 'pairs_with', note: 'The unit has a reverse camera input. This camera plugs straight into it.' },
  { sku: 'ADN-AUD-003', relatedSku: 'ADN-AUD-014', kind: 'pairs_with', note: 'The unit has a reverse camera input. This camera plugs straight into it.' },
  { sku: 'ADN-AUD-002', relatedSku: 'ADN-AUD-015', kind: 'pairs_with', note: 'This unit has the 360 input the camera kit needs. Fit both in one visit and pay the dash labour once.' },
  { sku: 'ADN-AUD-001', relatedSku: 'ADN-AUD-005', kind: 'pairs_with', note: 'Once the head unit is better, the stock speakers are the weak link.' },
  { sku: 'ADN-AUD-011', relatedSku: 'ADN-AUD-017', kind: 'pairs_with', note: 'The camera takes the 12V socket. A two-port charger runs the camera and still charges a phone.' },
  { sku: 'ADN-AUD-012', relatedSku: 'ADN-AUD-017', kind: 'pairs_with', note: 'The camera takes the 12V socket. A two-port charger runs the camera and still charges a phone.' },

  // Performance
  { sku: 'ADN-PRF-002', relatedSku: 'ADN-PRF-005', kind: 'pairs_with', note: 'Intake and exhaust are the usual first two steps on a Polo. Neither does much alone; together you can hear the difference.' },
  { sku: 'ADN-PRF-014', relatedSku: 'ADN-PRF-015', kind: 'pairs_with', note: 'The seat has harness slots. Use a harness on track days only, with the seat properly mounted.' },
  { sku: 'ADN-PRF-015', relatedSku: 'ADN-PRF-014', kind: 'requires', note: 'A harness needs a seat with harness slots. Never use one with a standard reclining seat.' },

  // 4x4 and overland
  { sku: 'ADN-TRL-010', relatedSku: 'ADN-TRL-011', kind: 'pairs_with', note: 'Boards get you out alone. The strap is for when a second car is there to pull.' },
  { sku: 'ADN-TRL-011', relatedSku: 'ADN-WHL-010', kind: 'pairs_with', note: 'Air down for sand, air back up for the road. You need an inflator for the second half.' },
  { sku: 'ADN-TRL-001', relatedSku: 'ADN-TRL-009', kind: 'pairs_with', note: 'Both go on the roof. Fit them in one visit so the wiring and sealing are done once.' },
  { sku: 'ADN-TRL-014', relatedSku: 'ADN-TRL-001', kind: 'pairs_with', note: 'The awning needs a rack or cross bars to bolt to. On a Thar, this is the rack.' },
  { sku: 'ADN-TRL-002', relatedSku: 'ADN-TRL-004', kind: 'pairs_with', note: 'If the Jimny is going to carry a load off-road, protect the sump as well.' },
  { sku: 'ADN-TRL-013', relatedSku: 'ADN-TRL-010', kind: 'pairs_with', note: 'The recovery bag straps to the panel, so it is not loose in the cabin.' },

  // Car care
  { sku: 'ADN-CAR-001', relatedSku: 'ADN-CAR-002', kind: 'pairs_with', note: 'A pH-neutral wash will not strip the sealant you put on afterwards.' },
  { sku: 'ADN-CAR-003', relatedSku: 'ADN-CAR-002', kind: 'pairs_with', note: 'Wash properly first, then seal. The kit does the first half.' },
  { sku: 'ADN-CAR-005', relatedSku: 'ADN-CAR-006', kind: 'pairs_with', note: 'The kit covers a puncture or a breakdown. The jump starter covers a dead battery.' },
];

// The Friday Five: one item from each of five categories, each with the owner's real reason.
export const DROP = {
  title: 'The Friday Five',
  note: 'Five parts, a short window, a reason for each. Prices go back when the drop ends.',
  items: [
    { sku: 'ADN-LGT-008', percentOff: 15, reason: 'Fog season has started up north. The yellow mode is the useful one, and we have plenty.' },
    { sku: 'ADN-AUD-012', percentOff: 12, reason: 'A new batch has landed and the older boxes have to go first. Same camera inside.' },
    { sku: 'ADN-WHL-010', percentOff: 10, reason: 'We over-ordered before Diwali. Cold mornings drop tyre pressure, so it is a fair time to own one.' },
    { sku: 'ADN-CAR-003', percentOff: 15, reason: 'Every car in the city is wearing post-festival dust. We would rather you wash it properly.' },
    { sku: 'ADN-TRL-011', percentOff: 10, reason: 'Winter is trail season and we bought more boards than we have shelf for.' },
  ],
};

// The four codes the owner has used before (docs/COMPANY.md). Still seeded as samples, so the
// owner reviews them before going live. The coupon table has no category or first-order rule,
// so the audio, first-order and alloy-wheel conditions are stated in the description only.
export const COUPONS = [
  {
    code: 'ADDON10',
    description: '10% off orders above ₹2,999, up to ₹2,000.',
    type: 'percent',
    value: 10,
    minOrder: 2999,
    maxDiscount: 2000,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    isActive: true,
  },
  {
    code: 'SOUND1500',
    description: '₹1,500 off audio orders above ₹9,999.',
    type: 'flat',
    value: 1500,
    minOrder: 9999,
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    isActive: true,
  },
  {
    code: 'FIRSTRIDE',
    description: '₹500 off your first order above ₹3,999.',
    type: 'flat',
    value: 500,
    minOrder: 3999,
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    isActive: true,
  },
  {
    code: 'WHEELS30',
    description: 'Extra 5% off alloy wheel sets above ₹15,000, up to ₹3,000.',
    type: 'percent',
    value: 5,
    minOrder: 15000,
    maxDiscount: 3000,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    isActive: true,
  },
];

// Pick of Three, for every subcategory with three or more products.
// Many parts are car-specific, so each reason says who the pick is for.
export const PICKS = {
  'sun-control-films': {
    sensible: { sku: 'ADN-EXT-023', reason: 'A hatchback has the least glass, so the clear film costs the least and still takes the sting out of a car parked in the sun.' },
    sweet_spot: { sku: 'ADN-EXT-024', reason: 'The same clear film cut for a sedan, whose long, sloping rear window lets in much of the afternoon heat.' },
    all_out: { sku: 'ADN-EXT-025', reason: 'Ceramic film turns away more heat than the clear one at the same lightness. With six windows on a big SUV, that difference is worth paying for.' },
  },
  'wheel-covers': {
    sensible: { sku: 'ADN-WHL-013', reason: 'Plain silver for 13 inch steel wheels: the factory look again, without the scuffs.' },
    sweet_spot: { sku: 'ADN-WHL-014', reason: 'Black and silver for 14 inch wheels, a common size on base-model hatchbacks and compact sedans.' },
    all_out: { sku: 'ADN-WHL-015', reason: 'A sport pattern in black and red for 15 inch wheels: as close as a steel wheel gets to the look of an alloy.' },
  },
  'front-splitters': {
    sensible: { sku: 'ADN-EXT-003', reason: 'A rubber lip strip fits any bumper, costs little and shrugs off the speed breaker you misjudge.' },
    sweet_spot: { sku: 'ADN-EXT-001', reason: 'Moulded for the new Swift bumper, so it looks like it came with the car.' },
    all_out: { sku: 'ADN-EXT-002', reason: 'Three pieces that wrap the Virtus bumper corners: the most finished look here, and the lowest.' },
  },
  'spoilers-wings': {
    sensible: { sku: 'ADN-EXT-006', reason: 'The cheapest way in for a Baleno, as long as you were going to a painter anyway.' },
    sweet_spot: { sku: 'ADN-EXT-005', reason: 'A ducktail suits the City boot line and arrives finished in gloss black: fit it and you are done.' },
    all_out: { sku: 'ADN-EXT-007', reason: 'Costs the most and adds the least height, which is exactly right on a 3 Series.' },
  },
  'body-kits': {
    sensible: { sku: 'ADN-EXT-010', reason: 'A universal kit is a project, not a bolt-on; buy it only if your body shop enjoys trimming.' },
    sweet_spot: { sku: 'ADN-EXT-009', reason: 'Side skirts alone change the Creta profile without the cost and risk of a full kit.' },
    all_out: { sku: 'ADN-EXT-008', reason: 'The full Swift kit, front to back; budget the same again for paint and fitting.' },
  },
  grilles: {
    sensible: { sku: 'ADN-EXT-013', reason: 'Plain gloss-black honeycomb for the Swift: no wiring, no chrome, nothing to go wrong.' },
    sweet_spot: { sku: 'ADN-EXT-014', reason: 'On a Thar the grille is the face, and this one adds DRLs the car should have had.' },
    all_out: { sku: 'ADN-EXT-015', reason: 'A lot of sparkle for a Creta; check your radar and camera cut-outs before you fall for it.' },
  },
  'emblems-decals': {
    sensible: { sku: 'ADN-EXT-016', reason: 'Blacking out the chrome lettering is a fifteen-minute job that makes a Nexon look a trim level up.' },
    sweet_spot: { sku: 'ADN-EXT-017', reason: 'Twin stripes fit any bonnet, and if you tire of them a hair dryer takes them off.' },
    all_out: { sku: 'ADN-EXT-018', reason: 'Full side graphics for the Thar: pay a sticker shop to lay them, because bubbles do not come out.' },
  },
  'steering-wheels': {
    sensible: { sku: 'ADN-INT-002', reason: 'A stitched cover fixes a shiny, worn rim for the price of a lunch and does not touch the airbag.' },
    sweet_spot: { sku: 'ADN-INT-004', reason: 'Suede-touch grip and a centre marker for a little more; it slips on, so check your rim size.' },
    all_out: { sku: 'ADN-INT-003', reason: 'A full wheel swap with a shift display: fit it at a specialist, and accept what it does to the warranty.' },
  },
  'floor-mats': {
    sensible: { sku: 'ADN-INT-009', reason: 'Full-coverage mats for the Nexon at the lowest price here; the quilting hides dirt until wash day.' },
    sweet_spot: { sku: 'ADN-INT-007', reason: 'The Creta set covers the tunnel and the dead pedal properly, which loose universal mats never do.' },
    all_out: { sku: 'ADN-INT-008', reason: 'Plain TPE liners look dull and outlast everything, which is what you want under muddy school shoes.' },
  },
  'seat-covers': {
    sensible: { sku: 'ADN-INT-013', reason: 'If the seats are fine and your back is not, cushions are the honest fix.' },
    sweet_spot: { sku: 'ADN-INT-011', reason: 'Pattern-cut for the Baleno with tear-away airbag seams; fitted properly, they pass for factory upholstery.' },
    all_out: { sku: 'ADN-INT-012', reason: 'Perforated with contrast piping for the Venue; perforation matters more than piping in an Indian summer.' },
  },
  'ambient-lighting': {
    sensible: { sku: 'ADN-INT-015', reason: 'USB footwell lights give most of the effect for a tenth of the money, and you can fit them yourself.' },
    sweet_spot: { sku: 'ADN-INT-014', reason: 'Eighteen points done by a careful fitter look factory; done in a hurry they look like a wedding car.' },
    all_out: { sku: 'ADN-INT-016', reason: 'Plug-in harnesses for the XUV700 mean no cut wires, which is what you are paying the extra for.' },
  },
  headlights: {
    sensible: { sku: 'ADN-LGT-002', reason: 'A straight swap on the Thar that gives a whiter, wider beam than the stock halogens.' },
    sweet_spot: { sku: 'ADN-LGT-001', reason: 'Projectors and sequential indicators make a Swift look a generation newer; get the beam aimed.' },
    all_out: { sku: 'ADN-LGT-003', reason: 'Costs as much as a set of alloys; buy it for the welcome animation, not because the stock Creta lamps are poor.' },
  },
  'tail-lights': {
    sensible: { sku: 'ADN-LGT-005', reason: 'Four nuts and a plug per side on the Thar; an afternoon job at home.' },
    sweet_spot: { sku: 'ADN-LGT-004', reason: 'Sequential indicators and a clean LED signature for the Swift; choose it knowing a smoked lens is a little dimmer in rain.' },
    all_out: { sku: 'ADN-LGT-006', reason: 'The full-width bar looks expensive on a Creta and needs a fitter to wire across the boot lid.' },
  },
  'led-bulbs': {
    sensible: { sku: 'ADN-LGT-009', reason: 'Ten small bulbs that make the cabin, boot and number plate lamps white for the price of a pizza.' },
    sweet_spot: { sku: 'ADN-LGT-008', reason: 'Yellow for fog, white for clear nights, from the switch you already have.' },
    all_out: { sku: 'ADN-LGT-007', reason: 'The biggest change in light for the money, but only worth it in a projector or a well-aimed reflector.' },
  },
  'fog-projectors': {
    sensible: { sku: 'ADN-LGT-011', reason: 'Fits the Venue pockets with its own bezels; no cutting and no surprises.' },
    sweet_spot: { sku: 'ADN-LGT-010', reason: 'Bi-LED projectors in the factory pockets of three popular Marutis: real light, with a proper cut-off.' },
    all_out: { sku: 'ADN-LGT-012', reason: 'A projector inside the headlamp is the proper way to do LED, and it needs a specialist to open the lamp.' },
  },
  'air-intakes': {
    sensible: { sku: 'ADN-PRF-001', reason: 'Drops into the stock airbox and pays for itself in the paper filters you stop buying.' },
    sweet_spot: { sku: 'ADN-PRF-003', reason: 'The same idea for the Creta and Seltos: wash it, re-oil it, refit it.' },
    all_out: { sku: 'ADN-PRF-002', reason: 'A proper intake with a heat shield for the Polo: you buy it for the sound and admit it.' },
  },
  exhaust: {
    sensible: { sku: 'ADN-PRF-006', reason: 'A polished tip hides a rusty tailpipe for less than a tank of fuel.' },
    sweet_spot: { sku: 'ADN-PRF-004', reason: 'A twin tip fills the bumper cut-out better than a single and still just clamps on.' },
    all_out: { sku: 'ADN-PRF-005', reason: 'The only part here that changes the sound; live with the idea of highway drone before ordering.' },
  },
  suspension: {
    sensible: { sku: 'ADN-PRF-009', reason: 'A strut brace sharpens the front end a little and gives up nothing in clearance.' },
    sweet_spot: { sku: 'ADN-PRF-008', reason: 'A 30 mm drop is about the most a Swift can take on city roads without scraping daily.' },
    all_out: { sku: 'ADN-PRF-007', reason: 'Adjustable coilovers cost as much as a used hatchback; buy them if you do track days, not for stance alone.' },
  },
  'alloy-wheels': {
    sensible: { sku: 'ADN-WHL-001', reason: 'Fifteen inches keeps your tyre costs and ride comfort where they are.' },
    sweet_spot: { sku: 'ADN-WHL-002', reason: 'One size up in gunmetal mesh: fills the arch, hides brake dust and still rides well.' },
    all_out: { sku: 'ADN-WHL-005', reason: 'Six-stud wheels for the Fortuner and Hilux crowd, built to take a hit off-road.' },
  },
  'head-units': {
    sensible: { sku: 'ADN-AUD-003', reason: 'Enough memory for maps and music on an older Nexon, with the fascia frame included.' },
    sweet_spot: { sku: 'ADN-AUD-001', reason: 'Wireless phone mirroring and 4 GB of memory is the point where a head unit stops lagging.' },
    all_out: { sku: 'ADN-AUD-002', reason: 'Only makes sense with the 360 camera kit; without it you are paying for an input you will not use.' },
  },
  speakers: {
    sensible: { sku: 'ADN-AUD-005', reason: 'Coaxials are a straight swap for tired factory speakers, and most people hear the difference in one song.' },
    sweet_spot: { sku: 'ADN-AUD-004', reason: 'Components put the tweeter up near your ears, where factory systems cut corners.' },
    all_out: { sku: 'ADN-AUD-006', reason: 'No cut wires on a Virtus or Slavia; you pay extra for keeping the dealer calm.' },
  },
  'dash-cams': {
    sensible: { sku: 'ADN-AUD-012', reason: 'Front-only 2K reads number plates and is all most drivers need.' },
    sweet_spot: { sku: 'ADN-AUD-011', reason: 'Front and rear with GPS, because the hits you need footage of often come from behind.' },
    all_out: { sku: 'ADN-AUD-013', reason: 'The third camera films the cabin; it suits taxis and fleets more than a family car.' },
  },
  'roof-racks': {
    sensible: { sku: 'ADN-TRL-003', reason: 'Cross bars clamp to the factory rails, lock, and come off in ten minutes when the trip is over.' },
    sweet_spot: { sku: 'ADN-TRL-001', reason: 'A flat platform for the Thar that takes boxes, boards and an awning.' },
    all_out: { sku: 'ADN-TRL-002', reason: 'A full carrier with a ladder for the Jimny; remember its roof limit is lower than the rack makes it look.' },
  },
  detailing: {
    sensible: { sku: 'ADN-CAR-001', reason: 'A litre of proper shampoo lasts months and stops you using dish soap on your paint.' },
    sweet_spot: { sku: 'ADN-CAR-002', reason: 'Spray it on after a wash and water beads for weeks; it is not a workshop ceramic coating and does not claim to be.' },
    all_out: { sku: 'ADN-CAR-003', reason: 'Everything for a scratch-free wash in one box: shampoo, mitt, grit guard and towels.' },
  },
};

// Sample fitted reports. The app flags these as samples; they exist to show the format
// and are written to read like real, uneven experiences.
// fittedBy 'not_fitted' is used for things that need no fitting (timeMinutes and difficulty are null).
export const REPORTS = [
  // Floor mats
  { sku: 'ADN-INT-007', authorName: 'Rohit S.', vehicle: 'Hyundai Creta 2022', rating: 5, fittedBy: 'self', timeMinutes: 10, difficulty: 1, fittedOk: true, issues: '', body: 'Driver mat locked on the factory hooks first time and covers the dead pedal fully. Slight rubber smell for two days, gone now.' },
  { sku: 'ADN-INT-007', authorName: 'Meenal K.', vehicle: 'Hyundai Creta 2021', rating: 4, fittedBy: 'self', timeMinutes: 15, difficulty: 1, fittedOk: true, issues: 'The rear tunnel piece sat a little proud at first.', body: 'Took about a week in the sun to lie flat. Fine after that. Easy to wipe after a beach trip.' },
  { sku: 'ADN-INT-007', authorName: 'Arvind P.', vehicle: 'Hyundai Creta 2024', rating: 4, fittedBy: 'self', timeMinutes: 10, difficulty: 1, fittedOk: true, issues: '', body: 'Fits the 2024 car as well. I took beige and it shows every footprint. Order black if you have children.' },
  { sku: 'ADN-INT-009', authorName: 'Sneha D.', vehicle: 'Tata Nexon 2024', rating: 5, fittedBy: 'self', timeMinutes: 10, difficulty: 1, fittedOk: true, issues: '', body: 'Edges come right up the sides. Old mats went straight to the building watchman.' },
  { sku: 'ADN-INT-009', authorName: 'Imran Q.', vehicle: 'Tata Nexon 2023', rating: 3, fittedBy: 'self', timeMinutes: 20, difficulty: 2, fittedOk: false, issues: 'The passenger mat fouled the seat rail cover until I trimmed about 5 mm with a cutter.', body: 'Driver side is perfect. Passenger side needed a small trim. Not a big job, but it should not be needed on a custom mat.' },

  // Seat covers
  { sku: 'ADN-INT-011', authorName: 'Kavita R.', vehicle: 'Maruti Suzuki Baleno 2023', rating: 5, fittedBy: 'local_garage', timeMinutes: 150, difficulty: 3, fittedOk: true, issues: '', body: 'The seat cover shop near my house did it in two and a half hours. No wrinkles. Airbag tag is on the correct side, I checked.' },
  { sku: 'ADN-INT-011', authorName: 'Deepak M.', vehicle: 'Maruti Suzuki Baleno 2022', rating: 4, fittedBy: 'local_garage', timeMinutes: 180, difficulty: 3, fittedOk: true, issues: 'The garage first quoted ₹2,500 for fitting.', body: 'I showed them the fair labour line on the product page and we settled at ₹1,200. Covers themselves are good. Rear armrest cut-out is about a centimetre off but it works.' },

  // Headlights
  { sku: 'ADN-LGT-001', authorName: 'Varun T.', vehicle: 'Maruti Suzuki Swift 2020', rating: 5, fittedBy: 'local_garage', timeMinutes: 160, difficulty: 3, fittedOk: true, issues: '', body: 'Bumper had to come off as the page says. Garage aimed the beam against a wall afterwards. Night driving on the highway is much easier.' },
  { sku: 'ADN-LGT-001', authorName: 'Joseph A.', vehicle: 'Maruti Suzuki Swift 2019', rating: 3, fittedBy: 'local_garage', timeMinutes: 210, difficulty: 4, fittedOk: false, issues: 'Left indicator blinked fast after fitting. The adapter lead for that side had not been pushed in fully.', body: 'Sorted on the second visit once the garage reseated the plug. Light output is good. My car is the LXi with halogens, so the mechanic took time to work out the connectors.' },

  // LED bulbs
  { sku: 'ADN-LGT-007', authorName: 'Nikhil B.', vehicle: 'Hyundai Grand i10 Nios 2021', rating: 5, fittedBy: 'self', timeMinutes: 25, difficulty: 2, fittedOk: true, issues: '', body: 'Same socket as the old bulb. Marked the wall before and re-aimed after, as the fitting card says. Nobody has flashed me so far.' },
  { sku: 'ADN-LGT-007', authorName: 'Suresh G.', vehicle: 'Maruti Suzuki Wagon R 2020', rating: 3, fittedBy: 'self', timeMinutes: 40, difficulty: 3, fittedOk: false, issues: 'The dust cap would not close over the fan at the back of the bulb.', body: 'Bought deeper rubber caps from a spares shop for ₹150 and it was fine. Light is good, but check the space behind your headlamp first.' },
  { sku: 'ADN-LGT-007', authorName: 'Farhan Z.', vehicle: 'Maruti Suzuki Alto K10 2023', rating: 4, fittedBy: 'local_garage', timeMinutes: 20, difficulty: 2, fittedOk: true, issues: '', body: 'Mechanic charged ₹200. Whiter and brighter. In heavy rain I still prefer the old yellow light, to be honest.' },

  // Fog projectors
  { sku: 'ADN-LGT-010', authorName: 'Pooja N.', vehicle: 'Maruti Suzuki Baleno 2023', rating: 5, fittedBy: 'local_garage', timeMinutes: 90, difficulty: 3, fittedOk: true, issues: '', body: 'Went into the factory pockets. Yellow mode on a foggy morning near Lonavala was worth the money.' },
  { sku: 'ADN-LGT-010', authorName: 'Harish V.', vehicle: 'Maruti Suzuki Brezza 2022', rating: 4, fittedBy: 'self', timeMinutes: 150, difficulty: 4, fittedOk: false, issues: 'Wire colours on my harness did not match the sheet: the switch wire was blue, not yellow.', body: 'Worked it out with a test lamp. Once wired, the cut-off is sharp. Not a beginner job; a garage would be faster.' },

  // Alloy wheels
  { sku: 'ADN-WHL-002', authorName: 'Aditya J.', vehicle: 'Maruti Suzuki Swift 2021', rating: 5, fittedBy: 'local_garage', timeMinutes: 75, difficulty: 3, fittedOk: true, issues: '', body: 'Tyre shop mounted and balanced all four. Running 195/50 R16 with no rubbing at full lock. Ride is slightly firmer, as expected.' },
  { sku: 'ADN-WHL-002', authorName: 'Gaurav L.', vehicle: 'Maruti Suzuki Baleno 2023', rating: 4, fittedBy: 'local_garage', timeMinutes: 90, difficulty: 3, fittedOk: true, issues: 'The stock nuts did not seat properly on these wheels.', body: 'Needed conical M12 x 1.25 nuts, which the tyre shop had in stock. Hub rings were in the box. Went back after 50 km for a re-torque.' },
  { sku: 'ADN-WHL-001', authorName: 'Tanvi H.', vehicle: 'Hyundai i20 2021', rating: 5, fittedBy: 'local_garage', timeMinutes: 60, difficulty: 3, fittedOk: true, issues: '', body: 'Kept my existing 15-inch tyres, so the only cost was mounting and balancing. Looks like a higher variant now.' },

  // Tyre inflator
  { sku: 'ADN-WHL-010', authorName: 'Prakash I.', vehicle: 'Honda Amaze 2019', rating: 5, fittedBy: 'not_fitted', timeMinutes: null, difficulty: null, fittedOk: true, issues: '', body: 'Took about four minutes per tyre from 25 to 33 PSI. Auto cut-off is accurate to within 1 PSI against the pump gauge.' },
  { sku: 'ADN-WHL-010', authorName: 'Ritu C.', vehicle: 'Kia Sonet 2022', rating: 4, fittedBy: 'not_fitted', timeMinutes: null, difficulty: null, fittedOk: true, issues: 'It gets hot and loud.', body: 'Does the job. Needs a rest after two tyres, which the page does mention. The cable reaches the rear wheels.' },

  // Head unit
  { sku: 'ADN-AUD-001', authorName: 'Manish W.', vehicle: 'Maruti Suzuki Swift 2019', rating: 5, fittedBy: 'local_garage', timeMinutes: 120, difficulty: 4, fittedOk: true, issues: '', body: 'Plug and play with the coupler. Steering buttons worked straight away. Wireless mirroring connects by the time I have reversed out.' },
  { sku: 'ADN-AUD-001', authorName: 'Shruti E.', vehicle: 'Maruti Suzuki Dzire 2021', rating: 3, fittedBy: 'local_garage', timeMinutes: 180, difficulty: 4, fittedOk: false, issues: 'Steering volume buttons did not respond until the control box was put through its learning mode.', body: 'The installer had not read the sheet. Fine after a call with the shop. The screen is sharp; the sound is the same as before on stock speakers.' },
  { sku: 'ADN-AUD-001', authorName: 'Vikram O.', vehicle: 'Maruti Suzuki Swift 2022', rating: 4, fittedBy: 'self', timeMinutes: 200, difficulty: 4, fittedOk: true, issues: '', body: 'Did it myself over a Sunday with plastic trim tools. The fascia clips are tight, go slowly. Wrap the loose wires or they rattle behind the dash.' },

  // Dash cams
  { sku: 'ADN-AUD-011', authorName: 'Ananya F.', vehicle: 'Hyundai Venue 2023', rating: 5, fittedBy: 'self', timeMinutes: 45, difficulty: 2, fittedOk: true, issues: '', body: 'Tucked the cable into the headliner with the trim tool in the box. Number plates are readable in daylight. Bought a high-endurance card separately as advised.' },
  { sku: 'ADN-AUD-011', authorName: 'Rajesh Y.', vehicle: 'Toyota Innova Hycross 2024', rating: 3, fittedBy: 'local_garage', timeMinutes: 75, difficulty: 3, fittedOk: false, issues: 'The rear camera cable was about half a metre short for a car this long when routed neatly along the roof.', body: 'The garage ran it along the floor trim instead. It works, but check the cable length if you have a three-row car.' },
  { sku: 'ADN-AUD-012', authorName: 'Divya U.', vehicle: 'Tata Punch 2023', rating: 4, fittedBy: 'self', timeMinutes: 30, difficulty: 1, fittedOk: true, issues: '', body: 'Simple front camera. Runs from the socket. Parking mode needs the hardwire kit, which I have not bought yet.' },

  // Speakers and damping
  { sku: 'ADN-AUD-005', authorName: 'Sandeep K.', vehicle: 'Maruti Suzuki Wagon R 2021', rating: 5, fittedBy: 'local_garage', timeMinutes: 70, difficulty: 3, fittedOk: true, issues: '', body: 'Straight swap in the front doors. Vocals are clear now. The stock speakers were paper with a magnet the size of a coin.' },
  { sku: 'ADN-AUD-005', authorName: 'Lokesh R.', vehicle: 'Tata Tiago 2022', rating: 3, fittedBy: 'self', timeMinutes: 110, difficulty: 3, fittedOk: false, issues: 'The speaker would not sit in the door without adapter rings, and they are not in the box.', body: 'Got a pair of plastic rings locally for ₹200. Sound is good once in. The page should say rings may be needed.' },
  { sku: 'ADN-AUD-009', authorName: 'Neha P.', vehicle: 'Honda City 2021', rating: 4, fittedBy: 'local_garage', timeMinutes: 240, difficulty: 4, fittedOk: true, issues: 'One door clip broke during removal.', body: 'Four doors took half a day. Doors shut with a heavier sound and the speakers have more body. Road noise is a little lower, not gone.' },

  // Exterior
  { sku: 'ADN-EXT-005', authorName: 'Karthik N.', vehicle: 'Honda City 2022', rating: 5, fittedBy: 'local_garage', timeMinutes: 80, difficulty: 2, fittedOk: true, issues: '', body: 'Sits flush on the boot edge with no gap at the ends. The body shop sealed the bolt holes and I checked for leaks after a wash.' },
  { sku: 'ADN-EXT-005', authorName: 'Abhishek D.', vehicle: 'Honda City 2021', rating: 4, fittedBy: 'local_garage', timeMinutes: 100, difficulty: 3, fittedOk: true, issues: 'The garage wanted to fix it with tape only.', body: 'I insisted on the bolts as the fitting card says. Glad I did. The gloss finish matches the black trim on the car.' },
  { sku: 'ADN-EXT-001', authorName: 'Yash M.', vehicle: 'Maruti Suzuki Swift 2025', rating: 4, fittedBy: 'self', timeMinutes: 70, difficulty: 2, fittedOk: true, issues: '', body: 'Did it on ramps with a friend holding it. It has already touched one speed breaker with four people in the car. Marked, not broken.' },

  // Performance
  { sku: 'ADN-PRF-008', authorName: 'Siddharth B.', vehicle: 'Maruti Suzuki Swift 2021', rating: 5, fittedBy: 'local_garage', timeMinutes: 300, difficulty: 5, fittedOk: true, issues: '', body: 'A suspension shop did it in five hours including alignment. The car turns in much better. Firm, but not crashy.' },
  { sku: 'ADN-PRF-008', authorName: 'Naveen S.', vehicle: 'Maruti Suzuki Swift 2019', rating: 3, fittedBy: 'local_garage', timeMinutes: 360, difficulty: 5, fittedOk: true, issues: '', body: 'Looks right and handles well. But it scrapes on one speed breaker in my lane with the family on board, exactly as the skip line warned. Think about your roads.' },
  { sku: 'ADN-PRF-001', authorName: 'Tarun G.', vehicle: 'Maruti Suzuki Dzire 2020', rating: 4, fittedBy: 'self', timeMinutes: 15, difficulty: 1, fittedOk: true, issues: '', body: 'Four clips and done. A little more intake sound above 4,000 rpm. I cannot honestly feel more power.' },
  { sku: 'ADN-PRF-004', authorName: 'Mohit A.', vehicle: 'Hyundai i20 2019', rating: 2, fittedBy: 'self', timeMinutes: 50, difficulty: 3, fittedOk: false, issues: 'My tailpipe is far thinner than the 63 mm inlet, so the clamp would not grip.', body: 'I should have measured first. A silencer shop made a sleeve for ₹300 and it is solid now. The tip itself is well finished.' },

  // 4x4
  { sku: 'ADN-TRL-001', authorName: 'Dhruv C.', vehicle: 'Mahindra Thar 2022', rating: 5, fittedBy: 'local_garage', timeMinutes: 150, difficulty: 3, fittedOk: true, issues: '', body: 'Two people and two and a half hours. No rattles at 100 km/h. Some wind noise above 80, which I expected.' },
  { sku: 'ADN-TRL-001', authorName: 'Ishaan V.', vehicle: 'Mahindra Thar 2021', rating: 3, fittedBy: 'self', timeMinutes: 210, difficulty: 4, fittedOk: false, issues: 'One rear bracket hole was about 2 mm off and had to be slotted with a file.', body: 'Fitted it with a friend. Solid once on. On a hard top it is fine; I do not know how it would go on a convertible top.' },
  { sku: 'ADN-TRL-006', authorName: 'Pranav H.', vehicle: 'Mahindra Thar 2023', rating: 4, fittedBy: 'local_garage', timeMinutes: 270, difficulty: 5, fittedOk: true, issues: '', body: 'Watching someone cut a hole in the fender of a new car is not easy. The template was accurate. The workshop sealed the airbox and did the hand-over-the-intake test.' },
  { sku: 'ADN-TRL-015', authorName: 'Ramesh T.', vehicle: 'Mahindra Scorpio N 2023', rating: 5, fittedBy: 'local_garage', timeMinutes: 90, difficulty: 3, fittedOk: true, issues: '', body: 'My parents can climb in without help now. Bolted to the existing points with no drilling.' },
  { sku: 'ADN-TRL-015', authorName: 'Geeta L.', vehicle: 'Mahindra Scorpio N 2022', rating: 4, fittedBy: 'local_garage', timeMinutes: 120, difficulty: 3, fittedOk: true, issues: 'The garage charged ₹2,500 against the ₹800 to ₹1,800 shown on the page.', body: 'The steps are sturdy and do not flex. Agree the labour before they start; I did not.' },

  // Utility
  { sku: 'ADN-CAR-005', authorName: 'Sameer J.', vehicle: 'Hyundai Verna 2018', rating: 5, fittedBy: 'not_fitted', timeMinutes: null, difficulty: null, fittedOk: true, issues: '', body: 'Battery died in an airport car park after ten days. Started on the first try. It has paid for itself already.' },
  { sku: 'ADN-CAR-005', authorName: 'Anjali W.', vehicle: 'Toyota Innova Crysta 2019', rating: 4, fittedBy: 'not_fitted', timeMinutes: null, difficulty: null, fittedOk: true, issues: 'It had dropped to two bars after four months in the boot.', body: 'Started the diesel on the second attempt. Recharge it regularly as they say. I had forgotten.' },
  { sku: 'ADN-WHL-012', authorName: 'Kunal E.', vehicle: 'Maruti Suzuki Ertiga 2022', rating: 5, fittedBy: 'self', timeMinutes: 15, difficulty: 1, fittedOk: true, issues: '', body: 'Screwed the sensors on and the display picked them up within a minute of driving. It caught a slow puncture on the rear left the following week.' },
  { sku: 'ADN-WHL-012', authorName: 'Bhavna S.', vehicle: 'Renault Kwid 2021', rating: 3, fittedBy: 'self', timeMinutes: 20, difficulty: 1, fittedOk: true, issues: 'The air pump attendant has to remove the lock nut and sensor every time.', body: 'Works as described. Topping up air is now a small ceremony with the little spanner. Keep the spanner in the car.' },
  { sku: 'ADN-AUD-014', authorName: 'Vivek R.', vehicle: 'Maruti Suzuki Swift 2020', rating: 4, fittedBy: 'local_garage', timeMinutes: 100, difficulty: 3, fittedOk: true, issues: '', body: 'Fitted along with the head unit. Clear in daylight, grainy but usable at night. The guidelines move with the steering.' },
];

// Sample questions. Fitment questions name a vehicle generation from the catalogue
// (make slug, model slug, first year of the generation) and carry the shop's verdict.
export const QUESTIONS = [
  { sku: 'ADN-LGT-007', kind: 'general', authorName: 'Amit K.', question: 'Will these show a bulb error on the dashboard?', answer: 'Not on most cars: the decoder is built in. A few European cars still flag it. If yours does, an external decoder fixes it: ask us before ordering.' },
  { sku: 'ADN-WHL-003', kind: 'general', authorName: 'Rahul D.', question: 'Are tyres included in the price?', answer: 'No. The price is for four wheels with centre caps and hub rings. Tyres, mounting and balancing are extra at your tyre shop.' },
  { sku: 'ADN-AUD-011', kind: 'general', authorName: 'Priya S.', question: 'Is a memory card included?', answer: 'No. Buy a high-endurance microSD card of 64 GB or more. Ordinary cards wear out within months of loop recording.' },
  { sku: 'ADN-INT-011', kind: 'general', authorName: 'Sunita M.', question: 'My Baleno has side airbags in the front seats. Are these covers safe with them?', answer: 'Yes, if they are fitted the right way round. The airbag side has tear-away stitching and a tag. Make sure the fitter keeps that seam free and does not tie a strap across it.' },
  { sku: 'ADN-EXT-020', kind: 'general', authorName: 'Jatin P.', question: 'Can I put this on my car in place of the number plate?', answer: 'No. This is a decorative show plate for a garage wall, a showroom or a photo shoot on private premises. On the road your car must carry its HSRP and nothing else.' },
  { sku: 'ADN-TRL-008', kind: 'general', authorName: 'Arjun T.', question: 'Can I use this on the highway at night?', answer: 'No. It is for off-road use. On public roads it must be switched off and covered, and the cover is in the box. For the highway, look at fog lamps or driving lights with a proper cut-off.' },
  { sku: 'ADN-LGT-017', kind: 'general', authorName: 'Zoya N.', question: 'Is underbody lighting legal?', answer: 'Not on public roads. Use it at shows, shoots and on private land, and switch it off before you drive out. That is why the page is marked off-road only.' },
  { sku: 'ADN-PRF-005', kind: 'general', authorName: 'Dev B.', question: 'How loud is it compared with the stock exhaust?', answer: 'Clearly louder under load, with some drone at a steady highway cruise. It keeps the catalytic converter. If you need the car quiet, fit a tip instead.' },
  { sku: 'ADN-CAR-005', kind: 'general', authorName: 'Lata G.', question: 'Can I carry this on a flight?', answer: 'Airlines set their own limits for lithium packs in cabin baggage and do not allow them in checked bags. Check with your airline before you fly. We ship it by surface for the same reason.' },
  { sku: 'ADN-AUD-016', kind: 'general', authorName: 'Feroz H.', question: 'Does it need a relay?', answer: 'For two horns on one feed, yes. The stock wire is sized for one small horn. A relay and fuse cost about ₹150 at any auto electrician.' },
  { sku: 'ADN-EXT-008', kind: 'general', authorName: 'Nitin V.', question: 'Does the kit come painted?', answer: 'It comes in primer. Your body shop paints it to the colour code on your car. Test-fit every piece before paint, not after.' },
  { sku: 'ADN-INT-018', kind: 'general', authorName: 'Harpreet S.', question: 'Will my odometer reading change after fitting?', answer: 'No. The cluster reads the distance from the car and it cannot be edited. It does need coding by a specialist to match your variant.' },
  { sku: 'ADN-PRF-008', kind: 'general', authorName: 'Akash R.', question: 'Will the ride become harsh?', answer: 'Firmer, yes. Harsh, no, on decent roads. With four adults on broken roads you will notice it and may scrape. If that is your daily route, leave the springs stock.' },

  { sku: 'ADN-EXT-001', kind: 'fitment', authorName: 'Rakesh J.', vehicle: { make: 'maruti-suzuki', model: 'swift', yearFrom: 2018 }, question: 'Will this fit my 2021 Swift?', answer: 'No. The 2018 to 2024 Swift has a different bumper shape, and this splitter is moulded for the 2024 car. The universal lip strip will fit yours.', answerFitType: 'no' },
  { sku: 'ADN-PRF-001', kind: 'fitment', authorName: 'Tejas W.', vehicle: { make: 'maruti-suzuki', model: 'swift', yearFrom: 2024 }, question: 'I have the new 2024 Swift. Does this filter fit?', answer: 'No. The 2024 Swift has a new three-cylinder engine with a different airbox. This filter is for the earlier four-cylinder cars.', answerFitType: 'no' },
  { sku: 'ADN-AUD-003', kind: 'fitment', authorName: 'Shreya C.', vehicle: { make: 'tata', model: 'nexon', yearFrom: 2023 }, question: 'Will it fit the 2024 Nexon?', answer: 'No. The 2023 facelift has a different dashboard with a floating screen, so this fascia frame does not fit. It is for the 2017 to 2023 car only.', answerFitType: 'no' },
  { sku: 'ADN-TRL-015', kind: 'fitment', authorName: 'Balwinder K.', vehicle: { make: 'mahindra', model: 'scorpio-classic', yearFrom: 2022 }, question: 'Can I fit these on a Scorpio Classic?', answer: 'No. The Classic has a different chassis and mounting points from the Scorpio N. These brackets will not line up.', answerFitType: 'no' },
  { sku: 'ADN-EXT-005', kind: 'fitment', authorName: 'Mahesh I.', vehicle: { make: 'honda', model: 'city', yearFrom: 2014 }, question: 'Will this fit a 2017 City?', answer: 'No. The boot lid of the 2014 to 2020 City has a different curve, so the spoiler would leave gaps at the ends. It is made for the 2020 car onwards.', answerFitType: 'no' },
  { sku: 'ADN-INT-019', kind: 'fitment', authorName: 'Rekha A.', vehicle: { make: 'kia', model: 'carens', yearFrom: 2022 }, question: 'Does it fit the Carens smart key?', answer: 'Yes. The Carens smart key has the same shape and button layout as the Seltos and Sonet key, and the shell closes over it properly.', answerFitType: 'direct' },
  { sku: 'ADN-INT-020', kind: 'fitment', authorName: 'Pankaj O.', vehicle: { make: 'maruti-suzuki', model: 'grand-vitara', yearFrom: 2022 }, question: 'Will this fit the Grand Vitara key?', answer: 'Yes. The Grand Vitara uses the same smart key as the Brezza and Baleno, so the cover fits as it is.', answerFitType: 'direct' },
  { sku: 'ADN-AUD-006', kind: 'fitment', authorName: 'Nisha F.', vehicle: { make: 'volkswagen', model: 'taigun', yearFrom: 2021 }, question: 'Can this go in a Taigun?', answer: 'Yes. The Taigun shares its front door speaker mount and connector with the Virtus, so the kit plugs in the same way.', answerFitType: 'direct' },
  { sku: 'ADN-WHL-002', kind: 'fitment', authorName: 'Chetan L.', vehicle: { make: 'maruti-suzuki', model: 'dzire', yearFrom: 2017 }, question: 'Will these 16-inch wheels fit my Dzire?', answer: 'The bolt pattern matches. You will need 195/50 R16 tyres to keep the rolling diameter close to stock, and conical nuts in M12 x 1.25 for Maruti Suzuki studs.', answerFitType: 'with_work' },
  { sku: 'ADN-LGT-002', kind: 'fitment', authorName: 'Gurpreet N.', vehicle: { make: 'mahindra', model: 'thar', yearFrom: 2010 }, question: 'I have the old Thar, 2017 model. Will these fit?', answer: 'The 7-inch lamp drops into the old Thar headlamp bucket and uses the same H4 plug. The halo DRL needs its own ignition feed, which the old car does not have at the lamp.', answerFitType: 'with_work' },
  { sku: 'ADN-AUD-001', kind: 'fitment', authorName: 'Swati B.', vehicle: { make: 'maruti-suzuki', model: 'baleno', yearFrom: 2015 }, question: 'Can I fit this in a 2019 Baleno?', answer: 'The unit and coupler work, but the Baleno dashboard needs its own fascia frame, which is not in this box. Ask us before ordering and we will tell you if we have the frame.', answerFitType: 'with_work' },
];

// House builds for Build Bay. Every part maps to a product through its SKU; the seed
// swaps sku for productId. Tint stays at 0: we do not sell tint film.
export const BUILDS = [
  {
    title: 'Street Swift',
    vehicleLabel: 'Maruti Suzuki Swift (2018-2024)',
    state: {
      bodyType: 'hatchback',
      paint: '#c1121f',
      rideHeight: -1,
      wheelSize: 1,
      night: false,
      tint: 0,
      parts: {
        wheels: { style: 'mesh', color: '#5a5d62', sku: 'ADN-WHL-002' },
        lowering: { style: 'springs', sku: 'ADN-PRF-008' },
        skirts: { style: 'blade', sku: 'ADN-EXT-008' },
        exhaust: { style: 'twin', sku: 'ADN-PRF-004' },
        decal: { style: 'stripe', color: '#151515', sku: 'ADN-EXT-017' },
      },
    },
    skus: ['ADN-WHL-002', 'ADN-PRF-008', 'ADN-EXT-008', 'ADN-PRF-004', 'ADN-EXT-017'],
  },
  {
    title: 'Weekend i20',
    vehicleLabel: 'Hyundai i20 (2020 onwards)',
    state: {
      bodyType: 'hatchback',
      paint: '#f4f4f2',
      rideHeight: 0,
      wheelSize: 0,
      night: false,
      tint: 0,
      parts: {
        wheels: { style: 'split-spoke', color: '#18181b', sku: 'ADN-WHL-001' },
        spoiler: { style: 'roof', sku: 'ADN-EXT-004' },
        splitter: { style: 'lip', sku: 'ADN-EXT-003' },
        exhaust: { style: 'single', sku: 'ADN-PRF-006' },
      },
    },
    skus: ['ADN-WHL-001', 'ADN-EXT-004', 'ADN-EXT-003', 'ADN-PRF-006'],
  },
  {
    title: 'Night Shift Virtus',
    vehicleLabel: 'Volkswagen Virtus (2022 onwards)',
    state: {
      bodyType: 'sedan',
      paint: '#2c2f36',
      rideHeight: -2,
      wheelSize: 1,
      night: true,
      tint: 0,
      parts: {
        wheels: { style: 'five-spoke', color: '#c9ccd1', sku: 'ADN-WHL-004' },
        lowering: { style: 'coilover', sku: 'ADN-PRF-007' },
        splitter: { style: 'race', sku: 'ADN-EXT-002' },
        diffuser: { style: 'fins', sku: 'ADN-EXT-011' },
        underglow: { style: 'glow', color: '#19c2ff', sku: 'ADN-LGT-017' },
      },
    },
    skus: ['ADN-WHL-004', 'ADN-PRF-007', 'ADN-EXT-002', 'ADN-EXT-011', 'ADN-LGT-017'],
  },
  {
    title: 'Trail Thar',
    vehicleLabel: 'Mahindra Thar (2020 onwards)',
    state: {
      bodyType: 'suv',
      paint: '#4a5a44',
      rideHeight: 0,
      wheelSize: 0,
      night: true,
      tint: 0,
      parts: {
        roofRack: { style: 'basket', sku: 'ADN-TRL-001' },
        lightBar: { style: 'roof-bar', sku: 'ADN-TRL-009' },
        snorkel: { style: 'snorkel', sku: 'ADN-TRL-006' },
        sideStep: { style: 'board', sku: 'ADN-TRL-005' },
        decal: { style: 'side-graphic', color: '#1d1d1f', sku: 'ADN-EXT-018' },
      },
    },
    skus: ['ADN-TRL-001', 'ADN-TRL-009', 'ADN-TRL-006', 'ADN-TRL-005', 'ADN-EXT-018'],
  },
  {
    title: 'Long Way Fortuner',
    vehicleLabel: 'Toyota Fortuner (2016 onwards)',
    state: {
      bodyType: 'suv',
      paint: '#e8e6e1',
      rideHeight: 0,
      wheelSize: 0,
      night: false,
      tint: 0,
      parts: {
        wheels: { style: 'steelie', color: '#121212', sku: 'ADN-WHL-005' },
        snorkel: { style: 'snorkel', sku: 'ADN-TRL-007' },
        lightBar: { style: 'bumper-pods', sku: 'ADN-TRL-008' },
      },
    },
    skus: ['ADN-WHL-005', 'ADN-TRL-007', 'ADN-TRL-008'],
  },
];
