local tpm_key = KEYS[1]
local rpm_key = KEYS[2]
local rpd_key = KEYS[3]

local tokens = tonumber(ARGV[1])

-- Check RPD
local current_rpd = redis.call('GET', rpd_key)
if current_rpd and tonumber(current_rpd) < 1 then
    return {0, "RPD_EXHAUSTED", redis.call('PTTL', rpd_key)}
end

-- Check RPM
local current_rpm = redis.call('GET', rpm_key)
if current_rpm and tonumber(current_rpm) < 1 then
    return {0, "RPM_EXHAUSTED", redis.call('PTTL', rpm_key)}
end

-- Check TPM
local current_tpm = redis.call('GET', tpm_key)
if current_tpm and tonumber(current_tpm) < tokens then
    return {0, "TPM_EXHAUSTED", redis.call('PTTL', tpm_key)}
end

-- Deduct RPD
if not current_rpd then
    redis.call('SET', rpd_key, 1000 - 1, 'EX', 86400)
else
    redis.call('DECRBY', rpd_key, 1)
end

-- Deduct RPM
if not current_rpm then
    redis.call('SET', rpm_key, 100 - 1, 'EX', 60)
else
    redis.call('DECRBY', rpm_key, 1)
end

-- Deduct TPM
if not current_tpm then
    redis.call('SET', tpm_key, 30000 - tokens, 'EX', 60)
else
    redis.call('DECRBY', tpm_key, tokens)
end

return {1, "OK", 0}
