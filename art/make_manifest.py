#!/usr/bin/env python3
"""Build the full card-art manifest. Usage: python3 make_manifest.py "Western Cartoon" art/full/manifest.json"""
import json, re, sys
style, out = sys.argv[1], sys.argv[2]
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
SUFFIX = (" Medieval European village, 14th century. Comic and slightly grim tone, no gore, expressive characters, "
          "rich detail, centered composition for a playing card illustration, no text, no lettering, no border.")
PORTRAIT = " Waist-up portrait looking at the viewer with a sly, slightly untrustworthy smile, workshop or stall behind them."

jobs = []
def add(kind, name, prompt, **kw):
    jobs.append({"id": f"{kind}-{slug(name)}", "request_id": f"atwd-{kind}-{slug(name)}-v1",
                 "name": name, "kind": kind, "prompt": prompt + SUFFIX, **kw})

# --- 12 role cards
roles = {
 "Blacksmith": "a burly village blacksmith at the forge, leather apron, hammer over one shoulder, sparks in the air, a small dagger hidden behind the back.",
 "Farmer": "a weathered village farmer with a pitchfork and a basket of turnips, straw in the hair, mud on the boots.",
 "Thief": "a wiry village thief in a hooded cloak, fingers already inside someone else's purse, innocent expression.",
 "Innkeeper": "a rosy-cheeked innkeeper wiping a tankard, keys at the belt, tavern full of drunks behind.",
 "City Guard": "a city guard in a kettle helm and tabard holding a halberd, keys and a lantern, stern but shifty.",
 "Carpenter": "a village carpenter with a saw and a plank over the shoulder, sawdust everywhere, pencil behind the ear.",
 "Jeweler": "a village jeweler with a loupe and a tray of gems, velvet cap, gold rings on every finger.",
 "Tailor": "a village tailor with a measuring cord and pins in the mouth, bolts of colorful cloth, needle raised.",
 "Apothecary": "a village apothecary with vials of colored liquid, dried herbs hanging, a suspicious smile.",
 "Hunter": "a village hunter with a longbow and a brace of rabbits, fur hat, a hound at heel.",
 "Woodsman": "a village woodsman with a great axe over the shoulder, bundle of firewood, snow on the boots.",
 "Miller": "a flour-dusted village miller beside a millstone with a sack of grain and one thumb on a balance scale.",
}
for r, p in roles.items(): add("role", r, "Portrait of " + p + PORTRAIT)

# --- 12 wares (job cards)
wares = {
 "Blacksmith": "a blacksmith's market stall of ironwork: horseshoes, hinges, knives, a kettle, and a fresh-forged sword.",
 "Farmer": "a farmer's market stall heaped with vegetables, sacks of grain, eggs, and a suspicious goose.",
 "Thief": "a thief's fence: a cloth spread in an alley with stolen rings, purses, a candlestick, and a stolen chicken.",
 "Innkeeper": "an inn's serving counter with foaming tankards, a roast, bread, and a barrel tapped for ale.",
 "City Guard": "a guard's patrol duty: a lantern, keys, a halberd, and a purse of collected fines on a stone table.",
 "Carpenter": "a carpenter's wares: a stool, a chest, a cradle, a ladder, and shavings on the floor.",
 "Jeweler": "a jeweler's velvet tray of rings, necklaces, and a single enormous gem under a magnifying glass.",
 "Tailor": "a tailor's stall of folded cloth, a fine doublet on a stand, ribbons, and a pincushion.",
 "Apothecary": "an apothecary's shelf of potion bottles, dried herbs, a mortar and pestle, a jar labeled with a skull.",
 "Hunter": "a hunter's game hung on a rail: hares, pheasants, a deer, and furs, with a bow leaning beside.",
 "Woodsman": "a woodsman's stacked timber and split firewood beside a sled, an axe buried in a stump.",
 "Miller": "a miller's sacks of flour on a cart beside a waterwheel and a millstone, flour dust in the air.",
}
for r, p in wares.items(): add("wares", r, "Still life of " + p)

# --- 33 signature cards
sig = {
 "Silver Dagger": "a gleaming silver dagger lying on an anvil in moonlight, sparks fading.",
 "Grindstone": "a foot-pedal grindstone throwing a shower of sparks as a blade is sharpened to a wicked edge.",
 "Iron Strongbox": "a squat iron-banded strongbox with three heavy locks, a thief's broken pick lying beside it.",
 "Hearty Stew": "a steaming cauldron of thick stew over a fire, a ladle, a loaf of bread, a happy dog.",
 "Bumper Crop": "an overflowing harvest cart of wheat sheaves, pumpkins, and apples pulled by a tired ox.",
 "Gleaning": "poor villagers stooping to gather leftover grain in a stubble field at golden dusk.",
 "Cutpurse": "a nimble hand slicing a fat purse from a merchant's belt in a crowded market.",
 "Blackmail": "a hooded figure handing a sealed letter to a sweating townsman who clutches his coin bag.",
 "Sneak Attack": "a shadowy figure creeping up behind an unaware villager in a dark alley, cudgel raised.",
 "Strong Ale": "a red-faced drunk asleep on a tavern table, his playing cards spilled face-up, others leaning in to look.",
 "A Round on the House": "a cheering tavern crowd raising foaming tankards as the innkeeper rolls out a barrel.",
 "Bad Batch": "green-faced villagers clutching their stomachs beside a barrel with a skull chalked on it.",
 "Night Patrol": "a city guard with lantern and halberd walking a torch-lit cobbled lane at night, cats watching.",
 "Curfew": "empty moonlit streets, guards swinging the town gates shut, a bell ringing in the tower.",
 "Inquest": "a stern guard interrogating a sweating villager across a table, a quill and a ledger.",
 "Palisade": "a stout wooden palisade wall with sharpened stakes surrounding a cozy cottage.",
 "Trestle Market": "carpenters hammering together market stalls with bunting while merchants unload wares.",
 "Rotten Beam": "a rotten roof beam cracking and collapsing in a cloud of dust as a family dives aside.",
 "King's Commission": "a jeweler presenting a jeweled crown to a haughty royal messenger with a scroll.",
 "Appraisal": "a jeweler squinting through a loupe at a gem, a ledger and scales beside him.",
 "Paste Gems": "a shattered glass gem on a counter, glass shards, and a furious customer pointing.",
 "False Colors": "a grinning tailor holding up two different guild tabards, deciding which to sell as genuine.",
 "Cloak of Plain Cloth": "a figure melting into a market crowd in a drab hooded cloak, unnoticed by searching guards.",
 "Sunday Best": "a villager strutting through the church door in extravagant new clothes as neighbors gawk.",
 "Panacea": "a glowing green potion in a crystal bottle surrounded by herbs, a patient sitting up in bed.",
 "Slow Poison": "a vial dripping into a goblet of wine beside an hourglass, a hand withdrawing into shadow.",
 "Physician's Fee": "an apothecary counting a pile of coins beside a row of bandaged, groaning patients.",
 "Hunting Bow": "a hunter drawing a longbow at full stretch in a misty forest, arrow nocked.",
 "Snare": "a rope snare in the undergrowth snapping tight around a surprised boot.",
 "Tracks in the Snow": "a hunter kneeling to examine a trail of footprints in fresh snow, breath steaming.",
 "Felling Axe": "a woodsman swinging a great axe into a tree that cracks and begins to topple.",
 "Cordwood": "a neatly stacked woodpile in snow beside a cottage with smoke curling from the chimney.",
 "Deep Forest": "a lone figure walking into a dark, misty, ancient forest where the path disappears.",
 "Miller's Toll": "a smug miller taking a sack of grain from each of a long line of grumbling farmers.",
 "Thumb on the Scale": "a miller's flour-dusted thumb pressing down on a balance scale as a customer looks away.",
 "Broken Door": "a burly miller bursting headfirst through a wooden door in an explosion of splinters.",
}
for n, p in sig.items(): add("sig", n, p)

# --- 24 mishaps (1 wound)
mishaps = {
 "Bee Swarm": "a cloud of angry bees chasing a peasant who has knocked over a hive, arms flailing.",
 "Loose Cobblestone": "a villager face-planting in the market square after tripping on a loose cobblestone, cabbages flying.",
 "The Goose": "a furious white goose attacking a terrified peasant in a muddy lane, wings spread, turnips dropped.",
 "Gardyloo!": "a chamber pot being emptied from an upstairs window onto a well-dressed passerby below.",
 "Rotten Floorboard": "a villager crashing through a rotten floorboard into a cellar full of surprised rats.",
 "Cart-Horse Kick": "a cart horse kicking a peasant clean over a fence, hat still in the air.",
 "Nettle Patch": "a villager landing bottom-first in a patch of stinging nettles after a shove, someone whistling nearby.",
 "Falling Roof Tile": "a slate roof tile sliding off a roof toward an oblivious villager's head.",
 "Rabid Mongrel": "a scruffy foaming dog clamped onto the seat of a fleeing villager's trousers.",
 "Hot Poker Handle": "a villager yelping and dropping a red-hot fire poker, steam rising from the hand.",
 "Ale-Slick Stairs": "a drunk sliding down a tavern staircase on his back, tankard still upright in hand.",
 "Runaway Barrel": "a huge barrel rolling downhill through a village street toward a frozen villager, herring spilling.",
 "Pig Stampede": "forty pigs stampeding down a narrow lane over a flattened farmer.",
 "Blow Dart from the Hedge": "a tiny dart sticking in a villager's neck, a suspicious hedge with a blowpipe poking out.",
 "Tainted Stew": "a villager turning green over a bowl of stew with something moving in it.",
 "Hidden Rake": "a rake handle springing up to smack a villager in the face, teeth in the grass.",
 "Root-Cellar Trapdoor": "a villager mid-fall into an open cellar trapdoor, lantern flying.",
 "Mousetrap in the Boot": "a villager hopping on one foot, a mousetrap snapped onto the toes of the other.",
 "Bucket Down the Well": "a wooden bucket falling down a well shaft onto the head of someone peering up from below.",
 "Hornets in the Hood": "a villager pulling on a hood and discovering the hornets' nest inside it.",
 "Ferret in the Trousers": "a villager dancing wildly with a ferret disappearing into his trousers, crowd laughing.",
 "The King's Swan": "an enormous swan hissing and beating a cowering villager with its wings by a riverbank.",
 "Greased Ladder": "a villager sliding down a greased ladder while painting a sign, paint pot airborne.",
 "Turnip from the Pillory Crowd": "a turnip flying from a jeering crowd at the pillory, striking an innocent bystander instead.",
}
for n, p in mishaps.items(): add("mishap", n, p)

# --- 12 calamities (2 wounds)
calamities = {
 "Cathedral Scaffold": "a stonemason tumbling backwards off a rickety wooden scaffold high on an unfinished cathedral, tools flying, pigeons scattering.",
 "Bear in the Woodpile": "a huge bear erupting out of a woodpile as a woodcutter drops his armful of logs.",
 "Trebuchet Practice": "a trebuchet launching a boulder over a wall, straight toward a villager holding a picnic basket.",
 "Staked Pit": "a hunter's leaf-covered pit trap opening under a startled villager, sharpened stakes below.",
 "Runaway Millstone": "an enormous millstone rolling downhill through the village toward a wide-eyed miller's apprentice.",
 "Boiling Pitch": "defenders on a castle wall tipping a cauldron of boiling pitch onto a villager who only came to deliver bread.",
 "Portcullis": "a heavy portcullis dropping toward a villager frozen in the gateway with a wheelbarrow.",
 "Falling Church Bell": "a great bronze bell falling from a bell tower toward the bell-ringer below, rope frayed.",
 "Boar Charge": "a massive wild boar charging a hunter who has dropped his spear and turned to run.",
 "Through the Ice": "a villager crashing through the ice of a frozen river, only a hat left on the surface.",
 "Drowned in Malmsey": "a pair of legs kicking out of a giant open barrel of wine in a cellar, a lantern tipping.",
 "Nightshade Tart": "a villager happily biting into a purple berry tart as an apothecary in the background covers her eyes.",
}
for n, p in calamities.items(): add("calamity", n, p)

# --- basics
add("basic", "Heal", "a kindly village healer wrapping a bandage around a grateful patient's arm, herbs and a bowl of water.")
add("basic", "Protect", "a heavy oak door barred with an iron bar, a battered wooden shield leaning beside it, a cat asleep on the step.")
add("basic", "Card Back", "a symmetrical ornamental woodcut frame around a grinning skull wearing a merchant's cap, coins, vines, and tiny icons of a goose, a bee, a barrel and an axe.",
    aspect_ratio="ar_3_4")

json.dump({"defaults": {"image_type": "card-art", "art_style": style, "aspect_ratio": "ar_3_4", "augment_prompt": True},
           "jobs": jobs}, open(out, "w"), indent=1)
from collections import Counter
print(len(jobs), "cards ->", out, dict(Counter(j["kind"] for j in jobs)), "=", len(jobs)*0.5, "credits")
