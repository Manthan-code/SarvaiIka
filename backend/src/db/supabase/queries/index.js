const supabase = require('../client');

async function getPlans() {
    return await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false }); // Optimized with ordering
}

async function getSubscriptions(userId, limit, offset) {
    return await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1); // Optimized with range for pagination
}

module.exports = {
    getPlans,
    getSubscriptions
};