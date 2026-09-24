# The Verge comments proof of concept

A read-only demonstration of opening live Verge comments in Tapestry's native conversation view.

## Try it

Install this connector, then select **Create a Feed**. It needs no login or subscriber URL. Open this feed on its own: the single demo entry has the article's original December 8, 2025 date, so it will be far back in a combined timeline. Use its **Comments** action (the conversation/details control or swipe menu).

The test article is [The Verge subscription turns one](https://www.theverge.com/bulletin/839889/the-verge-subscription-turns-one). This older discussion is closed to new comments but readable.

## Scope

- Shows the first 10 top-level comments, oldest first, and loads their descendant replies through Coral's published paginated reply operation. Later top-level discussions are still outside this demo.
- Groups replies after their actual parent, including replies to replies, with a reply-to label.
- Comments with replies have their own Comments action to open that smaller conversation.
- Comment bodies contain only the original comment HTML. The original publication date and time remain on the Item; Tapestry controls the native header's date formatting, with no documented connector override.
- Loads reply pages of 100, with a 20-page limit per thread. A failed or stalled page reports an error instead of silently showing an incomplete thread.
- Refreshes the discussion when the Comments action is invoked.
- Does not import subscriber articles, accept credentials, or post comments.
- Loads the public test article with all ten body paragraphs, links, byline, and lead image.
- The Comments action preserves that article and displays comments below it, without replacing the article with a summary.
- Uses post presentation so comment headers show their authors. Real avatars are shown when Coral supplies an avatar URL; otherwise Tapestry uses its default user image.
- Includes The Verge favicon.

This uses the same published persisted GraphQL operation as the public Coral widget, tested without authentication. The operation ID was found in Coral's 9.11.8 stream bundle and can change when the website updates. Authentication for restricted discussions is not implemented.

The HTTP requests and comment conversion were tested locally against live responses: 41 readable comments, including 19 replies to replies. Pagination, duplicate prevention, parent ordering, publication dates, and article preservation were also checked. Installation and native rendering still need testing in Tapestry or Loom.

Requires the Tapestry 1.4+ connector API. Unofficial and not affiliated with The Verge, Vox Media, Coral, or The Iconfactory.
