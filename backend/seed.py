import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from server import db, hash_password, now_utc

IMG = {
    'gallery_exhibition': 'https://images.unsplash.com/photo-1637578035851-c5b169722de1?crop=entropy&cs=srgb&fm=jpg&q=85',
    'gallery_artwork': 'https://images.unsplash.com/photo-1606819717115-9159c900370b?crop=entropy&cs=srgb&fm=jpg&q=85',
    'textile_pattern': 'https://images.unsplash.com/photo-1720982892402-5380e855320c?crop=entropy&cs=srgb&fm=jpg&q=85',
    'textile_thread': 'https://images.unsplash.com/photo-1641305534843-b7447fbc1c21?crop=entropy&cs=srgb&fm=jpg&q=85',
    'embroidered_fabric': 'https://images.unsplash.com/photo-1701964620963-4dcaab6d020f?crop=entropy&cs=srgb&fm=jpg&q=85',
    'craftsman_hands': 'https://images.unsplash.com/photo-1655376407042-b35a5c396cae?crop=entropy&cs=srgb&fm=jpg&q=85',
    'rug_fringe_hands': 'https://images.unsplash.com/photo-1773847099204-238d283b2845?crop=entropy&cs=srgb&fm=jpg&q=85',
    'handloom_sunlit': 'https://images.unsplash.com/photo-1786871204247-60f342ae81a8?crop=entropy&cs=srgb&fm=jpg&q=85',
    'yarn_ladder': 'https://images.unsplash.com/photo-1669556289350-0e2480fe190e?crop=entropy&cs=srgb&fm=jpg&q=85',
    'weaver_bw': 'https://images.unsplash.com/photo-1640292343595-889db1c8262e?crop=entropy&cs=srgb&fm=jpg&q=85',
    'pots_table': 'https://images.unsplash.com/photo-1697410154066-7bedf97b8e9a?crop=entropy&cs=srgb&fm=jpg&q=85',
    'vase_closeup': 'https://images.unsplash.com/photo-1726491079206-36a02e6c9cbb?crop=entropy&cs=srgb&fm=jpg&q=85',
    'pot_yard': 'https://images.unsplash.com/photo-1671167051711-1fcc8ddd7d40?crop=entropy&cs=srgb&fm=jpg&q=85',
    'pots_pile': 'https://images.unsplash.com/photo-1697410154169-b2bbf83758e6?crop=entropy&cs=srgb&fm=jpg&q=85',
    'terracotta_vases': 'https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?crop=entropy&cs=srgb&fm=jpg&q=85',
    'pottery_studio': 'https://images.unsplash.com/photo-1595351298020-038700609878?crop=entropy&cs=srgb&fm=jpg&q=85',
    'textiles_pottery': 'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?crop=entropy&cs=srgb&fm=jpg&q=85',
}


async def seed():
    # ---------- users ----------
    if os.environ.get('SEED_DEMO_USERS', '').lower() == 'true':
        users = [
            ('customer@smolcomp.art', 'customer123', 'Aanya Verma', 'customer', 'approved', '', ''),
            ('mira.artisan@smolcomp.art', 'artist123', 'Mira Khatri', 'artist', 'approved', 'Ajrakh Block Printing', 'Bhuj, Kutch'),
            ('ramesh.craft@smolcomp.art', 'artist123', 'Ramesh Lohar', 'artist', 'pending', 'Bell Metal Casting', 'Zura, Kutch'),
        ]
        for email, pw, name, role, status, craft, region in users:
            if not await db.users.find_one({'email': email}):
                await db.users.insert_one({
                    '_id': str(uuid.uuid4()), 'id': str(uuid.uuid4()),
                    'email': email, 'password_hash': hash_password(pw), 'name': name,
                    'role': role, 'status': status, 'craft': craft, 'region': region, 'bio': '',
                    'created_at': now_utc(),
                })

    # ---------- seasons ----------
    seasons = [
        {
            'slug': 'awadh-pilot', 'number': 0, 'title': 'The Awadh Pilot', 'region': 'Awadh, Uttar Pradesh',
            'country': 'India', 'description': 'Our first letterbox of contracts. Chikankari whispers and zardozi glints — gone in nineteen days.',
            'hero_image': IMG['gallery_artwork'], 'status': 'past',
            'start_date': (now_utc() - timedelta(days=130)).isoformat(), 'end_date': (now_utc() - timedelta(days=85)).isoformat(),
        },
        {
            'slug': 'kutch-resonance', 'number': 1, 'title': 'Kutch Resonance', 'region': 'Kutch, Gujarat',
            'country': 'India', 'description': 'Season I opens in the white desert: block print, thread, oil, metal and clay — plus five secrets the desert refuses to name.',
            'hero_image': IMG['gallery_exhibition'], 'status': 'live',
            'start_date': (now_utc() - timedelta(days=15)).isoformat(), 'end_date': (now_utc() + timedelta(days=45)).isoformat(),
        },
    ]
    for s in seasons:
        if not await db.seasons.find_one({'slug': s['slug']}):
            await db.seasons.insert_one({**s, '_id': s['slug'], 'created_at': now_utc()})

    # ---------- series ----------
    series = [
        {'slug': 'ajrakh-futures', 'season_slug': 'kutch-resonance', 'title': 'Ajrakh Futures', 'craft': 'Ajrakh Block Printing', 'cover_image': IMG['textile_pattern'], 'kind': 'seasonal', 'description': 'Sixteen stages of resist-printing in indigo and madder. Irfan Khatri\'s family has printed the same twelve motifs for nine generations — Season I asks what the thirteenth looks like.'},
        {'slug': 'rabari-thread', 'season_slug': 'kutch-resonance', 'title': 'Rabari Thread', 'craft': 'Rabari Embroidery', 'cover_image': IMG['embroidered_fabric'], 'kind': 'seasonal', 'description': 'Mirror-work and dense counted thread from the Rabari shepherding communities of central Kutch. Every stitch chart is memorised, never written.'},
        {'slug': 'rogan-light', 'season_slug': 'kutch-resonance', 'title': 'Rogan Light', 'craft': 'Rogan Art', 'cover_image': IMG['craftsman_hands'], 'kind': 'seasonal', 'description': 'Castor oil boiled for eleven hours, stretched into a lacquer thread, painted half-pressed on cloth. A surviving art of fewer than a dozen households.'},
        {'slug': 'bell-metal-echoes', 'season_slug': 'kutch-resonance', 'title': 'Bell Metal Echoes', 'craft': 'Bell Metal Casting', 'cover_image': IMG['pots_pile'], 'kind': 'seasonal', 'description': 'The Lohar smiths of Zura fold scrap iron into copper and brass bells, tuned by ear against the rhythm of their own anvils.'},
        {'slug': 'kutch-clay', 'season_slug': 'kutch-resonance', 'title': 'Kutch Clay', 'craft': 'Kutch Pottery', 'cover_image': IMG['terracotta_vases'], 'kind': 'seasonal', 'description': 'River clay, camel-hair brushes, motifs older than the village names. Fired once, kept forever.'},
        {'slug': 'perennial-loom', 'season_slug': '', 'title': 'The Perennial Loom', 'craft': 'Timeless Collection', 'cover_image': IMG['handloom_sunlit'], 'kind': 'timeless', 'description': 'Not everything closes when a season ends. These makers chose to keep their work in the light, all year round — buyable, countable, restocked by hand.'},
        {'slug': 'chikankari-dusk', 'season_slug': 'awadh-pilot', 'title': 'Chikankari Dusk', 'craft': 'Chikankari', 'cover_image': IMG['gallery_artwork'], 'kind': 'seasonal', 'description': 'The pilot series that started smolComp. Shadow-work on mul cotton. Archived, sold out, remembered.'},
    ]
    for s in series:
        if not await db.series.find_one({'slug': s['slug']}):
            await db.series.insert_one({**s, '_id': s['slug'], 'status': 'active', 'created_at': now_utc()})

    # ---------- artworks ----------
    def aw(series_slug, season_slug, title, kind, rarity, price, image, artist, desc, hint='', for_box=True, timeless=False, status='available'):
        doc = {
            '_id': str(uuid.uuid4()), 'id': str(uuid.uuid4()),
            'series_slug': series_slug, 'season_slug': season_slug, 'title': title, 'kind': kind,
            'description': desc, 'image': image, 'price': price, 'artist_name': artist, 'artist_bio': '',
            'rarity': rarity, 'for_blindbox': for_box, 'timeless': timeless, 'hint': hint, 'status': status,
            'created_at': now_utc(),
        }
        return doc

    artworks = [
        # Ajrakh Futures — Irfan Khatri
        aw('ajrakh-futures', 'kutch-resonance', 'Indigo Contradiction', 'block print', 'common', 45, IMG['textile_thread'], 'Irfan Khatri', 'Twin resist prints from the same teak block, dyed minutes apart. The indigo never matches, and that is the point.'),
        aw('ajrakh-futures', 'kutch-resonance', 'Crimson Reversal', 'block print', 'common', 45, IMG['yarn_ladder'], 'Irfan Khatri', 'Madder red printed against its own negative. Hang it against daylight and it flips.'),
        aw('ajrakh-futures', 'kutch-resonance', 'The Ninth Imprint', 'block print', 'rare', 60, IMG['handloom_sunlit'], 'Irfan Khatri', 'Eight motifs are public property. The ninth exists on two lengths of cloth in the world.', '', True),
        aw('ajrakh-futures', 'kutch-resonance', 'Ajrakh Zero', 'block print', 'secret', None, '', 'Irfan Khatri', 'The piece the family printed once and argues about.', 'Printed in a colour mixed only at 3 a.m. — the hour between two dawns. One impression exists.'),
        # Rabari Thread — Lila Rabari
        aw('rabari-thread', 'kutch-resonance', 'Mirror Orbit', 'embroidery', 'common', 40, IMG['rug_fringe_hands'], 'Lila Rabari', 'Eleven mirrors, eleven orbits of herringbone. Reads like a star chart from a moving cart.'),
        aw('rabari-thread', 'kutch-resonance', 'Kamadi Field', 'embroidery', 'common', 40, IMG['textiles_pottery'], 'Lila Rabari', 'The beetle motif stitched at field-density. Rabari girls once hid love letters in the count.'),
        aw('rabari-thread', 'kutch-resonance', "Grandmother's Knot", 'embroidery', 'rare', 58, IMG['weaver_bw'], 'Lila Rabari', 'A knot taught by touch alone. Lila\'s grandmother is the last in the line who ties it.'),
        aw('rabari-thread', 'kutch-resonance', 'The Thirteenth Stitch', 'embroidery', 'secret', None, '', 'Lila Rabari', 'Stitched entirely at night, over one desert winter.', 'Village elders say it hums when the desert wind passes through it. Nobody has disagreed.'),
        # Rogan Light — Ganesh Bihari
        aw('rogan-light', 'kutch-resonance', 'Thread of Gold', 'rogan art', 'common', 65, IMG['vase_closeup'], 'Ganesh Bihari', 'One continuous oil thread, never lifted. Folded once at the centre to keep the luck in.'),
        aw('rogan-light', 'kutch-resonance', 'Half-Lotus Ember', 'rogan art', 'rare', 85, IMG['gallery_artwork'], 'Ganesh Bihari', 'The lotus caught mid-bloom, pressed with a stylus instead of a brush.'),
        aw('rogan-light', 'kutch-resonance', 'Rogan Noir', 'rogan art', 'secret', None, '', 'Ganesh Bihari', 'Boiled castor oil, iron oxide, and one refusal.', 'Painted with an oil so dark it drinks the spotlight. Returned once — by its own maker.'),
        # Bell Metal Echoes — Karim Lohar
        aw('bell-metal-echoes', 'kutch-resonance', 'Anvil Song', 'bell metal', 'common', 70, IMG['pottery_studio'], 'Karim Lohar', 'A ceremonial bell tuned low, for doorways and slow mornings.'),
        aw('bell-metal-echoes', 'kutch-resonance', 'Twin Bells of Bhuj', 'bell metal', 'rare', 95, IMG['pot_yard'], 'Karim Lohar', 'Two bells cast from the same scrap. Struck together, they hold a single note.'),
        aw('bell-metal-echoes', 'kutch-resonance', 'The Bell That Forgot Its Sound', 'bell metal', 'secret', None, '', 'Karim Lohar', 'Cast on an eclipse day, against every rule of the workshop.', 'It strikes a note you remember but have never heard. The smith refuses to ring it twice.'),
        # Kutch Clay — Devi Kumbhar
        aw('kutch-clay', 'kutch-resonance', 'Desert Vessel I', 'pottery', 'common', 35, IMG['pots_table'], 'Devi Kumbhar', 'Water-carry form in river clay, brushed with the village\'s oldest border pattern.'),
        aw('kutch-clay', 'kutch-resonance', 'Water Carrier', 'pottery', 'common', 35, IMG['pot_yard'], 'Devi Kumbhar', 'The shape every Kutchi courtyard knows. Fired once, kept forever.'),
        aw('kutch-clay', 'kutch-resonance', 'The Unfired Form', 'pottery', 'secret', None, '', 'Devi Kumbhar', 'It has never met the kiln.', 'Never touched a kiln. It holds its shape out of stubbornness alone.'),
        # Timeless — direct buy
        aw('perennial-loom', '', 'Marble Churn', 'pottery', 'common', 180, IMG['vase_closeup'], 'Meera Ali', 'A year-round throwing series: eight vessels a season, no more.', '', False, True),
        aw('perennial-loom', '', 'Loomed Horizon', 'textile', 'common', 240, IMG['handloom_sunlit'], 'Meera Ali', 'Woven on the sunlit loom when the studio is quiet. Restocked by hand, never by machine.', '', False, True),
        aw('perennial-loom', '', 'Studio Ember', 'rogan art', 'common', 150, IMG['rug_fringe_hands'], 'Ganesh Bihari', 'Small rogan studies kept permanently in the light of the shop.', '', False, True),
        # Past season (sold out archive)
        aw('chikankari-dusk', 'awadh-pilot', 'Shadow Vine Kurta', 'embroidery', 'common', 55, IMG['textile_pattern'], 'Shabana Devi', 'Shadow-work vine on mul cotton. Archived with the pilot season.', '', False, False, 'sold_out'),
        aw('chikankari-dusk', 'awadh-pilot', 'Silver Noon Dupatta', 'embroidery', 'rare', 75, IMG['textile_thread'], 'Shabana Devi', 'Zardozi noonlight on the border. The pilot\'s rare piece — sold out in week two.', '', False, False, 'sold_out'),
    ]
    for a in artworks:
        if not await db.artworks.find_one({'title': a['title']}):
            await db.artworks.insert_one(a)

    # ---------- blind boxes ----------
    boxes = [
        {'series_slug': 'ajrakh-futures', 'name': 'The Ajrakh Box', 'price': 29, 'image': IMG['textile_pattern']},
        {'series_slug': 'rabari-thread', 'name': 'The Rabari Bundle', 'price': 24, 'image': IMG['embroidered_fabric']},
        {'series_slug': 'rogan-light', 'name': 'The Rogan Reliquary', 'price': 34, 'image': IMG['craftsman_hands']},
        {'series_slug': 'bell-metal-echoes', 'name': "The Bellfounder's Box", 'price': 27, 'image': IMG['pots_pile']},
        {'series_slug': 'kutch-clay', 'name': 'The Clay Luckpot', 'price': 19, 'image': IMG['terracotta_vases']},
        {'series_slug': 'chikankari-dusk', 'name': 'The Chikankari Letterbox', 'price': 22, 'image': IMG['gallery_artwork'], 'active': False},
    ]
    for b in boxes:
        if not await db.blind_boxes.find_one({'series_slug': b['series_slug']}):
            await db.blind_boxes.insert_one({
                '_id': str(uuid.uuid4()), 'id': str(uuid.uuid4()),
                **b, 'weight_common': 60, 'weight_rare': 30, 'weight_secret': 10,
                'active': b.get('active', True), 'created_at': now_utc(),
            })

    # ---------- polls ----------
    if not await db.polls.count_documents({}):
        await db.polls.insert_one({
            '_id': 'poll-season-two', 'question': 'Where should Season II open?',
            'description': 'The region with the loudest chorus gets our next letterbox of contracts. Vote, then tell the others.',
            'options': [
                {'id': 'bengal-jamdani', 'label': 'Bengal Jamdani', 'votes': 0},
                {'id': 'bastar-dhokra', 'label': 'Bastar Dhokra', 'votes': 0},
                {'id': 'ladakh-woodcarving', 'label': 'Ladakh Woodcarving', 'votes': 0},
                {'id': 'kerala-mural', 'label': 'Kerala Mural Art', 'votes': 0},
            ],
            'active': True, 'created_at': now_utc(),
        })
        await db.polls.insert_one({
            '_id': 'poll-vault-rumours', 'question': 'What should the Vault whisper about next?',
            'description': 'The secret pieces have Rumours. Help us decide which one grows.',
            'options': [
                {'id': 'secret-saree', 'label': 'A secret saree', 'votes': 0},
                {'id': 'secret-toys', 'label': 'Secret toys', 'votes': 0},
                {'id': 'secret-person', 'label': 'A secret collaborator — a person', 'votes': 0},
                {'id': 'fewer-secrets', 'label': 'Fewer secrets, louder ones', 'votes': 0},
            ],
            'active': True, 'created_at': now_utc(),
        })
        # warm the bars with seeded community votes
        seed_votes = [
            ('poll-season-two', 'bengal-jamdani', 14), ('poll-season-two', 'bastar-dhokra', 9),
            ('poll-season-two', 'ladakh-woodcarving', 4), ('poll-season-two', 'kerala-mural', 7),
            ('poll-vault-rumours', 'secret-saree', 12), ('poll-vault-rumours', 'secret-toys', 6),
            ('poll-vault-rumours', 'secret-person', 9), ('poll-vault-rumours', 'fewer-secrets', 3),
        ]
        for poll_id, option_id, n in seed_votes:
            for _ in range(n):
                await db.votes.insert_one({
                    '_id': str(uuid.uuid4()), 'poll_id': poll_id, 'option_id': option_id,
                    'user_id': str(uuid.uuid4()), 'created_at': now_utc(),
                })

    # ---------- a pending artist submission from Mira ----------
    if not await db.submissions.count_documents({}):
        mira = await db.users.find_one({'email': 'mira.artisan@smolcomp.art'})
        if mira:
            await db.submissions.insert_one({
                '_id': str(uuid.uuid4()), 'artist_id': mira['_id'], 'artist_name': 'Mira Khatri',
                'artist_craft': 'Ajrakh Block Printing', 'title': 'Indigo Sequence No. 4',
                'series_slug': 'ajrakh-futures', 'kind': 'block print',
                'description': 'Fourth in the sequence — the motif that only appears when the cloth dries overnight.',
                'price': 52, 'rarity': 'rare', 'image': IMG['textile_thread'], 'status': 'pending', 'created_at': now_utc(),
            })

    print('Seed complete:', await db.seasons.count_documents({}), 'seasons,',
          await db.artworks.count_documents({}), 'artworks,',
          await db.blind_boxes.count_documents({}), 'boxes,',
          await db.polls.count_documents({}), 'polls')


if __name__ == '__main__':
    asyncio.run(seed())
