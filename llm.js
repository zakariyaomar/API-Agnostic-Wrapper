require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;
const OpenAI = require('openai').default;
const { classifyError } = require('./errors');

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PREFERRED_PROVIDER = process.env.PREFERRED_PROVIDER || 'anthropic';
const DEFAULT_MODELS = {
  anthropic: process.env.DEFAULT_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  openai: process.env.DEFAULT_OPENAI_MODEL || 'gpt-4o',
};

const PRICING = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-4-20250514': { input: 0.25, output: 1.25 },
  'claude-haiku-5-5': { input: 0.25, output: 1.25 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-6-luna': { input: 5.00, output: 15.00 },
};
const KES_RATE = 130;

function calculateCost(provider, model, inputTokens, outputTokens) {
  const pricing = PRICING[model] || { input: 2.50, output: 10.00 };
  const inputCostUSD = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUSD = (outputTokens / 1_000_000) * pricing.output;
  const totalCostUSD = inputCostUSD + outputCostUSD;
  const totalCostKES = totalCostUSD * KES_RATE;

  return {
    inputCostUSD: parseFloat(inputCostUSD.toFixed(6)),
    outputCostUSD: parseFloat(outputCostUSD.toFixed(6)),
    totalCostUSD: parseFloat(totalCostUSD.toFixed(6)),
    totalCostKES: parseFloat(totalCostKES.toFixed(2)),
    model,
    breakdown: `${inputTokens} input tokens ($${inputCostUSD.toFixed(6)}) + ${outputTokens} output tokens ($${outputCostUSD.toFixed(6)})`,
  };
}

async function callAnthropic({ model, system, messages, temperature, maxTokens }) {
  const params = {
    model,
    messages,
    max_tokens: maxTokens,
  };

  if (system) {
    params.system = system;
  }

  if (temperature !== undefined && temperature !== 0.7) {
    params.temperature = temperature;
  }

  const response = await anthropicClient.messages.create(params);

  const text = response.content[0].text;
  const input = response.usage.input_tokens;
  const output = response.usage.output_tokens;
  const finished = response.stop_reason === 'end_turn';

  return {
    text,
    model,
    provider: 'anthropic',
    usage: { input, output, total: input + output },
    finished,
    cost: calculateCost('anthropic', model, input, output),
  };
}

async function callOpenAI({ model, system, messages, temperature, maxTokens }) {
  const messagesArray = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const params = {
    model,
    messages: messagesArray,
  };

  if (model.includes('gpt-4') || model.includes('gpt-5') || model.includes('gpt-6')) {
    params.max_completion_tokens = maxTokens;
    if (!model.includes('gpt-6')) {
      params.temperature = temperature;
    }
  } else {
    params.max_tokens = maxTokens;
    params.temperature = temperature;
  }

  const completion = await openaiClient.chat.completions.create(params);

  const text = completion.choices[0].message.content;
  const input = completion.usage.prompt_tokens;
  const output = completion.usage.completion_tokens;
  const finished = completion.choices[0].finish_reason === 'stop';

  return {
    text,
    model,
    provider: 'openai',
    usage: { input, output, total: input + output },
    finished,
    cost: calculateCost('openai', model, input, output),
  };
}

async function chat({
  provider = PREFERRED_PROVIDER,
  model,
  messages,
  system,
  temperature = 0.7,
  maxTokens = 1024,
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }

  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error(`Unsupported provider: "${provider}"`);
  }

  const finalModel = model || DEFAULT_MODELS[provider];
  const clampedTemp =
    provider === 'openai'
      ? Math.max(0, Math.min(2, temperature))
      : Math.max(0, Math.min(1, temperature));
  const clampedMaxTokens = Math.min(maxTokens, 4096);

  try {
    if (provider === 'anthropic') {
      return await callAnthropic({
        model: finalModel,
        system,
        messages,
        temperature: clampedTemp,
        maxTokens: clampedMaxTokens,
      });
    } else {
      return await callOpenAI({
        model: finalModel,
        system,
        messages,
        temperature: clampedTemp,
        maxTokens: clampedMaxTokens,
      });
    }
  } catch (error) {
    const classified = classifyError(error, provider);
    throw classified;
  }
}

async function chatWithRetry({
  provider = PREFERRED_PROVIDER,
  model,
  messages,
  system,
  temperature = 0.7,
  maxTokens = 1024,
  maxRetries = 3,
}) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chat({
        provider,
        model,
        messages,
        system,
        temperature,
        maxTokens,
      });
      return { ...response, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (!error.retryable) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retry ${attempt}/${maxRetries} for ${provider} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function chatWithFallback({
  provider = PREFERRED_PROVIDER,
  model,
  messages,
  system,
  temperature = 0.7,
  maxTokens = 1024,
}) {
  const primary = provider;
  const fallback = primary === 'anthropic' ? 'openai' : 'anthropic';

  console.log(`[LLM] Request to ${primary} (${model || DEFAULT_MODELS[primary]})...`);

  try {
    const response = await chat({
      provider: primary,
      model,
      messages,
      system,
      temperature,
      maxTokens,
    });
    console.log(`[LLM] SUCCESS`);
    console.log(`[LLM] Response served by: ${primary}`);
    return { ...response, fallback: false };
  } catch (primaryError) {
    console.log(`[LLM] FAILED (${primaryError.code || primaryError.message})`);
    console.log(`[LLM] Falling back to ${fallback} (${DEFAULT_MODELS[fallback]})...`);

    try {
      const response = await chat({
        provider: fallback,
        model: DEFAULT_MODELS[fallback],
        messages,
        system,
        temperature,
        maxTokens,
      });
      console.log(`[LLM] SUCCESS`);
      console.log(`[LLM] Response served by: ${fallback} (fallback)`);
      return {
        ...response,
        fallback: true,
        fallbackReason: primaryError.message,
        originalProvider: primary,
      };
    } catch (fallbackError) {
      const bothFailedError = new Error(
        `Both providers failed. Primary (${primary}): ${primaryError.message}. Fallback (${fallback}): ${fallbackError.message}`
      );
      throw bothFailedError;
    }
  }
}

module.exports = { chat, chatWithRetry, chatWithFallback };
