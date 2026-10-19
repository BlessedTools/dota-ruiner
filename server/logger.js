function redact(value, secrets) {
  let output = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secrets.filter(Boolean)) output = output.split(secret).join('[REDACTED]');
  output = output.replace(/([?&]api_key=)[^&\s"]+/gi, '$1[REDACTED]');
  return output;
}

export function createLogger({ write = console.log, secrets = [] } = {}) {
  const emit = (level, event, fields = {}) => write(redact({ time: new Date().toISOString(), level, event, ...fields }, secrets));
  return {
    info(event, fields) { emit('info', event, fields); },
    error(event, fields) { emit('error', event, fields); },
  };
}
