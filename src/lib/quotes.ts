// Manifestation & mindset quotes inspired by Jay Shetty and Dr. Joe Dispenza.
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
    { text: "When you're in a state of joy, you're a perfect match for what you want to create.", author: "Dr. Joe Dispenza" },
    { text: "Gratitude is the ultimate state of receiving — your future is already on its way.", author: "Dr. Joe Dispenza" },
    { text: "Happiness is something you create, not something you wait for.", author: "Jay Shetty" },
  ],
  calm: [
    { text: "The quieter you become, the more you can hear who you are becoming.", author: "Jay Shetty" },
    { text: "In stillness, you meet the version of you that already has what you want.", author: "Dr. Joe Dispenza" },
    { text: "Peace is the new productivity.", author: "Jay Shetty" },
  ],
  neutral: [
    { text: "Today is a blank canvas. The brush is in your hand — paint with intention.", author: "Jay Shetty" },
    { text: "Your personality creates your personal reality. Choose today's energy on purpose.", author: "Dr. Joe Dispenza" },
    { text: "Small consistent action is more powerful than rare bursts of inspiration.", author: "Jay Shetty" },
  ],
  anxious: [
    { text: "You are not your thoughts. You are the awareness watching them pass.", author: "Dr. Joe Dispenza" },
    { text: "Breathe. The thing you're afraid of has already been survived by a future version of you.", author: "Jay Shetty" },
    { text: "When you change your energy, you change your life. Begin with the next breath.", author: "Dr. Joe Dispenza" },
  ],
  tired: [
    { text: "Rest is not the reward for finishing — it's the foundation of doing.", author: "Jay Shetty" },
    { text: "Even a small step in the direction of your future self rewires who you are.", author: "Dr. Joe Dispenza" },
    { text: "Honor the body. The work will meet you when you return.", author: "Jay Shetty" },
  ],
  frustrated: [
    { text: "The same thinking that created the problem cannot solve it. Become new, then begin again.", author: "Dr. Joe Dispenza" },
    { text: "Don't waste your pain — let it teach you, not define you.", author: "Jay Shetty" },
    { text: "Greatness is built in the moments you choose composure over reaction.", author: "Jay Shetty" },
  ],
  sad: [
    { text: "Your feelings are not in the way of your healing — they are the way.", author: "Jay Shetty" },
    { text: "Step into the field of infinite possibility — there, a new future is waiting for you.", author: "Dr. Joe Dispenza" },
    { text: "Be soft with yourself. You are doing a brave thing just by being here.", author: "Jay Shetty" },
  ],
};

export function quoteForMood(mood: MoodKey): Quote {
  const list = QUOTES[mood] ?? QUOTES.neutral;
  return list[Math.floor(Math.random() * list.length)];
}

export const OPENING_THOUGHTS = [
  "You are not waking up to a to-do list — you are waking up to a chance to become who you've always wanted to be. – Dr. Joe Dispenza",
  "Don't judge your day by the harvest you reap, but by the seeds you plant. – Jay Shetty",
  "Every morning, you have two choices: continue to sleep with your dreams, or wake up and chase them. – Jay Shetty",
  "Your future is not a place you go — it's a frequency you become. – Dr. Joe Dispenza",
  "The present moment is the only doorway to your new self. Walk through it. – Dr. Joe Dispenza",
];

export function randomOpeningThought() {
  return OPENING_THOUGHTS[Math.floor(Math.random() * OPENING_THOUGHTS.length)];
}

export const MOTIVATIONS = [
  "One focused hour is worth four distracted ones. Pick one task — go.",
  "You don't need motivation. You need momentum. Start small, start now.",
  "Future-you is watching. Make them proud with this next 25 minutes.",
  "The body remembers what the mind rehearses. Show up — even slowly.",
  "Done is the most generous gift you can give yourself today.",
];

export function randomMotivation() {
  return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
}
