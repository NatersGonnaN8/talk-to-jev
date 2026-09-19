import type { JevQuestion, QuestionType } from "./types";
import { weatherPlaceholder } from "./weather";

export type SampleId =
  | "jacket"
  | "run"
  | "rain-delay"
  | "patio"
  | "garden"
  | "commute"
  | "grill"
  | "storm"
  | "festival"
  | "travel";

export type SampleCase = {
  id: SampleId;
  label: string;
  pitch: string;
  types: QuestionType[];
  state: string;
  questions: Record<string, JevQuestion>;
};

function caseText(situation: string) {
  return `${weatherPlaceholder()}

## Situation
${situation.trim()}
`;
}

function typesOf(questions: Record<string, JevQuestion>): QuestionType[] {
  const seen = new Set<QuestionType>();
  const order: QuestionType[] = ["choice", "noul", "score"];
  for (const q of Object.values(questions)) seen.add(q.type);
  return order.filter((t) => seen.has(t));
}

function sample(
  id: SampleId,
  label: string,
  pitch: string,
  situation: string,
  questions: Record<string, JevQuestion>,
): SampleCase {
  return {
    id,
    label,
    pitch,
    types: typesOf(questions),
    state: caseText(situation),
    questions,
  };
}

export const SAMPLES: SampleCase[] = [
  sample(
    "jacket",
    "Jacket?",
    "Walk out with the right layer.",
    `15–20 minute outdoor errand — coffee run or a short walk. Judge jacket vs no jacket from the weather block plus this outing. Not a packing essay.`,
    {
      wear_jacket: {
        type: "noul",
        instructions:
          "Should they wear a jacket for this outing given the weather?",
        criteria: {
          true: "A jacket is warranted for comfort or weather",
          false: "Comfortable without a jacket",
        },
      },
      layer: {
        type: "choice",
        instructions: "If they dress for this outing, which layer is the snap call?",
        criteria: {
          tee: "T-shirt or equivalent; no extra layer",
          light_layer: "Shirt, hoodie, or light sweater",
          insulated: "Insulated coat or heavy jacket",
          rain_shell: "Rain shell / waterproof layer",
        },
      },
    },
  ),
  sample(
    "run",
    "Run go/no-go",
    "Go outside, wait, or take the treadmill.",
    `Planned outdoor run, about 45 minutes. Safety and comfort only — not a coaching essay.`,
    {
      go_outside: {
        type: "noul",
        instructions: "Is it reasonable to run outdoors now given the weather?",
        criteria: {
          true: "Outdoor run is reasonable",
          false: "Better not to run outside now",
        },
      },
      plan: {
        type: "choice",
        instructions: "What should they do for this run?",
        criteria: {
          outdoor_run: "Go ahead with the outdoor run",
          treadmill: "Take it inside to a treadmill",
          wait_for_break: "Wait for a weather break, then go",
          skip: "Skip this session",
        },
      },
      conditions: {
        type: "score",
        instructions: "How are outdoor running conditions right now?",
        criteria: ["Great", "OK", "Poor", "Unsafe"],
      },
    },
  ),
  sample(
    "rain-delay",
    "Rain delay",
    "Play, delay, or call the rec game.",
    `Youth rec / school outdoor game this afternoon. This is a field call, not a pep talk.`,
    {
      delay_game: {
        type: "noul",
        instructions:
          "Should the game be delayed or called for weather?",
        criteria: {
          true: "Delay or call it — weather is a problem",
          false: "Weather is acceptable to play",
        },
      },
      call: {
        type: "choice",
        instructions: "What is the field call?",
        criteria: {
          play: "Play as scheduled",
          delay: "Delay and watch the sky",
          move_indoors: "Move the activity indoors",
          cancel: "Cancel this session",
        },
      },
      field: {
        type: "score",
        instructions: "How is the playing surface / field?",
        criteria: ["Dry", "Damp", "Unsafe"],
      },
    },
  ),
  sample(
    "patio",
    "Patio dinner",
    "Patio, indoor table, or stay in.",
    `Dinner plans with friends. Patio is the preference if the weather allows.`,
    {
      worth_going_out: {
        type: "noul",
        instructions:
          "Worth leaving the house for dinner given the weather?",
        criteria: {
          true: "Worth going out",
          false: "Better to stay in",
        },
      },
      venue: {
        type: "choice",
        instructions: "Where should dinner actually happen?",
        criteria: {
          outdoor_patio: "Sit on the outdoor patio",
          indoor_table: "Indoor table at the restaurant",
          takeout: "Pick up takeout",
          stay_in: "Cancel and eat at home",
        },
      },
    },
  ),
  sample(
    "garden",
    "Water the garden",
    "Water now, wait on rain, or skip.",
    `Backyard vegetables. Evening watering is the habit. Judge from soil need vs incoming rain.`,
    {
      water_today: {
        type: "noul",
        instructions: "Should they water the garden today?",
        criteria: {
          true: "Watering today is warranted",
          false: "Skip watering today",
        },
      },
      timing: {
        type: "choice",
        instructions: "How should they handle watering?",
        criteria: {
          water_now: "Water now",
          water_evening: "Wait and water this evening",
          skip_rain_coming: "Skip — rain is coming",
          skip_already_wet: "Skip — already wet enough",
        },
      },
    },
  ),
  sample(
    "commute",
    "Bike vs bus",
    "Bike, bus, drive, or work from home.",
    `About a 3-mile commute. Bike is the default in decent weather.`,
    {
      bike_ok: {
        type: "noul",
        instructions:
          "Is biking this commute reasonable in this weather?",
        criteria: {
          true: "Biking is reasonable",
          false: "Do not bike this commute now",
        },
      },
      mode: {
        type: "choice",
        instructions: "How should they get through this commute?",
        criteria: {
          bike: "Bike",
          bus: "Take the bus",
          drive: "Drive",
          wfh: "Work from home",
        },
      },
    },
  ),
  sample(
    "grill",
    "Grill tonight?",
    "Fire the grill, wait, or cook inside.",
    `Weeknight dinner. Charcoal or gas grill on a deck. Judge whether outdoors cooking is the snap call.`,
    {
      grill: {
        type: "noul",
        instructions: "Should they grill outdoors tonight?",
        criteria: {
          true: "Grilling outdoors is a good call",
          false: "Do not grill outdoors tonight",
        },
      },
      plan: {
        type: "choice",
        instructions: "What is the dinner plan?",
        criteria: {
          grill_now: "Grill now",
          grill_later: "Grill later if the weather breaks",
          indoor_cook: "Cook indoors",
          takeout: "Order takeout",
        },
      },
    },
  ),
  sample(
    "storm",
    "Storm prep",
    "Close up, full prep, or ride it out.",
    `House with open windows and porch cushions. A system is in the forecast. Snap whether to button up now.`,
    {
      close_windows: {
        type: "noul",
        instructions:
          "Should they close windows and bring loose things in now?",
        criteria: {
          true: "Close up and stow loose things now",
          false: "No need to close up yet",
        },
      },
      prep: {
        type: "choice",
        instructions: "How much storm prep is the call?",
        criteria: {
          none: "No prep needed now",
          close_and_stow: "Close windows and stow cushions / loose items",
          full_storm_prep: "Full storm prep",
        },
      },
      urgency: {
        type: "score",
        instructions: "How urgent is the prep?",
        criteria: ["Calm", "Watch", "Act now"],
      },
    },
  ),
  sample(
    "festival",
    "Harvest festival",
    "Hold the town festival in the square this afternoon?",
    `TypeSafe / Jev NPC energy. A town crier asks whether to hold the harvest festival in the square this afternoon. Jev is the town’s snap-judgment engine, not a novelist.`,
    {
      hold_festival: {
        type: "noul",
        instructions:
          "Should the town hold the harvest festival in the square this afternoon?",
        criteria: {
          true: "Hold it",
          false: "Do not hold it in the square this afternoon",
        },
      },
      venue: {
        type: "choice",
        instructions: "Where / when should the festival happen?",
        criteria: {
          town_square: "Town square, as planned",
          guild_hall: "Move into the guild hall",
          postpone_dawn: "Postpone until dawn",
          cancel_season: "Cancel for the season",
        },
      },
      omen: {
        type: "score",
        instructions: "What is the sky’s omen for the festival?",
        criteria: ["Fair winds", "Uneasy sky", "Ill omen"],
      },
    },
  ),
  sample(
    "travel",
    "Travel day",
    "Fly, drive, or delay the morning departure.",
    `Morning departure. They could fly, drive, or wait a day. Judge disruption from weather, not airline politics.`,
    {
      leave_today: {
        type: "noul",
        instructions: "Should they leave today given the weather?",
        criteria: {
          true: "Leave today",
          false: "Do not leave today",
        },
      },
      mode: {
        type: "choice",
        instructions: "How should they travel, if at all?",
        criteria: {
          fly: "Fly",
          drive: "Drive",
          delay_until_clear: "Delay until weather clears",
          cancel: "Cancel the trip",
        },
      },
      disruption: {
        type: "score",
        instructions: "How disruptive is the weather for travel?",
        criteria: ["Smooth", "Bumps", "Severe"],
      },
    },
  ),
];

/** Alias for Workshop chips — same ten as Use Cases. Do not fork this list. */
export const SAMPLE_CASES = SAMPLES;

export const SAMPLE_BY_ID: Record<SampleId, SampleCase> = Object.fromEntries(
  SAMPLES.map((s) => [s.id, s]),
) as Record<SampleId, SampleCase>;

export function isSampleId(id: string | null | undefined): id is SampleId {
  return Boolean(id && id in SAMPLE_BY_ID);
}

export function getSample(id: string | null | undefined): SampleCase | null {
  if (!isSampleId(id)) return null;
  return SAMPLE_BY_ID[id];
}

export function cloneSample(id: string | null | undefined): SampleCase | null {
  const s = getSample(id);
  if (!s) return null;
  return {
    ...s,
    questions: structuredClone(s.questions),
  };
}

export function typeLine(types: QuestionType[]) {
  return types.join(" · ");
}
