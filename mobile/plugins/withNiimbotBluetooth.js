const { withInfoPlist } = require('@expo/config-plugins');

const BLUETOOTH_MESSAGE =
  'Çalışkan RMA, barkod etiketlerini NIIMBOT yazıcılara göndermek için Bluetooth erişimini kullanır.';

/**
 * Adds CoreBluetooth usage descriptions for NIIMBOT direct print (iOS).
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withNiimbotBluetooth(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription = BLUETOOTH_MESSAGE;
    config.modResults.NSBluetoothPeripheralUsageDescription = BLUETOOTH_MESSAGE;
    return config;
  });
}

module.exports = withNiimbotBluetooth;
