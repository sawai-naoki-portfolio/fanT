Pod::Spec.new do |s|
  s.name           = 'VideoFilm'
  s.version        = '0.1.0'
  s.summary        = 'Colours short videos with a film LUT (CAM-13).'
  s.description    = 'Applies a 3D LUT to every frame with AVFoundation and Core Image, on the device.'
  s.author         = 'fanT'
  s.homepage       = 'https://github.com/dorachan121/fanT'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
