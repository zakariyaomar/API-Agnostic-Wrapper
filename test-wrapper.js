const { chat, chatWithRetry, chatWithFallback } = require('./llm');
require('dotenv').config();

async function runTests() {
  console.log('====== COMPREHENSIVE WRAPPER TESTS ======\n');

  // Test 1: Default provider
  try {
    console.log('=== Test 1: Default provider ===');
    const response1 = await chat({
      messages: [{ role: 'user', content: 'What is the capital of Kenya?' }],
    });
    console.log(`Provider: ${response1.provider} | Model: ${response1.model}`);
    console.log(`Response: "${response1.text.substring(0, 100)}..."`);
    console.log(
      `Usage: ${response1.usage.input} input, ${response1.usage.output} output, ${response1.usage.total} total | Finished: ${response1.finished}`
    );
    console.log(
      `Cost: $${response1.cost.totalCostUSD} USD (~${response1.cost.totalCostKES} KES) [${response1.cost.breakdown}]`
    );
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 2: Explicit Anthropic
  try {
    console.log('=== Test 2: Explicit Anthropic ===');
    const response2 = await chat({
      provider: 'anthropic',
      messages: [{ role: 'user', content: 'What is the capital of Tanzania?' }],
    });
    console.log(`Provider: ${response2.provider} | Model: ${response2.model}`);
    console.log(`Response: "${response2.text.substring(0, 100)}..."`);
    console.log(
      `Usage: ${response2.usage.input} input, ${response2.usage.output} output, ${response2.usage.total} total | Finished: ${response2.finished}`
    );
    console.log(
      `Cost: $${response2.cost.totalCostUSD} USD (~${response2.cost.totalCostKES} KES) [${response2.cost.breakdown}]`
    );
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 3: Explicit OpenAI
  try {
    console.log('=== Test 3: Explicit OpenAI ===');
    const response3 = await chat({
      provider: 'openai',
      messages: [{ role: 'user', content: 'What is the capital of Uganda?' }],
    });
    console.log(`Provider: ${response3.provider} | Model: ${response3.model}`);
    console.log(`Response: "${response3.text.substring(0, 100)}..."`);
    console.log(
      `Usage: ${response3.usage.input} input, ${response3.usage.output} output, ${response3.usage.total} total | Finished: ${response3.finished}`
    );
    console.log(
      `Cost: $${response3.cost.totalCostUSD} USD (~${response3.cost.totalCostKES} KES) [${response3.cost.breakdown}]`
    );
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 4: Invalid provider
  try {
    console.log('=== Test 4: Invalid provider ===');
    await chat({
      provider: 'google',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    console.log('FAIL: Should have thrown an error\n');
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('PASS\n');
  }

  // Test 5: Empty messages
  try {
    console.log('=== Test 5: Empty messages ===');
    await chat({
      messages: [],
    });
    console.log('FAIL: Should have thrown an error\n');
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('PASS\n');
  }

  // Test 6: Invalid model (error handling)
  try {
    console.log('=== Test 6: Invalid model (error handling) ===');
    await chat({
      provider: 'anthropic',
      model: 'nonexistent-model-xyz',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    console.log('FAIL: Should have thrown an error\n');
  } catch (error) {
    console.log(`Classified error: { code: '${error.code}', status: ${error.status}, retryable: ${error.retryable} }`);
    console.log('PASS\n');
  }

  // Test 7: chatWithRetry success
  try {
    console.log('=== Test 7: chatWithRetry success ===');
    const response7 = await chatWithRetry({
      messages: [{ role: 'user', content: 'What is 2+2?' }],
    });
    console.log(`Response with attempts: { text: "${response7.text.substring(0, 50)}...", attempts: ${response7.attempts} }`);
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 8: Fallback - Normal operation (no fallback needed)
  try {
    console.log('=== Test 8: Fallback - Normal operation ===');
    const response8 = await chatWithFallback({
      provider: 'anthropic',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });
    console.log(`Provider: ${response8.provider} | Fallback: ${response8.fallback}`);
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 9: Fallback triggered
  try {
    console.log('=== Test 9: Fallback triggered ===');
    const response9 = await chatWithFallback({
      provider: 'anthropic',
      model: 'nonexistent-model-xyz',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    console.log(`Provider: ${response9.provider} | Fallback: ${response9.fallback} | Reason: "${response9.fallbackReason}"`);
    console.log(`Original provider: ${response9.originalProvider}`);
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  // Test 10: Provider switching via .env
  try {
    console.log('=== Test 10: Provider switching via .env ===');
    console.log(`Current PREFERRED_PROVIDER: ${process.env.PREFERRED_PROVIDER}`);
    const response10 = await chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    console.log(`Response served by: ${response10.provider}`);
    console.log('PASS\n');
  } catch (error) {
    console.log(`FAIL: ${error.message}\n`);
  }

  console.log('====== ALL TESTS COMPLETED ======');
}

runTests();
