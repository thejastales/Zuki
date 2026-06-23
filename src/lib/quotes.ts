// Curated premium quotes from philosophical giants and spiritual thinkers.
export type MoodKey = "joyful" | "calm" | "neutral" | "anxious" | "tired" | "frustrated" | "sad";

export const MOODS: { key: MoodKey; label: string; emoji: string }[] = [
  { key: "joyful", label: "Joyful", emoji: "✨" },
  { key: "calm", label: "Calm", emoji: "🌙" },
  { key: "neutral", label: "Neutral", emoji: "🪞" },
  { key: "anxious", label: "Anxious", emoji: "🌊" },
  { key: "tired", label: "Tired", emoji: "🌫️" },
  { key: "frustrated", label: "Frustrated", emoji: "🔥" },
  { key: "sad", label: "Tender", emoji: "🌧️" },
];

type Quote = { text: string; author: string };

const QUOTES: Record<MoodKey, Quote[]> = {
  joyful: [
    { text: "Your own soul is a workshop. Build inside it a sanctuary of light.", author: "Marcus Aurelius" },
    { text: "The universe is not outside of you. Look inside yourself; everything that you want, you already are.", author: "Rumi" },
    { text: "Joy is a state of being, not a response to circumstances. It is the vibration of creation itself.", author: "Dr. Joe Dispenza" },
    { text: "Let yourself be silently drawn by the strange pull of what you really love. It will not lead you astray.", author: "Rumi" },
    { text: "The present moment is filled with joy. If you are attentive, you will see it.", author: "Thich Nhat Hanh" },
  ],
  calm: [
    { text: "Nowhere can man find a quieter or more untroubled retreat than in his own soul.", author: "Marcus Aurelius" },
    { text: "Muddy water is best cleared by leaving it alone.", author: "Alan Watts" },
    { text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
    { text: "To the mind that is still, the entire universe surrenders.", author: "Lao Tzu" },
    { text: "Breathe in, calm your body. Breathe out, smile. Dwelling in the present moment.", author: "Thich Nhat Hanh" },
  ],
  neutral: [
    { text: "The soul becomes dyed with the color of its thoughts. Choose your dyes with care today.", author: "Marcus Aurelius" },
    { text: "You are not a drop in the ocean. You are the entire ocean in a drop.", author: "Rumi" },
    { text: "The only way to make sense out of change is to plunge into it, move with it, and join the dance.", author: "Alan Watts" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "Write it on your heart that every day is the best day in the year.", author: "Ralph Waldo Emerson" },
  ],
  anxious: [
    { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
    { text: "Man is not worried by real problems so much as by his imagined anxieties about real problems.", author: "Epictetus" },
    { text: "If you are depressed you are living in the past. If you are anxious you are living in the future. If you are at peace you are living in the present.", author: "Lao Tzu" },
    { text: "Anxiety is the dizziness of freedom. Acknowledge it, ground yourself, and step forward.", author: "Søren Kierkegaard" },
    { text: "Do not let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.", author: "Marcus Aurelius" },
  ],
  tired: [
    { text: "Rest is not idleness, and to lie sometimes on the grass under trees... is by no means a waste of time.", author: "John Lubbock" },
    { text: "When you are tired, learn to rest, not to quit.", author: "Banksy" },
    { text: "The green reed which bends in the wind is stronger than the mighty oak which breaks in a storm.", author: "Confucius" },
    { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
    { text: "Resting is a radical act of self-preservation. Recharge the frequency before you continue.", author: "Dr. Joe Dispenza" },
  ],
  frustrated: [
    { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
    { text: "Where there is anger, there is always pain underneath.", author: "Eckhart Tolle" },
    { text: "The oak fought the wind and was broken, the willow bent when it must and survived.", author: "Robert Jordan" },
    { text: "Obstacles do not block the path. They are the path.", author: "Zen Proverb" },
    { text: "Do not waste your energy in fighting the old, but in building the new.", author: "Socrates" },
  ],
  sad: [
    { text: "The wound is the place where the Light enters you.", author: "Rumi" },
    { text: "What hurts you, blesses you. Darkness is your candle.", author: "Rumi" },
    { text: "The cure for pain is in the pain.", author: "Rumi" },
    { text: "Out of suffering have emerged the strongest souls; the most massive characters are seared with scars.", author: "Kahlil Gibran" },
    { text: "No tree, it is said, can grow to heaven unless its roots reach down to hell.", author: "Carl Jung" },
  ],
};

function getDaySeed(): number {
  const d = new Date();
  // Create a unique integer for the current date (e.g., 20260617)
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function quoteForMood(mood: MoodKey): Quote {
  const list = QUOTES[mood] ?? QUOTES.neutral;
  const seed = getDaySeed();
  return list[seed % list.length];
}

export const OPENING_THOUGHTS = [
  "Your future is not a place you go — it's a frequency you become. — Dr. Joe Dispenza",
  "To define is to limit. Allow yourself to be an unfolding mystery today. — Oscar Wilde",
  "The privilege of a lifetime is to become who you truly are. — Carl Jung",
  "We are all portals through which the universe is looking at itself. — Alan Watts",
  "Look at the trees, look at the birds. They do not worry. They simply stand in their essence. — Lao Tzu",
  "Dwelling in the absolute present is the greatest gift of sanity. — Thich Nhat Hanh",
  "You are the sky. The clouds are just thoughts passing through. — Pema Chödrön",
];

export function randomOpeningThought() {
  const seed = getDaySeed();
  return OPENING_THOUGHTS[seed % OPENING_THOUGHTS.length];
}

export const MOTIVATIONS = [
  "One hour of undivided attention is worth days of fractured effort. Find your flow.",
  "Align your energy before you align your tasks. Act from a state of centered intent.",
  "Momentum requires no massive leap. Simply pick up the brush and make the first stroke.",
  "What if this next task is not a burden, but a canvas for your finest expression?",
  "You do not have to finish the wall. Just lay this single brick as perfectly as a brick can be laid.",
  "Great acts are made up of small deeds done with great awareness. Begin now.",
];

export function randomMotivation() {
  const seed = getDaySeed();
  return MOTIVATIONS[seed % MOTIVATIONS.length];
}

export const WATER_NUDGES = [
  "💧 Pause. Take a breath, take a sip. Let hydration clear the fog.",
  "💧 The water you drink is the energy you flow. Hydrate your mind.",
  "💧 A mindful sip: close your eyes, feel the cool water, reset your presence.",
  "💧 Flow like water. Nourish your cells, return to balance.",
  "💧 Rest, breathe, drink. A simple ritual to keep your frequency high.",
];

export function randomWaterNudge() {
  const seed = getDaySeed();
  return WATER_NUDGES[seed % WATER_NUDGES.length];
}
