Pod::Spec.new do |s|
  s.name           = 'VolumeShutter'
  s.version        = '0.1.0'
  s.summary        = 'Takes a photo with the volume buttons (CAM-03).'
  s.description    = 'Reports hardware capture button presses through AVCaptureEventInteraction.'
  s.author         = 'fanT'
  s.homepage       = 'https://github.com/dorachan121/fanT'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
