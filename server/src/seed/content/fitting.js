// Fitting Card content for every subcategory: tools and steps in English and Hindi.
// The Hindi is everyday garage Hindi, with the English part names mechanics actually use.
// Pure data, written for a local mechanic to follow from a phone or a printout.

export const FITTING = {
  // ---- Exterior Styling ----------------------------------------------------
  'front-splitters': {
    tools: ['Jack and two axle stands', 'Drill with 3 mm bit', 'Phillips screwdriver', 'Masking tape', 'Isopropyl wipe'],
    steps: [
      { en: 'Raise the front of the car and support it on axle stands. Never work under a car held by the jack alone.', hi: 'गाड़ी का आगे का हिस्सा जैक से उठाकर स्टैंड पर टिकाओ। सिर्फ़ जैक के भरोसे गाड़ी के नीचे मत जाना।' },
      { en: 'Clean the lower edge of the bumper with the wipe and let it dry.', hi: 'बम्पर का नीचे वाला किनारा वाइप से साफ़ करके सूखने दो।' },
      { en: 'Hold the splitter in place, centre it on the number plate and tape it up.', hi: 'स्प्लिटर को जगह पर लगाकर नंबर प्लेट के हिसाब से सेंटर करो और मास्किंग टेप से टिका दो।' },
      { en: 'Mark the screw points and drill 3 mm pilot holes in the bumper underside only.', hi: 'स्क्रू की जगह मार्क करो और सिर्फ़ बम्पर के नीचे की तरफ़ 3 mm के होल करो।' },
      { en: 'Peel the tape backing, press the splitter on and fit the screws from the centre outwards.', hi: 'टेप की पन्नी हटाओ, स्प्लिटर दबाकर चिपकाओ और बीच से किनारे की तरफ़ स्क्रू कसते जाओ।' },
      { en: 'Lower the car and check the gap is even on both sides.', hi: 'गाड़ी नीचे उतारो और देखो कि दोनों तरफ़ गैप बराबर है।' },
    ],
  },
  'spoilers-wings': {
    tools: ['Drill with 6 mm bit', '10 mm spanner', 'Masking tape and marker', 'Touch-up paint or rust primer', 'Trim removal tool', 'Wire tap connectors'],
    steps: [
      { en: 'Wash and dry the boot lid or hatch where the spoiler will sit.', hi: 'जहाँ स्पॉइलर बैठेगा, डिक्की या हैच का वह हिस्सा धोकर सुखा लो।' },
      { en: 'Place the spoiler, centre it and mark the bolt points through masking tape.', hi: 'स्पॉइलर रखकर सेंटर करो और मास्किंग टेप के ऊपर से बोल्ट की जगह मार्क करो।' },
      { en: 'Remove the inner trim, then drill the marked holes. Paint the bare metal edges so they do not rust.', hi: 'अंदर की ट्रिम खोलो, फिर मार्क की हुई जगह होल करो। होल के किनारों पर प्राइमर या टच-अप पेंट लगाओ ताकि जंग न लगे।' },
      { en: 'If the spoiler has a brake light, disconnect the battery negative before joining its wire to the high-mount brake light feed.', hi: 'स्पॉइलर में ब्रेक लाइट हो तो पहले बैटरी का नेगेटिव हटाओ, फिर उसकी वायर ऊपर वाली ब्रेक लाइट की वायर से जोड़ो।' },
      { en: 'Stick the gasket tape, seat the spoiler and tighten the bolts evenly from inside.', hi: 'गैस्केट टेप लगाओ, स्पॉइलर बैठाओ और अंदर से बोल्ट बराबर कसो।' },
      { en: 'Pour water over the holes and check inside for leaks before refitting the trim.', hi: 'होल के ऊपर पानी डालकर अंदर लीकेज चेक करो, उसके बाद ही ट्रिम वापस लगाओ।' },
    ],
  },
  'body-kits': {
    tools: ['Car lift or four axle stands', 'Drill and bit set', 'Screwdriver set', 'Trim clip pliers', 'Masking tape', 'Panel wipe', 'Heat gun'],
    steps: [
      { en: 'Test-fit every piece on the car before any paint or drilling. Mark what needs trimming.', hi: 'पेंट या ड्रिल से पहले किट का हर पीस गाड़ी पर लगाकर देखो। जहाँ काटना या घिसना हो, मार्क कर लो।' },
      { en: 'Get the pieces painted to the car colour code and let the paint cure fully.', hi: 'पीस गाड़ी के कलर कोड से पेंट करवाओ और पेंट पूरा सूखने दो।' },
      { en: 'Raise the car on a lift or four stands so the sills and bumpers are easy to reach.', hi: 'गाड़ी लिफ़्ट या चार स्टैंड पर उठाओ ताकि साइड और बम्पर तक हाथ आराम से पहुँचे।' },
      { en: 'Clean the bumper and sill edges with panel wipe. Tape each piece in position.', hi: 'बम्पर और साइड के किनारे पैनल वाइप से साफ़ करो। हर पीस को टेप से जगह पर टिकाओ।' },
      { en: 'Fix the front lip first, then the side skirts, then the rear piece, using the screws and tape supplied.', hi: 'पहले फ़्रंट लिप, फिर साइड स्कर्ट, फिर पीछे का पीस लगाओ। साथ आए स्क्रू और टेप ही इस्तेमाल करो।' },
      { en: 'Check every panel gap and that the doors open without touching the skirts.', hi: 'हर जगह गैप चेक करो और देखो कि दरवाज़े खोलने पर स्कर्ट से नहीं टकराते।' },
      { en: 'Do not wash the car for 48 hours so the tape bonds.', hi: 'टेप अच्छे से पकड़े, इसलिए 48 घंटे गाड़ी मत धोना।' },
    ],
  },
  'rear-diffusers': {
    tools: ['Jack and two axle stands', 'Drill with 3 mm bit', 'Phillips screwdriver', 'Trim cutter or hacksaw blade', 'Masking tape', 'Wire tap connectors'],
    steps: [
      { en: 'Raise the rear of the car and support it on axle stands.', hi: 'गाड़ी का पीछे का हिस्सा उठाकर स्टैंड पर टिकाओ।' },
      { en: 'Hold the diffuser against the lower bumper and check it clears the exhaust and the parking sensors.', hi: 'डिफ़्यूज़र को बम्पर के नीचे लगाकर देखो कि साइलेंसर और पार्किंग सेंसर से नहीं टकरा रहा।' },
      { en: 'Trim the lower valance only where the diffuser needs it. Cut a little at a time.', hi: 'बम्पर का नीचे वाला प्लास्टिक सिर्फ़ उतना काटो जितना ज़रूरी है। थोड़ा-थोड़ा करके काटो।' },
      { en: 'Tape it in place, mark and drill the pilot holes, then fit the screws.', hi: 'टेप से टिकाकर होल मार्क करो, ड्रिल करो और स्क्रू लगा दो।' },
      { en: 'For a centre light, disconnect the battery negative, then join the light to the brake lamp wire and earth.', hi: 'बीच वाली लाइट हो तो पहले बैटरी का नेगेटिव हटाओ, फिर लाइट को ब्रेक लाइट की वायर और अर्थ से जोड़ो।' },
      { en: 'Lower the car and check the brake light and the fit from behind.', hi: 'गाड़ी उतारो और पीछे से ब्रेक लाइट और फ़िटिंग चेक करो।' },
    ],
  },
  grilles: {
    tools: ['Socket set (8, 10, 12 mm)', 'Phillips screwdriver', 'Trim clip pliers', 'Plastic pry tools', 'Soft cloth for the bumper'],
    steps: [
      { en: 'Disconnect the battery negative if the bumper has sensors, a camera or fog lamps.', hi: 'बम्पर में सेंसर, कैमरा या फ़ॉग लैंप हों तो पहले बैटरी का नेगेटिव हटा दो।' },
      { en: 'Remove the clips and screws along the top of the bumper, in the wheel arches and underneath.', hi: 'बम्पर के ऊपर, व्हील आर्च के अंदर और नीचे के सारे क्लिप और स्क्रू खोलो।' },
      { en: 'Pull the bumper forward with a helper, unplug any connectors and lay it face-up on a cloth.', hi: 'एक आदमी की मदद से बम्पर आगे खींचो, कनेक्टर निकालो और कपड़े पर सीधा रख दो।' },
      { en: 'Release the old grille tabs from behind and move the emblem to the new grille if it is reused.', hi: 'पीछे से पुरानी ग्रिल के लॉक खोलो। एम्ब्लेम दोबारा लगना हो तो नई ग्रिल में लगा दो।' },
      { en: 'Clip the new grille in until every tab clicks. Route any DRL wire away from the radiator.', hi: 'नई ग्रिल को तब तक दबाओ जब तक सारे लॉक क्लिक न कर जाएँ। DRL की वायर हो तो रेडिएटर से दूर रखो।' },
      { en: 'Refit the bumper, reconnect everything and check the sensors and lamps work.', hi: 'बम्पर वापस लगाओ, सारे कनेक्टर जोड़ो और सेंसर और लाइट चलाकर देखो।' },
    ],
  },
  'emblems-decals': {
    tools: ['Isopropyl wipe', 'Masking tape', 'Measuring tape', 'Squeegee or a card wrapped in cloth', 'Spray bottle with soapy water (for large graphics)', 'Hair dryer'],
    steps: [
      { en: 'Wash the panel and wipe it with isopropyl. Work in shade on a panel that is not hot.', hi: 'पैनल धोकर आइसोप्रोपिल वाइप से पोंछो। काम छाँव में करो, पैनल गरम नहीं होना चाहिए।' },
      { en: 'Position the decal or emblem with masking tape and measure both sides so it sits level.', hi: 'स्टिकर या एम्ब्लेम को टेप से जगह पर टिकाओ और दोनों तरफ़ नाप लो ताकि सीधा लगे।' },
      { en: 'Peel the backing a little at a time and press from the centre outwards with the squeegee.', hi: 'पीछे की पन्नी थोड़ी-थोड़ी हटाओ और स्क्वीजी से बीच से बाहर की तरफ़ दबाते जाओ।' },
      { en: 'Warm curved areas lightly with the hair dryer and press the edges down.', hi: 'मुड़ी हुई जगह पर हेयर ड्रायर से हल्का गरम करो और किनारे दबा दो।' },
      { en: 'Remove the top transfer film slowly at a flat angle. Do not wash the car for 48 hours.', hi: 'ऊपर की ट्रांसफ़र फ़िल्म धीरे-धीरे तिरछा खींचकर उतारो। 48 घंटे गाड़ी मत धोना।' },
    ],
  },
  'plate-frames': {
    tools: ['Phillips screwdriver', 'Soft cloth'],
    steps: [
      { en: 'Check how the HSRP is fixed. Do not break or drill out its snap-lock rivets.', hi: 'देखो HSRP प्लेट कैसे लगी है। उसके स्नैप-लॉक रिवेट न तोड़ने हैं, न ड्रिल करने हैं।' },
      { en: 'Wipe the area around the plate clean.', hi: 'प्लेट के आसपास की जगह कपड़े से साफ़ करो।' },
      { en: 'Fit the frame around the plate using the existing holder screws or the frame clips.', hi: 'फ़्रेम को प्लेट के चारों तरफ़ होल्डर के पुराने स्क्रू या फ़्रेम के क्लिप से लगाओ।' },
      { en: 'Stand back and confirm every character, the IND mark, the hologram and the laser code are fully visible. If anything is covered, take the frame off.', hi: 'पीछे हटकर देखो कि नंबर का हर अक्षर, IND मार्क, होलोग्राम और लेज़र कोड पूरा दिख रहा है। कुछ भी ढक रहा हो तो फ़्रेम हटा दो।' },
    ],
  },
  'exterior-trim': {
    tools: ['Plastic pry tool', 'Isopropyl wipe', 'Masking tape', 'Hair dryer'],
    steps: [
      { en: 'Wash and dry the mirror housings or door frames.', hi: 'मिरर कवर या दरवाज़े के फ़्रेम धोकर सुखा लो।' },
      { en: 'For clip-on mirror caps, fold the mirror glass down and release the factory cap tabs gently with the pry tool.', hi: 'क्लिप वाले मिरर कैप के लिए शीशा नीचे झुकाओ और प्राई टूल से कंपनी के कैप के लॉक आराम से खोलो।' },
      { en: 'For tape-on parts, wipe the surface with isopropyl and test the position before peeling the backing.', hi: 'टेप वाले पार्ट के लिए जगह वाइप से साफ़ करो और पन्नी हटाने से पहले रखकर पोज़िशन देख लो।' },
      { en: 'Press the part on firmly for 30 seconds along its full length. Warm the tape lightly in cold weather.', hi: 'पार्ट को पूरी लंबाई में 30 सेकंड ज़ोर से दबाओ। ठंड हो तो टेप को हल्का गरम कर लो।' },
      { en: 'Check the indicator, mirror folding and window movement. Keep the windows closed for 24 hours after fitting visors.', hi: 'इंडिकेटर, मिरर फ़ोल्डिंग और शीशे का ऊपर-नीचे होना चेक करो। वाइज़र लगाने के बाद 24 घंटे शीशे बंद रखो।' },
    ],
  },
  'sun-control-films': {
    tools: ['Spray bottle with slip solution', 'Hard card and rubber squeegee', 'Sharp blade with snap-off tips', 'Heat gun', 'Lint-free cloths', 'VLT light meter'],
    steps: [
      { en: 'Work indoors, out of wind and dust. Clean the inside of each window twice and the rubber seals too.', hi: 'काम अंदर करो, जहाँ हवा और धूल न हो। हर शीशे का अंदर वाला हिस्सा और रबर दो बार साफ़ करो।' },
      { en: 'Lay the film on the outside of the glass, liner side out, and cut it roughly to shape.', hi: 'फ़िल्म को शीशे के बाहर की तरफ़ रखो, लाइनर बाहर की ओर, और मोटे तौर पर नाप से काट लो।' },
      { en: 'On curved glass, heat-shrink the film on the outside until it lies flat with no fingers of air.', hi: 'मुड़े हुए शीशे पर हीट गन से फ़िल्म को बाहर ही सिकोड़ो, जब तक वह बिना हवा की लकीरों के सपाट न बैठ जाए।' },
      { en: 'Spray the inside of the glass and the adhesive side, then lay the film on and squeegee the water out from the centre.', hi: 'शीशे के अंदर और फ़िल्म की गोंद वाली तरफ़ पानी छिड़को, फ़िल्म लगाओ और स्क्वीजी से पानी बीच से किनारों की तरफ़ निकालो।' },
      { en: 'Trim the edges 1 to 2 mm short of the glass edge and the defogger tabs. Never cut on the glass with force.', hi: 'किनारों को शीशे के किनारे और डीफ़ॉगर के टैब से 1 से 2 mm पहले काटो। शीशे पर ज़ोर लगाकर कभी मत काटना।' },
      { en: 'Check every window with the light meter: at least 70 percent on the windscreen and rear window, 50 percent on the sides. Remove any film that reads lower.', hi: 'हर शीशा लाइट मीटर से चेक करो: आगे और पीछे के शीशे पर कम से कम 70 प्रतिशत, साइड पर 50 प्रतिशत। जो कम आए, वह फ़िल्म हटा दो।' },
      { en: 'Tell the owner to keep the windows shut and not wash the inside for 3 days while the film cures.', hi: 'मालिक को बताओ कि फ़िल्म सूखने तक 3 दिन शीशे नीचे न करें और अंदर से न धोएँ।' },
    ],
  },

  // ---- Interior & Comfort --------------------------------------------------
  'steering-wheels': {
    tools: ['10 mm spanner for the battery', 'Torx bit set', 'Large socket and breaker bar', 'Torque wrench', 'Steering wheel puller', 'Paint marker'],
    steps: [
      { en: 'Park with the wheels straight. Disconnect the battery negative and wait 15 minutes before touching the airbag.', hi: 'गाड़ी सीधे पहियों पर खड़ी करो। बैटरी का नेगेटिव हटाओ और एयरबैग को हाथ लगाने से पहले 15 मिनट रुको।' },
      { en: 'Release the airbag module from behind the wheel, unplug its yellow connectors and keep it face-up, away from the work.', hi: 'स्टीयरिंग के पीछे से एयरबैग खोलो, पीले कनेक्टर निकालो और एयरबैग को सीधा, ऊपर की तरफ़ मुँह करके दूर रख दो।' },
      { en: 'Mark the wheel against the column with paint, loosen the centre nut and pull the wheel off straight.', hi: 'स्टीयरिंग और शाफ़्ट पर पेंट से निशान लगाओ, बीच का नट ढीला करो और स्टीयरिंग सीधा बाहर खींचो।' },
      { en: 'Do not let the clock spring turn. Move the switches and trim to the new wheel.', hi: 'क्लॉक स्प्रिंग घूमनी नहीं चाहिए। बटन और ट्रिम नई स्टीयरिंग में लगा दो।' },
      { en: 'Fit the new wheel on the marks and torque the centre nut to the car maker figure.', hi: 'नई स्टीयरिंग निशान मिलाकर लगाओ और बीच का नट कंपनी के बताए टॉर्क पर कसो।' },
      { en: 'Refit the factory airbag, reconnect the battery and check that the airbag light goes off and the horn and buttons work.', hi: 'कंपनी का एयरबैग वापस लगाओ, बैटरी जोड़ो और देखो कि एयरबैग की लाइट बुझ जाती है और हॉर्न और बटन चल रहे हैं।' },
      { en: 'For a steering cover only: stretch it on from the top, centre the seam and stitch through the pre-punched holes.', hi: 'सिर्फ़ कवर लगाना हो तो ऊपर से खींचकर चढ़ाओ, सिलाई बीच में रखो और पहले से बने छेदों में से धागा डालकर सिलो।' },
    ],
  },
  'gear-knobs': {
    tools: ['Allen key set', 'Cloth', 'Thread adaptors from the box'],
    steps: [
      { en: 'Unscrew the stock knob anticlockwise. If it does not turn, look for a clip or grub screw under the gaiter.', hi: 'पुरानी नॉब उल्टी तरफ़ घुमाकर खोलो। न घूमे तो कवर के नीचे क्लिप या ग्रब स्क्रू देखो।' },
      { en: 'Check the lever thread and pick the matching adaptor from the box.', hi: 'लीवर की चूड़ी देखो और डिब्बे में से सही नाप का अडैप्टर चुनो।' },
      { en: 'Screw the new knob on, line up the shift pattern and tighten the grub screws.', hi: 'नई नॉब चढ़ाओ, गियर का पैटर्न सीधा करो और ग्रब स्क्रू कस दो।' },
      { en: 'Pull the gaiter up to the knob and run through every gear, including reverse, with the engine off.', hi: 'कवर को नॉब तक ऊपर खींचो और इंजन बंद रखकर रिवर्स समेत सारे गियर लगाकर देखो।' },
      { en: 'For paddle extensions: clean the factory paddles, seat the extensions and tighten the grub screws evenly.', hi: 'पैडल एक्सटेंशन के लिए कंपनी के पैडल साफ़ करो, एक्सटेंशन बैठाओ और ग्रब स्क्रू बराबर कसो।' },
    ],
  },
  'floor-mats': {
    tools: ['Vacuum cleaner or brush'],
    steps: [
      { en: 'Take out every old mat. Never lay new mats over old ones.', hi: 'पुरानी सारी मैट निकाल दो। नई मैट कभी पुरानी के ऊपर मत बिछाना।' },
      { en: 'Vacuum the floor so grit does not sit under the new mats.', hi: 'फ़र्श वैक्यूम कर लो ताकि नई मैट के नीचे मिट्टी-कंकड़ न रहे।' },
      { en: 'Lay the driver mat first and lock it on the factory hooks.', hi: 'सबसे पहले ड्राइवर की मैट बिछाओ और कंपनी के हुक में लॉक करो।' },
      { en: 'Press every pedal fully and check the mat does not touch or trap it.', hi: 'हर पेडल पूरा दबाकर देखो कि मैट उसे छू या फँसा नहीं रही।' },
      { en: 'Fit the remaining mats and slide the seats fully forward and back to check they move freely.', hi: 'बाकी मैट लगाओ और सीटें पूरी आगे-पीछे करके देखो कि कहीं अटक नहीं रहीं।' },
    ],
  },
  'seat-covers': {
    tools: ['Trim hook tool', 'Socket set for the rear seat base', 'Hog ring pliers or cable ties', 'Scissors'],
    steps: [
      { en: 'Check the cover labels: the side with the airbag tag goes on the door side of each front seat.', hi: 'कवर के लेबल देखो: जिस तरफ़ एयरबैग का टैग है, वह हर आगे वाली सीट के दरवाज़े की तरफ़ रहेगा।' },
      { en: 'Remove the headrests and lift out the rear seat base.', hi: 'हेडरेस्ट निकालो और पीछे वाली सीट का नीचे का हिस्सा उठाकर बाहर करो।' },
      { en: 'Pull the backrest covers down from the top and smooth them from the centre outwards.', hi: 'बैकरेस्ट के कवर ऊपर से नीचे खींचो और बीच से किनारे की तरफ़ सिलवटें निकालते जाओ।' },
      { en: 'Feed the straps under the seat and hook them tight, clear of the seat rails and wiring.', hi: 'पट्टियाँ सीट के नीचे से निकालकर कसकर फँसाओ। ध्यान रहे कि सीट की रेल और वायरिंग में न फँसें।' },
      { en: 'Do not stitch, glue or tie anything across the side airbag seam.', hi: 'साइड एयरबैग वाली सिलाई के ऊपर न सिलाई करनी है, न गोंद लगाना है, न कुछ बाँधना है।' },
      { en: 'Refit the rear base and headrests. Check every seat belt buckle is out and every seat lever works.', hi: 'पीछे की सीट और हेडरेस्ट वापस लगाओ। देखो कि हर सीट बेल्ट का बकल बाहर है और सीट के सारे लीवर चल रहे हैं।' },
    ],
  },
  'ambient-lighting': {
    tools: ['Plastic trim tools', 'Fuse tap and spare fuses', 'Multimeter or test lamp', 'Cable ties', 'Cloth tape', '10 mm spanner'],
    steps: [
      { en: 'Disconnect the battery negative before removing any trim near airbags or door wiring.', hi: 'एयरबैग या दरवाज़े की वायरिंग के पास की ट्रिम खोलने से पहले बैटरी का नेगेटिव हटाओ।' },
      { en: 'Plan the layout. Lay the strips and the control box out on the dash and doors before fixing anything.', hi: 'पहले लेआउट तय करो। कुछ भी फ़िक्स करने से पहले स्ट्रिप और कंट्रोल बॉक्स डैशबोर्ड और दरवाज़ों पर रखकर देख लो।' },
      { en: 'Ease the trim gaps open with a plastic tool and press the light strips in. Do not route anything across an airbag cover.', hi: 'प्लास्टिक टूल से ट्रिम का गैप हल्का खोलो और लाइट की स्ट्रिप दबाकर बैठाओ। एयरबैग के कवर के ऊपर से कोई वायर या स्ट्रिप मत ले जाना।' },
      { en: 'Run the door wires through the factory rubber boot, not through the door gap.', hi: 'दरवाज़े की वायर कंपनी के रबर बूट के अंदर से निकालो, दरवाज़े के गैप में से नहीं।' },
      { en: 'Take power from an ignition-switched fuse with the fuse tap and earth to a body bolt.', hi: 'फ़्यूज़ टैप से ऐसे फ़्यूज़ से करंट लो जो चाबी के साथ चालू-बंद होता है, और अर्थ बॉडी के बोल्ट पर दो।' },
      { en: 'Reconnect the battery, test every zone, then tie the wiring away from the pedals and steering column.', hi: 'बैटरी जोड़ो, हर ज़ोन की लाइट चेक करो, फिर वायरिंग को पेडल और स्टीयरिंग से दूर टाई कर दो।' },
    ],
  },
  'gauges-displays': {
    tools: ['Plastic trim tools', 'Cable clips', 'Isopropyl wipe', 'Socket set and coding tool (cluster swap only)'],
    steps: [
      { en: 'Find the OBD port under the dash on the driver side.', hi: 'ड्राइवर की तरफ़ डैशबोर्ड के नीचे OBD पोर्ट ढूँढो।' },
      { en: 'Place the display on its pad where the driver can read it without it blocking the road view.', hi: 'डिस्प्ले को पैड पर ऐसी जगह रखो जहाँ से ड्राइवर पढ़ सके और सड़क का नज़ारा न रुके।' },
      { en: 'Tuck the cable along the dash edge and down the pillar trim. Keep it clear of the pedals and the airbag.', hi: 'केबल को डैशबोर्ड के किनारे और पिलर की ट्रिम के अंदर दबाओ। पेडल और एयरबैग से दूर रखो।' },
      { en: 'Plug into the OBD port with the ignition off, then start the car and check the speed against the cluster.', hi: 'चाबी बंद रखकर OBD पोर्ट में प्लग लगाओ, फिर गाड़ी चालू करके स्पीड मीटर से मिलाकर देखो।' },
      { en: 'For a cluster swap: disconnect the battery negative, remove the cluster hood, swap the unit on its plug-in harness and have it coded to the car.', hi: 'मीटर बदलना हो तो बैटरी का नेगेटिव हटाओ, मीटर का कवर खोलो, प्लग-इन हार्नेस पर नया मीटर लगाओ और उसे गाड़ी से कोड करवाओ।' },
      { en: 'Check every warning light, the fuel gauge and the odometer reading before handing the car back.', hi: 'गाड़ी देने से पहले हर वार्निंग लाइट, फ़्यूल गेज और किलोमीटर की रीडिंग चेक करो।' },
    ],
  },
  'key-covers': {
    tools: [],
    steps: [
      { en: 'Wipe the key clean and dry.', hi: 'चाबी पोंछकर साफ़ और सूखी कर लो।' },
      { en: 'Open the cover, or stretch the soft cover, and seat the key with the buttons lined up.', hi: 'कवर खोलो या नरम कवर को फैलाओ और चाबी ऐसे बैठाओ कि बटन सही जगह आएँ।' },
      { en: 'Close the shell until it clicks, or tighten its small screw.', hi: 'शेल को क्लिक होने तक बंद करो या उसका छोटा स्क्रू कस दो।' },
      { en: 'Test lock, unlock and boot release from a few metres away, and check the emergency key still slides out.', hi: 'कुछ मीटर दूर से लॉक, अनलॉक और डिक्की का बटन चलाकर देखो। यह भी देखो कि इमरजेंसी चाबी बाहर निकल रही है।' },
    ],
  },
  'sunshades-organisers': {
    tools: [],
    steps: [
      { en: 'Match each shade to its window: they are cut for a specific door.', hi: 'हर शेड को उसके शीशे से मिला लो: हर एक किसी एक दरवाज़े के नाप का कटा होता है।' },
      { en: 'Hold the shade against the metal window frame and let the magnets seat.', hi: 'शेड को शीशे के लोहे वाले फ़्रेम पर लगाओ, मैग्नेट अपने आप बैठ जाएँगे।' },
      { en: 'Run the window up and down once to check the shade does not catch the glass.', hi: 'शीशा एक बार ऊपर-नीचे करके देखो कि शेड उसमें फँस नहीं रहा।' },
      { en: 'Keep the front side windows clear while driving. Use the front shades only when parked.', hi: 'गाड़ी चलाते समय आगे के साइड शीशे खुले रखो। आगे के शेड सिर्फ़ खड़ी गाड़ी में लगाओ।' },
      { en: 'For a boot organiser: unfold it, fix the base panels and strap it to the boot hooks so it cannot slide.', hi: 'डिक्की ऑर्गनाइज़र हो तो खोलकर नीचे के पैनल लगाओ और डिक्की के हुक से बाँध दो ताकि खिसके नहीं।' },
    ],
  },

  // ---- Lighting ------------------------------------------------------------
  headlights: {
    tools: ['Socket set (8, 10, 12 mm)', 'Phillips screwdriver', 'Trim clip pliers', 'Plastic pry tools', 'Masking tape for beam marks', 'Cloth for the bumper'],
    steps: [
      { en: 'Before removing anything, park 5 metres from a wall and mark the old low-beam cut-off with tape.', hi: 'कुछ भी खोलने से पहले गाड़ी दीवार से 5 मीटर दूर खड़ी करो और पुरानी लो-बीम की लाइन दीवार पर टेप से मार्क कर लो।' },
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Remove the front bumper where needed: clips on top, screws in the wheel arches and underneath.', hi: 'ज़रूरत हो तो आगे का बम्पर खोलो: ऊपर के क्लिप, व्हील आर्च के अंदर और नीचे के स्क्रू।' },
      { en: 'Undo the headlamp bolts, pull the lamp forward and unplug the main connector.', hi: 'हेडलाइट के बोल्ट खोलो, लाइट आगे खींचो और मेन कनेक्टर निकाल दो।' },
      { en: 'Plug in the new lamp and test low beam, high beam, DRL and indicators before bolting it down.', hi: 'नई लाइट का कनेक्टर लगाओ और बोल्ट कसने से पहले लो-बीम, हाई-बीम, DRL और इंडिकेटर चलाकर देखो।' },
      { en: 'Bolt the lamps in, refit the bumper and check the gaps to the bonnet and wings.', hi: 'लाइट कसो, बम्पर वापस लगाओ और बोनट और फ़ेंडर के साथ गैप देख लो।' },
      { en: 'Aim the beam to the tape marks with the adjuster screws. The cut-off must not sit higher than before.', hi: 'एडजस्टर स्क्रू से बीम को टेप के निशान पर सेट करो। रोशनी की लाइन पहले से ऊपर नहीं होनी चाहिए।' },
    ],
  },
  'tail-lights': {
    tools: ['10 mm socket with extension', 'Plastic pry tool', 'Wire tap connectors (light-bar sets only)'],
    steps: [
      { en: 'Open the boot and remove the access cover or side trim behind the lamp.', hi: 'डिक्की खोलो और लाइट के पीछे का कवर या साइड ट्रिम हटाओ।' },
      { en: 'Disconnect the battery negative if the set has a centre light bar to wire in.', hi: 'सेट में बीच वाली लाइट-बार की वायरिंग करनी हो तो बैटरी का नेगेटिव हटा दो।' },
      { en: 'Unplug the connector and undo the nuts holding the lamp.', hi: 'कनेक्टर निकालो और लाइट के नट खोलो।' },
      { en: 'Pull the lamp straight back off its locating pins. Do not lever against the paint.', hi: 'लाइट को सीधा पीछे की तरफ़ खींचकर पिन से निकालो। पेंट पर टूल टिकाकर ज़ोर मत लगाना।' },
      { en: 'Check the seal on the new lamp, seat it on the pins and tighten the nuts by hand, then a quarter turn.', hi: 'नई लाइट की सील चेक करो, पिन पर बैठाओ और नट पहले हाथ से, फिर चौथाई चक्कर और कस दो।' },
      { en: 'Plug in and test tail, brake, indicator and reverse lights with a helper before refitting the trim.', hi: 'कनेक्टर लगाओ और ट्रिम लगाने से पहले किसी की मदद से टेल, ब्रेक, इंडिकेटर और रिवर्स लाइट चेक करो।' },
    ],
  },
  'led-bulbs': {
    tools: ['Clean gloves', 'Masking tape for beam marks', 'Cable ties', 'Phillips screwdriver'],
    steps: [
      { en: 'Park 5 metres from a wall and mark the old low-beam cut-off with tape.', hi: 'गाड़ी दीवार से 5 मीटर दूर खड़ी करो और पुरानी लो-बीम की लाइन टेप से मार्क कर लो।' },
      { en: 'Switch the lights off and let the old bulbs cool. Remove the dust cap and unplug the bulb.', hi: 'लाइट बंद करके पुराने बल्ब ठंडे होने दो। डस्ट कैप हटाओ और बल्ब का कनेक्टर निकालो।' },
      { en: 'Release the spring clip or twist the bulb out. Do not touch the LED chips with bare fingers.', hi: 'स्प्रिंग क्लिप खोलो या बल्ब घुमाकर निकालो। LED की चिप को नंगे हाथ से मत छूना।' },
      { en: 'Fit the LED bulb with its chips facing left and right (3 and 9 o clock), then lock the clip.', hi: 'LED बल्ब ऐसे लगाओ कि चिप दाएँ-बाएँ (घड़ी के 3 और 9 की तरफ़) रहें, फिर क्लिप लॉक करो।' },
      { en: 'Plug in the driver, tie it away from hot or moving parts and refit the dust cap.', hi: 'ड्राइवर का प्लग लगाओ, उसे गरम या घूमने वाले पार्ट से दूर टाई करो और डस्ट कैप वापस लगाओ।' },
      { en: 'Switch on and re-aim so the cut-off sits on or just below the tape marks.', hi: 'लाइट जलाओ और बीम ऐसे सेट करो कि रोशनी की लाइन टेप के निशान पर या थोड़ा नीचे रहे।' },
    ],
  },
  'fog-projectors': {
    tools: ['Jack and axle stands', 'Socket set', 'Trim clip pliers', 'Cable ties', 'Multimeter or test lamp', 'Heat gun and butyl sealant (headlamp retrofit only)'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Remove the wheel arch liner screws or the bumper lower cover to reach the fog lamp pockets.', hi: 'फ़ॉग लैंप की जगह तक पहुँचने के लिए व्हील आर्च लाइनर के स्क्रू या बम्पर का नीचे का कवर खोलो।' },
      { en: 'Take out the old lamp or blanking cover and bolt the new lamp to the same bracket.', hi: 'पुराना लैंप या खाली जगह का ढक्कन निकालो और नया लैंप उसी ब्रैकेट पर कस दो।' },
      { en: 'Fit the relay harness: red to battery positive through the fuse, black to a body earth, switch wire into the cabin through an existing grommet.', hi: 'रिले हार्नेस लगाओ: लाल वायर फ़्यूज़ के साथ बैटरी के पॉज़िटिव पर, काली बॉडी अर्थ पर, और स्विच की वायर पहले से बने ग्रोमेट से केबिन के अंदर।' },
      { en: 'Tie the harness clear of the radiator fan, belts and exhaust.', hi: 'हार्नेस को रेडिएटर फ़ैन, बेल्ट और साइलेंसर से दूर टाई करो।' },
      { en: 'Reconnect the battery and test both colours. Aim the lamps so the cut-off falls below headlamp height at 5 metres.', hi: 'बैटरी जोड़ो और दोनों कलर चलाकर देखो। लैंप ऐसे सेट करो कि 5 मीटर पर रोशनी की लाइन हेडलाइट की ऊँचाई से नीचे रहे।' },
      { en: 'For a headlamp projector retrofit: the lamp must be opened with heat, the projector aligned and the lens resealed with fresh butyl. Send it to a retrofit specialist.', hi: 'हेडलाइट के अंदर प्रोजेक्टर लगाना हो तो लाइट गरम करके खोलनी पड़ती है, प्रोजेक्टर सीधा बैठाना होता है और नई ब्यूटाइल से सील करनी होती है। यह काम रेट्रोफ़िट वाले कारीगर से ही करवाओ।' },
    ],
  },
  drls: {
    tools: ['Multimeter or test lamp', 'Fuse tap', 'Wire tap connectors', 'Isopropyl wipe', 'Cable ties', 'Trim tools'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Clean the mounting surface with isopropyl and stick the strips level on both sides.', hi: 'लगाने की जगह आइसोप्रोपिल से साफ़ करो और दोनों तरफ़ स्ट्रिप बराबर ऊँचाई पर चिपकाओ।' },
      { en: 'Route the wires into the engine bay away from heat and moving parts.', hi: 'वायर को इंजन की तरफ़ गरमी और घूमने वाले पार्ट से दूर ले जाओ।' },
      { en: 'Connect red to an ignition-switched fuse with the fuse tap and black to a body earth.', hi: 'लाल वायर फ़्यूज़ टैप से ऐसे फ़्यूज़ पर लगाओ जो चाबी के साथ चालू होता है, और काली बॉडी अर्थ पर।' },
      { en: 'Tap the amber trigger wire into the indicator positive on each side. Confirm the wire with a test lamp first.', hi: 'पीली ट्रिगर वायर हर तरफ़ के इंडिकेटर के पॉज़िटिव से जोड़ो। जोड़ने से पहले टेस्ट लैंप से वायर पक्की कर लो।' },
      { en: 'Reconnect the battery. Check the DRL comes on with ignition and turns amber with each indicator.', hi: 'बैटरी जोड़ो। देखो कि DRL चाबी के साथ जलती है और इंडिकेटर देने पर पीली हो जाती है।' },
      { en: 'For mirror indicators: lever the mirror glass out gently, unclip the old lamp, plug in the new one and test before pressing the glass back.', hi: 'मिरर इंडिकेटर के लिए शीशा आराम से निकालो, पुरानी लाइट का क्लिप खोलो, नई का प्लग लगाओ और शीशा वापस दबाने से पहले चलाकर देखो।' },
    ],
  },
  'aux-lights': {
    tools: ['Spanner set (10, 13 mm)', 'Drill for the bracket where needed', 'Multimeter or test lamp', 'Cable ties', 'Crimping tool', 'Thread lock'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Bolt the brackets to a solid point: the bumper beam, a crash-bar mount or the A-pillar hinge bolts. Not to plastic alone.', hi: 'ब्रैकेट किसी मज़बूत जगह पर कसो: बम्पर की बीम, गार्ड का माउंट या A-पिलर के हिंज बोल्ट। सिर्फ़ प्लास्टिक पर मत कसना।' },
      { en: 'Mount the lamps, add thread lock and leave the aim bolts slightly loose.', hi: 'लाइट लगाओ, थ्रेड लॉक लगाओ और सेटिंग वाले बोल्ट थोड़े ढीले छोड़ दो।' },
      { en: 'Fit the relay harness supplied: fused red to battery positive, black to body earth. Never take lamp power from the headlight wire.', hi: 'साथ आया रिले हार्नेस लगाओ: फ़्यूज़ वाली लाल वायर बैटरी के पॉज़िटिव पर, काली बॉडी अर्थ पर। लाइट का करंट हेडलाइट की वायर से कभी मत लेना।' },
      { en: 'Run the switch wire through an existing firewall grommet and fix the switch within easy reach.', hi: 'स्विच की वायर फ़ायरवॉल के पहले से बने ग्रोमेट से अंदर लो और स्विच ऐसी जगह लगाओ जहाँ हाथ आराम से पहुँचे।' },
      { en: 'Reconnect the battery, aim the lamps slightly down at 10 metres and tighten everything.', hi: 'बैटरी जोड़ो, 10 मीटर पर लाइट को थोड़ा नीचे की तरफ़ सेट करो और सब कस दो।' },
      { en: 'Fit the covers. They stay on in city traffic.', hi: 'कवर चढ़ा दो। शहर के ट्रैफ़िक में कवर लगे ही रहेंगे।' },
    ],
  },
  'accent-underbody': {
    tools: ['Car lift or four axle stands', 'Isopropyl wipe', 'Cable ties and P-clips', 'Inline fuse holder', 'Heat-shrink sleeves', 'Multimeter or test lamp'],
    steps: [
      { en: 'Raise the car on a lift or four axle stands. Disconnect the battery negative.', hi: 'गाड़ी लिफ़्ट या चार स्टैंड पर उठाओ। बैटरी का नेगेटिव हटाओ।' },
      { en: 'Plan the strip positions on the sills and behind the bumpers, away from the exhaust, jacking points and suspension.', hi: 'स्ट्रिप की जगह तय करो: साइड में और बम्पर के पीछे, साइलेंसर, जैक पॉइंट और सस्पेंशन से दूर।' },
      { en: 'Degrease the surface, stick the strips and back the tape up with a clip or tie every 20 cm.', hi: 'जगह से ग्रीस साफ़ करो, स्ट्रिप चिपकाओ और हर 20 cm पर क्लिप या टाई से पक्का करो।' },
      { en: 'Route the wires along the factory loom, seal every joint with heat-shrink and bring the feed up to the control box.', hi: 'वायर को कंपनी की वायरिंग के साथ-साथ ले जाओ, हर जोड़ पर हीट-श्रिंक चढ़ाओ और सप्लाई कंट्रोल बॉक्स तक लाओ।' },
      { en: 'Power the box through the inline fuse from the battery and earth it to the body.', hi: 'बॉक्स को इनलाइन फ़्यूज़ के साथ बैटरी से करंट दो और अर्थ बॉडी पर लगाओ।' },
      { en: 'Reconnect the battery and test. Tell the owner it is for shows and private land, and must be off on public roads.', hi: 'बैटरी जोड़कर टेस्ट करो। मालिक को बता दो कि यह शो और प्राइवेट जगह के लिए है, सड़क पर बंद रखनी है।' },
      { en: 'For door sill plates: clean the sill, tap the feed from the door courtesy light, stick the plate down and check it lights only with the door open.', hi: 'डोर सिल प्लेट के लिए सिल साफ़ करो, दरवाज़े की कर्टसी लाइट से सप्लाई लो, प्लेट चिपकाओ और देखो कि सिर्फ़ दरवाज़ा खुलने पर जलती है।' },
    ],
  },

  // ---- Performance & Handling ----------------------------------------------
  'air-intakes': {
    tools: ['Phillips screwdriver', '8 and 10 mm sockets', 'Clean cloth', 'Hose clamp driver (intake kits)'],
    steps: [
      { en: 'Work on a cold engine. Open the airbox clips or screws and lift the lid.', hi: 'इंजन ठंडा होने पर काम करो। एयर फ़िल्टर बॉक्स के क्लिप या स्क्रू खोलकर ढक्कन उठाओ।' },
      { en: 'Lift out the old filter and wipe the inside of the airbox clean. Let nothing fall into the intake pipe.', hi: 'पुराना फ़िल्टर निकालो और बॉक्स अंदर से कपड़े से साफ़ करो। इनटेक पाइप में कुछ गिरना नहीं चाहिए।' },
      { en: 'Seat the new filter with the rubber seal flat all round, then close the lid and clips.', hi: 'नया फ़िल्टर ऐसे बैठाओ कि रबर की सील चारों तरफ़ बराबर बैठे, फिर ढक्कन और क्लिप बंद करो।' },
      { en: 'For an intake kit: unplug the air-flow sensor, remove the factory airbox, fit the heat shield and pipe, and move the sensor across in the same direction.', hi: 'इनटेक किट हो तो एयर-फ़्लो सेंसर का प्लग निकालो, कंपनी का बॉक्स हटाओ, हीट शील्ड और पाइप लगाओ और सेंसर उसी दिशा में नई पाइप में लगा दो।' },
      { en: 'Tighten every clamp, start the engine and listen for a hiss that means an air leak.', hi: 'सारे क्लैंप कसो, इंजन चालू करो और सुनो: सीटी जैसी आवाज़ आए तो कहीं से हवा लीक हो रही है।' },
      { en: 'Check that no warning light is on after a short drive.', hi: 'थोड़ा चलाकर देखो कि मीटर में कोई वार्निंग लाइट नहीं आई।' },
    ],
  },
  exhaust: {
    tools: ['Jack and axle stands or a lift', '13 mm spanner', 'Wire brush', 'Penetrating oil', 'Exhaust hangers pliers (systems)', 'Exhaust paste (systems)'],
    steps: [
      { en: 'Work only on a cold exhaust. Measure the tailpipe diameter and check it matches the tip inlet.', hi: 'साइलेंसर ठंडा होने पर ही काम करो। टेलपाइप की मोटाई नापकर देखो कि टिप के नाप से मिलती है।' },
      { en: 'Clean rust and soot off the last 10 cm of the tailpipe with the wire brush.', hi: 'टेलपाइप के आख़िरी 10 cm से जंग और कालिख वायर ब्रश से साफ़ करो।' },
      { en: 'Slide the tip on, set how far it sticks out and turn it level with the bumper.', hi: 'टिप चढ़ाओ, कितनी बाहर निकलेगी यह सेट करो और बम्पर के बराबर सीधी करो।' },
      { en: 'Tighten the clamp bolts evenly. The tip must not touch the bumper: leave a finger of gap.', hi: 'क्लैंप के बोल्ट बराबर कसो। टिप बम्पर को छूनी नहीं चाहिए: एक उँगली का गैप रखो।' },
      { en: 'For a full system: raise the car securely, soak the joint bolts in oil, unhook the rubber hangers and swap the rear section with new gaskets or paste. Keep the catalytic converter.', hi: 'पूरा सिस्टम बदलना हो तो गाड़ी मज़बूती से उठाओ, जोड़ के बोल्ट पर तेल डालो, रबर हैंगर निकालो और पीछे का हिस्सा नई गैस्केट या पेस्ट के साथ बदलो। कैटेलिटिक कनवर्टर नहीं हटाना है।' },
      { en: 'Start the engine, check every joint for leaks and re-tighten the clamps after 100 km.', hi: 'इंजन चालू करके हर जोड़ पर लीकेज देखो और 100 km के बाद क्लैंप दोबारा कस दो।' },
    ],
  },
  suspension: {
    tools: ['Two-post lift or four axle stands', 'Spring compressor', 'Torque wrench', 'Socket and spanner set', 'Breaker bar', 'Paint marker'],
    steps: [
      { en: 'Raise the car securely and remove the wheels. Support the lower arm before undoing anything.', hi: 'गाड़ी मज़बूती से उठाओ और पहिये खोलो। कुछ भी खोलने से पहले नीचे की आर्म को सहारा दो।' },
      { en: 'Unclip the brake hose and ABS wire from the strut, then undo the lower strut bolts and the top mount nuts.', hi: 'स्ट्रट से ब्रेक होज़ और ABS की वायर के क्लिप निकालो, फिर स्ट्रट के नीचे के बोल्ट और ऊपर के नट खोलो।' },
      { en: 'Compress the spring with a proper spring compressor before undoing the top nut. Never use an impact gun on an uncompressed strut.', hi: 'ऊपर का नट खोलने से पहले स्प्रिंग को सही स्प्रिंग कंप्रेसर से दबाओ। बिना दबी स्प्रिंग वाले स्ट्रट पर इम्पैक्ट गन कभी मत चलाना।' },
      { en: 'Build the strut with the new spring or fit the coilover, with the spring ends seated in their stops.', hi: 'नई स्प्रिंग के साथ स्ट्रट जोड़ो या कॉइलओवर लगाओ। स्प्रिंग के सिरे अपनी जगह पर बैठने चाहिए।' },
      { en: 'Refit and tighten the bolts by hand. Torque the suspension bolts to the car maker figures only with the car back on its wheels.', hi: 'बोल्ट वापस लगाकर हाथ से कसो। सस्पेंशन के बोल्ट कंपनी के टॉर्क पर तभी कसो जब गाड़ी पहियों पर खड़ी हो।' },
      { en: 'Torque the wheel nuts, set the ride height evenly side to side and check the tyres clear the arches at full lock.', hi: 'व्हील नट टॉर्क से कसो, दोनों तरफ़ ऊँचाई बराबर सेट करो और स्टीयरिंग पूरा घुमाकर देखो कि टायर आर्च से नहीं लग रहे।' },
      { en: 'Get a four-wheel alignment done the same day, and again after 500 km when the springs settle.', hi: 'उसी दिन चारों पहियों का अलाइनमेंट करवाओ, और स्प्रिंग बैठने के बाद 500 km पर दोबारा।' },
    ],
  },
  brakes: {
    tools: ['Jack and axle stands', 'Wheel spanner and torque wrench', 'Caliper piston tool or C-clamp', '12, 14 and 17 mm spanners', 'Brake cleaner', 'Wire brush', 'Copper grease'],
    steps: [
      { en: 'Loosen the wheel nuts, raise the car on axle stands and remove the wheel.', hi: 'व्हील नट ढीले करो, गाड़ी स्टैंड पर उठाओ और पहिया निकालो।' },
      { en: 'Undo the caliper slide bolts and hang the caliper with wire. Do not let it hang on the brake hose.', hi: 'कैलिपर के स्लाइड बोल्ट खोलो और कैलिपर को तार से टाँग दो। उसे ब्रेक होज़ पर लटकने मत देना।' },
      { en: 'Remove the old pads. For rotors, undo the carrier bolts and pull the rotor off the hub.', hi: 'पुराने पैड निकालो। डिस्क बदलनी हो तो कैरियर के बोल्ट खोलकर डिस्क हब से उतारो।' },
      { en: 'Clean the hub face with the wire brush and wipe new rotors with brake cleaner to remove the oil film.', hi: 'हब की सतह वायर ब्रश से साफ़ करो और नई डिस्क से तेल की परत ब्रेक क्लीनर से हटाओ।' },
      { en: 'Push the piston back slowly, fit the new pads with their shims and torque the carrier and slide bolts.', hi: 'पिस्टन धीरे-धीरे पीछे दबाओ, नए पैड शिम के साथ लगाओ और कैरियर और स्लाइड बोल्ट टॉर्क से कसो।' },
      { en: 'Refit the wheel and torque the nuts. Pump the brake pedal until it is firm before moving the car.', hi: 'पहिया लगाकर नट टॉर्क से कसो। गाड़ी हिलाने से पहले ब्रेक पेडल तब तक दबाते रहो जब तक सख़्त न हो जाए।' },
      { en: 'Check the fluid level. Tell the owner to brake gently for the first 300 km while the pads bed in.', hi: 'ब्रेक ऑयल का लेवल देखो। मालिक को बताओ कि पहले 300 km तक पैड बैठने दें और ब्रेक आराम से लगाएँ।' },
    ],
  },
  'tuning-hardware': {
    tools: ['Plastic trim tool', 'Cable ties', 'Hose cutter and 8, 10 mm sockets (catch can)'],
    steps: [
      { en: 'Switch off the ignition, take the key out and wait two minutes.', hi: 'चाबी बंद करके निकाल लो और दो मिनट रुको।' },
      { en: 'Find the connector on top of the accelerator pedal, press its lock tab and unplug it.', hi: 'एक्सीलरेटर पेडल के ऊपर का कनेक्टर ढूँढो, उसका लॉक दबाओ और निकाल दो।' },
      { en: 'Plug the controller in between the pedal and the car harness until both sides click.', hi: 'कंट्रोलर को पेडल और गाड़ी के हार्नेस के बीच में लगाओ, दोनों तरफ़ क्लिक की आवाज़ आनी चाहिए।' },
      { en: 'Tie the spare cable up so nothing hangs near the pedals. Stick the control pad where the driver can reach it.', hi: 'बची हुई केबल बाँध दो ताकि पेडल के पास कुछ न लटके। कंट्रोल पैड वहाँ चिपकाओ जहाँ ड्राइवर का हाथ पहुँचे।' },
      { en: 'Start the engine, check there is no warning light and try each mode with the car parked first.', hi: 'इंजन चालू करो, देखो कोई वार्निंग लाइट नहीं है और पहले खड़ी गाड़ी में हर मोड आज़माओ।' },
      { en: 'For a catch can: mount it upright away from heat, cut the breather hose and plumb it in and out. The outlet must go back to the intake, never to open air.', hi: 'कैच कैन हो तो उसे गरमी से दूर सीधा खड़ा लगाओ, ब्रीदर होज़ काटकर इन और आउट जोड़ो। आउट की पाइप वापस इनटेक में ही जाएगी, खुली हवा में कभी नहीं।' },
    ],
  },
  'racing-seats': {
    tools: ['Socket set with Torx and spline bits', 'Torque wrench', 'Seat rails or brackets for the car', 'Grade 8.8 bolts and load plates', '10 mm spanner for the battery'],
    steps: [
      { en: 'Disconnect the battery negative and wait 15 minutes: the factory seat has an airbag and a belt sensor.', hi: 'बैटरी का नेगेटिव हटाओ और 15 मिनट रुको: कंपनी की सीट में एयरबैग और बेल्ट का सेंसर होता है।' },
      { en: 'Unplug the connectors under the seat, undo the four floor bolts and lift the seat out with a helper.', hi: 'सीट के नीचे के कनेक्टर निकालो, फ़र्श के चार बोल्ट खोलो और एक आदमी की मदद से सीट बाहर निकालो।' },
      { en: 'Bolt the car-specific rails or brackets to the new seat and check it sits level.', hi: 'गाड़ी के हिसाब के रेल या ब्रैकेट नई सीट पर कसो और देखो कि सीट सीधी बैठ रही है।' },
      { en: 'Bolt the seat to the factory floor points only, with grade 8.8 bolts torqued to the car maker figure. Never bolt a seat to thin floor sheet.', hi: 'सीट सिर्फ़ कंपनी के फ़र्श वाले पॉइंट पर लगाओ, ग्रेड 8.8 के बोल्ट से, कंपनी के टॉर्क पर। पतली चादर वाले फ़र्श पर सीट कभी मत कसना।' },
      { en: 'Harness anchors go into the factory belt points or through the floor with load plates, at the angles in the harness sheet.', hi: 'हार्नेस के एंकर कंपनी के बेल्ट पॉइंट पर या लोड प्लेट के साथ फ़र्श में लगेंगे, हार्नेस की पर्ची में दिए कोण पर।' },
      { en: 'Pull hard on the seat and each strap to check nothing moves. Tell the owner this setup is for the track.', hi: 'सीट और हर पट्टी को ज़ोर से खींचकर देखो कि कुछ हिलता नहीं। मालिक को बता दो कि यह सेटअप ट्रैक के लिए है।' },
    ],
  },

  // ---- Wheels & Tyres ------------------------------------------------------
  'alloy-wheels': {
    tools: ['Tyre changer and wheel balancer', 'Torque wrench', 'Wheel spanner', 'Jack and axle stands', 'Wire brush', 'Hub rings from the box'],
    steps: [
      { en: 'Before mounting tyres, test-fit one bare wheel on a front and a rear hub. Check it clears the caliper and sits flat.', hi: 'टायर चढ़ाने से पहले एक खाली व्हील आगे और पीछे के हब पर लगाकर देखो। कैलिपर से न टकराए और हब पर पूरा बैठे।' },
      { en: 'Mount the tyres with new valves and balance each wheel.', hi: 'नए वाल्व के साथ टायर चढ़ाओ और हर व्हील की बैलेंसिंग करो।' },
      { en: 'Clean the hub face with the wire brush and push the hub ring into the wheel if one is supplied.', hi: 'हब की सतह वायर ब्रश से साफ़ करो और हब रिंग साथ आई हो तो व्हील में बैठा दो।' },
      { en: 'Fit the wheel and start every nut by hand. Use nuts with the right seat for alloy wheels.', hi: 'व्हील लगाओ और हर नट पहले हाथ से चढ़ाओ। अलॉय व्हील के लिए सही सीट वाले नट ही लगाओ।' },
      { en: 'Lower the car and tighten in a star pattern with a torque wrench to the handbook figure. Do not finish with an impact gun.', hi: 'गाड़ी उतारो और टॉर्क रिंच से स्टार पैटर्न में, बुकलेट में लिखे टॉर्क पर नट कसो। आख़िर में इम्पैक्ट गन मत चलाना।' },
      { en: 'Turn the steering lock to lock and check the tyres do not rub. Set the tyre pressures.', hi: 'स्टीयरिंग पूरा दाएँ-बाएँ घुमाकर देखो कि टायर कहीं नहीं रगड़ रहे। टायर में हवा सही करो।' },
      { en: 'Re-torque the nuts after 50 km.', hi: '50 km चलने के बाद नट दोबारा टॉर्क से कसो।' },
    ],
  },
  'wheel-hardware': {
    tools: ['Torque wrench', 'Wheel spanner with a thin-wall socket', 'Jack and axle stands', 'Wire brush'],
    steps: [
      { en: 'Check the thread (M12 x 1.5 or M12 x 1.25) and seat type against the old nut before fitting anything.', hi: 'कुछ भी लगाने से पहले पुराने नट से चूड़ी (M12 x 1.5 या M12 x 1.25) और सीट का टाइप मिला लो।' },
      { en: 'Change one wheel at a time. Start each new nut by hand for at least five full turns.', hi: 'एक बार में एक ही पहिये पर काम करो। हर नया नट हाथ से कम से कम पाँच पूरे चक्कर चढ़ाओ।' },
      { en: 'For spacers: remove the wheel, clean the hub face and bolt the spacer to the hub at the handbook torque.', hi: 'स्पेसर लगाना हो तो पहिया निकालो, हब की सतह साफ़ करो और स्पेसर को हब पर बुकलेट के टॉर्क से कसो।' },
      { en: 'Refit the wheel on the spacer studs and check the original studs do not stick out past the spacer face.', hi: 'पहिया स्पेसर के स्टड पर लगाओ और देखो कि पुराने स्टड स्पेसर की सतह से बाहर नहीं निकल रहे।' },
      { en: 'Tighten in a star pattern with a torque wrench to the handbook figure.', hi: 'टॉर्क रिंच से स्टार पैटर्न में, बुकलेट के टॉर्क पर कसो।' },
      { en: 'Re-check the torque after 50 km.', hi: '50 km के बाद टॉर्क दोबारा चेक करो।' },
    ],
  },
  'wheel-styling': {
    tools: ['Jack and axle stands', 'Wheel spanner and torque wrench', 'Brake cleaner', 'Wire brush'],
    steps: [
      { en: 'Let the brakes cool fully. Raise the car on axle stands and remove the wheel.', hi: 'ब्रेक पूरे ठंडे होने दो। गाड़ी स्टैंड पर उठाओ और पहिया निकालो।' },
      { en: 'Clean the caliper with the wire brush and brake cleaner.', hi: 'कैलिपर को वायर ब्रश और ब्रेक क्लीनर से साफ़ करो।' },
      { en: 'Fix the cover with its brackets and the high-temperature adhesive. Large covers go on the front, small on the rear.', hi: 'कवर को उसके ब्रैकेट और हाई-टेम्परेचर गोंद से लगाओ। बड़े कवर आगे, छोटे पीछे लगेंगे।' },
      { en: 'Refit the wheel and spin it by hand. There must be at least 3 mm between the cover and the wheel.', hi: 'पहिया लगाकर हाथ से घुमाओ। कवर और व्हील के बीच कम से कम 3 mm का गैप होना चाहिए।' },
      { en: 'Torque the wheel nuts to the handbook figure.', hi: 'व्हील नट बुकलेट के टॉर्क पर कसो।' },
      { en: 'For centre caps: push the old cap out from behind the wheel and press the new one in until it clicks.', hi: 'सेंटर कैप के लिए पुराना कैप व्हील के पीछे से धकेलकर निकालो और नया क्लिक होने तक दबा दो।' },
    ],
  },
  'wheel-covers': {
    tools: ['Rubber mallet or the heel of your hand', 'Cloth'],
    steps: [
      { en: 'Check the wheel size on the tyre wall (R13, R14 or R15) matches the covers.', hi: 'टायर की साइड पर लिखा साइज़ (R13, R14 या R15) कवर के साइज़ से मिलाओ।' },
      { en: 'Pull off the old covers, if any, and wipe the wheel face clean.', hi: 'पुराने कवर हों तो निकालो और व्हील का सामने वाला हिस्सा साफ़ कर लो।' },
      { en: 'Check the steel ring sits in all the clips on the back of the cover, with its gap lined up with the valve cut-out.', hi: 'देखो कि स्टील की रिंग कवर के पीछे सारे क्लिप में बैठी है और उसका गैप वाल्व वाली जगह के सामने है।' },
      { en: 'Line the valve cut-out up with the tyre valve and press the cover on, top first, then the sides, then the bottom.', hi: 'वाल्व वाली जगह को टायर के वाल्व के सामने रखो और कवर दबाओ: पहले ऊपर, फिर साइड, फिर नीचे।' },
      { en: 'Tap round the edge with the mallet until it sits evenly, then pull gently to check it is held all round.', hi: 'किनारे पर चारों तरफ़ मैलेट से हल्का ठोको ताकि बराबर बैठ जाए, फिर हल्का खींचकर देखो कि हर तरफ़ से पकड़ा है।' },
    ],
  },
  'tyre-inflators': {
    tools: [],
    steps: [
      { en: 'Start the engine so the inflator does not drain the battery, then plug it into the 12V socket.', hi: 'इंजन चालू रखो ताकि बैटरी न बैठे, फिर इन्फ़्लेटर को 12V सॉकेट में लगाओ।' },
      { en: 'Screw the hose onto the tyre valve until no air escapes.', hi: 'पाइप को टायर के वाल्व पर तब तक कसो जब तक हवा निकलनी बंद न हो जाए।' },
      { en: 'Set the pressure from the sticker on the driver door frame and switch on. It stops by itself at the set figure.', hi: 'ड्राइवर के दरवाज़े के फ़्रेम पर लगे स्टिकर से प्रेशर सेट करो और चालू करो। सेट किए प्रेशर पर यह अपने आप बंद हो जाएगा।' },
      { en: 'Rest the inflator for 10 minutes after every 10 minutes of running.', hi: 'हर 10 मिनट चलाने के बाद इन्फ़्लेटर को 10 मिनट आराम दो।' },
      { en: 'For a puncture: pull out the nail, ream the hole, push a plug in with the tool, trim it flush, then inflate and check with soapy water.', hi: 'पंक्चर हो तो कील निकालो, रीमर से छेद साफ़ करो, टूल से प्लग अंदर डालो, बाहर निकला हिस्सा काटो, फिर हवा भरो और साबुन के पानी से चेक करो।' },
    ],
  },
  tpms: {
    tools: ['Spanner from the box', 'Soapy water'],
    steps: [
      { en: 'Stick the display on the dash where sunlight reaches the solar panel and it does not block the view.', hi: 'डिस्प्ले डैशबोर्ड पर वहाँ चिपकाओ जहाँ सोलर पैनल पर धूप पड़े और सामने का नज़ारा न रुके।' },
      { en: 'Each sensor is marked for a wheel (FL, FR, RL, RR). Match them before fitting.', hi: 'हर सेंसर पर पहिये का निशान है (FL, FR, RL, RR)। लगाने से पहले मिला लो।' },
      { en: 'Remove the valve cap, thread the lock nut on, then screw the sensor on hand-tight.', hi: 'वाल्व का ढक्कन हटाओ, लॉक नट चढ़ाओ, फिर सेंसर हाथ से कस दो।' },
      { en: 'Tighten the lock nut back against the sensor with the spanner.', hi: 'स्पैनर से लॉक नट को सेंसर की तरफ़ वापस कस दो।' },
      { en: 'Check each valve with soapy water for bubbles, then set the low and high pressure alerts on the display.', hi: 'हर वाल्व पर साबुन का पानी लगाकर बुलबुले देखो, फिर डिस्प्ले में कम और ज़्यादा प्रेशर का अलर्ट सेट करो।' },
    ],
  },

  // ---- Audio & Tech --------------------------------------------------------
  'head-units': {
    tools: ['Plastic trim tools', 'Phillips screwdriver', '8 and 10 mm sockets', 'Cloth tape', 'Cable ties', '10 mm spanner for the battery'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Lever off the fascia trim with plastic tools, undo the stereo screws and slide the old unit out.', hi: 'प्लास्टिक टूल से फ़ेशिया की ट्रिम निकालो, स्टीरियो के स्क्रू खोलो और पुराना सेट बाहर खींचो।' },
      { en: 'Unplug the main harness, antenna, USB and camera plugs. Photograph them first.', hi: 'मेन हार्नेस, एंटीना, USB और कैमरे के प्लग निकालो। निकालने से पहले फ़ोटो खींच लो।' },
      { en: 'Join the supplied coupler harness to the car plug. Do not cut the car wiring.', hi: 'साथ आया कपलर हार्नेस गाड़ी के प्लग में लगाओ। गाड़ी की वायरिंग नहीं काटनी है।' },
      { en: 'Connect the steering control box, GPS antenna, microphone and reverse camera lead. Fix the GPS antenna on top of the dash.', hi: 'स्टीयरिंग कंट्रोल बॉक्स, GPS एंटीना, माइक और रिवर्स कैमरे की लीड जोड़ो। GPS एंटीना डैशबोर्ड के ऊपर चिपकाओ।' },
      { en: 'Reconnect the battery and test before fitting the trim: sound from all speakers, steering buttons, reverse camera, phone mirroring.', hi: 'बैटरी जोड़ो और ट्रिम लगाने से पहले टेस्ट करो: सारे स्पीकर की आवाज़, स्टीयरिंग के बटन, रिवर्स कैमरा, फ़ोन मिररिंग।' },
      { en: 'Wrap loose wires in cloth tape so they do not rattle, slide the unit in and clip the fascia back.', hi: 'ढीली वायर पर कपड़े वाली टेप लपेटो ताकि खड़खड़ न करें, सेट अंदर बैठाओ और फ़ेशिया वापस क्लिप कर दो।' },
    ],
  },
  speakers: {
    tools: ['Plastic trim tools', 'Phillips screwdriver', '10 mm socket', 'Speaker adapter rings and plugs', 'Crimping tool', 'Foam tape'],
    steps: [
      { en: 'Disconnect the battery negative if the door has an airbag or power window switches to unplug.', hi: 'दरवाज़े में एयरबैग हो या पावर विंडो के स्विच निकालने हों तो बैटरी का नेगेटिव हटा दो।' },
      { en: 'Remove the door card: screws behind the handle and armrest caps, then pop the clips from the bottom.', hi: 'डोर पैड खोलो: हैंडल और आर्मरेस्ट के ढक्कन के पीछे के स्क्रू निकालो, फिर नीचे से क्लिप खोलते जाओ।' },
      { en: 'Unscrew the old speaker and unplug it. Check the new speaker depth against the window glass with the window down.', hi: 'पुराना स्पीकर खोलकर प्लग निकालो। शीशा नीचे करके देखो कि नया स्पीकर गहराई में शीशे से नहीं टकराएगा।' },
      { en: 'Fit the adapter ring and connect positive to positive, negative to negative. A reversed speaker loses bass.', hi: 'अडैप्टर रिंग लगाओ और पॉज़िटिव को पॉज़िटिव, नेगेटिव को नेगेटिव से जोड़ो। उल्टा जुड़ा स्पीकर बेस खा जाता है।' },
      { en: 'For components: mount the tweeter in the mirror corner or the dash and fix the crossover inside the door where it stays dry.', hi: 'कंपोनेंट सेट हो तो ट्वीटर मिरर के कोने या डैशबोर्ड पर लगाओ और क्रॉसओवर दरवाज़े के अंदर ऐसी जगह कसो जहाँ पानी न पहुँचे।' },
      { en: 'Play music and check the balance, then refit the water shield and the door card.', hi: 'गाना चलाकर बैलेंस चेक करो, फिर पानी रोकने वाली पन्नी और डोर पैड वापस लगाओ।' },
    ],
  },
  'subwoofers-amps': {
    tools: ['Power cable kit with inline fuse', 'Crimping tool', 'Trim tools', 'Socket set', 'Multimeter', 'Cable ties'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Run the power cable from the battery positive through a firewall grommet. Fit the fuse within 30 cm of the battery.', hi: 'पावर केबल बैटरी के पॉज़िटिव से फ़ायरवॉल के ग्रोमेट के रास्ते अंदर लाओ। फ़्यूज़ बैटरी से 30 cm के अंदर लगाओ।' },
      { en: 'Route the power cable down one side of the car and the signal cables down the other to avoid noise.', hi: 'पावर केबल गाड़ी के एक तरफ़ से और सिग्नल केबल दूसरी तरफ़ से ले जाओ ताकि आवाज़ में शोर न आए।' },
      { en: 'Earth to bare metal on the body with a cable no longer than 50 cm. Scrape the paint off the earth point.', hi: 'अर्थ बॉडी के नंगे लोहे पर दो, 50 cm से छोटी केबल से। अर्थ वाली जगह का पेंट खुरच दो।' },
      { en: 'Fix the unit under the seat or in the boot so it cannot slide. Check the seat still moves fully.', hi: 'यूनिट को सीट के नीचे या डिक्की में ऐसे कसो कि खिसके नहीं। देखो कि सीट पूरी आगे-पीछे हो रही है।' },
      { en: 'Connect the signal and remote wires, reconnect the battery and set the gain low, then raise it until the bass blends in.', hi: 'सिग्नल और रिमोट वायर जोड़ो, बैटरी लगाओ और गेन पहले कम रखो, फिर धीरे-धीरे इतना बढ़ाओ कि बेस बाकी आवाज़ में घुल जाए।' },
    ],
  },
  'sound-damping': {
    tools: ['Plastic trim tools', 'Roller from the pack', 'Sharp cutter', 'Isopropyl and cloth', 'Gloves', 'Phillips screwdriver'],
    steps: [
      { en: 'Remove the door cards and peel the plastic water shield back carefully so it can be reused.', hi: 'डोर पैड खोलो और पानी रोकने वाली पन्नी आराम से हटाओ ताकि दोबारा लग सके।' },
      { en: 'Degrease the inner metal skin with isopropyl. The sheet will not stick to dust or wax.', hi: 'अंदर की लोहे की चादर आइसोप्रोपिल से साफ़ करो। धूल या वैक्स पर शीट नहीं चिपकेगी।' },
      { en: 'Wear gloves: the foil edges cut. Cut the sheet into pieces that fit through the door openings.', hi: 'दस्ताने पहनो: फ़ॉइल के किनारे हाथ काट देते हैं। शीट को ऐसे टुकड़ों में काटो जो दरवाज़े के छेदों से अंदर जा सकें।' },
      { en: 'Stick the pieces on the outer skin and roll hard until the foil pattern flattens.', hi: 'टुकड़े बाहर वाली चादर पर चिपकाओ और रोलर से इतना दबाओ कि फ़ॉइल का पैटर्न चपटा हो जाए।' },
      { en: 'Keep the drain holes, window track, lock rods and wiring clips uncovered.', hi: 'पानी निकलने के छेद, शीशे की पटरी, लॉक की रॉड और वायरिंग के क्लिप ढकने नहीं हैं।' },
      { en: 'Refit the water shield and door card, then check the window, lock and speaker on every door.', hi: 'पन्नी और डोर पैड वापस लगाओ, फिर हर दरवाज़े का शीशा, लॉक और स्पीकर चेक करो।' },
    ],
  },
  'dash-cams': {
    tools: ['Plastic trim tool', 'Isopropyl wipe', 'Cable clips', 'Fuse tap and test lamp (hardwire only)'],
    steps: [
      { en: 'Clean the glass behind the rear-view mirror and stick the camera there, inside the wiper sweep.', hi: 'रियर-व्यू मिरर के पीछे का शीशा साफ़ करो और कैमरा वहीं चिपकाओ, जहाँ तक वाइपर साफ़ करता है।' },
      { en: 'Tuck the cable into the headliner edge and across to the passenger-side pillar.', hi: 'केबल को छत की लाइनिंग के किनारे में दबाते हुए पैसेंजर की तरफ़ के पिलर तक ले जाओ।' },
      { en: 'Run the cable behind the pillar trim, never across the front of a curtain airbag.', hi: 'केबल पिलर की ट्रिम के पीछे से निकालो। कर्टेन एयरबैग के सामने से कभी मत ले जाना।' },
      { en: 'Go down behind the door rubber and under the glovebox to the 12V socket.', hi: 'दरवाज़े की रबर के पीछे से नीचे और ग्लवबॉक्स के नीचे से 12V सॉकेट तक ले जाओ।' },
      { en: 'For a rear camera: run its cable along the headliner to the rear glass and stick it at the top centre.', hi: 'पीछे का कैमरा हो तो उसकी केबल छत की लाइनिंग के साथ पीछे के शीशे तक ले जाओ और ऊपर बीच में चिपकाओ।' },
      { en: 'Insert a high-endurance memory card, format it in the camera and check the view on the phone app.', hi: 'हाई-एंड्यूरेंस मेमोरी कार्ड लगाओ, कैमरे में ही फ़ॉर्मेट करो और फ़ोन ऐप पर व्यू देख लो।' },
    ],
  },
  'parking-safety': {
    tools: ['Plastic trim tools', 'Drill with the hole saw from the kit', 'Multimeter or test lamp', 'Wire tap connectors', 'Cable ties', 'Calibration mats (360 kits)'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Fix the camera centred above the number plate, on the garnish or the boot handle.', hi: 'कैमरा नंबर प्लेट के ऊपर बीच में, गार्निश या डिक्की के हैंडल पर लगाओ।' },
      { en: 'Run the video cable through the boot rubber boot and under the door sill trims to the head unit.', hi: 'वीडियो केबल डिक्की के रबर बूट से निकालकर दरवाज़ों की सिल ट्रिम के नीचे से स्टीरियो तक ले जाओ।' },
      { en: 'Find the reverse lamp positive with a test lamp and tap the camera power there. Earth to a body bolt.', hi: 'टेस्ट लैंप से रिवर्स लाइट का पॉज़िटिव ढूँढो और कैमरे का करंट वहीं से लो। अर्थ बॉडी के बोल्ट पर दो।' },
      { en: 'Connect the trigger wire to the head unit reverse input.', hi: 'ट्रिगर वायर स्टीरियो के रिवर्स इनपुट से जोड़ो।' },
      { en: 'Reconnect the battery, select reverse and adjust the camera angle so the bumper edge just shows.', hi: 'बैटरी जोड़ो, रिवर्स गियर लगाओ और कैमरे का कोण ऐसे सेट करो कि बम्पर का किनारा बस दिखे।' },
      { en: 'For a 360 kit: fit the four cameras, lay the calibration mats flat around the car and run the calibration from the screen.', hi: '360 किट हो तो चारों कैमरे लगाओ, गाड़ी के चारों तरफ़ कैलिब्रेशन मैट सीधी बिछाओ और स्क्रीन से कैलिब्रेशन चलाओ।' },
    ],
  },
  horns: {
    tools: ['10 and 12 mm spanners', 'Relay and inline fuse', 'Crimping tool', 'Cable ties'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Find the stock horn behind the grille or bumper, unplug it and unbolt it.', hi: 'ग्रिल या बम्पर के पीछे कंपनी का हॉर्न ढूँढो, प्लग निकालो और बोल्ट खोलो।' },
      { en: 'Bolt the new horns to the same bracket with the trumpet opening facing down so water drains out.', hi: 'नए हॉर्न उसी ब्रैकेट पर ऐसे कसो कि मुँह नीचे की तरफ़ रहे और पानी निकल जाए।' },
      { en: 'For twin horns use a relay: battery positive through a fuse to the relay, the old horn wire as the trigger, relay output to both horns.', hi: 'दो हॉर्न के लिए रिले लगाओ: बैटरी का पॉज़िटिव फ़्यूज़ से होकर रिले पर, पुराने हॉर्न की वायर ट्रिगर पर, और रिले का आउटपुट दोनों हॉर्न पर।' },
      { en: 'Earth both horns to the body and tie the wires away from the radiator fan.', hi: 'दोनों हॉर्न का अर्थ बॉडी पर दो और वायर को रेडिएटर फ़ैन से दूर टाई करो।' },
      { en: 'Reconnect the battery and test.', hi: 'बैटरी जोड़ो और बजाकर देखो।' },
    ],
  },
  'chargers-mounts': {
    tools: ['Isopropyl wipe'],
    steps: [
      { en: 'Push the charger fully into the 12V socket until its light comes on.', hi: 'चार्जर को 12V सॉकेट में पूरा दबाओ, जब तक उसकी लाइट न जल जाए।' },
      { en: 'For a mount: pick a vent or dash spot that does not block the road view, the airbag or the gear lever.', hi: 'माउंट के लिए वेंट या डैशबोर्ड पर ऐसी जगह चुनो जहाँ सड़क का नज़ारा, एयरबैग या गियर लीवर न रुके।' },
      { en: 'Clean the spot with the wipe, fix the mount and wait a few minutes before loading it.', hi: 'जगह वाइप से साफ़ करो, माउंट लगाओ और फ़ोन रखने से पहले कुछ मिनट रुको।' },
      { en: 'Clip the cable so it does not hang near the steering wheel or the pedals.', hi: 'केबल को क्लिप कर दो ताकि स्टीयरिंग या पेडल के पास न लटके।' },
    ],
  },

  // ---- 4x4 & Overland ------------------------------------------------------
  'roof-racks': {
    tools: ['Socket and Allen key set', 'Torque wrench', 'Measuring tape', 'Step stool', 'Silicone sealant', 'Soft cloths for the roof'],
    steps: [
      { en: 'Work with two people. Lay cloths on the roof so nothing scratches the paint.', hi: 'यह काम दो लोग मिलकर करो। छत पर कपड़ा बिछा दो ताकि पेंट पर खरोंच न आए।' },
      { en: 'Assemble the feet and bars loosely on the ground, following the sheet.', hi: 'पर्ची के हिसाब से पैर और बार पहले ज़मीन पर ढीले-ढीले जोड़ लो।' },
      { en: 'Lift the rack on and seat the feet on the factory roof rails, gutters or fixed points.', hi: 'रैक उठाकर छत पर रखो और पैर कंपनी की रूफ़ रेल, गटर या फ़िक्स पॉइंट पर बैठाओ।' },
      { en: 'Measure front to back and side to side so the rack sits square, then tighten every clamp to the torque in the sheet.', hi: 'आगे-पीछे और दाएँ-बाएँ नापकर रैक सीधा करो, फिर हर क्लैंप पर्ची में लिखे टॉर्क पर कसो।' },
      { en: 'Seal any bolt that passes through the roof with silicone.', hi: 'जो भी बोल्ट छत के आर-पार जाता है, उस पर सिलिकॉन लगाकर सील करो।' },
      { en: 'Shake the rack hard: the car should rock, the rack should not move. Stick the load limit label where the owner can see it.', hi: 'रैक को ज़ोर से हिलाओ: गाड़ी हिले, रैक नहीं। लोड लिमिट का लेबल ऐसी जगह चिपकाओ जहाँ मालिक को दिखे।' },
      { en: 'Re-check every bolt after 100 km.', hi: '100 km के बाद सारे बोल्ट दोबारा चेक करो।' },
    ],
  },
  'underbody-armour': {
    tools: ['Lift or four axle stands', 'Transmission jack or a helper', 'Socket set', 'Torque wrench', 'Thread lock', 'Penetrating oil'],
    steps: [
      { en: 'Raise the car securely on a lift or four axle stands.', hi: 'गाड़ी को लिफ़्ट या चार स्टैंड पर मज़बूती से उठाओ।' },
      { en: 'Remove the factory plastic undertray or steps if the new part replaces them.', hi: 'नया पार्ट जिसकी जगह लेगा, वह कंपनी का प्लास्टिक कवर या स्टेप हटा दो।' },
      { en: 'Clean the chassis mounting threads and run each bolt in by hand first.', hi: 'चेसिस के माउंटिंग की चूड़ियाँ साफ़ करो और हर बोल्ट पहले हाथ से चलाकर देखो।' },
      { en: 'Lift the plate or slider with a jack or a helper. It is heavy: do not hold it overhead alone.', hi: 'प्लेट या स्लाइडर को जैक या किसी की मदद से उठाओ। यह भारी है: अकेले सिर के ऊपर मत पकड़ना।' },
      { en: 'Start all bolts loosely, line the part up, then torque them with thread lock.', hi: 'सारे बोल्ट पहले ढीले लगाओ, पार्ट सीधा करो, फिर थ्रेड लॉक लगाकर टॉर्क से कसो।' },
      { en: 'Check the oil drain plug and filter can still be reached and nothing touches the exhaust.', hi: 'देखो कि ऑयल का ड्रेन प्लग और फ़िल्टर तक हाथ पहुँचता है और कुछ भी साइलेंसर को नहीं छू रहा।' },
    ],
  },
  snorkels: {
    tools: ['Cutting template from the kit', 'Hole saw set and step drill', 'Masking tape and marker', 'Rust primer', 'Socket set', 'Silicone sealant', 'Trim tools'],
    steps: [
      { en: 'Tape the template on the wing and check it twice against the snorkel body before marking.', hi: 'टेम्पलेट को फ़ेंडर पर टेप से चिपकाओ और मार्क करने से पहले स्नॉर्कल से दो बार मिलाकर देखो।' },
      { en: 'Remove the wheel arch liner and anything behind the panel that the drill could hit.', hi: 'व्हील आर्च लाइनर और पैनल के पीछे की हर वह चीज़ हटाओ जिसमें ड्रिल लग सकती है।' },
      { en: 'Drill pilot holes, then cut the main hole with the hole saw. This cannot be undone.', hi: 'पहले छोटे पायलट होल करो, फिर होल सॉ से बड़ा छेद काटो। यह काम वापस नहीं होता।' },
      { en: 'File the edges smooth and coat all bare metal with rust primer.', hi: 'किनारे रेती से चिकने करो और नंगे लोहे पर जंग वाला प्राइमर लगाओ।' },
      { en: 'Bolt the snorkel to the wing and fix the top bracket on the A-pillar.', hi: 'स्नॉर्कल को फ़ेंडर पर कसो और ऊपर का ब्रैकेट A-पिलर पर लगाओ।' },
      { en: 'Join the snorkel to the airbox with the hose supplied and seal every joint and the airbox drain with silicone.', hi: 'साथ आई होज़ से स्नॉर्कल को एयर फ़िल्टर बॉक्स से जोड़ो और हर जोड़ और बॉक्स का ड्रेन सिलिकॉन से सील करो।' },
      { en: 'Start the engine and cover the snorkel head with your hand for a moment: the engine should start to stall if the system is sealed.', hi: 'इंजन चालू करके स्नॉर्कल का मुँह पल भर हाथ से ढको: सीलिंग सही है तो इंजन बंद होने लगेगा।' },
    ],
  },
  'light-bars': {
    tools: ['Spanner and Allen key set', 'Drill for brackets where needed', 'Crimping tool', 'Multimeter or test lamp', 'Cable ties', 'Silicone sealant'],
    steps: [
      { en: 'Disconnect the battery negative.', hi: 'बैटरी का नेगेटिव हटाओ।' },
      { en: 'Fix the brackets to the roof mounts or the bumper beam and hang the bar loosely.', hi: 'ब्रैकेट छत के माउंट या बम्पर की बीम पर कसो और बार को ढीला टाँग दो।' },
      { en: 'Fit the relay harness supplied: fused red to battery positive, black to body earth.', hi: 'साथ आया रिले हार्नेस लगाओ: फ़्यूज़ वाली लाल वायर बैटरी के पॉज़िटिव पर, काली बॉडी अर्थ पर।' },
      { en: 'Route roof wiring down the windscreen pillar channel and seal the point where it enters the body.', hi: 'छत की वायर शीशे के पिलर की नाली से नीचे लाओ और जहाँ से बॉडी के अंदर जाती है वहाँ सील लगाओ।' },
      { en: 'Bring the switch wire through an existing firewall grommet and fix the switch on the dash.', hi: 'स्विच की वायर फ़ायरवॉल के पहले से बने ग्रोमेट से अंदर लो और स्विच डैशबोर्ड पर लगाओ।' },
      { en: 'Reconnect the battery, test, aim the bar level or slightly down and tighten the side bolts.', hi: 'बैटरी जोड़ो, टेस्ट करो, बार को सीधा या थोड़ा नीचे की तरफ़ सेट करो और साइड के बोल्ट कस दो।' },
      { en: 'Fit the cover. On public roads the bar stays off and covered.', hi: 'कवर चढ़ा दो। सड़क पर बार बंद और ढका ही रहेगा।' },
    ],
  },
  'recovery-gear': {
    tools: [],
    steps: [
      { en: 'Find the rated recovery points on both vehicles from the handbook. Tie-down loops and tow balls are not recovery points.', hi: 'दोनों गाड़ियों के रेटेड रिकवरी पॉइंट बुकलेट से पक्के करो। बाँधने वाले हुक और टो बॉल रिकवरी पॉइंट नहीं होते।' },
      { en: 'Connect the strap with the bow shackles. Screw each pin fully in, then back it off a quarter turn.', hi: 'स्ट्रैप को बो शैकल से जोड़ो। हर पिन पूरी कसो, फिर चौथाई चक्कर वापस ढीली करो।' },
      { en: 'Lay a damper, a heavy bag or a floor mat over the middle of the strap.', hi: 'स्ट्रैप के बीच में डैम्पर, भारी बैग या फ़ुट मैट डाल दो।' },
      { en: 'Clear everyone to at least one and a half strap lengths away, to the side.', hi: 'सब लोगों को स्ट्रैप की डेढ़ लंबाई जितना दूर, साइड में खड़ा करो।' },
      { en: 'Pull steadily in a straight line. Stop as soon as the stuck car is on firm ground.', hi: 'सीधी लाइन में, बिना झटके खींचो। फँसी गाड़ी पक्की ज़मीन पर आते ही रुक जाओ।' },
      { en: 'For traction boards: dig the mud or sand away in front of the driven wheels, wedge the boards under the tyres and drive out slowly.', hi: 'ट्रैक्शन बोर्ड के लिए चलने वाले पहियों के आगे से कीचड़ या रेत हटाओ, बोर्ड टायर के नीचे फँसाओ और धीरे-धीरे गाड़ी निकालो।' },
    ],
  },
  'jerry-cans-storage': {
    tools: ['Socket and spanner set', 'Drill where the bracket needs it', 'Thread lock', 'Rust primer'],
    steps: [
      { en: 'Pick a mounting point on the rack, the spare wheel carrier or the tailgate that can take the full weight: 20 litres of fuel is about 20 kg with the can.', hi: 'रैक, स्टेपनी कैरियर या टेलगेट पर ऐसी जगह चुनो जो पूरा वज़न उठा सके: 20 लीटर तेल कैन समेत लगभग 20 किलो होता है।' },
      { en: 'Bolt the holder or panel on with thread lock. Prime any hole you drill.', hi: 'होल्डर या पैनल थ्रेड लॉक के साथ कसो। जो भी होल ड्रिल करो उस पर प्राइमर लगाओ।' },
      { en: 'Keep the can away from the exhaust and from the tail lamps and number plate.', hi: 'कैन को साइलेंसर से दूर रखो, और ऐसे कि टेल लाइट और नंबर प्लेट न ढके।' },
      { en: 'Seat the can upright, close the strap or lock and shake it to check it cannot move.', hi: 'कैन सीधा बैठाओ, पट्टी या लॉक बंद करो और हिलाकर देखो कि खिसकता नहीं।' },
      { en: 'Check the cap gasket before every fill and never fill past the neck.', hi: 'हर बार भरने से पहले ढक्कन की गैस्केट देखो और गले से ऊपर कभी मत भरो।' },
    ],
  },
  'overland-camping': {
    tools: ['13 mm spanner', 'Allen key set', 'Step stool', 'Brackets from the box'],
    steps: [
      { en: 'Check the roof rack or cross bars are tight before adding anything to them.', hi: 'कुछ भी लगाने से पहले देखो कि रूफ़ रैक या क्रॉस बार कसे हुए हैं।' },
      { en: 'Bolt the L-brackets to the side of the rack on the kerb side of the car.', hi: 'L-ब्रैकेट रैक की उस साइड पर कसो जो फ़ुटपाथ की तरफ़ रहती है।' },
      { en: 'Lift the awning with a helper and bolt its rail to the brackets. Tighten the nuts fully.', hi: 'एक आदमी की मदद से ऑनिंग उठाओ और उसकी रेल ब्रैकेट पर कसो। नट पूरे कस दो।' },
      { en: 'Open it once: unzip the bag, roll it out, drop the legs and peg the guy ropes.', hi: 'एक बार खोलकर देखो: बैग की ज़िप खोलो, ऑनिंग फैलाओ, पैर नीचे करो और रस्सियाँ खूँटी से बाँधो।' },
      { en: 'Roll it up dry, strap it and zip the bag before the car moves. Take it down in strong wind.', hi: 'गाड़ी चलाने से पहले सूखी ऑनिंग लपेटो, पट्टी बाँधो और बैग की ज़िप बंद करो। तेज़ हवा में इसे समेट लो।' },
    ],
  },
  'side-steps-flares': {
    tools: ['Lift or axle stands', 'Socket set with extensions', 'Torque wrench', 'Trim clip pliers', 'Penetrating oil'],
    steps: [
      { en: 'Raise the car, or work with it on the ground if the chassis points can be reached.', hi: 'गाड़ी उठाओ, या चेसिस के पॉइंट तक हाथ पहुँचता हो तो ज़मीन पर ही काम करो।' },
      { en: 'Find the factory threaded points under the sill and remove their blanking plugs.', hi: 'सिल के नीचे कंपनी के चूड़ी वाले पॉइंट ढूँढो और उनके ढक्कन निकालो।' },
      { en: 'Bolt the brackets on loosely: they are marked front, middle and rear, left and right.', hi: 'ब्रैकेट ढीले कसो: उन पर आगे, बीच, पीछे और लेफ़्ट-राइट का निशान होता है।' },
      { en: 'Rest the step on the brackets, set an even gap to the body and tighten the step bolts, then the bracket bolts.', hi: 'स्टेप को ब्रैकेट पर रखो, बॉडी से गैप बराबर करो और पहले स्टेप के, फिर ब्रैकेट के बोल्ट कसो।' },
      { en: 'Stand on each end of the step to check it does not flex or creak.', hi: 'स्टेप के दोनों सिरों पर खड़े होकर देखो कि झुकता या चरमराता नहीं।' },
      { en: 'For fender flares: remove the factory flare clips and screws, fit the new flares on the same points and check the tyres clear them at full lock.', hi: 'फ़ेंडर फ़्लेयर के लिए कंपनी के फ़्लेयर के क्लिप और स्क्रू खोलो, नए उन्हीं पॉइंट पर लगाओ और स्टीयरिंग पूरा घुमाकर देखो कि टायर नहीं लग रहे।' },
    ],
  },

  // ---- Car Care & Utility --------------------------------------------------
  detailing: {
    tools: ['Two buckets', 'Wash mitt', 'Microfibre drying towel', 'Hose or pressure washer'],
    steps: [
      { en: 'Wash in shade on cool paint. Rinse the whole car first to float off loose grit.', hi: 'गाड़ी छाँव में धोओ, जब पेंट ठंडा हो। पहले पूरी गाड़ी पर पानी मारकर ढीली मिट्टी बहा दो।' },
      { en: 'Dilute the shampoo as the label says. Use one bucket for shampoo and one of plain water to rinse the mitt.', hi: 'शैम्पू लेबल के हिसाब से पानी में मिलाओ। एक बाल्टी शैम्पू की और एक सादे पानी की रखो, जिसमें मिट धोते रहो।' },
      { en: 'Wash from the roof down in straight lines, and do the wheels and lower panels last.', hi: 'छत से नीचे की तरफ़ सीधी लाइन में धोओ। पहिये और नीचे के पैनल सबसे आख़िर में।' },
      { en: 'Rinse before the foam dries and dry with a clean microfibre towel.', hi: 'झाग सूखने से पहले पानी से धो दो और साफ़ माइक्रोफ़ाइबर तौलिये से सुखाओ।' },
      { en: 'For a spray sealant: mist one panel at a time on clean, dry paint, spread with one cloth and buff with a second.', hi: 'स्प्रे सीलेंट हो तो साफ़, सूखे पेंट पर एक बार में एक पैनल पर हल्का स्प्रे करो, एक कपड़े से फैलाओ और दूसरे से चमकाओ।' },
    ],
  },
  'fluids-additives': {
    tools: [],
    steps: [
      { en: 'Check the bottle matches your fuel: this one is for petrol engines only.', hi: 'बोतल पर देखो कि आपके फ़्यूल के लिए है: यह सिर्फ़ पेट्रोल इंजन के लिए है।' },
      { en: 'Add it when the tank is nearly empty, just before filling up.', hi: 'इसे तब डालो जब टंकी लगभग खाली हो, तेल भरवाने से ठीक पहले।' },
      { en: 'Pour the full bottle into the fuel filler. Keep it off the paint and wipe any spill at once.', hi: 'पूरी बोतल टंकी के मुँह में डालो। पेंट पर न गिरे, गिर जाए तो तुरंत पोंछ दो।' },
      { en: 'Fill the tank with the amount of fuel on the label so it mixes at the right dose.', hi: 'लेबल पर लिखी मात्रा जितना तेल भरवाओ ताकि मिलावट सही अनुपात में हो।' },
      { en: 'Drive normally until the tank is low. Do not add a second bottle to the same tank.', hi: 'टंकी कम होने तक आम तरह से गाड़ी चलाओ। उसी टंकी में दूसरी बोतल मत डालना।' },
    ],
  },
  'emergency-gear': {
    tools: [],
    steps: [
      { en: 'Charge the jump starter fully when it arrives and top it up every three months.', hi: 'जम्प स्टार्टर आते ही पूरा चार्ज करो और हर तीन महीने में दोबारा चार्ज करते रहो।' },
      { en: 'To jump a car: switch everything off, clamp red to the battery positive, then black to the negative or a bare engine bolt.', hi: 'गाड़ी स्टार्ट करनी हो तो सब कुछ बंद करो, लाल क्लैंप बैटरी के पॉज़िटिव पर लगाओ, फिर काला नेगेटिव पर या इंजन के नंगे बोल्ट पर।' },
      { en: 'Wait for the ready light, then crank for no more than 5 seconds. Rest a minute between tries.', hi: 'रेडी लाइट आने दो, फिर 5 सेकंड से ज़्यादा सेल्फ़ मत मारो। दो कोशिशों के बीच एक मिनट रुको।' },
      { en: 'Once the engine runs, remove black first, then red. Never let the clamps touch each other.', hi: 'इंजन चालू होते ही पहले काला, फिर लाल क्लैंप हटाओ। क्लैंप आपस में कभी नहीं छूने चाहिए।' },
      { en: 'Keep the emergency kit where you can reach it with a full boot, and put the warning triangle 50 metres behind the car in a breakdown.', hi: 'इमरजेंसी किट ऐसी जगह रखो जहाँ भरी डिक्की में भी हाथ पहुँचे, और गाड़ी ख़राब होने पर वार्निंग ट्रायंगल 50 मीटर पीछे रखो।' },
    ],
  },
  'car-covers': {
    tools: [],
    steps: [
      { en: 'Put the cover only on a clean, dry, cool car. Dust under a cover scratches the paint.', hi: 'कवर सिर्फ़ साफ़, सूखी और ठंडी गाड़ी पर चढ़ाओ। कवर के नीचे की धूल पेंट पर खरोंच डालती है।' },
      { en: 'Fold the mirrors in and lower or unscrew the antenna if the cover has no pocket for it.', hi: 'मिरर फ़ोल्ड करो और कवर में एंटीना की जेब न हो तो एंटीना नीचे कर दो या खोल दो।' },
      { en: 'Find the tag marked FRONT, hook that end over the front bumper and unroll the cover to the rear.', hi: 'FRONT लिखा टैग ढूँढो, वह सिरा आगे के बम्पर पर फँसाओ और कवर पीछे की तरफ़ खोलते जाओ।' },
      { en: 'Fit the mirror pockets, pull the elastic hem under both bumpers and clip the belly straps under the car.', hi: 'मिरर की जेबें चढ़ाओ, इलास्टिक दोनों बम्पर के नीचे खींचो और नीचे की पट्टियाँ गाड़ी के नीचे से बाँध दो।' },
      { en: 'To remove, fold both sides onto the roof and roll from front to back so the dusty side stays inside.', hi: 'उतारते समय दोनों साइड छत पर मोड़ो और आगे से पीछे लपेटो ताकि धूल वाला हिस्सा अंदर रहे।' },
    ],
  },
  fragrances: {
    tools: [],
    steps: [
      { en: 'Open the perfume as the pack shows: twist the cap or remove the seal.', hi: 'पैक पर दिखाए तरीक़े से परफ़्यूम खोलो: ढक्कन घुमाओ या सील हटाओ।' },
      { en: 'Clip it onto a centre vent slat with the opening upright.', hi: 'इसे बीच वाले वेंट की पत्ती पर क्लिप करो, मुँह ऊपर की तरफ़ रहे।' },
      { en: 'Start on the lowest setting. Turn it up only if you cannot smell it after a day.', hi: 'सबसे कम सेटिंग से शुरू करो। एक दिन बाद भी ख़ुशबू न आए, तभी बढ़ाओ।' },
      { en: 'Keep the liquid off the dashboard and trim: perfume oil marks plastic. Wipe any drip at once.', hi: 'लिक्विड डैशबोर्ड और ट्रिम पर न गिरे: परफ़्यूम का तेल प्लास्टिक पर दाग छोड़ता है। टपक जाए तो तुरंत पोंछ दो।' },
    ],
  },
  'cleaning-tools': {
    tools: [],
    steps: [
      { en: 'Charge the vacuum fully before first use.', hi: 'पहली बार चलाने से पहले वैक्यूम पूरा चार्ज करो।' },
      { en: 'Fit the nozzle for the job: the crevice tool for seat gaps, the brush for vents and mats.', hi: 'काम के हिसाब से नोज़ल लगाओ: सीट के गैप के लिए पतला नोज़ल, वेंट और मैट के लिए ब्रश।' },
      { en: 'Take the mats out and vacuum them first, then the seats, then the floor.', hi: 'मैट बाहर निकालकर पहले उन्हें साफ़ करो, फिर सीटें, फिर फ़र्श।' },
      { en: 'Empty the dust cup when it is half full and tap the filter clean.', hi: 'डस्ट कप आधा भरते ही ख़ाली करो और फ़िल्टर झाड़कर साफ़ करो।' },
      { en: 'Wash the filter in plain water once a month and let it dry fully before refitting. Do not vacuum liquids.', hi: 'फ़िल्टर महीने में एक बार सादे पानी से धोओ और पूरा सूखने के बाद ही लगाओ। इससे पानी या कोई लिक्विड मत खींचना।' },
    ],
  },

  // ---- Addon Merchandise: care only ---------------------------------------
  'hoodies-jackets': {
    tools: [],
    steps: [
      { en: 'Machine wash cold, inside out, with dark colours. Do not tumble dry, and do not iron over the print.', hi: 'ठंडे पानी में, उल्टा करके, गहरे रंग के कपड़ों के साथ मशीन में धोओ। ड्रायर में मत सुखाना और प्रिंट पर प्रेस मत करना।' },
    ],
  },
  'tees-caps': {
    tools: [],
    steps: [
      { en: 'Machine wash the tee cold, inside out, and do not iron over the print. Wipe the cap with a damp cloth: do not machine wash it.', hi: 'टी-शर्ट ठंडे पानी में उल्टी करके मशीन में धोओ और प्रिंट पर प्रेस मत करो। कैप को गीले कपड़े से पोंछो, मशीन में मत धोना।' },
    ],
  },
  'key-chains': {
    tools: [],
    steps: [
      { en: 'Wipe with a dry cloth. Keep it away from water and perfume so the plating lasts.', hi: 'सूखे कपड़े से पोंछो। पानी और परफ़्यूम से दूर रखो ताकि पॉलिश बनी रहे।' },
    ],
  },
  bags: {
    tools: [],
    steps: [
      { en: 'Wipe with a damp cloth and mild soap, and dry in shade with the zips open. Do not machine wash.', hi: 'गीले कपड़े और हल्के साबुन से पोंछो और ज़िप खोलकर छाँव में सुखाओ। मशीन में मत धोना।' },
    ],
  },
  'garage-decor': {
    tools: [],
    steps: [
      { en: 'Hang it away from direct sun and damp walls. Dust the acrylic front with a soft dry cloth, never with glass cleaner.', hi: 'इसे सीधी धूप और सीलन वाली दीवार से दूर टाँगो। आगे की एक्रिलिक शीट नरम सूखे कपड़े से साफ़ करो, ग्लास क्लीनर से कभी नहीं।' },
    ],
  },
};
