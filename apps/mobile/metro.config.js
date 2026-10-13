const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle migrations (.sql) are bundled as source; the offline food catalogue (.db) as an asset.
config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('db');

module.exports = withNativeWind(config, { input: './global.css' });
