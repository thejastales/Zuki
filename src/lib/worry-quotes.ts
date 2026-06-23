// Curated worry-time quotes pairing deep philosophical wisdom with actionable daily tasks.
export type WorryQuote = {
  quote: string;
  author: string;
  implement: string;
};

export const WORRY_QUOTES: WorryQuote[] = [
  {
    quote: "We suffer more often in imagination than in reality.",
    author: "Seneca",
    implement: "Write down your worry verbatim. When you see it in ink, ask: 'Is this happening right now, or only in my head?'",
  },
  {
    quote: "What you resist, persists.",
    author: "Carl Jung",
    implement: "Instead of fighting the anxious thought, say to it: 'I see you. We will sit down and discuss this during our Worry Time.'",
  },
  {
    quote: "Between stimulus and response there is a space. In that space is our power to choose our response.",
    author: "Viktor Frankl",
    implement: "When an anxious trigger strikes, pause for 4 seconds before typing, speaking, or reacting. Create the space.",
  },
  {
    quote: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    implement: "Draw two columns on a page: 'Things I control' and 'Things I don't'. Sort your current worry immediately.",
  },
  {
    quote: "Muddy water is best cleared by leaving it alone.",
    author: "Alan Watts",
    implement: "Set a 15-minute timer, close your eyes, and let your thoughts swirl without attempting to fix or organize them.",
  },
  {
    quote: "I am not what happened to me, I am what I choose to become.",
    author: "Carl Jung",
    implement: "Write down a worry from your past that no longer affects you. Rip it up or delete it as a symbol of release.",
  },
  {
    quote: "You are the sky. Everything else is just the weather.",
    author: "Pema Chödrön",
    implement: "Imagine your worry as a dark cloud. Watch it float across your mind's eye without checking on it or trying to make it rain.",
  },
  {
    quote: "Rule your mind or it will rule you.",
    author: "Horace",
    implement: "Dedicate exactly 20 minutes to worry this evening. Outside of this window, do not indulge any anxious thoughts.",
  },
  {
    quote: "People are not disturbed by things, but by the view they take of them.",
    author: "Epictetus",
    implement: "Rewrite your main worry from the perspective of an encouraging, objective friend.",
  },
  {
    quote: "Smile, breathe and go slowly.",
    author: "Thich Nhat Hanh",
    implement: "Take three slow, conscious breaths before unlocking your phone or starting a new work session.",
  },
  {
    quote: "The components of anxiety are not outside. They are loops of the mind. Break the loop with a physical shift.",
    author: "Dr. Joe Dispenza",
    implement: "When anxiety mounts, stand up, stretch your arms, drink a glass of water, and change your physical environment.",
  },
  {
    quote: "The cave you fear to enter holds the treasure you seek.",
    author: "Joseph Campbell",
    implement: "What is the single conversation, email, or draft you are avoiding? Put it first on your list today.",
  },
  {
    quote: "It does not do to dwell on dreams and forget to live.",
    author: "J.K. Rowling",
    implement: "Notice one detail in your physical room right now—a shadow, a texture, a sound. Ground yourself in the present.",
  },
  {
    quote: "Anxiety is the dizziness of freedom.",
    author: "Søren Kierkegaard",
    implement: "Choose one pending decision that you've been putting off and finalize it before the sun goes down today.",
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
