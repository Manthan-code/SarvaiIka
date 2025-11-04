import {
  CACHE_KEYS,
  getCachedRecentChats,
  setCachedRecentChats,
  addNewChatToRecent,
  updateCachedChat,
  removeCachedChat,
  clearCachedRecentChats,
  getCachedActiveMessages,
  setCachedActiveMessages,
  switchToActiveChat,
  addCachedActiveMessage,
  isActiveChatCached,
  clearAllCachedActiveMessages,
  getCachedUserProfile,
  setCachedUserProfile,
  clearCachedUserProfile,
  getCachedSubscription,
  setCachedSubscription,
  clearCachedSubscription,
  hasValidSubscriptionCache,
  invalidateSubscriptionCache,
  getSubscriptionCacheFirst,
  cacheSubscriptionFromDB,
  getCachedPlans,
  setCachedPlans,
  clearCachedPlans,
  resyncRecentChatsOnly,
  resyncSubscriptionAndPlans,
  resyncUserProfileOnly,
  clearAuthCache,
  clearSessionDataOnSignout,
  shouldRefreshCache,
  clearAllCache,
  isCacheExpired,
  getCacheStats,
} from '../../src/lib/localStorageUtils';

// Utility helpers
function makeChat(id: number, lastMessageAt: Date = new Date()): any {
  return {
    id: String(id),
    title: `Chat ${id}`,
    last_message_at: lastMessageAt.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message: `Message ${id}`,
    unread_count: 0,
  };
}

function makeMessage(id: number, timestamp: Date = new Date(), chatId = 'chat-1', userId = 'user-1'): any {
  return {
    id: String(id),
    content: `Message ${id}`,
    role: 'user' as const,
    timestamp: timestamp.toISOString(),
    chat_id: chatId,
    user_id: userId,
  };
}

function makeUserProfile(): any {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    subscription_plan: 'basic',
    updated_at: new Date().toISOString(),
  };
}

function makeSubscription(): any {
  return {
    id: 'sub-1',
    plan_details: { name: 'Pro', features: ['f1'], price: 9 },
    status: 'active',
    updated_at: new Date().toISOString(),
  };
}

function makePlans(): any[] {
  return [
    {
      id: 'plan-1',
      name: 'Basic',
      description: 'desc',
      price: 0,
      price_display: '$0',
      period: 'monthly',
      features: [],
      is_active: true,
    },
  ];
}

beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('Recent chats cache', () => {
  test('setCachedRecentChats limits to 20 and sorts by last_message_at desc', () => {
    const chats = Array.from({ length: 25 }, (_, i) => makeChat(i + 1, new Date(Date.now() - i * 1000)));
    setCachedRecentChats(chats);
    const cached = getCachedRecentChats();
    expect(cached).not.toBeNull();
    expect(cached!.length).toBe(20);
    // First item should be the most recent (i=0 => id=1)
    expect(cached![0].id).toBe('1');
  });

  test('addNewChatToRecent adds to beginning and removes duplicates', () => {
    const chats = Array.from({ length: 5 }, (_, i) => makeChat(i + 1));
    setCachedRecentChats(chats);
    addNewChatToRecent(makeChat(3)); // duplicate id
    const cached = getCachedRecentChats()!;
    expect(cached[0].id).toBe('3');
    expect(cached.filter(c => c.id === '3').length).toBe(1);
  });

  test('updateCachedChat updates existing or adds when not found', () => {
    setCachedRecentChats([makeChat(1)]);
    updateCachedChat({ ...makeChat(1), title: 'Updated' });
    let cached = getCachedRecentChats()!;
    expect(cached[0].title).toBe('Updated');

    updateCachedChat(makeChat(2));
    cached = getCachedRecentChats()!;
    expect(cached.some(c => c.id === '2')).toBe(true);
  });

  test('removeCachedChat removes the chat', () => {
    setCachedRecentChats([makeChat(1), makeChat(2)]);
    removeCachedChat('1');
    const cached = getCachedRecentChats()!;
    expect(cached.map(c => c.id)).toEqual(['2']);
  });

  test('clearCachedRecentChats clears the key', () => {
    setCachedRecentChats([makeChat(1)]);
    clearCachedRecentChats();
    expect(getCachedRecentChats()).toBeNull();
  });
});

describe('Active messages cache', () => {
  test('setCachedActiveMessages sorts ascending and limits to 40', () => {
    const messages = Array.from({ length: 50 }, (_, i) => makeMessage(i + 1, new Date(Date.now() - i * 1000)));
    setCachedActiveMessages('chat-1', messages);
    const cached = getCachedActiveMessages();
    expect(cached).not.toBeNull();
    expect(cached!.chatId).toBe('chat-1');
    expect(cached!.messages.length).toBe(40);
  });

  test('addCachedActiveMessage adds message and maintains limit', () => {
    const messages = Array.from({ length: 40 }, (_, i) => makeMessage(i + 1));
    setCachedActiveMessages('chat-1', messages);
    addCachedActiveMessage('chat-1', makeMessage(41));
    const cached = getCachedActiveMessages()!;
    expect(cached.messages.length).toBe(40);
    // addCachedActiveMessage puts new message at the beginning of array
    expect(cached.messages[0].id).toBe('41');
  });

  test('switchToActiveChat replaces cache for new chat', () => {
    setCachedActiveMessages('chat-1', [makeMessage(1)]);
    switchToActiveChat('chat-2', [makeMessage(2)]);
    const cached = getCachedActiveMessages()!;
    expect(cached.chatId).toBe('chat-2');
    expect(cached.messages[0].id).toBe('2');
  });

  test('isActiveChatCached detects cached chatId', () => {
    setCachedActiveMessages('chat-1', [makeMessage(1)]);
    expect(isActiveChatCached('chat-1')).toBe(true);
    expect(isActiveChatCached('chat-2')).toBe(false);
  });

  test('clearAllCachedActiveMessages clears', () => {
    setCachedActiveMessages('chat-1', [makeMessage(1)]);
    clearAllCachedActiveMessages();
    expect(getCachedActiveMessages()).toBeNull();
  });
});

describe('User profile & subscription & plans caches', () => {
  test('user profile: set/get/clear and resyncUserProfileOnly', () => {
    setCachedUserProfile(makeUserProfile());
    expect(getCachedUserProfile()).not.toBeNull();
    resyncUserProfileOnly();
    expect(getCachedUserProfile()).toBeNull();
    setCachedUserProfile(makeUserProfile());
    clearCachedUserProfile();
    expect(getCachedUserProfile()).toBeNull();
  });

  test('subscription: set/get/validate/invalidate/cache-first/from-DB and resyncSubscriptionAndPlans', () => {
    setCachedSubscription(makeSubscription());
    expect(getCachedSubscription()).not.toBeNull();
    expect(hasValidSubscriptionCache()).toBe(true);
    invalidateSubscriptionCache();
    expect(getCachedSubscription()).toBeNull();

    // Cache-first
    expect(getSubscriptionCacheFirst()).toBeNull();
    cacheSubscriptionFromDB(makeSubscription());
    expect(getSubscriptionCacheFirst()).not.toBeNull();

    // Resync subscription and plans
    setCachedPlans(makePlans());
    resyncSubscriptionAndPlans();
    expect(getCachedSubscription()).toBeNull();
    expect(getCachedPlans()).toBeNull();
  });

  test('plans: set/get/clear', () => {
    setCachedPlans(makePlans());
    expect(getCachedPlans()).not.toBeNull();
    clearCachedPlans();
    expect(getCachedPlans()).toBeNull();
  });
});

describe('Selective & global cache management', () => {
  test('resyncRecentChatsOnly clears recent chats', () => {
    setCachedRecentChats([makeChat(1)]);
    resyncRecentChatsOnly();
    expect(getCachedRecentChats()).toBeNull();
  });

  test('clearAuthCache preserves active messages but clears auth-related caches', () => {
    setCachedUserProfile(makeUserProfile());
    setCachedSubscription(makeSubscription());
    setCachedPlans(makePlans());
    setCachedRecentChats([makeChat(1)]);
    setCachedActiveMessages('chat-1', [makeMessage(1)]);

    clearAuthCache();

    expect(getCachedUserProfile()).toBeNull();
    expect(getCachedSubscription()).toBeNull();
    expect(getCachedPlans()).toBeNull();
    expect(getCachedRecentChats()).toBeNull();
    // Active messages should remain
    expect(getCachedActiveMessages()).not.toBeNull();
  });

  test('clearSessionDataOnSignout preserves ai-agent-theme and removes others', () => {
    localStorage.setItem('ai-agent-theme', 'dark');
    localStorage.setItem(CACHE_KEYS.RECENT_CHATS, 'x');
    localStorage.setItem('some-other-key', 'y');

    clearSessionDataOnSignout();

    expect(localStorage.getItem('ai-agent-theme')).toBe('dark');
    expect(localStorage.getItem(CACHE_KEYS.RECENT_CHATS)).toBeNull();
    expect(localStorage.getItem('some-other-key')).toBeNull();
  });

  test('clearAllCache removes all CACHE_KEYS entries', () => {
    setCachedRecentChats([makeChat(1)]);
    setCachedActiveMessages('chat-1', [makeMessage(1)]);
    setCachedUserProfile(makeUserProfile());
    setCachedSubscription(makeSubscription());
    setCachedPlans(makePlans());

    clearAllCache();

    expect(getCachedRecentChats()).toBeNull();
    expect(getCachedActiveMessages()).toBeNull();
    expect(getCachedUserProfile()).toBeNull();
    expect(getCachedSubscription()).toBeNull();
    expect(getCachedPlans()).toBeNull();
  });
});

describe('Expiry and refresh behavior', () => {
  test('isCacheExpired returns false for Infinity expiry', () => {
    setCachedRecentChats([makeChat(1)]); // RECENT_CHATS uses Infinity expiry
    expect(isCacheExpired(CACHE_KEYS.RECENT_CHATS)).toBe(false);
  });

  test('isCacheExpired returns true for expired non-Infinity cache', () => {
    const key = 'custom-expiring-key';
    const expired = {
      data: { foo: 'bar' },
      timestamp: Date.now() - 10000,
      expires_at: Date.now() - 1,
    };
    localStorage.setItem(key, JSON.stringify(expired));
    expect(isCacheExpired(key)).toBe(true);
  });

  test('shouldRefreshCache respects timestamp and maxAgeMs', () => {
    const key = 'custom-refresh-key';
    const fresh = {
      data: { foo: 'bar' },
      timestamp: Date.now(),
      expires_at: Infinity,
    };
    localStorage.setItem(key, JSON.stringify(fresh));
    expect(shouldRefreshCache(key, 5 * 60 * 1000)).toBe(false);

    const old = {
      data: { foo: 'bar' },
      timestamp: Date.now() - 10 * 60 * 1000,
      expires_at: Infinity,
    };
    localStorage.setItem(key, JSON.stringify(old));
    expect(shouldRefreshCache(key, 5 * 60 * 1000)).toBe(true);

    localStorage.removeItem(key);
    expect(shouldRefreshCache(key)).toBe(true);
  });
});

describe('Robustness: invalid JSON handling', () => {
  test('getCachedRecentChats returns null and removes malformed cache', () => {
    localStorage.setItem(CACHE_KEYS.RECENT_CHATS, '{malformed json');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(getCachedRecentChats()).toBeNull();
    expect(localStorage.getItem(CACHE_KEYS.RECENT_CHATS)).toBeNull();
    spy.mockRestore();
  });

  test('getCachedActiveMessages returns null on malformed cache', () => {
    localStorage.setItem(CACHE_KEYS.ACTIVE_MESSAGES, '{bad json');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(getCachedActiveMessages()).toBeNull();
    spy.mockRestore();
  });
});