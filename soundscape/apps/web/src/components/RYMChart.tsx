import { Component, createSignal, For, Show } from 'solid-js';

// RYM genres list
const RYM_GENRES = [
  '16-bit', '2 Tone', '2-Step', 'Aak', 'Abstract Hip Hop', 'Acid Breaks', 'Acid House', 
  'Acid Jazz', 'Acid Rock', 'Acid Techno', 'Acid Trance', 'Acidcore', 'Acousmatic Music',
  'Acoustic Blues', 'Acoustic Rock', 'Adult Contemporary', 'Afoxé', 'Afro House', 'Afro Trap',
  'Afro-Cuban Jazz', 'Afro-Funk', 'Afro-Jazz', 'Afro-Rock', 'Afrobeat', 'Afrobeats',
  'Afropiano', 'Afroswing', 'Aggrotech', 'Ainu Music', 'Albanian Folk Music', 'Alpenrock',
  'Alpine Folk Music', 'Alt-Country', 'Alt-Pop', 'Alternative Dance', 'Alternative Idol',
  'Alternative Metal', 'Alternative R&B', 'Alternative Rock', 'Amapiano', 'Ambient',
  'Ambient Dub', 'Ambient House', 'Ambient Pop', 'Ambient Techno', 'Ambient Trance',
  'American Folk Music', 'American Primitivism', 'Americana', 'Amigacore', 'Anarcho-Punk',
  'Anatolian Rock', 'Andalusian Classical Music', 'Animal Sounds', 'Anti-Folk', 'AOR',
  'Apala', 'Appalachian Folk Music', 'Aquacrunk', 'Arabesk', 'Arabic Bellydance Music',
  'Arabic Classical Music', 'Arabic Folk Music', 'Arabic Jazz', 'Arabic Pop', 'Arrocha',
  'Art Pop', 'Art Punk', 'Art Rock', 'Art Song', 'Artcore', 'Asian Rock', 'ASMR',
  'Atmospheric Black Metal', 'Atmospheric Drum and Bass', 'Atmospheric Sludge Metal',
  'Australian Folk Music', 'Avant-Folk', 'Avant-Garde Jazz', 'Avant-Garde Metal', 'Avant-Prog',
  'Axé', 'Azerbaijani Mugham', 'Bachata', 'Bachatón', 'Baggy', 'Baião', 'Balearic Beat',
  'Balkan Brass Band', 'Balkan Folk Music', 'Balkan Pop-Folk', 'Ballet', 'Ballroom',
  'Baltimore Club', 'Banda Music', 'Barber Beats', 'Barbershop', 'Bard Rock', 'Bardcore',
  'Baroque Music', 'Baroque Pop', 'Bashment Soca', 'Bass House', 'Bassline', 'Batucada',
  'Beach Music', 'Beat', 'Beat Poetry', 'Beatboxing', 'Beatdown Hardcore', 'Bebop',
  'Bedroom Pop', 'Benga', 'Bengali Folk Music', 'Big Band', 'Big Beat', 'Big Room House',
  'Big Room Trance', 'Biguine', 'Bikutsi', 'Binaural Beats', 'Birmingham Sound', 'Bit Music',
  'Bitpop', 'Black Metal', 'Black MIDI', 'Black Noise', 'Blackened Crust', 'Blackgaze',
  'Bleep Techno', 'Blue-Eyed Soul', 'Bluegrass', 'Bluegrass Gospel', 'Blues', 'Blues Rock',
  'Bolero', 'Bomba', 'Bongo Flava', 'Boogaloo', 'Boogie', 'Boogie Rock', 'Boogie Woogie',
  'Boom Bap', 'Bop', 'Bossa nova', 'Bounce', 'Bounce Beat', 'Bouncy Techno', 'Bouyon',
  'Boy Band', 'Brazilian Bass', 'Brazilian Phonk', 'Break-In', 'Breakbeat', 'Breakbeat Hardcore',
  'Breakcore', 'Brega', 'Brega funk', 'Brill Building', 'Britcore', 'Britfunk', 'British Blues',
  'British Brass Band', 'British Dance Band', 'Britpop', 'Bro-Country', 'Broken Beat',
  'Brostep', 'Brutal Death Metal', 'Brutal Prog', 'Bubblegum', 'Bubblegum Bass', 'Bubblegum Dance',
  'Buddhist Music', 'Buganda Royal Court Music', 'Bulgarian Folk Music', 'Burger-Highlife',
  'Burning Spirits', 'Byzantine Chant', 'C-Pop', 'C86', 'Cabaret', 'Cajun Music', 'Cakewalk',
  'Calypso', 'Candombe', 'Canterbury Scene', 'Cantonese Opera', 'Cantopop', 'Cape Breton Fiddling',
  'Cape Jazz', 'Cape Verdean Music', 'Capoeira Music', 'Carimbó', 'Carnatic Classical Music',
  'Carnavalito', 'Cascadian Black Metal', 'Catalan Folk Music', 'CCM', 'Celtic Chant',
  'Celtic Electronica', 'Celtic Folk Music', 'Celtic Metal', 'Celtic New Age', 'Celtic Punk',
  'Celtic Rock', 'Central Asian Throat Singing', 'Chacarera', 'Chachachá', 'Chalga', 'Chamamé',
  'Chamber Folk', 'Chamber Jazz', 'Chamber Music', 'Chamber Pop', 'Champeta', 'Chanson',
  'Chanson québécoise', 'Chap Hop', 'Character Piece', 'Chechen Folk Music', 'Chicago Blues',
  'Chicago Drill', 'Chicago Hard House', 'Chicago House', 'Chicago Soul', 'Chicano Rap',
  'Chilean Music', 'Chillout', 'Chillstep', 'Chillsynth', 'Chillwave', 'Chimurenga',
  'Chinese Classical Music', 'Chinese Folk Music', 'Chinese Opera', 'Chipmunk Soul', 'Chiptune',
  'Choral', 'Choro', 'Christian Hip Hop', 'Christian Rock', 'Chutn ey', 'Chutney Soca',
  'Cinematic Classical', 'Circus March', 'City Pop', 'Classical Crossover', 'Classical Music',
  'Classical Period', 'Close Harmony', 'Cloud Rap', 'Coldwave', 'Colour Bass', 'Comedy',
  'Comedy Rap', 'Comedy Rock', 'Comfy Synth', 'Compas', 'Complextro', 'Concert Band', 'Concerto',
  'Conscious Hip Hop', 'Contemporary Country', 'Contemporary R&B', 'Cool Jazz', 'Copla',
  'Corrido', 'Corrido tumbado', 'Country', 'Country Blues', 'Country Gospel', 'Country Pop',
  'Country Rap', 'Country Rock', 'Country Soul', 'Countrypolitan', 'Cowpunk', 'Crack Rock Steady',
  'Cretan Folk Music', 'Crime Jazz', 'Croatian Folk Music', 'Crossbreed', 'Crossover Thrash',
  'Crunk', 'Crunkcore', 'Crust Punk', 'Csárdás', 'Cuarteto', 'Cuban Music', 'Cueca', 'Cumbia',
  'Cumbia villera', 'Cyber Metal', 'Cybergrind', 'Czech Folk Music', 'D-Beat', 'Dabke',
  'Dance', 'Dance-Pop', 'Dance-Punk', 'Dancefloor Drum and Bass', 'Dancehall', 'Dangdut',
  'Danish Folk Music', 'Dansbandsmusik', 'Danzón', 'Dariacore', 'Dark Ambient', 'Dark Cabaret',
  'Dark Electro', 'Dark Folk', 'Dark Jazz', 'Dark Plugg', 'Dark Psytrance', 'Darkcore',
  'Darkside', 'Darkstep', 'Darksynth', 'Darkwave', 'Data Sonification', 'Death Metal',
  'Deathcore', 'Deathgrind', 'Deathrock', 'Deathstep', 'Dechovka', 'Deconstructed Club',
  'Deep Funk', 'Deep House', 'Deep Soul', 'Deep Tech', 'Delta Blues', 'Dembow', 'Denpa',
  'Descarga', 'Desert Rock', 'Detroit Techno', 'Detroit Trap', 'Deutschpunk', 'Deutschrock',
  'Dhrupad', 'Digicore', 'Digital Cumbia', 'Digital Dancehall', 'Digital Hardcore', 'Dimotika',
  'Dirty South', 'Disco', 'Disco polo', 'Disco Rap', 'Dissonant Black Metal', 'Dissonant Death Metal',
  'Diva House', 'Dixieland', 'Djent', 'Dolewave', 'Doom Metal', 'Doomcore', 'Doomgaze',
  'Doo-Wop', 'Doujin Music', 'Downtempo', 'Downtempo Deathcore', 'Dream Pop', 'Dream Trance',
  'Dreampunk', 'Drift Phonk', 'Drill', 'Drill and Bass', 'Drone', 'Drone Metal', 'Drum and Bass',
  'Drum and Bugle Corps', 'Drumfunk', 'Drumstep', 'DSBM', 'Dub', 'Dub Poetry', 'Dub Techno',
  'Dubstep', 'Dubstyle', 'Dunedin Sound', 'Dungeon Rap', 'Dungeon Synth', 'Duranguense',
  'Dutch Cabaret', 'Dutch Folk Music', 'Dutch House', 'EAI', 'East Coast Hip Hop', 'Easy Listening',
  'Easycore', 'EBM', 'Eccojams', 'ECM Style Jazz', 'Egg Punk', 'Electric Blues', 'Electro',
  'Electro House', 'Electro Swing', 'Electro-Disco', 'Electro-Industrial', 'Electroacoustic',
  'Electroclash', 'Electronic', 'Electronic Dance Music', 'Electronicore', 'Electropop',
  'Electrotango', 'Eletrofunk', 'Emo', 'Emo Rap', 'Emo Revival', 'Emo-Pop', 'Emocore',
  'Emoviolence', 'English Folk Music', 'Enka', 'Epic Doom Metal', 'Epic Music', 'Estonian Folk Music',
  'Ethereal Wave', 'Ethio-Jazz', 'Ethiopian Church Music', 'Euro House', 'Euro-Disco', 'Euro-Trance',
  'Eurobeat', 'Eurodance', 'European Folk Music', 'European Free Jazz', 'Europop', 'Exotica',
  'Experimental', 'Experimental Big Band', 'Experimental Hip Hop', 'Experimental Rock', 'Expressionism',
  'Extratone', 'Fado', 'Fairy Tales', 'Famo', 'Fanfare', 'Fantasia', 'Faroese Folk Music',
  'Festejo', 'Festival Progressive House', 'Festival Trap', 'Fidget House', 'Field Recordings',
  'Fijian Music', 'Filk', 'Filmi', 'Finnish Folk Music', 'Finnish Tango', 'Flamenco',
  'Flamenco Jazz', 'Flamenco Pop', 'Flashcore', 'Flex Dance Music', 'Florida Breaks', 'FM Synthesis',
  'Folk', 'Folk Baroque', 'Folk Metal', 'Folk Pop', 'Folk Punk', 'Folk Rock', 'Folklor miejski',
  'Folktronica', 'Footwork', 'Forró', 'Frat Rock', 'Freak Folk', 'Freakbeat', 'Free Folk',
  'Free Improvisation', 'Free Jazz', 'Freeform Hardcore', 'Freestyle', 'Freetekno', 'French Electro',
  'French Folk Music', 'French Hip Hop', 'French House', 'French Pop', 'Frenchcore', 'Frevo',
  'Fugue', 'Fuji', 'Funaná', 'Funeral Doom Metal', 'Funeral March', 'Funk', 'Funk brasileiro',
  'Funk carioca', 'Funk Metal', 'Funk Rock', 'Funkot', 'Funktronica', 'Funky Breaks', 'Funky House',
  'Future Bass', 'Future Bounce', 'Future Core', 'Future Funk', 'Future Garage', 'Future House',
  'Future Rave', 'Future Riddim', 'Futurepop', 'Futurism', 'Futuristic Swag', 'G-Funk', 'G-House',
  'Gabber', 'Gagaku', 'Gaita zuliana', 'Galician Folk Music', 'Gamelan', 'Gangsta Rap',
  'Garage House', 'Garage Punk', 'Garage Rock', 'Garage Rock Revival', 'Garba', 'Gascon Folk Music',
  'Geek Rock', 'Genge', 'Georgian Folk Music', 'German Folk Music', 'Ghazal', 'Ghetto Funk',
  'Ghetto House', 'Ghettotech', 'Glam Metal', 'Glam Punk', 'Glam Rock', 'Glitch', 'Glitch Hop',
  'Glitch Pop', 'Gnawa', 'Go-Go', 'Goa Trance', 'Goregrind', 'Gorenoise', 'Gospel', 'Gospel House',
  'Gothic Country', 'Gothic Metal', 'Gothic Rock', 'Gqom', 'Graphical Sound', 'Grebo',
  'Greek Folk Music', 'Gregorian Chant', 'Grime', 'Grindcore', 'Groove Metal', 'Group Sounds',
  'Grunge', 'Guaracha', 'Guarania', 'Gufeng', 'Guided Meditation', 'Gumbe', 'Gypsy Punk',
  'Habanera', 'Haitian Music', 'Halftime', 'Hamburger Schule', 'Han Folk Music', 'Hands Up',
  'Happy Hardcore', 'Hard Bop', 'Hard Dance', 'Hard Rock', 'Hard Techno', 'Hard Trance',
  'Hard Trap', 'Hardbag', 'Hardbass', 'Hardcore [EDM]', 'Hardcore [Punk]', 'Hardcore Breaks',
  'Hardcore Hip Hop', 'Hardcore Punk', 'Hardgroove Techno', 'Hardstep', 'Hardstyle', 'Hardtek',
  'Hardvapour', 'Hardwave', 'Harsh Noise', 'Harsh Noise Wall', 'Hauntology', 'Hawaiian Music',
  'Heartland Rock', 'Heavy Metal', 'Heavy Psych', 'Hi-NRG', 'Hi-Tech Psytrance', 'Highlife',
  'Hill Country Blues', 'Hindustani Classical Music', 'Hip Hop', 'Hip Hop Soul', 'Hip House',
  'Hipco', 'Hiplife', 'Hispanic American Folk Music', 'Honky Tonk', 'Horror Punk', 'Horror Synth',
  'Horrorcore', 'House', 'Huayno', 'Humppa', 'Hungarian Folk Music', 'Hybrid Trap', 'Hyper Techno',
  'Hyperpop', 'Hyphy', 'Hypnagogic Pop', 'Icelandic Folk Music', 'IDM', 'Igbo Music', 'Illbient',
  'Impressionism', 'Impromptu', 'Indeterminacy', 'Indian Pop', 'Indie Folk', 'Indie Pop',
  'Indie Rock', 'Indie Surf', 'Indietronica', 'Indigenous American Music', 'Indo Jazz',
  'Indonesian Music', 'Indorock', 'Industrial', 'Industrial & Noise', 'Industrial Hardcore',
  'Industrial Hip Hop', 'Industrial Metal', 'Industrial Rock', 'Industrial Techno', 'Insect Sounds',
  'Instrumental Hip Hop', 'Integral Serialism', 'Inuit Music', 'Irish Folk Music', 'Isicathamiya',
  'Islamic Religious Music & Recitation', 'Italian Folk Music', 'Italo Dance', 'Italo House',
  'Italo Pop', 'Italo-Disco', 'J-core', 'J-Pop', 'Jackin\' House', 'Jam Band', 'Jamaican Music',
  'Jamaican Ska', 'Jamgrass', 'Jangle Pop', 'Japanese Classical Music', 'Japanese Folk Music',
  'Japanese Hardcore', 'Japanese Hip Hop', 'Japanese Idol', 'Japanese Music', 'Javanese Music',
  'Jazz', 'Jazz Fusion', 'Jazz manouche', 'Jazz Poetry', 'Jazz Pop', 'Jazz Rap', 'Jazz-Funk',
  'Jazz-Rock', 'Jazzstep', 'Jerk', 'Jerk Rap', 'Jersey Club', 'Jersey Club Rap', 'Jersey Drill',
  'Jewish Music', 'Jit', 'Joik', 'Jongo', 'Joropo', 'Jùjú', 'Juke', 'Jump Blues', 'Jump-Up',
  'Jumpstyle', 'Jungle', 'Jungle Dutch', 'Jungle Terror', 'Junkanoo', 'K-Pop', 'Kabarett',
  'Kagura', 'Kalindula', 'Kaneka', 'Kanto', 'Kaseko', 'Kawaii Future Bass', 'Kawaii Metal',
  'Kayōkyoku', 'Kazakh Music', 'Keroncong', 'Khaliji Music', 'Khayal', 'Khmer Music', 'Kidandali',
  'Kirtan', 'Kizomba', 'Klapa', 'Klezmer', 'Korean Classical Music', 'Korean Folk Music',
  'Krautrock', 'Kuduro', 'Kwaito', 'Kwassa kwassa', 'Kwela', 'Lab Polyphony', 'Ladino Folksong',
  'Laika', 'Lambada', 'Ländler', 'Lao Folk Music', 'Latin Alternative', 'Latin American Classical Music',
  'Latin Disco', 'Latin Electronic', 'Latin Freestyle', 'Latin Funk', 'Latin House', 'Latin Jazz',
  'Latin Pop', 'Latin Rap', 'Latin Rock', 'Latin Soul', 'Latvian Folk Music', 'Levenslied',
  'Lied', 'Light Music', 'Liquid Drum and Bass', 'Lithuanian Folk Music', 'Livetronica',
  'Lo-Fi Hip Hop', 'Lo-Fi House', 'Lounge', 'Lovers Rock', 'Lowend', 'Lowercase', 'Luk thung',
  'Lundu', 'Macedonian Folk Music', 'Madchester', 'Madrigal', 'Maghrebi Music', 'Mahraganat',
  'Makina', 'Makossa', 'Malagasy Music', 'Malay Music', 'Mallsoft', 'Maloya', 'Mambo',
  'Mandopop', 'Manele', 'Manguebeat', 'Manila Sound', 'Mantra', 'Māori Music', 'Maqāmic Music',
  'Marabi', 'Maracatu', 'March', 'Marching Band', 'Mariachi', 'Marinera', 'Marrabenta',
  'Martial Industrial', 'Mashcore', 'Mashup', 'Maskandi', 'Mass', 'Math Pop', 'Math Rock',
  'Mathcore', 'Maxixe', 'Mazurka', 'Mbalax', 'Mbaqanga', 'Mbube', 'Mechanical Music',
  'Medieval Classical Music', 'Mega funk', 'Melodic Black Metal', 'Melodic Death Metal',
  'Melodic Dubstep', 'Melodic Hardcore', 'Melodic House', 'Melodic Metalcore', 'Melodic Techno',
  'Memphis Rap', 'Mento', 'Merengue', 'Merengue típico', 'Merenhouse', 'Merseybeat',
  'Mesoamerican Music', 'Mesopotamian Music', 'Metal', 'Metalcore', 'Mexican Folk Music',
  'Mexican Music', 'Miami Bass', 'Microhouse', 'Micronesian Music', 'Microtonal Classical',
  'Mid-School Hip Hop', 'MIDI Music', 'Midtempo Bass', 'Midwest Emo', 'Milonga', 'Min\'yō',
  'Minimal Drum and Bass', 'Minimal Synth', 'Minimal Techno', 'Minimal Wave', 'Minimalism',
  'Minneapolis Sound', 'Minstrelsy', 'Mittelalter-Metal', 'Mittelalter-Rock', 'Młoda Polska',
  'Mobb Music', 'Mod', 'Mod Revival', 'Modal Jazz', 'Modern Classical', 'Modern Creative',
  'Moldavan Music', 'Molam', 'Mongolian Music', 'Mongolian Throat Singing', 'Mono', 'Montenegrin Folk Music',
  'Mood kayō', 'Moogsploitation', 'Moombahcore', 'Moombahton', 'Moravian Folk Music', 'Morenada',
  'Morna', 'Moroccan Chaabi', 'Motet', 'Motown Sound', 'MPB', 'Murga', 'Musette', 'Music Hall',
  'Música criolla peruana', 'Música llanera', 'Musical Theatre and Entertainment', 'Musique concrète',
  'Mutant Disco', 'Muzika mizrahit', 'Nagauta', 'Nasheed', 'Nashville Sound', 'Native American New Age',
  'Nature Recordings', 'Nederbeat', 'Nederpop', 'Neo-Acoustic', 'Neo-Prog', 'Neo-Psychedelia',
  'Neo-Soul', 'Neo-Traditionalist Country', 'Neoclassical Darkwave', 'Neoclassical Metal',
  'Neoclassical New Age', 'Neoclassicism', 'Neofolk', 'Nerdcore Hip Hop', 'Neue Deutsche Härte',
  'Neue Deutsche Welle', 'Neue Volksmusik', 'Neurofunk', 'Neurohop', 'New Age', 'New Beat',
  'New Jack Swing', 'New Jazz', 'New Orleans Blues', 'New Orleans Brass Band', 'New Orleans R&B',
  'New Rave', 'New Romantic', 'New Wave', 'New Weird America', 'New York Drill', 'New York Hardcore',
  'Newfoundland Folk Music', 'Ngoma', 'Nhạc vàng', 'Nightcore', 'Nintendocore', 'No Wave',
  'Nocturne', 'Noh', 'Noise', 'Noise Pop', 'Noise Rock', 'Noisecore', 'Noisegrind', 'NOLA Sludge',
  'Nordic Folk Music', 'Nordic Folk Rock', 'Nortec', 'Norteño', 'Northern Soul', 'Norwegian Folk Music',
  'Nouveau zydeco', 'Nouvelle chanson française', 'Nova cançó', 'Nova vanguarda paulistana',
  'Novaya scena', 'Novelty Piano', 'Novo Dub', 'NRG', 'Nu Jazz', 'Nu Metal', 'Nu Skool Breaks',
  'Nu-Disco', 'Nubian Music', 'Nueva canción', 'Nueva canción chilena', 'Nueva ola', 'Nueva trova',
  'Nuevo Cancionero', 'NWOBHM', 'Nyahbinghi', 'Oberek', 'Occitan Folk Music', 'Odia Folk Music',
  'Oi!', 'Okinawan Music', 'Old-Time', 'Opera', 'Operetta', 'OPM', 'Oratorio', 'Orchestral Music',
  'Organic House', 'Oromo Music', 'Orthodox Pop', 'Ottoman Military Music', 'Outlaw Country',
  'Outsider House', 'Overture', 'Özgün Müzik', 'P-Funk', 'Pachanga', 'Pacific Reggae',
  'Pagan Black Metal', 'Pagode', 'Paisley Underground', 'Palm Wine Music', 'Pansori', 'Parang',
  'Parlour Music', 'Pasillo', 'Pasodoble', 'Peak Time Techno', 'Peking Opera', 'Persian Classical Music',
  'Persian Folk Music', 'Persian Pop', 'Peruvian Music', 'Philippine Music', 'Philly Soul',
  'Phonk', 'Phonk House', 'Piano Blues', 'Piano Rock', 'Piedmont Blues', 'Pimba', 'Piseiro',
  'Pizzica', 'Plainsong', 'Plena', 'Plugg', 'PluggnB', 'Plunderphonics', 'Poetry', 'Polish Folk Music',
  'Polish Music', 'Political Hip Hop', 'Polka', 'Polonaise', 'Polska', 'Polynesian Music',
  'Polyphonic Chant', 'Pop', 'Pop Punk', 'Pop Raï', 'Pop Rap', 'Pop Reggae', 'Pop Rock',
  'Pop Soul', 'Pops Orchestra', 'Porn Groove', 'Pornogrind', 'Porro', 'Portuguese Folk Music',
  'Portuguese Music', 'Post-Bop', 'Post-Britpop', 'Post-Dubstep', 'Post-Grunge', 'Post-Hardcore',
  'Post-Industrial', 'Post-Metal', 'Post-Minimalism', 'Post-Punk', 'Post-Punk Revival', 'Post-Rock',
  'Power Electronics', 'Power Metal', 'Power Noise', 'Power Pop', 'Power Soca', 'Powerviolence',
  'Powwow Music', 'Praise & Worship', 'Prank Calls', 'Prehistoric Music', 'Prelude',
  'Progressive Big Band', 'Progressive Bluegrass', 'Progressive Breaks', 'Progressive Country',
  'Progressive Electronic', 'Progressive Folk', 'Progressive House', 'Progressive Metal',
  'Progressive Pop', 'Progressive Psytrance', 'Progressive Rock', 'Progressive Soul', 'Progressive Trance',
  'Proto-Punk', 'Psybient', 'Psybreaks', 'Psychedelia', 'Psychedelic Folk', 'Psychedelic Pop',
  'Psychedelic Rock', 'Psychedelic Soul', 'Psychobilly', 'Psytrance', 'Pub Rock', 'Punjabi Folk Music',
  'Punk', 'Punk Blues', 'Punk Rock', 'Punta', 'Purple Sound', 'Q-Pop', 'Qawwali', 'Queercore',
  'R&B', 'RABM', 'Radio Drama', 'Raga Rock', 'Ragga', 'Ragga Jungle', 'Raggacore', 'Raggatek',
  'Ragtime', 'Raï', 'Rajasthani Folk Music', 'Ranchera', 'Rap Metal', 'Rap Rock', 'Rara',
  'Rare Phonk', 'Rasin', 'Ratchet Music', 'Rautalanka', 'Rawphoric', 'Rawstyle', 'Red Dirt',
  'Reductionism', 'Reggae', 'Reggae Rock', 'Reggaetón', 'Regional Music', 'Rembetika',
  'Renaissance Music', 'Requiem', 'Revue', 'Rhythm & Blues', 'Riddim', 'Ring Shout', 'Riot Grrrl',
  'Ripsaw', 'Ritual Ambient', 'RKT', 'Rock', 'Rock & Roll', 'Rock andaluz', 'Rock andino',
  'Rock in Opposition', 'Rock Musical', 'Rock Opera', 'Rock urbano español', 'Rockabilly',
  'Rocksteady', 'Romani Folk Music', 'Romanian Folk Music', 'Romanticism', 'Rominimal',
  'Roots Reggae', 'Roots Rock', 'Rumba flamenca', 'Rune Singing', 'Russian Chanson',
  'Russian Folk Music', 'Russian Music', 'Russian Romance', 'Ryūkōka', 'Sacred Harp Singing',
  'Sacred Steel', 'Salegy', 'Salsa', 'Salsa dura', 'Salsa romántica', 'Samba', 'Samba Soul',
  'Samba-jazz', 'Samba-rock', 'Sambalanço', 'Sample Drill', 'Sardana', 'Sardinian Folk Music',
  'Sass', 'Saya', 'Scam Rap', 'Scenes & Movements', 'Schlager', 'Schranz', 'Scottish Folk Music',
  'Scouse House', 'Screamo', 'Scrumpy and Western', 'Sea Shanty', 'Sean-nós', 'Séga', 'Seggae',
  'Semba', 'Semi-Trot', 'Sephardic Music', 'Serbian Folk Music', 'Serenade', 'Serialism',
  'Sermons', 'Sertanejo', 'Sertanejo romântico', 'Sertanejo universitário', 'Sevdalinka',
  'Sevillanas', 'Sexy Drill', 'Shaabi', 'Shaker Music', 'Shangaan Electro', 'Shetland & Orkney Folk Music',
  'Shibuya-kei', 'Shidaiqu', 'Shilluk Music', 'Shimokita-kei', 'Shitgaze', 'Shoegaze', 'Show Tunes',
  'Sierreño', 'Singer-Songwriter', 'Singeli', 'Singspiel', 'Ska', 'Ska Punk', 'Skacore',
  'Skate Punk', 'Sketch Comedy', 'Skiffle', 'Skullstep', 'Skweee', 'Slack-Key Guitar',
  'Slacker Rock', 'Slam Death Metal', 'Slam Poetry', 'Slap House', 'Slavic Folk Music',
  'Sleaze Rock', 'Slovak Folk Music', 'Slovenian Folk Music', 'Slowcore', 'Sludge Metal',
  'Slushwave', 'Smooth Jazz', 'Smooth Soul', 'Snap', 'Soca', 'Soft Rock', 'Somali Music',
  'Son cubano', 'Son jarocho', 'Sonata', 'Songo', 'Sophisti-Pop', 'Soukous', 'Soul', 'Soul Blues',
  'Soul Jazz', 'Sound Art', 'Sound Collage', 'Sound Effects', 'Sound Poetry', 'South Asian Classical Music',
  'South Asian Folk Music', 'Southeast Asian Classical Music', 'Southeast Asian Folk Music',
  'Southern African Folk Music', 'Southern Gospel', 'Southern Hip Hop', 'Southern Metal',
  'Southern Rock', 'Southern Soul', 'Soviet Estrada', 'Space Age Pop', 'Space Ambient', 'Space Disco',
  'Space Rock', 'Space Rock Revival', 'Spacesynth', 'Spaghetti Western', 'Spanish Classical Music',
  'Spanish Folk Music', 'Spectralism', 'Speeches', 'Speed Garage', 'Speed House', 'Speed Metal',
  'Speedcore', 'Spiritual Jazz', 'Spirituals', 'Splittercore', 'Spoken Word', 'Spouge', 'Spy Music',
  'Staïfi', 'Stand-Up Comedy', 'Standards', 'Steel Band', 'Stenchcore', 'Stereo', 'Stomp and Holler',
  'Stoner Metal', 'Stoner Rock', 'Straight Edge', 'Street Punk', 'Stride', 'Stutter House',
  'Sufi Music', 'Sufi Rock', 'Sungura', 'Sunshine Pop', 'Suomisaundi', 'Surf Music', 'Surf Punk',
  'Surf Rock', 'Swamp Blues', 'Swamp Pop', 'Swamp Rock', 'Swancore', 'Swedish Folk Music',
  'Swing', 'Swing musette', 'Swing Revival', 'Symphonic Black Metal', 'Symphonic Metal',
  'Symphonic Prog', 'Symphonic Rock', 'Symphony', 'Synth Funk', 'Synth Punk', 'Synthpop',
  'Synthwave', 'Taarab', 'Tahitian Music', 'Taiko', 'Tajik Music', 'Talking Blues', 'Tallava',
  'Tamil Folk Music', 'Tango', 'Tango nuevo', 'Tape Music', 'Tarantella', 'Tech House',
  'Tech Trance', 'Technical Death Metal', 'Technical Thrash Metal', 'Techno', 'Techno kayō',
  'Techstep', 'Tecnobrega', 'Tecnobanda', 'Teen Pop', 'Tejano Music', 'Tembang Sunda Cianjuran',
  'Terrorcore', 'Tex-Mex', 'Thai Classical Music', 'Thai Folk Music', 'Theme and Variation',
  'Third Stream', 'Third Wave Ska', 'Thrash Metal', 'Thrashcore', 'Thumri', 'Tibetan Buddhist Chant',
  'Tibetan Music', 'Timba', 'Tin Pan Alley', 'Tishoumaren', 'Toccata', 'Tonada chilena',
  'Tone Poem', 'Township Bubblegum', 'Township Jive', 'Tracker Music', 'Traditional Black Gospel',
  'Traditional Bluegrass', 'Traditional Country', 'Traditional Doom Metal', 'Traditional Folk Music',
  'Traditional Pop', 'Trance', 'Trance Metal', 'Trancestep', 'Trap', 'Trap [EDM]', 'Trap Metal',
  'Trap Soul', 'Tribal Ambient', 'Tribal House', 'Trip Hop', 'Tropical House', 'Tropical Rock',
  'Tropicália', 'Tropipop', 'Trot', 'Trova', 'Truck Driving Country', 'Tsapiky', 'Tsonga Disco',
  'Tuareg Music', 'Tumba francesa', 'Turbo-Folk', 'Turkish Classical Music', 'Turkish Folk Music',
  'Turkish Pop', 'Turkmen Music', 'Turntablism', 'Twa Music', 'Twee Pop', 'Twelve Muqam',
  'Twerk', 'Twist', 'UK Bass', 'UK Drill', 'UK Funky', 'UK Garage', 'UK Hard House', 'UK Hardcore',
  'UK Hip Hop', 'UK82', 'Ukrainian Folk Music', 'Uplifting Trance', 'Uptempo Hardcore',
  'Urban Contemporary Gospel', 'Urban Cowboy', 'Urban Grooves', 'Utopian Virtual', 'Uyghur Music',
  'Uzbek Music', 'V-Pop', 'Vallenato', 'Vals criollo', 'Vanguarda paulista', 'Vapor', 'Vapornoise',
  'Vaportrap', 'Vaporwave', 'Vaudeville', 'Vaudeville Blues', 'Vedic Chant', 'Verismo',
  'Vietnamese Folk Music', 'Vietnamese Music', 'Viking Metal', 'Vikingarock', 'Villancico',
  'Vinahouse', 'Visual kei', 'Vocal Jazz', 'Vocal Surf', 'Vocal Trance', 'Vocalese',
  'Vocaloid Scene', 'Volkstümliche Musik', 'Waltz', 'War Metal', 'Wassoulou', 'Wave', 'Weightless',
  'Welsh Folk Music', 'West Coast Hip Hop', 'Western', 'Western Classical Music', 'Western Swing',
  'Whale Song', 'Windmill Scene', 'Winter Synth', 'Witch House', 'Wolof Music', 'Wong shadow',
  'Wonky', 'Wonky Techno', 'Work Song', 'Xaxado', 'Xote', 'Yacht Rock', 'Yaraví', 'Yass',
  'Yé-yé', 'Yiddish Folksong', 'Yodeling', 'Yoruba Music', 'YTPMV', 'Yu-Mex', 'Yugoslav New Wave',
  'Zamacueca', 'Zamba', 'Zamrock', 'Zarzuela', 'Zeuhl', 'Zeybek', 'Zhongguo feng', 'Ziglibithy',
  'Zimdancehall', 'Znamenny Chant', 'Zoblazo', 'Zouk', 'Zouk Love', 'Zydeco'
];

const RYMChart: Component = () => {
  const [selectedGenre, setSelectedGenre] = createSignal<string>('psychedelic-folk');
  const [selectedYear, setSelectedYear] = createSignal<number>(2025);
  const [timeRange, setTimeRange] = createSignal<'year' | 'decade'>('year');
  const [searchTerm, setSearchTerm] = createSignal<string>('');
  const [showDropdown, setShowDropdown] = createSignal<boolean>(false);

  const formatGenreForURL = (genre: string) => {
    return genre.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9-]/g, '');
  };

  const filteredGenres = createMemo(() => {
    const term = searchTerm().toLowerCase();
    if (!term) return RYM_GENRES.slice(0, 50); // Show first 50 if no search
    
    return RYM_GENRES
      .filter(g => g.toLowerCase().includes(term))
      .slice(0, 50); // Limit to 50 results
  });

  const getRYMUrl = () => {
    const genreSlug = formatGenreForURL(selectedGenre());
    if (timeRange() === 'year') {
      return `https://rateyourmusic.com/charts/top/album/${selectedYear()}/ge:${genreSlug}/`;
    } else {
      const decade = Math.floor(selectedYear() / 10) * 10;
      return `https://rateyourmusic.com/charts/top/album/${decade}s/ge:${genreSlug}/`;
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

  return (
    <div class='flex flex-col h-full'>
      {/* Header Controls */}
      <div class='flex-shrink-0 p-2 border-b border-border bg-bg-subtle'>
        <div class='flex items-center gap-2 flex-wrap'>
          {/* Genre Selector */}
          <div class='relative flex-1 min-w-[200px]'>
            <input
              type='text'
              value={searchTerm()}
              onInput={(e) => setSearchTerm(e.currentTarget.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder='Search genre...'
              class='input w-full text-xs'
            />
            <Show when={showDropdown()}>
              <div class='absolute z-20 w-full mt-1 bg-bg border border-border max-h-60 overflow-y-auto'>
                <For each={filteredGenres()}>
                  {(genre) => (
                    <div
                      class='px-2 py-1 text-xs cursor-pointer hover:bg-bg-subtle'
                      onClick={() => {
                        setSelectedGenre(genre);
                        setSearchTerm(genre);
                        setShowDropdown(false);
                      }}>
                      {genre}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Time Range Toggle */}
          <div class='flex gap-1'>
            <button
              onClick={() => setTimeRange('year')}
              class={`px-2 py-1 text-xs ${
                timeRange() === 'year'
                  ? 'bg-accent text-bg'
                  : 'text-fg-muted hover:text-fg'
              }`}>
              Year
            </button>
            <button
              onClick={() => setTimeRange('decade')}
              class={`px-2 py-1 text-xs ${
                timeRange() === 'decade'
                  ? 'bg-accent text-bg'
                  : 'text-fg-muted hover:text-fg'
              }`}>
              Decade
            </button>
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear()}
            onChange={(e) => setSelectedYear(parseInt(e.currentTarget.value))}
            class='input text-xs'>
            <For each={years}>
              {(year) => (
                <option value={year}>
                  {timeRange() === 'decade'
                    ? `${Math.floor(year / 10) * 10}s`
                    : year}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>

      {/* Iframe */}
      <div class='flex-1 overflow-hidden'>
        <iframe
          src={getRYMUrl()}
          class='w-full h-full border-0'
          title='RateYourMusic Charts'
          sandbox='allow-same-origin allow-scripts allow-popups allow-forms'
        />
      </div>
    </div>
  );
};

export default RYMChart;

