# Tapestry Connectors

A collection of unofficial custom connectors and feed configurations for Iconfactory Tapestry.

Each connector lives in its own reverse-domain folder and can be developed or packaged independently with Tapestry Loom.

## Connectors

### Harvard Business Review

Folder: [`com.preciousflorist.tapestry.hbr`](./com.preciousflorist.tapestry.hbr/)

Adds recent items from Harvard Business Review's public **The Latest** page. HBR does not provide a usable public RSS feed for this page, so this connector reads the public webpage directly.

### For Better or For Worse

Folder: [`com.preciousflorist.tapestry.fborfw`](./com.preciousflorist.tapestry.fborfw/)

Uses the official Strip Fix RSS feed and turns each entry into an image-only Tapestry item. The surrounding RSS title, comments, metadata, and descriptive text are intentionally omitted so the timeline shows the comic strip itself.

Source feed: https://www.fborfw.com/strip_fix/feed/

### The Verge

Folder: [`com.preciousflorist.tapestry.verge-comments-demo`](./com.preciousflorist.tapestry.verge-comments-demo/)

Reads configurable subscriber or public RSS/Atom feeds, prefers feed artwork, and opens article-specific comments with nested replies. The original folder and ID are retained for upgrades; the fixed demo article has been removed. Enter personal subscriber URLs in Tapestry, never in this repository.

## Disclaimer

These are unofficial community connectors. They are not affiliated with, endorsed by, or maintained by the respective publishers or The Iconfactory.
