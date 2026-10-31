package com.fant.instagramstories

import androidx.core.content.FileProvider

/** A provider of its own, so its paths never clash with other libraries' providers. */
class InstagramStoriesFileProvider : FileProvider()
