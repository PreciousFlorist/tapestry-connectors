# For Better or For Worse Strip Fix for Tapestry

An unofficial connector that displays the comic image from the public **For Better or For Worse Strip Fix** RSS feed in an Iconfactory Tapestry timeline.

Source feed:

https://www.fborfw.com/strip_fix/feed/

## What it imports

For each supported RSS item, the connector keeps:

- the original strip post URL
- the publication date
- the comic strip image

## What it intentionally omits

The connector does not include the RSS entry title, Lynn's comments, post metadata, category text, or other descriptive content in the timeline item. Its purpose is to show the strip image itself.

## How it works

The connector requests the public Strip Fix RSS feed, identifies each `<item>`, extracts the image whose URL belongs to `/strip_fix/strips/`, and exposes that image to Tapestry as a native media attachment.

The feed and publisher use the website's favicon. The RSS endpoint is fixed even if the feed was created through Feed Finder using another page on the site.

No login, credentials, subscriber data, or third-party service is used.

## Compatibility

This version targets Tapestry's released 1.3+ connector API.

## Status

Unofficial community connector. Not affiliated with, endorsed by, or maintained by Lynn Johnston Productions, Entercom Canada Inc., For Better or For Worse, or The Iconfactory.
