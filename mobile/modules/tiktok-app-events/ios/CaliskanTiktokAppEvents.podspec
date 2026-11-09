require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name           = 'CaliskanTiktokAppEvents'
  s.version        = package['version']
  s.summary        = 'Consent-gated TikTok Business SDK adapter for Caliskan B2B'
  s.description    = 'Uses official TikTokBusinessSDK 1.7.2 without loading or sending events before user opt-in.'
  s.license        = 'UNLICENSED'
  s.author         = 'Caliskan B2B'
  s.homepage       = 'https://github.com/erdcss/CRM-RMA-PANEL'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/erdcss/CRM-RMA-PANEL.git' }
  s.static_framework = true
  s.source_files   = '*.{swift,h,m}'
  s.dependency 'ExpoModulesCore'
  s.dependency 'TikTokBusinessSDK', '1.7.2'
  s.frameworks = 'AppTrackingTransparency', 'AdSupport'
  s.libraries = 'c++'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '$(inherited) -ObjC -lc++'
  }
end
