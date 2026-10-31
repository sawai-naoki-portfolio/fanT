Pod::Spec.new do |s|
  s.name           = 'InstagramStories'
  s.version        = '0.1.0'
  s.summary        = 'Shares a photo to Instagram Stories (SHR-03).'
  s.description    = 'Hands a sticker image and background colours to Instagram through the pasteboard.'
  s.author         = 'fanT'
  s.homepage       = 'https://github.com/dorachan121/fanT'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
