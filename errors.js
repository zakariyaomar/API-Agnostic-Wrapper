function classifyError(error, provider) {
  let code = 'UNKNOWN';
  let status = 500;
  let message = `Unexpected error from ${provider}: ${error.message}`;
  let retryable = false;

  if (error.status) {
    status = error.status;

    if (status === 429) {
      code = 'RATE_LIMIT';
      message = `Rate limit exceeded for ${provider}. Wait and retry.`;
      retryable = true;
    } else if (status === 401) {
      code = 'AUTH_ERROR';
      message = `Authentication failed for ${provider}. Check your API key.`;
      retryable = false;
    } else if (status === 404) {
      code = 'MODEL_NOT_FOUND';
      message = `Model not found on ${provider}. Check the model name.`;
      retryable = false;
    } else if (status === 529) {
      code = 'RATE_LIMIT';
      message = `${provider} API is overloaded. Try again shortly.`;
      retryable = true;
    } else if (status === 503) {
      code = 'NETWORK_ERROR';
      message = `${provider} API is temporarily unavailable. Check your internet connection.`;
      retryable = true;
    } else if (status === 408) {
      code = 'TIMEOUT';
      message = `Request to ${provider} timed out.`;
      retryable = true;
    }
  } else if (!error.status && error.message) {
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      code = 'TIMEOUT';
      message = `Request to ${provider} timed out.`;
      retryable = true;
    } else if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network')
    ) {
      code = 'NETWORK_ERROR';
      message = `Could not reach ${provider} API. Check your internet connection.`;
      retryable = true;
    }
  }

  return {
    code,
    status,
    message,
    provider,
    retryable,
    originalError: error,
  };
}

module.exports = { classifyError };
