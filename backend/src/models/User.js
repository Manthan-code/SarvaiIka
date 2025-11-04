/**
 * Represents the user model. Used for mapping Supabase data.
 */
class User {
  constructor({ id, email, role, subscriptionPlan, createdAt }) {
    this.id = id;
    this.email = email;
    this.role = role || 'free'; // 'free' or 'premium'
    this.subscriptionPlan = subscriptionPlan || null;
    this.createdAt = createdAt || new Date().toISOString();
  }
}

module.exports = User;