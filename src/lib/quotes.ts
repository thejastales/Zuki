// Motivational quotes from diverse voices — speakers, athletes, writers, leaders.
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
    { text: "Happiness is something you create, not something you wait for.", author: "Jay Shetty" },
    { text: "The most wasted of days is one without laughter — but channel that energy into one bold move today.", author: "E. E. Cummings" },
    { text: "Do what you love and the work will follow. Keep moving while the spark is hot.", author: "Marie Forleo" },
    { text: "Joy is the simplest form of gratitude — now go build something with it.", author: "Karl Barth" },
  ],
  calm: [
    { text: "The quieter you become, the more you can hear who you are becoming.", author: "Jay Shetty" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "Peace is the new productivity — but steady hands still ship the work.", author: "Jay Shetty" },
    { text: "Calm mind brings inner strength and self-confidence — that's how you do good work.", author: "Dalai Lama" },
    { text: "Smile, breathe, and go slowly. Then begin the next thing.", author: "Thich Nhat Hanh" },
  ],
  neutral: [
    { text: "Today is a blank canvas. The brush is in your hand — paint with intention.", author: "Jay Shetty" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "Small consistent action is more powerful than rare bursts of inspiration.", author: "James Clear" },
  ],
  anxious: [
    { text: "You are not your thoughts. You are the awareness watching them pass.", author: "Eckhart Tolle" },
    { text: "Inhale the future, exhale the past. Then take the next small step.", author: "Unknown" },
    { text: "Nothing diminishes anxiety faster than action.", author: "Walter Anderson" },
    { text: "Feel the fear and do it anyway.", author: "Susan Jeffers" },
    { text: "Courage is not the absence of fear, but action in spite of it.", author: "Mark Twain" },
  ],
  tired: [
    { text: "Rest is not the reward for finishing — it's the foundation of doing.", author: "Jay Shetty" },
    { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
    { text: "Take care of your body. It's the only place you have to live — then return to the work.", author: "Jim Rohn" },
    { text: "Even a small step in the direction of your future self rewires who you are.", author: "Dr. Joe Dispenza" },
    { text: "When you can't fly, run. When you can't run, walk. Keep moving forward.", author: "Martin Luther King Jr." },
  ],
  frustrated: [
    { text: "The same thinking that created the problem cannot solve it. Become new, then begin again.", author: "Albert Einstein" },
    { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
    { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "Confucius" },
    { text: "Don't waste your pain — let it teach you, not define you.", author: "Jay Shetty" },
    { text: "Pressure is a privilege. Use it.", author: "Billie Jean King" },
  ],
  sad: [
    { text: "Your feelings are not in the way of your healing — they are the way.", author: "Jay Shetty" },
    { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
    { text: "Be soft with yourself. You are doing a brave thing just by being here.", author: "Brené Brown" },
    { text: "Tears are words the heart can't say — then we write the next chapter anyway.", author: "Gerald Jampolsky" },
    { text: "You may encounter many defeats, but you must not be defeated.", author: "Maya Angelou" },
  ],
};

export function quoteForMood(mood: MoodKey): Quote {
  const list = QUOTES[mood] ?? QUOTES.neutral;
  return list[Math.floor(Math.random() * list.length)];
}

export const OPENING_THOUGHTS = [
  "The future depends on what you do today. – Mahatma Gandhi",
  "Don't judge your day by the harvest you reap, but by the seeds you plant. – Robert Louis Stevenson",
  "Every morning, you have two choices: continue to sleep with your dreams, or wake up and chase them. – Carmelo Anthony",
  "Your future is not a place you go — it's a frequency you become. – Dr. Joe Dispenza",
  "The way to get started is to quit talking and begin doing. – Walt Disney",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. – Winston Churchill",
  "Whether you think you can or you think you can't — you're right. – Henry Ford",
];

export function randomOpeningThought() {
  return OPENING_THOUGHTS[Math.floor(Math.random() * OPENING_THOUGHTS.length)];
}

export const MOTIVATIONS = [
  "One focused hour is worth four distracted ones. Pick one task — go.",
  "You don't need motivation. You need momentum. Start small, start now.",
  "Future-you is watching. Make them proud with this next 25 minutes.",
  "Discipline weighs ounces. Regret weighs tons. Choose now.",
  "Done is the most generous gift you can give yourself today.",
  "Don't count the days. Make the days count. — Muhammad Ali",
  "The cave you fear to enter holds the treasure you seek. — Joseph Campbell",
];

export function randomMotivation() {
  return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
}

export const WATER_NUDGES = [
  "💧 Sip break. Hydrate — your brain is 75% water.",
  "💧 Water o'clock. A glass now = sharper focus next hour.",
  "💧 Pause. Drink. Stretch. Then back to it.",
  "💧 Hydration check — refill that glass.",
  "💧 Your future self says: drink some water.",
];

export function randomWaterNudge() {
  return WATER_NUDGES[Math.floor(Math.random() * WATER_NUDGES.length)];
}
