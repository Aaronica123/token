const redis = require('redis');
const client = redis.createClient();

// Configuration
const userId = "user_123";
const limit = 10;              // Max 10 requests
const windowSeconds = 60;      // Per 60 seconds
const maxQueueSize = 5;        // Max 5 waiting in queue

// --- THE LUA SCRIPT (Heart of Throttling) ---
// This single script does EVERYTHING atomically
const throttleLuaScript = `
    -- KEYS[1]: rate:user_id (counter)
    -- KEYS[2]: queue:user_id (waiting line)
    -- ARGV[1]: limit (max requests per window)
    -- ARGV[2]: window (seconds)
    -- ARGV[3]: maxQueue (max waiters)
    -- ARGV[4]: requestData (JSON string of the request)
    
    local rateKey = KEYS[1]
    local queueKey = KEYS[2]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local maxQueue = tonumber(ARGV[3])
    local requestData = ARGV[4]
    
    -- 1️⃣ Check current count
    local current = redis.call('GET', rateKey)
    
    -- 2️⃣ If under limit, process immediately
    if current == false or tonumber(current) < limit then
        -- Increment counter
        local newCount = redis.call('INCR', rateKey)
        -- Set expiry if this is the first request
        if current == false then
            redis.call('EXPIRE', rateKey, window)
        end
        -- Return: status, position, remaining
        return {1, 0, limit - newCount}
    end
    
    -- 3️⃣ Limit hit. Try to queue
    local queueLen = redis.call('LLEN', queueKey)
    
    if queueLen < maxQueue then
        -- Add to queue
        redis.call('RPUSH', queueKey, requestData)
        -- Set expiry on queue (cleanup)
        redis.call('EXPIRE', queueKey, window)
        -- Return: queued, position, remaining
        return {2, queueLen + 1, 0}
    end
    
    -- 4️⃣ Queue full. DROP the request
    return {3, 0, 0}
`;

// --- BACKGROUND WORKER (Processes the queue) ---
async function processQueue() {
    const userId = "user_123";
    const queueKey = `queue:${userId}`;
    const rateKey = `rate:${userId}`;
    
    // Check if rate limit still active
    const currentCount = await client.getAsync(rateKey);
    if (currentCount === null || parseInt(currentCount) < limit) {
        // We have capacity! Pull from queue
        const nextRequest = await client.lpopAsync(queueKey);
        if (nextRequest) {
            console.log(`🔄 Processing queued request...`);
            // Increment counter since we're processing
            await client.incrAsync(rateKey);
            await client.expireAsync(rateKey, windowSeconds);
            processRequest(JSON.parse(nextRequest));
        }
    }
    
    // Keep checking
    setTimeout(processQueue, 500); // Check every 500ms
}

// --- MAIN HANDLER (Just ONE Redis call!) ---
async function handleRequest(requestData) {
    const rateKey = `rate:${userId}`;
    const queueKey = `queue:${userId}`;
    
    // Execute the Lua script atomically
    const result = await client.evalAsync(
        throttleLuaScript,
        2, // Number of keys
        rateKey,
        queueKey,
        limit,
        windowSeconds,
        maxQueueSize,
        JSON.stringify(requestData)
    );
    
    const [status, position, remaining] = result;
    
    // --- Handle the 3 possible outcomes ---
    if (status === 1) {
        // ✅ Request processed immediately
        console.log(`✅ Processed. ${remaining} slots left.`);
        return processRequest(requestData);
    } 
    else if (status === 2) {
        // ⏳ Request queued
        console.log(`⏳ Queued. Position: ${position}/${maxQueueSize}`);
        return { 
            status: "queued", 
            position: position,
            message: `Request queued at position ${position}`
        };
    } 
    else {
        // ❌ Request dropped
        console.log(`❌ DROPPED. Queue full and limit reached.`);
        return { 
            status: "rejected", 
            error: "429 Too Many Requests",
            retryAfter: windowSeconds
        };
    }
}

// Your business logic
function processRequest(data) {
    console.log(`⚡ Handling: ${data}`);
    return { success: true, data: data };
}

// --- TESTING ---
async function test() {
    console.log("=== THROTTLING WITH LUA ===\n");
    
    // Send 17 requests rapidly
    for (let i = 1; i <= 17; i++) {
        console.log(`\n--- Request ${i} ---`);
        await handleRequest({ id: i, message: `Test ${i}` });
    }
    
    console.log("\n⏳ Waiting for queue to process...");
    // Queue worker is running in background
    
    // Check queue status after 3 seconds
    setTimeout(async () => {
        const queueLen = await client.llenAsync(`queue:${userId}`);
        const count = await client.getAsync(`rate:${userId}`);
        console.log(`\n📊 After 3s: ${count}/${limit} processed, ${queueLen} in queue`);
    }, 3000);
}

// Start the background queue worker
processQueue();

// Run test
test();