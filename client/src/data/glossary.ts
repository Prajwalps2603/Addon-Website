/**
 * Plain Talk: the words the trade uses, explained the way a good mechanic would explain them.
 * `short` is the two-line answer shown when a shopper taps a word (see Jargon in components/commerce).
 * `long` is the paragraph on the /glossary page. Neither may lean on another technical word.
 */

export type GlossaryCategory = 'wheels' | 'lighting' | 'electrical' | 'audio' | 'fitting' | 'suspension' | 'care' | 'legal';

export interface GlossaryEntry {
  /** URL-safe id: the entry's anchor on the glossary page, `/glossary#pcd`. */
  id: string;
  /** The word as it is usually written. */
  term: string;
  /** Other spellings and trade words that mean the same thing. */
  aliases: string[];
  /** Two lines at most. */
  short: string;
  /** A short paragraph. */
  long: string;
  category: GlossaryCategory;
}

export const GLOSSARY_CATEGORIES: readonly { id: GlossaryCategory; label: string }[] = [
  { id: 'wheels', label: 'Wheels and tyres' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'audio', label: 'Audio and screens' },
  { id: 'fitting', label: 'Fitting' },
  { id: 'suspension', label: 'Ride and handling' },
  { id: 'care', label: 'Body and care' },
  { id: 'legal', label: 'Papers and rules' },
];

function slug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function entry(category: GlossaryCategory, term: string, aliases: string[], short: string, long: string): GlossaryEntry {
  return { id: slug(term), term, aliases, short, long, category };
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  // ---------------------------------------------------------------- wheels and tyres
  entry(
    'wheels',
    'PCD',
    ['pitch circle diameter', 'bolt pattern', 'stud pattern'],
    'The bolt pattern of a wheel: how many bolts, and how wide the circle they sit on. 4x100 means four bolts on a 100 mm circle.',
    'PCD tells you whether a wheel will even go onto your car. It is written as two numbers: the count of bolts, then the width in millimetres of the circle they sit on. Many small hatchbacks use 4x100 and many compact SUVs use 5x114.3. If the pattern does not match your car exactly, the wheel does not fit, however good it looks.',
  ),
  entry(
    'wheels',
    'Offset',
    ['wheel offset', 'ET35', 'ET38', 'ET40', 'ET45'],
    'How far the wheel sits in or out from the car, in millimetres. A lower number pushes the wheel outwards.',
    'Offset is written as ET and a number, such as ET40. It measures how far the face that bolts to the car sits from the middle of the wheel. Go much lower than the original and the tyre can rub the wheel arch; go much higher and it can touch the suspension. Staying within about 5 mm of the factory figure is the safe choice.',
  ),
  entry(
    'wheels',
    'Centre bore',
    ['center bore', 'hub bore', 'centre hole'],
    'The hole in the middle of the wheel that sits over the hub of the car. It must be the same size as the hub, or larger.',
    'The centre bore carries the weight of the car and keeps the wheel centred. A wheel with a smaller hole than your hub will not go on at all. A wheel with a larger hole goes on, but needs a ring to fill the gap, or the steering will shake at speed.',
  ),
  entry(
    'wheels',
    'Hub ring',
    ['hub rings', 'hub centric ring', 'spigot ring'],
    'A ring that fills the gap when the hole in the wheel is bigger than the hub. It stops the steering shaking at speed.',
    'Most wheels sold for many cars are made with a large centre hole so one wheel suits several models. A hub ring, in plastic or aluminium, closes the gap for your car. It costs very little and is the usual cure for a shake that starts around 80 km/h after new wheels are fitted.',
  ),
  entry(
    'wheels',
    'Staggered',
    ['staggered fitment', 'staggered setup', 'staggered wheels'],
    'Wider wheels or tyres at the back than at the front. The tyres can no longer be swapped front to back.',
    'A staggered set gives a rear-wheel-drive car more grip where the power goes, and a planted look. The price is that you cannot rotate tyres front to back to even out wear, and a single spare will not suit both ends. On a front-wheel-drive hatchback it is for looks only.',
  ),
  entry(
    'wheels',
    'Rim width',
    ['wheel width', '6J', '6.5J', '7J', '7.5J', '8J'],
    'How wide the wheel is, in inches, written like 7J. It decides how wide a tyre the wheel can safely hold.',
    'A 7J wheel is seven inches wide between the inner edges that hold the tyre. Every tyre size has a range of wheel widths it is approved for. Too narrow a wheel pinches the tyre; too wide stretches it and leaves the edge of the wheel open to kerbs.',
  ),
  entry(
    'wheels',
    'Tyre size',
    ['tyre sizes', 'aspect ratio', 'tyre profile'],
    'The numbers on the side of the tyre. 195/55 R16 is 195 mm wide, with a side wall 55% as tall, for a 16 inch wheel.',
    'The first number is the width of the tyre in millimetres. The second is the height of the side wall as a percentage of that width, so a lower number means a thinner, firmer tyre. The last is the wheel diameter in inches. All three must suit both the wheel and the car.',
  ),
  entry(
    'wheels',
    'Upsizing',
    ['upsize', 'plus sizing', 'plus one'],
    'Fitting a bigger wheel with a thinner tyre, so the full height stays the same and the speedometer stays honest.',
    'When you move from a 15 inch wheel to a 16 inch one, the tyre side wall has to get shorter to make up for it. Keep the full height of wheel and tyre within about 3% of the original. Go beyond that and the speedometer reads wrong, the ride gets harsher and the tyre may rub when the steering is turned fully.',
  ),
  entry(
    'wheels',
    'Wheel spacer',
    ['wheel spacers', 'spacer', 'spacers'],
    'A metal disc between the car and the wheel that pushes the wheel outwards. It needs longer bolts and careful fitting.',
    'Spacers fill the wheel arch and can make room for bigger brakes. They also put more strain on the parts the wheel turns on, and leave fewer turns of thread holding the wheel unless longer bolts are fitted. Thin slip-on spacers on standard bolts are the ones that cause trouble.',
  ),
  entry(
    'wheels',
    'TPMS',
    ['tyre pressure monitor', 'tyre pressure monitoring', 'tyre pressure sensor'],
    'Small sensors that show the air pressure of each tyre on a screen and warn you of a slow puncture.',
    'A tyre pressure monitor reads every tyre while you drive. Kits with sensors that screw on in place of the valve caps can be fitted at home in ten minutes. Kits with sensors inside the tyre are neater and harder to steal, but a tyre shop has to fit them.',
  ),

  // ---------------------------------------------------------------- lighting
  entry(
    'lighting',
    'Lumens',
    ['lumen'],
    'How much light a bulb gives out in total. More is brighter, but where the beam lands matters more than the number.',
    'Lumens count all the light leaving the bulb, in every direction. A headlight is only useful for the light that reaches the road, so a well aimed bulb with a modest figure beats a wild one with a huge figure. Treat very large numbers on the box with suspicion.',
  ),
  entry(
    'lighting',
    'Kelvin',
    ['colour temperature', 'color temperature', '3000K', '4300K', '5000K', '6000K', '6500K', '8000K'],
    'The colour of the light, not its strength. 3000K is yellow, 4300K is warm white, 6000K is cool white. Higher is bluer.',
    'Kelvin describes the tint of a light. Around 4300K to 5000K looks like daylight and shows the road best. Above 6000K the light turns blue, looks bright from outside, and shows you less in rain and fog. Yellow light near 3000K is the one that cuts through fog.',
  ),
  entry(
    'lighting',
    'H4, H7, HB3',
    ['H4', 'H7', 'HB3', 'HB4', 'H1', 'H8', 'H11', 'H16', '9005', '9006', 'bulb fitting', 'bulb type'],
    'Names for the shape of a headlight bulb base. Your car takes one type only: check the old bulb or the owner manual.',
    'Bulbs are not interchangeable. An H4 does low and high beam from one bulb. H7 and HB3 do one job each, so the car has separate bulbs for low and high beam. The type is printed on the base of the bulb you take out, and in the owner manual.',
  ),
  entry(
    'lighting',
    'Projector',
    ['projector headlight', 'projector headlights', 'projector lens', 'projectors'],
    'A headlight that focuses light through a lens. It gives a sharp, even beam that does not dazzle oncoming drivers.',
    'You can spot a projector by the glass ball inside the headlight. It puts a clean flat edge on the low beam, so the light stays on the road and below the eye line of other drivers. Brighter bulbs work properly in a projector in a way they often do not in a plain mirrored headlight.',
  ),
  entry(
    'lighting',
    'Reflector headlight',
    ['reflector headlights', 'reflector housing', 'reflector'],
    'A headlight with a mirrored bowl behind the bulb. It is shaped for one kind of bulb, so a bright LED in it can throw glare.',
    'Most budget cars have this kind of headlight. The mirror is shaped around the exact spot where the factory bulb glows. An LED bulb that glows from a different spot scatters light upwards, which blinds others and puts less light on the road. Choose LED bulbs made for this kind of headlight, and get the aim checked after fitting.',
  ),
  entry(
    'lighting',
    'DRL',
    ['DRLs', 'daytime running light', 'daytime running lights', 'daytime running lamp'],
    'Daytime running lights: low power front lights that stay on in the day so others see your car sooner.',
    'DRLs are for being seen, not for seeing. They come on with the engine and dim or switch off when the headlights come on. Add-on strips should be wired so they do the same, and should be white or amber at the front.',
  ),
  entry(
    'lighting',
    'Cut-off',
    ['cutoff', 'cut-off line', 'beam cut-off'],
    'The flat upper edge of a low beam. A clean edge keeps light on the road and out of the eyes of other drivers.',
    'Park facing a wall at night and switch on low beam: the line where light stops is the cut-off. A sharp, level line means the headlight is working as designed. A ragged glow with bright patches above it means glare for everyone coming the other way.',
  ),

  // ---------------------------------------------------------------- electrical
  entry(
    'electrical',
    'CANbus',
    ['CAN bus', 'CAN-bus', 'canbus ready', 'error free'],
    'The network a modern car uses to check on its own parts. A CANbus bulb stops a false "bulb failed" warning.',
    'Newer cars watch how much current each lamp draws. An LED draws far less than the old bulb, so the car decides the bulb has blown and shows a warning, or makes the light flicker. A CANbus bulb, or a small adapter sold with it, draws enough to keep the car satisfied.',
  ),
  entry(
    'electrical',
    'IP67',
    ['IP rating', 'IP65', 'IP66', 'IP68', 'IP69K'],
    'A dust and water rating. IP67 is sealed against dust and survives a short dunk in water. IP65 handles rain and washing.',
    'The first digit is for dust and the second for water. 6 for dust is the best there is. For water, 5 means jets from a hose, 7 means under water to one metre for half an hour, and 8 means deeper for longer. For lamps under the bumper or on a roof, look for IP67 or better.',
  ),
  entry(
    'electrical',
    'Relay',
    ['relays', 'relay kit', 'relay harness'],
    'A switch worked by a small current that turns on a big one. It lets horns and lamps take power straight from the battery.',
    'Loud horns and strong lamps draw more current than the thin factory wires and switches were made for. A relay lets the factory switch give only the signal, while a thick new wire carries the load from the battery. It protects the car and gives the accessory full power.',
  ),
  entry(
    'electrical',
    'Fuse tap',
    ['fuse taps', 'add a fuse', 'add-a-fuse'],
    'A small adapter that plugs into the fuse box to power an accessory, so no factory wire has to be cut.',
    'A fuse tap takes the place of one fuse and gives you a second protected outlet for a dash camera, charger or light. It is the clean way to add power: remove it and the car is back to original. It must go into a slot that can spare the extra load, never one that feeds the airbags or engine computer.',
  ),
  entry(
    'electrical',
    'Wiring harness',
    ['wiring loom', 'wire harness'],
    'A ready-made bundle of wires with the right plugs on each end, so the accessory connects without cutting anything.',
    'A good harness is made for your model. One end plugs into the sockets already in the car and the other into the new part. It turns a job of cutting and taping into one of pushing plugs together, and it can be removed later without a trace.',
  ),
  entry(
    'electrical',
    'Coupler',
    ['couplers', 'coupler to coupler', 'coupler-to-coupler'],
    'The trade word for a plug and socket. "Coupler to coupler" means the part plugs into the sockets already in the car.',
    'When a fitter says a part is coupler to coupler, no factory wire is cut: every joint is a plug. It is the kind of fitting that is easiest to undo and least likely to start an argument at the service centre.',
  ),

  // ---------------------------------------------------------------- audio and screens
  entry(
    'audio',
    'RMS watts',
    ['RMS', 'RMS power', 'watts RMS', 'W RMS'],
    'The power a speaker or amplifier can handle all day. Ignore "peak" or "PMPO" figures: they are bigger and mean little.',
    'RMS is the honest number. Match the RMS figure of the speakers to that of the amplifier and nothing gets strained. Peak and PMPO numbers describe a split second and are printed large because they look good on a box.',
  ),
  entry(
    'audio',
    'Ohms',
    ['ohm', 'impedance', '2 ohm', '4 ohm'],
    'How much a speaker resists the flow of power. It has to match what the amplifier is built for, usually 4 ohms in a car.',
    'A speaker with a lower figure pulls more power from the amplifier. That is louder, but only if the amplifier is built to cope: one that is not will overheat or shut down. Check the figure printed on both before buying.',
  ),
  entry(
    'audio',
    'DSP',
    ['digital signal processor', 'sound processor'],
    'A sound processor that tunes each speaker on its own, so music sounds right from the driver seat.',
    'In a car you sit closer to one door than the other, so the sound never arrives evenly. A DSP delays and adjusts each speaker to correct that. It makes more difference to clarity than expensive speakers do, but it needs to be set up by someone who knows how.',
  ),
  entry(
    'audio',
    'DIN size',
    ['DIN', 'single DIN', 'double DIN', '1 DIN', '2 DIN'],
    'The standard slot size for a car stereo. Single DIN is 5 cm tall; double DIN is 10 cm tall, the size of older touchscreens.',
    'Both sizes are 18 cm wide. Many recent cars have a dashboard shaped for a 7, 9 or 10 inch screen instead, and need a frame made for that model. The frame matters as much as the screen: a poor one leaves gaps and rattles.',
  ),
  entry(
    'audio',
    'Component speakers',
    ['component speaker', 'component set', 'coaxial', 'coaxial speakers', 'coaxials'],
    'A set with the large and small speakers separate, for clearer sound. Coaxials have both in one unit and are simpler to fit.',
    'Coaxial speakers drop straight into the factory door openings and are a quick upgrade. Component sets place the small speaker for high notes up near the mirror, where it sounds better, and use a small box to split the music between the two. They take longer to fit and often need a new mounting spot.',
  ),
  entry(
    'audio',
    'Damping sheet',
    ['damping sheets', 'sound damping', 'sound deadening', 'damping mat', 'butyl sheet'],
    'A heavy sticky sheet pressed onto the metal of the doors and floor. It cuts road noise and makes speakers sound fuller.',
    'Thin door metal rings like a drum when the speaker plays and when the tyres roar. A damping sheet adds weight and stops the ringing. Doors give the biggest gain for the money. Fitting means taking off the door trims, so allow half a day.',
  ),
  entry(
    'audio',
    'Android Auto and CarPlay',
    ['Android Auto', 'CarPlay', 'Apple CarPlay', 'wireless CarPlay', 'wireless Android Auto'],
    'Ways to show the maps, calls and music from your phone on the car screen. Wired needs a cable; wireless connects by itself.',
    'The phone does the work and the car screen shows it, so maps stay up to date without paying for updates. Wireless is handy for short trips but warms the phone and drains it on long ones. Check that the screen supports your kind of phone before buying.',
  ),

  // ---------------------------------------------------------------- fitting
  entry(
    'fitting',
    'Plug and play',
    ['plug-and-play', 'plug & play', 'plug n play'],
    'Fits into the sockets already in the car, with no wire cut. It can be taken out later without leaving a mark.',
    'A plug and play part uses the same plugs the factory part did. There is nothing to cut, join or tape. If the car has to go back to original for a sale or a warranty claim, you unplug it and refit the old part.',
  ),
  entry(
    'fitting',
    'Splice',
    ['splicing', 'spliced', 'wire cutting'],
    'Cutting into a wire of the car to join a new one. It is hard to undo and a common cause of warranty arguments.',
    'Splicing is sometimes the only way to fit an accessory, but it changes the car for good. A poor joint can corrode, come loose or overheat months later. If a part needs it, have it done by a fitter who joins the wires properly and seals the joint, and expect the dealer to ask questions.',
  ),
  entry(
    'fitting',
    'OEM',
    ['OE', 'original equipment', 'OEM fit', 'OEM type'],
    'The part the car maker fitted at the factory, or one made to the same drawing by the same supplier.',
    'OEM stands for original equipment manufacturer. An OEM part fits and behaves exactly like the one the car was built with. "OEM type" or "OEM fit" on a listing is a looser claim: it means made to fit like the original, not made by the original supplier.',
  ),
  entry(
    'fitting',
    'Aftermarket',
    ['after-market', 'after market'],
    'Any part not supplied by the car maker. Quality runs from better than original to poor, so the details matter.',
    'Aftermarket parts exist because owners want something the factory did not offer, or at a lower price. Some are made by the same factories that supply car makers. Others are copies with thinner material and weaker fixings. The specifications, the warranty and reports from real buyers tell them apart.',
  ),
  entry(
    'fitting',
    'Direct fit',
    ['direct-fit', 'bolt-on'],
    'Made for one model. It uses the mounting points already on the car, with no drilling, cutting or bending.',
    'A direct fit part goes where the original went, using the same holes and clips. It is the easiest kind to fit and to reverse. Always check the years as well as the model name: an updated version of the same model can move a mounting point by a few millimetres.',
  ),
  entry(
    'fitting',
    'Universal fit',
    ['universal-fit', 'universal part'],
    'Not made for any one car. It usually fits after some adjusting: check the size against your car before ordering.',
    'Universal parts are sized to suit as many cars as possible, so they suit none perfectly. Expect to trim, bend a bracket or find your own mounting point. Measure the space on your car and compare it with the size we list.',
  ),
  entry(
    'fitting',
    'Double-sided tape',
    ['3M tape', 'VHB tape', 'double sided tape'],
    'Strong foam tape used to stick spoilers, lips and trims without drilling. It needs a clean, dry, warm surface to hold.',
    'Good automotive tape holds a spoiler at highway speed for years. It fails when the paint was dusty, damp or cold at the time of fitting. Clean the area with the wipe supplied, fit in the shade on a warm day, press hard, and keep the car out of the wash for three days.',
  ),
  entry(
    'fitting',
    'Torque',
    ['torque wrench', 'torque setting', 'tightening torque'],
    'How tightly a nut or bolt is done up. Wheel nuts need the right figure: too loose is dangerous, too tight damages the threads.',
    'Every important bolt on a car has a tightness the maker has worked out, given in newton metres in the owner manual. A torque wrench clicks when that tightness is reached. For wheels, tighten in a star pattern and check again after about 50 km.',
  ),

  // ---------------------------------------------------------------- ride and handling
  entry(
    'suspension',
    'Coilover',
    ['coilovers', 'coil-over'],
    'A shock absorber and spring in one unit, usually with adjustable height. It lowers the car and firms up the ride.',
    'Coilovers replace the factory shock absorbers and springs at each wheel. Most let you set the height, and better ones the firmness too. The car corners flatter and sits lower. It also rides harder over bad roads and needs its wheels set straight again after fitting.',
  ),
  entry(
    'suspension',
    'Damping',
    ['damper', 'dampers', 'damping adjustment', 'rebound'],
    'How firmly a shock absorber calms the bounce of the spring. More feels tighter; too much feels harsh on broken roads.',
    'Springs hold the car up; damping stops it bouncing after a bump. Soft damping floats and wallows. Firm damping keeps the car settled in corners and passes more of the road into the cabin. Adjustable units let you find your own balance for city roads and highways.',
  ),
  entry(
    'suspension',
    'Lowering springs',
    ['lowering spring', 'lowered springs'],
    'Shorter, stiffer springs that drop the car by a fixed amount while keeping the original shock absorbers.',
    'Lowering springs are the lower-cost way to reduce the gap above the tyres. The drop is fixed, usually 25 to 40 mm. Worn factory shock absorbers will not cope with them for long, so check their condition first, and think about the speed breakers on your usual roads.',
  ),
  entry(
    'suspension',
    'Ground clearance',
    ['ride height'],
    'The gap between the lowest part of the car and the road. Lower looks sharper and scrapes more on speed breakers.',
    'Indian roads are hard on low cars. Every 10 mm you take away brings the underside closer to unmarked speed breakers, ramps and flooded potholes. A full load of passengers lowers the car further. Measure the clearance you have now before choosing how much to give up.',
  ),

  // ---------------------------------------------------------------- body and care
  entry(
    'care',
    'PPF',
    ['paint protection film', 'TPU film'],
    'Paint protection film: a clear, thick film stuck over the paint to take stone chips and scratches in its place.',
    'PPF is the only product that stops stone chips, because it is a physical layer. Good film closes up light scratches when warmed by the sun and lasts five years or more. It must be applied by a trained fitter in a clean bay, and the price mostly reflects that work.',
  ),
  entry(
    'care',
    'GSM',
    ['grams per square metre', 'grams per square meter'],
    'Grams per square metre: the weight of a cloth. A higher figure means a thicker towel that soaks up more water.',
    'For drying a car, look for a towel of 500 GSM or more: it holds the water instead of pushing it around. Thinner cloths of 250 to 350 GSM are better for wiping off polish and cleaning glass. Wash them without fabric softener, which clogs the fibres.',
  ),
  entry(
    'care',
    'Ceramic coating',
    ['ceramic coat', 'ceramic coated', '9H coating'],
    'A liquid that hardens into a thin glossy layer on the paint. It makes washing easier; it does not stop stone chips.',
    'A coating makes water and dirt slide off and keeps the shine for a year or more. It will not stop a stone, a key or a careless wash cloth, whatever hardness is claimed on the bottle. The paint has to be polished clean first, because the coating seals in whatever is underneath.',
  ),
  entry(
    'care',
    'VLT',
    ['visible light transmission', 'tint percentage'],
    'How much light a window lets through. Front and rear glass must pass at least 70%, side glass at least 50%.',
    'VLT is the figure the rules use for car windows. The limits above apply across India. Rules on stick-on film have changed over the years and are enforced differently from state to state, so check the current position where you live before fitting any film.',
  ),

  // ---------------------------------------------------------------- papers and rules
  entry(
    'legal',
    'HSRP',
    ['high security registration plate', 'high security number plate'],
    'The official aluminium number plate with a hologram and a laser code, fitted only by authorised vendors. Every vehicle needs one.',
    'A high security registration plate is issued against your registration, fixed with locks that break if removed, and comes with a coloured sticker for the windscreen. You book it through the official portal or your dealer. No shop, including ours, can sell you one.',
  ),
  entry(
    'legal',
    'RTO',
    ['regional transport office', 'transport office'],
    'Regional Transport Office: the government office that registers vehicles and approves changes made to them.',
    'The RTO where your car is registered keeps its record. Changes that alter what is written in that record, such as body colour or fuel type, need its approval and an entry in the registration certificate. Bolt-on accessories do not, but the law on what counts as an alteration is strict, so ask before making a big change.',
  ),
  entry(
    'legal',
    'RC',
    ['registration certificate', 'RC book', 'RC card'],
    'Registration certificate: the official record of your car. Changes such as colour or fuel must be entered on it by the transport office.',
    'The RC lists the make, model, colour, fuel and seating of the car as registered. If the car on the road no longer matches the RC, you can be fined and an insurance claim can be refused. Keep a copy in the car or in the DigiLocker app.',
  ),
  entry(
    'legal',
    'Show plate',
    ['show plates', 'decorative plate'],
    'A decorative plate for shows, photos and the garage wall. It is not a legal number plate and cannot be used on the road.',
    'Show plates are made for display: a name, a club, a build. They carry no hologram or laser code and do not meet the rules for registration plates. Driving on a public road with one in place of the official plate is an offence.',
  ),
  entry(
    'legal',
    'Off-road only',
    ['off road only', 'off-road use only', 'track use only', 'not road legal'],
    'Sold for private land, tracks and shows. Using it on a public road can bring a fine or a failed inspection.',
    'Some parts are legal to own and fit but not to use on a public road: very loud exhausts, light bars and coloured lamps are common examples. We mark them plainly. If you buy one, keep the original part so the car can be put back.',
  ),
  entry(
    'legal',
    'Car warranty',
    ['manufacturer warranty', 'factory warranty', 'warranty void'],
    'The promise by the car maker to fix faults for free. A dealer can refuse a claim if a modification caused the fault.',
    'Fitting an accessory does not cancel the whole warranty. What a dealer can do is refuse to pay for a fault that the accessory caused, and cut wiring is the usual example. Plug-in parts that can be removed are the safest. Keep the original parts and the invoice.',
  ),
  entry(
    'legal',
    'UTR',
    ['UTR number', 'UPI reference', 'UPI reference number', 'transaction reference'],
    'The 12 digit reference number of a UPI payment. It is in your UPI app, under the details of that payment.',
    'Every UPI payment gets its own reference number. When you pay the store directly by UPI, we ask for it so we can match your payment to your order. Open the payment in your app history and look for "UTR" or "UPI reference number".',
  ),
];
