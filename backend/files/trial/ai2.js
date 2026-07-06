const redis = require('redis');
const client = redis.createClient();

// Configuration
const userId = "user_123";
const maxTokens = 10;              // Bucket capacity
const refillRate = 1;              // Tokens added per refill
const refillInterval = 6;          // Seconds between refills (10 tokens/min)
const bucketKey = `bucket:${userId}`;
const lastRefillKey = `lastRefill:${userId}`;

async function handleRequest(requestData) {
    // --- STEP 1: Refill the bucket with new tokens ---
    await refillBucket(userId);
    
    // --- STEP 2: Try to take a token ---
    const currentTokens = await client.getAsync(bucketKey);
    
    if (currentTokens === null || parseInt(currentTokens) <= 0) {
        // No tokens available! Request rejected.
        console.log(`❌ Request REJECTED. No tokens available.`);
        return { 
            status: "rejected", 
            error: "429 Too Many Requests",
            retryAfter: "Wait for refill"
        };
    }
    
    // --- STEP 3: Spend one token ---
    await client.decrAsync(bucketKey);
    const remaining = await client.getAsync(bucketKey);
    
    console.log(`✅ Request processed. Tokens remaining: ${remaining}/${maxTokens}`);
    return processRequest(requestData);
}

// --- The heart of the Token Bucket: Refill logic ---
async function refillBucket(userId) {
    const bucketKey = `bucket:${userId}`;
    const lastRefillKey = `lastRefill:${userId}`;
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    
    // Use MULTI to run everything atomically
    const multi = client.multi();
    
    // Get the current token count and last refill time
    multi.get(bucketKey);
    multi.get(lastRefillKey);
    const results = await multi.execAsync();
    
    let currentTokens = results[0] ? parseInt(results[0]) : null;
    let lastRefill = results[1] ? parseInt(results[1]) : null;
    
    // --- First time ever? Initialize the bucket ---
    if (currentTokens === null) {
        // Set to max tokens
        await client.setAsync(bucketKey, maxTokens);
        await client.setAsync(lastRefillKey, now);
        // Auto-delete after 1 hour if inactive
        await client.expireAsync(bucketKey, 3600);
        await client.expireAsync(lastRefillKey, 3600);
        return;
    }
    
    // --- Calculate how many tokens to add ---
    const timeSinceLastRefill = now - lastRefill;
    const tokensToAdd = Math.floor(timeSinceLastRefill / refillInterval) * refillRate;
    
    if (tokensToAdd > 0) {
        // Add tokens, but cap at maxTokens
        const newTotal = Math.min(currentTokens + tokensToAdd, maxTokens);
        
        // Update Redis atomically
        const updateMulti = client.multi();
        updateMulti.set(bucketKey, newTotal);
        updateMulti.set(lastRefillKey, now);
        await updateMulti.execAsync();
        
        console.log(`🔄 Refilled ${tokensToAdd} tokens. Total now: ${newTotal}/${maxTokens}`);
    }
}

// --- OPTIMIZATION: The "Lazy Refill" approach (more efficient!) ---
// Instead of calculating time every request, we can refill when we spend tokens.
// This is the most common production implementation:

async function handleRequestOptimized(requestData) {
    const now = Math.floor(Date.now() / 1000);
    const bucketKey = `bucket:${userId}`;
    const lastRefillKey = `lastRefill:${userId}`;
    
    // Use Lua script for atomicity (recommended for production)
    const luaScript = `
        local bucket = KEYS[1]
        local lastRefill = KEYS[2]
        local now = tonumber(ARGV[1])
        local maxTokens = tonumber(ARGV[2])
        local refillRate = tonumber(ARGV[3])
        local refillInterval = tonumber(ARGV[4])
        
        -- Get current state
        local tokens = redis.call('GET', bucket)
        local last = redis.call('GET', lastRefill)
        
        if tokens == false then
            -- First time: Initialize
            redis.call('SET', bucket, maxTokens - 1)
            redis.call('SET', lastRefill, now)
            return {1, maxTokens - 1}  -- Success, remaining tokens
        end
        
        tokens = tonumber(tokens)
        last = tonumber(last)
        
        -- Calculate new tokens
        local timePassed = now - last
        local tokensToAdd = math.floor(timePassed / refillInterval) * refillRate
        local newTokens = math.min(tokens + tokensToAdd, maxTokens)
        
        if newTokens < 1 then
            -- No tokens available
            return {0, newTokens}
        end
        
        -- Spend one token
        newTokens = newTokens - 1
        
        -- Update Redis
        redis.call('SET', bucket, newTokens)
        redis.call('SET', lastRefill, now)
        
        return {1, newTokens}
    `;
    
    // Execute the Lua script atomically
    const result = await client.evalAsync(
        luaScript,
        2, // Number of keys
        bucketKey,
        lastRefillKey,
        now,
        maxTokens,
        refillRate,
        refillInterval
    );
    
    const [success, remaining] = result;
    
    if (success === 0) {
        console.log(`❌ Request REJECTED. Tokens: ${remaining}/${maxTokens}`);
        return { status: "rejected", error: "429 Too Many Requests" };
    }
    
    console.log(`✅ Request processed. Tokens remaining: ${remaining}/${maxTokens}`);
    return processRequest(requestData);
}

// Your actual business logic
function processRequest(data) {
    console.log(`⚡ Handling: ${data}`);
    return { success: true };
}

// --- Testing the Token Bucket ---
async function test() {
    console.log("=== TOKEN BUCKET TEST ===\n");
    
    // Simulate 15 rapid requests (should reject after 10)
    for (let i = 1; i <= 15; i++) {
        console.log(`\n--- Request ${i} ---`);
        await handleRequestOptimized(`Request ${i}`);
    }
    
    // Wait 12 seconds (2 refill cycles)
    console.log("\n⏳ Waiting 12 seconds for refills...\n");
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    // Try again (should have 2 tokens)
    console.log("--- After refill ---");
    await handleRequestOptimized("Refill test request");
}

// Run the test
test();