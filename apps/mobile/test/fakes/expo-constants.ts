/** A development build with every server configured; tests switch features off in `APP_CONFIG`. */
const Constants = {
  expoConfig: {
    version: '1.2.3',
    extra: {
      appVariant: 'development',
      contentBaseUrl: 'https://content.example.com',
      apiBaseUrl: 'https://api.example.com',
      revenueCatApiKey: { ios: 'appl_test', android: null },
      supportEmail: null,
      facebookAppId: null,
    },
  },
};

export default Constants;
