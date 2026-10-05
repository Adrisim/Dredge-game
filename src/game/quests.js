// Quests: side jobs delivered to a harbourmaster, plus the main "Hollow Light" storyline.
export const QUESTS = [
  { id: 'q_mack', town: 'saltmere', title: 'Supper for the Harbourmaster', text: 'Old Marrin\'s pot is empty. Bring him three Mackerel and he will be in your debt.', req: { mackerel: 3 }, reward: { money: 80 } },
  { id: 'q_scrap', town: 'saltmere', title: 'The Shipwright\'s Cat', text: 'The shipwright\'s cat has not eaten since Tuesday. Bring three Sardines and she will fit you a dredge net for free.', req: { sardine: 3 }, reward: { money: 20, upgrade: ['net', 1] }, hint: 'A dredge net lets you scoop scrap, driftwood and ore from dark patches on the seabed.' },
  { id: 'q_boots', town: 'gullhaven', title: 'Boot Stew', text: 'Do not ask. Just bring two Old Boots. The cook has an idea.', req: { old_boot: 2 }, reward: { money: 50 } },
  { id: 'q_flat', town: 'gullhaven', title: 'Flat Fish Fridays', text: 'The tavern needs Flounder for Friday. Two will do.', req: { flounder: 2 }, reward: { money: 95 } },
  { id: 'q_crab', town: 'gullhaven', title: 'Crab Feast', text: 'A wedding party wants crab. Bring three Brown Crabs - you will need a crab pot rack from the shipyard.', req: { brown_crab: 3 }, reward: { money: 160 } },
  { id: 'q_bream', town: 'barrowfen', title: 'Marsh Pie', text: 'The best pie in the Marches needs three Sea Bream.', req: { bream: 3 }, reward: { money: 240 } },
  { id: 'q_night', town: 'barrowfen', title: 'Wrong Fish', text: 'They bite after dark, the wrong ones. Bring one aberrant catch so the scholar can look at it. Fish at night, at the purple glowing spots.', req: { 'cat:aberrant': 1 }, reward: { money: 420 } },
  { id: 'q_copper', town: 'cinder', title: 'Forge Fodder', text: 'The forge is hungry. Four Copper Ore from the deeper seabed.', req: { copper_ore: 4 }, reward: { money: 360 } },
  { id: 'q_lobster', town: 'cinder', title: 'Lobster Thermidor', text: 'A lord of some importance arrives on Sunday. Two Lobsters, please.', req: { lobster: 2 }, reward: { money: 520 } },
  { id: 'q_tuna', town: 'paleanchor', title: 'The Tuna Contract', text: 'The cannery has a contract to honour. Two Bluefin Tuna.', req: { tuna: 2 }, reward: { money: 900 } },
  { id: 'q_crystal', town: 'thornwick', title: 'Deep Light', text: 'The glassblower wants Deep Crystal. Three pieces, from the open-ocean seabed.', req: { deep_crystal: 3 }, reward: { money: 1000 } },
  { id: 'q_manta', town: 'kelpsend', title: 'Wings of the Sea', text: 'A painter has never seen a Manta Ray up close. Bring her one. Gently.', req: { manta_ray: 1 }, reward: { money: 1200 } },
  { id: 'q_pearl', town: 'lantern', title: 'A Necklace of Night', text: 'Three Black Pearls. The bride-to-be insists.', req: { pearl: 3 }, reward: { money: 2000 } },
  { id: 'q_oar', town: 'lantern', title: 'The Silver Serpent', text: 'The lamplighters swear an Oarfish means the end of the dark. Bring one.', req: { oarfish: 1 }, reward: { money: 2800 } },
];

export const MAIN = {
  id: 'main',
  town: 'saltmere',
  title: 'The Hollow Light',
  intro: 'Marrin the Harbourmaster stares at the dead lighthouse on the horizon. "A hundred years it has been dark. The great lens broke into four pieces and sank, one in each stretch of the sea. Find them and carry them to the Hollow Light. Maybe the dark will lift. Maybe it will not. But the nights are getting worse."',
  steps: [
    'Dredge the first Lens Fragment from the wreck of the Mariner\'s Rest (gold marker, The Shallows). You will need a dredge net.',
    'Dredge the second Lens Fragment (gold marker, Kelp Marches).',
    'Dredge the third Lens Fragment (gold marker, Open Ocean).',
    'Dredge the fourth Lens Fragment (gold marker, Abyssal Reach).',
    'Carry all four fragments to the Hollow Light, far to the south-east, and set them in the lantern.',
  ],
  lensApprox: [[-420, 520], [1050, 1250], [-1750, -2350], [2000, 3250]],
  ending: 'The four shards sing as you set them in the lantern. A hundred years of dust lifts, and the Hollow Light blazes out across the water. For the first time in living memory, the dark feels less hungry. The sea is still yours to explore.',
};
