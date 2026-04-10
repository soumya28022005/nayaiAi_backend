/**
 * claudeService.js
 * 
 * WHY: Centralize all Claude API interactions in one service.
 * This makes it easy to swap models, adjust parameters, and
 * add retry logic without touching individual route files.
 */

const Anthropic = require("@anthropic-ai/sdk");

// Initialize the Anthropic client once and reuse it
// WHY: Creating a new client per request wastes resources; singleton is efficient
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

/**
 * Core function to call Claude API with a system prompt and user message.
 * WHY: All routes need Claude but with different system contexts.
 * This abstraction keeps each route clean and focused on business logic.
 *
 * @param {string} systemPrompt - Defines Claude's role for this call
 * @param {string} userMessage - The actual content/question
 * @param {number} maxTokens - Override default max tokens if needed
 * @returns {string} - Claude's text response
 */
async function callClaude(systemPrompt, userMessage, maxTokens = MAX_TOKENS) {
  console.log(`\n🤖 Calling Claude API...`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Max Tokens: ${maxTokens}`);
  console.log(`   System prompt length: ${systemPrompt.length} chars`);
  console.log(`   User message length: ${userMessage.length} chars`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const text = response.content[0].text;
  console.log(`✅ Claude responded: ${text.length} chars`);
  return text;
}

/**
 * Parse JSON safely from Claude's response.
 * WHY: Claude sometimes wraps JSON in markdown code blocks.
 * This function strips those wrappers reliably before parsing.
 *
 * @param {string} text - Raw Claude response
 * @returns {object} - Parsed JSON object
 */
function parseClaudeJSON(text) {
  // Strip markdown code fences if present (```json ... ```)
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse Claude JSON:", cleaned.substring(0, 200));
    throw new Error(
      `Claude returned invalid JSON: ${err.message}. Raw: ${cleaned.substring(0, 100)}`
    );
  }
}

module.exports = { callClaude, parseClaudeJSON };