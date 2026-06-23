import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MockLanguageModelV3 } from "ai/test";

export function createLovableAiGatewayProvider(apiKey: string) {
  if (apiKey === "mock-key") {
    return (modelId: string) => {
      return new MockLanguageModelV3({
        defaultObjectGenerationMode: 'json',
        doGenerate: async ({ prompt }) => {
          console.log("Mock AI Generate called for model:", modelId);
          const promptText = JSON.stringify(prompt);
          let responseText = "Hello, I am Zuki! How can I help you today?";
          
          if (
            promptText.includes("weekly_report") || 
            promptText.includes("weekly worry-time evaluation") || 
            promptText.includes("Themes I noticed") || 
            promptText.includes("Worry-time sessions:")
          ) {
            let rawPrompt = "";
            try {
              const messages = prompt as any[];
              const userMsg = messages.find(m => m.role === 'user');
              if (userMsg && typeof userMsg.content === 'string') {
                rawPrompt = userMsg.content;
              } else {
                rawPrompt = promptText.replace(/\\n/g, "\n").replace(/\\"/g, '"');
              }
            } catch {
              rawPrompt = promptText.replace(/\\n/g, "\n").replace(/\\"/g, '"');
            }

            const worriesPart = rawPrompt.split("Worries this week:\n")[1]?.split("\n\nWorry-time sessions:")[0]?.trim() || "";
            const worryLines = worriesPart.split("\n").filter(l => l.trim().startsWith("•"));
            
            const resolvedList: string[] = [];
            const carriedList: string[] = [];

            worryLines.forEach(line => {
              // Clean line of bullet and date, e.g. "• [2026-06-23] (resolved, intensity 4): cat position"
              const cleanLine = line.replace(/^•\s*\[\d{4}-\d{2}-\d{2}\]\s*/, "").trim();
              if (cleanLine.toLowerCase().includes("(resolved")) {
                // Extract just the worry content after the status prefix
                const worryContent = cleanLine.replace(/^\(resolved, intensity [^)]+\):\s*/i, "").replace(/^\(resolved\):\s*/i, "").trim();
                resolvedList.push(worryContent);
              } else if (cleanLine.toLowerCase().includes("(none logged)")) {
                // Skip if none logged
              } else {
                const statusMatch = cleanLine.match(/^\([^)]+\):\s*/);
                const worryContent = statusMatch ? cleanLine.substring(statusMatch[0].length).trim() : cleanLine;
                carriedList.push(worryContent);
              }
            });

            const totalWorries = resolvedList.length + carriedList.length;
            const resolvedCount = resolvedList.length;

            const resolvedText = resolvedCount > 0 
              ? resolvedList.map(w => `  - Resolved: "${w}"`).join("\n") 
              : "  - (No worries marked as resolved this week)";
            const carriedText = carriedList.length > 0 
              ? carriedList.map(w => `  - Carried over: "${w}"`).join("\n") 
              : "  - (No outstanding worries carried over)";

            let themesText = "";
            if (totalWorries === 0) {
              themesText = "You didn't log any worries this week! This is a great sign of mental peace. Keep practicing mindfulness and enjoy this calm period.";
            } else {
              themesText = `This week, you logged ${totalWorries} worry item(s). I noticed you've been working through the following concerns:\n` + 
                [...carriedList, ...resolvedList].map(w => `- *${w}*`).slice(0, 3).join("\n");
            }

            responseText = `Themes I Noticed ✨
${themesText}

Your Progress & Resolutions 🌸
- **Summary**: You successfully resolved ${resolvedCount} out of ${totalWorries} logged worries!
${resolvedText}
${carriedText}

Your Strengths & Bright Spots ☀️
You are doing an incredibly beautiful job using Zuki to park and observe your thoughts. By containing your worries in one designated window rather than letting them run in the background, you are showing wonderful progress in self-care and mental clarity. Simply writing them down is a courageous step forward!

Sitting With You 🌿
It is completely normal to have worries carried over, and you are handling them with so much grace. Worry Time isn't about rushing to solve everything instantly—it is about learning to sit with uncertainty, one gentle step at a time. I'm right here with you!

Gentle Experiments for Next Week 🌱
1. Try marking at least one recurring worry as "resolved" during your worry session by finding a small, comforting reframe.
2. If a worry feels a bit intense, write it down, place a hand over your heart, and take five slow, nurturing deep breaths. You are safe, and you are doing wonderfully.`;
          }

 else if (promptText.includes("reading-comprehension") || promptText.includes("Grade what the reader understood")) {
            responseText = JSON.stringify({
              score: 85,
              feedback: "Excellent understanding of the concepts! You grasped the main points very well. Consider diving deeper into the next chapters."
            });
          } else if (promptText.includes("finished a book")) {
            responseText = JSON.stringify({
              final_score: 90,
              final_summary: "You completed this book with a high level of comprehension. You have internalized the key ideas.",
              recommendations: [
                { title: "Think Like a Monk", author: "Jay Shetty", reason: "Highly aligned with your interest in focus and mental clarity." },
                { title: "Breaking The Habit of Being Yourself", author: "Dr. Joe Dispenza", reason: "Perfect follow-up to neuroplasticity and identity shifts." },
                { title: "Atomic Habits", author: "James Clear", reason: "A practical guide to implementing the micro-habits we discussed." }
              ]
            });
          }
          
          return {
            content: [{ type: 'text', text: responseText }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20 },
          };
        },
        doStream: async ({ prompt }) => {
          console.log("Mock AI Stream called for model:", modelId);
          const promptText = JSON.stringify(prompt);
          let responseText = "Hello! I am Zuki. I'm here to help you parse and reframe the worries you've parked today. How are you feeling?";
          
          if (promptText.includes("worry") || promptText.includes("CBT")) {
            responseText = "I see what you've logged. It's completely natural to have concerns about these things. Let's take a deep breath and look at this together. What is one tiny action we can take today to make it feel slightly more manageable?";
          }

          const words = responseText.split(" ");
          const chunks = [
            { type: 'text-start' as const, id: 'text-1' },
            ...words.map((w, index) => ({
              type: 'text-delta' as const,
              id: 'text-1',
              delta: (index > 0 ? " " : "") + w
            })),
            { type: 'text-end' as const, id: 'text-1' }
          ];

          let chunkIndex = 0;
          const stream = new ReadableStream({
            pull(controller) {
              if (chunkIndex < chunks.length) {
                controller.enqueue(chunks[chunkIndex++]);
              } else {
                controller.close();
              }
            }
          });

          return {
            stream,
          };
        }
      });
    };
  }

  // Handle direct Gemini API Key fallback (starts with AIzaSy)
  if (apiKey.startsWith("AIzaSy")) {
    return createOpenAICompatible({
      name: "gemini-openai-compatible",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }
  
  // Handle direct OpenAI API Key fallback (starts with sk-)
  if (apiKey.startsWith("sk-")) {
    return createOpenAICompatible({
      name: "openai-compatible",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  // Default to standard Lovable AI Gateway
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}


