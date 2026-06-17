// Real-life motivational quotes for the Worry Time dashboard.
// Each quote pairs with an "implement today" action you can actually do.
export type WorryQuote = {
  quote: string;
  author: string;
  implement: string;
};

export const WORRY_QUOTES: WorryQuote[] = [
  {
    quote: "You can't stop the waves, but you can learn to surf.",
    author: "Jon Kabat-Zinn",
    implement: "When a worry pops up, name it out loud and write it down — then return to what you were doing.",
  },
  {
    quote: "Worry does not empty tomorrow of its sorrow, it empties today of its strength.",
    author: "Corrie ten Boom",
    implement: "Set a 20-minute worry window this evening. Outside it, gently park each worry on paper.",
  },
  {
    quote: "Nothing diminishes anxiety faster than action.",
    author: "Walter Anderson",
    implement: "Pick one worry and take a 2-minute action on it right now — even an email or a single line written.",
  },
  {
    quote: "You don't have to control your thoughts. You just have to stop letting them control you.",
    author: "Dan Millman",
    implement: "Notice one anxious thought today and respond with: 'Noted. I'll meet you at worry time.'",
  },
  {
    quote: "Do the best you can until you know better. Then when you know better, do better.",
    author: "Maya Angelou",
    implement: "Review yesterday's worries — keep one lesson, drop the rest.",
  },
  {
    quote: "He who has a why to live for can bear almost any how.",
    author: "Viktor Frankl",
    implement: "Write one sentence: why today matters. Re-read it before worry time.",
  },
  {
    quote: "Anxiety is the dizziness of freedom.",
    author: "Søren Kierkegaard",
    implement: "Choose one decision you've been postponing and make it before noon.",
  },
  {
    quote: "Discipline equals freedom.",
    author: "Jocko Willink",
    implement: "Honour the 20-minute worry window exactly — start on time, end on time.",
  },
  {
    quote: "What we fear doing most is usually what we most need to do.",
    author: "Tim Ferriss",
    implement: "Pick the worry you've been avoiding most and put it first on today's list.",
  },
  {
    quote: "You are the sky. Everything else is just the weather.",
    author: "Pema Chödrön",
    implement: "When a worry passes through, watch it like weather for 30 seconds before moving on.",
  },
  {
    quote: "Between stimulus and response there is a space. In that space is our power to choose.",
    author: "Viktor Frankl",
    implement: "Pause for one breath before reacting to anything that worries you today.",
  },
  {
    quote: "Comparison is the thief of joy.",
    author: "Theodore Roosevelt",
    implement: "Mute one feed or person today whose updates trigger anxious comparison.",
  },
  {
    quote: "Whether you think you can, or you think you can't — you're right.",
    author: "Henry Ford",
    implement: "Reframe one worry as a sentence starting with 'I can handle…'",
  },
  {
    quote: "What you resist, persists.",
    author: "Carl Jung",
    implement: "Write down the worry you keep pushing away. Just naming it is the work today.",
  },
  {
    quote: "Smile, breathe and go slowly.",
    author: "Thich Nhat Hanh",
    implement: "Take three slow breaths before opening your phone today.",
  },
  {
    quote: "Hard choices, easy life. Easy choices, hard life.",
    author: "Jerzy Gregorek",
    implement: "Make the one hard call/message you've been putting off today.",
  },
  {
    quote: "Most of our happiness or misery depends on our dispositions, not our circumstances.",
    author: "Martha Washington",
    implement: "Before worry time, list 3 things that went right today — however small.",
  },
  {
    quote: "Action is the antidote to despair.",
    author: "Joan Baez",
    implement: "Convert one worry into one tiny, doable next step before bed.",
  },
];

/** Deterministic pick: same user + same date → same quote. */
export function pickDailyQuote(seed: string): WorryQuote {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % WORRY_QUOTES.length;
  return WORRY_QUOTES[idx];
}
