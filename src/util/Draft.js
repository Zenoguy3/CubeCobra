import { csrfFetch } from './CSRF';
import { arrayIsSubset, arrayRotate, arrayShuffle } from './Util';

let draft = null;

function init(newDraft) {
  draft = newDraft;
}

function id() {
  return draft._id;
}

function cube() {
  return draft.cube;
}

function pack() {
  return draft.packs[0][0] || [];
}

function packPickNumber() {
  return [draft.packNumber, draft.pickNumber];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }

  draft.picks[0] = [...picks];
}

const fetchLands = [
  'Arid Mesa',
  'Bloodstained Mire',
  'Flooded Strand',
  'Marsh Flats',
  'Misty Rainforest',
  'Polluted Delta',
  'Scalding Tarn',
  'Verdant Catacombs',
  'Windswept Heath',
  'Wooded Foothills',
];

function botRating(botColors, card) {
  let rating = draft.ratings[card.details.name];
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors);
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  // Prioritize on-color or overlapping fetches.
  // Then overlapping lands, then overlapping spells.
  if (subset || (isFetch && overlap)) {
    rating -= 0.3;
  } else if (isLand && overlap) {
    rating -= 0.2;
  } else if (overlap) {
    rating -= 0.15;
  }
  return rating;
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.packs.length; botIndex++) {
    const pack = draft.packs[botIndex][0];
    const botColors = draft.bots[botIndex - 1];
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < pack.length; cardIndex++) {
      if (draft.ratings[pack[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return botRating(botColors, pack[x]) - botRating(botColors, pack[y]);
    });
    arrayShuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    pick = pack.splice(pickOrder[0], 1);
    draft.picks[botIndex].push(pick[0].cardID);
  }
}

function passPack() {
  draft.pickNumber += 1;
  botPicks();
  //check if pack is done
  if (draft.packs.every((seat) => seat[0].length === 0)) {
    draft.packNumber += 1;
    draft.pickNumber = 1;
    //splice the first pack out
    for (const drafter of draft.packs) {
      drafter.splice(0, 1);
    }
  } else {
    if (draft.packs[0].length % 2 == 0) {
      //pass left
      arrayRotate(draft.packs, false);
    } else {
      //pass right
      arrayRotate(draft.packs, true);
    }
  }
}

async function pick(cardIndex) {
  const [card] = draft.packs[0][0].splice(cardIndex, 1);
  const pack = draft.packs[0][0];
  draft.pickOrder.push(card.cardID);
  passPack();
  await csrfFetch('/cube/api/draftpickcard/' + draft.cube, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: pack.map((c) => c.details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  const temp = JSON.parse(JSON.stringify(draft));
  for (const seat of temp.packs) {
    for (const pack of seat) {
      for (const card of pack) {
        delete card.details;
      }
    }
  }
  for (const picks of temp.picks) {
    if (Array.isArray(picks)) {
      for (const card of picks) {
        if (card) {
          delete card.details;
        }
      }
    } else {
      delete picks.details;
    }
  }
  //save draft. if we fail, we fail
  await csrfFetch('/cube/api/draftpick/' + draft.cube, {
    method: 'POST',
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, finish };
