Pod::Spec.new do |s|
  s.name           = 'RawDevelop'
  s.version        = '0.1.0'
  s.summary        = 'Develops RAW (DNG) photos into JPEGs for importing (EDT-36).'
  s.description    = 'Develops RAW files with Core Image CIRAWFilter, on the device.'
  s.author         = 'fanT'
  s.homepage       = 'https://github.com/dorachan121/fanT'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
