import Anthropic from "@anthropic-ai/sdk";

// Screens the assistant is allowed to open. Mirrors the admin dashboard tabs
// (plus the separate calendar route).
const NAV_TARGETS = [
  "manage",
  "create",
  "drafts",
  "event-signups",
  "calendar",
  "overview",
] as const;
type NavTarget = (typeof NAV_TARGETS)[number];

export type AssistantAction =
  | { kind: "search"; query: string }
  | { kind: "navigate"; target: NavTarget }
  | { kind: "answer"; message: string };

export interface AssistantContext {
  categories?: string[];
}

// Cheap, fast model is plenty for intent routing. Override with ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }
  return client;
}

const ROUTE_TOOL: Anthropic.Tool = {
  name: "route_request",
  description:
    "Decide how to handle the admin's request. Use 'navigate' to open a screen, 'search' to show a filtered list of needs, or 'answer' to reply with a short text answer.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "navigate", "answer"],
        description:
          "search = show a filtered needs list; navigate = open a screen; answer = reply in words.",
      },
      search: {
        type: "string",
        description:
          "When action is 'search', concise keywords to filter published needs by title, description, or category.",
      },
      target: {
        type: "string",
        enum: [...NAV_TARGETS],
        description:
          "When action is 'navigate': manage=needs list, create=post a new need, drafts=draft needs, event-signups=who signed up, calendar=events calendar, overview=reports.",
      },
      answer: {
        type: "string",
        description: "When action is 'answer', a short (1-2 sentence) reply.",
      },
    },
    required: ["action"],
  },
};

function buildSystemPrompt(context: AssistantContext): string {
  const categories = context.categories?.length
    ? ` Available need categories: ${context.categories.join(", ")}.`
    : "";
  return (
    "You are the built-in assistant for the VFW Post 7570 serving-network admin dashboard. " +
    "The admins are often non-technical volunteers; interpret a plain-English request and route it. " +
    "Screens you can open (navigate): manage (published needs list), create (post a new need), drafts, " +
    "event-signups (who volunteered), calendar (events), overview (reports & impact). " +
    "If they want to find or filter needs, use 'search' with concise keywords. If they want to go somewhere or " +
    "start a task (e.g. post a need), use 'navigate'. If they ask a general how-to question, use 'answer' with a short reply. " +
    "Do NOT invent specific numbers, names, or data you were not given. If they ask for data you don't have, " +
    "navigate or search to where they can see it instead of guessing." +
    categories
  );
}

export async function interpretAssistantQuery(
  query: string,
  context: AssistantContext = {},
): Promise<AssistantAction> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(context),
    tools: [ROUTE_TOOL],
    tool_choice: { type: "tool", name: "route_request" },
    messages: [{ role: "user", content: query }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  const input = (toolUse?.input ?? {}) as {
    action?: string;
    search?: string;
    target?: string;
    answer?: string;
  };

  if (
    input.action === "navigate" &&
    input.target &&
    (NAV_TARGETS as readonly string[]).includes(input.target)
  ) {
    return { kind: "navigate", target: input.target as NavTarget };
  }
  if (input.action === "answer" && input.answer?.trim()) {
    return { kind: "answer", message: input.answer.trim() };
  }
  // Default to a needs search using the model's keywords or the raw query.
  return { kind: "search", query: input.search?.trim() || query };
}
