Pod::Spec.new do |s|
  s.name           = 'PersonSegmentation'
  s.version        = '0.1.0'
  s.summary        = 'Cuts people out of photos for puri backgrounds (PRI-04).'
  s.description    = 'Writes a person mask with Vision person segmentation, on the device.'
  s.author         = 'fanT'
  s.homepage       = 'https://github.com/dorachan121/fanT'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
