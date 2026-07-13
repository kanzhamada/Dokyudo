local tpd_key = KEYS[1]
local tokens = tonumber(ARGV[1])

-- Check TPD (Tokens Per Day)
local current_tpd = redis.call('GET', tpd_key)
if current_tpd and tonumber(current_tpd) < tokens then
    return {0, "TPD_EXHAUSTED", redis.call('PTTL', tpd_key)}
end

-- Deduct TPD (Daily Quota: 9.3 Million tokens)
if not current_tpd then
    redis.call('SET', tpd_key, 9300000 - tokens, 'EX', 86400)
else
    redis.call('DECRBY', tpd_key, tokens)
end

return {1, "OK", 0}
