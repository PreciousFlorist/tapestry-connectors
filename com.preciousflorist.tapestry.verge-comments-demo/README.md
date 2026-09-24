# The Verge comments proof of concept

A read-only demonstration of opening live Verge comments in Tapestry's native conversation view.

## Try it

Install this connector, then select **Create a Feed**. It needs no login or subscriber URL. Open this feed on its own: the single demo entry has the article's original December 8, 2025 date, so it will be far back in a combined timeline. Use its **Comments** action (the conversation/details control or swipe menu).

The test article is [The Verge subscription turns one](https://www.theverge.com/bulletin/839889/the-verge-subscription-turns-one). This older discussion is closed to new comments but readable.

## Scope

- Shows up to 10 top-level comments, oldest first, and the reply previews included by Coral.
- Groups returned replies after their parent, with a reply-to label. Further pages and some deeper replies are omitted.
- Refreshes the discussion when the Comments action is invoked.
- Does not import subscriber articles, accept credentials, or post comments.
- The article row is a demo description, not the article body.

This uses the same published persisted GraphQL operation as the public Coral widget, tested without authentication. The operation ID was found in Coral's 9.11.8 stream bundle and can change when the website updates. Authentication for restricted discussions is not implemented.

The HTTP request and comment conversion were tested locally against a live response. Installation and native rendering still need testing in Tapestry or Loom.

Requires the Tapestry 1.4+ connector API. Unofficial and not affiliated with The Verge, Vox Media, Coral, or The Iconfactory.
