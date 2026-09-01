require 'json'

absolute_react_native_path = File.dirname(`node --print "require.resolve('react-native/package.json')"`)
unless defined?(install_modules_dependencies)
  require File.join(absolute_react_native_path, 'scripts/react_native_pods')
end

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

sdk_libs = 'NiimbotSDK/Libs'
font_dir = 'NiimbotSDK/font'

Pod::Spec.new do |s|
  s.name           = 'NiimbotPrinter'
  s.version        = package['version']
  s.summary        = 'NIIMBOT JCAPI Bluetooth print bridge for Çalışkan RMA'
  s.description    = 'Expo module using official NIIMBOT iOS SDK 4.0.3 (JCAPI static libraries).'
  s.license        = 'UNLICENSED'
  s.author         = 'Caliskan RMA'
  s.homepage       = 'https://github.com/erdcss/CRM-RMA-PANEL'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/erdcss/CRM-RMA-PANEL.git' }
  s.static_framework = true

  s.source_files = '*.{swift,h,m}'
  s.public_header_files = 'NiimbotJCAPIBridge.h'
  s.private_header_files = 'JCAPI.h'
  s.dependency 'ExpoModulesCore'
  install_modules_dependencies(s)

  # Link by archive filename — NOT s.libraries ('JCAPI' would emit -lJCAPI → libJCAPI.a).
  s.vendored_libraries = [
    File.join(sdk_libs, 'JCAPI.a'),
    File.join(sdk_libs, 'JCLPAPI.a'),
    File.join(sdk_libs, 'libSkiaRenderLibrary.a'),
  ]

  s.preserve_paths = [
    File.join(sdk_libs, 'JCAPI.a'),
    File.join(sdk_libs, 'JCLPAPI.a'),
    File.join(sdk_libs, 'libSkiaRenderLibrary.a'),
  ]

  s.resources = [
    File.join(font_dir, 'FONT.json'),
    File.join(font_dir, 'ZT001.ttf'),
    File.join(font_dir, 'ZT002.otf'),
  ]

  s.frameworks = 'Foundation', 'UIKit', 'CoreBluetooth', 'AVFoundation', 'CoreMedia'
  s.libraries = 'c++', 'z', 'resolv', 'iconv', 'bz2'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '$(inherited) -ObjC',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES',
  }
end
