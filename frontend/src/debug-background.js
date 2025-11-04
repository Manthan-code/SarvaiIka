// Debug script to test background image loading
// Run this in the browser console to see what's happening

async function debugBackgroundLoading() {
  console.log('🔍 Debugging background image loading...');
  
  try {
    // Check if user is logged in
    const { data: { session } } = await window.supabase.auth.getSession();
    console.log('👤 Session:', session ? 'Logged in' : 'Not logged in');
    
    if (!session?.access_token) {
      console.log('❌ No access token found');
      return;
    }
    
    console.log('🔑 Access token found, making API request...');
    
    // Make the same API call as the frontend
    const response = await fetch('/api/settings', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    
    console.log('📡 API Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📄 Full API response:', data);
      
      const preferences = data.preferences || {};
      console.log('⚙️ Preferences:', preferences);
      
      if (preferences.backgroundImage) {
        console.log('🖼️ Background image found:', preferences.backgroundImage);
        
        if (typeof preferences.backgroundImage === 'object') {
          console.log('✅ New format (object):', {
            id: preferences.backgroundImage.id,
            name: preferences.backgroundImage.name,
            url: preferences.backgroundImage.url
          });
        } else if (typeof preferences.backgroundImage === 'string') {
          console.log('✅ Legacy format (string):', preferences.backgroundImage);
        }
      } else {
        console.log('❌ No background image in preferences');
      }
      
      // Check if the background is actually applied
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        const computedStyle = window.getComputedStyle(chatContainer);
        console.log('🎨 Current background style:', {
          backgroundImage: computedStyle.backgroundImage,
          backgroundColor: computedStyle.backgroundColor
        });
      } else {
        console.log('❌ Chat container not found');
      }
      
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

// Auto-run the debug function
debugBackgroundLoading();