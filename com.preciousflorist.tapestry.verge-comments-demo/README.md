The Verge feeds with comments

Add this connector, choose Create a Feed, and paste your full subscriber RSS URL from The Verge. Repeat for each newsletter or other Verge feed. A public feed URL also works, but can only show the content included in that public feed. Do not paste an article URL or the homepage.

Articles use the HTML provided by your RSS or Atom feed, including its text, links, images, and supported media. Atom content is preferred over its summary; RSS content:encoded is preferred over description. No article-body scraping or subscription bypass is performed. Tapestry determines which HTML and embedded assets it can render.

Feed artwork is preferred in this order: Atom icon, Atom logo, RSS channel image, iTunes image, then The Verge favicon. Feed verification supplies that artwork; articles leave their author identity unset so Tapestry can use the feed's customized name and icon. The installable connector itself retains a generic Verge favicon because no individual feed has been configured yet.

Use an article's Comments action to load its own Coral discussion. Replies are grouped after their parents, with reply-to labels, usernames, and source avatars when available. Comments with replies have their own Comments action. Comment bodies have no added publication line; Tapestry formats the original date and time in its header.

Top-level comments now paginate beyond the former 10-discussion demo limit. Missing reply pages load when necessary. Limits are 20 pages of 50 top-level comments and 20 pages of 100 descendants per expanded thread. If pagination fails or reaches a limit, the connector reports an error instead of silently presenting an incomplete discussion. Comments load anonymously using Coral's published operations; restricted discussions may require opening the website. This connector does not sign in to Coral or post comments.

Upgrading from the demo: the connector keeps its original internal ID and folder so it can update in place. Its name is now The Verge (Feeds + Comments). Create new feeds with your subscriber URLs, then remove the old demo feed from Tapestry's Feeds settings to clear its cached test article. The connector no longer loads a fixed test article.

Your subscriber URL is entered and retained by Tapestry as feed configuration. It is not embedded in these public files or sent in Coral comment requests. Treat that personal URL as private. Feed-download errors avoid echoing it.

Validation: live public Atom feed conversion and current article-to-Coral lookup, plus RSS full-content, XHTML, icon precedence, nested actions, pagination, and error-redaction fixtures. Private subscriber feed content and native rendering need validation in Tapestry with your own URL.

Requires Tapestry 1.4+. Unofficial and not affiliated with The Verge, Coral, or The Iconfactory. Coral's persisted operations are from its published 9.11.8 stream bundle and may change.

Version 8 removes the artificial article-author label containing the original RSS feed title. Set your preferred name under Customize Feed > Name. The separate service name is hidden by default; if you previously selected Visible explicitly, set Customize Feed > Service Name to Hidden. Refresh after updating to regenerate article items. Comment usernames and avatars are preserved. Native header rendering still needs confirmation in Tapestry.
