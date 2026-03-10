/**
 * Test script to diagnose Google Maps API Key loading issues
 * Comment for production release
 * 
 * Run this in your app to check if Config is properly loading environment variables
 */

import Config from 'react-native-config';

export const testGoogleMapsConfig = () => {
  console.log('============================================');
  console.log('🔍 GOOGLE MAPS CONFIG DIAGNOSTIC TEST');
  console.log('============================================');
  
  // Test 1: Check if Config object exists
  console.log('\n📋 Test 1: Config Object');
  console.log('Config exists:', !!Config);
  console.log('Config type:', typeof Config);
  console.log('Config keys:', Object.keys(Config));
  console.log('Config values (full):', JSON.stringify(Config, null, 2));
  
  // Test 2: Check API_URL (sanity check)
  console.log('\n📋 Test 2: API_URL (Sanity Check)');
  console.log('API_URL:', Config.API_URL);
  console.log('API_URL exists:', !!Config.API_URL);
  console.log('API_URL type:', typeof Config.API_URL);
  
  // Test 3: Check GOOGLE_MAPS_API_KEY
  console.log('\n📋 Test 3: GOOGLE_MAPS_API_KEY');
  console.log('GOOGLE_MAPS_API_KEY:', Config.GOOGLE_MAPS_API_KEY);
  console.log('GOOGLE_MAPS_API_KEY exists:', !!Config.GOOGLE_MAPS_API_KEY);
  console.log('GOOGLE_MAPS_API_KEY type:', typeof Config.GOOGLE_MAPS_API_KEY);
  console.log('GOOGLE_MAPS_API_KEY length:', Config.GOOGLE_MAPS_API_KEY?.length || 0);
  
  if (Config.GOOGLE_MAPS_API_KEY) {
    console.log('First 10 chars:', Config.GOOGLE_MAPS_API_KEY.substring(0, 10));
    console.log('Last 5 chars:', Config.GOOGLE_MAPS_API_KEY.substring(Config.GOOGLE_MAPS_API_KEY.length - 5));
  }
  
  // Test 4: Try direct access
  console.log('\n📋 Test 4: Direct Property Access');
  const directKey = (Config as any).GOOGLE_MAPS_API_KEY;
  console.log('Direct access result:', directKey);
  
  // Test 5: Environment check
  console.log('\n📋 Test 5: Environment Information');
  console.log('Platform:', require('react-native').Platform.OS);
  console.log('__DEV__:', __DEV__);
  
  // Final diagnosis
  console.log('\n============================================');
  console.log('📊 DIAGNOSIS:');
  console.log('============================================');
  
  if (!Config.GOOGLE_MAPS_API_KEY) {
    console.error('❌ PROBLEM DETECTED: API Key is NOT loaded!');
    console.log('\n🔧 POSSIBLE SOLUTIONS:');
    console.log('1. Make sure .env file exists in /mobile/ directory');
    console.log('2. Rebuild the app completely:');
    console.log('   iOS: cd ios && pod install && cd .. && yarn ios');
    console.log('   Android: yarn android');
    console.log('3. Check .env file has correct format (no quotes):');
    console.log('   GOOGLE_MAPS_API_KEY=AIzaSy...');
    console.log('4. Try cleaning build:');
    console.log('   iOS: cd ios && rm -rf build && cd ..');
    console.log('   Android: cd android && ./gradlew clean && cd ..');
    console.log('5. Restart Metro bundler with cache clear:');
    console.log('   yarn start --reset-cache');
  } else {
    console.log('✅ API Key is loaded successfully!');
    console.log(`Key length: ${Config.GOOGLE_MAPS_API_KEY.length} characters`);
    
    // Validate key format
    if (Config.GOOGLE_MAPS_API_KEY.startsWith('AIza')) {
      console.log('✅ Key format looks correct (starts with AIza)');
    } else {
      console.warn('⚠️  Key format may be incorrect (should start with AIza)');
    }
  }
  
  console.log('============================================\n');
  
  return {
    configExists: !!Config,
    apiKeyExists: !!Config.GOOGLE_MAPS_API_KEY,
    apiKeyLength: Config.GOOGLE_MAPS_API_KEY?.length || 0,
    apiKeyValue: Config.GOOGLE_MAPS_API_KEY,
  };
};

// Auto-run on import in development
if (__DEV__) {
  console.log('🚀 Auto-running Google Maps config test...');
  setTimeout(() => {
    testGoogleMapsConfig();
  }, 1000);
}
